// ============================================================
// DATABASE.GS — Core Infrastructure and Initialization
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
  OVR_VIEW_DASH:17,
  LAVOZIM:      18
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
  "Role","OverrideCanAdd","OverrideViewAll","OverrideEdit","OverrideDelete","OverrideExport","OverrideViewDash",
  "Lavozim"
];

var WORKFLOW_HEADERS = [
  "StepIndex", "PositionName", "ActionLabel", "StatusLabel", "IsStart"
];

var POSITIONS_HEADERS = [
  "PositionName", "Icon"
];

function getSheets() {
  if (_MEMO.sheets) return _MEMO.sheets;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheets()[0];
  ensureDataInfrastructure_(dataSheet);
  var empSheet = ss.getSheetByName("Hodimlar");
  if (!empSheet) {
    empSheet = ss.insertSheet("Hodimlar");
    empSheet.appendRow(EMP_HEADERS);
    empSheet.getRange(1,1,1,EMP_HEADERS.length).setFontWeight("bold").setBackground("#1e3c72").setFontColor("#ffffff");
    if (CONFIG.SUPER_ADMIN_ID && CONFIG.SUPER_ADMIN_NAME) {
      empSheet.appendRow([CONFIG.SUPER_ADMIN_ID, CONFIG.SUPER_ADMIN_NAME, 1, 1, 0, 0, 1, 1, 1, 1, 1, 'SUPER_ADMIN', 1, 1, 1, 1, 1, 1, '']);
    }
  }
  ensureEmployeeInfrastructure_(empSheet);
  var workflowSheet = ss.getSheetByName("WorkflowSteps");
  if (!workflowSheet) {
    workflowSheet = ss.insertSheet("WorkflowSteps");
    ensureWorkflowInfrastructure_(workflowSheet);
  }
  var positionsSheet = ss.getSheetByName("Lavozimlar");
  if (!positionsSheet) {
    positionsSheet = ss.insertSheet("Lavozimlar");
    ensurePositionsInfrastructure_(positionsSheet);
  }
  _MEMO.sheets = { dataSheet: dataSheet, empSheet: empSheet, workflowSheet: workflowSheet, positionsSheet: positionsSheet };
  return _MEMO.sheets;
}

function ensureEmployeeInfrastructure_(empSheet) {
  if (!empSheet) return;
  var requiredCols = EMP_HEADERS.length;
  if (empSheet.getMaxColumns() < requiredCols) {
    empSheet.insertColumnsAfter(empSheet.getMaxColumns(), requiredCols - empSheet.getMaxColumns());
  }
  var currentHeaders = empSheet.getRange(1, 1, 1, requiredCols).getValues()[0];
  var needHeaderWrite = false;
  for (var j = 0; j < requiredCols; j++) {
    if (String(currentHeaders[j] || '') !== EMP_HEADERS[j]) { needHeaderWrite = true; break; }
  }
  if (needHeaderWrite) { empSheet.getRange(1, 1, 1, requiredCols).setValues([EMP_HEADERS]); }
  synchronizeEmployeeRowsToV2_(empSheet, false);
}

function synchronizeEmployeeRowsToV2_(empSheet, hideLegacyColumns) {
  if (!empSheet) return { success:false };
  var requiredCols = EMP_HEADERS.length;
  var lastRow = empSheet.getLastRow();
  if (lastRow < 2) return { success:true, changedRows:0, totalRows:0 };
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
      if (String(before[c]) !== String(row[c])) { changedRows++; break; }
    }
  }
  if (changedRows > 0) range.setValues(rows);
  return { success:true, changedRows:changedRows, totalRows:rows.length };
}

function ensureDataInfrastructure_(dataSheet) {
  if (!dataSheet) return;
  if (dataSheet.getMaxColumns() < 9) dataSheet.insertColumnsAfter(dataSheet.getMaxColumns(), 9 - dataSheet.getMaxColumns());
  var header = dataSheet.getRange(1, 1, 1, 9).getValues()[0];
  if (!header[DATA_COL.IS_DELETED]) dataSheet.getRange(1, DATA_COL.IS_DELETED + 1).setValue('IsDeleted');
  if (!header[DATA_COL.ACTION_PERIOD]) dataSheet.getRange(1, DATA_COL.ACTION_PERIOD + 1).setValue('Davri');
}

function ensureWorkflowInfrastructure_(sh) {
  sh.clear(); sh.appendRow(WORKFLOW_HEADERS);
  sh.getRange(1, 1, 1, WORKFLOW_HEADERS.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  sh.appendRow([1, "Loyihachi", "Kiritish", "Yangi", 1]);
  sh.appendRow([2, "Yig'uvchi", "Men yig'dim", "Yig'ildi", 0]);
  sh.appendRow([3, "Qadoqlovchi", "Men qadoqladim", "Tayyor", 0]);
}

function ensurePositionsInfrastructure_(sh) {
  sh.clear(); sh.appendRow(POSITIONS_HEADERS);
  sh.getRange(1, 1, 1, POSITIONS_HEADERS.length).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");
  sh.appendRow(["Loyihachi", "📐"]); sh.appendRow(["Yig'uvchi", "🔧"]); sh.appendRow(["Qadoqlovchi", "📦"]);
}

function getEmployeeRows_() {
  if (_MEMO.empRows) return _MEMO.empRows;
  _MEMO.empRows = getSheets().empSheet.getDataRange().getValues();
  return _MEMO.empRows;
}

function resetEmployeeCache_() {
  _MEMO.empRows = null; _MEMO.usernameMap = null;
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

function migrateHodimlarToV2(hideLegacyColumns) {
  var empSheet = getSheets().empSheet;
  return synchronizeEmployeeRowsToV2_(empSheet, hideLegacyColumns !== false);
}

function initUser(tgId, auth, data) {
  var targetId = String(tgId || '').trim();
  if (!targetId) return { success: false, error: 'TelegramId topilmadi' };
  
  if (typeof autoRegisterPendingUserIfMissing_ === 'function') {
    autoRegisterPendingUserIfMissing_(targetId, data, 'init');
  }
  
  var dataSheet = getSheets().dataSheet;
  var values = dataSheet.getDataRange().getValues();
  var userRecords = [];
  
  var isDeletedFn = (typeof isDeletedRow_ === 'function') ? isDeletedRow_ : function() { return false; };
  var formatFn    = (typeof formatDateCell === 'function') ? formatDateCell : function(v) { return String(v); };
  var apFn        = (typeof parseActionPeriod_ === 'function') ? parseActionPeriod_ : function(v) { return String(v); };

  for (var i = values.length - 1; i > 0; i--) {
    var row = values[i];
    if (isDeletedFn(row)) continue;
    if (String(row[DATA_COL.TG_ID]) === targetId) {
      userRecords.push({
        rowId: i + 1,
        amountUZS: Number(row[DATA_COL.AMOUNT_UZS]) || 0,
        amountUSD: Number(row[DATA_COL.AMOUNT_USD]) || 0,
        rate: Number(row[DATA_COL.RATE]) || 0,
        comment: String(row[DATA_COL.COMMENT] || ''),
        date: formatFn(row[DATA_COL.DATE]),
        actionPeriod: apFn(row[DATA_COL.ACTION_PERIOD])
      });
    }
  }

  var workflowConfig = (typeof getWorkflowConfig === 'function') ? getWorkflowConfig() : [];
  var allPositions   = (typeof getAllPositions === 'function') ? getAllPositions() : [];
  var empList        = (typeof buildUsernameMap === 'function') ? buildUsernameMap() : {};

  return {
    success: true,
    inList: auth.inList,
    username: auth.username,
    canAdd: auth.canAdd,
    isAdmin: auth.isAdmin,
    isSuperAdmin: auth.isSuperAdmin,
    isDirector: auth.isDirector,
    permissions: auth.permissions,
    positions: auth.positions,
    allPositions: allPositions,
    workflowConfig: workflowConfig,
    data: userRecords,
    employeeList: empList
  };
}
