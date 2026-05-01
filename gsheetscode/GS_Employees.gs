// ============================================================
// GS_Employees.gs — Employee Management Logic
// ============================================================

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
      overrideCanViewDash: access.overrides.canViewDash,
      positions:           String(rows[i][COL.LAVOZIM] || '').split(',').map(function(s){return s.trim();}).filter(Boolean),
      group:               String(rows[i][COL.GURUH]   || '').trim(),
      isSardor:            String(rows[i][COL.IS_SARDOR]) == "1" || rows[i][COL.IS_SARDOR] === true ? 1 : 0
    });
  }
  
  // Add Config Super Admin if not in list
  var superAdminId = String((CONFIG && CONFIG.SUPER_ADMIN_ID) || '');
  if (superAdminId && !result.some(function(e){ return e.tgId === superAdminId; })) {
    result.push({
      sheetRow:    -1,
      tgId:        superAdminId,
      username:    String((CONFIG && CONFIG.SUPER_ADMIN_NAME) || 'SuperAdmin'),
      role:        'SuperAdmin',
      isSuperAdmin: 1,
      isAdmin:     1,
      positions:   ['Loyihachi', 'Yig\'uvchi', 'Qadoqlovchi'], // All positions for config admin
      group:       'ADMIN',
      isSardor:    1
    });
  }

  return { success: true, data: result };
}

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
        overrides:   access.overrides,
        positions:   String(rows[i][COL.LAVOZIM] || '').split(',').map(function(s){return s.trim();}).filter(Boolean),
        group:       String(rows[i][COL.GURUH] || '').trim(),
        isSardor:    String(rows[i][COL.IS_SARDOR]) == "1" || rows[i][COL.IS_SARDOR] === true
      };
    }
  }
  return null;
}

function addHodim(data) {
  return withWriteLock_(function () {
    if (isConfigSuperAdminId_(data.tgId)) {
      return { success:false, error:"Config SUPER_ADMIN_ID ilovadan qo'shilmaydi/o'zgarmaydi." };
    }
    var empSheet = getSheets().empSheet;
    var rows     = getEmployeeRows_();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.tgId)) return { success: false, error: "Bu ID allaqachon ro'yxatda!" };
    }
    var cfg = resolveRoleAndOverridesFromPayload_(data, null);
    var eff = cfg.effective;
    var newRow = new Array(EMP_HEADERS.length).fill('');
    newRow[COL.TG_ID]        = String(data.tgId || '').trim();
    newRow[COL.USERNAME]     = data.username || 'Yangi Xodim';
    newRow[COL.CAN_ADD]      = eff.canAdd ? 1 : 0;
    newRow[COL.SUPER_ADMIN]  = eff.isSuperAdmin ? 1 : 0;
    newRow[COL.DIREKTOR]     = eff.isDirektor ? 1 : 0;
    newRow[COL.ADMIN]        = (eff.isAdmin && !eff.isSuperAdmin) ? 1 : 0;
    newRow[COL.VIEW_ALL]     = eff.permissions.canViewAll ? 1 : 0;
    newRow[COL.EDIT]         = eff.permissions.canEdit ? 1 : 0;
    newRow[COL.DELETE]       = eff.permissions.canDelete ? 1 : 0;
    newRow[COL.EXPORT]       = eff.permissions.canExport ? 1 : 0;
    newRow[COL.VIEW_DASH]    = eff.permissions.canViewDash ? 1 : 0;
    newRow[COL.ROLE]         = cfg.role;
    newRow[COL.OVR_CAN_ADD]  = overrideToCellValue_(cfg.overrides.canAdd);
    newRow[COL.OVR_VIEW_ALL] = overrideToCellValue_(cfg.overrides.canViewAll);
    newRow[COL.OVR_EDIT]     = overrideToCellValue_(cfg.overrides.canEdit);
    newRow[COL.OVR_DELETE]   = overrideToCellValue_(cfg.overrides.canDelete);
    newRow[COL.OVR_EXPORT]   = overrideToCellValue_(cfg.overrides.canExport);
    newRow[COL.OVR_VIEW_DASH]= overrideToCellValue_(cfg.overrides.canViewDash);
    newRow[COL.LAVOZIM]      = data.lavozim || '';
    newRow[COL.GURUH]        = data.guruh || '';
    newRow[COL.IS_SARDOR]    = data.isSardor ? 1 : 0;
    empSheet.appendRow(newRow);
    resetEmployeeCache_();
    return { success: true };
  });
}

function updateHodim(data) {
  return withWriteLock_(function () {
    if (isConfigSuperAdminId_(data.tgId)) return { success:false, error:"Config SUPER_ADMIN_ID ruxsatlarini o'zgartirib bo'lmaydi." };
    var empSheet = getSheets().empSheet;
    var rows     = getEmployeeRows_();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.tgId)) {
        var r = i + 1;
        var cfg = resolveRoleAndOverridesFromPayload_(data, rows[i]);
        var eff = cfg.effective;
        var updateRow = new Array(EMP_HEADERS.length);
        updateRow[COL.TG_ID]        = String(data.tgId || '').trim();
        updateRow[COL.USERNAME]     = data.username || '';
        updateRow[COL.CAN_ADD]      = eff.canAdd ? 1 : 0;
        updateRow[COL.SUPER_ADMIN]  = eff.isSuperAdmin ? 1 : 0;
        updateRow[COL.DIREKTOR]     = eff.isDirektor ? 1 : 0;
        updateRow[COL.ADMIN]        = (eff.isAdmin && !eff.isSuperAdmin) ? 1 : 0;
        updateRow[COL.VIEW_ALL]     = eff.permissions.canViewAll ? 1 : 0;
        updateRow[COL.EDIT]         = eff.permissions.canEdit ? 1 : 0;
        updateRow[COL.DELETE]       = eff.permissions.canDelete ? 1 : 0;
        updateRow[COL.EXPORT]       = eff.permissions.canExport ? 1 : 0;
        updateRow[COL.VIEW_DASH]    = eff.permissions.canViewDash ? 1 : 0;
        updateRow[COL.ROLE]         = cfg.role;
        updateRow[COL.OVR_CAN_ADD]  = overrideToCellValue_(cfg.overrides.canAdd);
        updateRow[COL.OVR_VIEW_ALL] = overrideToCellValue_(cfg.overrides.canViewAll);
        updateRow[COL.OVR_EDIT]     = overrideToCellValue_(cfg.overrides.canEdit);
        updateRow[COL.OVR_DELETE]   = overrideToCellValue_(cfg.overrides.canDelete);
        updateRow[COL.OVR_EXPORT]   = overrideToCellValue_(cfg.overrides.canExport);
        updateRow[COL.OVR_VIEW_DASH]= overrideToCellValue_(cfg.overrides.canViewDash);
        updateRow[COL.LAVOZIM]      = data.lavozim || '';
        updateRow[COL.GURUH]        = data.guruh || '';
        updateRow[COL.IS_SARDOR]    = data.isSardor ? 1 : 0;
        empSheet.getRange(r, 1, 1, EMP_HEADERS.length).setValues([updateRow]);
        resetEmployeeCache_();
        return { success: true };
      }
    }
    return { success: false, error: "Hodim topilmadi" };
  });
}

function deleteHodim(tgId) {
  return withWriteLock_(function () {
    if (isConfigSuperAdminId_(tgId)) return { success:false, error:"Config SUPER_ADMIN_ID ni o'chirib bo'lmaydi." };
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

function buildUsernameMap() {
  if (_MEMO.usernameMap) return _MEMO.usernameMap;
  var rows = getEmployeeRows_();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var tgId = String(rows[i][COL.TG_ID] || '').trim();
    var uname = String(rows[i][COL.USERNAME] || '').trim();
    if (tgId && uname) map[tgId] = uname;
  }
  _MEMO.usernameMap = map;
  return map;
}

function autoRegisterPendingUserIfMissing_(tgId, data, source) {
  var targetId = String(tgId || '').trim();
  if (!targetId) return { success:false, created:false };
  if (isConfigSuperAdminId_(targetId)) return { success:true, created:false };
  var displayName = buildPendingUsername_(data, targetId);
  var created = false;
  var writeRes = withWriteLock_(function () {
    resetEmployeeCache_();
    var existing = getEmployee(targetId);
    if (existing) return { success:true, created:false };
    var empSheet = getSheets().empSheet;
    empSheet.appendRow([targetId, displayName, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'EMPLOYEE', 0, '', '', '', '', '', '']);
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
              "📍 Manba: " + String(source || 'init');
    sendSystemAlert(msg);
  } catch (e) {}
}

function listNotifyUsers() {
  var rows = getEmployeeRows_();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var tgId = String(rows[i][COL.TG_ID] || '').trim();
    if (!tgId || isConfigSuperAdminId_(tgId)) continue;
    var access = resolveEmployeeAccessFromRow_(rows[i]);
    out.push({ tgId: tgId, username: String(rows[i][COL.USERNAME] || ''), role: access.roleKey, canAdd: access.canAdd ? 1 : 0 });
  }
  out.sort(function(a,b){ return String(a.username).toLowerCase() < String(b.username).toLowerCase() ? -1 : 1; });
  return { success:true, data: out };
}

function getInactiveUsers(days) {
  var threshold = toPositiveInt_(days, 14, 1, 365);
  var notifyUsers = listNotifyUsers();
  if (!notifyUsers.success) return notifyUsers;
  var latestMap = getLatestActionDatesByTgId_ ? getLatestActionDatesByTgId_() : {};
  var now = new Date();
  now.setHours(0,0,0,0);
  var out = [];
  for (var i = 0; i < notifyUsers.data.length; i++) {
    var user = notifyUsers.data[i];
    if (Number(user.canAdd) !== 1) continue;
    var lastDate = latestMap[user.tgId] || null;
    var inactiveDays = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : 9999;
    if (inactiveDays >= threshold) {
      out.push({ tgId: user.tgId, username: user.username, role: user.role, lastActionDate: lastDate ? formatDateCell(lastDate) : '', inactiveDays: inactiveDays });
    }
  }
  return { success:true, data: out };
}

function getReminderTextSetting(tgId) {
  var text = (typeof getReminderTemplate_ === 'function') ? getReminderTemplate_() : '';
  return { success:true, text: text };
}

function setReminderTextSetting(text, actorTgId) {
  var saved = setReminderTemplate_ ? setReminderTemplate_(text) : null;
  addAuditLog_(actorTgId, 'set_reminder_text', '', null, { length: String(text).length }, 'updated');
  return { success:true, text: saved };
}

function sendUserReminder(tgId, actorTgId, reminderText) {
  var emp = getEmployee(tgId);
  var res = (typeof sendSalaryReminderToUser === 'function') ? sendSalaryReminderToUser(tgId, emp ? emp.username : '', reminderText) : { ok: false, description: 'Not implemented' };
  addAuditLog_(actorTgId, 'send_reminder', '', null, { tgId: tgId, ok: res.ok }, 'manual');
  return { success: res.ok, error: res.description };
}

function sendInactiveReminders(days, actorTgId, reminderText) {
  var inactive = getInactiveUsers(days);
  var sent = 0;
  for (var i = 0; i < inactive.data.length; i++) {
    var u = inactive.data[i];
    var res = (typeof sendSalaryReminderToUser === 'function') ? sendSalaryReminderToUser(u.tgId, u.username, reminderText) : { ok: false };
    if (res.ok) sent++;
    Utilities.sleep(100);
  }
  addAuditLog_(actorTgId, 'send_bulk_reminder', '', null, { sent: sent }, 'bulk');
  return { success:true, sent: sent };
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
  return { role: role, overrides: overrides, effective: buildModelFromRoleAndOverrides_(role, overrides) };
}

function overrideToCellValue_(value) {
  if (value === null || value === undefined) return '';
  return value ? 1 : 0;
}
