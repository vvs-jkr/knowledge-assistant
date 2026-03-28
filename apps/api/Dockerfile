### ── Stage 1: build ────────────────────────────────────────────────────────
FROM rust:1.88-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libsqlite3-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependency compilation -- this layer is reused when only src/ changes
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src && echo 'fn main() {}' > src/main.rs && \
    cargo build --release && \
    rm -f src/main.rs target/release/deps/knowledge_api*

# Build actual source
COPY src ./src
COPY .sqlx ./.sqlx
COPY migrations ./migrations
ENV SQLX_OFFLINE=true
RUN cargo build --release

### ── Stage 2: runtime ──────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    libssl3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/knowledge-api ./knowledge-api
COPY --from=builder /app/migrations ./migrations

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["./knowledge-api"]
