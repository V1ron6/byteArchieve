CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));

CREATE TABLE IF NOT EXISTS files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  original_name TEXT NOT NULL,
  r2_key        TEXT NOT NULL UNIQUE,
  size          BIGINT NOT NULL,
  mime          TEXT NOT NULL DEFAULT 'application/octet-stream',
  -- uploading -> pending -> approved | rejected
  status        TEXT NOT NULL DEFAULT 'uploading'
                CHECK (status IN ('uploading', 'pending', 'approved', 'rejected')),
  review_note   TEXT,
  downloads     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS files_status_created ON files (status, created_at DESC);
CREATE INDEX IF NOT EXISTS files_owner ON files (owner_id);
