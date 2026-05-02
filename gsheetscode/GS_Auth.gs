// ============================================================
// GS_Auth.gs — Authentication and Role Logic
// ============================================================

function checkUserRoles(tgId) {
  var emp = getEmployee(tgId);
  var auth = {
    role: "User", roleKey: "EMPLOYEE", username: "",
    isAdmin: false, isBoss: false,
    isDirector: false, isSuperAdmin: false,
    inList: false,
    canAdd: true,
    permissions: {
      canViewAll:false, canEdit:false, canDelete:false, canExport:false, canViewDash:false
    }
  };

  if (!emp) {
    if (isConfigSuperAdminId_(tgId)) {
      auth.username = String((CONFIG && CONFIG.SUPER_ADMIN_NAME) || 'SuperAdmin');
      auth.role = 'SuperAdmin';
      auth.roleKey = 'SUPER_ADMIN';
      auth.isSuperAdmin = true;
      auth.isAdmin = true;
      auth.isBoss = true;
      auth.inList = true;
      auth.canAdd = true;
      auth.permissions = {
        canViewAll:true, canEdit:true, canDelete:true, canExport:true, canViewDash:true
      };
      return auth;
    }
    auth.canAdd = false;
    return auth;
  }

  auth.inList = true;
  auth.username   = emp.username;
  auth.canAdd     = emp.canAdd;
  auth.role       = emp.role;
  auth.roleKey    = emp.roleKey;
  auth.isSuperAdmin = emp.isSuperAdmin;
  auth.isDirector = emp.isDirektor;
  auth.isAdmin    = emp.isAdmin;
  auth.isBoss     = emp.isSuperAdmin;
  auth.permissions = emp.permissions;
  auth.positions  = emp.positions || [];
  auth.group      = emp.group || '';
  auth.isSardor   = !!emp.isSardor;
  return auth;
}

function resolveEmployeeAccessFromRow_(row) {
  if (!hasNewPermissionModel_(row)) {
    var legacyRole = deriveLegacyRoleFromRow_(row);
    return {
      roleKey: legacyRole,
      roleLabel: roleLabelFromKey_(legacyRole),
      canAdd: toBool01_(row[COL.CAN_ADD]),
      isSuperAdmin: toBool01_(row[COL.SUPER_ADMIN]),
      isDirektor: toBool01_(row[COL.DIREKTOR]),
      isAdmin: toBool01_(row[COL.ADMIN]),
      permissions: {
        canViewAll: toBool01_(row[COL.VIEW_ALL]),
        canEdit: toBool01_(row[COL.EDIT]),
        canDelete: toBool01_(row[COL.DELETE]),
        canExport: toBool01_(row[COL.EXPORT]),
        canViewDash: toBool01_(row[COL.VIEW_DASH])
      },
      overrides: {
        canAdd: null, canViewAll: null, canEdit: null, canDelete: null, canExport: null, canViewDash: null
      }
    };
  }
  var role = normalizeRole_(row[COL.ROLE], row);
  var overrides = readOverridesFromRow_(row);
  return buildModelFromRoleAndOverrides_(role, overrides);
}

function buildModelFromRoleAndOverrides_(roleKey, overrides) {
  var role = normalizeRole_(roleKey, null);
  var defaults = roleDefaults_(role);
  var perms = {
    canViewAll: defaults.permissions.canViewAll,
    canEdit: defaults.permissions.canEdit,
    canDelete: defaults.permissions.canDelete,
    canExport: defaults.permissions.canExport,
    canViewDash: defaults.permissions.canViewDash
  };
  var canAdd = defaults.canAdd;

  if (overrides && overrides.canAdd !== null) canAdd = overrides.canAdd;
  if (overrides && overrides.canViewAll !== null) perms.canViewAll = overrides.canViewAll;
  if (overrides && overrides.canEdit !== null) perms.canEdit = overrides.canEdit;
  if (overrides && overrides.canDelete !== null) perms.canDelete = overrides.canDelete;
  if (overrides && overrides.canExport !== null) perms.canExport = overrides.canExport;
  if (overrides && overrides.canViewDash !== null) perms.canViewDash = overrides.canViewDash;

  if (role === 'SUPER_ADMIN') {
    canAdd = true;
    perms.canViewAll = true; perms.canEdit = true; perms.canDelete = true; perms.canExport = true; perms.canViewDash = true;
  }

  return {
    roleKey: role,
    roleLabel: roleLabelFromKey_(role),
    canAdd: canAdd,
    isSuperAdmin: role === 'SUPER_ADMIN',
    isDirektor: role === 'DIRECTOR',
    isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
    permissions: perms,
    overrides: overrides || {
      canAdd: null, canViewAll: null, canEdit: null, canDelete: null, canExport: null, canViewDash: null
    }
  };
}

function hasNewPermissionModel_(row) {
  // Simplified: If it has a Role, it's the new model. Overrides columns are gone from sheet.
  return !!String(row[COL.ROLE] || '').trim();
}

function readOverridesFromRow_(row) {
  // Overrides are no longer stored in the sheet.
  return {
    canAdd: null, canViewAll: null, canEdit: null, canDelete: null, canExport: null, canViewDash: null
  };
}

function normalizeRole_(value, rowForFallback) {
  var raw = String(value || '').trim().toUpperCase();
  if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (raw === 'DIRECTOR' || raw === 'DIREKTOR') return 'DIRECTOR';
  if (raw === 'ADMIN') return 'ADMIN';
  if (raw === 'EMPLOYEE' || raw === 'USER') return 'EMPLOYEE';
  return rowForFallback ? deriveLegacyRoleFromRow_(rowForFallback) : 'EMPLOYEE';
}

function roleLabelFromKey_(roleKey) {
  if (roleKey === 'SUPER_ADMIN') return 'SuperAdmin';
  if (roleKey === 'DIRECTOR') return 'Direktor';
  if (roleKey === 'ADMIN') return 'Admin';
  return 'User';
}

function roleDefaults_(roleKey) {
  var role = normalizeRole_(roleKey, null);
  if (role === 'SUPER_ADMIN') {
    return { canAdd: true, permissions: { canViewAll:true, canEdit:true, canDelete:true, canExport:true, canViewDash:true } };
  }
  if (role === 'DIRECTOR') {
    return { canAdd: true, permissions: { canViewAll:true, canEdit:false, canDelete:false, canExport:true, canViewDash:true } };
  }
  if (role === 'ADMIN') {
    return { canAdd: true, permissions: { canViewAll:true, canEdit:false, canDelete:false, canExport:false, canViewDash:false } };
  }
  return { canAdd: true, permissions: { canViewAll:false, canEdit:true, canDelete:true, canExport:false, canViewDash:false } };
}

function deriveLegacyRoleFromRow_(row) {
  if (isConfigSuperAdminId_(row[COL.TG_ID])) return 'SUPER_ADMIN';
  if (toBool01_(row[COL.SUPER_ADMIN])) return 'SUPER_ADMIN';
  if (toBool01_(row[COL.DIREKTOR])) return 'DIRECTOR';
  if (toBool01_(row[COL.ADMIN])) return 'ADMIN';
  return 'EMPLOYEE';
}

function deriveOverridesForEffective_(roleKey, effectiveCanAdd, effectivePerms) {
  var defaults = roleDefaults_(roleKey);
  var perms = effectivePerms || {};
  return {
    canAdd: (effectiveCanAdd === defaults.canAdd) ? null : !!effectiveCanAdd,
    canViewAll: (Boolean(perms.canViewAll) === defaults.permissions.canViewAll) ? null : Boolean(perms.canViewAll),
    canEdit: (Boolean(perms.canEdit) === defaults.permissions.canEdit) ? null : Boolean(perms.canEdit),
    canDelete: (Boolean(perms.canDelete) === defaults.permissions.canDelete) ? null : Boolean(perms.canDelete),
    canExport: (Boolean(perms.canExport) === defaults.permissions.canExport) ? null : Boolean(perms.canExport),
    canViewDash: (Boolean(perms.canViewDash) === defaults.permissions.canViewDash) ? null : Boolean(perms.canViewDash)
  };
}
