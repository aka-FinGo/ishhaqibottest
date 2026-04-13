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
      isStart:  Number(row[4]) === 1
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
  sh.appendRow(["StepIndex", "PositionName", "ActionLabel", "StatusLabel", "IsStart"]);
  sh.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");

  if (steps && steps.length) {
    steps.forEach((s, idx) => {
      sh.appendRow([
        idx + 1,
        s.position,
        s.action,
        s.status,
        s.isStart ? 1 : 0
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

    var values = sh.getRange(row, 1, 1, sh.getLastColumns()).getValues()[0];
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

    // Update logistics
    logs.push({
      step: nextStep.index,
      uid:  String(actorTgId),
      d:    new Date().toISOString()
    });

    sh.getRange(row, KV_COL.STEP_INDEX + 1).setValue(nextStep.index);
    sh.getRange(row, KV_COL.STATUS     + 1).setValue(nextStep.status);
    sh.getRange(row, KV_COL.STEP_LOGS  + 1).setValue(JSON.stringify(logs));

    return { success: true };
  });
}
