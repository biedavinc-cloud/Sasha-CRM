-- Sasha CRM — Cloudflare D1 schema

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  password_hash  TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  google_sub     TEXT UNIQUE,
  created_date   TEXT NOT NULL,
  updated_date   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One-time codes: email OTP, password reset, invitation
CREATE TABLE IF NOT EXISTS auth_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('otp','reset','invite')),
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_codes_user ON auth_codes(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_codes_hash ON auth_codes(code_hash);

CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- Generic entity store (Partner, Referral, Commission, ...). Same record shape as Base44.
CREATE TABLE IF NOT EXISTS entities (
  entity       TEXT NOT NULL,
  id           TEXT NOT NULL,
  data         TEXT NOT NULL,
  created_date TEXT NOT NULL,
  updated_date TEXT NOT NULL,
  created_by   TEXT,
  PRIMARY KEY (entity, id)
);
CREATE INDEX IF NOT EXISTS idx_entities_created ON entities(entity, created_date);
