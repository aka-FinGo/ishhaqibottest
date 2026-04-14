// ============================================================
// GS_Utils_Backend.gs — Common Backend Helpers
// ============================================================

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

function formatDateCell(val) {
  if (!val || val === '') return '';
  var parsed = parseDateInput_(val, null);
  if (parsed) return parsed.display;
  return String(val);
}

function parseActionPeriod_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1);
    if (m.length === 1) m = '0' + m;
    return y + '-' + m;
  }
  return String(val || '').trim();
}

function parseDateInput_(dateValue, dateISOValue) {
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
    var serial = Math.floor(raw);
    var utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return buildDateMeta_(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  var str = String(raw).trim();
  if (!str || str === 'undefined' || str === 'null') return null;
  var m;
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (m) return buildDateMeta_(Number(m[1]), Number(m[2]), Number(m[3]));
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
    year: yy, month: mm, day: dd,
    iso: yy + '-' + mm + '-' + dd,
    display: dd + '/' + mm + '/' + yy,
    dateObj: new Date(y, m - 1, d)
  };
}

function isValidYmd_(y, m, d) {
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return false;
  var dt = new Date(y, m - 1, d);
  return dt.getFullYear() === Number(y) && dt.getMonth() === Number(m - 1) && dt.getDate() === Number(d);
}

function toPositiveInt_(value, defaultValue, minValue, maxValue) {
  var n = parseInt(value, 10);
  if (!isFinite(n) || n < minValue) return defaultValue;
  if (n > maxValue) return maxValue;
  return n;
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

function addAuditLog_(actorTgId, action, rowId, beforeObj, afterObj, note) {
  var sh = getAuditSheet_ ? getAuditSheet_() : null;
  if (!sh) return;
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
