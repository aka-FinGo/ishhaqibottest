// ============================================================
// DB.JS — SQLite Database Module (better-sqlite3)
// Replaces Google Sheets infrastructure
// ============================================================
'use strict';

const path = require('path');
const fs   = require('fs');
// ── Data directory & DB path ──────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'ishhaqi.db');

let db;
try {
  const BetterSqlite = require('better-sqlite3');
  db = new BetterSqlite(DB_PATH);
} catch (err) {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
}

// Polyfill transaction for DatabaseSync if needed
if (typeof db.transaction !== 'function') {
  db.transaction = function(fn) {
    return function(...args) {
      db.exec('BEGIN TRANSACTION;');
      try {
        const res = fn(...args);
        db.exec('COMMIT;');
        return res;
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    };
  };
}

// ── Performance pragmas ───────────────────────────────────────
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA temp_store = MEMORY;');
db.exec('PRAGMA cache_size = -16000;'); // 16 MB cache

// ── Schema creation ───────────────────────────────────────────
db.exec(`
-- employees table (replaces Hodimlar sheet)
CREATE TABLE IF NOT EXISTS employees (
    telegram_id   TEXT PRIMARY KEY,
    username      TEXT NOT NULL,
    can_add       INTEGER DEFAULT 1,
    super_admin   INTEGER DEFAULT 0,
    direktor      INTEGER DEFAULT 0,
    admin         INTEGER DEFAULT 0,
    can_view_all  INTEGER DEFAULT 0,
    can_edit      INTEGER DEFAULT 0,
    can_delete    INTEGER DEFAULT 0,
    can_export    INTEGER DEFAULT 0,
    can_view_dash INTEGER DEFAULT 0,
    role          TEXT DEFAULT 'EMPLOYEE',
    lavozim       TEXT DEFAULT '',
    guruh         TEXT DEFAULT '',
    is_sardor     INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- records table (replaces dataSheet)
CREATE TABLE IF NOT EXISTS records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    telegram_id   TEXT NOT NULL,
    amount_uzs    REAL DEFAULT 0,
    amount_usd    REAL DEFAULT 0,
    rate          REAL DEFAULT 0,
    comment       TEXT,
    date          TEXT NOT NULL,
    is_deleted    INTEGER DEFAULT 0,
    action_period TEXT,
    status        TEXT DEFAULT 'Tasdiqlandi',
    actor_tg_id   TEXT,
    actor_name    TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_records_tg     ON records(telegram_id);
CREATE INDEX IF NOT EXISTS idx_records_date   ON records(date);
CREATE INDEX IF NOT EXISTS idx_records_is_del ON records(is_deleted);

-- kvadratlar table
CREATE TABLE IF NOT EXISTS kvadratlar (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sana          TEXT NOT NULL,
    order_no      TEXT,
    oy            TEXT,
    yil           TEXT,
    total_m2      REAL DEFAULT 0,
    order_name    TEXT NOT NULL,
    staff_name    TEXT,
    owner_tg_id   TEXT NOT NULL,
    is_deleted    INTEGER DEFAULT 0,
    current_step  INTEGER DEFAULT 1,
    status        TEXT DEFAULT 'Jarayonda',
    workflow_logs TEXT,
    step_data     TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kv_owner ON kvadratlar(owner_tg_id);
CREATE INDEX IF NOT EXISTS idx_kv_del   ON kvadratlar(is_deleted);

-- workflow_steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
    step_index    INTEGER PRIMARY KEY,
    position_name TEXT NOT NULL,
    action_label  TEXT NOT NULL,
    status_label  TEXT NOT NULL,
    is_start      INTEGER DEFAULT 0
);

-- positions table
CREATE TABLE IF NOT EXISTS positions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    position_name TEXT NOT NULL UNIQUE,
    icon          TEXT DEFAULT '💼'
);

-- global_settings table (replaces PropertiesService)
CREATE TABLE IF NOT EXISTS global_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    action     TEXT,
    tg_id      TEXT,
    raw_body   TEXT,
    error      TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- rate_limit table (replaces CacheService)
CREATE TABLE IF NOT EXISTS rate_limit (
    key        TEXT PRIMARY KEY,
    count      INTEGER DEFAULT 1,
    window_end INTEGER NOT NULL
);

-- pending_approvals table (for Tasdiqlash/Rad etish workflow)
CREATE TABLE IF NOT EXISTS pending_approvals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id        INTEGER NOT NULL,
    requester_tg_id  TEXT NOT NULL,
    approver_tg_id   TEXT NOT NULL,
    message_id       TEXT,
    status           TEXT DEFAULT 'pending',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- tracked_messages table (for syncing message status across all Telegram chats)
CREATE TABLE IF NOT EXISTS tracked_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id   INTEGER NOT NULL,
    chat_id     TEXT NOT NULL,
    message_id  TEXT NOT NULL,
    base_text   TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trk_rec ON tracked_messages(record_id);
`);

// ── Seed default workflow steps if empty ─────────────────────
const stepCount = db.prepare('SELECT COUNT(*) AS cnt FROM workflow_steps').get();
if (stepCount.cnt === 0) {
  const insertStep = db.prepare(
    'INSERT INTO workflow_steps (step_index, position_name, action_label, status_label, is_start) VALUES (?,?,?,?,?)'
  );
  const seedSteps = db.transaction(() => {
    insertStep.run(1, 'Loyihachi',   'Kiritish',        'Yangi',    1);
    insertStep.run(2, 'Yig\'uvchi',  'Men yig\'dim',    'Yig\'ildi', 0);
    insertStep.run(3, 'Qadoqlovchi','Men qadoqladim',   'Tayyor',   0);
  });
  seedSteps();
}

// ── Seed default positions if empty ──────────────────────────
const posCount = db.prepare('SELECT COUNT(*) AS cnt FROM positions').get();
if (posCount.cnt === 0) {
  const insertPos = db.prepare('INSERT OR IGNORE INTO positions (position_name, icon) VALUES (?,?)');
  const seedPos = db.transaction(() => {
    insertPos.run('Loyihachi',    '📐');
    insertPos.run('Yig\'uvchi',   '🔧');
    insertPos.run('Qadoqlovchi', '📦');
  });
  seedPos();
}

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * getEmployee — get employee row by telegram_id
 * Mirrors getEmployee() from Database.gs / GS_Auth.gs
 */
function getEmployee(tgId) {
  if (!tgId) return null;
  const row = db.prepare('SELECT * FROM employees WHERE telegram_id = ?').get(String(tgId));
  if (!row) return null;

  // Resolve role and permissions (mirrors resolveEmployeeAccessFromRow_)
  const role = _normalizeRole(row.role);
  const isSuperAdmin = row.super_admin === 1 || role === 'SUPER_ADMIN';
  const isDirektor   = !isSuperAdmin && (role === 'DIRECTOR' || row.direktor === 1);
  const isAdmin      = isSuperAdmin || role === 'ADMIN' || row.admin === 1;
  const isBugalter   = !isSuperAdmin && role === 'BUGALTER';

  const canAdd       = isSuperAdmin ? true : (row.can_add === 1);
  const canViewAll   = isSuperAdmin ? true : (row.can_view_all  === 1);
  const canEdit      = isSuperAdmin ? true : (row.can_edit      === 1);
  const canDelete    = isSuperAdmin ? true : (row.can_delete    === 1);
  const canExport    = isSuperAdmin ? true : (row.can_export    === 1);
  const canViewDash  = isSuperAdmin ? true : (row.can_view_dash === 1);

  // positions — stored in lavozim field (comma-separated for multi-position support)
  const positions = row.lavozim
    ? String(row.lavozim).split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return {
    tgId:         String(row.telegram_id),
    id:           String(row.telegram_id),
    telegram_id:  String(row.telegram_id),
    username:     row.username,
    name:         row.username,
    canAdd,
    canViewAll,
    canEdit,
    canDelete,
    canExport,
    canViewDash,
    role:         _roleLabelFromKey(isSuperAdmin ? 'SUPER_ADMIN' : role),
    roleKey:      isSuperAdmin ? 'SUPER_ADMIN' : role,
    isSuperAdmin,
    isDirektor,
    isAdmin,
    isBugalter,
    permissions: {
      canViewAll,
      canEdit,
      canDelete,
      canExport,
      canViewDash
    },
    positions,
    group:        row.guruh || '',
    guruh:        row.guruh || '',
    isSardor:     row.is_sardor === 1,
    lavozim:      row.lavozim  || ''
  };
}

/**
 * getAllEmployees — all non-PENDING employees
 * Mirrors getHodimlar() from GS_Auth / Database.gs
 */
function getAllEmployees() {
  const rows = db.prepare("SELECT * FROM employees ORDER BY username ASC").all();
  return rows.map(row => {
    const role = _normalizeRole(row.role);
    const isSuperAdmin = row.super_admin === 1 || role === 'SUPER_ADMIN';
    const canAdd       = isSuperAdmin ? true : (row.can_add === 1);
    const canViewAll   = isSuperAdmin ? true : (row.can_view_all === 1);
    const canEdit      = isSuperAdmin ? true : (row.can_edit === 1);
    const canDelete    = isSuperAdmin ? true : (row.can_delete === 1);
    const canExport    = isSuperAdmin ? true : (row.can_export === 1);
    const canViewDash  = isSuperAdmin ? true : (row.can_view_dash === 1);
    const positions    = row.lavozim
      ? String(row.lavozim).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    return {
      tgId:        String(row.telegram_id),
      id:          String(row.telegram_id),
      telegram_id: String(row.telegram_id),
      username:    row.username,
      name:        row.username,
      role:        _roleLabelFromKey(isSuperAdmin ? 'SUPER_ADMIN' : role),
      roleKey:     isSuperAdmin ? 'SUPER_ADMIN' : role,
      roleLabel:   _roleLabelFromKey(isSuperAdmin ? 'SUPER_ADMIN' : role),
      canAdd:      canAdd ? 1 : 0,
      canViewAll:  canViewAll ? 1 : 0,
      canEdit:     canEdit ? 1 : 0,
      canDelete:   canDelete ? 1 : 0,
      canExport:   canExport ? 1 : 0,
      canViewDash: canViewDash ? 1 : 0,
      isSuperAdmin: isSuperAdmin ? 1 : 0,
      isDirektor:  (!isSuperAdmin && (role === 'DIRECTOR' || row.direktor === 1)) ? 1 : 0,
      isAdmin:     (isSuperAdmin || role === 'ADMIN' || row.admin === 1) ? 1 : 0,
      isBugalter:  (!isSuperAdmin && role === 'BUGALTER') ? 1 : 0,
      positions,
      lavozim:     row.lavozim  || '',
      group:       row.guruh    || '',
      guruh:       row.guruh    || '',
      isSardor:    row.is_sardor === 1 ? 1 : 0,
      permissions: {
        canViewAll,
        canEdit,
        canDelete,
        canExport,
        canViewDash
      }
    };
  });
}

/**
 * getSetting — get a global setting value
 * Mirrors PropertiesService.getProperty()
 */
function getSetting(key, defaultVal = null) {
  const row = db.prepare('SELECT value FROM global_settings WHERE key = ?').get(String(key));
  return row ? row.value : defaultVal;
}

/**
 * setSetting — set a global setting value
 * Mirrors PropertiesService.setProperty()
 */
function setSetting(key, value) {
  db.prepare(
    'INSERT INTO global_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  ).run(String(key), String(value));
}

/**
 * addErrorLog — log an error entry
 * Mirrors addErrorLog_() from Code.gs
 */
function addErrorLog(action, tgId, rawBody, error) {
  try {
    const errText = error instanceof Error
      ? (error.stack || error.message || String(error))
      : String(error || '');
    db.prepare(
      'INSERT INTO error_logs (action, tg_id, raw_body, error) VALUES (?,?,?,?)'
    ).run(
      String(action  || ''),
      String(tgId    || ''),
      String(rawBody || '').slice(0, 2000),
      errText.slice(0, 4000)
    );
  } catch (ignore) {}
}

/**
 * checkRateLimit — sliding window rate limiter
 * Mirrors checkRateLimit_() / CacheService logic from Code.gs
 * @returns {{ success: boolean, error?: string }}
 */
function checkRateLimit(tgId, action, maxPerWindow = 60, windowSec = 60) {
  try {
    const key      = `rl:${String(tgId || '0')}:${String(action || '')}`;
    const nowSec   = Math.floor(Date.now() / 1000);
    const winEnd   = nowSec + windowSec;

    // Clean expired keys first
    db.prepare('DELETE FROM rate_limit WHERE window_end <= ?').run(nowSec);

    const existing = db.prepare('SELECT count, window_end FROM rate_limit WHERE key = ?').get(key);

    if (!existing) {
      db.prepare(
        'INSERT INTO rate_limit (key, count, window_end) VALUES (?,1,?)'
      ).run(key, winEnd);
      return { success: true };
    }

    if (existing.count >= maxPerWindow) {
      return {
        success: false,
        error:  `Juda tez so'rov yuborildi. ${windowSec} soniya kuting.`
      };
    }

    db.prepare('UPDATE rate_limit SET count = count + 1 WHERE key = ?').run(key);
    return { success: true };
  } catch (e) {
    return { success: true }; // Fail open (same as GAS)
  }
}

/**
 * Tracked messages helpers for syncing Telegram message statuses
 */
function saveTrackedMessage(recordId, chatId, messageId, baseText) {
  try {
    if (!recordId || !chatId || !messageId) return;
    db.prepare(`
      INSERT INTO tracked_messages (record_id, chat_id, message_id, base_text)
      VALUES (?, ?, ?, ?)
    `).run(Number(recordId), String(chatId), String(messageId), String(baseText || ''));
  } catch (err) {
    console.error('[saveTrackedMessage error]', err.message);
  }
}

function getTrackedMessages(recordId) {
  try {
    return db.prepare('SELECT chat_id, message_id, base_text FROM tracked_messages WHERE record_id = ?').all(Number(recordId));
  } catch (err) {
    console.error('[getTrackedMessages error]', err.message);
    return [];
  }
}

function deleteTrackedMessages(recordId) {
  try {
    db.prepare('DELETE FROM tracked_messages WHERE record_id = ?').run(Number(recordId));
  } catch (err) {
    console.error('[deleteTrackedMessages error]', err.message);
  }
}

// ── Internal helpers ─────────────────────────────────────────

function _normalizeRole(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (raw === 'DIRECTOR'    || raw === 'DIREKTOR')   return 'DIRECTOR';
  if (raw === 'ADMIN')                               return 'ADMIN';
  if (raw === 'BUGALTER'    || raw === 'ACCOUNTANT') return 'BUGALTER';
  if (raw === 'PENDING'     || raw === 'KUTILMOQDA') return 'PENDING';
  if (raw === 'EMPLOYEE'    || raw === 'USER' || raw === 'XODIM') return 'EMPLOYEE';
  return 'EMPLOYEE';
}

function _roleLabelFromKey(roleKey) {
  if (roleKey === 'SUPER_ADMIN') return 'SuperAdmin';
  if (roleKey === 'DIRECTOR')    return 'Direktor';
  if (roleKey === 'ADMIN')       return 'Admin';
  if (roleKey === 'BUGALTER')    return 'Bugalter';
  if (roleKey === 'PENDING')     return 'Kutilmoqda';
  return 'Xodim';
}

// ─────────────────────────────────────────────────────────────
module.exports = {
  db,
  getEmployee,
  getAllEmployees,
  getSetting,
  setSetting,
  addErrorLog,
  checkRateLimit,
  saveTrackedMessage,
  getTrackedMessages,
  deleteTrackedMessages
};
