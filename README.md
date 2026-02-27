# Knowledge Assistant

Персональный ассистент для работы со знаниями: AI-анализ markdown-заметок, семантический поиск по базе знаний и трекинг показателей здоровья.

## Технологии

**Backend (Rust)**
- Axum — веб-фреймворк
- SQLite + sqlx — база данных с compile-time проверкой запросов
- sqlite-vec — векторное расширение для семантического поиска
- argon2 — хэширование паролей
- jsonwebtoken — JWT аутентификация (access 15 мин + refresh 7 дней)
- AES-256-GCM — шифрование чувствительных данных в БД
- reqwest — HTTP-клиент для Anthropic API

**Frontend (TypeScript)**
- React 19 + Vite
- React Router v7
- TanStack Query / Form / Table
- Zustand — глобальный стейт
- Zod — валидация
- shadcn/ui + Tailwind CSS v4
- CodeMirror 6 — markdown редактор
- Recharts — графики динамики здоровья

**Инфраструктура**
- Docker Compose
- Nginx — reverse proxy, TLS termination

## Модули

- **Auth** — регистрация, вход, refresh token rotation
- **Notes** — загрузка .md файлов, редактирование, AI-анализ (дедупликация, актуальность), семантический поиск
- **Health** — загрузка PDF с анализами, извлечение показателей, графики динамики, экспорт в Obsidian

## Прогресс

- [x] Phase 0 — скелет проекта
- [x] Phase 1 — аутентификация
- [ ] Phase 2 — модуль заметок
- [ ] Phase 3 — модуль здоровья
