const ROLE_OPTIONS = [
    { key: 'PENDING',    label: '⏳ Kutilmoqda' },
    { key: 'EMPLOYEE',   label: '👤 Xodim:'     },
    { key: 'ADMIN',      label: '🛡 Admin'       },
    { key: 'DIRECTOR',   label: '🎯 Direktor'    },
    { key: 'SUPER_ADMIN',label: '👑 SuperAdmin'  }
];

const ROLE_PERM_FIELDS = ['canAdd','canViewAll','canViewDash','canExport','canEdit','canDelete'];
let TECHNICAL_POSITIONS = [];

function updateTechnicalPositions(allPositions) {
    if (!allPositions || !allPositions.length) {
        TECHNICAL_POSITIONS = [
            { name: 'Loyihachi',    icon: '📐' },
            { name: 'Yig\'uvchi',  icon: '🔧' },
            { name: 'Qadoqlovchi', icon: '📦' }
        ];
        return;
    }
    TECHNICAL_POSITIONS = allPositions;
}

function normalizeRoleKey(role) {
    const raw = String(role || '').trim().toUpperCase();
    if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'SUPER_ADMIN';
    if (raw === 'DIRECTOR'    || raw === 'DIREKTOR')   return 'DIRECTOR';
    if (raw === 'ADMIN')    return 'ADMIN';
    if (raw === 'PENDING')  return 'PENDING';
    return 'EMPLOYEE';
}

function roleBadgeHtml(roleKey) {
    const role = normalizeRoleKey(roleKey);
    if (role === 'SUPER_ADMIN') return '<span class="role-badge boss">👑 SuperAdmin</span>';
    if (role === 'DIRECTOR')    return '<span class="role-badge direktor">🎯 Direktor</span>';
    if (role === 'ADMIN')       return '<span class="role-badge admin">🛡 Admin</span>';
    if (role === 'PENDING')     return '<span class="role-badge" style="background:var(--comp-edit-bg);color:var(--comp-edit-text);">⏳ Kutilmoqda</span>';
    return '<span class="role-badge" style="background:var(--bg);color:var(--text-muted);">👤 Xodim:</span>';
}

function boolToChecked(v) {
    return (v === true || v === 1 || String(v) === "1") ? 'checked' : '';
}

/* ---------------------------------------------------------------
   showAddHodimModal — CSS klasslari
   --------------------------------------------------------------- */
function showAddHodimModal() {
    const modal = document.createElement('div');
    modal.className = 'hs-overlay';
    modal.innerHTML = `
        <div class="hs-box hs-box--sm" style="max-width:400px;">
            <div class="hs-header">
                <h3 class="hs-title">➕ Yangi Xodim Qo'shish:</h3>
                <button class="hs-close" onclick="this.closest('.hs-overlay').remove()">×</button>
            </div>
            <div class="input-group">
                <label>Telegram ID:</label>
                <input type="text" id="newHodimTgId"
                    placeholder="Masalan: 123456789" inputmode="numeric">
            </div>
            <div class="input-group">
                <label>Username (ixtiyoriy)</label>
                <input type="text" id="newHodimUsername" placeholder="@username">
            </div>
            <div style="display:flex; gap:10px; margin-top:8px;">
                <button class="btn-main"      onclick="addNewHodim()" style="flex:1;">✅ Qo'shish</button>
                <button class="btn-secondary" onclick="this.closest('.hs-overlay').remove()" style="flex:1; margin-top:0;">❌ Bekor</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('newHodimTgId').focus();
}

async function addNewHodim() {
    const tgId    = document.getElementById('newHodimTgId').value.trim();
    const username = document.getElementById('newHodimUsername').value.trim();
    if (!tgId || !/^\d+$/.test(tgId)) {
        showToastMsg('❌ Telegram ID raqamlardan iborat bo\'lishi kerak', true); return;
    }
    const btn = document.querySelector('.hs-overlay .btn-main');
    setButtonLoading(btn, true, 'Qo\'shilmoqda...');
    try {
        const data = await apiRequest({ action: 'add_hodim', tgId, username: username || null });
        if (data.success) {
            showToastMsg('✅ Xodim muvaffaqiyatli qo\'shildi!');
            document.querySelector('.hs-overlay').remove();
            loadHodimlar();
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    } finally {
        setButtonLoading(btn, false);
    }
}

function openHodimSettings(tgId) {
    const hodim = globalEmployeeList.find(h => String(h.tgId) === tgId);
    if (!hodim) { showToastMsg('❌ Xodim topilmadi', true); return; }
    showHodimSettingsModal(hodim);
}

/* ---------------------------------------------------------------
   showHodimSettingsModal — CSS klasslari
   --------------------------------------------------------------- */
function showHodimSettingsModal(h) {
    const safeTgId    = String(h.tgId || '').replace(/[^\d]/g, '');
    const safeUsername = escapeHtml(h.username || '');
    const role         = normalizeRoleKey(h.role);
    const isConfigLocked = Number(h.isConfigSuperAdmin) === 1;

    const modal = document.createElement('div');
    modal.className = 'hs-overlay';

    modal.innerHTML = `
    <div class="hs-box">
        <div class="hs-header">
            <h3 class="hs-title">⚙️ Xodim Sozlamalari:</h3>
            <button class="hs-close" onclick="this.closest('.hs-overlay').remove()">×</button>
        </div>

        <!-- Avatar -->
        <div class="hs-avatar-wrap">
            <div class="hs-avatar">${isConfigLocked ? '🔒' : '👤'}</div>
            <div class="hs-username">${safeUsername}</div>
            <div class="hs-tgid">ID: ${safeTgId}</div>
        </div>

        <!-- Ism -->
        <div class="input-group">
            <label>👤 Xodim Ismi (UserName):</label>
            <input type="text" id="uname_${safeTgId}" value="${safeUsername}">
        </div>

        <!-- Rol -->
        <div class="input-group">
            <label>Rol</label>
            <select id="hrole_${safeTgId}"
                onchange="onHodimRoleChanged('${safeTgId}')"
                ${isConfigLocked ? 'disabled' : ''}>
                ${ROLE_OPTIONS.map(opt =>
                    `<option value="${opt.key}" ${opt.key === role ? 'selected' : ''}>${opt.label}</option>`
                ).join('')}
            </select>
        </div>

        <!-- Lavozimlar -->
        <div class="input-group">
            <label>Lavozimlar (Workflow)</label>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin-top:8px;">
                ${TECHNICAL_POSITIONS.map(pos => {
                    const pid       = `hpos_${safeTgId}_${pos.name.replace(/\s+/g, '_')}`;
                    const isChecked = (h.positions || []).indexOf(pos.name) !== -1;
                    return `
                    <label class="perm-label ${isChecked ? 'checked' : ''}"
                        style="margin:0; padding:8px; border:1px solid var(--border); border-radius:8px; cursor:pointer;">
                        <input type="checkbox" id="${pid}" ${isChecked ? 'checked' : ''}
                            value="${pos.name}" onchange="syncPermLabel(this)">
                        <span style="font-size:12px;">${pos.icon} ${pos.name}</span>
                    </label>`;
                }).join('')}
            </div>
        </div>

        <!-- Guruh -->
        <div class="input-group">
            <label>🏢 Guruh Nomi</label>
            <input type="text" id="hgroup_${safeTgId}"
                value="${escapeHtml(h.group || '')}"
                placeholder="Masalan: 1-guruh">
        </div>

        <!-- Sardor -->
        <div style="margin-bottom:15px;">
            <label class="perm-label ${h.isSardor ? 'checked' : ''}">
                <input type="checkbox" id="hsardor_${safeTgId}"
                    ${h.isSardor ? 'checked' : ''}
                    onchange="syncPermLabel(this)">
                <span>🎖 Guruh Sardori</span>
            </label>
        </div>

        <!-- Ruxsatlar -->
        <div class="role-info-card">
            <div class="role-info-card__title">📋 RUXSAT MODELI (V2)</div>
            <div class="role-info-card__list">
                <div>👑 <b>SuperAdmin</b> — to'liq huquq</div>
                <div>🎯 <b>Direktor</b> — ko'rish + dashboard + export</div>
                <div>🛡 <b>Admin</b> — qo'shish + barchasini ko'rish</div>
            </div>
        </div>

        <div class="hodim-perms-grid" style="margin-bottom:20px;">
            ${permToggle(safeTgId, 'canAdd',      h.canAdd,      '➕ Amal qo\'shish'  )}
            ${permToggle(safeTgId, 'canViewAll',  h.canViewAll,  '👁 Barchasini ko\'rish')}
            ${permToggle(safeTgId, 'canViewDash', h.canViewDash, '📈 Dashboard'        )}
            ${permToggle(safeTgId, 'canExport',   h.canExport,   '📥 Excel'            )}
            ${permToggle(safeTgId, 'canEdit',     h.canEdit,     '✏️ Tahrirlash'       )}
            ${permToggle(safeTgId, 'canDelete',   h.canDelete,   '🗑 O\'chirish'       )}
        </div>

        <!-- Tugmalar -->
        <div style="display:flex; gap:10px;">
            <button class="btn-main" id="hsave_${safeTgId}"
                onclick="saveHodim('${safeTgId}')"
                style="flex:1;"
                ${isConfigLocked ? 'disabled' : ''}>💾 Saqlash</button>
            <button class="btn-main bg-red"
                onclick="deleteHodim('${safeTgId}')"
                style="flex:1;"
                ${isConfigLocked ? 'disabled' : ''}>🗑 O'chirish</button>
        </div>
    </div>`;

    document.body.appendChild(modal);
    applyRoleConstraintsToCard(safeTgId, false);
}

function permToggle(tgId, field, val, label) {
    const id      = `hp_${tgId}_${field}`;
    const checked = (val === true || val === 1 || String(val) === "1");
    return `
    <label class="perm-label ${checked ? 'checked' : ''}"
        style="margin:0; padding:8px; border:1px solid var(--border); border-radius:8px; cursor:pointer;">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}
            onchange="syncPermLabel(this)">
        <span style="font-size:12px;">${label}</span>
    </label>`;
}

function syncPermLabel(cb) {
    const lbl = cb.closest('.perm-label');
    if (lbl) lbl.classList.toggle('checked', cb.checked);
}

function setPermChecked(tgId, field, checked) {
    const el = document.getElementById(`hp_${tgId}_${field}`);
    if (el) { el.checked = !!checked; syncPermLabel(el); }
}

function setPermDisabled(tgId, field, disabled) {
    const el = document.getElementById(`hp_${tgId}_${field}`);
    if (!el) return;
    el.disabled = !!disabled;
    const lbl = el.closest('.perm-label');
    if (lbl) {
        lbl.style.opacity       = disabled ? '0.6' : '';
        lbl.style.pointerEvents = disabled ? 'none' : '';
    }
}

function getRolePreset(roleKey) {
    const role = normalizeRoleKey(roleKey);
    if (role === 'SUPER_ADMIN') return { canAdd:1, canViewAll:1, canViewDash:1, canExport:1, canEdit:1, canDelete:1 };
    if (role === 'DIRECTOR')    return { canAdd:1, canViewAll:1, canViewDash:1, canExport:1, canEdit:0, canDelete:0 };
    if (role === 'ADMIN')       return { canAdd:1, canViewAll:1, canViewDash:0, canExport:0, canEdit:0, canDelete:0 };
    return                             { canAdd:1, canViewAll:0, canViewDash:0, canExport:0, canEdit:0, canDelete:0 };
}

function getRoleValue(tgId) {
    const el = document.getElementById(`hrole_${tgId}`);
    return normalizeRoleKey(el ? el.value : 'EMPLOYEE');
}

function applyRoleConstraintsToCard(tgId, usePreset) {
    const role = getRoleValue(tgId);
    if (usePreset) {
        const preset = getRolePreset(role);
        ROLE_PERM_FIELDS.forEach(field => setPermChecked(tgId, field, Number(preset[field]) === 1));
    }
    ROLE_PERM_FIELDS.forEach(field => setPermDisabled(tgId, field, false));
    if (role === 'SUPER_ADMIN') {
        ROLE_PERM_FIELDS.forEach(field => {
            setPermChecked(tgId, field, true);
            setPermDisabled(tgId, field, true);
        });
    }
}

function onHodimRoleChanged(tgId) {
    applyRoleConstraintsToCard(tgId, true);
}

async function loadHodimlar() {
    await ensureAdminDataLoaded(true);
    renderHodimlarList(globalEmployeeList);
}

/* ---------------------------------------------------------------
   renderHodimlarList — CSS klasslari bilan
   --------------------------------------------------------------- */
function renderHodimlarList(data) {
    const list = document.getElementById('hodimlarList');
    if (!list) return;

    let html = `
        <div style="margin-bottom:20px;">
            <button class="btn-main" onclick="showAddHodimModal()"
                style="width:100%; padding:14px; font-size:16px; border-radius:12px;">
                ➕ Yangi Xodim Qo'shish:
            </button>
        </div>
        <div class="hodimlar-grid">
    `;

    if (!data || !data.length) {
        html += `<div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-icon">👥</div><p>Hali xodim qo'shilmagan</p>
        </div>`;
    } else {
        data.forEach(h => {
            const roleBadge = roleBadgeHtml(h.role);
            html += `
            <div class="hodim-card" onclick="openHodimSettings('${h.tgId}')">
                <div class="hodim-avatar">
                    <div>👤</div>
                    <div>${escapeHtml(h.username || '—')}</div>
                </div>
                <div class="hodim-info">${roleBadge}</div>
            </div>`;
        });
    }

    html += `</div>`;
    list.innerHTML = html;
}

async function saveHodim(tgId) {
    const saveBtn = document.getElementById(`hsave_${tgId}`);
    setButtonLoading(saveBtn, true, 'Saqlanmoqda...');

    const payload = {
        action: 'update_hodim',
        tgId,
        role:     getRoleValue(tgId),
        username: document.getElementById(`uname_${tgId}`).value,
        guruh:    document.getElementById(`hgroup_${tgId}`).value,
        isSardor: document.getElementById(`hsardor_${tgId}`).checked ? 1 : 0
    };

    ROLE_PERM_FIELDS.forEach(field => {
        const el = document.getElementById(`hp_${tgId}_${field}`);
        payload[field] = el && el.checked ? 1 : 0;
    });

    const selectedPositions = [];
    TECHNICAL_POSITIONS.forEach(pos => {
        const pid = `hpos_${tgId}_${pos.name.replace(/\s+/g, '_')}`;
        const el  = document.getElementById(pid);
        if (el && el.checked) selectedPositions.push(pos.name);
    });
    payload.lavozim = selectedPositions.join(',');

    try {
        const data = await apiRequest(payload);
        if (data.success) {
            showToastMsg('✅ Saqlandi!');
            const modal = document.querySelector('.hs-overlay');
            if (modal) modal.remove();
            loadHodimlar();
        } else {
            showToastMsg('❌ ' + data.error, true);
        }
    } catch (e) {
        showToastMsg('❌ Server xatosi', true);
    } finally {
        setButtonLoading(saveBtn, false);
    }
}

async function deleteHodim(tgId) {
    if (!confirm('Ushbu xodimni o\'chirishga ishonchingiz komilmi?')) return;
    try {
        const data = await apiRequest({ action: 'delete_hodim', tgId });
        if (data.success) {
            showToastMsg('✅ Xodim o\'chirildi');
            document.querySelectorAll('.hs-overlay').forEach(m => m.remove());
            loadHodimlar();
        } else {
            showToastMsg('❌ ' + data.error, true);
        }
    } catch (e) {
        showToastMsg('❌ Server xatosi', true);
    }
}
