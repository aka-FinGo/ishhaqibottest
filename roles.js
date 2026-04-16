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

let TECHNICAL_POSITIONS = [
    { name: 'Loyihachi', icon: '📐' },
    { name: 'Yig\'uvchi', icon: '🔧' },
    { name: 'Qadoqlovchi', icon: '📦' }
];

function updateTechnicalPositions(allPositions) {
    if (!allPositions || !allPositions.length) return;
    TECHNICAL_POSITIONS = allPositions;
}

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

function showAddHodimModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1000;';
    modal.innerHTML = `
        <div class="card" style="width:90%;max-width:400px;background:#fff;border-radius:15px;padding:20px;">
            <h3 style="margin:0 0 20px 0;color:var(--navy);">➕ Yangi Hodim Qo'shish</h3>
            <div style="margin-bottom:15px;">
                <label style="font-weight:600;display:block;margin-bottom:5px;">Telegram ID</label>
                <input type="text" id="newHodimTgId" placeholder="Masalan: 123456789" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;font-size:16px;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:600;display:block;margin-bottom:5px;">Username (ixtiyoriy)</label>
                <input type="text" id="newHodimUsername" placeholder="@username" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;font-size:16px;">
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn-main" onclick="addNewHodim()" style="flex:1;padding:12px;border-radius:10px;font-weight:600;">✅ Qo'shish</button>
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="flex:1;padding:12px;border-radius:10px;font-weight:600;">❌ Bekor</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('newHodimTgId').focus();
}

async function addNewHodim() {
    const tgId = document.getElementById('newHodimTgId').value.trim();
    const username = document.getElementById('newHodimUsername').value.trim();

    if (!tgId || !/^\d+$/.test(tgId)) {
        showToastMsg('❌ Telegram ID raqamlardan iborat bo\'lishi kerak', true);
        return;
    }

    try {
        const data = await apiRequest({
            action: 'add_hodim',
            tgId: tgId,
            username: username || null
        });

        if (data.success) {
            showToastMsg('✅ Hodim muvaffaqiyatli qo\'shildi!');
            document.querySelector('.modal').remove();
            loadHodimlar(); // Ro'yxatni yangilash
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}

function openHodimSettings(tgId) {
    // Avval hodim ma'lumotlarini olish
    apiRequest({ action:'get_hodimlar' }).then(data => {
        if (!data.success) {
            showToastMsg('❌ Hodim ma\'lumotlari yuklanmadi', true);
            return;
        }

        const hodim = data.data.find(h => String(h.tgId) === tgId);
        if (!hodim) {
            showToastMsg('❌ Hodim topilmadi', true);
            return;
        }

        showHodimSettingsModal(hodim);
    });
}

function showHodimSettingsModal(h) {
    const safeTgId = String(h.tgId || '').replace(/[^\d]/g, '');
    const safeUsername = escapeHtml(h.username || '');
    const role = normalizeRoleKey(h.role);
    const isConfigLocked = Number(h.isConfigSuperAdmin) === 1;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1000;';
    modal.innerHTML = `
        <div class="card" style="width:95%;max-width:500px;max-height:90vh;overflow-y:auto;background:#fff;border-radius:15px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;color:var(--navy);">⚙️ Hodim Sozlamalari</h3>
                <button onclick="this.closest('.modal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;">×</button>
            </div>

            <div style="margin-bottom:20px;text-align:center;">
                <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 10px;">
                    ${isConfigLocked ? '🔒' : '👤'}
                </div>
                <div style="font-weight:600;font-size:16px;color:var(--navy);">${safeUsername}</div>
                <div style="font-size:12px;color:var(--text-muted);">ID: ${safeTgId}</div>
            </div>

            ${isConfigLocked ? `<div style="font-size:12px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px;margin-bottom:15px;">🔒 Bu akkaunt CONFIG dagi SUPER_ADMIN_ID. Rol/ruxsatni faqat Google Sheetsdan o'zgartirasiz.</div>` : ''}

            <div class="input-group" style="margin-bottom:15px;">
                <label>Rol</label>
                <select id="hrole_${safeTgId}" onchange="onHodimRoleChanged('${safeTgId}')" ${isConfigLocked ? 'disabled' : ''}>
                    ${ROLE_OPTIONS.map(opt => `<option value="${opt.key}" ${opt.key === role ? 'selected' : ''}>${opt.label}</option>`).join('')}
                </select>
            </div>

            <div class="input-group" style="margin-bottom:15px;">
                <label>Lavozimlar (Workflow)</label>
                <div class="positions-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:8px;">
                    ${TECHNICAL_POSITIONS.map(pos => {
                        const pid = `hpos_${safeTgId}_${pos.name.replace(/\s+/g, '_')}`;
                        const isChecked = (h.positions || []).indexOf(pos.name) !== -1;
                        return `
                            <label class="perm-label ${isChecked ? 'checked' : ''}" style="margin:0; padding:8px; border:1px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.2s;" onclick="togglePermLabel(this,'${pid}')">
                                <input type="checkbox" id="${pid}" ${isChecked ? 'checked' : ''} value="${pos.name}" style="pointer-events:none;">
                                <span style="font-size:12px;">${pos.icon} ${pos.name}</span>
                            </label>`;
                    }).join('')}
                </div>
            </div>

            <div class="hodim-perms-grid" style="margin-bottom:20px;">
                ${permToggle(safeTgId, 'canAdd',      h.canAdd,      '➕ Amal qo\'shish')}
                ${permToggle(safeTgId, 'canViewAll',  h.canViewAll,  '👁 Barchasini ko\'rish')}
                ${permToggle(safeTgId, 'canViewDash', h.canViewDash, '📈 Dashboard')}
                ${permToggle(safeTgId, 'canExport',   h.canExport,   '📥 Excel')}
                ${permToggle(safeTgId, 'canEdit',     h.canEdit,     '✏️ Tahrirlash')}
                ${permToggle(safeTgId, 'canDelete',   h.canDelete,   '🗑 O\'chirish')}
            </div>

            <div style="display:flex;gap:10px;">
                <button class="btn-main" id="hsave_${safeTgId}" onclick="saveHodim('${safeTgId}');this.closest('.modal').remove();" style="flex:1;padding:12px;border-radius:10px;font-weight:600;" ${isConfigLocked ? 'disabled' : ''}>💾 Saqlash</button>
                <button class="btn-secondary" onclick="deleteHodim('${safeTgId}')" style="flex:1;padding:12px;border-radius:10px;font-weight:600;background:#EF4444;color:white;border:1px solid #EF4444;" ${isConfigLocked ? 'disabled' : ''}>🗑 O'chirish</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Rol o'zgarishini qo'llash
    applyRoleConstraintsToCard(safeTgId, false);
    if (isConfigLocked) {
        lockConfigSuperAdminCard(safeTgId);
    }
}

function permToggle(tgId, field, val, label) {
    const id = `hp_${tgId}_${field}`;
    const checked = Number(val) === 1;
    return `<label class="perm-label ${checked ? 'checked' : ''}" onclick="togglePermLabel(this,'${id}')">
    <input type="checkbox" id="${id}" ${boolToChecked(val)} style="pointer-events:none;">
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

        // Hodim qo'shish tugmasi
        let html = `
        <div class="hodim-add-section" style="margin-bottom:20px;">
            <button class="btn-main" onclick="showAddHodimModal()" style="width:100%; padding:14px; font-size:16px; border-radius:12px;">
                ➕ Yangi Hodim Qo'shish
            </button>
        </div>

        <div class="hodimlar-grid">`;

        if (!data.data.length) {
            html += `<div class="empty-state"><div class="empty-icon">👥</div><p>Hali hodim qo'shilmagan</p></div>`;
        } else {
            data.data.forEach(function (h) {
                const safeTgId = String(h.tgId || '').replace(/[^\d]/g, '');
                const safeUsername = escapeHtml(h.username || '—');
                const role = normalizeRoleKey(h.role);
                const roleBadge = roleBadgeHtml(role);
                const isConfigLocked = Number(h.isConfigSuperAdmin) === 1;
                const lockIcon = isConfigLocked ? '🔒' : '';

                html += `
                <div class="hodim-card" onclick="openHodimSettings('${safeTgId}')" style="cursor:pointer; border:1px solid var(--border); border-radius:12px; padding:16px; background:#fff; transition:all 0.2s; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <div class="hodim-avatar" style="text-align:center; margin-bottom:12px;">
                        <div style="width:50px; height:50px; border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); color:white; display:flex; align-items:center; justify-content:center; font-size:20px; margin:0 auto 8px;">
                            ${lockIcon || '👤'}
                        </div>
                        <div style="font-weight:600; font-size:14px; color:var(--navy);">${safeUsername}</div>
                    </div>
                    <div class="hodim-info" style="text-align:center;">
                        ${roleBadge}
                        ${isConfigLocked ? '<div style="font-size:11px; color:#92400E; margin-top:4px;">🔒 Config Lock</div>' : ''}
                    </div>
                </div>`;
            });
        }

        html += `</div>`;
        list.innerHTML = html;

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

    const selectedPositions = [];
    TECHNICAL_POSITIONS.forEach(pos => {
        const pid = `hpos_${tgId}_${pos.name.replace(/\s+/g, '_')}`;
        const el = document.getElementById(pid);
        if (el && el.checked) selectedPositions.push(pos.name);
    });
    payload.lavozim = selectedPositions.join(',');

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
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1001;';
    modal.innerHTML = `
        <div class="card" style="width:90%;max-width:350px;background:#fff;border-radius:15px;padding:20px;text-align:center;">
            <div style="font-size:48px;margin-bottom:15px;">⚠️</div>
            <h3 style="margin:0 0 10px 0;color:var(--navy);">Hodimni o'chirish</h3>
            <p style="color:var(--text-muted);margin-bottom:20px;">Bu hodimni ro'yxatdan o'chirishga ishonchingiz komilmi?</p>
            <div style="display:flex;gap:10px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="flex:1;padding:12px;border-radius:10px;font-weight:600;">❌ Bekor</button>
                <button class="btn-main" onclick="confirmDeleteHodim('${tgId}')" style="flex:1;padding:12px;border-radius:10px;font-weight:600;background:#EF4444;border:1px solid #EF4444;">🗑 O'chirish</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function confirmDeleteHodim(tgId) {
    try {
        const data = await apiRequest({ action:'delete_hodim', tgId });
        if (data.success) {
            showToastMsg('✅ Hodim o\'chirildi');
            document.querySelectorAll('.modal').forEach(m => m.remove());
            loadHodimlar();
        } else {
            showToastMsg('❌ ' + (data.error || "Xato"), true);
        }
    } catch {
        showToastMsg('❌ Server xatosi', true);
    }
}
