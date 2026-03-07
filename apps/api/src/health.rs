use serde::{Deserialize, Serialize};

/// Canonical metric names accepted from lab reports.
pub const KNOWN_METRICS: &[&str] = &[
    "glucose",
    "cholesterol_total",
    "cholesterol_hdl",
    "cholesterol_ldl",
    "hemoglobin",
    "platelets",
    "leukocytes",
    "erythrocytes",
    "esr",
    "creatinine",
    "alt",
    "ast",
];

/// Metric value payload encrypted inside `health_metrics.encrypted_value`.
#[derive(Debug, Serialize, Deserialize)]
pub struct MetricValue {
    pub value: f64,
    pub unit: String,
    pub reference_min: Option<f64>,
    pub reference_max: Option<f64>,
}

/// Health record metadata returned by list / upload endpoints.
#[derive(Debug, Serialize)]
pub struct HealthRecordMeta {
    pub id: String,
    pub filename: String,
    pub lab_date: String,
    pub lab_name: String,
    pub pdf_size_bytes: i64,
    pub metrics_count: i64,
    pub created_at: String,
}

/// Decrypted health metric included in API responses.
#[derive(Debug, Serialize)]
pub struct HealthMetric {
    pub id: String,
    pub record_id: String,
    pub metric_name: String,
    pub recorded_date: String,
    pub value: f64,
    pub unit: String,
    pub reference_min: Option<f64>,
    pub reference_max: Option<f64>,
    pub status: String,
}

/// A single metric extracted by Claude from a lab PDF.
#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractedMetric {
    pub metric_name: String,
    pub value: f64,
    pub unit: String,
    pub reference_min: Option<f64>,
    pub reference_max: Option<f64>,
    /// `"normal"`, `"low"`, or `"high"`.
    pub status: String,
}

/// Full lab extraction response returned by Claude.
#[derive(Debug, Serialize, Deserialize)]
pub struct LabExtraction {
    /// Collection date in `YYYY-MM-DD` format.
    pub lab_date: String,
    /// Laboratory name from the document header.
    pub lab_name: String,
    pub metrics: Vec<ExtractedMetric>,
}

/// Response body for `POST /health/upload`.
#[derive(Serialize)]
pub struct UploadHealthResponse {
    pub record: HealthRecordMeta,
    pub metrics: Vec<HealthMetric>,
}
