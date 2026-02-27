# 🧠 Knowledge Assistant

> Персональный ассистент для работы со знаниями — AI-анализ заметок, семантический поиск и трекинг здоровья.

```
┌─────────────────────────────────────────────────────────┐
│                     Knowledge Assistant                 │
│                                                         │
│   📝 Заметки         🔍 Поиск          🏥 Здоровье    │
│   ─────────────       ─────────────      ─────────────  │
│   .md upload          Семантический      PDF анализов   │
│   CodeMirror          sqlite-vec         Метрики        │
│   AES-256-GCM         Embeddings         Recharts       │
│   AI-анализ           Top-K results      Obsidian exp.  │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Архитектура

```
Browser
  │
  │  Access Token (JWT, 15 min) → Authorization: Bearer ...
  │  Refresh Token (7 days)     → HttpOnly Cookie
  │
  ▼
┌──────────────────────────────────────────────────┐
│  React 19  ·  Vite  ·  TypeScript                │
│                                                  │
│  Zustand ──► token (in memory only, not LS!)     │
│  TanStack Query ──► server state & caching       │
│  TanStack Form + Zod ──► validation              │
│  Axios interceptor ──► auto token refresh        │
│  shadcn/ui + Tailwind v4 ──► UI                  │
│  CodeMirror 6 ──► markdown editor                │
│  Recharts ──► health charts                      │
└────────────────────┬─────────────────────────────┘
                     │ HTTP / REST
                     ▼
┌──────────────────────────────────────────────────┐
│  Rust · Axum 0.7 · Tokio                         │
│                                                  │
│  tower-http: CORS · gzip · tracing               │
│  tower_governor: rate limiting (auth endpoints)  │
│  AppState ──► db + jwt_keys + encryption_key     │
│                                                  │
│  argon2 ──► password hashing                     │
│  jsonwebtoken ──► JWT encode / decode            │
│  aes-gcm ──► AES-256-GCM (notes & health data)   │
│  reqwest ──► Anthropic API calls                 │
└────────────────────┬─────────────────────────────┘
                     │ sqlx (compile-time checked)
                     ▼
┌──────────────────────────────────────────────────┐
│  SQLite                                          │
│                                                  │
│  users ──► argon2 hashed passwords               │
│  sessions ──► refresh tokens, expires_at         │
│  note_files ──► AES-GCM encrypted content        │
│  health_records ──► AES-GCM encrypted metrics    │
│                                                  │
│  sqlite-vec ──► vector index (embeddings)        │
└──────────────────────────────────────────────────┘
```

---

## 🗂️ Монорепо

```
knowledge-assistant/
├── apps/
│   ├── api/                  🦀 Rust backend
│   │   ├── src/
│   │   │   ├── lib.rs        # build_app(), build_test_state()
│   │   │   ├── main.rs       # entry point
│   │   │   ├── auth.rs       # JWT, argon2, cookies
│   │   │   ├── config.rs     # AppConfig, AppState
│   │   │   ├── middleware.rs # AuthUser extractor
│   │   │   └── routes/
│   │   │       ├── auth.rs   # register, login, refresh, logout, me
│   │   │       └── notes.rs  # (phase 2)
│   │   ├── migrations/       # sqlx migrations
│   │   └── .sqlx/            # offline query cache (commit this!)
│   │
│   └── web/                  ⚛️  React frontend
│       └── src/
│           ├── app/          # router, providers
│           ├── features/     # auth, notes, health (feature-sliced)
│           ├── pages/
│           └── shared/       # api.ts, schemas, ui
│
├── packages/
│   └── shared-types/         📦 TS types via typeshare
│
└── docker-compose.yml
```

---

## 🔐 Auth Flow

```
POST /auth/register ──► argon2 hash ──► INSERT user
                                    └──► INSERT session
                                    └──► JWT (15 min) + cookie (7 days)

POST /auth/login    ──► verify hash ──► DELETE old sessions
                                    └──► новая сессия + токены

POST /auth/refresh  ──► проверка cookie ──► DELETE старой сессии
                                        └──► INSERT новой (rotation!)
                                        └──► новый JWT + новый cookie

POST /auth/logout   ──► DELETE session ──► clear cookie
GET  /auth/me       ──► AuthUser extractor (JWT verify)
```

---

## 🛠️ Стек

| Слой | Технологии |
|---|---|
| **Runtime** | Rust · Tokio · Axum 0.7 |
| **DB** | SQLite · sqlx 0.8 · sqlite-vec |
| **Security** | argon2 · AES-256-GCM · JWT · HttpOnly cookies |
| **AI** | Anthropic Claude API · Embeddings |
| **Frontend** | React 19 · TypeScript · Vite |
| **State** | Zustand · TanStack Query v5 |
| **UI** | shadcn/ui · Tailwind CSS v4 · CodeMirror 6 · Recharts |
| **Tooling** | Biome · Vitest · cargo test · axum-test |
| **Infra** | Docker Compose · Nginx · Let's Encrypt |

---

## 📍 Прогресс

```
[✅] Phase 0 — Foundations     монорепо, Docker, Axum skeleton, React skeleton
[✅] Phase 1 — Auth            register · login · JWT · refresh rotation · rate limiting
[  ] Phase 2 — Notes           upload · CodeMirror · sqlite-vec search · AI analysis
[  ] Phase 3 — Health          PDF upload · metrics · Recharts dashboard · Obsidian export
[  ] Phase 4 — Polish          dark mode · skeletons · mobile · keyboard shortcuts
```
