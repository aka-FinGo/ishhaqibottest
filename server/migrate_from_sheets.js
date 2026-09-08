// ============================================================
// migrate_from_sheets.js — Google Sheets -> SQLite Migration
// Run: node server/migrate_from_sheets.js
// ============================================================
// How to use:
//   1. Export your Google Sheets data to: data/sheets_export.json
//      (see data/sheets_export_template.json for the expected format)
//   2. Run: node server/migrate_from_sheets.js
//   3. The script is idempotent -- safe to run multiple times
// ============================================================

'use strict';

const path = require('path');
const fs   = require('fs');

// Resolve paths relative to project root
const ROOT          = path.resolve(__dirname, '..');
const EXPORT_FILE   = path.join(ROOT, 'data', 'sheets_export.json');
const TEMPLATE_FILE = path.join(ROOT, 'data', 'sheets_export_template.json');
const DB_PATH       = path.join(ROOT, 'data', 'ishhaqi.db');

// Ensure data/ directory exists
const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data/ directory');
}

// Template creator
function createTemplate() {
  const template = {
    _info: "Export your Google Sheets data and fill in this template. Then rename to sheets_export.json",
    employees: [
      {
        telegram_id: "123456789",
        username: "Test User",
        can_add: 1,
        super_admin: 0,
        direktor: 0,
        admin: 0,
        view_all: 1,
        edit: 0,
        delete: 0,
        export: 0,
        view_dash: 1,
        role: "EMPLOYEE",
        lavozim: "Loyihachi",
        guruh: "1",
        is_sardor: 0
      }
    ],
    records: [
      {
        name: "Test User",
        telegram_id: "123456789",
        amount_uzs: 500000,
        amount_usd: 0,
        rate: 12500,
        comment: "Test yozuv",
        date: "01/06/2026",
        is_deleted: 0,
        action_period: "2026-06",
        status: "Tasdiqlandi"
      }
    ],
    kvadratlar: [
      {
        date: "01/06/2026",
        no: "1",
        month: "_06",
        year: "2026",
        total_m2: 15.5,
        order_name: "Test buyurtma",
        staff_name: "Test User",
        owner_tg_id: "123456789",
        is_deleted: 0,
        step_index: 1,
        status: "yangi",
        step_logs: "[]"
      }
    ],
    workflow_steps: [
      { step_index: 1, position_name: "Loyihachi",   action_label: "Kiritish",       status_label: "Yangi",    is_start: 1 },
      { step_index: 2, position_name: "Yiguvchi",    action_label: "Men yigdim",     status_label: "Yigildi",  is_start: 0 },
      { step_index: 3, position_name: "Qadoqlovchi", action_label: "Men qadoqladim", status_label: "Tayyor",   is_start: 0 }
    ],
    positions: [
      { position_name: "Loyihachi",   icon: "?" },
      { position_name: "Yiguvchi",    icon: "?" },
      { position_name: "Qadoqlovchi", icon: "?" }
    ],
    global_settings: {
      only_bugalter_add: 0,
      disable_emp_edit_delete: 0,
      notify_director: 0,
      workflow_strict_mode: 0
    }
  };

  fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(template, null, 2), 'utf8');
  console.log('Template created: data/sheets_export_template.json');
  console.log('');
  console.log('  Fill in your data and save it as: data/sheets_export.json');
  console.log('  Then run this script again.');
}

// Check export file
if (!fs.existsSync(EXPORT_FILE)) {
  console.log('WARNING: data/sheets_export.json not found.');
  createTemplate();
  process.exit(0);
}

// Load export data
let exportData;
try {
  exportData = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
} catch (e) {
  console.error('FAIL: Failed to parse sheets_export.json:', e.message);
  process.exit(1);
}

// Open SQLite database
let db;
try {
  const BetterSqlite = require('better-sqlite3');
  db = new BetterSqlite(DB_PATH);
} catch (e) {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
}
console.log('Database opened:', DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Ensure tables exist (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    telegram_id   TEXT PRIMARY KEY,
    username      TEXT NOT NULL DEFAULT '',
    can_add       INTEGER NOT NULL DEFAULT 0,
    super_admin   INTEGER NOT NULL DEFAULT 0,
    direktor      INTEGER NOT NULL DEFAULT 0,
    admin         INTEGER NOT NULL DEFAULT 0,
    view_all      INTEGER NOT NULL DEFAULT 1,
    edit          INTEGER NOT NULL DEFAULT 0,
    del           INTEGER NOT NULL DEFAULT 0,
    export        INTEGER NOT NULL DEFAULT 0,
    view_dash     INTEGER NOT NULL DEFAULT 0,
    role          TEXT NOT NULL DEFAULT 'EMPLOYEE',
    lavozim       TEXT DEFAULT '',
    guruh         TEXT DEFAULT '',
    is_sardor     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL DEFAULT '',
    telegram_id   TEXT NOT NULL DEFAULT '',
    amount_uzs    REAL NOT NULL DEFAULT 0,
    amount_usd    REAL NOT NULL DEFAULT 0,
    rate          REAL NOT NULL DEFAULT 0,
    comment       TEXT DEFAULT '',
    date          TEXT NOT NULL DEFAULT '',
    is_deleted    INTEGER NOT NULL DEFAULT 0,
    action_period TEXT DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'Tasdiqlandi',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kvadratlar (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    date          TEXT NOT NULL DEFAULT '',
    no            TEXT DEFAULT '',
    month         TEXT DEFAULT '',
    year          TEXT DEFAULT '',
    total_m2      REAL NOT NULL DEFAULT 0,
    order_name    TEXT DEFAULT '',
    staff_name    TEXT DEFAULT '',
    owner_tg_id   TEXT DEFAULT '',
    is_deleted    INTEGER NOT NULL DEFAULT 0,
    step_index    INTEGER NOT NULL DEFAULT 1,
    status        TEXT NOT NULL DEFAULT 'yangi',
    step_logs     TEXT DEFAULT '[]',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workflow_steps (
    step_index    INTEGER PRIMARY KEY,
    position_name TEXT NOT NULL DEFAULT '',
    action_label  TEXT NOT NULL DEFAULT '',
    status_label  TEXT NOT NULL DEFAULT '',
    is_start      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS positions (
    position_name TEXT PRIMARY KEY,
    icon          TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS global_settings (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL DEFAULT '0'
  );
`);

console.log('Tables ensured (created if missing)');

let countEmployees  = 0;
let countRecords    = 0;
let countKvadratlar = 0;
let countWorkflow   = 0;
let countPositions  = 0;

// 1. Migrate Employees
console.log('\nMigrating employees...');
const insertEmployee = db.prepare(`
  INSERT OR REPLACE INTO employees
    (telegram_id, username, can_add, super_admin, direktor, admin,
     view_all, edit, del, export, view_dash, role, lavozim, guruh, is_sardor, updated_at)
  VALUES
    (@telegram_id, @username, @can_add, @super_admin, @direktor, @admin,
     @view_all, @edit, @del, @export, @view_dash, @role, @lavozim, @guruh, @is_sardor, datetime('now'))
`);

const migrateEmployees = db.transaction((employees) => {
  for (const emp of employees) {
    insertEmployee.run({
      telegram_id:  String(emp.telegram_id || '').trim(),
      username:     String(emp.username     || ''),
      can_add:      Number(emp.can_add)      || 0,
      super_admin:  Number(emp.super_admin)  || 0,
      direktor:     Number(emp.direktor)     || 0,
      admin:        Number(emp.admin)        || 0,
      view_all:     emp.view_all   != null ? Number(emp.view_all)   : (emp.canViewAll  != null ? Number(emp.canViewAll)  : 1),
      edit:         emp.edit       != null ? Number(emp.edit)       : (emp.canEdit     != null ? Number(emp.canEdit)     : 0),
      del:          emp.delete     != null ? Number(emp.delete)     : (emp.canDelete   != null ? Number(emp.canDelete)   : 0),
      export:       emp.export     != null ? Number(emp.export)     : (emp.canExport   != null ? Number(emp.canExport)   : 0),
      view_dash:    emp.view_dash  != null ? Number(emp.view_dash)  : (emp.canViewDash != null ? Number(emp.canViewDash) : 0),
      role:         String(emp.role         || 'EMPLOYEE'),
      lavozim:      String(emp.lavozim      || ''),
      guruh:        String(emp.guruh        || ''),
      is_sardor:    Number(emp.is_sardor)    || 0
    });
    countEmployees++;
  }
});

if (Array.isArray(exportData.employees) && exportData.employees.length > 0) {
  migrateEmployees(exportData.employees);
  console.log('  OK: ' + countEmployees + ' employees migrated');
} else {
  console.log('  SKIP: No employees to migrate');
}

// 2. Migrate Records
console.log('\nMigrating payment records...');
const insertRecord = db.prepare(`
  INSERT OR REPLACE INTO records
    (name, telegram_id, amount_uzs, amount_usd, rate, comment, date, is_deleted, action_period, status)
  VALUES
    (@name, @telegram_id, @amount_uzs, @amount_usd, @rate, @comment, @date, @is_deleted, @action_period, @status)
`);

const migrateRecords = db.transaction((records) => {
  for (const rec of records) {
    insertRecord.run({
      name:          String(rec.name          || ''),
      telegram_id:   String(rec.telegram_id   || '').trim(),
      amount_uzs:    Number(rec.amount_uzs)    || 0,
      amount_usd:    Number(rec.amount_usd)    || 0,
      rate:          Number(rec.rate)          || 0,
      comment:       String(rec.comment        || ''),
      date:          String(rec.date           || ''),
      is_deleted:    Number(rec.is_deleted)    || 0,
      action_period: String(rec.action_period  || ''),
      status:        String(rec.status         || 'Tasdiqlandi')
    });
    countRecords++;
  }
});

if (Array.isArray(exportData.records) && exportData.records.length > 0) {
  migrateRecords(exportData.records);
  console.log('  OK: ' + countRecords + ' records migrated');
} else {
  console.log('  SKIP: No records to migrate');
}

// 3. Migrate Kvadratlar
console.log('\nMigrating kvadratlar...');
const insertKvadrat = db.prepare(`
  INSERT OR REPLACE INTO kvadratlar
    (date, no, month, year, total_m2, order_name, staff_name, owner_tg_id, is_deleted, step_index, status, step_logs)
  VALUES
    (@date, @no, @month, @year, @total_m2, @order_name, @staff_name, @owner_tg_id, @is_deleted, @step_index, @status, @step_logs)
`);

const migrateKvadratlar = db.transaction((kvadratlar) => {
  for (const kv of kvadratlar) {
    insertKvadrat.run({
      date:        String(kv.date        || ''),
      no:          String(kv.no         || ''),
      month:       String(kv.month      || ''),
      year:        String(kv.year       || ''),
      total_m2:    Number(kv.total_m2)  || 0,
      order_name:  String(kv.order_name || ''),
      staff_name:  String(kv.staff_name || ''),
      owner_tg_id: String(kv.owner_tg_id|| '').trim(),
      is_deleted:  Number(kv.is_deleted) || 0,
      step_index:  Number(kv.step_index) || 1,
      status:      String(kv.status     || 'yangi'),
      step_logs:   typeof kv.step_logs === 'string'
                     ? kv.step_logs
                     : JSON.stringify(kv.step_logs || [])
    });
    countKvadratlar++;
  }
});

if (Array.isArray(exportData.kvadratlar) && exportData.kvadratlar.length > 0) {
  migrateKvadratlar(exportData.kvadratlar);
  console.log('  OK: ' + countKvadratlar + ' kvadratlar migrated');
} else {
  console.log('  SKIP: No kvadratlar to migrate');
}

// 4. Migrate Workflow Steps
console.log('\nMigrating workflow steps...');
const insertWorkflow = db.prepare(`
  INSERT OR REPLACE INTO workflow_steps
    (step_index, position_name, action_label, status_label, is_start)
  VALUES
    (@step_index, @position_name, @action_label, @status_label, @is_start)
`);

const migrateWorkflow = db.transaction((steps) => {
  for (const step of steps) {
    insertWorkflow.run({
      step_index:    Number(step.step_index)    || 1,
      position_name: String(step.position_name  || ''),
      action_label:  String(step.action_label   || ''),
      status_label:  String(step.status_label   || ''),
      is_start:      Number(step.is_start)      || 0
    });
    countWorkflow++;
  }
});

if (Array.isArray(exportData.workflow_steps) && exportData.workflow_steps.length > 0) {
  migrateWorkflow(exportData.workflow_steps);
  console.log('  OK: ' + countWorkflow + ' workflow steps migrated');
} else {
  const defaults = [
    { step_index: 1, position_name: "Loyihachi",   action_label: "Kiritish",       status_label: "Yangi",    is_start: 1 },
    { step_index: 2, position_name: "Yiguvchi",    action_label: "Men yigdim",     status_label: "Yigildi",  is_start: 0 },
    { step_index: 3, position_name: "Qadoqlovchi", action_label: "Men qadoqladim", status_label: "Tayyor",   is_start: 0 }
  ];
  migrateWorkflow(defaults);
  console.log('  OK: ' + defaults.length + ' default workflow steps inserted');
}

// 5. Migrate Positions
console.log('\nMigrating positions...');
const insertPosition = db.prepare(`
  INSERT OR REPLACE INTO positions (position_name, icon)
  VALUES (@position_name, @icon)
`);

const migratePositions = db.transaction((positions) => {
  for (const pos of positions) {
    insertPosition.run({
      position_name: String(pos.position_name || ''),
      icon:          String(pos.icon          || '')
    });
    countPositions++;
  }
});

if (Array.isArray(exportData.positions) && exportData.positions.length > 0) {
  migratePositions(exportData.positions);
  console.log('  OK: ' + countPositions + ' positions migrated');
} else {
  const defaults = [
    { position_name: "Loyihachi",   icon: "?" },
    { position_name: "Yiguvchi",    icon: "?" },
    { position_name: "Qadoqlovchi", icon: "?" }
  ];
  migratePositions(defaults);
  console.log('  OK: ' + defaults.length + ' default positions inserted');
}

// 6. Migrate Global Settings
console.log('\nMigrating global settings...');
const insertSetting = db.prepare(`
  INSERT OR REPLACE INTO global_settings (key, value) VALUES (@key, @value)
`);

const DEFAULT_SETTINGS = {
  only_bugalter_add:       '0',
  disable_emp_edit_delete: '0',
  notify_director:         '0',
  workflow_strict_mode:    '0'
};

const settings = Object.assign({}, DEFAULT_SETTINGS, exportData.global_settings || {});
const migrateSettings = db.transaction((s) => {
  for (const [key, value] of Object.entries(s)) {
    insertSetting.run({ key, value: String(value) });
  }
});
migrateSettings(settings);
console.log('  OK: ' + Object.keys(settings).length + ' settings migrated');

// Summary
db.close();

console.log('\n==================================================');
console.log('MIGRATION SUMMARY');
console.log('==================================================');
console.log('  Employees:      ' + countEmployees);
console.log('  Records:        ' + countRecords);
console.log('  Kvadratlar:     ' + countKvadratlar);
console.log('  Workflow steps: ' + (countWorkflow || '(defaults)'));
console.log('  Positions:      ' + (countPositions || '(defaults)'));
console.log('  Settings:       ' + Object.keys(settings).length);
console.log('==================================================');
console.log('Migration complete! DB: ' + DB_PATH);
console.log('Run this script again anytime -- it is idempotent (INSERT OR REPLACE).');