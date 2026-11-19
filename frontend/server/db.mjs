// ============================================================================
// Real SQLite Database Layer for EnglishStep Backend
// Uses Node.js native node:sqlite (DatabaseSync) with persistent file storage
// ============================================================================

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'englishstep.sqlite')

export const db = new DatabaseSync(DB_PATH)

// Enable WAL mode & Foreign Keys for performance and integrity
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT NOT NULL,
    provider TEXT DEFAULT 'local',
    provider_id TEXT,
    avatar_url TEXT,
    roles TEXT DEFAULT '["user"]',
    scope TEXT DEFAULT 'read:learning write:learning write:payment',
    is_locked INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    token_version INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    family_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    device_id TEXT,
    expires_at INTEGER NOT NULL,
    is_revoked INTEGER DEFAULT 0,
    replaced_by TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS denylist (
    jti TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS two_factor_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mfa_token TEXT UNIQUE NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    event TEXT NOT NULL,
    user_id TEXT,
    device_id TEXT,
    jti TEXT,
    status TEXT NOT NULL,
    message TEXT,
    metadata TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_rt_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_rt_family ON refresh_tokens(family_id);
  CREATE INDEX IF NOT EXISTS idx_denylist_jti ON denylist(jti);
  CREATE INDEX IF NOT EXISTS idx_mfa_token ON two_factor_challenges(mfa_token);
`)

// Notice: Regular user accounts are NOT pre-seeded!
// Users MUST create an account (Sign Up) before they can sign in.
// Only the system admin template is provisioned if not existing.
const findUserStmt = db.prepare('SELECT id FROM users WHERE email = ?')

if (!findUserStmt.get('admin@englishstep.vn')) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, provider, roles, scope, is_locked, two_factor_enabled, token_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr_admin',
    'admin@englishstep.vn',
    'adminPassword123!',
    'System Administrator',
    'local',
    JSON.stringify(['admin', 'user']),
    'read:learning write:learning write:payment admin:all',
    0,
    1, // 2FA enabled for admin
    1,
    now,
    now
  )
}

console.log('✅ SQLite Database successfully initialized and persistent at:', DB_PATH)
