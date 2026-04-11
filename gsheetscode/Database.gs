// ============================================================
// DATABASE.GS
// ============================================================
// "Hodimlar" sheet ustunlari (0-based):
// Legacy (0..10):
//  0:TelegramId | 1:Username | 2:CanAdd
//  3:SuperAdmin | 4:Direktor | 5:Admin
//  6:canViewAll | 7:canEdit  | 8:canDelete
//  9:canExport  | 10:canViewDash
// New model (11..17):
//  11:Role
//  12:OverrideCanAdd
//  13:OverrideViewAll
//  14:OverrideEdit
//  15:OverrideDelete
//  16:OverrideExport
//  17:OverrideViewDash
// ============================================================

var COL = {
  TG_ID:        0,
  USERNAME:     1,
  CAN_ADD:      2,
  SUPER_ADMIN:  3,
  DIREKTOR:     4,
  ADMIN:        5,
  VIEW_ALL:     6,
  EDIT:         7,
  DELETE:       8,
  EXPORT:       9,
  VIEW_DASH:    10,
  ROLE:         11,
  OVR_CAN_ADD:  12,
  OVR_VIEW_ALL: 13,
  OVR_EDIT:     14,
  OVR_DELETE:   15,
  OVR_EXPORT:   16,
  OVR_VIEW_DASH:17
};

var DATA_COL = {
  NAME: 0,
  TG_ID: 1,
  AMOUNT_UZS: 2,
  AMOUNT_USD: 3,
  RATE: 4,
  COMMENT: 5,
  DATE: 6,
  IS_DELETED: 7,
  ACTION_PERIOD: 8
};

var _MEMO = {
  sheets: null,
  empRows: null,
  usernameMap: null
};

var EMP_HEADERS = [
  "TelegramId","Username","CanAdd",
  "SuperAdmin","Direktor","Admin",
  "canViewAll","canEdit","canDelete","canExport","canViewDash",
  "Role","OverrideCanAdd","OverrideViewAll","OverrideEdit","OverrideDelete","OverrideExport","OverrideViewDash"
];

function getSheets() {
  if (_MEMO.sheets) return _MEMO.sheets;

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Data sheet — birinchi varaq
  var dataSheet = ss.getSheets()[0];
  ensureDataInfrastructure_(dataSheet);

  // Hodimlar sheet — yo'q bo'lsa yaratadi
  var empSheet = ss.getSheetByName("Hodimlar");
  if (!empSheet) {
    empSheet = ss.insertSheet("Hodimlar");
    empSheet.appendRow(EMP_HEADERS);
    empSheet.getRange(1,1,1,EMP_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#1e3c72")
      .setFontColor("#ffffff");

    // SuperAdmin ni avtomatik qo'shish (Config.gs dan)
    if (CONFIG.SUPER_ADMIN_ID && CONFIG.SUPER_ADMIN_NAME) {
      empSheet.appendRow([
        CONFIG.SUPER_ADMIN_ID, CONFIG.SUPER_ADMIN_NAME,
        1, 1, 0, 0, 1, 1, 1, 1, 1,
        'SUPER_ADMIN', 1, 1, 1, 1, 1, 1
      ]);
    }
  }

  ensureEmployeeInfrastructure_(empSheet);
  _MEMO.sheets = { dataSheet: dataSheet, empSheet: empSheet };
  return _MEMO.sheets;
}

function ensureEmployeeInfrastructure_(empSheet) {
  if (!empSheet) return;
  var requiredCols = EMP_HEADERS.length;
  if (empSheet.getMaxColumns() < requiredCols) {
    empSheet.insertColumnsAfter(empSheet.getMaxColumns(), requiredCols - empSheet.getMaxColumns());
  }

  var currentHeaders = empSheet.getRange(1, 1, 1, requiredCols).getValues()[0];
  var nextHeaders = [];
  for (var i = 0; i < requiredCols; i++) {
    nextHeaders.push(EMP_HEADERS[i]);
  }
  var needHeaderWrite = false;
  for (var j = 0; j < requiredCols; j++) {
    if (String(currentHeaders[j] || '') !== EMP_HEADERS[j]) {
      needHeaderWrite = true;
      break;
    }
  }
  if (needHeaderWrite) {
    empSheet.getRange(1, 1, 1, requiredCols).setValues([nextHeaders]);
  }

  synchronizeEmployeeRowsToV2_(empSheet, false);
}

function migrateHodimlarToV2(hideLegacyColumns) {
  var sh = getSheets().empSheet;
  ensureEmployeeInfrastructure_(sh);
  return synchronizeEmployeeRowsToV2_(sh, hideLegacyColumns !== false);
}

function synchronizeEmployeeRowsToV2_(empSheet, hideLegacyColumns) {
  if (!empSheet) return { success:false, error:'Hodimlar sheet topilmadi' };
  var requiredCols = EMP_HEADERS.length;
  var lastRow = empSheet.getLastRow();
  if (lastRow < 2) {
    if (hideLegacyColumns) {
      try { empSheet.hideColumns(COL.CAN_ADD + 1, (COL.VIEW_DASH - COL.CAN_ADD + 1)); } catch (ignore) {}
      try { empSheet.showColumns(COL.ROLE + 1, (COL.OVR_VIEW_DASH - COL.ROLE + 1)); } catch (ignore2) {}
    }
    return { success:true, changedRows:0, totalRows:0 };
  }

  var range = empSheet.getRange(2, 1, lastRow - 1, requiredCols);
  var rows = range.getValues();
  var changedRows = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var before = row.slice();
    var tgId = String(row[COL.TG_ID] || '').trim();
    if (!tgId) continue;

    var current = resolveEmployeeAccessFromRow_(row);
    var role = normalizeRole_(row[COL.ROLE], row);
    var overrides = deriveOverridesForEffective_(role, current.canAdd, current.permissions);
    var model = buildModelFromRoleAndOverrides_(role, overrides);

    row[COL.CAN_ADD] = model.canAdd ? 1 : 0;
    row[COL.SUPER_ADMIN] = model.isSuperAdmin ? 1 : 0;
    row[COL.DIREKTOR] = model.isDirektor ? 1 : 0;
    row[COL.ADMIN] = (model.isAdmin && !model.isSuperAdmin) ? 1 : 0;
    row[COL.VIEW_ALL] = model.permissions.canViewAll ? 1 : 0;
    row[COL.EDIT] = model.permissions.canEdit ? 1 : 0;
    row[COL.DELETE] = model.permissions.canDelete ? 1 : 0;
    row[COL.EXPORT] = model.permissions.canExport ? 1 : 0;
    row[COL.VIEW_DASH] = model.permissions.canViewDash ? 1 : 0;

    row[COL.ROLE] = model.roleKey;
    row[COL.OVR_CAN_ADD] = overrideToCellValue_(model.overrides.canAdd);
    row[COL.OVR_VIEW_ALL] = overrideToCellValue_(model.overrides.canViewAll);
    row[COL.OVR_EDIT] = overrideToCellValue_(model.overrides.canEdit);
    row[COL.OVR_DELETE] = overrideToCellValue_(model.overrides.canDelete);
    row[COL.OVR_EXPORT] = overrideToCellValue_(model.overrides.canExport);
    row[COL.OVR_VIEW_DASH] = overrideToCellValue_(model.overrides.canViewDash);

    for (var c = 0; c < requiredCols; c++) {
      if (String(before[c]) !== String(row[c])) {
        changedRows++;
        break;
      }
    }
  }

  if (changedRows > 0) {
    range.setValues(rows);
  }

  if (hideLegacyColumns) {
    try { empSheet.hideColumns(COL.CAN_ADD + 1, (COL.VIEW_DASH - COL.CAN_ADD + 1)); } catch (ignore3) {}
    try { empSheet.showColumns(COL.ROLE + 1, (COL.OVR_VIEW_DASH - COL.ROLE + 1)); } catch (ignore4) {}
  }

  return { success:true, changedRows:changedRows, totalRows:rows.length };
}

function ensureDataInfrastructure_(dataSheet) {
  if (!dataSheet) return;
  if (dataSheet.getMaxColumns() < 9) {
    dataSheet.insertColumnsAfter(dataSheet.getMaxColumns(), 9 - dataSheet.getMaxColumns());
  }

  var header = dataSheet.getRange(1, 1, 1, 9).getValues()[0];
  if (!header[DATA_COL.IS_DELETED]) {
    dataSheet.getRange(1, DATA_COL.IS_DELETED + 1).setValue('IsDeleted');
  }
  if (!header[DATA_COL.ACTION_PERIOD]) {
    dataSheet.getRange(1, DATA_COL.ACTION_PERIOD + 1).setValue('Davri');
  }
}

function getAuditSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('AuditLog');
  if (!sh) {
    sh = ss.insertSheet('AuditLog');
    sh.appendRow(['Timestamp', 'ActorTgId', 'Action', 'RowId', 'Before', 'After', 'Note']);
    sh.getRange(1, 1, 1, 7).setFontWeight('bold');
  }
  return sh;
}

function addAuditLog_(actorTgId, action, rowId, beforeObj, afterObj, note) {
  var sh = getAuditSheet_();
  sh.appendRow([
    new Date(),
    String(actorTgId || ''),
    String(action || ''),
    String(rowId || ''),
    JSON.stringify(beforeObj || {}),
    JSON.stringify(afterObj || {}),
    String(note || '')
  ]);
}

function getEmployeeRows_() {
  if (_MEMO.empRows) return _MEMO.empRows;
  _MEMO.empRows = getSheets().empSheet.getDataRange().getValues();
  return _MEMO.empRows;
}

function resetEmployeeCache_() {
  _MEMO.empRows = null;
  _MEMO.usernameMap = null;
}

function isDeletedRow_(row) {
  var mark = row[DATA_COL.IS_DELETED];
  if (mark === 1 || mark === true) return true;
  var s = String(mark || '').toLowerCase().trim();
  return s === '1' || s === 'true' || s === 'yes';
}

function rowToRecordForAudit_(row) {
  return {
    name: String(row[DATA_COL.NAME] || ''),
    telegramId: String(row[DATA_COL.TG_ID] || ''),
    amountUZS: Number(row[DATA_COL.AMOUNT_UZS]) || 0,
    amountUSD: Number(row[DATA_COL.AMOUNT_USD]) || 0,
    rate: Number(row[DATA_COL.RATE]) || 0,
    comment: String(row[DATA_COL.COMMENT] || ''),
    date: formatDateCell(row[DATA_COL.DATE]),
    actionPeriod: String(row[DATA_COL.ACTION_PERIOD] || ''),
    isDeleted: Number(row[DATA_COL.IS_DELETED]) || 0
  };
}

function withWriteLock_(handler) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success:false, error:"Server band. 2-3 soniyadan keyin qayta urinib ko'ring." };
  }
  try {
    return handler();
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function toPositiveInt_(value, defaultValue, minValue, maxValue) {
  var n = parseInt(value, 10);
  if (!isFinite(n) || n < minValue) return defaultValue;
  if (n > maxValue) return maxValue;
  return n;
}

function normalizeFilterText_(value) {
  return String(value || '').toLowerCase().trim();
}

function normalizeReason_(value) {
  var reason = String(value || '').trim();
  if (!reason) return '';
  if (reason.length > 300) reason = reason.slice(0, 300);
  return reason;
}

function getConfigSuperAdminId_() {
  return String((CONFIG && CONFIG.SUPER_ADMIN_ID) || '').trim();
}

function isConfigSuperAdminId_(tgId) {
  var cfg = getConfigSuperAdminId_();
  if (!cfg) return false;
  return String(tgId || '').trim() === cfg;
}

function matchesAdminFilters_(name, comment, dateMeta, actionPeriod, filters) {
  var f = filters || {};
  var employee = String(f.employee || 'all');
  var month = String(f.month || 'all');
  var year = String(f.year || 'all');
  var query = normalizeFilterText_(f.query);

  if (employee !== 'all' && name !== employee) return false;

  if (query) {
    var n = normalizeFilterText_(name);
    var c = normalizeFilterText_(comment);
    if (n.indexOf(query) < 0 && c.indexOf(query) < 0) return false;
  }

  if (month !== 'all' || year !== 'all') {
    var rYear = null, rMonth = null;
    if (actionPeriod) {
        var parts = actionPeriod.split('-');
        if (parts.length === 2) { rYear = parts[0]; rMonth = parts[1]; }
    } else if (dateMeta) {
        rYear = dateMeta.year; rMonth = dateMeta.month;
    }

    if (!rYear && !rMonth) return false;
    if (month !== 'all' && rMonth !== month) return false;
    if (year !== 'all' && rYear !== year) return false;
  }

  return true;
}

function toBool01_(value) {
  if (value === true || value === 1) return true;
  var s = String(value || '').toLowerCase().trim();
  return s === '1' || s === 'true' || s === 'yes';
}

function parseOverrideBit_(value) {
  if (value === null || value === undefined) return null;
  var s = String(value).trim();
  if (s === '') return null;
  return toBool01_(value);
}

function deriveLegacyRoleFromRow_(row) {
  if (isConfigSuperAdminId_(row[COL.TG_ID])) return 'SUPER_ADMIN';
  if (toBool01_(row[COL.SUPER_ADMIN])) return 'SUPER_ADMIN';
  if (toBool01_(row[COL.DIREKTOR])) return 'DIRECTOR';
  if (toBool01_(row[COL.ADMIN])) return 'ADMIN';
  return 'EMPLOYEE';
}

function normalizeRole_(value, rowForFallback) {
  var raw = String(value || '').trim().toUpperCase();
  if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (raw === 'DIRECTOR' || raw === 'DIREKTOR') return 'DIRECTOR';
  if (raw === 'ADMIN') return 'ADMIN';
  if (raw === 'EMPLOYEE' || raw === 'USER') return 'EMPLOYEE';
  return rowForFallback ? deriveLegacyRoleFromRow_(rowForFallback) : 'EMPLOYEE';
}

function roleLabelFromKey_(roleKey) {
  if (roleKey === 'SUPER_ADMIN') return 'SuperAdmin';
  if (roleKey === 'DIRECTOR') return 'Direktor';
  if (roleKey === 'ADMIN') return 'Admin';
  return 'User';
}

function roleDefaults_(roleKey) {
  var role = normalizeRole_(roleKey, null);
  if (role === 'SUPER_ADMIN') {
    return {
      canAdd: true,
      permissions: { canViewAll:true, canEdit:true, canDelete:true, canExport:true, canViewDash:true }
    };
  }
  if (role === 'DIRECTOR') {
    return {
      canAdd: true,
      permissions: { canViewAll:true, canEdit:false, canDelete:false, canExport:true, canViewDash:true }
    };
  }
  if (role === 'ADMIN') {
    return {
      canAdd: true,
      permissions: { canViewAll:true, canEdit:false, canDelete:false, canExport:false, canViewDash:false }
    };
  }
  return {
    canAdd: true,
    permissions: { canViewAll:false, canEdit:false, canDelete:false, canExport:false, canViewDash:false }
  };
}

function deriveOverridesForEffective_(roleKey, effectiveCanAdd, effectivePerms) {
  var defaults = roleDefaults_(roleKey);
  var perms = effectivePerms || {};
  return {
    canAdd: (effectiveCanAdd === defaults.canAdd) ? null : !!effectiveCanAdd,
    canViewAll: (Boolean(perms.canViewAll) === defaults.permissions.canViewAll) ? null : Boolean(perms.canViewAll),
    canEdit: (Boolean(perms.canEdit) === defaults.permissions.canEdit) ? null : Boolean(perms.canEdit),
    canDelete: (Boolean(perms.canDelete) === defaults.permissions.canDelete) ? null : Boolean(perms.canDelete),
    canExport: (Boolean(perms.canExport) === defaults.permissions.canExport) ? null : Boolean(perms.canExport),
    canViewDash: (Boolean(perms.canViewDash) === defaults.permissions.canViewDash) ? null : Boolean(perms.canViewDash)
  };
}

function buildModelFromRoleAndOverrides_(roleKey, overrides) {
  var role = normalizeRole_(roleKey, null);
  var defaults = roleDefaults_(role);
  var perms = {
    canViewAll: defaults.permissions.canViewAll,
    canEdit: defaults.permissions.canEdit,
    canDelete: defaults.permissions.canDelete,
    canExport: defaults.permissions.canExport,
    canViewDash: defaults.permissions.canViewDash
  };
  var canAdd = defaults.canAdd;

  if (overrides && overrides.canAdd !== null) canAdd = overrides.canAdd;
  if (overrides && overrides.canViewAll !== null) perms.canViewAll = overrides.canViewAll;
  if (overrides && overrides.canEdit !== null) perms.canEdit = overrides.canEdit;
  if (overrides && overrides.canDelete !== null) perms.canDelete = overrides.canDelete;
  if (overrides && overrides.canExport !== null) perms.canExport = overrides.canExport;
  if (overrides && overrides.canViewDash !== null) perms.canViewDash = overrides.canViewDash;

  // Qat'iy qoidalar
  if (role === 'SUPER_ADMIN') {
    canAdd = true;
    perms.canViewAll = true;
    perms.canEdit = true;
    perms.canDelete = true;
    perms.canExport = true;
    perms.canViewDash = true;
  }

  return {
    roleKey: role,
    roleLabel: roleLabelFromKey_(role),
    canAdd: canAdd,
    isSuperAdmin: role === 'SUPER_ADMIN',
    isDirektor: role === 'DIRECTOR',
    isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
    permissions: perms,
    overrides: overrides || {
      canAdd: null,
      canViewAll: null,
      canEdit: null,
      canDelete: null,
      canExport: null,
      canViewDash: null
    }
  };
}

function readOverridesFromRow_(row) {
  return {
    canAdd: parseOverrideBit_(row[COL.OVR_CAN_ADD]),
    canViewAll: parseOverrideBit_(row[COL.OVR_VIEW_ALL]),
    canEdit: parseOverrideBit_(row[COL.OVR_EDIT]),
    canDelete: parseOverrideBit_(row[COL.OVR_DELETE]),
    canExport: parseOverrideBit_(row[COL.OVR_EXPORT]),
    canViewDash: parseOverrideBit_(row[COL.OVR_VIEW_DASH])
  };
}

function hasNewPermissionModel_(row) {
  if (String(row[COL.ROLE] || '').trim()) return true;
  return parseOverrideBit_(row[COL.OVR_CAN_ADD]) !== null ||
         parseOverrideBit_(row[COL.OVR_VIEW_ALL]) !== null ||
         parseOverrideBit_(row[COL.OVR_EDIT]) !== null ||
         parseOverrideBit_(row[COL.OVR_DELETE]) !== null ||
         parseOverrideBit_(row[COL.OVR_EXPORT]) !== null ||
         parseOverrideBit_(row[COL.OVR_VIEW_DASH]) !== null;
}

function resolveEmployeeAccessFromRow_(row) {
  if (!hasNewPermissionModel_(row)) {
    var legacyRole = deriveLegacyRoleFromRow_(row);
    return {
      roleKey: legacyRole,
      roleLabel: roleLabelFromKey_(legacyRole),
      canAdd: toBool01_(row[COL.CAN_ADD]),
      isSuperAdmin: toBool01_(row[COL.SUPER_ADMIN]),
      isDirektor: toBool01_(row[COL.DIREKTOR]),
      isAdmin: toBool01_(row[COL.ADMIN]),
      permissions: {
        canViewAll: toBool01_(row[COL.VIEW_ALL]),
        canEdit: toBool01_(row[COL.EDIT]),
        canDelete: toBool01_(row[COL.DELETE]),
        canExport: toBool01_(row[COL.EXPORT]),
        canViewDash: toBool01_(row[COL.VIEW_DASH])
      },
      overrides: {
        canAdd: null,
        canViewAll: null,
        canEdit: null,
        canDelete: null,
        canExport: null,
        canViewDash: null
      }
    };
  }

  var role = normalizeRole_(row[COL.ROLE], row);
  var overrides = readOverridesFromRow_(row);
  return buildModelFromRoleAndOverrides_(role, overrides);
}

// ---- Hodim ma'lumotlarini olish ----
function getEmployee(tgId) {
  var rows = getEmployeeRows_();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.TG_ID]) === String(tgId)) {
      var access = resolveEmployeeAccessFromRow_(rows[i]);
      return {
        sheetRow:    i + 1,
        tgId:        String(rows[i][COL.TG_ID]),
        username:    String(rows[i][COL.USERNAME] || ''),
        roleKey:     access.roleKey,
        role:        access.roleLabel,
        canAdd:      access.canAdd,
        isSuperAdmin:access.isSuperAdmin,
        isDirektor:  access.isDirektor,
        isAdmin:     access.isAdmin,
        permissions: access.permissions,
        overrides:   access.overrides
      };
    }
  }
  return null; // Ro'yxatda yo'q
}

function buildPendingUsername_(data, tgId) {
  var d = data || {};
  var first = String(d.firstName || '').trim();
  var last = String(d.lastName || '').trim();
  var uname = String(d.tgUsername || '').trim();

  var full = (first + ' ' + last).trim();
  if (full) return full;
  if (uname) return '@' + uname;
  return 'Yangi foydalanuvchi ' + String(tgId || '');
}

function notifyAccessRequestToAdmin_(tgId, displayName, source) {
  try {
    var msg = "🆕 Yangi foydalanuvchi ro'yxatga qo'shildi\n" +
              "👤 " + String(displayName || '—') + "\n" +
              "🆔 " + String(tgId || '—') + "\n" +
              "📍 Manba: " + String(source || 'init') + "\n" +
              "ℹ️ Ruxsat berish uchun Admin paneldan sozlang.";
    sendSystemAlert(msg);
  } catch (ignore) {}
}

function autoRegisterPendingUserIfMissing_(tgId, data, source) {
  var targetId = String(tgId || '').trim();
  if (!targetId) return { success:false, created:false, error:'tgId topilmadi' };
  if (isConfigSuperAdminId_(targetId)) return { success:true, created:false };

  var displayName = buildPendingUsername_(data, targetId);
  var created = false;

  var writeRes = withWriteLock_(function () {
    resetEmployeeCache_();
    var existing = getEmployee(targetId);
    if (existing) return { success:true, created:false };

    var empSheet = getSheets().empSheet;
    empSheet.appendRow([
      targetId,
      displayName,
      0, 0, 0, 0, 0, 0, 0, 0, 0,
      'EMPLOYEE',
      0, '', '', '', '', ''
    ]);
    created = true;
    return { success:true, created:true };
  });

  if (!writeRes.success) return writeRes;
  if (created) {
    resetEmployeeCache_();
    notifyAccessRequestToAdmin_(targetId, displayName, source || 'init');
  }
  return { success:true, created:created };
}

// ---- Rollarni aniqlash ----
function checkUserRoles(tgId) {
  var emp = getEmployee(tgId);

  var auth = {
    role: "User", roleKey: "EMPLOYEE", username: "",
    isAdmin: false, isBoss: false,
    isDirector: false, isSuperAdmin: false,
    inList: false,
    canAdd: true, // + tugmasi hammaga ko'rinadi
    permissions: {
      canViewAll:false, canEdit:false,
      canDelete:false, canExport:false, canViewDash:false
    }
  };

  if (!emp) {
    if (isConfigSuperAdminId_(tgId)) {
      auth.username = String((CONFIG && CONFIG.SUPER_ADMIN_NAME) || 'SuperAdmin');
      auth.role = 'SuperAdmin';
      auth.roleKey = 'SUPER_ADMIN';
      auth.isSuperAdmin = true;
      auth.isAdmin = true;
      auth.isBoss = true;
      auth.inList = true;
      auth.canAdd = true;
      auth.permissions = {
        canViewAll:true, canEdit:true,
        canDelete:true, canExport:true, canViewDash:true
      };
      return auth;
    }
    // Ro'yxatda yo'q — oddiy foydalanuvchi, amal qo'sha olmaydi
    auth.canAdd = false;
    return auth;
  }

  auth.inList = true;
  auth.username   = emp.username;
  auth.canAdd     = emp.canAdd;
  auth.role       = emp.role;
  auth.roleKey    = emp.roleKey;
  auth.isSuperAdmin = emp.isSuperAdmin;
  auth.isDirector = emp.isDirektor;
  auth.isAdmin    = emp.isAdmin;
  auth.isBoss     = emp.isSuperAdmin;
  auth.permissions = emp.permissions;
  return auth;
}

// ============================================================
// DATA SHEET FUNKSIYALARI
// ============================================================

function formatDateCell(val) {
  if (!val || val === '') return '';
  var parsed = parseDateInput_(val, null);
  if (parsed) return parsed.display;
  return String(val);
}

function parseDateInput_(dateValue, dateISOValue) {
  // Prefer explicit ISO from frontend when available.
  var parsed = parseDateRaw_(dateISOValue);
  if (!parsed) parsed = parseDateRaw_(dateValue);
  return parsed;
}

function parseDateRaw_(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  if (Object.prototype.toString.call(raw) === '[object Date]') {
    if (isNaN(raw.getTime())) return null;
    return buildDateMeta_(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  if (typeof raw === 'number' && isFinite(raw)) {
    // Excel serial date fallback.
    var serial = Math.floor(raw);
    var utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return buildDateMeta_(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }

  var str = String(raw).trim();
  if (!str || str === 'undefined' || str === 'null') return null;

  var m;

  // ISO: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (m) return buildDateMeta_(Number(m[1]), Number(m[2]), Number(m[3]));

  // DD/MM/YYYY (also supports DD.MM.YYYY, DD-MM-YYYY)
  m = str.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) return buildDateMeta_(Number(m[3]), Number(m[2]), Number(m[1]));

  return null;
}

function buildDateMeta_(y, m, d) {
  if (!isValidYmd_(y, m, d)) return null;
  var dd = ('0' + d).slice(-2);
  var mm = ('0' + m).slice(-2);
  var yy = String(y);
  return {
    year: yy,
    month: mm,
    day: dd,
    iso: yy + '-' + mm + '-' + dd,
    display: dd + '/' + mm + '/' + yy,
    dateObj: new Date(y, m - 1, d)
  };
}

function isValidYmd_(y, m, d) {
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return false;
  if (y < 1900 || y > 2200) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  var dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d;
}

function initUser(tgId, auth, data) {
  var autoAdded = false;
  if (!auth.inList && !auth.isSuperAdmin) {
    var autoReg = autoRegisterPendingUserIfMissing_(tgId, data || {}, 'init');
    if (autoReg && autoReg.success && autoReg.created) {
      autoAdded = true;
      auth = checkUserRoles(tgId);
    }
  }

  var dataSheet   = getSheets().dataSheet;
  var values      = dataSheet.getDataRange().getValues();
  var usernameMap = buildUsernameMap();   // Hodimlar sheet → username
  var myRecords   = [];

  for (var i = 1; i < values.length; i++) {
    if (isDeletedRow_(values[i])) continue;
    if (String(values[i][DATA_COL.TG_ID]) === String(tgId)) {
      var rowTgId = String(values[i][DATA_COL.TG_ID] || '').trim();
      myRecords.push({
        rowId:     i + 1,
        name:      usernameMap[rowTgId] || String(values[i][DATA_COL.NAME] || ''),
        amountUZS: Number(values[i][DATA_COL.AMOUNT_UZS]) || 0,
        amountUSD: Number(values[i][DATA_COL.AMOUNT_USD]) || 0,
        rate:      Number(values[i][DATA_COL.RATE]) || 0,
        comment:   String(values[i][DATA_COL.COMMENT] || ''),
        date:      formatDateCell(values[i][DATA_COL.DATE]),
        actionPeriod: String(values[i][DATA_COL.ACTION_PERIOD] || '') // YYYY-MM
      });
    }
  }

  var emp = getEmployee(tgId);
  return {
    success:      true,
    data:         myRecords,
    username:     auth.username,
    canAdd:       auth.canAdd,
    role:         auth.role,
    isAdmin:      auth.isAdmin,
    isBoss:       auth.isBoss,
    isSuperAdmin: auth.isSuperAdmin,
    isDirector:   auth.isDirector,
    isDirektor:   auth.isDirector,
    permissions:  auth.permissions,
    inList:       emp !== null,   // Ro'yxatda bormi
    autoAdded:    autoAdded,
    adminContactId: getConfigSuperAdminId_()
  };
}


// ---- Hodimlar username map (telegramId → username) ----
function buildUsernameMap() {
  if (_MEMO.usernameMap) return _MEMO.usernameMap;
  var rows     = getEmployeeRows_();
  var map      = {};
  for (var i = 1; i < rows.length; i++) {
    var tgId  = String(rows[i][COL.TG_ID]   || '').trim();
    var uname = String(rows[i][COL.USERNAME] || '').trim();
    if (tgId && uname) map[tgId] = uname;
  }
  _MEMO.usernameMap = map;
  return map;
}

function addRecord(data, auth, actorTgId) {
  // Ruhsatni backend da ham tekshiramiz
  if (!auth.canAdd) {
    return { success: false, error: "Sizda amal qo'shish ruxsati yo'q!" };
  }

  var notifyPayload = null;

  var writeResult = withWriteLock_(function () {
    var dataSheet = getSheets().dataSheet;
    var emp       = getEmployee(String(data.telegramId));

    // Ko'rsatiladigan ism — username (laqab) yoki Telegram ismi
    var displayName = (emp && emp.username) ? emp.username : (data.employeeName || '');

    var parsedDate = parseDateInput_(data.date, data.dateISO);
    if (!parsedDate) parsedDate = parseDateInput_(new Date(), null);
    
    var forPeriod = String(data.actionPeriod || '').trim();

    dataSheet.appendRow([
      displayName,
      data.telegramId   || '',
      Number(data.amountUZS) || 0,
      Number(data.amountUSD) || 0,
      Number(data.rate)      || 0,
      data.comment      || '',
      parsedDate.dateObj,
      0,
      forPeriod
    ]);

    var row = dataSheet.getLastRow();
    dataSheet.getRange(row, 7).setNumberFormat('dd/MM/yyyy');
    dataSheet.getRange(row, 8).setNumberFormat('0');
    dataSheet.getRange(row, 9).setNumberFormat('@'); // Text format for actionPeriod

    var appendedValues = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    addAuditLog_(actorTgId, 'add_record', row, null, rowToRecordForAudit_(appendedValues), 'created');

    notifyPayload = {
      employeeName: displayName,
      amountUZS: Number(data.amountUZS) || 0,
      amountUSD: Number(data.amountUSD) || 0,
      rate: Number(data.rate) || 0,
      comment: data.comment || '',
      date: parsedDate.display,
      actionPeriod: forPeriod
    };

    return { success: true };
  });

  if (!writeResult.success) return writeResult;
  if (notifyPayload) sendTelegramNotification(notifyPayload);
  return writeResult;
}

function adminGetAll(options) {
  var opts = options || {};

  var dataSheet   = getSheets().dataSheet;
  var values      = dataSheet.getDataRange().getValues();
  var usernameMap = buildUsernameMap();

  var records = [];
  var totalUZS = 0;
  var employeeSet = {};
  var yearSet = {};

  for (var i = values.length - 1; i > 0; i--) {
    var row = values[i];
    if (isDeletedRow_(row)) continue;
    if (!row[DATA_COL.NAME] && !row[DATA_COL.AMOUNT_UZS]) continue;

    var rowTgId = String(row[DATA_COL.TG_ID] || '').trim();
    var name = usernameMap[rowTgId] || String(row[DATA_COL.NAME] || '');
    var comment = String(row[DATA_COL.COMMENT] || '');
    var dateMeta = parseDateInput_(row[DATA_COL.DATE], null);
    var dateText = dateMeta ? dateMeta.display : formatDateCell(row[DATA_COL.DATE]);
    var ap = String(row[DATA_COL.ACTION_PERIOD] || '').trim();

    if (name) employeeSet[name] = true;
    if (ap) {
        var parts = ap.split('-');
        if (parts[0]) yearSet[parts[0]] = true;
    } else if (dateMeta) {
        yearSet[dateMeta.year] = true;
    }

    if (!matchesAdminFilters_(name, comment, dateMeta, ap, opts)) continue;

    var amountUZS = Number(row[DATA_COL.AMOUNT_UZS]) || 0;
    totalUZS += amountUZS;

    records.push({
      rowId:     i + 1,
      name:      name,
      telegramId:String(row[DATA_COL.TG_ID] || ''),
      amountUZS: amountUZS,
      amountUSD: Number(row[DATA_COL.AMOUNT_USD]) || 0,
      rate:      Number(row[DATA_COL.RATE]) || 0,
      comment:   comment,
      date:      dateText,
      actionPeriod: ap
    });
  }

  var employees = Object.keys(employeeSet).sort();
  var years = Object.keys(yearSet).sort(function (a, b) { return Number(b) - Number(a); });

  var pageGiven = opts.page !== undefined && opts.page !== null && String(opts.page).trim() !== '';
  var pageSizeGiven = opts.pageSize !== undefined && opts.pageSize !== null && String(opts.pageSize).trim() !== '';
  var shouldPaginate = pageGiven || pageSizeGiven;

  if (!shouldPaginate) {
    return {
      success: true,
      data: records,
      totalCount: records.length,
      totalUZS: totalUZS,
      employees: employees,
      years: years
    };
  }

  var pageSize = toPositiveInt_(opts.pageSize, 20, 5, 100);
  var totalCount = records.length;
  var totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  var page = toPositiveInt_(opts.page, 1, 1, totalPages);
  if (page > totalPages) page = totalPages;

  var start = (page - 1) * pageSize;
  var pageData = records.slice(start, start + pageSize);

  return {
    success: true,
    data: pageData,
    page: page,
    pageSize: pageSize,
    totalPages: totalPages,
    totalCount: totalCount,
    totalUZS: totalUZS,
    employees: employees,
    years: years
  };
}

function adminEditRecord(data, actorTgId) {
  return withWriteLock_(function () {
    var reason = normalizeReason_(data.reason);
    if (!reason) return { success:false, error:"Tahrirlash sababi kiritilishi shart" };

    var dataSheet = getSheets().dataSheet;
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > dataSheet.getLastRow()) {
      return { success:false, error:'Qator topilmadi' };
    }

    var before = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    if (isDeletedRow_(before)) {
      return { success:false, error:"Bu yozuv o'chirilgan" };
    }

    dataSheet.getRange(row, 3).setValue(Number(data.amountUZS) || 0);
    dataSheet.getRange(row, 4).setValue(Number(data.amountUSD) || 0);
    dataSheet.getRange(row, 5).setValue(Number(data.rate)      || 0);
    dataSheet.getRange(row, 6).setValue(data.comment           || '');
    if (data.actionPeriod !== undefined) {
      dataSheet.getRange(row, 9).setValue(String(data.actionPeriod).trim());
    }

    var after = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    addAuditLog_(actorTgId, 'admin_edit', row, rowToRecordForAudit_(before), rowToRecordForAudit_(after), 'updated: ' + reason);
    return { success: true };
  });
}

function adminDeleteRecord(rowId, actorTgId, reasonRaw) {
  return withWriteLock_(function () {
    var reason = normalizeReason_(reasonRaw);
    if (!reason) return { success:false, error:"O'chirish sababi kiritilishi shart" };

    var dataSheet = getSheets().dataSheet;
    var row = parseInt(rowId, 10);
    if (!row || row <= 1 || row > dataSheet.getLastRow()) {
      return { success:false, error:'Qator topilmadi' };
    }

    var before = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    if (isDeletedRow_(before)) {
      return { success:true };
    }

    dataSheet.getRange(row, DATA_COL.IS_DELETED + 1).setValue(1);
    var after = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    addAuditLog_(actorTgId, 'admin_delete', row, rowToRecordForAudit_(before), rowToRecordForAudit_(after), 'soft-delete: ' + reason);
    return { success: true };
  });
}

function selfEditRecord(data, actorTgId) {
  return withWriteLock_(function () {
    var reason = normalizeReason_(data.reason);
    if (!reason) return { success:false, error:"Tahrirlash sababi kiritilishi shart" };

    var dataSheet = getSheets().dataSheet;
    var row = parseInt(data.rowId, 10);
    if (!row || row <= 1 || row > dataSheet.getLastRow()) {
      return { success:false, error:'Qator topilmadi' };
    }

    var before = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    if (isDeletedRow_(before)) return { success:false, error:"Bu yozuv o'chirilgan" };

    var ownerTgId = String(before[DATA_COL.TG_ID] || '').trim();
    if (ownerTgId !== String(actorTgId || '').trim()) {
      return { success:false, error:"Faqat o'zingizning yozuvingizni tahrirlaysiz" };
    }

    dataSheet.getRange(row, 3).setValue(Number(data.amountUZS) || 0);
    dataSheet.getRange(row, 4).setValue(Number(data.amountUSD) || 0);
    dataSheet.getRange(row, 5).setValue(Number(data.rate)      || 0);
    dataSheet.getRange(row, 6).setValue(data.comment           || '');
    if (data.actionPeriod !== undefined) {
      dataSheet.getRange(row, 9).setValue(String(data.actionPeriod).trim());
    }

    var after = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    addAuditLog_(actorTgId, 'self_edit', row, rowToRecordForAudit_(before), rowToRecordForAudit_(after), 'updated: ' + reason);
    return { success:true };
  });
}

function selfDeleteRecord(rowId, actorTgId, reasonRaw) {
  return withWriteLock_(function () {
    var reason = normalizeReason_(reasonRaw);
    if (!reason) return { success:false, error:"O'chirish sababi kiritilishi shart" };

    var dataSheet = getSheets().dataSheet;
    var row = parseInt(rowId, 10);
    if (!row || row <= 1 || row > dataSheet.getLastRow()) {
      return { success:false, error:'Qator topilmadi' };
    }

    var before = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    if (isDeletedRow_(before)) return { success:true };

    var ownerTgId = String(before[DATA_COL.TG_ID] || '').trim();
    if (ownerTgId !== String(actorTgId || '').trim()) {
      return { success:false, error:"Faqat o'zingizning yozuvingizni o'chirasiz" };
    }

    dataSheet.getRange(row, DATA_COL.IS_DELETED + 1).setValue(1);
    var after = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    addAuditLog_(actorTgId, 'self_delete', row, rowToRecordForAudit_(before), rowToRecordForAudit_(after), 'soft-delete: ' + reason);
    return { success:true };
  });
}

// ============================================================
// HODIMLAR BOSHQARUVI (SuperAdmin uchun)
// ============================================================

function overrideToCellValue_(value) {
  if (value === null || value === undefined) return '';
  return value ? 1 : 0;
}

function resolveRoleAndOverridesFromPayload_(data, fallbackRow) {
  var roleRaw = data.role;
  if (!String(roleRaw || '').trim()) {
    if (toBool01_(data.isSuperAdmin)) roleRaw = 'SUPER_ADMIN';
    else if (toBool01_(data.isDirektor)) roleRaw = 'DIRECTOR';
    else if (toBool01_(data.isAdmin)) roleRaw = 'ADMIN';
  }
  var role = normalizeRole_(roleRaw, fallbackRow || null);
  var overrides = {
    canAdd: parseOverrideBit_(data.canAdd),
    canViewAll: parseOverrideBit_(data.canViewAll),
    canEdit: parseOverrideBit_(data.canEdit),
    canDelete: parseOverrideBit_(data.canDelete),
    canExport: parseOverrideBit_(data.canExport),
    canViewDash: parseOverrideBit_(data.canViewDash)
  };
  return {
    role: role,
    overrides: overrides,
    effective: buildModelFromRoleAndOverrides_(role, overrides)
  };
}

function getHodimlar() {
  var rows     = getEmployeeRows_();
  var result   = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var access = resolveEmployeeAccessFromRow_(rows[i]);
    result.push({
      sheetRow:    i + 1,
      tgId:        String(rows[i][COL.TG_ID]),
      isConfigSuperAdmin: isConfigSuperAdminId_(rows[i][COL.TG_ID]) ? 1 : 0,
      username:    String(rows[i][COL.USERNAME]    || ''),
      role:        access.roleKey,
      roleLabel:   access.roleLabel,
      canAdd:      access.canAdd ? 1 : 0,
      isSuperAdmin:access.isSuperAdmin ? 1 : 0,
      isDirektor:  access.isDirektor ? 1 : 0,
      isAdmin:     access.isAdmin ? 1 : 0,
      canViewAll:  access.permissions.canViewAll ? 1 : 0,
      canEdit:     access.permissions.canEdit ? 1 : 0,
      canDelete:   access.permissions.canDelete ? 1 : 0,
      canExport:   access.permissions.canExport ? 1 : 0,
      canViewDash: access.permissions.canViewDash ? 1 : 0,
      overrideCanAdd:      access.overrides.canAdd,
      overrideCanViewAll:  access.overrides.canViewAll,
      overrideCanEdit:     access.overrides.canEdit,
      overrideCanDelete:   access.overrides.canDelete,
      overrideCanExport:   access.overrides.canExport,
      overrideCanViewDash: access.overrides.canViewDash
    });
  }
  return { success: true, data: result };
}

function listNotifyUsers() {
  var rows = getEmployeeRows_();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var tgId = String(rows[i][COL.TG_ID] || '').trim();
    if (!tgId) continue;
    if (isConfigSuperAdminId_(tgId)) continue;

    var access = resolveEmployeeAccessFromRow_(rows[i]);
    out.push({
      tgId: tgId,
      username: String(rows[i][COL.USERNAME] || ''),
      role: access.roleKey,
      canAdd: access.canAdd ? 1 : 0
    });
  }

  out.sort(function (a, b) {
    var an = String(a.username || '').toLowerCase();
    var bn = String(b.username || '').toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  });
  return { success:true, data: out };
}

function getLatestActionDatesByTgId_() {
  var dataSheet = getSheets().dataSheet;
  var values = dataSheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (isDeletedRow_(row)) continue;
    var tgId = String(row[DATA_COL.TG_ID] || '').trim();
    if (!tgId) continue;

    var dateMeta = parseDateInput_(row[DATA_COL.DATE], null);
    if (!dateMeta || !dateMeta.dateObj) continue;

    var dt = dateMeta.dateObj;
    if (!map[tgId] || map[tgId].getTime() < dt.getTime()) {
      map[tgId] = dt;
    }
  }
  return map;
}

function getInactiveUsers(days) {
  var threshold = toPositiveInt_(days, Number((CONFIG && CONFIG.DEFAULT_INACTIVE_DAYS) || 14), 1, 365);
  var notifyUsers = listNotifyUsers();
  if (!notifyUsers.success) return notifyUsers;

  var latestMap = getLatestActionDatesByTgId_();
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  var out = [];
  for (var i = 0; i < notifyUsers.data.length; i++) {
    var user = notifyUsers.data[i];
    if (Number(user.canAdd) !== 1) continue;

    var lastDate = latestMap[user.tgId] || null;
    var inactiveDays = lastDate
      ? Math.floor((now.getTime() - new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime()) / 86400000)
      : 99999;

    if (!lastDate || inactiveDays >= threshold) {
      out.push({
        tgId: user.tgId,
        username: user.username || '',
        role: user.role || '',
        lastActionDate: lastDate ? formatDateCell(lastDate) : '',
        inactiveDays: inactiveDays
      });
    }
  }

  out.sort(function (a, b) { return Number(b.inactiveDays) - Number(a.inactiveDays); });
  return { success:true, days:threshold, count:out.length, data:out };
}

function sanitizeReminderText_(text) {
  var t = String(text || '').trim();
  if (!t) return '';
  if (t.length > 3000) return '__TOO_LONG__';
  return t;
}

function getReminderTextSetting(actorTgId) {
  var text = getReminderTemplate_();
  return { success:true, text:String(text || '') };
}

function setReminderTextSetting(text, actorTgId) {
  var sanitized = sanitizeReminderText_(text);
  if (!sanitized) return { success:false, error:'Matn bo\'sh bo\'lmasin' };
  if (sanitized === '__TOO_LONG__') return { success:false, error:'Matn juda uzun (max 3000)' };

  var saved = setReminderTemplate_(sanitized);
  addAuditLog_(actorTgId, 'set_reminder_text', '', null, { textLength: String(saved || '').length }, 'updated');
  return { success:true, text:String(saved || '') };
}

function sendUserReminder(tgId, actorTgId, reminderText) {
  var targetId = String(tgId || '').trim();
  if (!targetId) return { success:false, error:'Foydalanuvchi tanlanmagan' };
  if (isConfigSuperAdminId_(targetId)) return { success:false, error:'Config SuperAdmin ga xabar yuborish cheklangan' };
  var customText = sanitizeReminderText_(reminderText);
  if (customText === '__TOO_LONG__') return { success:false, error:'Matn juda uzun (max 3000)' };

  var emp = getEmployee(targetId);
  var username = emp ? emp.username : '';
  var sendRes = sendSalaryReminderToUser(targetId, username, customText);
  if (!sendRes || !sendRes.ok) {
    addAuditLog_(actorTgId, 'send_user_reminder', '', null, { tgId: targetId, ok:false }, String((sendRes && sendRes.description) || 'failed'));
    return { success:false, error: String((sendRes && sendRes.description) || 'Xabar yuborilmadi') };
  }

  addAuditLog_(actorTgId, 'send_user_reminder', '', null, { tgId: targetId, ok:true }, 'manual');
  return { success:true };
}

function sendInactiveReminders(days, actorTgId, reminderText) {
  var inactive = getInactiveUsers(days);
  if (!inactive.success) return inactive;
  var customText = sanitizeReminderText_(reminderText);
  if (customText === '__TOO_LONG__') return { success:false, error:'Matn juda uzun (max 3000)' };

  var sent = 0;
  var failed = 0;
  var failedUsers = [];

  for (var i = 0; i < inactive.data.length; i++) {
    var u = inactive.data[i];
    var sendRes = sendSalaryReminderToUser(u.tgId, u.username, customText);
    if (sendRes && sendRes.ok) {
      sent++;
    } else {
      failed++;
      if (failedUsers.length < 10) {
        failedUsers.push({
          tgId: u.tgId,
          username: u.username || '',
          error: String((sendRes && sendRes.description) || 'failed')
        });
      }
    }
    Utilities.sleep(80);
  }

  addAuditLog_(actorTgId, 'send_inactive_reminders', '', null, {
    days: inactive.days,
    total: inactive.count,
    sent: sent,
    failed: failed
  }, 'bulk');

  return {
    success:true,
    days: inactive.days,
    total: inactive.count,
    sent: sent,
    failed: failed,
    failedUsers: failedUsers
  };
}

function addHodim(data) {
  return withWriteLock_(function () {
    if (isConfigSuperAdminId_(data.tgId)) {
      return { success:false, error:"Config SUPER_ADMIN_ID ilovadan qo'shilmaydi/o'zgarmaydi. Faqat Google Sheetsdan boshqaring." };
    }
    var empSheet = getSheets().empSheet;
    var rows     = getEmployeeRows_();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.tgId)) {
        return { success: false, error: "Bu ID allaqachon ro'yxatda!" };
      }
    }
    var cfg = resolveRoleAndOverridesFromPayload_(data, null);
    var eff = cfg.effective;
    empSheet.appendRow([
      data.tgId        || '',
      data.username    || 'Yangi Xodim',
      eff.canAdd ? 1 : 0,
      eff.isSuperAdmin ? 1 : 0,
      eff.isDirektor ? 1 : 0,
      (eff.isAdmin && !eff.isSuperAdmin) ? 1 : 0,
      eff.permissions.canViewAll ? 1 : 0,
      eff.permissions.canEdit ? 1 : 0,
      eff.permissions.canDelete ? 1 : 0,
      eff.permissions.canExport ? 1 : 0,
      eff.permissions.canViewDash ? 1 : 0,
      cfg.role,
      overrideToCellValue_(cfg.overrides.canAdd),
      overrideToCellValue_(cfg.overrides.canViewAll),
      overrideToCellValue_(cfg.overrides.canEdit),
      overrideToCellValue_(cfg.overrides.canDelete),
      overrideToCellValue_(cfg.overrides.canExport),
      overrideToCellValue_(cfg.overrides.canViewDash)
    ]);
    resetEmployeeCache_();
    return { success: true };
  });
}

function updateHodim(data) {
  return withWriteLock_(function () {
    if (isConfigSuperAdminId_(data.tgId)) {
      return { success:false, error:"Config SUPER_ADMIN_ID ruxsatlarini ilovadan o'zgartirib bo'lmaydi." };
    }
    var empSheet = getSheets().empSheet;
    var rows     = getEmployeeRows_();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.tgId)) {
        var r = i + 1;
        var cfg = resolveRoleAndOverridesFromPayload_(data, rows[i]);
        var eff = cfg.effective;
        empSheet.getRange(r, COL.USERNAME     + 1).setValue(data.username    || '');
        empSheet.getRange(r, COL.CAN_ADD      + 1).setValue(eff.canAdd ? 1 : 0);
        empSheet.getRange(r, COL.SUPER_ADMIN  + 1).setValue(eff.isSuperAdmin ? 1 : 0);
        empSheet.getRange(r, COL.DIREKTOR     + 1).setValue(eff.isDirektor ? 1 : 0);
        empSheet.getRange(r, COL.ADMIN        + 1).setValue((eff.isAdmin && !eff.isSuperAdmin) ? 1 : 0);
        empSheet.getRange(r, COL.VIEW_ALL     + 1).setValue(eff.permissions.canViewAll ? 1 : 0);
        empSheet.getRange(r, COL.EDIT         + 1).setValue(eff.permissions.canEdit ? 1 : 0);
        empSheet.getRange(r, COL.DELETE       + 1).setValue(eff.permissions.canDelete ? 1 : 0);
        empSheet.getRange(r, COL.EXPORT       + 1).setValue(eff.permissions.canExport ? 1 : 0);
        empSheet.getRange(r, COL.VIEW_DASH    + 1).setValue(eff.permissions.canViewDash ? 1 : 0);
        empSheet.getRange(r, COL.ROLE         + 1).setValue(cfg.role);
        empSheet.getRange(r, COL.OVR_CAN_ADD  + 1).setValue(overrideToCellValue_(cfg.overrides.canAdd));
        empSheet.getRange(r, COL.OVR_VIEW_ALL + 1).setValue(overrideToCellValue_(cfg.overrides.canViewAll));
        empSheet.getRange(r, COL.OVR_EDIT     + 1).setValue(overrideToCellValue_(cfg.overrides.canEdit));
        empSheet.getRange(r, COL.OVR_DELETE   + 1).setValue(overrideToCellValue_(cfg.overrides.canDelete));
        empSheet.getRange(r, COL.OVR_EXPORT   + 1).setValue(overrideToCellValue_(cfg.overrides.canExport));
        empSheet.getRange(r, COL.OVR_VIEW_DASH+ 1).setValue(overrideToCellValue_(cfg.overrides.canViewDash));
        resetEmployeeCache_();
        return { success: true };
      }
    }
    return { success: false, error: "Hodim topilmadi" };
  });
}

function deleteHodim(tgId) {
  return withWriteLock_(function () {
    if (isConfigSuperAdminId_(tgId)) {
      return { success:false, error:"Config SUPER_ADMIN_ID ni o'chirib bo'lmaydi." };
    }
    var empSheet = getSheets().empSheet;
    var rows     = getEmployeeRows_();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(tgId)) {
        empSheet.deleteRow(i + 1);
        resetEmployeeCache_();
        return { success: true };
      }
    }
    return { success: false, error: "Hodim topilmadi" };
  });
}
