// ============================================================
// GS_Records.gs — Financial Records Management
// ============================================================

function addRecord(data, auth, actorTgId) {
  if (!auth.canAdd) return { success: false, error: "Sizda amal qo'shish ruxsati yo'q!" };
  var notifyPayload = null;
  var writeResult = withWriteLock_(function () {
    var dataSheet = getSheets().dataSheet;
    var emp = getEmployee(String(data.telegramId));
    var displayName = (emp && emp.username) ? emp.username : (data.employeeName || '');
    var parsedDate = parseDateInput_(data.date, data.dateISO);
    if (!parsedDate) parsedDate = parseDateInput_(new Date(), null);
    var forPeriod = String(data.actionPeriod || '').trim();
    dataSheet.appendRow([displayName, data.telegramId || '', Number(data.amountUZS) || 0, Number(data.amountUSD) || 0, Number(data.rate) || 0, data.comment || '', parsedDate.dateObj, 0, forPeriod ? "'" + forPeriod : ""]);
    var row = dataSheet.getLastRow();
    dataSheet.getRange(row, 7).setNumberFormat('dd/MM/yyyy');
    dataSheet.getRange(row, 8).setNumberFormat('0');
    dataSheet.getRange(row, 9).setNumberFormat('@');
    var appendedValues = dataSheet.getRange(row, 1, 1, 9).getValues()[0];
    addAuditLog_(actorTgId, 'add_record', row, null, rowToRecordForAudit_(appendedValues), 'created');
    notifyPayload = { employeeName: displayName, amountUZS: Number(data.amountUZS) || 0, amountUSD: Number(data.amountUSD) || 0, rate: Number(data.rate) || 0, comment: data.comment || '', date: parsedDate.display, actionPeriod: forPeriod };
    return { success: true, rowId: row };
  });
  if (!writeResult.success) return writeResult;
  if (notifyPayload) sendTelegramNotification(notifyPayload);
  return writeResult;
}

function adminGetAll(options) {
  var opts = options || {};
  var dataSheet = getSheets().dataSheet;
  var values = dataSheet.getDataRange().getValues();
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
    var ap = parseActionPeriod_(row[DATA_COL.ACTION_PERIOD]);
    if (name) employeeSet[name] = true;
    if (ap) { var parts = ap.split('-'); if (parts[0]) yearSet[parts[0]] = true; }
    else if (dateMeta) { yearSet[dateMeta.year] = true; }
    if (!matchesAdminFilters_(name, comment, dateMeta, ap, opts)) continue;
    var amountUZS = Number(row[DATA_COL.AMOUNT_UZS]) || 0;
    totalUZS += amountUZS;
    records.push({ rowId: i + 1, name: name, telegramId:String(row[DATA_COL.TG_ID] || ''), amountUZS: amountUZS, amountUSD: Number(row[DATA_COL.AMOUNT_USD]) || 0, rate: Number(row[DATA_COL.RATE]) || 0, comment: comment, date: dateText, actionPeriod: ap });
  }
  var employees = Object.keys(employeeSet).sort();
  var years = Object.keys(yearSet).sort(function (a, b) { return Number(b) - Number(a); });
  var pageGiven = opts.page !== undefined && opts.page !== null && String(opts.page).trim() !== '';
  var pageSizeGiven = opts.pageSize !== undefined && opts.pageSize !== null && String(opts.pageSize).trim() !== '';
  var shouldPaginate = pageGiven || pageSizeGiven;
  if (!shouldPaginate) {
    return { success: true, data: records, totalCount: records.length, totalUZS: totalUZS, employees: employees, years: years };
  }
  var pageSize = toPositiveInt_(opts.pageSize, 20, 5, 100);
  var totalCount = records.length;
  var totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  var page = toPositiveInt_(opts.page, 1, 1, totalPages);
  if (page > totalPages) page = totalPages;
  var start = (page - 1) * pageSize;
  var pageData = records.slice(start, start + pageSize);
  return { success: true, data: pageData, page: page, pageSize: pageSize, totalPages: totalPages, totalCount: totalCount, totalUZS: totalUZS, employees: employees, years: years };
}

function selfEditRecord(data, actorTgId) {
  var auth = checkUserRoles(actorTgId);
  if (!auth.canEdit) return { success: false, error: "Sizda tahrirlash ruxsati yo'q!" };
  var rowId = Number(data.rowId);
  var writeResult = withWriteLock_(function () {
    var dataSheet = getSheets().dataSheet;
    var rowData = dataSheet.getRange(rowId, 1, 1, 9).getValues()[0];
    if (isDeletedRow_(rowData)) return { success: false, error: "Ushbu amal o'chirib yuborilgan." };
    if (String(rowData[DATA_COL.TG_ID]) !== String(actorTgId)) return { success: false, error: "Siz faqat o'zingizning amallaringizni tahrirlashingiz mumkin!" };
    var parsedDate = parseDateInput_(data.date, data.dateISO);
    if (!parsedDate) parsedDate = parseDateInput_(rowData[DATA_COL.DATE], null);
    var updateValues = [ Number(data.amountUZS) || 0, Number(data.amountUSD) || 0, Number(data.rate) || 0, data.comment || '', parsedDate.dateObj, 0, data.actionPeriod ? "'" + data.actionPeriod : "" ];
    dataSheet.getRange(rowId, 3, 1, 7).setValues([updateValues]);
    dataSheet.getRange(rowId, 7).setNumberFormat('dd/MM/yyyy');
    dataSheet.getRange(rowId, 9).setNumberFormat('@');
    addAuditLog_(actorTgId, 'self_edit', rowId, rowToRecordForAudit_(rowData), rowToRecordForAudit_(dataSheet.getRange(rowId, 1, 1, 9).getValues()[0]), data.reason);
    return { success: true };
  });
  return writeResult;
}

function selfDeleteRecord(rowId, actorTgId, reason) {
  var auth = checkUserRoles(actorTgId);
  if (!auth.canDelete) return { success: false, error: "Sizda o'chirish ruxsati yo'q!" };
  var rowIdNum = Number(rowId);
  var writeResult = withWriteLock_(function () {
    var dataSheet = getSheets().dataSheet;
    var rowData = dataSheet.getRange(rowIdNum, 1, 1, 9).getValues()[0];
    if (isDeletedRow_(rowData)) return { success: false, error: "Ushbu amal allaqachon o'chirilgan." };
    if (String(rowData[DATA_COL.TG_ID]) !== String(actorTgId)) return { success: false, error: "Siz faqat o'zingizning amallaringizni o'chirishingiz mumkin!" };
    dataSheet.getRange(rowIdNum, DATA_COL.IS_DELETED + 1).setValue(1);
    addAuditLog_(actorTgId, 'self_delete', rowIdNum, rowToRecordForAudit_(rowData), rowToRecordForAudit_(dataSheet.getRange(rowIdNum, 1, 1, 9).getValues()[0]), reason);
    return { success: true };
  });
  return writeResult;
}

function adminEditRecord(data, actorTgId) {
  var rowId = Number(data.rowId);
  var writeResult = withWriteLock_(function () {
    var dataSheet = getSheets().dataSheet;
    var rowData = dataSheet.getRange(rowId, 1, 1, 9).getValues()[0];
    var parsedDate = parseDateInput_(data.date, data.dateISO);
    if (!parsedDate) parsedDate = parseDateInput_(rowData[DATA_COL.DATE], null);
    var updateValues = [ Number(data.amountUZS) || 0, Number(data.amountUSD) || 0, Number(data.rate) || 0, data.comment || '', parsedDate.dateObj, 0, data.actionPeriod ? "'" + data.actionPeriod : "" ];
    dataSheet.getRange(rowId, 3, 1, 7).setValues([updateValues]);
    dataSheet.getRange(rowId, 7).setNumberFormat('dd/MM/yyyy');
    dataSheet.getRange(rowId, 9).setNumberFormat('@');
    addAuditLog_(actorTgId, 'admin_edit', rowId, rowToRecordForAudit_(rowData), rowToRecordForAudit_(dataSheet.getRange(rowId, 1, 1, 9).getValues()[0]), data.reason);
    return { success: true };
  });
  return writeResult;
}

function adminDeleteRecord(rowId, actorTgId, reason) {
  var rowIdNum = Number(rowId);
  var writeResult = withWriteLock_(function () {
    var dataSheet = getSheets().dataSheet;
    var rowData = dataSheet.getRange(rowIdNum, 1, 1, 9).getValues()[0];
    dataSheet.getRange(rowIdNum, DATA_COL.IS_DELETED + 1).setValue(1);
    addAuditLog_(actorTgId, 'admin_delete', rowIdNum, rowToRecordForAudit_(rowData), rowToRecordForAudit_(dataSheet.getRange(rowIdNum, 1, 1, 9).getValues()[0]), reason);
    return { success: true };
  });
  return writeResult;
}

function matchesAdminFilters_(name, comment, dateMeta, actionPeriod, filters) {
  var f = filters || {};
  var employee = String(f.employee || 'all');
  var month = String(f.month || 'all');
  var year = String(f.year || 'all');
  var query = normalizeFilterText_(f.query);
  if (employee !== 'all' && name !== employee) return false;
  if (query) { var n = normalizeFilterText_(name); var c = normalizeFilterText_(comment); if (n.indexOf(query) < 0 && c.indexOf(query) < 0) return false; }
  if (month !== 'all' || year !== 'all') {
    var rYear = null, rMonth = null;
    if (actionPeriod) { var parts = actionPeriod.split('-'); if (parts.length === 2) { rYear = parts[0]; rMonth = parts[1]; } }
    else if (dateMeta) { rYear = dateMeta.year; rMonth = dateMeta.month; }
    if (!rYear && !rMonth) return false;
    if (month !== 'all' && rMonth !== month) return false;
    if (year !== 'all' && rYear !== year) return false;
  }
  return true;
}

function isDeletedRow_(row) {
  var mark = row[DATA_COL.IS_DELETED];
  if (mark === 1 || mark === true) return true;
  var s = String(mark || '').toLowerCase().trim();
  return s === '1' || s === 'true' || s === 'yes';
}

function getLatestActionDatesByTgId_() {
  var values = getSheets().dataSheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (isDeletedRow_(row)) continue;
    var tgId = String(row[DATA_COL.TG_ID] || '').trim();
    if (!tgId) continue;
    var dt = parseDateInput_(row[DATA_COL.DATE], null);
    if (!dt) continue;
    var currentObj = dt.dateObj;
    if (!map[tgId] || currentObj > map[tgId]) map[tgId] = currentObj;
  }
  return map;
}
