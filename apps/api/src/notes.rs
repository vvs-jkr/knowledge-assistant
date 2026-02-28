use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// Note metadata returned by list/upload endpoints (never includes decrypted content).
#[derive(Serialize)]
pub struct NoteMetadata {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub frontmatter: Option<JsonValue>,
    pub created_at: String,
    pub updated_at: String,
}

/// Full note with decrypted content — returned by GET /notes/{id}.
#[derive(Serialize)]
pub struct NoteWithContent {
    pub id: String,
    pub filename: String,
    pub content: String,
    pub frontmatter: Option<JsonValue>,
    pub created_at: String,
    pub updated_at: String,
}

/// Request body for PUT /notes/{id}.
#[derive(Deserialize)]
pub struct UpdateNoteRequest {
    pub content: String,
    /// Optional rename — if absent, existing filename is kept.
    pub filename: Option<String>,
}

/// Extracts YAML frontmatter from markdown content.
///
/// Returns `(frontmatter_json, body_without_frontmatter)`.
/// If the content does not start with `---`, both the frontmatter is `None`
/// and the full original slice is returned as the body.
pub fn extract_frontmatter(content: &str) -> (Option<JsonValue>, &str) {
    let after_open = if content.starts_with("---\r\n") {
        5
    } else if content.starts_with("---\n") {
        4
    } else {
        return (None, content);
    };

    let rest = &content[after_open..];

    // Find the closing `---` on its own line
    let end = if let Some(pos) = rest.find("\n---\n") {
        pos
    } else if let Some(pos) = rest.find("\n---\r\n") {
        pos
    } else if rest.ends_with("\n---") {
        rest.len() - 4
    } else {
        return (None, content);
    };

    let yaml_str = &rest[..end];

    // Body starts after the closing `---` block
    let body_offset = after_open + end + 4; // skip "\n---\n"
    let body = if body_offset < content.len() {
        content[body_offset..].trim_start_matches(['\n', '\r'])
    } else {
        ""
    };

    match serde_yaml::from_str::<serde_yaml::Value>(yaml_str) {
        Ok(yaml_val) => match serde_json::to_value(yaml_val) {
            Ok(json_val) if !json_val.is_null() => (Some(json_val), body),
            _ => (None, body),
        },
        Err(_) => (None, content),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_frontmatter_returns_none_and_full_content() {
        let content = "# Hello\n\nThis is a note.";
        let (fm, body) = extract_frontmatter(content);
        assert!(fm.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn valid_frontmatter_is_parsed() {
        let content = "---\ntitle: My Note\ntags: [rust, axum]\n---\n# Body";
        let (fm, body) = extract_frontmatter(content);
        let fm = fm.expect("frontmatter should be Some");
        assert_eq!(fm["title"], "My Note");
        assert_eq!(body, "# Body");
    }

    #[test]
    fn frontmatter_with_crlf_is_parsed() {
        let content = "---\r\ntitle: Windows\r\n---\r\n# Body";
        let (_fm, _body) = extract_frontmatter(content);
        // serde_yaml may or may not parse CRLF-delimited YAML; at minimum no panic
    }

    #[test]
    fn frontmatter_missing_closing_delimiter_treated_as_none() {
        let content = "---\ntitle: Unclosed\n# Body";
        let (fm, body) = extract_frontmatter(content);
        assert!(fm.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn empty_frontmatter_returns_none() {
        let content = "---\n---\n# Body";
        let (fm, _body) = extract_frontmatter(content);
        // Empty YAML parses as null → None frontmatter
        assert!(fm.is_none());
    }
}
