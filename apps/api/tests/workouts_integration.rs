use axum::http::{HeaderValue, StatusCode};
use axum_test::TestServer;
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

/// Create a minimal workout and return the parsed JSON body.
async fn create_basic_workout(server: &TestServer, token: &str) -> Value {
    let (name, val) = bearer(token);
    server
        .post("/workouts")
        .add_header(name, val)
        .json(&json!({
            "date": "2026-03-10",
            "name": "Test Workout",
            "workout_type": "amrap"
        }))
        .await
        .json::<Value>()
}

// ---------------------------------------------------------------------------
// Auth guards — all endpoints must require a valid JWT
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_workout_without_auth_returns_401() {
    let server = make_server().await;
    server
        .post("/workouts")
        .json(&json!({"date": "2026-03-10", "name": "x"}))
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_workouts_without_auth_returns_401() {
    let server = make_server().await;
    server
        .get("/workouts")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_workout_without_auth_returns_401() {
    let server = make_server().await;
    server
        .get("/workouts/some-id")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn update_workout_without_auth_returns_401() {
    let server = make_server().await;
    server
        .put("/workouts/some-id")
        .json(&json!({"name": "x"}))
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_workout_without_auth_returns_401() {
    let server = make_server().await;
    server
        .delete("/workouts/some-id")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn get_stats_without_auth_returns_401() {
    let server = make_server().await;
    server
        .get("/workouts/stats")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_exercises_without_auth_returns_401() {
    let server = make_server().await;
    server
        .get("/workouts/exercises")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_log_without_auth_returns_401() {
    let server = make_server().await;
    server
        .post("/workouts/logs")
        .json(&json!({"workout_id": "x", "completed_at": "2026-03-10"}))
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_logs_without_auth_returns_401() {
    let server = make_server().await;
    server
        .get("/workouts/logs")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_workout_with_invalid_date_returns_422() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_invalid_date@example.com").await;
    let (name, val) = bearer(&token);

    server
        .post("/workouts")
        .add_header(name, val)
        .json(&json!({"date": "not-a-date", "name": "Test"}))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn create_workout_with_invalid_type_returns_422() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_invalid_type@example.com").await;
    let (name, val) = bearer(&token);

    server
        .post("/workouts")
        .add_header(name, val)
        .json(&json!({"date": "2026-03-10", "name": "Test", "workout_type": "yoga"}))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn create_workout_with_missing_name_returns_422() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_missing_name@example.com").await;
    let (name, val) = bearer(&token);

    server
        .post("/workouts")
        .add_header(name, val)
        .json(&json!({"date": "2026-03-10", "name": "   "}))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

// ---------------------------------------------------------------------------
// CRUD happy paths
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_workout_returns_201_with_detail() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_create_201@example.com").await;
    let (name, val) = bearer(&token);

    let res = server
        .post("/workouts")
        .add_header(name, val)
        .json(&json!({
            "date": "2026-03-10",
            "name": "Morning AMRAP",
            "workout_type": "amrap",
            "duration_mins": 20,
            "rounds": 5
        }))
        .await;

    res.assert_status(StatusCode::CREATED);
    let body = res.json::<Value>();
    assert_eq!(body["name"].as_str().expect("name"), "Morning AMRAP");
    assert_eq!(body["workout_type"].as_str().expect("type"), "amrap");
    assert_eq!(body["duration_mins"].as_i64().expect("duration"), 20);
    assert!(body["id"].as_str().is_some());
    assert!(body["exercises"].as_array().is_some());
}

#[tokio::test]
async fn create_workout_with_named_exercises_upserts_and_returns_exercises() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_exercises_upsert@example.com").await;
    let (name, val) = bearer(&token);

    let res = server
        .post("/workouts")
        .add_header(name, val)
        .json(&json!({
            "date": "2026-03-10",
            "name": "Lifting Session",
            "workout_type": "lifting",
            "exercises": [
                {
                    "name": "Back Squat",
                    "muscle_groups": ["quads", "glutes"],
                    "sets": 5,
                    "reps": 5,
                    "weight_kg": 100.0
                },
                {
                    "name": "Deadlift",
                    "muscle_groups": ["hamstrings", "glutes"],
                    "sets": 3,
                    "reps": 3,
                    "weight_kg": 140.0
                }
            ]
        }))
        .await;

    res.assert_status(StatusCode::CREATED);
    let body = res.json::<Value>();
    let exercises = body["exercises"].as_array().expect("exercises array");
    assert_eq!(exercises.len(), 2);
    assert_eq!(
        exercises[0]["exercise_name"].as_str().expect("name"),
        "Back Squat"
    );
    assert_eq!(
        exercises[1]["exercise_name"].as_str().expect("name"),
        "Deadlift"
    );
    assert_eq!(exercises[0]["weight_kg"].as_f64().expect("weight"), 100.0);
}

#[tokio::test]
async fn create_workout_with_sections_returns_structured_sections_and_legacy_exercises() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_sections_create@example.com").await;
    let (name, val) = bearer(&token);

    let res = server
        .post("/workouts")
        .add_header(name, val)
        .json(&json!({
            "date": "2026-03-10",
            "name": "Sectioned Workout",
            "workout_type": "other",
            "sections": [
                {
                    "section_key": "A",
                    "section_role": "warmup",
                    "title": "Разминка",
                    "items": [
                        {
                            "name": "Row",
                            "prescription_text": "5 мин спокойно"
                        }
                    ]
                },
                {
                    "section_key": "B",
                    "section_role": "strength_skill",
                    "title": "Сила",
                    "items": [
                        {
                            "name": "Front Squat",
                            "sets": 5,
                            "reps": 3,
                            "weight_note": "тяжело"
                        }
                    ]
                }
            ]
        }))
        .await;

    res.assert_status(StatusCode::CREATED);
    let body = res.json::<Value>();
    assert_eq!(body["sections"].as_array().expect("sections").len(), 2);
    assert_eq!(
        body["sections"][0]["section_key"]
            .as_str()
            .expect("section_key"),
        "A"
    );
    assert_eq!(body["exercises"].as_array().expect("exercises").len(), 2);
    assert_eq!(
        body["exercises"][1]["exercise_name"]
            .as_str()
            .expect("exercise_name"),
        "Front Squat"
    );
}

#[tokio::test]
async fn list_workouts_returns_created_workouts() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_list_returns@example.com").await;
    let (name, val) = bearer(&token);

    // Create two workouts.
    create_basic_workout(&server, &token).await;
    create_basic_workout(&server, &token).await;

    let res = server.get("/workouts").add_header(name, val).await;

    res.assert_status_ok();
    let body = res.json::<Value>();
    let arr = body.as_array().expect("array");
    assert_eq!(arr.len(), 2);
}

#[tokio::test]
async fn list_workouts_filters_by_type() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_filter_type@example.com").await;
    let (name, val) = bearer(&token);

    // amrap
    server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({"date": "2026-03-10", "name": "AMRAP", "workout_type": "amrap"}))
        .await;
    // lifting
    server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({"date": "2026-03-11", "name": "Lifting", "workout_type": "lifting"}))
        .await;

    let res = server
        .get("/workouts")
        .add_query_params(&[("workout_type", "amrap")])
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let arr = res.json::<Value>();
    let arr = arr.as_array().expect("array");
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["workout_type"].as_str().expect("type"), "amrap");
}

#[tokio::test]
async fn list_workouts_filters_by_date_range() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_filter_date@example.com").await;
    let (name, val) = bearer(&token);

    for date in ["2026-01-01", "2026-03-10", "2026-06-01"] {
        server
            .post("/workouts")
            .add_header(
                axum::http::header::AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
            )
            .json(&json!({"date": date, "name": "W"}))
            .await;
    }

    let res = server
        .get("/workouts")
        .add_query_params(&[("from", "2026-02-01"), ("to", "2026-04-01")])
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let arr = res.json::<Value>();
    let arr = arr.as_array().expect("array");
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["date"].as_str().expect("date"), "2026-03-10");
}

#[tokio::test]
async fn get_workout_returns_detail_with_exercises() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_get_detail@example.com").await;
    let (name, val) = bearer(&token);

    let created = server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "date": "2026-03-10",
            "name": "Detail Test",
            "workout_type": "for_time",
            "exercises": [{"name": "Pull-up", "reps": 10, "sets": 3}]
        }))
        .await
        .json::<Value>();

    let id = created["id"].as_str().expect("id");

    let res = server
        .get(&format!("/workouts/{id}"))
        .add_header(name, val)
        .await;
    res.assert_status_ok();
    let body = res.json::<Value>();
    assert_eq!(body["id"].as_str().expect("id"), id);
    let exercises = body["exercises"].as_array().expect("exercises");
    assert_eq!(exercises.len(), 1);
    assert_eq!(
        exercises[0]["exercise_name"].as_str().expect("name"),
        "Pull-up"
    );
}

#[tokio::test]
async fn get_nonexistent_workout_returns_404() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_get_404@example.com").await;
    let (name, val) = bearer(&token);

    server
        .get("/workouts/doesnotexist")
        .add_header(name, val)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn update_workout_name_returns_updated_detail() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_update_name@example.com").await;
    let (name, val) = bearer(&token);

    let created = create_basic_workout(&server, &token).await;
    let id = created["id"].as_str().expect("id");

    let res = server
        .put(&format!("/workouts/{id}"))
        .add_header(name, val)
        .json(&json!({"name": "Updated Name"}))
        .await;

    res.assert_status_ok();
    assert_eq!(
        res.json::<Value>()["name"].as_str().expect("name"),
        "Updated Name"
    );
}

#[tokio::test]
async fn update_workout_exercises_replaces_all() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_update_exercises@example.com").await;
    let (name, val) = bearer(&token);

    let created = server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "date": "2026-03-10",
            "name": "Replace Test",
            "exercises": [{"name": "OldExercise", "reps": 10}]
        }))
        .await
        .json::<Value>();

    let id = created["id"].as_str().expect("id");

    let res = server
        .put(&format!("/workouts/{id}"))
        .add_header(name, val)
        .json(&json!({
            "exercises": [
                {"name": "NewExercise1", "sets": 3, "reps": 8},
                {"name": "NewExercise2", "sets": 4, "reps": 6}
            ]
        }))
        .await;

    res.assert_status_ok();
    let exercises = res.json::<Value>()["exercises"]
        .as_array()
        .expect("exercises")
        .clone();
    assert_eq!(exercises.len(), 2);
    assert_eq!(
        exercises[0]["exercise_name"].as_str().expect("name"),
        "NewExercise1"
    );
}

#[tokio::test]
async fn update_workout_sections_replaces_existing_sections() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_sections_update@example.com").await;
    let (name, val) = bearer(&token);

    let created = server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "date": "2026-03-10",
            "name": "Section Replace Test",
            "sections": [
                {
                    "section_key": "A",
                    "section_role": "warmup",
                    "title": "Разминка",
                    "items": [{"name": "Bike", "prescription_text": "4 мин"}]
                }
            ]
        }))
        .await
        .json::<Value>();

    let id = created["id"].as_str().expect("id");

    let res = server
        .put(&format!("/workouts/{id}"))
        .add_header(name, val)
        .json(&json!({
            "sections": [
                {
                    "section_key": "B",
                    "section_role": "conditioning",
                    "title": "Комплекс",
                    "items": [{"name": "Burpee", "reps": 12}]
                }
            ]
        }))
        .await;

    res.assert_status_ok();
    let body = res.json::<Value>();
    let sections = body["sections"].as_array().expect("sections");
    assert_eq!(sections.len(), 1);
    assert_eq!(
        sections[0]["section_key"].as_str().expect("section_key"),
        "B"
    );
    assert_eq!(
        sections[0]["items"][0]["display_name"]
            .as_str()
            .expect("display_name"),
        "Burpee"
    );
}

#[tokio::test]
async fn delete_workout_returns_204_and_then_404() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_delete_204@example.com").await;
    let (name, val) = bearer(&token);

    let created = create_basic_workout(&server, &token).await;
    let id = created["id"].as_str().expect("id");

    server
        .delete(&format!("/workouts/{id}"))
        .add_header(name.clone(), val.clone())
        .await
        .assert_status(StatusCode::NO_CONTENT);

    server
        .get(&format!("/workouts/{id}"))
        .add_header(name, val)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

// ---------------------------------------------------------------------------
// Isolation — users cannot see each other's workouts
// ---------------------------------------------------------------------------

#[tokio::test]
async fn user_cannot_see_other_user_workouts() {
    let server = make_server().await;
    let token_a = register_and_get_token(&server, "wk_iso_a@example.com").await;
    let token_b = register_and_get_token(&server, "wk_iso_b@example.com").await;

    // User A creates a workout.
    let created = create_basic_workout(&server, &token_a).await;
    let id = created["id"].as_str().expect("id");

    // User B tries to get it.
    let (name_b, val_b) = bearer(&token_b);
    server
        .get(&format!("/workouts/{id}"))
        .add_header(name_b, val_b)
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

// ---------------------------------------------------------------------------
// Exercises catalogue
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_exercises_returns_exercise_after_workout_create() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_ex_list@example.com").await;
    let (name, val) = bearer(&token);

    server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "date": "2026-03-10",
            "name": "Catalogue Test",
            "exercises": [{"name": "UniqueExerciseName", "reps": 5}]
        }))
        .await;

    let res = server
        .get("/workouts/exercises")
        .add_header(name, val)
        .await;
    res.assert_status_ok();
    let arr = res.json::<Value>();
    let arr = arr.as_array().expect("array");
    assert!(
        arr.iter()
            .any(|e| e["name"].as_str() == Some("UniqueExerciseName")),
        "exercise not found in catalogue"
    );
}

#[tokio::test]
async fn list_exercises_search_filters_by_name() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_ex_search@example.com").await;
    let (name, val) = bearer(&token);

    // Create exercises via workout.
    server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "date": "2026-03-10",
            "name": "Search Test",
            "exercises": [
                {"name": "Barbell Squat", "reps": 5},
                {"name": "Barbell Row", "reps": 8},
                {"name": "Pull-up", "reps": 10}
            ]
        }))
        .await;

    let res = server
        .get("/workouts/exercises")
        .add_query_params(&[("search", "Barbell")])
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let arr = res.json::<Value>();
    let arr = arr.as_array().expect("array");
    assert_eq!(arr.len(), 2, "expected only Barbell exercises");
    for ex in arr {
        assert!(
            ex["name"].as_str().expect("name").contains("Barbell"),
            "unexpected exercise: {ex}"
        );
    }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_stats_returns_zero_counts_for_new_user() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_stats_zero@example.com").await;
    let (name, val) = bearer(&token);

    let res = server.get("/workouts/stats").add_header(name, val).await;
    res.assert_status_ok();
    let body = res.json::<Value>();
    assert_eq!(body["total_workouts"].as_i64().expect("total_workouts"), 0);
    assert_eq!(body["total_logs"].as_i64().expect("total_logs"), 0);
    assert_eq!(body["current_streak_days"].as_i64().expect("streak"), 0);
    assert_eq!(body["heatmap"].as_array().expect("heatmap").len(), 0);
}

#[tokio::test]
async fn get_stats_heatmap_reflects_created_workouts() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_stats_heatmap@example.com").await;
    let (name, val) = bearer(&token);

    // Create workouts on distinct dates.
    for date in ["2026-02-01", "2026-02-02", "2026-02-03"] {
        server
            .post("/workouts")
            .add_header(
                axum::http::header::AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
            )
            .json(&json!({"date": date, "name": "W"}))
            .await;
    }

    let res = server
        .get("/workouts/stats")
        .add_query_params(&[("from", "2026-01-01"), ("to", "2026-12-31")])
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let body = res.json::<Value>();
    assert_eq!(body["total_workouts"].as_i64().expect("total"), 3);
    let heatmap = body["heatmap"].as_array().expect("heatmap");
    assert_eq!(heatmap.len(), 3);
}

#[tokio::test]
async fn get_stats_type_distribution_reflects_created_workouts() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_stats_types@example.com").await;
    let (name, val) = bearer(&token);

    // 2 amrap + 1 lifting
    for (date, wtype) in [
        ("2026-02-01", "amrap"),
        ("2026-02-02", "amrap"),
        ("2026-02-03", "lifting"),
    ] {
        server
            .post("/workouts")
            .add_header(
                axum::http::header::AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
            )
            .json(&json!({"date": date, "name": "W", "workout_type": wtype}))
            .await;
    }

    let res = server
        .get("/workouts/stats")
        .add_query_params(&[("from", "2026-01-01"), ("to", "2026-12-31")])
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let dist = res.json::<Value>()["type_distribution"]
        .as_array()
        .expect("type_distribution")
        .clone();

    let amrap = dist
        .iter()
        .find(|e| e["workout_type"].as_str() == Some("amrap"))
        .expect("amrap entry");
    assert_eq!(amrap["count"].as_i64().expect("count"), 2);
}

#[tokio::test]
async fn archived_workouts_do_not_affect_active_workout_stats() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_stats_archive@example.com").await;
    let (name, val) = bearer(&token);

    server
        .post("/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "date": "2026-02-10",
            "name": "Active Workout",
            "workout_type": "lifting"
        }))
        .await
        .assert_status(StatusCode::CREATED);

    server
        .post("/archive/workouts")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "archive_date": "2022-05-10",
            "title": "Archived Card",
            "source_system": "btwb",
            "source_type": "digitized",
            "raw_ocr_text": "Old OCR card",
            "corrected_text": "Old corrected card",
            "review_status": "reviewed",
            "exclude_from_stats": true
        }))
        .await
        .assert_status(StatusCode::CREATED);

    let res = server
        .get("/workouts/stats")
        .add_query_params(&[("from", "2022-01-01"), ("to", "2026-12-31")])
        .add_header(name, val)
        .await;

    res.assert_status_ok();
    let body = res.json::<Value>();
    assert_eq!(body["total_workouts"].as_i64().expect("total_workouts"), 1);
    assert_eq!(body["heatmap"].as_array().expect("heatmap").len(), 1);
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_log_returns_201() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_log_create@example.com").await;
    let (name, val) = bearer(&token);

    let workout = create_basic_workout(&server, &token).await;
    let workout_id = workout["id"].as_str().expect("workout_id");

    let res = server
        .post("/workouts/logs")
        .add_header(name, val)
        .json(&json!({
            "workout_id": workout_id,
            "completed_at": "2026-03-10 09:00:00",
            "duration_secs": 1200,
            "rounds_completed": 5
        }))
        .await;

    res.assert_status(StatusCode::CREATED);
    let body = res.json::<Value>();
    assert_eq!(body["workout_id"].as_str().expect("workout_id"), workout_id);
    assert_eq!(body["duration_secs"].as_i64().expect("duration"), 1200);
}

#[tokio::test]
async fn create_log_for_nonexistent_workout_returns_404() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_log_404@example.com").await;
    let (name, val) = bearer(&token);

    server
        .post("/workouts/logs")
        .add_header(name, val)
        .json(&json!({
            "workout_id": "doesnotexist",
            "completed_at": "2026-03-10 09:00:00"
        }))
        .await
        .assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn list_logs_returns_empty_for_new_user() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_logs_empty@example.com").await;
    let (name, val) = bearer(&token);

    let res = server.get("/workouts/logs").add_header(name, val).await;
    res.assert_status_ok();
    assert_eq!(res.json::<Value>().as_array().expect("array").len(), 0);
}

#[tokio::test]
async fn list_logs_returns_created_log() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_logs_list@example.com").await;
    let (name, val) = bearer(&token);

    let workout = create_basic_workout(&server, &token).await;
    let workout_id = workout["id"].as_str().expect("workout_id");

    server
        .post("/workouts/logs")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "workout_id": workout_id,
            "completed_at": "2026-03-10 08:00:00"
        }))
        .await;

    let res = server.get("/workouts/logs").add_header(name, val).await;
    res.assert_status_ok();
    let arr = res.json::<Value>();
    let arr = arr.as_array().expect("array");
    assert_eq!(arr.len(), 1);
    assert_eq!(
        arr[0]["workout_id"].as_str().expect("workout_id"),
        workout_id
    );
}

#[tokio::test]
async fn delete_log_removes_completion_entry() {
    let server = make_server().await;
    let token = register_and_get_token(&server, "wk_logs_delete@example.com").await;
    let (name, val) = bearer(&token);

    let workout = create_basic_workout(&server, &token).await;
    let workout_id = workout["id"].as_str().expect("workout_id");

    let created = server
        .post("/workouts/logs")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).expect("header"),
        )
        .json(&json!({
            "workout_id": workout_id,
            "completed_at": "2026-03-10 08:00:00"
        }))
        .await
        .json::<Value>();

    let log_id = created["id"].as_str().expect("log id");

    server
        .delete(&format!("/workouts/logs/{log_id}"))
        .add_header(name.clone(), val.clone())
        .await
        .assert_status(StatusCode::NO_CONTENT);

    let res = server.get("/workouts/logs").add_header(name, val).await;
    res.assert_status_ok();
    assert_eq!(res.json::<Value>().as_array().expect("array").len(), 0);
}
