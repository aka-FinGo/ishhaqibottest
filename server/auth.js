// ============================================================
// AUTH.JS — Telegram Auth + Role System
// Replicates GS_Auth.gs and Code.gs auth logic exactly
// ============================================================
'use strict';

const crypto = require('crypto');
const { getEmployee, getSetting } = require('./db');

// ── Config (lazy-loaded to avoid circular deps) ───────────────
function _cfg() {
  return require('./config');
}

// ─────────────────────────────────────────────────────────────
// validateTelegramAuth
// Replicates validateTelegramAuth() from Code.gs
// ─────────────────────────────────────────────────────────────
function validateTelegramAuth(data, botToken, requireAuth) {
  const _requireAuth = (requireAuth !== undefined)
    ? requireAuth
    : _cfg().REQUIRE_TELEGRAM_AUTH;

  const initData = data && data.initData ? String(data.initData) : '';
  const tgId     = data && data.telegramId ? String(data.telegramId) : '';

  if (!initData) {
    if (_requireAuth) {
      return { success: false, error: 'Telegram auth topilmadi' };
    }
    return { success: true };
  }

  const verified = verifyTelegramInitData(initData, botToken || _cfg().BOT_TOKEN, tgId);
  if (!verified.success) return verified;
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// verifyTelegramInitData
// Replicates verifyTelegramInitData_() from Code.gs
// Uses Node.js built-in crypto (no external deps)
// ─────────────────────────────────────────────────────────────
function verifyTelegramInitData(initData, botToken, expectedTgId) {
  if (!botToken) return { success: false, error: 'BOT_TOKEN sozlanmagan' };

  const params = _parseInitData(initData);
  const theirHash = params.hash;
  if (!theirHash) return { success: false, error: 'Telegram hash topilmadi' };
  delete params.hash;

  // Build data-check-string (sorted keys, joined with \n)
  const dataCheckString = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('\n');

  // HMAC-SHA256: secret = HMAC(botToken, "WebAppData")
  // Then: hash = HMAC(dataCheckString, secret)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calcHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calcHash !== String(theirHash).toLowerCase()) {
    return { success: false, error: 'Telegram auth xato (hash mismatch)' };
  }

  // Check auth_date expiry
  const maxAge = Number(_cfg().AUTH_MAX_AGE_SEC || 0);
  if (maxAge > 0 && params.auth_date) {
    const nowSec  = Math.floor(Date.now() / 1000);
    const authSec = Number(params.auth_date);
    if (isFinite(authSec) && nowSec - authSec > maxAge) {
      return { success: false, error: 'Telegram auth eskirgan' };
    }
  }

  // Validate telegram_id if provided
  if (expectedTgId && params.user) {
    try {
      const userObj = JSON.parse(params.user);
      if (String(userObj.id) !== String(expectedTgId)) {
        return { success: false, error: 'Telegram foydalanuvchi mos emas' };
      }
    } catch (e) {
      return { success: false, error: 'Telegram user format xato' };
    }
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// checkUserRoles
// Replicates checkUserRoles() from GS_Auth.gs
// ─────────────────────────────────────────────────────────────
function checkUserRoles(tgId) {
  const cfg = _cfg();

  // Default auth object (unknown / not-in-list user)
  const auth = {
    role:        'User',
    roleKey:     'EMPLOYEE',
    username:    '',
    isAdmin:     false,
    isBoss:      false,
    isDirector:  false,
    isSuperAdmin: false,
    isBugalter:  false,
    inList:      false,
    canAdd:      true,
    permissions: {
      canViewAll:  false,
      canEdit:     false,
      canDelete:   false,
      canExport:   false,
      canViewDash: false
    },
    positions: [],
    group:     '',
    isSardor:  false
  };

  // Look up in DB first
  const emp = getEmployee(tgId);
  if (!emp) {
    if (isConfigSuperAdmin(tgId)) {
      auth.username    = String(cfg.SUPER_ADMIN_NAME || 'SuperAdmin');
      auth.role        = 'SuperAdmin';
      auth.roleKey     = 'SUPER_ADMIN';
      auth.isSuperAdmin = true;
      auth.isAdmin     = true;
      auth.isBoss      = true;
      auth.inList      = true;
      auth.canAdd      = true;
      auth.permissions = {
        canViewAll: true, canEdit: true, canDelete: true,
        canExport:  true, canViewDash: true
      };
      return auth;
    }
    auth.canAdd = false;
    return auth;
  }

  const isSuper = emp.isSuperAdmin || isConfigSuperAdmin(tgId);

  auth.inList      = true;
  auth.username    = emp.username;
  auth.canAdd      = isSuper ? true : emp.canAdd;
  auth.role        = isSuper ? 'SuperAdmin' : emp.role;
  auth.roleKey     = isSuper ? 'SUPER_ADMIN' : emp.roleKey;
  auth.isSuperAdmin = isSuper;
  auth.isDirector  = emp.isDirektor;
  auth.isAdmin     = isSuper ? true : emp.isAdmin;
  auth.isBugalter  = emp.isBugalter || emp.roleKey === 'BUGALTER';
  auth.isBoss      = isSuper;
  auth.permissions = isSuper
    ? { canViewAll: true, canEdit: true, canDelete: true, canExport: true, canViewDash: true }
    : emp.permissions;
  auth.positions   = emp.positions || [];
  auth.group       = emp.group || '';
  auth.isSardor    = !!emp.isSardor;

  return auth;
}

// ─────────────────────────────────────────────────────────────
// isConfigSuperAdmin
// Replicates isConfigSuperAdminId_() from GS_Auth.gs
// ─────────────────────────────────────────────────────────────
function isConfigSuperAdmin(tgId) {
  const cfg = _cfg();
  const adminId = String(cfg.SUPER_ADMIN_ID || '').trim();
  if (!adminId || adminId === 'YOUR_TG_ADMIN_CHAT_ID') return false;
  return String(tgId || '').trim() === adminId;
}

// ─────────────────────────────────────────────────────────────
// resolveEmployeeAccess
// Replicates resolveEmployeeAccessFromRow_() + normalizeRole_()
// from GS_Auth.gs — used when building employee records
// ─────────────────────────────────────────────────────────────
function resolveEmployeeAccess(empRow) {
  // empRow can be a raw DB row or an object with named fields
  const tgId      = String(empRow.telegram_id || empRow.tgId || '').trim();
  const isSuper   = isConfigSuperAdmin(tgId) || empRow.super_admin === 1;
  const role      = isSuper ? 'SUPER_ADMIN' : normalizeRole(empRow.role, empRow);

  const canAdd    = isSuper ? true : (empRow.can_add === 1);
  const perms     = isSuper
    ? { canViewAll: true, canEdit: true, canDelete: true, canExport: true, canViewDash: true }
    : {
        canViewAll:  empRow.can_view_all  === 1,
        canEdit:     empRow.can_edit      === 1,
        canDelete:   empRow.can_delete    === 1,
        canExport:   empRow.can_export    === 1,
        canViewDash: empRow.can_view_dash === 1
      };

  const isSuperAdmin = isSuper;
  const isDirektor   = !isSuper && (role === 'DIRECTOR' || empRow.direktor === 1);
  const isAdmin      = isSuper || role === 'ADMIN' || empRow.admin === 1;
  const isBugalter   = !isSuper && role === 'BUGALTER';

  return {
    roleKey:    isSuperAdmin ? 'SUPER_ADMIN' : role,
    roleLabel:  _roleLabelFromKey(isSuperAdmin ? 'SUPER_ADMIN' : role),
    canAdd,
    isSuperAdmin,
    isDirektor,
    isAdmin,
    isBugalter,
    permissions: perms
  };
}

// ─────────────────────────────────────────────────────────────
// normalizeRole
// Replicates normalizeRole_() from GS_Auth.gs
// ─────────────────────────────────────────────────────────────
function normalizeRole(value, rowForFallback) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (raw === 'DIRECTOR'    || raw === 'DIREKTOR')   return 'DIRECTOR';
  if (raw === 'ADMIN')                               return 'ADMIN';
  if (raw === 'BUGALTER'    || raw === 'ACCOUNTANT') return 'BUGALTER';
  if (raw === 'PENDING'     || raw === 'KUTILMOQDA') return 'PENDING';
  if (raw === 'EMPLOYEE'    || raw === 'USER' || raw === 'XODIM') return 'EMPLOYEE';
  // Legacy fallback: derive from boolean columns
  if (rowForFallback) return _deriveLegacyRole(rowForFallback);
  return 'EMPLOYEE';
}

// ─────────────────────────────────────────────────────────────
// roleDefaults
// Replicates roleDefaults_() from GS_Auth.gs
// ─────────────────────────────────────────────────────────────
function roleDefaults(roleKey) {
  const role = normalizeRole(roleKey, null);
  if (role === 'SUPER_ADMIN') {
    return { canAdd: true, permissions: { canViewAll:true, canEdit:true, canDelete:true, canExport:true, canViewDash:true } };
  }
  if (role === 'DIRECTOR') {
    return { canAdd: true, permissions: { canViewAll:true, canEdit:false, canDelete:false, canExport:true, canViewDash:true } };
  }
  if (role === 'ADMIN') {
    return { canAdd: true, permissions: { canViewAll:true, canEdit:false, canDelete:false, canExport:false, canViewDash:false } };
  }
  if (role === 'BUGALTER') {
    return { canAdd: true, permissions: { canViewAll:true, canEdit:false, canDelete:false, canExport:true, canViewDash:true } };
  }
  if (role === 'PENDING') {
    return { canAdd: false, permissions: { canViewAll:false, canEdit:false, canDelete:false, canExport:false, canViewDash:false } };
  }
  // EMPLOYEE (default)
  return { canAdd: true, permissions: { canViewAll:false, canEdit:true, canDelete:true, canExport:false, canViewDash:false } };
}

// ── Private helpers ───────────────────────────────────────────

function _parseInitData(raw) {
  const out = {};
  if (!raw) return out;
  for (const pair of String(raw).split('&')) {
    if (!pair) continue;
    const eq  = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const val = eq >= 0 ? pair.slice(eq + 1) : '';
    out[_decodeURIComponent(key)] = _decodeURIComponent(val);
  }
  return out;
}

function _decodeURIComponent(s) {
  try {
    return decodeURIComponent(String(s).replace(/\+/g, '%20'));
  } catch (e) {
    return String(s);
  }
}

function _roleLabelFromKey(roleKey) {
  if (roleKey === 'SUPER_ADMIN') return 'SuperAdmin';
  if (roleKey === 'DIRECTOR')    return 'Direktor';
  if (roleKey === 'ADMIN')       return 'Admin';
  if (roleKey === 'BUGALTER')    return 'Bugalter';
  if (roleKey === 'PENDING')     return 'Kutilmoqda';
  return 'Xodim';
}

function _deriveLegacyRole(row) {
  if (isConfigSuperAdmin(row.telegram_id || row.tgId)) return 'SUPER_ADMIN';
  if (row.super_admin === 1) return 'SUPER_ADMIN';
  if (row.direktor    === 1) return 'DIRECTOR';
  if (row.admin       === 1) return 'ADMIN';
  return 'EMPLOYEE';
}

// ─────────────────────────────────────────────────────────────
module.exports = {
  validateTelegramAuth,
  verifyTelegramInitData,
  checkUserRoles,
  isConfigSuperAdmin,
  resolveEmployeeAccess,
  normalizeRole,
  roleDefaults
};
