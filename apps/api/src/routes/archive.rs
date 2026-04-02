use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use sqlx::Row as _;

use crate::{
    archive::{
        validate_archive_create, validate_archive_import_item, validate_archive_review_status,
        validate_archive_update, ArchivedWorkoutDetail, ArchivedWorkoutImage,
        ArchivedWorkoutImageInput, ArchivedWorkoutSection, ArchivedWorkoutSectionInput,
        ArchivedWorkoutSummary, ArchivedWorkoutsQuery, BatchReviewArchivedWorkoutsRequest,
        BatchReviewArchivedWorkoutsResponse, CreateArchivedWorkoutRequest,
        ImportArchivedWorkoutsRequest, ImportArchivedWorkoutsResponse,
        UpdateArchivedWorkoutRequest,
    },
    config::AppState,
    error::{ApiResult, AppError},
    middleware::AuthUser,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/archive/workouts",
            get(list_archived_workouts).post(create_archived_workout),
        )
        .route(
            "/archive/workouts/import",
            axum::routing::post(import_archived_workouts),
        )
        .route(
            "/archive/workouts/batch-review",
            axum::routing::post(batch_review_archived_workouts),
        )
        .route(
            "/archive/workouts/:id",
            get(get_archived_workout).put(update_archived_workout),
        )
}

async fn list_archived_workouts(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<ArchivedWorkoutsQuery>,
) -> ApiResult<Json<Vec<ArchivedWorkoutSummary>>> {
    let limit = params.limit.unwrap_or(50).min(500);
    let offset = params.offset.unwrap_or(0);
    let year_prefix = params.year.map(|year| format!("{year:04}-%"));

    let rows = sqlx::query(
        r"SELECT aw.id, aw.archive_date, aw.title, aw.source_system, aw.source_type,
                 aw.review_status, aw.ready_for_retrieval, aw.quality_score, aw.created_at, aw.updated_at,
                 COUNT(DISTINCT aws.id) AS section_count,
                 COUNT(DISTINCT awi.id) AS image_count
          FROM archived_workouts aw
          LEFT JOIN archived_workout_sections aws ON aws.archived_workout_id = aw.id
          LEFT JOIN archived_workout_images awi ON awi.archived_workout_id = aw.id
          WHERE aw.user_id = ?
            AND (? IS NULL OR aw.review_status = ?)
            AND (? IS NULL OR aw.archive_date LIKE ?)
          GROUP BY aw.id
          ORDER BY aw.archive_date DESC, aw.created_at DESC
          LIMIT ? OFFSET ?",
    )
    .bind(&claims.sub)
    .bind(params.review_status.as_deref())
    .bind(params.review_status.as_deref())
    .bind(year_prefix.as_deref())
    .bind(year_prefix.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let items = rows
        .into_iter()
        .map(|r| -> ApiResult<ArchivedWorkoutSummary> {
            Ok(ArchivedWorkoutSummary {
                id: r.try_get("id").map_err(AppError::from)?,
                archive_date: r.try_get("archive_date").map_err(AppError::from)?,
                title: r.try_get("title").map_err(AppError::from)?,
                source_system: r.try_get("source_system").map_err(AppError::from)?,
                source_type: r.try_get("source_type").map_err(AppError::from)?,
                review_status: r.try_get("review_status").map_err(AppError::from)?,
                ready_for_retrieval: r
                    .try_get::<i64, _>("ready_for_retrieval")
                    .map_err(AppError::from)?
                    != 0,
                quality_score: r.try_get("quality_score").map_err(AppError::from)?,
                section_count: r.try_get("section_count").map_err(AppError::from)?,
                image_count: r.try_get("image_count").map_err(AppError::from)?,
                created_at: r.try_get("created_at").map_err(AppError::from)?,
                updated_at: r.try_get("updated_at").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(Json(items))
}

async fn create_archived_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateArchivedWorkoutRequest>,
) -> ApiResult<(StatusCode, Json<ArchivedWorkoutDetail>)> {
    validate_archive_create(&body)?;

    let archive_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let source_system = body
        .source_system
        .unwrap_or_else(|| "manual_import".to_owned());
    let source_type = body.source_type.unwrap_or_else(|| "digitized".to_owned());
    let review_status = body.review_status.unwrap_or_else(|| "raw".to_owned());
    let raw_ocr_text = body.raw_ocr_text.unwrap_or_default();
    let corrected_text = body.corrected_text.unwrap_or_default();
    let ready_for_retrieval = body.ready_for_retrieval.unwrap_or(false);
    let exclude_from_stats = body.exclude_from_stats.unwrap_or(true);

    let mut tx = state.db.begin().await.map_err(AppError::from)?;

    sqlx::query(
        r"INSERT INTO archived_workouts
          (id, user_id, archive_date, title, source_system, source_type, source_file,
           raw_ocr_text, corrected_text, review_status, ready_for_retrieval, quality_score,
           exclude_from_stats, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&archive_id)
    .bind(&claims.sub)
    .bind(&body.archive_date)
    .bind(body.title.trim())
    .bind(&source_system)
    .bind(&source_type)
    .bind(body.source_file.as_deref())
    .bind(&raw_ocr_text)
    .bind(&corrected_text)
    .bind(&review_status)
    .bind(if ready_for_retrieval { 1_i64 } else { 0_i64 })
    .bind(body.quality_score)
    .bind(if exclude_from_stats { 1_i64 } else { 0_i64 })
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(AppError::from)?;

    if let Some(sections) = &body.sections {
        replace_sections(&mut tx, &archive_id, sections).await?;
    }

    if let Some(images) = &body.images {
        replace_images(&mut tx, &archive_id, images).await?;
    }

    tx.commit().await.map_err(AppError::from)?;

    let detail = fetch_archived_workout_detail(&state, &archive_id, &claims.sub).await?;
    Ok((StatusCode::CREATED, Json(detail)))
}

async fn import_archived_workouts(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ImportArchivedWorkoutsRequest>,
) -> ApiResult<Json<ImportArchivedWorkoutsResponse>> {
    if body.entries.is_empty() {
        return Err(AppError::BadRequest("entries are required".into()));
    }

    let mut imported = 0_usize;
    let mut skipped = 0_usize;

    for entry in &body.entries {
        validate_archive_import_item(entry)?;
    }

    let mut tx = state.db.begin().await.map_err(AppError::from)?;

    for entry in body.entries {
        let source_system = entry
            .source_system
            .unwrap_or_else(|| "manual_import".to_owned());
        let source_type = entry.source_type.unwrap_or_else(|| "digitized".to_owned());
        let review_status = entry
            .review_status
            .unwrap_or_else(|| "needs_review".to_owned());
        let raw_ocr_text = entry.raw_ocr_text.unwrap_or_default();
        let corrected_text = entry.corrected_text.unwrap_or_default();
        let ready_for_retrieval = entry.ready_for_retrieval.unwrap_or(false);
        let exclude_from_stats = entry.exclude_from_stats.unwrap_or(true);

        let duplicate_exists = sqlx::query(
            "SELECT 1
             FROM archived_workouts
             WHERE user_id = ?
               AND archive_date = ?
               AND title = ?
               AND COALESCE(source_file, '') = COALESCE(?, '')
             LIMIT 1",
        )
        .bind(&claims.sub)
        .bind(&entry.archive_date)
        .bind(entry.title.trim())
        .bind(entry.source_file.as_deref())
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?
        .is_some();

        if duplicate_exists {
            skipped += 1;
            continue;
        }

        let archive_id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        sqlx::query(
            r"INSERT INTO archived_workouts
              (id, user_id, archive_date, title, source_system, source_type, source_file,
               raw_ocr_text, corrected_text, review_status, ready_for_retrieval, quality_score,
               exclude_from_stats, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&archive_id)
        .bind(&claims.sub)
        .bind(&entry.archive_date)
        .bind(entry.title.trim())
        .bind(&source_system)
        .bind(&source_type)
        .bind(entry.source_file.as_deref())
        .bind(&raw_ocr_text)
        .bind(&corrected_text)
        .bind(&review_status)
        .bind(if ready_for_retrieval { 1_i64 } else { 0_i64 })
        .bind(entry.quality_score)
        .bind(if exclude_from_stats { 1_i64 } else { 0_i64 })
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

        if let Some(sections) = &entry.sections {
            replace_sections(&mut tx, &archive_id, sections).await?;
        }

        if let Some(images) = &entry.images {
            replace_images(&mut tx, &archive_id, images).await?;
        }

        imported += 1;
    }

    tx.commit().await.map_err(AppError::from)?;

    Ok(Json(ImportArchivedWorkoutsResponse { imported, skipped }))
}

async fn batch_review_archived_workouts(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<BatchReviewArchivedWorkoutsRequest>,
) -> ApiResult<Json<BatchReviewArchivedWorkoutsResponse>> {
    if body.ids.is_empty() {
        return Err(AppError::BadRequest("ids are required".into()));
    }
    if let Some(status) = body.review_status.as_deref() {
        validate_archive_review_status(status)?;
    }
    if body.review_status.is_none() && body.ready_for_retrieval.is_none() {
        return Err(AppError::BadRequest(
            "review_status or ready_for_retrieval is required".into(),
        ));
    }

    let mut updated = 0_usize;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let mut tx = state.db.begin().await.map_err(AppError::from)?;

    for id in body.ids {
        let result = sqlx::query(
            r"UPDATE archived_workouts
              SET review_status = COALESCE(?, review_status),
                  ready_for_retrieval = CASE
                      WHEN ? IS NULL THEN ready_for_retrieval
                      WHEN ? THEN 1
                      ELSE 0
                  END,
                  updated_at = ?
              WHERE id = ? AND user_id = ?",
        )
        .bind(body.review_status.as_deref())
        .bind(body.ready_for_retrieval)
        .bind(body.ready_for_retrieval.unwrap_or(false))
        .bind(&now)
        .bind(&id)
        .bind(&claims.sub)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

        updated += result.rows_affected() as usize;
    }

    tx.commit().await.map_err(AppError::from)?;
    Ok(Json(BatchReviewArchivedWorkoutsResponse { updated }))
}

async fn get_archived_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<ArchivedWorkoutDetail>> {
    let detail = fetch_archived_workout_detail(&state, &id, &claims.sub).await?;
    Ok(Json(detail))
}

async fn update_archived_workout(
    AuthUser(claims): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateArchivedWorkoutRequest>,
) -> ApiResult<Json<ArchivedWorkoutDetail>> {
    validate_archive_update(&body)?;

    let existing = sqlx::query(
        "SELECT id, archive_date, title, source_system, source_type, source_file,
                raw_ocr_text, corrected_text, review_status, ready_for_retrieval,
                quality_score, exclude_from_stats
         FROM archived_workouts WHERE id = ? AND user_id = ?",
    )
    .bind(&id)
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let archive_date = body
        .archive_date
        .unwrap_or_else(|| existing.try_get("archive_date").unwrap_or_default());
    let title = body.title.as_deref().map(str::trim).map_or_else(
        || existing.try_get("title").unwrap_or_default(),
        ToOwned::to_owned,
    );
    let source_system = body
        .source_system
        .unwrap_or_else(|| existing.try_get("source_system").unwrap_or_default());
    let source_type = body
        .source_type
        .unwrap_or_else(|| existing.try_get("source_type").unwrap_or_default());
    let source_file = if let Some(value) = body.source_file {
        Some(value)
    } else {
        existing.try_get("source_file").unwrap_or(None)
    };
    let raw_ocr_text = if let Some(value) = body.raw_ocr_text {
        value
    } else {
        existing.try_get("raw_ocr_text").unwrap_or_default()
    };
    let corrected_text = if let Some(value) = body.corrected_text {
        value
    } else {
        existing.try_get("corrected_text").unwrap_or_default()
    };
    let review_status = body
        .review_status
        .unwrap_or_else(|| existing.try_get("review_status").unwrap_or_default());
    let ready_for_retrieval = body.ready_for_retrieval.unwrap_or_else(|| {
        existing
            .try_get::<i64, _>("ready_for_retrieval")
            .unwrap_or(0)
            != 0
    });
    let quality_score = if let Some(value) = body.quality_score {
        Some(value)
    } else {
        existing.try_get("quality_score").unwrap_or(None)
    };
    let exclude_from_stats = body.exclude_from_stats.unwrap_or_else(|| {
        existing
            .try_get::<i64, _>("exclude_from_stats")
            .unwrap_or(1)
            != 0
    });

    let mut tx = state.db.begin().await.map_err(AppError::from)?;

    sqlx::query(
        r"UPDATE archived_workouts SET
            archive_date = ?,
            title = ?,
            source_system = ?,
            source_type = ?,
            source_file = ?,
            raw_ocr_text = ?,
            corrected_text = ?,
            review_status = ?,
            ready_for_retrieval = ?,
            quality_score = ?,
            exclude_from_stats = ?,
            updated_at = ?
          WHERE id = ? AND user_id = ?",
    )
    .bind(&archive_date)
    .bind(&title)
    .bind(&source_system)
    .bind(&source_type)
    .bind(source_file.as_deref())
    .bind(&raw_ocr_text)
    .bind(&corrected_text)
    .bind(&review_status)
    .bind(if ready_for_retrieval { 1_i64 } else { 0_i64 })
    .bind(quality_score)
    .bind(if exclude_from_stats { 1_i64 } else { 0_i64 })
    .bind(&now)
    .bind(&id)
    .bind(&claims.sub)
    .execute(&mut *tx)
    .await
    .map_err(AppError::from)?;

    if let Some(sections) = &body.sections {
        sqlx::query("DELETE FROM archived_workout_sections WHERE archived_workout_id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::from)?;
        replace_sections(&mut tx, &id, sections).await?;
    }

    if let Some(images) = &body.images {
        sqlx::query("DELETE FROM archived_workout_images WHERE archived_workout_id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::from)?;
        replace_images(&mut tx, &id, images).await?;
    }

    tx.commit().await.map_err(AppError::from)?;

    let detail = fetch_archived_workout_detail(&state, &id, &claims.sub).await?;
    Ok(Json(detail))
}

async fn fetch_archived_workout_detail(
    state: &AppState,
    archive_id: &str,
    user_id: &str,
) -> ApiResult<ArchivedWorkoutDetail> {
    let row = sqlx::query(
        "SELECT id, archive_date, title, source_system, source_type, source_file,
                raw_ocr_text, corrected_text, review_status, ready_for_retrieval, quality_score,
                exclude_from_stats, created_at, updated_at
         FROM archived_workouts
         WHERE id = ? AND user_id = ?",
    )
    .bind(archive_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;

    let section_rows = sqlx::query(
        "SELECT id, section_type_raw, section_type_normalized, title,
                content_raw, content_corrected, order_index
         FROM archived_workout_sections
         WHERE archived_workout_id = ?
         ORDER BY order_index ASC, created_at ASC",
    )
    .bind(archive_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let sections = section_rows
        .into_iter()
        .map(|r| -> ApiResult<ArchivedWorkoutSection> {
            Ok(ArchivedWorkoutSection {
                id: r.try_get("id").map_err(AppError::from)?,
                section_type_raw: r.try_get("section_type_raw").map_err(AppError::from)?,
                section_type_normalized: r
                    .try_get("section_type_normalized")
                    .map_err(AppError::from)?,
                title: r.try_get("title").map_err(AppError::from)?,
                content_raw: r.try_get("content_raw").map_err(AppError::from)?,
                content_corrected: r.try_get("content_corrected").map_err(AppError::from)?,
                order_index: r.try_get("order_index").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    let image_rows = sqlx::query(
        "SELECT id, file_path, sort_order
         FROM archived_workout_images
         WHERE archived_workout_id = ?
         ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(archive_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let images = image_rows
        .into_iter()
        .map(|r| -> ApiResult<ArchivedWorkoutImage> {
            Ok(ArchivedWorkoutImage {
                id: r.try_get("id").map_err(AppError::from)?,
                file_path: r.try_get("file_path").map_err(AppError::from)?,
                sort_order: r.try_get("sort_order").map_err(AppError::from)?,
            })
        })
        .collect::<ApiResult<Vec<_>>>()?;

    Ok(ArchivedWorkoutDetail {
        id: row.try_get("id").map_err(AppError::from)?,
        archive_date: row.try_get("archive_date").map_err(AppError::from)?,
        title: row.try_get("title").map_err(AppError::from)?,
        source_system: row.try_get("source_system").map_err(AppError::from)?,
        source_type: row.try_get("source_type").map_err(AppError::from)?,
        source_file: row.try_get("source_file").map_err(AppError::from)?,
        raw_ocr_text: row.try_get("raw_ocr_text").map_err(AppError::from)?,
        corrected_text: row.try_get("corrected_text").map_err(AppError::from)?,
        review_status: row.try_get("review_status").map_err(AppError::from)?,
        ready_for_retrieval: row
            .try_get::<i64, _>("ready_for_retrieval")
            .map_err(AppError::from)?
            != 0,
        quality_score: row.try_get("quality_score").map_err(AppError::from)?,
        exclude_from_stats: row
            .try_get::<i64, _>("exclude_from_stats")
            .map_err(AppError::from)?
            != 0,
        created_at: row.try_get("created_at").map_err(AppError::from)?,
        updated_at: row.try_get("updated_at").map_err(AppError::from)?,
        sections,
        images,
    })
}

async fn replace_sections(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    archive_id: &str,
    sections: &[ArchivedWorkoutSectionInput],
) -> ApiResult<()> {
    for (idx, section) in sections.iter().enumerate() {
        let id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
        sqlx::query(
            "INSERT INTO archived_workout_sections
             (id, archived_workout_id, section_type_raw, section_type_normalized, title,
              content_raw, content_corrected, order_index)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(archive_id)
        .bind(section.section_type_raw.as_deref())
        .bind(section.section_type_normalized.as_deref())
        .bind(section.title.as_deref())
        .bind(section.content_raw.as_deref().unwrap_or(""))
        .bind(section.content_corrected.as_deref().unwrap_or(""))
        .bind(section.order_index.unwrap_or(idx as i64))
        .execute(&mut **tx)
        .await
        .map_err(AppError::from)?;
    }
    Ok(())
}

async fn replace_images(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    archive_id: &str,
    images: &[ArchivedWorkoutImageInput],
) -> ApiResult<()> {
    for (idx, image) in images.iter().enumerate() {
        let id = format!("{:032x}", uuid::Uuid::new_v4().as_u128());
        sqlx::query(
            "INSERT INTO archived_workout_images
             (id, archived_workout_id, file_path, sort_order)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(archive_id)
        .bind(&image.file_path)
        .bind(image.sort_order.unwrap_or(idx as i64))
        .execute(&mut **tx)
        .await
        .map_err(AppError::from)?;
    }
    Ok(())
}
