use axum::http::HeaderValue;
use axum_test::{
    multipart::{MultipartForm, Part},
    TestServer,
};
use knowledge_api::{build_app, build_test_state};
use serde_json::{json, Value};

async fn register_and_get_token(server: &TestServer, email: &str) -> String {
    let res = server
        .post("/auth/register")
        .json(&json!({"email": email, "password": "Password1"}))
        .await;
    res.json::<Value>()["access_token"]
        .as_str()
        .expect("access_token")
        .to_owned()
}

fn bearer(token: &str) -> (axum::http::HeaderName, HeaderValue) {
    (
        axum::http::header::AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}")).expect("valid header value"),
    )
}

#[tokio::test]
async fn create_manual_knowledge_entry_returns_typed_metadata() {
    let state = build_test_state().await;
    let server = TestServer::new(build_app(state)).expect("server");
    let token = register_and_get_token(&server, "knowledge-manual@test.com").await;
    let (h, v) = bearer(&token);

    let resp = server
        .post("/knowledge")
        .add_header(h, v)
        .json(&json!({
            "title": "Prilepin Table Notes",
            "content": "Useful for strength loading guidelines.",
            "source": "book: weightlifting programming",
            "doc_type": "programming_principle",
            "tags": ["strength", "volume"],
            "review_status": "reviewed",
            "use_for_generation": true,
            "metadata": { "author": "A. Medvedyev" }
        }))
        .await;

    assert_eq!(resp.status_code(), 201);
    let body = resp.json::<Value>();
    assert_eq!(body["doc_type"], "programming_principle");
    assert_eq!(body["review_status"], "reviewed");
    assert_eq!(body["use_for_generation"], true);
    assert_eq!(body["tags"], json!(["strength", "volume"]));
    assert_eq!(body["metadata"]["author"], "A. Medvedyev");
}

#[tokio::test]
async fn list_knowledge_filters_by_doc_type_and_generation_flag() {
    let state = build_test_state().await;
    let server = TestServer::new(build_app(state)).expect("server");
    let token = register_and_get_token(&server, "knowledge-filter@test.com").await;
    let (h, v) = bearer(&token);

    server
        .post("/knowledge")
        .add_header(h.clone(), v.clone())
        .json(&json!({
            "title": "Book Excerpt",
            "content": "Tempo and density notes.",
            "doc_type": "book_excerpt",
            "use_for_generation": false
        }))
        .await;

    server
        .post("/knowledge")
        .add_header(h.clone(), v.clone())
        .json(&json!({
            "title": "Personal preference",
            "content": "Prefer mixed strength and metcon days.",
            "doc_type": "user_preference",
            "use_for_generation": true
        }))
        .await;

    let by_type = server
        .get("/knowledge?doc_type=user_preference")
        .add_header(h.clone(), v.clone())
        .await;
    assert_eq!(by_type.status_code(), 200);
    let typed_entries = by_type.json::<Value>();
    assert_eq!(typed_entries.as_array().expect("array").len(), 1);
    assert_eq!(typed_entries[0]["doc_type"], "user_preference");

    let generation_only = server
        .get("/knowledge?use_for_generation=true")
        .add_header(h, v)
        .await;
    assert_eq!(generation_only.status_code(), 200);
    let generation_entries = generation_only.json::<Value>();
    assert_eq!(generation_entries.as_array().expect("array").len(), 1);
    assert_eq!(generation_entries[0]["use_for_generation"], true);
}

#[tokio::test]
async fn upload_knowledge_defaults_to_general_reviewed_entry() {
    let state = build_test_state().await;
    let server = TestServer::new(build_app(state)).expect("server");
    let token = register_and_get_token(&server, "knowledge-upload@test.com").await;
    let (h, v) = bearer(&token);

    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(b"# Training note".to_vec())
            .file_name("training-note.md")
            .mime_type("text/markdown"),
    );

    let resp = server
        .post("/knowledge/upload")
        .add_header(h, v)
        .multipart(form)
        .await;

    assert_eq!(resp.status_code(), 201);
    let body = resp.json::<Value>();
    assert_eq!(body[0]["doc_type"], "general");
    assert_eq!(body[0]["review_status"], "reviewed");
    assert_eq!(body[0]["use_for_generation"], true);
}
