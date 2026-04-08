use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;

use crate::{
    ai,
    config::AppState,
    crypto,
    error::{ApiResult, AppError},
    health::{
        parse_inbody_csv, HealthConsultRequest, HealthConsultResponse, HealthLabBatchDetail,
        HealthLabBatchSummary, HealthMetric, HealthRecordDetail, HealthRecordMeta, MetricValue,
        UploadHealthResponse, INBODY_METRICS, KNOWN_METRICS,
    },
    middleware::AuthUser,
};

/// Maximum accepted file size for an upload: 20 MiB.
const MAX_FILE_SIZE: usize = 20 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health/upload", post(upload_health))
        .route("/health/records", get(list_records))
        .route("/health/records/:id", get(get_record).delete(delete_record))
        .route("/health/records/:id/file", get(download_record_file))
        .route("/health/lab-batches", get(list_lab_batches))
        .route("/health/lab-batches/:id", get(get_lab_batch))
        .route("/health/lab-batches/:id/consult", post(consult_lab_batch))
        .route("/health/metrics", get(list_metrics))
        .route("/health/export", get(export_health))
        .layer(DefaultBodyLimit::max(MAX_FILE_SIZE))
}

#[derive(Debug)]
struct UploadedHealthFile {
    name: String,
    ext: String,
    bytes: Vec<u8>,
}

// ---------------------------------------------------------------------------
// POST /health/upload
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
async fn upload_health(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> ApiResult<(StatusCode, Json<UploadHealthResponse>)> {
    let mut files: Vec<UploadedHealthFile> = Vec::new();
    let mut lab_date_field: Option<String> = None;
    let mut lab_name_field: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("multipart error: {e}")))?
    {
        let field_name = field.name().unwrap_or("").to_owned();

        match field_name.as_str() {
            "file" => {
                let uploaded_name = field
                    .file_name()
                    .ok_or_else(|| AppError::BadRequest("Missing filename in file field".into()))?
                    .to_owned();

                let ext = std::path::Path::new(&uploaded_name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if ext != "pdf" && ext != "csv" {
                    return Err(AppError::BadRequest(format!(
                        "Only PDF or CSV files are accepted, got: {uploaded_name}"
                    )));
                }

                let data = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("failed to read file: {e}")))?;

                if data.len() > MAX_FILE_SIZE {
                    return Err(AppError::PayloadTooLarge);
                }

                files.push(UploadedHealthFile {
                    name: uploaded_name,
                    ext,
                    bytes: data.to_vec(),
                });
            }
            "lab_date" => {
                lab_date_field =
                    Some(field.text().await.map_err(|e| {
                        AppError::BadRequest(format!("failed to read lab_date: {e}"))
                    })?);
            }
            "lab_name" => {
                lab_name_field =
                    Some(field.text().await.map_err(|e| {
                        AppError::BadRequest(format!("failed to read lab_name: {e}"))
                    })?);
            }
            _ => {
                let _ = field.bytes().await;
            }
        }
    }

    if files.is_empty() {
        return Err(AppError::BadRequest("No file provided".into()));
    }

    let first_ext = files[0].ext.clone();
    if files.iter().any(|file| file.ext != first_ext) {
        return Err(AppError::BadRequest(
            "All uploaded files must have the same type".into(),
        ));
    }

    if first_ext == "csv" && files.len() > 1 {
        return Err(AppError::BadRequest(
            "InBody upload accepts only one CSV file at a time".into(),
        ));
    }

    if first_ext == "pdf" && files.len() > 7 {
        return Err(AppError::BadRequest(
            "One lab upload can contain at most 7 PDF files".into(),
        ));
    }

    let user_id = &claims.sub;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let source_kind = if first_ext == "csv" {
        "inbody"
    } else {
        "lab_report"
    };
    let upload_batch_id = if source_kind == "lab_report" {
        Some(format!("{:032x}", uuid::Uuid::new_v4().as_u128()))
    } else {
        None
    };

    let mut tx = state.db.begin().await.map_err(AppError::from)?;
    let mut records = Vec::with_capacity(files.len());
    let mut metrics: Vec<HealthMetric> = Vec::new();

    for file in &files {
        let allowed_metrics: &[&str];
        let (extraction, lab_date, lab_name) = if source_kind == "inbody" {
            let parsed = parse_inbody_csv(&file.bytes)?;
            let date = lab_date_field
                .clone()
                .unwrap_or_else(|| parsed.lab_date.clone());
            let name = lab_name_field
                .clone()
                .unwrap_or_else(|| parsed.lab_name.clone());
            allowed_metrics = INBODY_METRICS;
            (parsed, date, name)
        } else {
            if state.anthropic_api_key.is_empty() {
                return Err(AppError::BadRequest(
                    "Anthropic API key not configured".into(),
                ));
            }
            let date = lab_date_field.clone().ok_or_else(|| {
                AppError::BadRequest("lab_date is required for PDF upload".into())
            })?;
            let pdf_base64 = STANDARD.encode(&file.bytes);
            let extraction = ai::extract_lab_metrics(
                &state.http_client,
                &state.anthropic_api_key,
                &state.anthropic_model,
                &pdf_base64,
                &file.name,
            )
            .await?;
            let name = if let Some(explicit_name) = lab_name_field.clone() {
                explicit_name
            } else {
                extraction.lab_name.clone()
            };
            allowed_metrics = KNOWN_METRICS;
            (extraction, date, name)
        };

        let size_bytes = i64::try_from(file.bytes.len())
            .map_err(|e| AppError::Internal(anyhow::anyhow!("size overflow: {e}")))?;
        let (encrypted_pdf, pdf_nonce) = crypto::encrypt(&state.encryption_key, &file.bytes)?;
        let record_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());

        sqlx::query(
            r"INSERT INTO health_records
              (id, user_id, filename, lab_date, lab_name, source_kind, upload_batch_id,
               encrypted_pdf, nonce, pdf_size_bytes, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&record_id)
        .bind(user_id)
        .bind(&file.name)
        .bind(&lab_date)
        .bind(&lab_name)
        .bind(source_kind)
        .bind(upload_batch_id.as_deref())
        .bind(encrypted_pdf)
        .bind(pdf_nonce)
        .bind(size_bytes)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

        let mut record_metrics_count = 0_i64;
        for extracted in &extraction.metrics {
            if !allowed_metrics.contains(&extracted.metric_name.as_str()) {
                continue;
            }

            let mv = MetricValue {
                value: extracted.value,
                unit: extracted.unit.clone(),
                reference_min: extracted.reference_min,
                reference_max: extracted.reference_max,
            };
            let value_json = serde_json::to_vec(&mv)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("serialize metric: {e}")))?;
            let (encrypted_value, metric_nonce) =
                crypto::encrypt(&state.encryption_key, &value_json)?;

            let metric_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());

            sqlx::query(
                r"INSERT INTO health_metrics
                  (id, record_id, user_id, metric_name, recorded_date, status, encrypted_value, nonce, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&metric_id)
            .bind(&record_id)
            .bind(user_id)
            .bind(&extracted.metric_name)
            .bind(&lab_date)
            .bind(&extracted.status)
            .bind(encrypted_value)
            .bind(metric_nonce)
            .bind(&now)
            .execute(&mut *tx)
            .await
            .map_err(AppError::from)?;

            record_metrics_count += 1;
            metrics.push(HealthMetric {
                id: metric_id,
                record_id: record_id.clone(),
                metric_name: extracted.metric_name.clone(),
                recorded_date: lab_date.clone(),
                value: extracted.value,
                unit: extracted.unit.clone(),
                reference_min: extracted.reference_min,
                reference_max: extracted.reference_max,
                status: extracted.status.clone(),
            });
        }

        records.push(HealthRecordMeta {
            id: record_id,
            filename: file.name.clone(),
            lab_date,
            lab_name,
            source_kind: source_kind.to_owned(),
            upload_batch_id: upload_batch_id.clone(),
            pdf_size_bytes: size_bytes,
            metrics_count: record_metrics_count,
            created_at: now.clone(),
        });
    }

    tx.commit().await.map_err(AppError::from)?;

    Ok((
        StatusCode::CREATED,
        Json(UploadHealthResponse {
            record: records.first().cloned(),
            records,
            metrics,
            upload_batch_id,
        }),
    ))
}

// ---------------------------------------------------------------------------
// GET /health/records
// ---------------------------------------------------------------------------

#[derive(Deserialize, Default)]
struct RecordsQuery {
    kind: Option<String>,
}

async fn list_records(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<RecordsQuery>,
) -> ApiResult<Json<Vec<HealthRecordMeta>>> {
    let rows = sqlx::query(
        r"SELECT r.id, r.filename, r.lab_date, r.lab_name, r.source_kind, r.upload_batch_id,
                 r.pdf_size_bytes, r.created_at, COUNT(m.id) AS metrics_count
          FROM health_records r
          LEFT JOIN health_metrics m ON m.record_id = r.id
          WHERE r.user_id = ?
            AND (? IS NULL OR r.source_kind = ?)
          GROUP BY r.id
          ORDER BY r.lab_date DESC, r.created_at DESC",
    )
    .bind(&claims.sub)
    .bind(params.kind.as_deref())
    .bind(params.kind.as_deref())
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let records = rows
        .into_iter()
        .map(|row| -> ApiResult<HealthRecordMeta> {
            use sqlx::Row as _;

            Ok(HealthRecordMeta {
                id: row.try_get("id").map_err(AppError::from)?,
                filename: row.try_get("filename").map_err(AppError::from)?,
                lab_date: row.try_get("lab_date").map_err(AppError::from)?,
                lab_name: row.try_get("lab_name").map_err(AppError::from)?,
                source_kind: row.try_get("source_kind").map_err(AppError::from)?,
                upload_batch_id: row.try_get("upload_batch_id").map_err(AppError::from)?,
                pdf_size_bytes: row.try_get("pdf_size_bytes").map_err(AppError::from)?,
                metrics_count: row.try_get("metrics_count").map_err(AppError::from)?,
                created_at: row.try_get("created_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(records))
}

// ---------------------------------------------------------------------------
// GET /health/records/:id
// ---------------------------------------------------------------------------

async fn get_record(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<HealthRecordDetail>> {
    use sqlx::Row as _;

    let row = sqlx::query(
        r"SELECT r.id, r.filename, r.lab_date, r.lab_name, r.source_kind, r.upload_batch_id,
                 r.pdf_size_bytes, r.created_at, COUNT(m.id) AS metrics_count
          FROM health_records r
          LEFT JOIN health_metrics m ON m.record_id = r.id
          WHERE r.id = ? AND r.user_id = ?
          GROUP BY r.id",
    )
    .bind(&id)
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let metric_rows = sqlx::query(
        r"SELECT id, record_id, metric_name, recorded_date, status, encrypted_value, nonce
           FROM health_metrics
           WHERE user_id = ? AND record_id = ?
           ORDER BY metric_name ASC, recorded_date ASC",
    )
    .bind(&claims.sub)
    .bind(&id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let mut metrics = Vec::with_capacity(metric_rows.len());
    for metric_row in &metric_rows {
        let encrypted_value: Vec<u8> = metric_row
            .try_get("encrypted_value")
            .map_err(AppError::from)?;
        let nonce: Vec<u8> = metric_row.try_get("nonce").map_err(AppError::from)?;
        let value_json = crypto::decrypt(&state.encryption_key, &encrypted_value, &nonce)?;
        let mv: MetricValue = serde_json::from_slice(&value_json)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("metric decrypt parse: {e}")))?;

        metrics.push(HealthMetric {
            id: metric_row.try_get("id").map_err(AppError::from)?,
            record_id: metric_row.try_get("record_id").map_err(AppError::from)?,
            metric_name: metric_row.try_get("metric_name").map_err(AppError::from)?,
            recorded_date: metric_row
                .try_get("recorded_date")
                .map_err(AppError::from)?,
            status: metric_row.try_get("status").map_err(AppError::from)?,
            value: mv.value,
            unit: mv.unit,
            reference_min: mv.reference_min,
            reference_max: mv.reference_max,
        });
    }

    Ok(Json(HealthRecordDetail {
        id: row.try_get("id").map_err(AppError::from)?,
        filename: row.try_get("filename").map_err(AppError::from)?,
        lab_date: row.try_get("lab_date").map_err(AppError::from)?,
        lab_name: row.try_get("lab_name").map_err(AppError::from)?,
        source_kind: row.try_get("source_kind").map_err(AppError::from)?,
        upload_batch_id: row.try_get("upload_batch_id").map_err(AppError::from)?,
        pdf_size_bytes: row.try_get("pdf_size_bytes").map_err(AppError::from)?,
        metrics_count: row.try_get("metrics_count").map_err(AppError::from)?,
        created_at: row.try_get("created_at").map_err(AppError::from)?,
        metrics,
    }))
}

// ---------------------------------------------------------------------------
// GET /health/records/:id/file
// ---------------------------------------------------------------------------

async fn download_record_file(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    use sqlx::Row as _;

    let row = sqlx::query(
        r#"SELECT filename as "filename!", encrypted_pdf as "encrypted_pdf!: Vec<u8>",
                  nonce as "nonce!: Vec<u8>"
           FROM health_records
           WHERE id = ? AND user_id = ?"#,
    )
    .bind(&id)
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let filename: String = row.try_get("filename").map_err(AppError::from)?;
    let encrypted_file: Vec<u8> = row.try_get("encrypted_pdf").map_err(AppError::from)?;
    let nonce: Vec<u8> = row.try_get("nonce").map_err(AppError::from)?;

    let file_bytes = crypto::decrypt(&state.encryption_key, &encrypted_file, &nonce)?;
    let is_pdf = filename.to_ascii_lowercase().ends_with(".pdf");
    let content_type = if is_pdf {
        "application/pdf"
    } else {
        "text/csv; charset=utf-8"
    };
    let disposition = if is_pdf { "inline" } else { "attachment" };

    Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!(r#"{disposition}; filename="{}""#, filename),
        )
        .body(axum::body::Body::from(file_bytes))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("response build: {e}")))
}

// ---------------------------------------------------------------------------
// GET /health/lab-batches
// ---------------------------------------------------------------------------

async fn list_lab_batches(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<HealthLabBatchSummary>>> {
    let rows = sqlx::query(
        r"SELECT COALESCE(r.upload_batch_id, r.id) AS batch_id,
                 MAX(r.lab_date) AS lab_date,
                 MAX(r.lab_name) AS lab_name,
                 COUNT(DISTINCT r.id) AS file_count,
                 COUNT(m.id) AS metrics_count,
                 MAX(r.created_at) AS created_at
          FROM health_records r
          LEFT JOIN health_metrics m ON m.record_id = r.id
          WHERE r.user_id = ? AND r.source_kind = 'lab_report'
          GROUP BY COALESCE(r.upload_batch_id, r.id)
          ORDER BY lab_date DESC, created_at DESC",
    )
    .bind(&claims.sub)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let batches = rows
        .into_iter()
        .map(|row| -> ApiResult<HealthLabBatchSummary> {
            use sqlx::Row as _;

            Ok(HealthLabBatchSummary {
                id: row.try_get("batch_id").map_err(AppError::from)?,
                lab_date: row.try_get("lab_date").map_err(AppError::from)?,
                lab_name: row.try_get("lab_name").map_err(AppError::from)?,
                file_count: row.try_get("file_count").map_err(AppError::from)?,
                metrics_count: row.try_get("metrics_count").map_err(AppError::from)?,
                created_at: row.try_get("created_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(batches))
}

// ---------------------------------------------------------------------------
// GET /health/lab-batches/:id
// ---------------------------------------------------------------------------

async fn get_lab_batch(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<HealthLabBatchDetail>> {
    use sqlx::Row as _;

    let record_rows = sqlx::query(
        r"SELECT r.id, r.filename, r.lab_date, r.lab_name, r.source_kind, r.upload_batch_id,
                 r.pdf_size_bytes, r.created_at, COUNT(m.id) AS metrics_count
          FROM health_records r
          LEFT JOIN health_metrics m ON m.record_id = r.id
          WHERE r.user_id = ?
            AND r.source_kind = 'lab_report'
            AND COALESCE(r.upload_batch_id, r.id) = ?
          GROUP BY r.id
          ORDER BY r.created_at ASC, r.filename ASC",
    )
    .bind(&claims.sub)
    .bind(&id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    if record_rows.is_empty() {
        return Err(AppError::NotFound);
    }

    let records = record_rows
        .into_iter()
        .map(|row| -> ApiResult<HealthRecordMeta> {
            Ok(HealthRecordMeta {
                id: row.try_get("id").map_err(AppError::from)?,
                filename: row.try_get("filename").map_err(AppError::from)?,
                lab_date: row.try_get("lab_date").map_err(AppError::from)?,
                lab_name: row.try_get("lab_name").map_err(AppError::from)?,
                source_kind: row.try_get("source_kind").map_err(AppError::from)?,
                upload_batch_id: row.try_get("upload_batch_id").map_err(AppError::from)?,
                pdf_size_bytes: row.try_get("pdf_size_bytes").map_err(AppError::from)?,
                metrics_count: row.try_get("metrics_count").map_err(AppError::from)?,
                created_at: row.try_get("created_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    let metrics = fetch_metrics(
        &state,
        &claims.sub,
        &MetricsQuery {
            metric_name: None,
            from: None,
            to: None,
            kind: Some("lab_report".into()),
            batch_id: Some(id.clone()),
        },
    )
    .await?;

    let file_count = i64::try_from(records.len())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("file count overflow: {e}")))?;
    let metrics_count = i64::try_from(metrics.len())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("metrics count overflow: {e}")))?;
    let first = &records[0];

    Ok(Json(HealthLabBatchDetail {
        id,
        lab_date: first.lab_date.clone(),
        lab_name: first.lab_name.clone(),
        file_count,
        metrics_count,
        created_at: first.created_at.clone(),
        records,
        metrics,
    }))
}

// ---------------------------------------------------------------------------
// POST /health/lab-batches/:id/consult
// ---------------------------------------------------------------------------

async fn consult_lab_batch(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<HealthConsultRequest>,
) -> ApiResult<Json<HealthConsultResponse>> {
    if state.anthropic_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Health consultation is not configured (missing ANTHROPIC_API_KEY)".into(),
        ));
    }

    let question = body.question.trim();
    if question.is_empty() {
        return Err(AppError::BadRequest("question is required".into()));
    }

    let lab_context = build_lab_batch_context(&state, &claims.sub, &id).await?;
    let answer = ai::consult_lab_results(
        &state.http_client,
        &state.anthropic_api_key,
        &state.anthropic_model,
        &lab_context,
        question,
    )
    .await?;

    Ok(Json(HealthConsultResponse { answer }))
}

// ---------------------------------------------------------------------------
// DELETE /health/records/:id
// ---------------------------------------------------------------------------

async fn delete_record(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM health_records WHERE id = ? AND user_id = ?",
        id,
        claims.sub,
    )
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /health/metrics  (query params: metric_name, from, to)
// ---------------------------------------------------------------------------

#[derive(Deserialize, Default)]
struct MetricsQuery {
    metric_name: Option<String>,
    from: Option<String>,
    to: Option<String>,
    kind: Option<String>,
    batch_id: Option<String>,
}

async fn list_metrics(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<MetricsQuery>,
) -> ApiResult<Json<Vec<HealthMetric>>> {
    let metrics = fetch_metrics(&state, &claims.sub, &params).await?;
    Ok(Json(metrics))
}

// ---------------------------------------------------------------------------
// GET /health/export
// ---------------------------------------------------------------------------

async fn export_health(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<MetricsQuery>,
) -> ApiResult<Response> {
    let metrics = fetch_metrics(&state, &claims.sub, &params).await?;
    let markdown = build_markdown(&metrics);
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let filename = format!("health-export-{today}.md");

    Response::builder()
        .header(header::CONTENT_TYPE, "text/markdown; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(axum::body::Body::from(markdown))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("response build: {e}")))
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Fetch + decrypt health metrics with optional filters.
async fn fetch_metrics(
    state: &AppState,
    user_id: &str,
    params: &MetricsQuery,
) -> ApiResult<Vec<HealthMetric>> {
    use sqlx::Row as _;

    let rows = sqlx::query(
        r"SELECT m.id, m.record_id, m.metric_name, m.recorded_date, m.status, m.encrypted_value, m.nonce
           FROM health_metrics m
           JOIN health_records r ON r.id = m.record_id
           WHERE m.user_id = ?
             AND (? IS NULL OR m.metric_name = ?)
             AND (? IS NULL OR m.recorded_date >= ?)
             AND (? IS NULL OR m.recorded_date <= ?)
             AND (? IS NULL OR r.source_kind = ?)
             AND (? IS NULL OR COALESCE(r.upload_batch_id, r.id) = ?)
           ORDER BY m.recorded_date ASC, m.metric_name ASC",
    )
    .bind(user_id)
    .bind(params.metric_name.as_deref())
    .bind(params.metric_name.as_deref())
    .bind(params.from.as_deref())
    .bind(params.from.as_deref())
    .bind(params.to.as_deref())
    .bind(params.to.as_deref())
    .bind(params.kind.as_deref())
    .bind(params.kind.as_deref())
    .bind(params.batch_id.as_deref())
    .bind(params.batch_id.as_deref())
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let mut metrics = Vec::with_capacity(rows.len());
    for row in &rows {
        let encrypted_value: Vec<u8> = row.try_get("encrypted_value").map_err(AppError::from)?;
        let nonce: Vec<u8> = row.try_get("nonce").map_err(AppError::from)?;
        let value_json = crypto::decrypt(&state.encryption_key, &encrypted_value, &nonce)?;
        let mv: MetricValue = serde_json::from_slice(&value_json)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("metric decrypt parse: {e}")))?;

        metrics.push(HealthMetric {
            id: row.try_get("id").map_err(AppError::from)?,
            record_id: row.try_get("record_id").map_err(AppError::from)?,
            metric_name: row.try_get("metric_name").map_err(AppError::from)?,
            recorded_date: row.try_get("recorded_date").map_err(AppError::from)?,
            status: row.try_get("status").map_err(AppError::from)?,
            value: mv.value,
            unit: mv.unit,
            reference_min: mv.reference_min,
            reference_max: mv.reference_max,
        });
    }

    Ok(metrics)
}

async fn build_lab_batch_context(
    state: &AppState,
    user_id: &str,
    batch_id: &str,
) -> ApiResult<String> {
    use sqlx::Row as _;

    let record_rows = sqlx::query(
        r"SELECT id, filename, lab_date, lab_name
          FROM health_records
          WHERE user_id = ?
            AND source_kind = 'lab_report'
            AND COALESCE(upload_batch_id, id) = ?
          ORDER BY created_at ASC, filename ASC",
    )
    .bind(user_id)
    .bind(batch_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    if record_rows.is_empty() {
        return Err(AppError::NotFound);
    }

    let metrics = fetch_metrics(
        state,
        user_id,
        &MetricsQuery {
            metric_name: None,
            from: None,
            to: None,
            kind: Some("lab_report".into()),
            batch_id: Some(batch_id.to_owned()),
        },
    )
    .await?;

    let first = &record_rows[0];
    let lab_date: String = first.try_get("lab_date").map_err(AppError::from)?;
    let lab_name: String = first.try_get("lab_name").map_err(AppError::from)?;

    let mut lines = vec![
        format!("Дата сдачи: {lab_date}"),
        format!("Лаборатория: {lab_name}"),
        format!("Файлов в сдаче: {}", record_rows.len()),
    ];

    lines.push("Файлы:".into());
    for row in &record_rows {
        let filename: String = row.try_get("filename").map_err(AppError::from)?;
        lines.push(format!("- {filename}"));
    }

    lines.push("Показатели:".into());
    if metrics.is_empty() {
        lines.push("- Распознанных показателей нет".into());
    } else {
        for metric in &metrics {
            let reference = match (metric.reference_min, metric.reference_max) {
                (Some(min), Some(max)) => format!("{min}-{max}"),
                (Some(min), None) => format!("> {min}"),
                (None, Some(max)) => format!("< {max}"),
                (None, None) => "--".into(),
            };
            lines.push(format!(
                "- {}: {} {} | статус: {} | референс: {}",
                metric.metric_name, metric.value, metric.unit, metric.status, reference
            ));
        }
    }

    Ok(lines.join("\n"))
}

fn build_markdown(metrics: &[HealthMetric]) -> String {
    use std::fmt::Write as _;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut md = format!("---\nexport_date: {today}\n---\n\n# Health Metrics\n\n");

    let mut by_date: std::collections::BTreeMap<&str, Vec<&HealthMetric>> =
        std::collections::BTreeMap::new();
    for m in metrics {
        by_date.entry(m.recorded_date.as_str()).or_default().push(m);
    }

    for (date, date_metrics) in &by_date {
        let _ = write!(md, "## {date}\n\n");
        md.push_str("| Metric | Value | Unit | Reference | Status |\n");
        md.push_str("|--------|-------|------|-----------|--------|\n");
        for m in date_metrics {
            let reference = match (m.reference_min, m.reference_max) {
                (Some(min), Some(max)) => format!("{min} - {max}"),
                (Some(min), None) => format!("> {min}"),
                (None, Some(max)) => format!("< {max}"),
                (None, None) => "--".into(),
            };
            let _ = writeln!(
                md,
                "| {} | {} | {} | {} | {} |",
                m.metric_name, m.value, m.unit, reference, m.status
            );
        }
        md.push('\n');
    }

    md
}
