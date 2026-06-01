// ============================================================
// Workflow.gs — Dynamic Process Logic
// ============================================================

/**
 * Gets the current workflow configuration from the sheet.
 */
function getWorkflowConfig() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("workflow_config");
  if (cached) return JSON.parse(cached);

  var range = "WorkflowSteps!A:F";
  var res = Sheets.Spreadsheets.Values.get(CONFIG.SPREADSHEET_ID, range);
  var data = res.values || [];
  
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
  steps.sort((a, b) => a.index - b.index);
  
  cache.put("workflow_config", JSON.stringify(steps), 21600);
  return steps;
}

/**
 * Saves the workflow configuration from Admin panel.
 */
function saveWorkflowConfig(steps) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName("WorkflowSteps");
  if (!sh) sh = ss.insertSheet("WorkflowSteps");

  sh.clear();
  var headers = ["StepIndex", "PositionName", "ActionLabel", "StatusLabel", "IsStart", "IsEnd"];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");

  if (steps && steps.length) {
    var output = steps.map((s, idx) => [
      idx + 1,
      s.position,
      s.action,
      s.status,
      s.isStart ? 1 : 0,
      s.isEnd ? 1 : 0
    ]);
    sh.getRange(2, 1, output.length, headers.length).setValues(output);
  }
  CacheService.getScriptCache().remove("workflow_config");
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
    var userPositions = (auth.positions || []).map(function(p) { return normalizePos_(p); });
    var stepPos = normalizePos_(stepToProcess.position);

    if (userPositions.indexOf(stepPos) === -1) {
      return { success: false, error: 'Sizda "' + stepToProcess.position + '" lavozimi yo\'q' };
    }

    // Update logistics
    logs.push({
      step: stepToProcess.index,
      uid:  String(actorTgId),
      u:    auth.username || 'Noma\'lum',
      d:    new Date().toISOString(),
      group: auth.group || ''
    });

    // Sort logs by step index to maintain logical sequence regardless of completion order
    logs.sort(function(a, b) {
      return (Number(a.step) || 0) - (Number(b.step) || 0);
    });

    // Update the main status only if this step is the highest completed step so far
    var maxStepDone = logs.reduce(function(max, l) { return Math.max(max, Number(l.step) || 0); }, 0);
    
    if (maxStepDone >= currentStepIdx) {
      var latestStepCfg = config.find(function(s) { return s.index === maxStepDone; });
      if (latestStepCfg) {
        sh.getRange(row, KV_COL.STEP_INDEX + 1).setValue(latestStepCfg.index);
        sh.getRange(row, KV_COL.STATUS     + 1).setValue(latestStepCfg.status);
      }
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

/**
 * Reverts the last workflow step (or reverts to a target step index).
 * Allows the actor to undo their own last action within a short window,
 * or allows SuperAdmin to revert at any time.
 */
function revertWorkflowStep(rowId, auth, actorTgId, targetStepIndex, reason) {
  return withWriteLock_(function() {
    var UNDO_WINDOW_MINUTES = 15; // how long the actor can undo their own action
    var sh = getKvadratSheet();
    var row = parseInt(rowId, 10);
    if (!row || row <= 1 || row > sh.getLastRow()) return { success: false, error: 'Buyurtma topilmadi' };

    var values = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    var rawLogs = values[KV_COL.STEP_LOGS] || '[]';
    var logs = [];
    try { logs = JSON.parse(rawLogs || '[]'); } catch(e) { logs = []; }
    if (!logs.length) return { success: false, error: 'Tarixda hech qanday bosqich topilmadi' };

    // Decide which steps to remove
    var stepsToRemove = [];
    if (targetStepIndex) {
      targetStepIndex = Number(targetStepIndex);
      // remove all logs with step >= targetStepIndex
      stepsToRemove = logs.filter(function(l) { return Number(l.step) >= targetStepIndex; }).map(function(l) { return Number(l.step); });
    } else {
      // remove only the last logged numeric step
      var last = logs[logs.length - 1];
      var lastStepNum = Number(last.step) || null;
      if (!lastStepNum) return { success:false, error: "Oxirgi yozuvni bekor qilib bo'lmaydi" };
      stepsToRemove = [ lastStepNum ];
    }

    if (!stepsToRemove.length) return { success:false, error: 'Bekor qilinadigan bosqich topilmadi' };

    // Permission: allow if SuperAdmin, otherwise allow only if actor is the one who did the last step and within UNDO_WINDOW
    var lastLog = logs[logs.length - 1];
    var actorIsLast = String(lastLog.uid || lastLog.id || lastLog.uid) === String(actorTgId);
    if (!auth.isSuperAdmin && !actorIsLast) {
      return { success:false, error: 'Faqat SuperAdmin yoki oxirgi amalga oshirgan xodim bekor qila oladi' };
    }
    if (!auth.isSuperAdmin && actorIsLast) {
      var ts = new Date(lastLog.d || '').getTime();
      if (!ts || (new Date().getTime() - ts) > UNDO_WINDOW_MINUTES * 60000) {
        return { success:false, error: "Bekor qilish muddati o'tib ketgan" };
      }
    }

    // Keep a copy for audit
    var beforeObj = { stepIndex: Number(values[KV_COL.STEP_INDEX]) || 1, status: String(values[KV_COL.STATUS] || ''), logs: logs.slice() };

    // Remove logs with the steps in stepsToRemove
    var remaining = logs.filter(function(l) { return stepsToRemove.indexOf(Number(l.step)) === -1; });

    // Recompute max done step
    var maxStepDone = remaining.reduce(function(max, l) { return Math.max(max, Number(l.step) || 0); }, 0);
    if (maxStepDone > 0) {
      var cfg = getWorkflowConfig();
      var latestStepCfg = cfg.find(function(s) { return s.index === maxStepDone; });
      if (latestStepCfg) {
        sh.getRange(row, KV_COL.STEP_INDEX + 1).setValue(latestStepCfg.index);
        sh.getRange(row, KV_COL.STATUS     + 1).setValue(latestStepCfg.status);
      }
    } else {
      // Reset to start
      sh.getRange(row, KV_COL.STEP_INDEX + 1).setValue(1);
      sh.getRange(row, KV_COL.STATUS     + 1).setValue('yangi');
    }

    // Clear dynamic columns for removed steps (only for steps > 1)
    var uniqueSteps = Array.from(new Set(stepsToRemove)).sort(function(a,b){return a-b;});
    uniqueSteps.forEach(function(step) {
      if (step > 1) {
        var startColIdx = 12 + (step - 2) * 4; // 0-based in Workflow.gs logic
        // startColIdx + 1 since sheet API is 1-indexed
        try {
          if (sh.getLastColumn() >= startColIdx + 4) {
            sh.getRange(row, startColIdx + 1, 1, 4).clearContent();
          }
        } catch(e) { /* ignore clearing errors */ }
      }
    });

    // Update logs cell
    sh.getRange(row, KV_COL.STEP_LOGS + 1).setValue(JSON.stringify(remaining));

    var afterObj = { stepIndex: Number(sh.getRange(row, KV_COL.STEP_INDEX + 1).getValue()) || 1, status: String(sh.getRange(row, KV_COL.STATUS + 1).getValue() || ''), logs: remaining };
    var note = 'Reverted steps: ' + uniqueSteps.join(', ');
    if (reason) note += ' | reason: ' + String(reason).slice(0, 300);
    addAuditLog_(actorTgId, 'kvadrat_revert', row, beforeObj, afterObj, note);

    return { success: true };
  });
}

function normalizePos_(pos) {
  if (!pos) return '';
  return String(pos).toLowerCase().trim();
}
