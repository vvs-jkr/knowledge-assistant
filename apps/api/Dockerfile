### ── Stage 1: build ────────────────────────────────────────────────────────
FROM rust:1.88-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libsqlite3-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependency compilation layer.
# Stubs compile the dependency graph without the real source.
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src && echo "fn main(){}" > src/main.rs && echo "" > src/lib.rs
RUN cargo build --release 2>&1 || true
RUN rm -rf src

# Build the real binary.
# SOURCE_COMMIT is injected by Coolify on every deploy — busts the layer cache.
ARG SOURCE_COMMIT=dev
RUN echo "Building commit: $SOURCE_COMMIT"
COPY . .
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
