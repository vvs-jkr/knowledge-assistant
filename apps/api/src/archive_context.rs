use sqlx::Row as _;

use crate::error::{ApiResult, AppError};

pub async fn build_archive_context(
    db: &sqlx::SqlitePool,
    user_id: &str,
    prompt: &str,
    limit: i64,
) -> ApiResult<String> {
    let rows = sqlx::query(
        "SELECT aw.id, aw.archive_date, aw.title,
                aw.corrected_text, aw.raw_ocr_text
         FROM archived_workouts aw
         WHERE aw.user_id = ?
           AND aw.ready_for_retrieval = 1
           AND aw.review_status IN ('reviewed', 'corrected')
         ORDER BY aw.archive_date DESC, aw.updated_at DESC
         LIMIT 200",
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(AppError::from)?;

    if rows.is_empty() {
        return Ok(String::new());
    }

    let query_terms = extract_query_terms(prompt);
    let mut candidates: Vec<(i64, String)> = Vec::new();

    for row in rows {
        let archive_id: String = row.try_get("id").map_err(AppError::from)?;
        let archive_date: String = row.try_get("archive_date").map_err(AppError::from)?;
        let title: String = row.try_get("title").map_err(AppError::from)?;
        let corrected_text: String = row.try_get("corrected_text").map_err(AppError::from)?;
        let raw_ocr_text: String = row.try_get("raw_ocr_text").map_err(AppError::from)?;

        let section_rows = sqlx::query(
            "SELECT section_type_raw, section_type_normalized, title, content_corrected, content_raw
             FROM archived_workout_sections
             WHERE archived_workout_id = ?
             ORDER BY order_index ASC, created_at ASC",
        )
        .bind(&archive_id)
        .fetch_all(db)
        .await
        .map_err(AppError::from)?;

        let mut section_lines = Vec::new();
        for section in section_rows {
            let raw_type: Option<String> = section
                .try_get("section_type_raw")
                .map_err(AppError::from)?;
            let normalized: Option<String> = section
                .try_get("section_type_normalized")
                .map_err(AppError::from)?;
            let section_title: Option<String> = section.try_get("title").map_err(AppError::from)?;
            let corrected: String = section
                .try_get("content_corrected")
                .map_err(AppError::from)?;
            let raw: String = section.try_get("content_raw").map_err(AppError::from)?;
            let heading = section_title
                .or(raw_type)
                .or(normalized)
                .unwrap_or_else(|| "section".to_owned());
            let content = if corrected.trim().is_empty() {
                raw
            } else {
                corrected
            };
            if !content.trim().is_empty() {
                section_lines.push(format!("{heading}: {}", content.trim()));
            }
        }

        let main_text = if corrected_text.trim().is_empty() {
            raw_ocr_text
        } else {
            corrected_text
        };
        let combined = format!("{title}\n{}\n{main_text}", section_lines.join("\n"));
        let score = score_archive_candidate(&combined, &query_terms);

        if score > 0 || query_terms.is_empty() {
            let preview = combined.chars().take(500).collect::<String>();
            candidates.push((score, format!("[{archive_date}] {title}\n{preview}")));
        }
    }

    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(candidates
        .into_iter()
        .take(limit as usize)
        .map(|(_, text)| text)
        .collect::<Vec<_>>()
        .join("\n\n"))
}

fn extract_query_terms(prompt: &str) -> Vec<String> {
    const STOPWORDS: &[&str] = &[
        "and",
        "for",
        "the",
        "with",
        "без",
        "для",
        "его",
        "еще",
        "или",
        "как",
        "над",
        "ног",
        "она",
        "они",
        "под",
        "после",
        "при",
        "про",
        "это",
        "что",
        "эти",
        "этот",
        "так",
        "мин",
        "раз",
        "на",
        "по",
        "из",
        "от",
    ];

    let mut terms = Vec::new();
    for token in prompt
        .split(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
        .map(|part| part.trim().to_lowercase())
    {
        if token.len() >= 3 && !STOPWORDS.contains(&token.as_str()) && !terms.contains(&token) {
            terms.push(token);
        }
    }
    terms
}

fn score_archive_candidate(text: &str, query_terms: &[String]) -> i64 {
    let haystack = text.to_lowercase();
    query_terms
        .iter()
        .map(|term| {
            if haystack.contains(term) {
                1_i64
            } else {
                0_i64
            }
        })
        .sum()
}

#[cfg(test)]
mod tests {
    use super::{extract_query_terms, score_archive_candidate};

    #[test]
    fn extract_query_terms_deduplicates_and_skips_short_terms() {
        let terms = extract_query_terms("Нужна силовая тренировка на ноги и ноги, 45 мин");
        assert!(terms.contains(&"силовая".to_owned()));
        assert!(terms.contains(&"тренировка".to_owned()));
        assert!(terms.contains(&"ноги".to_owned()));
        assert_eq!(terms.iter().filter(|t| t.as_str() == "ноги").count(), 1);
        assert!(!terms.contains(&"на".to_owned()));
    }

    #[test]
    fn score_archive_candidate_counts_term_hits() {
        let terms = vec!["силовая".to_owned(), "ноги".to_owned(), "жим".to_owned()];
        let score = score_archive_candidate("Силовая работа на ноги и присед", &terms);
        assert_eq!(score, 2);
    }
}
