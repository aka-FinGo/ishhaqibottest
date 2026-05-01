const ROLE_OPTIONS = [
    { key: 'EMPLOYEE', label: '👤 Hodim' },
    { key: 'ADMIN', label: '🛡 Admin' },
    { key: 'DIRECTOR', label: '🎯 Direktor' },
    { key: 'SUPER_ADMIN', label: '👑 SuperAdmin' }
];

const ROLE_PERM_FIELDS = ['canAdd', 'canViewAll', 'canViewDash', 'canExport', 'canEdit', 'canDelete'];
let TECHNICAL_POSITIONS = [];

function updateTechnicalPositions(allPositions) {
    if (!allPositions || !allPositions.length) {
        TECHNICAL_POSITIONS = [
            { name: 'Loyihachi', icon: '📐' },
            { name: 'Yig\'uvchi', icon: '🔧' },
            { name: 'Qadoqlovchi', icon: '📦' }
        ];
        return;
    }
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

function boolToChecked(v) {
    return (v === true || v === 1 || String(v) === "1") ? 'checked' : '';
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
                <input type="text" id="newHodimTgId" placeholder="Masalan:123456789" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;font-size:16px;">
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
    const btn = document.querySelector('.modal .btn-main');
    setButtonLoading(btn, true, 'Qo\'shilmoqda...');
    try {
        const data = await apiRequest({ action: 'add_hodim', tgId: tgId, username: username || null });
        if (data.success) {
            showToastMsg('✅ Hodim muvaffaqiyatli qo\'shildi!');
            document.querySelector('.modal').remove();
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
    apiRequest({ action: 'get_hodimlar' }).then(data => {
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
            <div style="font-size:12px;color:var(--text-muted);">ID:${safeTgId}</div>
        </div>
        
        <div class="input-group" style="margin-bottom:15px;">
            <label>👤 Hodim Ismi (UserName)</label>
            <input type="text" id="uname_${safeTgId}" value="${safeUsername}" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:14px;background:#FAFBFD;">
        </div>
        
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
                    return `<label class="perm-label ${isChecked ? 'checked' : ''}" style="margin:0;padding:8px;border:1px solid var(--border);border-radius:8px;cursor:pointer;">
                        <input type="checkbox" id="${pid}" ${isChecked ? 'checked' : ''} value="${pos.name}" onchange="syncPermLabel(this)">
                        <span style="font-size:12px;">${pos.icon}${pos.name}</span>
                    </label>`;
                }).join('')}
            </div>
        </div>

        <div class="input-group" style="margin-bottom:15px;">
            <label>🏢 Guruh Nomi</label>
            <input type="text" id="hgroup_${safeTgId}" value="${escapeHtml(h.group || '')}" placeholder="Masalan: 1-guruh" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:14px;background:#FAFBFD;">
        </div>

        <div style="margin-bottom:15px;">
            <label class="perm-label ${h.isSardor ? 'checked' : ''}">
                <input type="checkbox" id="hsardor_${safeTgId}" ${h.isSardor ? 'checked' : ''} onchange="syncPermLabel(this)">
                <span>🎖 Guruh Sardori</span>
            </label>
        </div>

        <div class="hodim-perms-grid" style="margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            ${permToggle(safeTgId, 'canAdd', h.canAdd, '➕ Amal qo\'shish')}
            ${permToggle(safeTgId, 'canViewAll', h.canViewAll, '👁 Barchasini ko\'rish')}
            ${permToggle(safeTgId, 'canViewDash', h.canViewDash, '📈 Dashboard')}
            ${permToggle(safeTgId, 'canExport', h.canExport, '📥 Excel')}
            ${permToggle(safeTgId, 'canEdit', h.canEdit, '✏️ Tahrirlash')}
            ${permToggle(safeTgId, 'canDelete', h.canDelete, '🗑 O\'chirish')}
        </div>

        <div style="display:flex;gap:10px;">
            <button class="btn-main" id="hsave_${safeTgId}" onclick="saveHodim('${safeTgId}')" style="flex:1;padding:12px;border-radius:10px;font-weight:600;" ${isConfigLocked ? 'disabled' : ''}>💾 Saqlash</button>
            <button class="btn-secondary" onclick="deleteHodim('${safeTgId}')" style="flex:1;padding:12px;border-radius:10px;font-weight:600;background:#EF4444;color:white;border:1px solid #EF4444;" ${isConfigLocked ? 'disabled' : ''}>🗑 O'chirish</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    applyRoleConstraintsToCard(safeTgId, false);
}

function permToggle(tgId, field, val, label) {
    const id = `hp_${tgId}_${field}`;
    const checked = (val === true || val === 1 || String(val) === "1");
    return `<label class="perm-label ${checked ? 'checked' : ''}" style="margin:0;padding:8px;border:1px solid var(--border);border-radius:8px;cursor:pointer;">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="syncPermLabel(this)">
        <span style="font-size:12px;">${label}</span>
    </label>`;
}

function syncPermLabel(cb) {
    const lbl = cb.closest('.perm-label');
    if (lbl) lbl.classList.toggle('checked', cb.checked);
}

function setPermChecked(tgId, field, checked) {
    const el = document.getElementById(`hp_${tgId}_${field}`);
    if (el) {
        el.checked = !!checked;
        syncPermLabel(el);
    }
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
    if (role === 'SUPER_ADMIN') return { canAdd: 1, canViewAll: 1, canViewDash: 1, canExport: 1, canEdit: 1, canDelete: 1 };
    if (role === 'DIRECTOR') return { canAdd: 1, canViewAll: 1, canViewDash: 1, canExport: 1, canEdit: 0, canDelete: 0 };
    if (role === 'ADMIN') return { canAdd: 1, canViewAll: 1, canViewDash: 0, canExport: 0, canEdit: 0, canDelete: 0 };
    return { canAdd: 1, canViewAll: 0, canViewDash: 0, canExport: 0, canEdit: 0, canDelete: 0 };
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
    const list = document.getElementById('hodimlarList');
    if(!list) return;
    list.innerHTML = `<div class="skeleton skeleton-item"></div><div class="skeleton skeleton-item"></div>`;
    try {
        const data = await apiRequest({ action: 'get_hodimlar' });
        if (!data.success) {
            list.innerHTML = `<div class="empty-state"><p style="color:var(--red);">${escapeHtml(data.error || 'Xato')}</p></div>`;
            return;
        }
        let html = `
            <div class="hodim-add-section" style="margin-bottom:20px;">
                <button class="btn-main" onclick="showAddHodimModal()" style="width:100%;padding:14px;font-size:16px;border-radius:12px;">➕ Yangi Hodim Qo'shish</button>
            </div>
            <div class="hodimlar-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:15px;">
        `;
        if (!data.data.length) {
            html += `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">👥</div><p>Hali hodim qo'shilmagan</p></div>`;
        } else {
            data.data.forEach(h => {
                const roleBadge = roleBadgeHtml(h.role);
                html += `
                    <div class="hodim-card" onclick="openHodimSettings('${h.tgId}')" style="cursor:pointer;border:1px solid var(--border);border-radius:12px;padding:16px;background:#fff;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto 8px;">👤</div>
                        <div style="font-weight:600;font-size:14px;color:var(--navy);margin-bottom:4px;">${escapeHtml(h.username || '—')}</div>
                        ${roleBadge}
                    </div>
                `;
            });
        }
        html += `</div>`;
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Yuklanmadi</p></div>`;
    }
}

async function saveHodim(tgId) {
    const saveBtn = document.getElementById(`hsave_${tgId}`);
    setButtonLoading(saveBtn, true, 'Saqlanmoqda...');
    
    const payload = {
        action: 'update_hodim',
        tgId: tgId,
        role: getRoleValue(tgId),
        username: document.getElementById(`uname_${tgId}`).value,
        guruh: document.getElementById(`hgroup_${tgId}`).value,
        isSardor: document.getElementById(`hsardor_${tgId}`).checked ? 1 : 0
    };

    ROLE_PERM_FIELDS.forEach(field => {
        const el = document.getElementById(`hp_${tgId}_${field}`);
        payload[field] = el && el.checked ? 1 : 0;
    });

    const selectedPositions = [];
    TECHNICAL_POSITIONS.forEach(pos => {
        const pid = `hpos_${tgId}_${pos.name.replace(/\s+/g, '_')}`;
        const el = document.getElementById(pid);
        if (el && el.checked) selectedPositions.push(pos.name);
    });
    payload.lavozim = selectedPositions.join(',');

    try {
        const data = await apiRequest(payload);
        if (data.success) {
            showToastMsg('✅ Saqlandi!');
            const modal = document.querySelector('.modal');
            if(modal) modal.remove();
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
    if (!confirm('Ushbu hodimni o\'chirishga ishonchingiz komilmi?')) return;
    try {
        const data = await apiRequest({ action: 'delete_hodim', tgId });
        if (data.success) {
            showToastMsg('✅ Hodim o\'chirildi');
            document.querySelectorAll('.modal').forEach(m => m.remove());
            loadHodimlar();
        } else {
            showToastMsg('❌ ' + data.error, true);
        }
    } catch (e) {
        showToastMsg('❌ Server xatosi', true);
    }
}