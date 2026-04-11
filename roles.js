// ============================================================
// roles.js — Hodimlar boshqaruvi (SuperAdmin)
// ============================================================

const ROLE_OPTIONS = [
    { key: 'EMPLOYEE', label: '👤 Hodim' },
    { key: 'ADMIN', label: '🛡 Admin' },
    { key: 'DIRECTOR', label: '🎯 Direktor' },
    { key: 'SUPER_ADMIN', label: '👑 SuperAdmin' }
];

const ROLE_PERM_FIELDS = ['canAdd', 'canViewAll', 'canViewDash', 'canExport', 'canEdit', 'canDelete'];

function normalizeRoleKey(role) {
    const raw = String(role || '').trim().toUpperCase();
    if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'SUPER_ADMIN';
    if (raw === 'DIRECTOR' || raw === 'DIREKTOR') return 'DIRECTOR';
    if (raw === 'ADMIN') return 'ADMIN';
    return 'EMPLOYEE';
}

function roleBadgeHtml(roleKey) {
    const role = normalizeRoleKey(roleKey);
    if (role === 'SUPER_ADMIN') return '<span class="role-badge boss">👑 SuperAdmin</span>';
    if (role === 'DIRECTOR') return '<span class="role-badge direktor">🎯 Direktor</span>';
    if (role === 'ADMIN') return '<span class="role-badge admin">🛡 Admin</span>';
    return '<span class="role-badge" style="background:#F1F5F9;color:#64748B;">👤 Hodim</span>';
}

function roleOptionsHtml(selectedRole) {
    const role = normalizeRoleKey(selectedRole);
    return ROLE_OPTIONS.map(function (opt) {
        const selected = opt.key === role ? 'selected' : '';
        return `<option value="${opt.key}" ${selected}>${opt.label}</option>`;
    }).join('');
}

function boolToChecked(v) {
    return Number(v) === 1 ? 'checked' : '';
}

function toggleHodimPerms(tgId) {
    const btn  = document.getElementById('hbtn_' + tgId);
    const body = document.getElementById('hbody_' + tgId);
    if (!btn || !body) return;
    const isOpen = body.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function permToggle(tgId, field, val, label) {
    const id = `hp_${tgId}_${field}`;
    const checked = Number(val) === 1;
    return `<label class="perm-label ${checked ? 'checked' : ''}" onclick="togglePermLabel(this,'${id}')">
        <input type="checkbox" id="${id}" ${boolToChecked(val)} onclick="event.stopPropagation();syncPermLabel(this)">
        <span>${label}</span>
    </label>`;
}

function togglePermLabel(lbl, cbId) {
    const cb = document.getElementById(cbId);
    if (!cb || cb.disabled) return;
    cb.checked = !cb.checked;
    syncPermLabel(cb);
}

function syncPermLabel(cb) {
    const lbl = cb.closest('.perm-label');
    if (lbl) lbl.classList.toggle('checked', cb.checked);
}

function setPermChecked(tgId, field, checked) {
    const el = document.getElementById(`hp_${tgId}_${field}`);
    if (!el) return;
    el.checked = !!checked;
    syncPermLabel(el);
}

function setPermDisabled(tgId, field, disabled) {
    const el = document.getElementById(`hp_${tgId}_${field}`);
    if (!el) return;
    el.disabled = !!disabled;
    const lbl = el.closest('.perm-label');
    if (lbl) {
        lbl.style.opacity = disabled ? '0.6' : '';
        lbl.style.pointerEvents = disabled ? 'none' : '';
    }
}

function getRolePreset(roleKey) {
    const role = normalizeRoleKey(roleKey);
    if (role === 'SUPER_ADMIN') {
        return { canAdd:1, canViewAll:1, canViewDash:1, canExport:1, canEdit:1, canDelete:1 };
    }
    if (role === 'DIRECTOR') {
        return { canAdd:1, canViewAll:1, canViewDash:1, canExport:1, canEdit:0, canDelete:0 };
    }
    if (role === 'ADMIN') {
        return { canAdd:1, canViewAll:1, canViewDash:0, canExport:0, canEdit:0, canDelete:0 };
    }
    return { canAdd:1, canViewAll:0, canViewDash:0, canExport:0, canEdit:0, canDelete:0 };
}

function getRoleValue(tgId) {
    const el = document.getElementById(`hrole_${tgId}`);
    return normalizeRoleKey(el ? el.value : 'EMPLOYEE');
}

function applyRoleConstraintsToCard(tgId, usePreset) {
    const role = getRoleValue(tgId);
    if (usePreset) {
        const preset = getRolePreset(role);
        ROLE_PERM_FIELDS.forEach(function (field) {
            setPermChecked(tgId, field, Number(preset[field]) === 1);
        });
    }

    ROLE_PERM_FIELDS.forEach(function (field) {
        setPermDisabled(tgId, field, false);
    });

    if (role === 'SUPER_ADMIN') {
        ROLE_PERM_FIELDS.forEach(function (field) {
            setPermChecked(tgId, field, true);
            setPermDisabled(tgId, field, true);
        });
    }
}

function onHodimRoleChanged(tgId) {
    applyRoleConstraintsToCard(tgId, true);
}

function lockConfigSuperAdminCard(tgId) {
    const usernameEl = document.getElementById(`uname_${tgId}`);
    const roleEl = document.getElementById(`hrole_${tgId}`);
    const saveBtn = document.getElementById(`hsave_${tgId}`);
    const delBtn = document.getElementById(`hdel_${tgId}`);

    if (usernameEl) usernameEl.disabled = true;
    if (roleEl) roleEl.disabled = true;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.65';
        saveBtn.style.cursor = 'not-allowed';
    }
    if (delBtn) {
        delBtn.disabled = true;
        delBtn.style.opacity = '0.65';
        delBtn.style.cursor = 'not-allowed';
    }

    ROLE_PERM_FIELDS.forEach(function (field) {
        setPermDisabled(tgId, field, true);
    });
}

async function loadHodimlar() {
    const list = document.getElementById('hodimlarList');
    list.innerHTML = `<div class="skeleton skeleton-item"></div><div class="skeleton skeleton-item"></div>`;

    try {
        const data = await apiRequest({ action:'get_hodimlar' });

        if (!data.success) {
            list.innerHTML = `<div class="empty-state"><p style="color:var(--red);">${escapeHtml(data.error || 'Xato')}</p></div>`;
            return;
        }

        if (!data.data.length) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>Hali hodim qo'shilmagan</p></div>`;
            return;
        }

        let html = '';
        data.data.forEach(function (h) {
            const safeTgId = String(h.tgId || '').replace(/[^\d]/g, '');
            const safeUsername = escapeHtml(h.username || '—');
            const safeUsernameValue = escapeHtml(h.username || '');
            const role = normalizeRoleKey(h.role);
            const roleBadge = roleBadgeHtml(role);
            const isConfigLocked = Number(h.isConfigSuperAdmin) === 1;
            const lockBadge = isConfigLocked
                ? '<span class="role-badge" style="background:#FEF3C7;color:#92400E;">🔒 Config Lock</span>'
                : '';

            html += `
            <div class="role-item" style="flex-direction:column;align-items:stretch;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="flex:1;min-width:0;">
                        <div class="role-item-name">${safeUsername}</div>
                        <div class="role-item-id">ID: ${safeTgId || '—'}</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
                        ${roleBadge}
                        ${lockBadge}
                        <button class="del-icon-btn" id="hdel_${safeTgId}" onclick="deleteHodim('${safeTgId}')">🗑</button>
                    </div>
                </div>

                <div style="margin-bottom:10px;">
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);
                                  text-transform:uppercase;letter-spacing:0.5px;
                                  display:block;margin-bottom:5px;">
                        👤 Ko'rsatiladigan ism (UserName)
                    </label>
                    <input type="text"
                           id="uname_${safeTgId}"
                           value="${safeUsernameValue}"
                           placeholder="Masalan: Ali (Haydovchi)"
                           style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                                  border-radius:var(--radius-sm);font-size:14px;
                                  font-family:var(--font);background:#FAFBFD;">
                </div>

                <div style="margin-bottom:8px;">
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);
                                  text-transform:uppercase;letter-spacing:0.5px;
                                  display:block;margin-bottom:5px;">
                        🧩 Rol
                    </label>
                    <select id="hrole_${safeTgId}" onchange="onHodimRoleChanged('${safeTgId}')">
                        ${roleOptionsHtml(role)}
                    </select>
                </div>

                ${isConfigLocked ? `<div style="font-size:11px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:8px 10px;margin-bottom:8px;">🔒 Bu akkaunt CONFIG dagi SUPER_ADMIN_ID. Rol/ruxsatni faqat Google Sheetsdan o'zgartirasiz.</div>` : ''}

                <button class="perm-toggle-btn" id="hbtn_${safeTgId}" onclick="toggleHodimPerms('${safeTgId}')">
                    <span>🔐 Individual ruxsatlar</span>
                    <span class="perm-arrow">▼</span>
                </button>
                <div class="perm-body" id="hbody_${safeTgId}">
                    <div class="hodim-perms-grid">
                        ${permToggle(safeTgId, 'canAdd',      h.canAdd,      '➕ Amal qo\'shish')}
                        ${permToggle(safeTgId, 'canViewAll',  h.canViewAll,  '👁 Barchasini ko\'rish')}
                        ${permToggle(safeTgId, 'canViewDash', h.canViewDash, '📈 Dashboard')}
                        ${permToggle(safeTgId, 'canExport',   h.canExport,   '📥 Excel')}
                        ${permToggle(safeTgId, 'canEdit',     h.canEdit,     '✏️ Tahrirlash')}
                        ${permToggle(safeTgId, 'canDelete',   h.canDelete,   '🗑 O\'chirish')}
                    </div>
                    <button class="perm-save-btn" id="hsave_${safeTgId}" onclick="saveHodim('${safeTgId}')">💾 Saqlash</button>
                </div>
            </div>`;
        });
        list.innerHTML = html;

        data.data.forEach(function (h) {
            const safeTgId = String(h.tgId || '').replace(/[^\d]/g, '');
            applyRoleConstraintsToCard(safeTgId, false);
            if (Number(h.isConfigSuperAdmin) === 1) {
                lockConfigSuperAdminCard(safeTgId);
            }
        });
    } catch {
        list.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Yuklanmadi</p></div>`;
    }
}

async function saveHodim(tgId) {
    const roleEl = document.getElementById(`hrole_${tgId}`);
    if (roleEl && roleEl.disabled) {
        showToastMsg('❌ Bu akkauntni ilovadan o\'zgartirib bo\'lmaydi', true);
        return;
    }

    const payload = {
        action: 'update_hodim',
        telegramId,
        tgId,
        role: getRoleValue(tgId)
    };

    ROLE_PERM_FIELDS.forEach(function (field) {
        const el = document.getElementById(`hp_${tgId}_${field}`);
        payload[field] = el && el.checked ? 1 : 0;
    });

    const usernameEl = document.getElementById(`uname_${tgId}`);
    if (usernameEl) payload.username = usernameEl.value;

    try {
        const data = await apiRequest(payload);
        showToastMsg(data.success ? '✅ Saqlandi!' : '❌ ' + data.error, !data.success);
        if (data.success) loadHodimlar();
    } catch {
        showToastMsg('❌ Server xatosi', true);
    }
}

async function addHodim() {
    const tgIdEl = document.getElementById('newHodimId');
    const usernameEl = document.getElementById('newHodimName');
    const st = document.getElementById('hodimStatus');

    const newTgId = tgIdEl.value.trim();
    const username = usernameEl.value.trim() || 'Yangi Xodim';

    if (!newTgId) {
        st.style.color = 'var(--red)';
        st.innerText = '❗ Telegram ID kiritilishi shart!';
        return;
    }
    st.style.color = 'var(--text-muted)';
    st.innerText = '⏳ Qo\'shilmoqda...';

    try {
        const data = await apiRequest({
            action: 'add_hodim',
            telegramId,
            tgId: newTgId,
            username,
            role: 'EMPLOYEE',
            canAdd: 1,
            canViewAll: 0,
            canViewDash: 0,
            canExport: 0,
            canEdit: 0,
            canDelete: 0
        });
        if (data.success) {
            st.style.color = 'var(--green-dark)';
            st.innerText = '✅ Qo\'shildi!';
            tgIdEl.value = '';
            usernameEl.value = '';
            loadHodimlar();
        } else {
            st.style.color = 'var(--red)';
            st.innerText = '❌ ' + (data.error || 'Xato');
        }
    } catch {
        st.style.color = 'var(--red)';
        st.innerText = '❌ Server xatosi';
    }
}

async function deleteHodim(tgId) {
    if (!confirm("Bu hodimni ro'yxatdan o'chirishga ishonchingiz komilmi?")) return;
    try {
        const data = await apiRequest({ action:'delete_hodim', tgId });
        if (data.success) loadHodimlar();
        else showToastMsg('❌ ' + (data.error || "Xato"), true);
    } catch {
        showToastMsg('❌ Server xatosi', true);
    }
}
