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
    var sIndex = Number(row[0]);
    var sId = String(row[6] || '').trim();
    if (!sId) sId = "step_" + sIndex; // Migratsiya qilinmagan bo'lsa, qutqaruvchi ID
    
    steps.push({
      index:    sIndex,
      positionId: String(row[1] || '').trim(), // PositionName o'rniga endi PositionID o'qiymiz
      action:   String(row[2] || '').trim(),
      status:   String(row[3] || '').trim(),
      isStart:  Number(row[4]) === 1,
      isEnd:    Number(row[5]) === 1,
      stepId:   sId,
      colStart: Number(row[7]) || 0,
      assignedTgId: String(row[8] || '').trim()
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

  var existing = getWorkflowConfig();
  var maxColStart = 12; // first dynamic step starts at 12
  existing.forEach(function(e) {
    if (e.colStart >= maxColStart) maxColStart = e.colStart + 4;
  });

  sh.clear();
  sh.appendRow(["StepIndex", "PositionID", "ActionLabel", "StatusLabel", "IsStart", "IsEnd", "StepID", "ColStart", "AssignedTgId"]);
  sh.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff");

  if (steps && steps.length) {
    steps.forEach((s, idx) => {
      var stepId = s.stepId;
      var colStart = Number(s.colStart) || 0;
      
      // Yangi qo'shilgan bosqich bo'lsa (ID si yo'q)
      if (!stepId) {
        stepId = "step_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
        if (idx === 0) {
          colStart = 0; // Birinchi bosqichga dinamik ustun kerak emas
        } else {
          colStart = maxColStart;
          maxColStart += 4;
        }
      }

      sh.appendRow([
        idx + 1,
        s.positionId,
        s.action,
        s.status,
        s.isStart ? 1 : 0,
        s.isEnd ? 1 : 0,
        stepId,
        colStart,
        s.assignedTgId || ''
      ]);
    });
  }
  incrementDataVersion();
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
    
    // Joriy bosqichni ID orqali qidirish (agar hali migratsiya bo'lmagan bo'lsa raqam orqali)
    var currentStepVal = String(values[KV_COL.STEP_INDEX] || '').trim();
    var currentStepIndexInArray = config.findIndex(s => s.stepId === currentStepVal);
    if (currentStepIndexInArray === -1 && !isNaN(parseInt(currentStepVal, 10))) {
        currentStepIndexInArray = config.findIndex(s => s.index === Number(currentStepVal));
    }
    if (currentStepIndexInArray === -1) currentStepIndexInArray = 0; // Agar topilmasa 1-bosqich deb faraz qilamiz
    
    var currentStepConfig = config[currentStepIndexInArray] || config[0];

    // If targetStepIndex is passed (it might be a StepID now), use it. Otherwise, next step.
    var stepToProcess;
    if (targetStepIndex) {
        stepToProcess = config.find(s => s.stepId === String(targetStepIndex) || s.index === Number(targetStepIndex));
    } else {
        stepToProcess = config[currentStepIndexInArray + 1];
    }

    if (!stepToProcess) return { success: false, error: 'Bajariladigan bosqich topilmadi' };
    
    // STRICT MODE CHECK
    if (isStrict && config.indexOf(stepToProcess) !== currentStepIndexInArray + 1) {
      return { success: false, error: 'Qat\'iy tartib yoqilgan. Siz faqat keyingi bosqichni tasdiqlay olasiz.' };
    }

    // Check if this specific step is already done (by stepId)
    if (logs.some(l => l.stepId === stepToProcess.stepId || l.step === stepToProcess.index)) {
      return { success: false, error: 'Ushbu bosqich avval tasdiqlangan' };
    }

    // Permission Check: Specific user or PositionID?
    if (!auth.isSuperAdmin) {
      if (stepToProcess.assignedTgId) {
        if (String(actorTgId) !== String(stepToProcess.assignedTgId)) {
          return { success: false, error: 'Bu bosqich faqat maxsus biriktirilgan xodim uchun ruxsat etilgan' };
        }
      } else {
        var userPositions = auth.positions || [];
        if (!userPositions.indexOf || userPositions.indexOf(stepToProcess.positionId) === -1) {
          return { success: false, error: 'Sizda bu bosqich uchun tegishli lavozim yo\'q' };
        }
      }
    }

    // Group Leader Check (for steps > 1)
    if (config.indexOf(stepToProcess) > 0 && !auth.isSuperAdmin) {
       if (!auth.isSardor) {
         return { success: false, error: 'Faqat "Guruh Sardori" ushbu bosqichni tasdiqlay oladi' };
       }
    }

    // Update logistics
    logs.push({
      stepId: stepToProcess.stepId,
      step: stepToProcess.index, // backward compatibility
      uid:  String(actorTgId),
      d:    new Date().toISOString(),
      group: auth.group || ''
    });

    // Faqat yuqori bosqichga o'tilayotgan bo'lsa asosiy statusni o'zgartiramiz
    if (config.indexOf(stepToProcess) > currentStepIndexInArray) {
      sh.getRange(row, KV_COL.STEP_INDEX + 1).setValue(stepToProcess.stepId); // Save ID, not index
      sh.getRange(row, KV_COL.STATUS     + 1).setValue(stepToProcess.status);
    }
    
    sh.getRange(row, KV_COL.STEP_LOGS  + 1).setValue(JSON.stringify(logs));

    // Update Dynamic Columns in Kvadratlar sheet based on ColStart
    if (stepToProcess.colStart > 0) {
       var startColIdx = stepToProcess.colStart; // e.g. 12 (0-indexed base, so column 13)
       
       var userName = auth.username || 'Noma\'lum';
       if (auth.group) userName += " (" + auth.group + ")";
       
       var totalM2 = Number(values[KV_COL.TOTAL_M2]) || 0;
       
       if (sh.getLastColumn() >= startColIdx + 4) {
         sh.getRange(row, startColIdx + 1).setValue(userName);      // Hodim
         sh.getRange(row, startColIdx + 2).setValue(String(actorTgId)); // Hodim ID
         sh.getRange(row, startColIdx + 3).setValue(totalM2);      // m2
         sh.getRange(row, startColIdx + 4).setValue(new Date());   // Sana
       }
    }

    incrementDataVersion();
    return { success: true };
  });
}
