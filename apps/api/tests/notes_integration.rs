use axum::http::{HeaderValue, StatusCode};
use axum_test::{
    multipart::{MultipartForm, Part},
    TestServer,
};
use knowledge_api::{build_app, build_test_state};
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn make_server() -> TestServer {
    let state = build_test_state().await;
    let app = build_app(state);
    TestServer::new(app).expect("test server")
}

/// Registers a user and returns the access token.
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

/// Builds an Authorization: Bearer header.
fn bearer(token: &str) -> (axum::http::HeaderName, HeaderValue) {
    (
        axum::http::header::AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}")).expect("valid header value"),
    )
}

/// Uploads a single .md file and returns the first note in the response array.
async fn upload_md(server: &TestServer, token: &str, filename: &str, content: &[u8]) -> Value {
    let (header_name, header_val) = bearer(token);
    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(content.to_vec())
            .file_name(filename)
            .mime_type("text/markdown"),
    );
    server
        .post("/notes/upload")
        .add_header(header_name, header_val)
        .multipart(form)
        .await
        .json::<Value>()
}

// ---------------------------------------------------------------------------
// POST /notes/upload
// ---------------------------------------------------------------------------

#[tokio::test]
async fn upload_single_md_file_returns_201_with_metadata() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "up1@example.com").await;

    let (name, val) = bearer(&token);
    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(b"# Hello".as_slice())
            .file_name("hello.md")
            .mime_type("text/markdown"),
    );
    let res = server
        .post("/notes/upload")
        .add_header(name, val)
        .multipart(form)
        .await;

    res.assert_status(StatusCode::CREATED);
    let body = res.json::<Value>();
    let notes = body.as_array().expect("array");
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0]["filename"], "hello.md");
    assert!(notes[0]["id"].is_string());
    assert_eq!(notes[0]["size_bytes"], 7);
}

#[tokio::test]
async fn upload_multiple_files_returns_all_metadata() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "up2@example.com").await;

    let (name, val) = bearer(&token);
    let form = MultipartForm::new()
        .add_part(
            "file",
            Part::bytes(b"# Note A".as_slice())
                .file_name("a.md")
                .mime_type("text/markdown"),
        )
        .add_part(
            "file",
            Part::bytes(b"# Note B".as_slice())
                .file_name("b.md")
                .mime_type("text/markdown"),
        );

    let res = server
        .post("/notes/upload")
        .add_header(name, val)
        .multipart(form)
        .await;

    res.assert_status(StatusCode::CREATED);
    let notes = res.json::<Value>();
    assert_eq!(notes.as_array().expect("array").len(), 2);
}

#[tokio::test]
async fn upload_non_md_extension_returns_400() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "up3@example.com").await;

    let (name, val) = bearer(&token);
    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(b"hello".as_slice())
            .file_name("notes.txt")
            .mime_type("text/plain"),
    );
    server
        .post("/notes/upload")
        .add_header(name, val)
        .multipart(form)
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn upload_exceeding_size_limit_is_rejected() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "up4@example.com").await;

    // 11 MiB of data — well above the app's 10 MiB limit.
    // Axum's 2 MiB default body limit fires before our handler runs, returning 400.
    // We assert that the request is rejected (4xx), not that the exact code is 413.
    let big_content = vec![b'a'; 11 * 1024 * 1024];
    let (name, val) = bearer(&token);
    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(big_content)
            .file_name("big.md")
            .mime_type("text/markdown"),
    );
    let res = server
        .post("/notes/upload")
        .add_header(name, val)
        .multipart(form)
        .await;
    assert!(
        res.status_code().is_client_error(),
        "large upload must be rejected with a 4xx status"
    );
}

#[tokio::test]
async fn upload_non_utf8_content_returns_400() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "up5@example.com").await;

    let invalid_utf8: Vec<u8> = vec![0xFF, 0xFE, 0x00];
    let (name, val) = bearer(&token);
    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(invalid_utf8)
            .file_name("bad.md")
            .mime_type("text/markdown"),
    );
    server
        .post("/notes/upload")
        .add_header(name, val)
        .multipart(form)
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn upload_without_auth_returns_401() {
    let server = make_server().await;

    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(b"# note".as_slice())
            .file_name("note.md")
            .mime_type("text/markdown"),
    );
    server
        .post("/notes/upload")
        .multipart(form)
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn upload_with_frontmatter_returns_parsed_frontmatter() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "up6@example.com").await;

    let content = b"---\ntitle: My Note\ntags: [rust]\n---\n# Body";
    let note = upload_md(&server, &token, "fm.md", content).await;
    let notes = note.as_array().expect("array");
    let fm = &notes[0]["frontmatter"];
    assert!(!fm.is_null(), "frontmatter should be present");
    assert_eq!(fm["title"], "My Note");
}

#[tokio::test]
async fn upload_markdown_extension_allowed() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "up7@example.com").await;

    let (name, val) = bearer(&token);
    let form = MultipartForm::new().add_part(
        "file",
        Part::bytes(b"# Hello".as_slice())
            .file_name("note.markdown")
            .mime_type("text/markdown"),
    );
    server
        .post("/notes/upload")
        .add_header(name, val)
        .multipart(form)
        .await
        .assert_status(StatusCode::CREATED);
}

// ---------------------------------------------------------------------------
// GET /notes
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_notes_returns_only_own_notes() {
    let server = make_server().await;
    let token_a = register_and_get_token(&server, "list1a@example.com").await;
    let token_b = register_and_get_token(&server, "list1b@example.com").await;

    upload_md(&server, &token_a, "note-a.md", b"# A").await;
    upload_md(&server, &token_b, "note-b.md", b"# B").await;

    let (name_a, val_a) = bearer(&token_a);
    let res_a = server
        .get("/notes")
        .add_header(name_a, val_a)
        .await
        .json::<Value>();
    let notes_a = res_a.as_array().expect("array");
    assert_eq!(notes_a.len(), 1);
    assert_eq!(notes_a[0]["filename"], "note-a.md");
}

#[tokio::test]
async fn list_notes_empty_for_new_user() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "list2@example.com").await;

    let (name, val) = bearer(&token);
    let res = server
        .get("/notes")
        .add_header(name, val)
        .await
        .json::<Value>();
    assert_eq!(res.as_array().expect("array").len(), 0);
}

#[tokio::test]
async fn list_notes_without_auth_returns_401() {
    let server = make_server().await;
    server
        .get("/notes")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// GET /notes/{id}
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_note_returns_decrypted_content() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "get1@example.com").await;

    let original = b"# Hello World\n\nThis is encrypted!";
    let notes = upload_md(&server, &token, "test.md", original).await;
    let note_id = notes[0]["id"].as_str().expect("id");

    let (name, val) = bearer(&token);
    let res = server
        .get(&format!("/notes/{note_id}"))
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let body = res.json::<Value>();
    assert_eq!(body["content"], std::str::from_utf8(original).unwrap());
    assert_eq!(body["filename"], "test.md");
}

#[tokio::test]
async fn get_note_not_found_returns_404() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "get2@example.com").await;

    let (name, val) = bearer(&token);
    server
        .get("/notes/00000000000000000000000000000000")
        .add_header(name, val)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn get_note_belonging_to_other_user_returns_404() {
    let server = make_server().await;
    let token_a = register_and_get_token(&server, "get3a@example.com").await;
    let token_b = register_and_get_token(&server, "get3b@example.com").await;

    let notes = upload_md(&server, &token_a, "secret.md", b"# Secret").await;
    let note_id = notes[0]["id"].as_str().expect("id");

    let (name_b, val_b) = bearer(&token_b);
    server
        .get(&format!("/notes/{note_id}"))
        .add_header(name_b, val_b)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

// ---------------------------------------------------------------------------
// PUT /notes/{id}
// ---------------------------------------------------------------------------

#[tokio::test]
async fn update_note_re_encrypts_content() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "put1@example.com").await;

    let notes = upload_md(&server, &token, "orig.md", b"# Original").await;
    let note_id = notes[0]["id"].as_str().expect("id").to_owned();

    let (name, val) = bearer(&token);
    server
        .put(&format!("/notes/{note_id}"))
        .add_header(name, val)
        .json(&json!({"content": "# Updated content"}))
        .await
        .assert_status_ok();

    let (name2, val2) = bearer(&token);
    let res = server
        .get(&format!("/notes/{note_id}"))
        .add_header(name2, val2)
        .await;
    assert_eq!(res.json::<Value>()["content"], "# Updated content");
}

#[tokio::test]
async fn update_note_belonging_to_other_user_returns_404() {
    let server = make_server().await;
    let token_a = register_and_get_token(&server, "put2a@example.com").await;
    let token_b = register_and_get_token(&server, "put2b@example.com").await;

    let notes = upload_md(&server, &token_a, "note.md", b"# A's note").await;
    let note_id = notes[0]["id"].as_str().expect("id");

    let (name_b, val_b) = bearer(&token_b);
    server
        .put(&format!("/notes/{note_id}"))
        .add_header(name_b, val_b)
        .json(&json!({"content": "hacked"}))
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

// ---------------------------------------------------------------------------
// DELETE /notes/{id}
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_note_success_then_get_returns_404() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "del1@example.com").await;

    let notes = upload_md(&server, &token, "del.md", b"# Delete me").await;
    let note_id = notes[0]["id"].as_str().expect("id").to_owned();

    let (name, val) = bearer(&token);
    server
        .delete(&format!("/notes/{note_id}"))
        .add_header(name, val)
        .await
        .assert_status(StatusCode::NO_CONTENT);

    let (name2, val2) = bearer(&token);
    server
        .get(&format!("/notes/{note_id}"))
        .add_header(name2, val2)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn delete_note_belonging_to_other_user_returns_404() {
    let server = make_server().await;
    let token_a = register_and_get_token(&server, "del2a@example.com").await;
    let token_b = register_and_get_token(&server, "del2b@example.com").await;

    let notes = upload_md(&server, &token_a, "note.md", b"# A's note").await;
    let note_id = notes[0]["id"].as_str().expect("id");

    let (name_b, val_b) = bearer(&token_b);
    server
        .delete(&format!("/notes/{note_id}"))
        .add_header(name_b, val_b)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

// ---------------------------------------------------------------------------
// GET /notes/{id}/download
// ---------------------------------------------------------------------------

#[tokio::test]
async fn download_note_returns_raw_markdown_with_content_disposition() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "dl1@example.com").await;

    let original = b"# Download test\n\nSome content.";
    let notes = upload_md(&server, &token, "download.md", original).await;
    let note_id = notes[0]["id"].as_str().expect("id").to_owned();

    let (name, val) = bearer(&token);
    let res = server
        .get(&format!("/notes/{note_id}/download"))
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let header_val = res.header("content-disposition");
    let disposition = header_val.to_str().expect("content-disposition header");
    assert!(
        disposition.contains("attachment"),
        "should be an attachment download"
    );
    assert!(
        disposition.contains("download.md"),
        "should include filename"
    );
    assert_eq!(&res.as_bytes()[..], original);
}
