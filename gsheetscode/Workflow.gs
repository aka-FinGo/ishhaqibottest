// ============================================================
// Workflow.gs — Dynamic Process Logic
// ============================================================

/**
 * Gets the current workflow configuration from the sheet.
 */
function getWorkflowConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("WorkflowSteps");
  if (!sh) return [];

  var data = sh.getDataRange().getValues();
  var steps = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    steps.push({
      index:    Number(row[0]),
      position: String(row[1] || '').trim(),
      action:   String(row[2] || '').trim(),
      status:   String(row[3] || '').trim(),
      isStart:  Number(row[4]) === 1,
      isEnd:    Number(row[5]) === 1
    });
  }
  
  // Sort by index just in case
  steps.sort((a, b) => a.index - b.index);
  return steps;
}

/**
 * Saves the workflow configuration from Admin panel.
 */
function saveWorkflowConfig(steps) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("WorkflowSteps");
  if (!sh) sh = ss.insertSheet("WorkflowSteps");

  sh.clear();
  sh.appendRow(["StepIndex", "PositionName", "ActionLabel", "StatusLabel", "IsStart", "IsEnd"]);
  sh.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");

  if (steps && steps.length) {
    steps.forEach((s, idx) => {
      sh.appendRow([
        idx + 1,
        s.position,
        s.action,
        s.status,
        s.isStart ? 1 : 0,
        s.isEnd ? 1 : 0
      ]);
    });
  }
  return { success: true };
}

/**
 * Validates and processes the next step in an order's workflow.
 */
function processWorkflowStep(rowId, auth, actorTgId) {
  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) return { success: false, error: 'Buyurtma topilmadi' };

    var values = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    var currentStepIdx = Number(values[KV_COL.STEP_INDEX]) || 1;
    var logs = [];
    try {
      logs = JSON.parse(values[KV_COL.STEP_LOGS] || '[]');
    } catch(e) {}

    var config = getWorkflowConfig();
    var nextStep = config.find(s => s.index === currentStepIdx + 1);

    if (!nextStep) return { success: false, error: 'Ushbu buyurtma yakuniga yetgan' };

    // Permission Check: Does user have the required technical position?
    var userPositions = auth.positions || [];
    if (!auth.isSuperAdmin && (!userPositions.indexOf || userPositions.indexOf(nextStep.position) === -1)) {
      return { success: false, error: 'Sizda "' + nextStep.position + '" lavozimi yo\'q' };
    }

    // Group Leader Check (for steps > 1)
    if (nextStep.index > 1 && !auth.isSuperAdmin) {
       // User says: "Qaqoqlovchi va yig`uvchi va boshqa yangi qo`shiladigan lavozimlar uchun... guruh sardoriga metr kvadrat hisoblanishi kerak"
       if (!auth.isSardor) {
         return { success: false, error: 'Faqat "Guruh Sardori" ushbu bosqichni tasdiqlay oladi' };
       }
    }

    // Update logistics
    logs.push({
      step: nextStep.index,
      uid:  String(actorTgId),
      d:    new Date().toISOString(),
      group: auth.group || ''
    });

    sh.getRange(row, KV_COL.STEP_INDEX + 1).setValue(nextStep.index);
    sh.getRange(row, KV_COL.STATUS     + 1).setValue(nextStep.status);
    sh.getRange(row, KV_COL.STEP_LOGS  + 1).setValue(JSON.stringify(logs));

    // Update Dynamic Columns in Kvadratlar sheet
    if (nextStep.index > 1) {
       // Calculation: Base columns (0-11) are 12. Dynamic start at index 12.
       // Step 2 starts at col 12, Step 3 at 15, etc.
       var startColIdx = 12 + (nextStep.index - 2) * 4;
       
       var userName = auth.username || 'Noma\'lum';
       if (auth.group) userName += " (" + auth.group + ")";
       
       var totalM2 = Number(values[KV_COL.TOTAL_M2]) || 0;
       
       // Check if column exists (sanity check)
       if (sh.getLastColumn() >= startColIdx + 4) {
         sh.getRange(row, startColIdx + 1).setValue(userName);      // Hodim
         sh.getRange(row, startColIdx + 2).setValue(String(actorTgId)); // Hodim ID
         sh.getRange(row, startColIdx + 3).setValue(totalM2);      // m2
         sh.getRange(row, startColIdx + 4).setValue(new Date());   // Sana
       }
    }

    return { success: true };
  });
}
