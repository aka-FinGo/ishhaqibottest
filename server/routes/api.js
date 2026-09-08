// ============================================================
// ROUTES/API.JS — Web App POST /api handler
// Mirrors doPost() switch from Code.gs
// ============================================================
'use strict';

const router = require('express').Router();
const { validateTelegramAuth, checkUserRoles } = require('../auth');
const { addErrorLog, checkRateLimit, getSetting, setSetting, getAllEmployees, getEmployee } = require('../db');
const cfg = require('../config');

// Write actions requiring sequential processing (mirrors LockService logic)
const WRITE_ACTIONS = new Set([
  'add','admin_edit','admin_delete','self_edit','self_delete',
  'add_hodim','update_hodim','delete_hodim',
  'kvadrat_add','kvadrat_edit','kvadrat_delete','kvadrat_claim','kvadrat_revert',
  'force_reassign_step','workflow_save_config','positions_save_all',
  'ai_save_config','ai_run_report','set_global_setting'
]);

// Rate limit seconds per action (mirrors getRateLimitSeconds_() from Code.gs)
function getRateLimitSec(action) {
  if (!cfg.RATE_LIMIT_ENABLED) return 0;
  const a = String(action || '');
  if (['add','admin_edit','admin_delete','self_edit','self_delete',
       'add_hodim','update_hodim','delete_hodim',
       'send_user_reminder','send_inactive_reminders','set_reminder_text'].includes(a)) return 2;
  if (a === 'export_to_bot') return 5;
  return 0;
}

router.post('/', async (req, res) => {
  let action = '';
  let tgId   = '';
  let rawBody = '';

  try {
    const body = req.body || {};
    rawBody    = JSON.stringify(body);
    action     = String(body.action   || '');
    tgId       = String(body.telegramId || '');

    if (!action) {
      return res.json({ success: false, error: "Action yuborilmadi" });
    }

    // ── Auth validation ───────────────────────────────────────
    const authVal = validateTelegramAuth(body, cfg.BOT_TOKEN, cfg.REQUIRE_TELEGRAM_AUTH);
    if (!authVal.success) {
      return res.json({ success: false, error: authVal.error });
    }

    // ── Rate limiting ─────────────────────────────────────────
    const limitSec = getRateLimitSec(action);
    if (limitSec > 0) {
      const rl = checkRateLimit(tgId, action, 1, limitSec);
      if (!rl.success) return res.json(rl);
    }

    // ── Role resolution ───────────────────────────────────────
    const auth = checkUserRoles(tgId);
    let result;

    // ── Action switch ─────────────────────────────────────────
    switch (action) {

      case 'init':
        result = await handleInit(tgId, auth, body);
        break;

      case 'admin_init':
        result = await handleAdminInit(tgId, auth);
        break;

      case 'admin_get_all': {
        const canView = auth.isSuperAdmin || auth.permissions.canViewAll;
        if (!canView) return res.json({ success: false, error: "Ko'rish ruxsati yo'q!" });
        result = await handleAdminGetAll(body, auth);
        break;
      }

      case 'admin_edit': {
        const canEdit = auth.isSuperAdmin || auth.permissions.canEdit;
        if (!canEdit) return res.json({ success: false, error: "Tahrirlash ruxsati yo'q!" });
        result = await handleAdminEdit(body, tgId, auth);
        break;
      }

      case 'admin_delete': {
        const canDel = auth.isSuperAdmin || auth.permissions.canDelete;
        if (!canDel) return res.json({ success: false, error: "O'chirish ruxsati yo'q!" });
        result = await handleAdminDelete(body, tgId, auth);
        break;
      }

      case 'add':
        result = await handleAdd(body, auth, tgId);
        break;

      case 'self_edit':
        if (!auth.inList && !auth.isSuperAdmin) return res.json({ success: false, error: "Ro'yxatda topilmadingiz" });
        result = await handleSelfEdit(body, tgId, auth);
        break;

      case 'self_delete':
        if (!auth.inList && !auth.isSuperAdmin) return res.json({ success: false, error: "Ro'yxatda topilmadingiz" });
        result = await handleSelfDelete(body, tgId, auth);
        break;

      // ---- Hodimlar boshqaruvi (SuperAdmin only) ----
      case 'get_hodimlar':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin!" });
        result = { success: true, data: getAllEmployees() };
        break;

      case 'add_hodim':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin!" });
        result = await handleAddHodim(body);
        break;

      case 'update_hodim':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin!" });
        result = await handleUpdateHodim(body);
        break;

      case 'delete_hodim':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin!" });
        result = await handleDeleteHodim(body.tgId);
        break;

      // ---- Global settings ----
      case 'get_global_settings':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin sozlamalarni ko'ra oladi" });
        result = { success: true, settings: getGlobalSettingsAll() };
        break;

      case 'set_global_setting':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin sozlamalarni o'zgartira oladi" });
        result = setGlobalSettingHandler(body.key, body.value);
        break;

      // ---- Kvadratlar & Workflow ----
      case 'kvadrat_get_all':
        result = await handleKvadratGetAll(auth);
        break;

      case 'kvadrat_add':
        result = await handleKvadratAdd(body, auth, tgId);
        break;

      case 'kvadrat_edit':
        result = await handleKvadratEdit(body, auth, tgId);
        break;

      case 'kvadrat_delete':
        result = await handleKvadratDelete(body, auth, tgId);
        break;

      case 'kvadrat_claim':
        result = await handleKvadratClaim(body, auth, tgId);
        break;

      case 'kvadrat_revert':
        result = await handleKvadratRevert(body, auth, tgId);
        break;

      case 'force_reassign_step':
        result = await handleForceReassignStep(body, auth);
        break;

      case 'workflow_get_config':
      case 'get_workflow_config':
        result = await handleWorkflowGetConfig();
        break;

      case 'workflow_save_config':
        result = await handleWorkflowSaveConfig(body.steps, auth);
        break;

      case 'workflow_get_settings':
        result = { success: true, isWorkflowStrict: getSetting('WORKFLOW_STRICT_MODE', '0') === '1' };
        break;

      case 'workflow_save_settings':
        result = await handleWorkflowSaveSettings(body, auth);
        break;

      case 'positions_get_all':
      case 'get_positions':
        result = await handlePositionsGetAll();
        break;

      case 'positions_save_all':
        result = await handlePositionsSaveAll(body.positions, auth);
        break;

      // ---- Notifications & Reminders ----
      case 'get_reminder_text':
        result = { success: true, text: getSetting('REMINDER_TEXT', "⚠️ Eslatma!\nKompaniya kelajagi uchun olgan avans va oyliklaringizni botga o'z vaqtida yozib qo'yishingizni so'raymiz! Yordamingiz uchun rahmat! )") };
        break;

      case 'set_reminder_text':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin!" });
        setSetting('REMINDER_TEXT', String(body.text || ''));
        result = { success: true, text: body.text };
        break;

      case 'get_director_notify':
        result = { success: true, enabled: getSetting('NOTIFY_DIRECTOR', '1') === '1' };
        break;

      case 'set_director_notify':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin!" });
        setSetting('NOTIFY_DIRECTOR', body.enabled ? '1' : '0');
        result = { success: true };
        break;

      // ---- AI Agent Configuration ----
      case 'ai_get_config':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin AI sozlamalarini ko'ra oladi" });
        const rawAi = getSetting('AI_PROVIDERS_CONFIG', '{"all":[],"active":[]}');
        try {
          result = { success: true, config: JSON.parse(rawAi) };
        } catch (e) {
          result = { success: true, config: { all: [], active: [] } };
        }
        break;

      case 'ai_save_config':
        if (!auth.isSuperAdmin) return res.json({ success: false, error: "Faqat SuperAdmin AI sozlamalarini o'zgartira oladi" });
        const cfgList = Array.isArray(body.config) ? body.config : [];
        const activeProviders = cfgList.filter(p => p.isActive && p.apiKey);
        activeProviders.sort((a, b) => (a.priority || 99) - (b.priority || 99));
        setSetting('AI_PROVIDERS_CONFIG', JSON.stringify({ all: cfgList, active: activeProviders }));
        result = { success: true };
        break;

      case 'system_self_check':
      case 'self_check':
        if (!(auth.isSuperAdmin || auth.isAdmin)) return res.json({ success: false, error: "Ruxsat yo'q!" });
        result = runSelfCheck();
        break;

      default:
        result = { success: false, error: `Noma'lum: ${action}` };
    }

    return res.json(result);

  } catch (err) {
    addErrorLog(action, tgId, rawBody, err);
    console.error('[API xatosi]', err);
    return res.json({ success: false, error: String(err.message || err) });
  }
});

// ─────────────────────────────────────────────────────────────
// Handler stubs — full logic to be implemented in subsequent
// route files or inline below
// ─────────────────────────────────────────────────────────────

async function handleInit(tgId, auth, data) {
  const { db } = require('../db');

  // Auto-register pending user if not in list (mirrors autoRegisterPendingUserIfMissing_)
  if (!auth.inList && !auth.isSuperAdmin) {
    try {
      const firstName = String(data.firstName || data.first_name || '');
      const lastName  = String(data.lastName  || data.last_name  || '');
      const uname     = String(data.tgUsername || data.username  || '');
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || uname || `ID:${tgId}`;
      db.prepare(`
        INSERT OR IGNORE INTO employees
          (telegram_id, username, can_add, role)
        VALUES (?, ?, 0, 'PENDING')
      `).run(String(tgId), displayName);
      // Re-resolve auth after possible insert
      const { checkUserRoles } = require('../auth');
      Object.assign(auth, checkUserRoles(tgId));
    } catch (e) { /* ignore */ }
  }

  // User records (non-deleted)
  const userRecords = db.prepare(`
    SELECT * FROM records
    WHERE telegram_id = ? AND is_deleted = 0
    ORDER BY id DESC
  `).all(String(tgId)).map(r => ({
    rowId:        r.id,
    telegramId:   r.telegram_id,
    name:         r.name,
    amountUZS:    r.amount_uzs,
    amountUSD:    r.amount_usd,
    rate:         r.rate,
    comment:      r.comment || '',
    date:         r.date,
    actionPeriod: r.action_period || '',
    status:       r.status || 'Tasdiqlandi'
  }));

  const workflowConfig = db.prepare('SELECT * FROM workflow_steps ORDER BY step_index ASC').all();
  const allPositions   = db.prepare('SELECT * FROM positions ORDER BY position_name ASC').all();
  const employeeList   = getAllEmployees();

  return {
    success:         true,
    inList:          auth.inList,
    username:        auth.username,
    roleKey:         auth.roleKey,
    role:            auth.role,
    isBugalter:      !!auth.isBugalter,
    canAdd:          auth.canAdd,
    isAdmin:         auth.isAdmin,
    isSuperAdmin:    auth.isSuperAdmin,
    isDirector:      !!auth.isDirector,
    isSardor:        !!auth.isSardor,
    permissions:     auth.permissions,
    positions:       auth.positions,
    allPositions,
    workflowConfig,
    isWorkflowStrict: getSetting('WORKFLOW_STRICT_MODE', '0') === '1',
    data:            userRecords,
    employeeList,
    globalSettings:  getGlobalSettingsAll()
  };
}

async function handleAdminInit(tgId, auth) {
  const isAllowed = (auth.isSuperAdmin || auth.isAdmin)
    && !auth.isDirector && !auth.isBugalter
    && auth.roleKey !== 'DIRECTOR' && auth.roleKey !== 'BUGALTER';
  if (!isAllowed) return { success: false, error: "Admin ruxsati yo'q!" };

  const { db } = require('../db');
  return {
    success:         true,
    employees:       getAllEmployees(),
    positions:       db.prepare('SELECT * FROM positions ORDER BY position_name ASC').all(),
    workflowSteps:   db.prepare('SELECT * FROM workflow_steps ORDER BY step_index ASC').all(),
    isWorkflowStrict: getSetting('WORKFLOW_STRICT_MODE', '0') === '1'
  };
}

async function handleAdminGetAll(body, auth) {
  const { db } = require('../db');
  const rows = db.prepare(`
    SELECT * FROM records WHERE is_deleted = 0 ORDER BY id DESC
  `).all();
  return { success: true, data: rows };
}

async function handleAdminEdit(body, tgId, auth) {
  const { db } = require('../db');
  const id = parseInt(body.rowId || body.id, 10);
  if (!id) return { success: false, error: "rowId topilmadi" };
  const rec = db.prepare('SELECT * FROM records WHERE id = ? AND is_deleted = 0').get(id);
  if (!rec) return { success: false, error: "Yozuv topilmadi" };
  db.prepare(`
    UPDATE records SET
      name = ?, amount_uzs = ?, amount_usd = ?, rate = ?,
      comment = ?, date = ?, action_period = ?, status = ?,
      actor_tg_id = ?, actor_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    String(body.name    || rec.name),
    Number(body.amountUZS ?? rec.amount_uzs),
    Number(body.amountUSD ?? rec.amount_usd),
    Number(body.rate      ?? rec.rate),
    String(body.comment   ?? rec.comment   ?? ''),
    String(body.date      || rec.date),
    String(body.actionPeriod ?? rec.action_period ?? ''),
    String(body.status    || rec.status),
    String(tgId),
    String(auth.username || ''),
    id
  );
  return { success: true };
}

async function handleAdminDelete(body, tgId, auth) {
  const { db } = require('../db');
  const id = parseInt(body.rowId || body.id, 10);
  if (!id) return { success: false, error: "rowId topilmadi" };
  db.prepare(`
    UPDATE records SET is_deleted = 1, actor_tg_id = ?, actor_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(String(tgId), String(auth.username || ''), id);
  return { success: true };
}

async function handleAdd(body, auth, tgId) {
  if (!auth.canAdd) return { success: false, error: "Qo'shish ruxsati yo'q!" };
  if (auth.roleKey === 'PENDING') return { success: false, error: "Hisobingiz tasdiqlash jarayonida!" };

  const { db } = require('../db');
  const name      = String(body.name      || auth.username || '');
  const amountUZS = Number(body.amountUZS || 0);
  const amountUSD = Number(body.amountUSD || 0);
  const rate      = Number(body.rate      || 0);
  const comment   = String(body.comment   || '');
  const date      = String(body.date      || new Date().toISOString().slice(0,10));
  const period    = String(body.actionPeriod || '');
  const status    = String(body.status    || 'Tasdiqlandi');

  if (!name) return { success: false, error: "Ism kiritilmagan" };

  const info = db.prepare(`
    INSERT INTO records (name, telegram_id, amount_uzs, amount_usd, rate, comment, date, action_period, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, String(tgId), amountUZS, amountUSD, rate, comment, date, period, status);

  return { success: true, rowId: info.lastInsertRowid };
}

async function handleSelfEdit(body, tgId, auth) {
  const { db } = require('../db');
  const id = parseInt(body.rowId || body.id, 10);
  if (!id) return { success: false, error: "rowId topilmadi" };
  const rec = db.prepare('SELECT * FROM records WHERE id = ? AND telegram_id = ? AND is_deleted = 0').get(id, String(tgId));
  if (!rec) return { success: false, error: "Yozuv topilmadi yoki sizga tegishli emas" };

  // Employees can only edit pending records (not confirmed)
  if (!auth.isSuperAdmin && rec.status === 'Tasdiqlandi') {
    // Check global setting
    const disableEmpEdit = getSetting('DISABLE_EMP_EDIT_DELETE', '0') === '1';
    if (disableEmpEdit) return { success: false, error: "Tahrirlash o'chirilgan" };
  }

  db.prepare(`
    UPDATE records SET
      comment = ?, date = ?, action_period = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND telegram_id = ?
  `).run(
    String(body.comment      ?? rec.comment      ?? ''),
    String(body.date         || rec.date),
    String(body.actionPeriod ?? rec.action_period ?? ''),
    id, String(tgId)
  );
  return { success: true };
}

async function handleSelfDelete(body, tgId, auth) {
  const { db } = require('../db');
  const id = parseInt(body.rowId || body.id, 10);
  if (!id) return { success: false, error: "rowId topilmadi" };
  const rec = db.prepare('SELECT * FROM records WHERE id = ? AND telegram_id = ? AND is_deleted = 0').get(id, String(tgId));
  if (!rec) return { success: false, error: "Yozuv topilmadi yoki sizga tegishli emas" };

  const disableEmpDelete = getSetting('DISABLE_EMP_EDIT_DELETE', '0') === '1';
  if (!auth.isSuperAdmin && disableEmpDelete) return { success: false, error: "O'chirish o'chirilgan" };

  db.prepare(`
    UPDATE records SET is_deleted = 1, actor_tg_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND telegram_id = ?
  `).run(String(tgId), id, String(tgId));
  return { success: true };
}

async function handleAddHodim(body) {
  const { db } = require('../db');
  const { normalizeRole, resolveEmployeeAccess } = require('../auth');

  const tgId    = String(body.tgId    || body.telegramId || '').trim();
  const username = String(body.username || '').trim();
  const role    = normalizeRole(body.role || 'EMPLOYEE', null);

  if (!tgId)    return { success: false, error: "TelegramId kiritilmagan" };
  if (!username) return { success: false, error: "Username kiritilmagan" };

  const access = resolveEmployeeAccess({
    telegram_id: tgId,
    role,
    super_admin:   role === 'SUPER_ADMIN' ? 1 : 0,
    direktor:      role === 'DIRECTOR'    ? 1 : 0,
    admin:         role === 'ADMIN'       ? 1 : 0,
    can_add:       1,
    can_view_all:  0, can_edit: 0, can_delete: 0, can_export: 0, can_view_dash: 0
  });

  try {
    db.prepare(`
      INSERT INTO employees
        (telegram_id, username, can_add, super_admin, direktor, admin,
         can_view_all, can_edit, can_delete, can_export, can_view_dash,
         role, lavozim, guruh, is_sardor)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        username=excluded.username, role=excluded.role,
        can_add=excluded.can_add, super_admin=excluded.super_admin,
        direktor=excluded.direktor, admin=excluded.admin,
        can_view_all=excluded.can_view_all, can_edit=excluded.can_edit,
        can_delete=excluded.can_delete, can_export=excluded.can_export,
        can_view_dash=excluded.can_view_dash,
        lavozim=excluded.lavozim, guruh=excluded.guruh,
        is_sardor=excluded.is_sardor, updated_at=CURRENT_TIMESTAMP
    `).run(
      tgId, username,
      access.canAdd       ? 1 : 0,
      access.isSuperAdmin ? 1 : 0,
      access.isDirektor   ? 1 : 0,
      (access.isAdmin && !access.isSuperAdmin) ? 1 : 0,
      access.permissions.canViewAll  ? 1 : 0,
      access.permissions.canEdit     ? 1 : 0,
      access.permissions.canDelete   ? 1 : 0,
      access.permissions.canExport   ? 1 : 0,
      access.permissions.canViewDash ? 1 : 0,
      access.roleKey,
      String(body.lavozim || ''),
      String(body.guruh   || ''),
      body.isSardor ? 1 : 0
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e.message || e) };
  }
}

async function handleUpdateHodim(body) {
  return handleAddHodim(body); // upsert covers both add and update
}

async function handleDeleteHodim(targetTgId) {
  const { db } = require('../db');
  if (!targetTgId) return { success: false, error: "tgId topilmadi" };
  db.prepare('DELETE FROM employees WHERE telegram_id = ?').run(String(targetTgId));
  return { success: true };
}

function getGlobalSettingsAll() {
  return {
    onlyBugalterAdd:      getSetting('ONLY_BUGALTER_ADD',      '0') === '1',
    disableEmpEditDelete: getSetting('DISABLE_EMP_EDIT_DELETE', '0') === '1',
    notifyDirector:       getSetting('NOTIFY_DIRECTOR',         '0') === '1',
    workflowStrictMode:   getSetting('WORKFLOW_STRICT_MODE',    '0') === '1'
  };
}

function setGlobalSettingHandler(key, val) {
  const { setSetting } = require('../db');
  if (!key) return { success: false, error: 'key topilmadi' };
  setSetting(String(key), val ? '1' : '0');
  return { success: true };
}

function runSelfCheck() {
  const checks = [];
  function addCheck(key, ok, note) { checks.push({ key, ok: !!ok, note: String(note || '') }); }

  const token = String(cfg.BOT_TOKEN || '');
  addCheck('BOT_TOKEN', token && token !== 'YOUR_BOT_TOKEN', token ? 'sozlangan' : 'bo\'sh');

  const chatId = String(cfg.CHAT_ID || '');
  addCheck('CHAT_ID', chatId && chatId !== 'YOUR_TG_CHAT_ID', chatId ? 'sozlangan' : 'bo\'sh');

  const superAdmin = String(cfg.SUPER_ADMIN_ID || '');
  addCheck('SUPER_ADMIN_ID', superAdmin && superAdmin !== 'YOUR_TG_ADMIN_CHAT_ID', superAdmin ? 'sozlangan' : 'bo\'sh');

  const webApp = String(cfg.WEB_APP_URL || '');
  addCheck('WEB_APP_URL', /^https:\/\/.+/i.test(webApp) && !webApp.includes('YOUR.github.io'), webApp || 'bo\'sh');

  addCheck('REQUIRE_TELEGRAM_AUTH', cfg.REQUIRE_TELEGRAM_AUTH === true, String(cfg.REQUIRE_TELEGRAM_AUTH));
  addCheck('AUTH_MAX_AGE_SEC', cfg.AUTH_MAX_AGE_SEC > 0 && cfg.AUTH_MAX_AGE_SEC <= 86400, String(cfg.AUTH_MAX_AGE_SEC));
  addCheck('RATE_LIMIT_ENABLED', cfg.RATE_LIMIT_ENABLED !== false, String(cfg.RATE_LIMIT_ENABLED));
  addCheck('ERROR_ALERT_ENABLED', cfg.ERROR_ALERT_ENABLED !== false, String(cfg.ERROR_ALERT_ENABLED));

  const warningCount = checks.filter(c => !c.ok).length;
  return {
    success: true,
    status:  warningCount === 0 ? 'ok' : 'warn',
    warnings: warningCount,
    checks
  };
}

// ─────────────────────────────────────────────────────────────
// Kvadratlar, Workflow & Positions handlers
// ─────────────────────────────────────────────────────────────

function normalizeKvMonth(val) {
  if (!val) {
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    return '_' + m;
  }
  const clean = String(val).replace(/^_+/, '').replace(/^'/, '').trim();
  const num = parseInt(clean, 10);
  if (!isFinite(num) || num < 1 || num > 12) {
    const m2 = String(new Date().getMonth() + 1).padStart(2, '0');
    return '_' + m2;
  }
  return '_' + String(num).padStart(2, '0');
}

async function handleKvadratGetAll(auth) {
  const { db } = require('../db');
  if (auth && (auth.roleKey === 'PENDING' || !auth.inList)) {
    return { success: true, data: [], isPending: true };
  }

  const rows = db.prepare(`
    SELECT * FROM kvadratlar
    WHERE is_deleted = 0
    ORDER BY id DESC
  `).all();

  const records = rows.map(row => {
    let logs = [];
    try { logs = JSON.parse(row.workflow_logs || '[]'); } catch (e) { logs = []; }
    return {
      rowId: row.id,
      date: row.sana || '',
      no: row.order_no || String(row.id),
      month: String(row.oy || '').replace(/^'/, ''),
      year: String(row.yil || '').replace(/^'/, ''),
      totalM2: Number(row.total_m2) || 0,
      orderName: row.order_name || '',
      staffName: row.staff_name || '',
      ownerTgId: String(row.owner_tg_id || ''),
      currentStep: Number(row.current_step) || 1,
      status: row.status || 'yangi',
      logs: logs
    };
  });

  return { success: true, data: records };
}

async function handleKvadratAdd(body, auth, actorTgId) {
  const { db } = require('../db');
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const monthStr = normalizeKvMonth(body.month);
  const yearStr = String(body.year || now.getFullYear());
  const totalM2 = Number(body.totalM2) || 0;
  const orderName = String(body.orderName || '').trim();
  const staffName = auth.username || body.staffName || 'iRealBy_3D';

  let orderNo = String(body.no || '').trim();
  if (!orderNo) {
    const maxRow = db.prepare('SELECT MAX(id) as maxId FROM kvadratlar').get();
    orderNo = String((maxRow?.maxId || 0) + 1);
  }

  const initialLog = JSON.stringify([{
    step: 1,
    uid: String(actorTgId),
    u: staffName,
    d: now.toISOString()
  }]);

  const info = db.prepare(`
    INSERT INTO kvadratlar (sana, order_no, oy, yil, total_m2, order_name, staff_name, owner_tg_id, current_step, status, workflow_logs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'yangi', ?)
  `).run(dateStr, orderNo, monthStr, yearStr, totalM2, orderName, staffName, String(actorTgId), initialLog);

  return { success: true, rowId: Number(info.lastInsertRowid) };
}

async function handleKvadratEdit(body, auth, actorTgId) {
  const { db } = require('../db');
  const rowId = parseInt(body.rowId, 10);
  if (!rowId) return { success: false, error: "Buyurtma topilmadi" };

  const existing = db.prepare('SELECT * FROM kvadratlar WHERE id = ?').get(rowId);
  if (!existing) return { success: false, error: "Buyurtma topilmadi" };

  const isOwner = String(existing.owner_tg_id) === String(actorTgId);
  const canEdit = auth.isSuperAdmin || (auth.isAdmin && auth.permissions?.canEdit) || (isOwner && auth.permissions?.canEdit !== false);
  if (!canEdit) return { success: false, error: "Sizda buyurtmani tahrirlash ruxsati yo'q!" };

  const totalM2 = Number(body.totalM2) || existing.total_m2;
  const orderNo = String(body.no || existing.order_no || '').trim();
  const orderName = String(body.orderName || existing.order_name || '').trim();
  const staffName = body.staffName || existing.staff_name;
  const monthStr = body.month ? normalizeKvMonth(body.month) : existing.oy;
  const yearStr = body.year ? String(body.year) : existing.yil;

  db.prepare(`
    UPDATE kvadratlar
    SET total_m2 = ?, order_no = ?, order_name = ?, staff_name = ?, oy = ?, yil = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(totalM2, orderNo, orderName, staffName, monthStr, yearStr, rowId);

  return { success: true };
}

async function handleKvadratDelete(body, auth, actorTgId) {
  const { db } = require('../db');
  const rowId = parseInt(body.rowId, 10);
  if (!rowId) return { success: false, error: "Buyurtma topilmadi" };

  const existing = db.prepare('SELECT * FROM kvadratlar WHERE id = ?').get(rowId);
  if (!existing) return { success: false, error: "Buyurtma topilmadi" };

  const isOwner = String(existing.owner_tg_id) === String(actorTgId);
  const canDelete = auth.isSuperAdmin || (auth.isAdmin && auth.permissions?.canDelete) || (isOwner && auth.permissions?.canDelete !== false);
  if (!canDelete) return { success: false, error: "Sizda buyurtmani o'chirish ruxsati yo'q!" };

  db.prepare('UPDATE kvadratlar SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(rowId);
  return { success: true };
}

async function handleKvadratClaim(body, auth, actorTgId) {
  const { db } = require('../db');
  const rowId = parseInt(body.rowId, 10);
  if (!rowId) return { success: false, error: "Buyurtma topilmadi" };

  const existing = db.prepare('SELECT * FROM kvadratlar WHERE id = ? AND is_deleted = 0').get(rowId);
  if (!existing) return { success: false, error: "Buyurtma topilmadi" };

  let logs = [];
  try { logs = JSON.parse(existing.workflow_logs || '[]'); } catch (e) { logs = []; }

  const steps = db.prepare('SELECT * FROM workflow_steps ORDER BY step_index ASC').all();
  const currentStepIdx = Number(existing.current_step) || 1;
  const targetStepIdx = body.targetStepIndex ? Number(body.targetStepIndex) : currentStepIdx + 1;

  const stepToProcess = steps.find(s => s.step_index === targetStepIdx);
  if (!stepToProcess) return { success: false, error: "Bajariladigan bosqich topilmadi" };

  if (logs.some(l => l.step === stepToProcess.step_index)) {
    return { success: false, error: "Ushbu bosqich avval tasdiqlangan" };
  }

  const userPositions = (auth.positions || []).map(p => String(p).trim().toLowerCase());
  const stepPos = String(stepToProcess.position_name).trim().toLowerCase();
  const hasPos = userPositions.includes(stepPos);
  if (!auth.isSuperAdmin && !hasPos) {
    return { success: false, error: `Sizda "${stepToProcess.position_name}" lavozimi yo'q` };
  }

  const now = new Date();
  logs.push({
    step: stepToProcess.step_index,
    uid: String(actorTgId),
    u: auth.username || 'iRealBy_3D',
    d: now.toISOString(),
    group: auth.group || ''
  });
  logs.sort((a, b) => Number(a.step) - Number(b.step));

  const maxStep = logs.reduce((m, l) => Math.max(m, Number(l.step) || 0), 0);
  const latestStep = steps.find(s => s.step_index === maxStep);

  db.prepare(`
    UPDATE kvadratlar
    SET current_step = ?, status = ?, workflow_logs = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    latestStep ? latestStep.step_index : existing.current_step,
    latestStep ? latestStep.status_label : existing.status,
    JSON.stringify(logs),
    rowId
  );

  return { success: true };
}

async function handleKvadratRevert(body, auth, actorTgId) {
  const { db } = require('../db');
  const rowId = parseInt(body.rowId, 10);
  if (!rowId) return { success: false, error: "Buyurtma topilmadi" };

  const existing = db.prepare('SELECT * FROM kvadratlar WHERE id = ? AND is_deleted = 0').get(rowId);
  if (!existing) return { success: false, error: "Buyurtma topilmadi" };

  let logs = [];
  try { logs = JSON.parse(existing.workflow_logs || '[]'); } catch (e) { logs = []; }
  if (!logs.length) return { success: false, error: "Tarixda bosqich topilmadi" };

  if (body.targetStepIndex) {
    const tIdx = Number(body.targetStepIndex);
    logs = logs.filter(l => Number(l.step) < tIdx);
  } else {
    logs.pop();
  }

  const steps = db.prepare('SELECT * FROM workflow_steps ORDER BY step_index ASC').all();
  const maxStep = logs.reduce((m, l) => Math.max(m, Number(l.step) || 0), 1);
  const latestStep = steps.find(s => s.step_index === maxStep);

  db.prepare(`
    UPDATE kvadratlar
    SET current_step = ?, status = ?, workflow_logs = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    latestStep ? latestStep.step_index : 1,
    latestStep ? latestStep.status_label : 'yangi',
    JSON.stringify(logs),
    rowId
  );

  return { success: true };
}

async function handleForceReassignStep(body, auth) {
  if (!auth.isSuperAdmin) return { success: false, error: "Faqat SuperAdmin o'zgartira oladi" };
  const { db } = require('../db');
  const rowId = parseInt(body.rowId, 10);
  const stepIdx = parseInt(body.stepIndex, 10);
  if (!rowId || !stepIdx) return { success: false, error: "Parametrlar yetarli emas" };

  const existing = db.prepare('SELECT * FROM kvadratlar WHERE id = ?').get(rowId);
  if (!existing) return { success: false, error: "Buyurtma topilmadi" };

  let logs = [];
  try { logs = JSON.parse(existing.workflow_logs || '[]'); } catch (e) { logs = []; }
  
  const existingLog = logs.find(l => l.step === stepIdx);
  if (existingLog) {
    existingLog.u = body.staffName || existingLog.u;
    existingLog.uid = String(body.staffTgId || existingLog.uid);
  } else {
    logs.push({
      step: stepIdx,
      uid: String(body.staffTgId || ''),
      u: body.staffName || 'Admin',
      d: new Date().toISOString()
    });
  }
  logs.sort((a, b) => Number(a.step) - Number(b.step));

  db.prepare('UPDATE kvadratlar SET workflow_logs = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(logs), rowId);
  return { success: true };
}

async function handleWorkflowGetConfig() {
  const { db } = require('../db');
  const steps = db.prepare('SELECT * FROM workflow_steps ORDER BY step_index ASC').all();
  return { success: true, config: steps };
}

async function handleWorkflowSaveConfig(steps, auth) {
  if (!auth.isSuperAdmin) return { success: false, error: "Faqat SuperAdmin oqimni saqlay oladi" };
  const { db } = require('../db');
  if (!Array.isArray(steps)) return { success: false, error: "Noto'g'ri format" };

  db.exec('DELETE FROM workflow_steps;');
  const stmt = db.prepare(`
    INSERT INTO workflow_steps (step_index, position_name, action_label, status_label, is_start, is_end)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  steps.forEach((s, idx) => {
    stmt.run(
      idx + 1,
      String(s.position || s.position_name || '').trim(),
      String(s.action || s.action_label || '').trim(),
      String(s.status || s.status_label || '').trim(),
      s.isStart ? 1 : 0,
      s.isEnd ? 1 : 0
    );
  });

  return { success: true };
}

async function handleWorkflowSaveSettings(body, auth) {
  if (!auth.isSuperAdmin) return { success: false, error: "Faqat SuperAdmin o'zgartira oladi" };
  const { setSetting } = require('../db');
  const isStrict = body.isWorkflowStrict === true || body.isWorkflowStrict === 'true';
  setSetting('WORKFLOW_STRICT_MODE', isStrict ? '1' : '0');
  return { success: true };
}

async function handlePositionsGetAll() {
  const { db } = require('../db');
  const positions = db.prepare('SELECT * FROM positions ORDER BY position_name ASC').all().map(p => ({
    id: p.id,
    name: p.position_name,
    icon: p.icon || '💼'
  }));
  return { success: true, positions };
}

async function handlePositionsSaveAll(positions, auth) {
  if (!auth.isSuperAdmin) return { success: false, error: "Faqat SuperAdmin lavozimlarni saqlay oladi" };
  const { db } = require('../db');
  if (!Array.isArray(positions)) return { success: false, error: "Noto'g'ri format" };

  db.exec('DELETE FROM positions;');
  const stmt = db.prepare('INSERT OR IGNORE INTO positions (position_name, icon) VALUES (?, ?)');
  positions.forEach(p => {
    if (p.name && p.name.trim()) {
      stmt.run(p.name.trim(), p.icon || '💼');
    }
  });

  return { success: true };
}

module.exports = router;
