// ============================================================
// DATABASE.GS — Core Infrastructure and Initialization
// OPTIMIZED: Batch operations, improved caching
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
  LAVOZIM:      12,
  GURUH:        13,
  IS_SARDOR:    14
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
  usernameMap: null,
  dataRows: null,
  dataTimestamp: 0
};

var CACHE_TTL = 300; // 5 minutes cache for data rows

var EMP_HEADERS = [
  "TelegramId","Username","CanAdd",
  "SuperAdmin","Direktor","Admin",
  "canViewAll","canEdit","canDelete","canExport","canViewDash",
  "Role", "Lavozim", "Guruh", "IsSardor"
];

var WORKFLOW_HEADERS = [
  "StepIndex", "PositionName", "ActionLabel", "StatusLabel", "IsStart"
];

var POSITIONS_HEADERS = [
  "PositionName", "Icon"
];

function getSheets() {
  if (_MEMO.sheets) return _MEMO.sheets;
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
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
  var aiSheet = ss.getSheetByName("AI_Sozlamalar");
  if (!aiSheet) {
    aiSheet = ss.insertSheet("AI_Sozlamalar");
    ensureAIInfrastructure_(aiSheet);
  }
  _MEMO.sheets = { dataSheet: dataSheet, empSheet: empSheet, workflowSheet: workflowSheet, positionsSheet: positionsSheet, aiSheet: aiSheet };
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
    
    // Simple Model: Read from Role and effective columns
    var role = normalizeRole_(row[COL.ROLE], row);
    var model = buildModelFromRoleAndOverrides_(role, null);
    
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

function ensureAIInfrastructure_(sh) {
  sh.clear();
  var headers = ["Provider", "Model", "API_Key", "Priority", "IsActive", "BaseURL"];
  sh.appendRow(headers);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#7e22ce").setFontColor("#ffffff");
  
  // Default providers
  sh.appendRow(["Groq", "llama3-70b-8192", "", 1, 1, "https://api.groq.com/openai/v1/chat/completions"]);
  sh.appendRow(["Gemini", "gemini-1.5-flash", "", 2, 1, "https://generativelanguage.googleapis.com/v1beta/models/"]);
  sh.appendRow(["OpenRouter", "google/gemini-pro-1.5", "", 3, 0, "https://openrouter.ai/api/v1/chat/completions"]);
  sh.appendRow(["Ollama", "llama3", "", 4, 0, "http://localhost:11434/api/generate"]);
}

function getDataRows_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("db_data_rows");
  if (cached) return JSON.parse(cached);

  var range = getSheets().dataSheet.getName() + "!A:Z";
  var res = Sheets.Spreadsheets.Values.get(CONFIG.SPREADSHEET_ID, range);
  var values = res.values || [];
  
  cache.put("db_data_rows", JSON.stringify(values), CACHE_TTL);
  return values;
}

function resetDataCache_() {
  CacheService.getScriptCache().remove("db_data_rows");
  _MEMO.dataRows = null;
  _MEMO.dataTimestamp = 0;
}

function getEmployeeRows_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("db_emp_rows");
  if (cached) return JSON.parse(cached);

  var range = "Hodimlar!A:Z";
  var res = Sheets.Spreadsheets.Values.get(CONFIG.SPREADSHEET_ID, range);
  var values = res.values || [];

  cache.put("db_emp_rows", JSON.stringify(values), CACHE_TTL);
  return values;
}

function resetEmployeeCache_() {
  CacheService.getScriptCache().remove("db_emp_rows");
  _MEMO.empRows = null; 
  _MEMO.usernameMap = null;
}

function resetAllCaches_() {
  resetEmployeeCache_();
  resetDataCache_();
  _MEMO.sheets = null;
}

function getAuditSheet_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
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
  
  // OPTIMIZED: Use cached data rows instead of fresh read
  var values = getDataRows_();
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
        telegramId: targetId,
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

  // employeeList: to'liq hodimlar array (renderHodimlarList uchun {tgId, username, role, ...})
  // Avval buildUsernameMap() (object) yuborilardi — bu renderHodimlarList ni buzardi
  var employeeListFull = (typeof getHodimlar === 'function') ? (getHodimlar().data || getHodimlar()) : [];
  // getHodimlar() ba'zan { data: [...] } ba'zan to'g'ridan array qaytarishi mumkin
  if (!Array.isArray(employeeListFull) && employeeListFull.data) {
    employeeListFull = employeeListFull.data;
  }

  return {
    success: true,
    inList: auth.inList,
    username: auth.username,
    canAdd: auth.canAdd,
    isAdmin: auth.isAdmin,
    isSuperAdmin: auth.isSuperAdmin,
    isDirector: auth.isDirector,
    isSardor: !!auth.isSardor,
    permissions: auth.permissions,
    positions: auth.positions,
    allPositions: allPositions,
    workflowConfig: workflowConfig,
    isWorkflowStrict: getWorkflowStrictMode(),
    data: userRecords,
    employeeList: employeeListFull,
    dataVersions: (typeof getDataVersions === 'function') ? getDataVersions() : {}
  };
}

/**
 * Global Workflow Settings
 */
function getWorkflowStrictMode() {
  var p = PropertiesService.getScriptProperties();
  return p.getProperty('WORKFLOW_STRICT_MODE') === '1';
}

function setWorkflowStrictMode(isStrict) {
  var p = PropertiesService.getScriptProperties();
  p.setProperty('WORKFLOW_STRICT_MODE', isStrict ? '1' : '0');
  return { success: true };
}

/**
 * GET_ADMIN_INIT_DATA
 * Fetches all necessary data for Admin Panel in one go.
 */
function getAdminInitData(actorTgId) {
  var auth = checkUserRoles(actorTgId);
  var isAdmin = auth.isSuperAdmin || auth.isAdmin || auth.isDirector;
  
  if (!isAdmin) {
    return { success: false, error: "Admin ruxsati yo'q" };
  }

  return {
    success: true,
    employees: getHodimlar().data || [],
    positions: getAllPositions() || [],
    workflowSteps: getWorkflowConfig() || [],
    isWorkflowStrict: getWorkflowStrictMode()
  };
}