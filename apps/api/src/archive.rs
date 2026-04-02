use serde::{Deserialize, Serialize};

use crate::{
    error::{ApiResult, AppError},
    workouts::validate_date,
};

pub const VALID_ARCHIVE_REVIEW_STATUSES: &[&str] =
    &["raw", "needs_review", "reviewed", "corrected"];

#[derive(Debug, Serialize)]
pub struct ArchivedWorkoutSummary {
    pub id: String,
    pub archive_date: String,
    pub title: String,
    pub source_system: String,
    pub source_type: String,
    pub review_status: String,
    pub quality_score: Option<f64>,
    pub section_count: i64,
    pub image_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ArchivedWorkoutSection {
    pub id: String,
    pub section_type_raw: Option<String>,
    pub section_type_normalized: Option<String>,
    pub title: Option<String>,
    pub content_raw: String,
    pub content_corrected: String,
    pub order_index: i64,
}

#[derive(Debug, Serialize)]
pub struct ArchivedWorkoutImage {
    pub id: String,
    pub file_path: String,
    pub sort_order: i64,
}

#[derive(Debug, Serialize)]
pub struct ArchivedWorkoutDetail {
    pub id: String,
    pub archive_date: String,
    pub title: String,
    pub source_system: String,
    pub source_type: String,
    pub source_file: Option<String>,
    pub raw_ocr_text: String,
    pub corrected_text: String,
    pub review_status: String,
    pub quality_score: Option<f64>,
    pub exclude_from_stats: bool,
    pub created_at: String,
    pub updated_at: String,
    pub sections: Vec<ArchivedWorkoutSection>,
    pub images: Vec<ArchivedWorkoutImage>,
}

#[derive(Debug, Deserialize)]
pub struct ArchivedWorkoutSectionInput {
    pub section_type_raw: Option<String>,
    pub section_type_normalized: Option<String>,
    pub title: Option<String>,
    pub content_raw: Option<String>,
    pub content_corrected: Option<String>,
    pub order_index: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ArchivedWorkoutImageInput {
    pub file_path: String,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateArchivedWorkoutRequest {
    pub archive_date: String,
    pub title: String,
    pub source_system: Option<String>,
    pub source_type: Option<String>,
    pub source_file: Option<String>,
    pub raw_ocr_text: Option<String>,
    pub corrected_text: Option<String>,
    pub review_status: Option<String>,
    pub quality_score: Option<f64>,
    pub exclude_from_stats: Option<bool>,
    pub sections: Option<Vec<ArchivedWorkoutSectionInput>>,
    pub images: Option<Vec<ArchivedWorkoutImageInput>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateArchivedWorkoutRequest {
    pub archive_date: Option<String>,
    pub title: Option<String>,
    pub source_system: Option<String>,
    pub source_type: Option<String>,
    pub source_file: Option<String>,
    pub raw_ocr_text: Option<String>,
    pub corrected_text: Option<String>,
    pub review_status: Option<String>,
    pub quality_score: Option<f64>,
    pub exclude_from_stats: Option<bool>,
    pub sections: Option<Vec<ArchivedWorkoutSectionInput>>,
    pub images: Option<Vec<ArchivedWorkoutImageInput>>,
}

#[derive(Debug, Deserialize)]
pub struct ImportArchivedWorkoutItem {
    pub archive_date: String,
    pub title: String,
    pub source_system: Option<String>,
    pub source_type: Option<String>,
    pub source_file: Option<String>,
    pub raw_ocr_text: Option<String>,
    pub corrected_text: Option<String>,
    pub review_status: Option<String>,
    pub quality_score: Option<f64>,
    pub exclude_from_stats: Option<bool>,
    pub sections: Option<Vec<ArchivedWorkoutSectionInput>>,
    pub images: Option<Vec<ArchivedWorkoutImageInput>>,
}

#[derive(Debug, Deserialize)]
pub struct ImportArchivedWorkoutsRequest {
    pub entries: Vec<ImportArchivedWorkoutItem>,
}

#[derive(Debug, Serialize)]
pub struct ImportArchivedWorkoutsResponse {
    pub imported: usize,
    pub skipped: usize,
}

#[derive(Debug, Deserialize, Default)]
pub struct ArchivedWorkoutsQuery {
    pub review_status: Option<String>,
    pub year: Option<i32>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn validate_archive_review_status(status: &str) -> ApiResult<()> {
    if VALID_ARCHIVE_REVIEW_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Invalid review_status '{status}': must be one of {VALID_ARCHIVE_REVIEW_STATUSES:?}"
        )))
    }
}

pub fn validate_archive_create(body: &CreateArchivedWorkoutRequest) -> ApiResult<()> {
    validate_date(&body.archive_date)?;
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    if let Some(status) = body.review_status.as_deref() {
        validate_archive_review_status(status)?;
    }
    Ok(())
}

pub fn validate_archive_update(body: &UpdateArchivedWorkoutRequest) -> ApiResult<()> {
    if let Some(date) = body.archive_date.as_deref() {
        validate_date(date)?;
    }
    if let Some(title) = body.title.as_deref() {
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("title cannot be empty".into()));
        }
    }
    if let Some(status) = body.review_status.as_deref() {
        validate_archive_review_status(status)?;
    }
    Ok(())
}

pub fn validate_archive_import_item(body: &ImportArchivedWorkoutItem) -> ApiResult<()> {
    validate_date(&body.archive_date)?;
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    if let Some(status) = body.review_status.as_deref() {
        validate_archive_review_status(status)?;
    }
    Ok(())
}
