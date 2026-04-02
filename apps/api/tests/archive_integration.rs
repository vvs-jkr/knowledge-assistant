use axum::http::{HeaderValue, StatusCode};
use axum_test::TestServer;
use knowledge_api::{build_app, build_test_state};
use serde_json::{json, Value};

async fn make_server() -> TestServer {
    let state = build_test_state().await;
    let app = build_app(state);
    TestServer::new(app).expect("test server")
}

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
        HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
    )
}

#[tokio::test]
async fn archive_endpoints_require_auth() {
    let server = make_server().await;

    server
        .get("/archive/workouts")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);

    server
        .post("/archive/workouts")
        .json(&json!({"archive_date": "2022-01-01", "title": "Archive card"}))
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_archived_workout_returns_detail_with_sections_and_images() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "archive_create@example.com").await;
    let (name, val) = bearer(&token);

    let res = server
        .post("/archive/workouts")
        .add_header(name, val)
        .json(&json!({
            "archive_date": "2022-06-03",
            "title": "BTWB Card",
            "source_system": "btwb",
            "source_file": "temp/Норм/card-001.png",
            "raw_ocr_text": "Charge\n3 rounds\nLifting\n5x5 front squat",
            "review_status": "needs_review",
            "quality_score": 0.4,
            "sections": [
                {
                    "section_type_raw": "Charge",
                    "section_type_normalized": "warmup",
                    "content_raw": "3 rounds",
                    "order_index": 0
                },
                {
                    "section_type_raw": "Lifting",
                    "section_type_normalized": "strength_skill",
                    "content_raw": "5x5 front squat",
                    "order_index": 1
                }
            ],
            "images": [
                {"file_path": "temp/Норм/card-001.png", "sort_order": 0}
            ]
        }))
        .await;

    res.assert_status(StatusCode::CREATED);
    let body = res.json::<Value>();
    assert_eq!(body["title"].as_str().expect("title"), "BTWB Card");
    assert_eq!(
        body["review_status"].as_str().expect("review_status"),
        "needs_review"
    );
    assert!(!body["ready_for_retrieval"]
        .as_bool()
        .expect("ready_for_retrieval"));
    assert_eq!(body["sections"].as_array().expect("sections").len(), 2);
    assert_eq!(body["images"].as_array().expect("images").len(), 1);
    assert!(body["exclude_from_stats"]
        .as_bool()
        .expect("exclude_from_stats"));
}

#[tokio::test]
async fn list_archived_workouts_filters_by_review_status_and_year() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "archive_filter@example.com").await;

    for (date, status, title) in [
        ("2022-02-01", "needs_review", "Card A"),
        ("2022-03-01", "reviewed", "Card B"),
        ("2023-01-01", "needs_review", "Card C"),
    ] {
        let (name, val) = bearer(&token);
        server
            .post("/archive/workouts")
            .add_header(name, val)
            .json(&json!({
                "archive_date": date,
                "title": title,
                "review_status": status
            }))
            .await
            .assert_status(StatusCode::CREATED);
    }

    let (name, val) = bearer(&token);
    let res = server
        .get("/archive/workouts")
        .add_query_params(&[("review_status", "needs_review"), ("year", "2022")])
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let items = res.json::<Value>();
    let items = items.as_array().expect("items");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["title"].as_str().expect("title"), "Card A");
}

#[tokio::test]
async fn update_archived_workout_replaces_sections_and_marks_reviewed() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "archive_update@example.com").await;
    let (name, val) = bearer(&token);

    let created = server
        .post("/archive/workouts")
        .add_header(name.clone(), val.clone())
        .json(&json!({
            "archive_date": "2022-07-01",
            "title": "Needs cleanup",
            "sections": [
                {"section_type_raw": "Charge", "content_raw": "bad parse"}
            ]
        }))
        .await
        .json::<Value>();

    let id = created["id"].as_str().expect("id");

    let res = server
        .put(&format!("/archive/workouts/{id}"))
        .add_header(name, val)
        .json(&json!({
            "title": "Reviewed card",
            "corrected_text": "A. Warm-up\nB. Strength\nC. Metcon",
            "review_status": "reviewed",
            "sections": [
                {
                    "section_type_raw": "Charge",
                    "section_type_normalized": "warmup",
                    "content_raw": "bad parse",
                    "content_corrected": "10 min easy row"
                },
                {
                    "section_type_raw": "Conditioning",
                    "section_type_normalized": "conditioning",
                    "content_corrected": "12 min AMRAP"
                }
            ]
        }))
        .await;

    res.assert_status_ok();
    let body = res.json::<Value>();
    assert_eq!(body["title"].as_str().expect("title"), "Reviewed card");
    assert_eq!(
        body["review_status"].as_str().expect("review_status"),
        "reviewed"
    );
    assert!(!body["ready_for_retrieval"]
        .as_bool()
        .expect("ready_for_retrieval"));
    let sections = body["sections"].as_array().expect("sections");
    assert_eq!(sections.len(), 2);
    assert_eq!(
        sections[0]["content_corrected"]
            .as_str()
            .expect("content_corrected"),
        "10 min easy row"
    );
}

#[tokio::test]
async fn batch_review_updates_status_and_ready_for_retrieval() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "archive_batch_review@example.com").await;
    let (name, val) = bearer(&token);

    let first = server
        .post("/archive/workouts")
        .add_header(name.clone(), val.clone())
        .json(&json!({
            "archive_date": "2022-09-01",
            "title": "Batch A",
            "review_status": "needs_review"
        }))
        .await
        .json::<Value>();
    let second = server
        .post("/archive/workouts")
        .add_header(name.clone(), val.clone())
        .json(&json!({
            "archive_date": "2022-09-02",
            "title": "Batch B",
            "review_status": "needs_review"
        }))
        .await
        .json::<Value>();

    let res = server
        .post("/archive/workouts/batch-review")
        .add_header(name.clone(), val.clone())
        .json(&json!({
            "ids": [
                first["id"].as_str().expect("first id"),
                second["id"].as_str().expect("second id")
            ],
            "review_status": "corrected",
            "ready_for_retrieval": true
        }))
        .await;

    res.assert_status(StatusCode::OK);
    assert_eq!(res.json::<Value>()["updated"].as_u64().expect("updated"), 2);

    let detail = server
        .get(&format!(
            "/archive/workouts/{}",
            first["id"].as_str().expect("first id")
        ))
        .add_header(name, val)
        .await;
    detail.assert_status_ok();
    let body = detail.json::<Value>();
    assert_eq!(body["review_status"], "corrected");
    assert_eq!(body["ready_for_retrieval"], true);
}

#[tokio::test]
async fn import_archived_workouts_creates_multiple_entries_and_skips_duplicates() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "archive_import@example.com").await;
    let (name, val) = bearer(&token);

    let resp = server
        .post("/archive/workouts/import")
        .add_header(name.clone(), val.clone())
        .json(&json!({
            "entries": [
                {
                    "archive_date": "2022-08-01",
                    "title": "Card A",
                    "source_system": "digitizer",
                    "source_file": "cards/a.jpg",
                    "raw_ocr_text": "Charge\n3 rounds",
                    "review_status": "needs_review"
                },
                {
                    "archive_date": "2022-08-02",
                    "title": "Card B",
                    "source_system": "digitizer",
                    "source_file": "cards/b.jpg",
                    "raw_ocr_text": "Lifting\n5x5 squat",
                    "review_status": "needs_review"
                }
            ]
        }))
        .await;

    resp.assert_status(StatusCode::OK);
    let body = resp.json::<Value>();
    assert_eq!(body["imported"].as_u64().expect("imported"), 2);
    assert_eq!(body["skipped"].as_u64().expect("skipped"), 0);

    let list = server
        .get("/archive/workouts")
        .add_header(name.clone(), val.clone())
        .await;
    list.assert_status_ok();
    assert_eq!(list.json::<Value>().as_array().expect("items").len(), 2);

    let duplicate_resp = server
        .post("/archive/workouts/import")
        .add_header(name, val)
        .json(&json!({
            "entries": [
                {
                    "archive_date": "2022-08-01",
                    "title": "Card A",
                    "source_system": "digitizer",
                    "source_file": "cards/a.jpg",
                    "raw_ocr_text": "Duplicate"
                }
            ]
        }))
        .await;

    duplicate_resp.assert_status(StatusCode::OK);
    let duplicate_body = duplicate_resp.json::<Value>();
    assert_eq!(duplicate_body["imported"].as_u64().expect("imported"), 0);
    assert_eq!(duplicate_body["skipped"].as_u64().expect("skipped"), 1);
}

#[tokio::test]
async fn user_cannot_access_other_users_archived_workout() {
    let server = make_server().await;
    let token_a = register_and_get_token(&server, "archive_iso_a@example.com").await;
    let token_b = register_and_get_token(&server, "archive_iso_b@example.com").await;

    let (name_a, val_a) = bearer(&token_a);
    let created = server
        .post("/archive/workouts")
        .add_header(name_a, val_a)
        .json(&json!({
            "archive_date": "2022-04-01",
            "title": "Private archive card"
        }))
        .await
        .json::<Value>();

    let id = created["id"].as_str().expect("id");
    let (name_b, val_b) = bearer(&token_b);
    server
        .get(&format!("/archive/workouts/{id}"))
        .add_header(name_b, val_b)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}
