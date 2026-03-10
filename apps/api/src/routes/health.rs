use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    routing::{delete, get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;

use crate::{
    ai,
    config::AppState,
    crypto,
    error::{ApiResult, AppError},
    health::{HealthMetric, HealthRecordMeta, MetricValue, UploadHealthResponse, KNOWN_METRICS},
    middleware::AuthUser,
};

/// Maximum accepted file size for a PDF upload: 20 MiB.
const MAX_PDF_SIZE: usize = 20 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health/upload", post(upload_health))
        .route("/health/records", get(list_records))
        .route("/health/records/:id", delete(delete_record))
        .route("/health/metrics", get(list_metrics))
        .route("/health/export", get(export_health))
        .layer(DefaultBodyLimit::max(MAX_PDF_SIZE))
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
    if state.anthropic_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Anthropic API key not configured".into(),
        ));
    }

    let mut pdf_bytes: Option<Vec<u8>> = None;
    let mut pdf_filename: Option<String> = None;
    let mut lab_date: Option<String> = None;
    let mut lab_name: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("multipart error: {e}")))?
    {
        let field_name = field.name().unwrap_or("").to_owned();

        match field_name.as_str() {
            "file" => {
                let filename = field
                    .file_name()
                    .ok_or_else(|| AppError::BadRequest("Missing filename in file field".into()))?
                    .to_owned();

                let ext = std::path::Path::new(&filename)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if ext != "pdf" {
                    return Err(AppError::BadRequest(format!(
                        "Only PDF files allowed, got: {filename}"
                    )));
                }

                let data = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("failed to read PDF: {e}")))?;

                if data.len() > MAX_PDF_SIZE {
                    return Err(AppError::PayloadTooLarge);
                }

                pdf_filename = Some(filename);
                pdf_bytes = Some(data.to_vec());
            }
            "lab_date" => {
                lab_date =
                    Some(field.text().await.map_err(|e| {
                        AppError::BadRequest(format!("failed to read lab_date: {e}"))
                    })?);
            }
            "lab_name" => {
                lab_name =
                    Some(field.text().await.map_err(|e| {
                        AppError::BadRequest(format!("failed to read lab_name: {e}"))
                    })?);
            }
            _ => {
                // consume unknown fields to avoid multipart errors
                let _ = field.bytes().await;
            }
        }
    }

    let pdf_bytes = pdf_bytes.ok_or_else(|| AppError::BadRequest("No PDF file provided".into()))?;
    let pdf_filename = pdf_filename.expect("set when pdf_bytes is Some");
    let lab_date =
        lab_date.ok_or_else(|| AppError::BadRequest("lab_date field is required".into()))?;
    let lab_name = lab_name.unwrap_or_default();

    // Base64-encode the PDF for the Anthropic Messages API.
    let pdf_base64 = STANDARD.encode(&pdf_bytes);

    // Call Claude to extract metrics (synchronous — the result drives the response).
    let extraction = ai::extract_lab_metrics(
        &state.http_client,
        &state.anthropic_api_key,
        &pdf_base64,
        &pdf_filename,
    )
    .await?;

    // Encrypt and persist the PDF.
    let size_bytes = i64::try_from(pdf_bytes.len())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("size overflow: {e}")))?;
    let (encrypted_pdf, pdf_nonce) = crypto::encrypt(&state.encryption_key, &pdf_bytes)?;

    let record_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let user_id = &claims.sub;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query!(
        r#"INSERT INTO health_records
           (id, user_id, filename, lab_date, lab_name, encrypted_pdf, nonce, pdf_size_bytes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        record_id,
        user_id,
        pdf_filename,
        lab_date,
        lab_name,
        encrypted_pdf,
        pdf_nonce,
        size_bytes,
        now,
        now,
    )
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    // Persist each recognised metric.
    let mut metrics: Vec<HealthMetric> = Vec::new();

    for extracted in &extraction.metrics {
        if !KNOWN_METRICS.contains(&extracted.metric_name.as_str()) {
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
        let (encrypted_value, metric_nonce) = crypto::encrypt(&state.encryption_key, &value_json)?;

        let metric_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());

        sqlx::query!(
            r#"INSERT INTO health_metrics
               (id, record_id, user_id, metric_name, recorded_date, status, encrypted_value, nonce, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            metric_id,
            record_id,
            user_id,
            extracted.metric_name,
            lab_date,
            extracted.status,
            encrypted_value,
            metric_nonce,
            now,
        )
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

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

    let metrics_count = i64::try_from(metrics.len())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("metrics count overflow: {e}")))?;

    let record = HealthRecordMeta {
        id: record_id,
        filename: pdf_filename,
        lab_date,
        lab_name,
        pdf_size_bytes: size_bytes,
        metrics_count,
        created_at: now,
    };

    Ok((
        StatusCode::CREATED,
        Json(UploadHealthResponse { record, metrics }),
    ))
}

// ---------------------------------------------------------------------------
// GET /health/records
// ---------------------------------------------------------------------------

async fn list_records(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
) -> ApiResult<Json<Vec<HealthRecordMeta>>> {
    let rows = sqlx::query!(
        r#"SELECT r.id as "id!", r.filename as "filename!", r.lab_date as "lab_date!",
                  r.lab_name as "lab_name!", r.pdf_size_bytes as "pdf_size_bytes!: i64",
                  r.created_at as "created_at!",
                  COUNT(m.id) as "metrics_count!: i64"
           FROM health_records r
           LEFT JOIN health_metrics m ON m.record_id = r.id
           WHERE r.user_id = ?
           GROUP BY r.id
           ORDER BY r.lab_date DESC"#,
        claims.sub,
    )
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let records = rows
        .into_iter()
        .map(|r| HealthRecordMeta {
            id: r.id,
            filename: r.filename,
            lab_date: r.lab_date,
            lab_name: r.lab_name,
            pdf_size_bytes: r.pdf_size_bytes,
            metrics_count: r.metrics_count,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(records))
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
        r"SELECT id, record_id, metric_name, recorded_date, status, encrypted_value, nonce
           FROM health_metrics
           WHERE user_id = ?
             AND (? IS NULL OR metric_name = ?)
             AND (? IS NULL OR recorded_date >= ?)
             AND (? IS NULL OR recorded_date <= ?)
           ORDER BY recorded_date ASC, metric_name ASC",
    )
    .bind(user_id)
    .bind(params.metric_name.as_deref())
    .bind(params.metric_name.as_deref())
    .bind(params.from.as_deref())
    .bind(params.from.as_deref())
    .bind(params.to.as_deref())
    .bind(params.to.as_deref())
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
                (Some(min), Some(max)) => format!("{min} – {max}"),
                (Some(min), None) => format!("> {min}"),
                (None, Some(max)) => format!("< {max}"),
                (None, None) => "—".into(),
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
