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

async fn register_user(server: &TestServer, email: &str, password: &str) -> Value {
    server
        .post("/auth/register")
        .json(&json!({"email": email, "password": password}))
        .await
        .json::<Value>()
}

fn get_refresh_token_from_cookie(header: &HeaderValue) -> String {
    header
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .trim_start_matches("refresh_token=")
        .to_string()
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

#[tokio::test]
async fn register_success_returns_token_and_cookie() {
    let server = make_server().await;

    let res = server
        .post("/auth/register")
        .json(&json!({"email": "new@example.com", "password": "Password1"}))
        .await;

    res.assert_status(StatusCode::CREATED);
    let body = res.json::<Value>();
    assert!(body["access_token"].is_string());
    assert_eq!(body["user"]["email"], "new@example.com");

    let cookie = res.header("set-cookie").to_str().unwrap().to_string();
    assert!(cookie.contains("refresh_token="));
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("SameSite=Strict"));
}

#[tokio::test]
async fn register_duplicate_email_fails() {
    let server = make_server().await;
    register_user(&server, "dup@example.com", "Password1").await;

    let res = server
        .post("/auth/register")
        .json(&json!({"email": "dup@example.com", "password": "Password1"}))
        .await;

    res.assert_status(StatusCode::BAD_REQUEST);
    let body = res.json::<Value>();
    assert!(body["error"]
        .as_str()
        .unwrap()
        .contains("already registered"));
}

#[tokio::test]
async fn register_invalid_email_fails() {
    let server = make_server().await;

    server
        .post("/auth/register")
        .json(&json!({"email": "notanemail", "password": "Password1"}))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn register_short_password_fails() {
    let server = make_server().await;

    server
        .post("/auth/register")
        .json(&json!({"email": "test@example.com", "password": "short"}))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

#[tokio::test]
async fn login_success() {
    let server = make_server().await;
    register_user(&server, "user@example.com", "Password1").await;

    let res = server
        .post("/auth/login")
        .json(&json!({"email": "user@example.com", "password": "Password1"}))
        .await;

    res.assert_status_ok();
    assert!(res.json::<Value>()["access_token"].is_string());
}

#[tokio::test]
async fn login_wrong_password_returns_401() {
    let server = make_server().await;
    register_user(&server, "user2@example.com", "Password1").await;

    server
        .post("/auth/login")
        .json(&json!({"email": "user2@example.com", "password": "WrongPass1"}))
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn login_unknown_email_returns_401() {
    let server = make_server().await;

    server
        .post("/auth/login")
        .json(&json!({"email": "nobody@example.com", "password": "Password1"}))
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

#[tokio::test]
async fn me_without_token_returns_401() {
    let server = make_server().await;
    server
        .get("/auth/me")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_with_valid_token_returns_user_info() {
    let server = make_server().await;

    let body = register_user(&server, "me@example.com", "Password1").await;
    let token = body["access_token"].as_str().unwrap();

    let res = server
        .get("/auth/me")
        .add_header(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).unwrap(),
        )
        .await;

    res.assert_status_ok();
    assert_eq!(res.json::<Value>()["email"], "me@example.com");
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

#[tokio::test]
async fn refresh_without_cookie_returns_401() {
    let server = make_server().await;
    server
        .post("/auth/refresh")
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn refresh_rotates_token() {
    let server = make_server().await;

    let reg_res = server
        .post("/auth/register")
        .json(&json!({"email": "refresh@example.com", "password": "Password1"}))
        .await;

    let refresh_token = get_refresh_token_from_cookie(&reg_res.header("set-cookie"));

    let ref_res = server
        .post("/auth/refresh")
        .add_header(
            axum::http::header::COOKIE,
            HeaderValue::from_str(&format!("refresh_token={refresh_token}")).unwrap(),
        )
        .await;

    ref_res.assert_status_ok();
    assert!(ref_res.json::<Value>()["access_token"].is_string());

    let new_refresh_token = get_refresh_token_from_cookie(&ref_res.header("set-cookie"));
    assert_ne!(
        refresh_token, new_refresh_token,
        "refresh token must rotate"
    );

    // Старый токен больше не работает
    server
        .post("/auth/refresh")
        .add_header(
            axum::http::header::COOKIE,
            HeaderValue::from_str(&format!("refresh_token={refresh_token}")).unwrap(),
        )
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

#[tokio::test]
async fn logout_invalidates_refresh_token() {
    let server = make_server().await;

    let reg_res = server
        .post("/auth/register")
        .json(&json!({"email": "logout@example.com", "password": "Password1"}))
        .await;

    let refresh_token = get_refresh_token_from_cookie(&reg_res.header("set-cookie"));

    server
        .post("/auth/logout")
        .add_header(
            axum::http::header::COOKIE,
            HeaderValue::from_str(&format!("refresh_token={refresh_token}")).unwrap(),
        )
        .await
        .assert_status_ok();

    // После logout refresh_token больше не работает
    server
        .post("/auth/refresh")
        .add_header(
            axum::http::header::COOKIE,
            HeaderValue::from_str(&format!("refresh_token={refresh_token}")).unwrap(),
        )
        .await
        .assert_status(StatusCode::UNAUTHORIZED);
}
