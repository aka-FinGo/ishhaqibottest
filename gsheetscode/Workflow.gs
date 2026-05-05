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
 * Validates and processes a specific step in an order's workflow.
 * Now supports independent step completion (steps can be done out of order).
 */
function processWorkflowStep(rowId, auth, actorTgId, targetStepIndex) {
  return withWriteLock_(function() {
    var sh = getKvadratSheet();
    var row = parseInt(rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) return { success: false, error: 'Buyurtma topilmadi' };

    var values = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    var logs = [];
    try {
      logs = JSON.parse(values[KV_COL.STEP_LOGS] || '[]');
    } catch(e) {}

    var config = getWorkflowConfig();
    var isStrict = getWorkflowStrictMode();
    
    // If targetStepIndex is not provided, try to find the next sequential step
    var currentStepIdx = Number(values[KV_COL.STEP_INDEX]) || 1;
    var stepToProcess = targetStepIndex ? config.find(s => s.index === Number(targetStepIndex)) : config.find(s => s.index === currentStepIdx + 1);

    if (!stepToProcess) return { success: false, error: 'Bajariladigan bosqich topilmadi' };
    
    // STRICT MODE CHECK: If strict, must follow order (currentStepIdx + 1)
    if (isStrict && stepToProcess.index !== currentStepIdx + 1) {
      return { success: false, error: 'Qat\'iy tartib yoqilgan. Siz faqat keyingi bosqichni (' + (currentStepIdx + 1) + ') tasdiqlay olasiz.' };
    }

    // Check if this specific step is already done
    if (logs.some(l => l.step === stepToProcess.index)) {
      return { success: false, error: 'Ushbu bosqich avval tasdiqlangan' };
    }

    // Permission Check: Does user have the required technical position?
    var userPositions = auth.positions || [];
    if (!auth.isSuperAdmin && (!userPositions.indexOf || userPositions.indexOf(stepToProcess.position) === -1)) {
      return { success: false, error: 'Sizda "' + stepToProcess.position + '" lavozimi yo\'q' };
    }

    // Group Leader Check (for steps > 1)
    if (stepToProcess.index > 1 && !auth.isSuperAdmin) {
       if (!auth.isSardor) {
         return { success: false, error: 'Faqat "Guruh Sardori" ushbu bosqichni tasdiqlay oladi' };
       }
    }

    // Update logistics
    logs.push({
      step: stepToProcess.index,
      uid:  String(actorTgId),
      d:    new Date().toISOString(),
      group: auth.group || ''
    });

    // Update the main status only if this step is "next" or "higher" than current, 
    // or if we want the status to reflect the "latest" activity.
    // For now, let's update status if it's a step > currentStepIdx
    if (stepToProcess.index > currentStepIdx) {
      sh.getRange(row, KV_COL.STEP_INDEX + 1).setValue(stepToProcess.index);
      sh.getRange(row, KV_COL.STATUS     + 1).setValue(stepToProcess.status);
    }
    
    sh.getRange(row, KV_COL.STEP_LOGS  + 1).setValue(JSON.stringify(logs));

    // Update Dynamic Columns in Kvadratlar sheet
    if (stepToProcess.index > 1) {
       // Calculation: Base columns (0-11) are 12. Dynamic start at index 12.
       // Step 2 starts at col 12, Step 3 at 16, etc. (4 columns per step)
       var startColIdx = 12 + (stepToProcess.index - 2) * 4;
       
       var userName = auth.username || 'Noma\'lum';
       if (auth.group) userName += " (" + auth.group + ")";
       
       var totalM2 = Number(values[KV_COL.TOTAL_M2]) || 0;
       
       // Check if column exists (sanity check)
       if (sh.getLastColumn() >= startColIdx + 4) {
         sh.getRange(row, startColIdx + 1).setValue(userName);      // Hodim
         sh.getRange(row, startColIdx + 2).setValue(String(actorTgId)); // Hodim ID
         sh.getRange(row, startColIdx + 3).setValue(totalM2);      // m2
         sh.getRange(row, startColIdx + 4).setValue(new Date());   // Sana
         
         // Format the newly filled columns
         sh.getRange(row, startColIdx + 1).setNumberFormat('@'); // Text
         sh.getRange(row, startColIdx + 2).setNumberFormat('@'); // Text ID
         sh.getRange(row, startColIdx + 3).setNumberFormat('0.00'); // m2
         sh.getRange(row, startColIdx + 4).setNumberFormat('dd.mm.yyyy HH:mm'); // Date
       }
    }

    return { success: true };
  });
}
