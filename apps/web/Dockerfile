### ── Stage 1: build ────────────────────────────────────────────────────────
# Build context must be the monorepo ROOT (pnpm-lock.yaml lives there).
# docker-compose: context: .  dockerfile: apps/web/Dockerfile
FROM node:22-bookworm-slim AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace manifest + lockfile first for dependency caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter web...

# Copy web source.
COPY apps/web/ ./apps/web/

# VITE_API_URL is baked into the JS bundle at build time.
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter web build

### ── Stage 2: runtime ──────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
