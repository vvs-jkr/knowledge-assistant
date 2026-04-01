# Knowledge Assistant

Персональная система для заметок, здоровья, тренировок и AI-помощника.

## Что умеет

- аутентификация с JWT и refresh cookie
- загрузка и редактирование Markdown-заметок
- AI-анализ заметок и семантический поиск
- загрузка PDF/CSV по здоровью и просмотр метрик
- история тренировок, планы, логи, статистика
- knowledge base для материалов и RAG-сценариев
- чат с тренером на основе пользовательских данных

## Архитектура

```text
apps/api   -> Rust + Axum + SQLite + sqlx + reqwest
apps/web   -> React 19 + Vite + TypeScript + Zustand + TanStack Query
apps/bot   -> Telegram bot
packages/  -> shared-types, digitizer
```

Backend хранит пользовательские данные в SQLite, использует шифрование для чувствительных данных и работает как единая точка доступа для web и bot клиентов.

## Структура

```text
knowledge-assistant/
├── apps/
│   ├── api/
│   ├── web/
│   └── bot/
├── packages/
│   ├── shared-types/
│   └── digitizer/
├── .claude/agents/
├── docker-compose.yml
├── docker-compose.prod.yml
├── DEPLOY.md
└── README.md
```

## Запуск

### Корень

```bash
pnpm install
pnpm lint
pnpm dev:web
```

### Backend

```bash
cd apps/api
cargo run
```

### Frontend

```bash
cd apps/web
pnpm dev
```

## Проверки

### Frontend

```bash
pnpm lint
cd apps/web
pnpm typecheck
pnpm test:run
```

### Backend

```bash
cd apps/api
cargo test
```

## Переменные окружения

Минимально нужны:

```env
DATABASE_URL=
JWT_SECRET=
ENCRYPTION_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
FRONTEND_URL=http://localhost:5173
PORT=8080
VITE_API_URL=http://localhost:8080
```

Для bot отдельно:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_IDS=
WEBHOOK_URL=
API_URL=
```

## Основной стек

- Backend: Rust, Axum, Tokio, sqlx, SQLite, sqlite-vec
- Frontend: React 19, Vite, TypeScript, Zustand, TanStack Query, shadcn/ui
- AI: OpenRouter / Anthropic-compatible calls, embeddings
- Charts/UI: Recharts, CodeMirror, Radix UI
- Tooling: Biome, Vitest, cargo test

## Примечания

- Access token хранится только в памяти клиента
- Refresh token хранится в HttpOnly cookie
- Часть данных шифруется до записи в БД
- Документация по конкретным приложениям лежит в `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/bot/CLAUDE.md`
