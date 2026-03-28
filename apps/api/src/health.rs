use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Canonical metric names accepted from lab PDF reports.
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

/// InBody body-composition metrics accepted from CSV exports.
pub const INBODY_METRICS: &[&str] = &[
    "weight",
    "skeletal_muscle_mass",
    "body_fat_mass",
    "bmi",
    "body_fat_percentage",
    "bmr",
    "inbody_score",
    "lean_mass_right_arm",
    "lean_mass_left_arm",
    "lean_mass_trunk",
    "lean_mass_right_leg",
    "lean_mass_left_leg",
    "fat_mass_right_arm",
    "fat_mass_left_arm",
    "fat_mass_trunk",
    "fat_mass_right_leg",
    "fat_mass_left_leg",
    "waist_hip_ratio",
    "visceral_fat_level",
    "total_body_water",
    "intracellular_water",
    "extracellular_water",
    "ecw_ratio",
    "protein",
    "minerals",
    "bone_mineral_content",
    "active_cell_mass",
    "smmi",
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

/// A single metric extracted from a lab PDF or InBody CSV.
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

/// Full lab extraction response returned by Claude or the CSV parser.
#[derive(Debug, Serialize, Deserialize)]
pub struct LabExtraction {
    /// Collection date in `YYYY-MM-DD` format.
    pub lab_date: String,
    /// Laboratory or device name.
    pub lab_name: String,
    pub metrics: Vec<ExtractedMetric>,
}

/// Response body for `POST /health/upload`.
#[derive(Serialize)]
pub struct UploadHealthResponse {
    pub record: HealthRecordMeta,
    pub metrics: Vec<HealthMetric>,
}

// ---------------------------------------------------------------------------
// InBody CSV parser
// ---------------------------------------------------------------------------

/// Column mapping for the InBody 570 CSV export format.
/// `(column_index, canonical_metric_name, unit)`
const INBODY_COLUMN_MAP: &[(usize, &str, &str)] = &[
    (2, "weight", "kg"),
    (3, "skeletal_muscle_mass", "kg"),
    (5, "body_fat_mass", "kg"),
    (6, "bmi", "kg/m²"),
    (7, "body_fat_percentage", "%"),
    (8, "bmr", "kcal"),
    (9, "inbody_score", "score"),
    (10, "lean_mass_right_arm", "kg"),
    (11, "lean_mass_left_arm", "kg"),
    (12, "lean_mass_trunk", "kg"),
    (13, "lean_mass_right_leg", "kg"),
    (14, "lean_mass_left_leg", "kg"),
    (15, "fat_mass_right_arm", "kg"),
    (16, "fat_mass_left_arm", "kg"),
    (17, "fat_mass_trunk", "kg"),
    (18, "fat_mass_right_leg", "kg"),
    (19, "fat_mass_left_leg", "kg"),
    (25, "waist_hip_ratio", ""),
    (28, "visceral_fat_level", "level"),
    (29, "total_body_water", "L"),
    (30, "intracellular_water", "L"),
    (31, "extracellular_water", "L"),
    (32, "ecw_ratio", ""),
    (38, "protein", "kg"),
    (39, "minerals", "kg"),
    (40, "bone_mineral_content", "kg"),
    (41, "active_cell_mass", "kg"),
    (42, "smmi", "kg/m²"),
];

/// Parse an InBody CSV export (UTF-8, comma-separated) into a [`LabExtraction`].
///
/// Expected layout: header row on line 1, single data row on line 2.
/// Column 0 contains the timestamp in `YYYYMMDDHHMMSS` format.
/// Column 1 contains the device model (e.g. `570`).
/// Missing values are represented by `-` and are silently skipped.
pub fn parse_inbody_csv(data: &[u8]) -> Result<LabExtraction, AppError> {
    let text = std::str::from_utf8(data)
        .map_err(|e| AppError::BadRequest(format!("CSV is not valid UTF-8: {e}")))?;

    let mut lines = text.lines().filter(|l| !l.trim().is_empty());
    let _header = lines
        .next()
        .ok_or_else(|| AppError::BadRequest("CSV has no header row".into()))?;
    let data_row = lines
        .next()
        .ok_or_else(|| AppError::BadRequest("CSV has no data row".into()))?;

    let cols: Vec<&str> = data_row.split(',').collect();

    // Column 0: date in YYYYMMDDHHMMSS format
    let date_raw = cols.first().copied().unwrap_or("").trim();
    if date_raw.len() < 8 {
        return Err(AppError::BadRequest(
            "Cannot parse date from CSV column 0 (expected YYYYMMDDHHMMSS)".into(),
        ));
    }
    let lab_date = format!(
        "{}-{}-{}",
        &date_raw[0..4],
        &date_raw[4..6],
        &date_raw[6..8]
    );

    // Column 1: device model
    let device = cols.get(1).copied().unwrap_or("").trim();
    let lab_name = format!("InBody {device}");

    let mut metrics = Vec::new();
    for &(col_idx, metric_name, unit) in INBODY_COLUMN_MAP {
        let raw = match cols.get(col_idx) {
            Some(v) => v.trim(),
            None => continue,
        };
        if raw == "-" || raw.is_empty() {
            continue;
        }
        let value: f64 = match raw.parse() {
            Ok(v) => v,
            Err(_) => continue,
        };
        let (status, reference_min, reference_max) = inbody_reference(metric_name, value);
        metrics.push(ExtractedMetric {
            metric_name: metric_name.to_owned(),
            value,
            unit: unit.to_owned(),
            reference_min,
            reference_max,
            status: status.to_owned(),
        });
    }

    Ok(LabExtraction {
        lab_date,
        lab_name,
        metrics,
    })
}

/// Return `(status, reference_min, reference_max)` for InBody metrics that have
/// established normal ranges. All other metrics default to `"normal"`.
fn inbody_reference(metric: &str, value: f64) -> (&'static str, Option<f64>, Option<f64>) {
    match metric {
        "body_fat_percentage" => {
            // General male reference: 10-20 % normal, >25 % high
            if value < 10.0 {
                ("low", Some(10.0), Some(20.0))
            } else if value > 25.0 {
                ("high", Some(10.0), Some(20.0))
            } else {
                ("normal", Some(10.0), Some(20.0))
            }
        }
        "bmi" => {
            if value < 18.5 {
                ("low", Some(18.5), Some(24.9))
            } else if value > 24.9 {
                ("high", Some(18.5), Some(24.9))
            } else {
                ("normal", Some(18.5), Some(24.9))
            }
        }
        "ecw_ratio" => {
            // Normal 0.360-0.390; >0.390 suggests excess extracellular water
            if value < 0.360 {
                ("low", Some(0.360), Some(0.390))
            } else if value > 0.390 {
                ("high", Some(0.360), Some(0.390))
            } else {
                ("normal", Some(0.360), Some(0.390))
            }
        }
        "visceral_fat_level" => {
            if value > 10.0 {
                ("high", None, Some(10.0))
            } else {
                ("normal", None, Some(10.0))
            }
        }
        "inbody_score" => {
            if value < 70.0 {
                ("low", Some(70.0), Some(100.0))
            } else {
                ("normal", Some(70.0), Some(100.0))
            }
        }
        _ => ("normal", None, None),
    }
}
