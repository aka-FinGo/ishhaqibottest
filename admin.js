/**
 * admin.js - Admin panel boshqaruvi
 * Optimizatsiya: Event Delegation, DOM Caching, Batch Updates
 */

// Global state va cache
const AdminState = {
    currentFilter: {},
    cache: {
        users: [],
        roles: [],
        positions: []
    },
    elements: {}
};

// DOM elementlarini bir marta yuklash va cache qilish
function initAdminCache() {
    AdminState.elements = {
        tableBody: document.getElementById('adminTableBody'),
        filterRole: document.getElementById('filterRole'),
        filterPosition: document.getElementById('filterPosition'),
        searchInput: document.getElementById('adminSearch'),
        addBtn: document.getElementById('addUserBtn'),
        modal: document.getElementById('userModal'),
        form: document.getElementById('userForm'),
        saveBtn: document.getElementById('saveUserBtn')
    };
}

// Admin data loading and rendering is now handled by enhanced_admin_list.js
// This ensures better performance, caching, and skeleton loading animations.


// Jadvalni render qilish (Optimizatsiya: DocumentFragment)
function renderUserTable(users) {
    const tbody = AdminState.elements.tableBody;
    if (!tbody) return;

    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const filtered = filterUsers(users);

    filtered.forEach(user => {
        const tr = document.createElement('tr');
        const idStr = String(user.id); // Convert to string for consistency

        // Create cells safely
        const cells = [
            { text: user.name },
            { text: user.email },
            { text: user.role },
            { text: user.position || '-' },
            { html: true, content: `
                <button class="btn-edit" data-id="${escapeHtml(idStr)}">Tahrirlash</button>
                <button class="btn-delete" data-id="${escapeHtml(idStr)}">O'chirish</button>
            ` }
        ];

        cells.forEach(cell => {
            const td = document.createElement('td');
            if (cell.html) {
                td.innerHTML = cell.content;
            } else {
                td.textContent = cell.text;
            }
            tr.appendChild(td);
        });

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// HTML escaping function
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// populateEmployeeFilter is handled in enhanced_admin_list.js


// Filtrlash mantiqi
function filterUsers(users) {
    const { role, position, search } = AdminState.currentFilter;
    
    return users.filter(user => {
        const matchRole = !role || user.role === role;
        const matchPos = !position || user.position === position;
        const matchSearch = !search || 
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase());
            
        return matchRole && matchPos && matchSearch;
    });
}

// Filtrlarni to'ldirish
function populateFilters(roles, positions) {
    const roleSelect = AdminState.elements.filterRole;
    const posSelect = AdminState.elements.filterPosition;
    
    if (roleSelect) {
        roleSelect.innerHTML = '<option value="">Barchasi</option>' + 
            roles.map(r => `<option value="${r}">${r}</option>`).join('');
    }
    
    if (posSelect) {
        posSelect.innerHTML = '<option value="">Barchasi</option>' + 
            positions.map(p => `<option value="${p}">${p}</option>`).join('');
    }
}

// Event Delegation (Bitta listener bilan barcha tugmalarni boshqarish)
function setupEventListeners() {
    const tableBody = AdminState.elements.tableBody;
    if (!tableBody) return;

    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        
        if (target.classList.contains('btn-edit')) {
            editUser(id);
        } else if (target.classList.contains('btn-delete')) {
            deleteUser(id);
        }
    });
    
    // Filter o'zgarishlari
    if (AdminState.elements.filterRole) {
        AdminState.elements.filterRole.addEventListener('change', (e) => {
            AdminState.currentFilter.role = e.target.value;
            renderUserTable(AdminState.cache.users);
        });
    }
    
    if (AdminState.elements.filterPosition) {
        AdminState.elements.filterPosition.addEventListener('change', (e) => {
            AdminState.currentFilter.position = e.target.value;
            renderUserTable(AdminState.cache.users);
        });
    }
    
    // Qidiruv (Debounce bilan)
    if (AdminState.elements.searchInput) {
        let timeout;
        AdminState.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                AdminState.currentFilter.search = e.target.value;
                renderUserTable(AdminState.cache.users);
            }, 300);
        });
    }
    
    // Modal saqlash
    if (AdminState.elements.saveBtn) {
        AdminState.elements.saveBtn.addEventListener('click', saveUser);
    }
}

// Foydalanuvchini tahrirlash
function editUser(id) {
    const idStr = String(id); // Ensure string comparison
    const user = AdminState.cache.users.find(u => String(u.id) === idStr);
    if (!user) {
        showToastMsg('❌ Foydalanuvchi topilmadi', true);
        return;
    }

    const form = AdminState.elements.form;
    if (form) {
        form.dataset.userId = idStr;
        form.querySelector('[name="name"]').value = user.name || '';
        form.querySelector('[name="email"]').value = user.email || '';
        form.querySelector('[name="role"]').value = user.role || '';
        // Boshqa maydonlar...

        AdminState.elements.modal.style.display = 'block';
    }
}

// Foydalanuvchini saqlash
async function saveUser() {
    const form = AdminState.elements.form;
    if (!form) return;

    const userId = form.dataset.userId;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        showLoading(true);
        const result = await apiRequest({action: 'saveUser', data: data, userId: userId});
        if (result.success) {
            closeModal();
            if (typeof loadAdminData === 'function') {
                loadAdminData(); // Yangilash
            }
            showToastMsg("✅ Muvaffaqiyatli saqlandi!");
        } else {
            showToastMsg("❌ Saqlashda xatolik: " + (result.error || "Noma'lum xatolik"), true);
        }
    } catch (error) {
        showToastMsg("❌ Saqlashda xatolik: " + error.message, true);
    } finally {
        showLoading(false);
    }
}

// Modalni yopish
function closeModal() {
    if (AdminState.elements.modal) {
        AdminState.elements.modal.style.display = 'none';
        AdminState.elements.form.reset();
        delete AdminState.elements.form.dataset.userId;
    }
}

// Yuklanishni boshqarish
function showLoading(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = show ? 'block' : 'none';
    // Inputlarni bloklash/ochish
    const inputs = document.querySelectorAll('#userModal input, #userModal select');
    inputs.forEach(input => input.disabled = show);
}

function showError(msg) {
    if (typeof showToastMsg === 'function') {
        showToastMsg("❌ " + msg, true);
    } else {
        console.error(msg);
    }
}

function showSuccess(msg) {
    if (typeof showToastMsg === 'function') {
        showToastMsg("✅ " + msg);
    } else {
        console.log(msg);
    }
}

// Foydalanuvchini o'chirish
async function deleteUser(id) {
    const idStr = String(id);
    if (!confirm("Ushbu foydalanuvchini o'chirishga ishonchingiz komilmi?")) return;

    try {
        showLoading(true);
        const result = await apiRequest({action: 'deleteUser', userId: idStr});
        if (result.success) {
            showToastMsg("✅ Foydalanuvchi o'chirildi");
            if (typeof loadAdminData === 'function') {
                loadAdminData();
            }
        } else {
            showToastMsg("❌ O'chirishda xatolik: " + (result.error || "Noma'lum xatolik"), true);
        }
    } catch (error) {
        showToastMsg("❌ O'chirishda xatolik: " + error.message, true);
    } finally {
        showLoading(false);
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initAdminCache();
    if (typeof loadAdminData === 'function') loadAdminData();
    setupEventListeners();
});

// Global settings UI functions
function updateSettingsDOM() {
    if (typeof globalSettings === 'undefined') return;
    
    const el1 = document.getElementById('settingOnlyBugalterAdd');
    if (el1) el1.checked = globalSettings.onlyBugalterAdd;
    
    const el2 = document.getElementById('settingDisableEmpEditDelete');
    if (el2) el2.checked = globalSettings.disableEmpEditDelete;
    
    const el3 = document.getElementById('settingNotifyDirector');
    if (el3) el3.checked = globalSettings.notifyDirector;
    
    const el4 = document.getElementById('settingWorkflowStrictMode');
    if (el4) el4.checked = globalSettings.workflowStrictMode;
}

async function loadGlobalSettingsUI() {
    updateSettingsDOM(); // Darhol DOMni yangilaymiz
    try {
        const res = await apiRequest({ action: 'get_global_settings' });
        if (res.success && res.settings) {
            Object.assign(globalSettings, res.settings);
            updateSettingsDOM(); // Yangi ma'lumot kelsa yana yangilaymiz
        }
    } catch (e) {
        showError("Sozlamalarni yuklashda xatolik");
    }
}

async function toggleGlobalSettingUI(key, value) {
    if (window.tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
    try {
        const res = await apiRequest({ action: 'set_global_setting', key: key, value: value });
        if (res.success) {
            showSuccess("Sozlama muvaffaqiyatli saqlandi!");
            // Update local state
            if (key === 'ONLY_BUGALTER_ADD') {
                globalSettings.onlyBugalterAdd = value;
                if (typeof updateKvFabVisibility === 'function') updateKvFabVisibility();
            }
            if (key === 'DISABLE_EMP_EDIT_DELETE') globalSettings.disableEmpEditDelete = value;
            if (key === 'NOTIFY_DIRECTOR') globalSettings.notifyDirector = value;
            if (key === 'WORKFLOW_STRICT_MODE') globalSettings.workflowStrictMode = value;
        } else {
            showError("Saqlashda xatolik: " + res.error);
            // Revert DOM on error
            updateSettingsDOM();
        }
    } catch (e) {
        showError("Saqlashda xatolik: " + e.message);
        // Revert DOM on error
        updateSettingsDOM();
    }
}

async function runSystemSelfCheck(scope) {
    const btn = document.getElementById('selfCheckBtnAdmin');
    const statusEl = document.getElementById('adminServiceStatus');
    if (btn) btn.disabled = true;
    if (statusEl) {
        statusEl.style.opacity = '1';
        statusEl.style.display = 'block';
        statusEl.style.textAlign = 'left';
        statusEl.className = 'status-msg';
        statusEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:8px; background:rgba(0,242,254,0.08); border:1px solid rgba(0,242,254,0.2); color:var(--text-light, #94a3b8); margin-top:10px;">
                <div class="loading-spinner" style="border-color:rgba(0,242,254,0.3); border-top-color:#00f2fe; width:16px; height:16px; flex-shrink:0;"></div>
                <span style="font-size:13px;">Tizim sozlamalari va xavfsizlik parametrlari tekshirilmoqda...</span>
            </div>
        `;
    }
    
    try {
        const res = await apiRequest({ action: 'self_check' });
        if (res && res.success) {
            const warnings = res.warnings || 0;
            const checks = Array.isArray(res.checks) ? res.checks : [];
            const failedChecks = checks.filter(c => !c.ok);

            if (statusEl) {
                statusEl.style.opacity = '1';
                statusEl.style.display = 'block';
                statusEl.style.textAlign = 'left';

                let html = '';
                if (warnings > 0) {
                    html += `
                        <div style="background:rgba(245,158,11,0.1); border:1px solid #f59e0b; border-radius:10px; padding:12px; margin-top:12px;">
                            <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#f59e0b; font-size:14px; margin-bottom:8px;">
                                <span>⚠️</span>
                                <span>Tizimda ${warnings} ta ogohlantirish aniqlandi:</span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:8px;">
                    `;
                    failedChecks.forEach(c => {
                        html += `
                            <div style="background:rgba(245,158,11,0.08); border-left:3px solid #f59e0b; padding:8px 10px; border-radius:4px;">
                                <div style="font-weight:700; color:#fbbf24; font-size:13px;">${c.label || c.key} <code>(${c.key})</code></div>
                                <div style="font-size:12px; color:var(--text, #e2e8f0); margin-top:3px; line-height:1.4;"><b>Muammo:</b> ${c.desc || c.note || "Noto'g'ri sozlangan"}</div>
                                ${c.advice ? `<div style="font-size:11px; color:#94a3b8; margin-top:4px;">💡 <i>Maslahat: ${c.advice}</i></div>` : ''}
                            </div>
                        `;
                    });
                    html += `
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:10px; padding:12px; margin-top:12px;">
                            <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#10b981; font-size:14px;">
                                <span>✅</span>
                                <span>Barcha tizim parametrlari to'g'ri sozlangan!</span>
                            </div>
                        </div>
                    `;
                }

                // Full checks list
                if (checks.length > 0) {
                    html += `
                        <div style="margin-top:12px; background:var(--surface, #1e293b); border:1px solid var(--border, #334155); border-radius:10px; padding:12px;">
                            <div style="font-size:11px; font-weight:700; color:var(--text-muted, #94a3b8); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Barcha tekshiruvlar tafsiloti:</div>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                    `;
                    checks.forEach(c => {
                        const icon = c.ok ? '✅' : '⚠️';
                        const color = c.ok ? '#10b981' : '#f59e0b';
                        const badgeBg = c.ok ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.1)';
                        html += `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-radius:6px; background:${badgeBg}; font-size:12px; gap:8px;">
                                <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                                    <span>${icon}</span>
                                    <span style="font-weight:600; color:var(--text, #e2e8f0); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${c.label || c.key}</span>
                                </div>
                                <span style="color:${color}; font-weight:700; font-size:11px; white-space:nowrap; flex-shrink:0;">${c.note}</span>
                            </div>
                        `;
                    });
                    html += `
                            </div>
                        </div>
                    `;
                }

                statusEl.innerHTML = html;
            }

            // Toast message
            if (warnings > 0) {
                const toastLines = failedChecks.map(c => `• ${c.label || c.key}: ${c.desc || c.note}`);
                const toastMsg = `⚠️ Ogohlantirish (${warnings} ta):\n` + toastLines.slice(0, 2).join('\n') + (toastLines.length > 2 ? `\n(+yana ${toastLines.length - 2} ta)` : '');
                showToastMsg(toastMsg, 'warn');
            } else {
                showToastMsg("✅ Tizim tekshiruvi muvaffaqiyatli! Barcha parametrlar to'g'ri sozlangan.");
            }
        } else {
            const err = res && res.error ? res.error : "Xatolik yuz berdi";
            if (statusEl) {
                statusEl.style.opacity = '1';
                statusEl.style.display = 'block';
                statusEl.style.textAlign = 'left';
                statusEl.innerHTML = `
                    <div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:10px; padding:12px; margin-top:12px; color:#f87171; font-size:13px; font-weight:600;">
                        ❌ ${err}
                    </div>
                `;
            }
            showToastMsg("❌ " + err, true);
        }
    } catch (e) {
        if (statusEl) {
            statusEl.style.opacity = '1';
            statusEl.style.display = 'block';
            statusEl.style.textAlign = 'left';
            statusEl.innerHTML = `
                <div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:10px; padding:12px; margin-top:12px; color:#f87171; font-size:13px; font-weight:600;">
                    ❌ Serverga ulanishda xato: ${e.message}
                </div>
            `;
        }
        showToastMsg("❌ Xatolik: " + e.message, true);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function runImportFromSheets() {
    const isConfirmed = confirm("⚠️ DIQQAT!\n\nGoogle Sheets dagi barcha ma'lumotlar (Hodimlar, Ish haqi, Kvadratlar, Lavozimlar, Sozlamalar) SQLite bazasiga import qilinadi.\n\nHar bir importdan oldin bazaning avtomatik zaxira nusxasi (backup) olinadi.\n\nDavom ettirishni tasdiqlaysizmi?");
    if (!isConfirmed) return;

    const btn = document.getElementById('btnAdminImportSheets');
    const statusEl = document.getElementById('adminImportStatus');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Yuklanmoqda (Google Sheets bilan bog'lanilmoqda)...`;
    }

    if (statusEl) {
        statusEl.style.opacity = '1';
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:var(--cyan-neon, #00f2fe); font-weight:600;">⏳ Google Sheets dan ma'lumotlar tortib olinmoqda va SQLite bazasi yangilanmoqda...</div>`;
    }

    try {
        const res = await apiRequest({ action: 'admin_import_from_sheets' }, { timeoutMs: 120000 });
        if (res && res.success) {
            const stats = res.stats || {};
            const backupMsg = res.backupFile ? `<div style="margin-top:6px; font-size:11px; color:var(--text-muted);">🛡️ Avtomatik zaxira fayli: <code>${res.backupFile}</code></div>` : '';

            if (statusEl) {
                statusEl.innerHTML = `
                    <div style="background:rgba(16,185,129,0.12); border:1px solid #10b981; border-radius:10px; padding:12px; margin-top:12px; color:#10b981; text-align:left;">
                        <div style="font-weight:700; font-size:14px; margin-bottom:6px;">✅ Muvaffaqiyatli import qilindi!</div>
                        <div style="font-size:12px; line-height:1.6; color:var(--text);">
                            • <b>Xodimlar (Hodimlar):</b> ${stats.employees || 0} ta<br>
                            • <b>Moliyaviy amallar (Ish haqi):</b> ${stats.records || 0} ta (Jami: ${(stats.totalUZS || 0).toLocaleString()} UZS, ${(stats.totalUSD || 0).toLocaleString()} $)<br>
                            • <b>Kvadratlar buyurtmalari:</b> ${stats.kvadratlar || 0} ta (Jami: ${stats.totalM2 || 0} m²)<br>
                            • <b>Lavozimlar & Bosqichlar:</b> ${stats.positions || 0} ta / ${stats.workflowSteps || 0} ta
                        </div>
                        ${backupMsg}
                    </div>
                `;
            }
            showToastMsg("✅ Google Sheets ma'lumotlari muvaffaqiyatli yuklandi!");

            // Agar boshqa ma'lumotlar ochiq bo'lsa yangilash
            if (typeof loadAllData === 'function') loadAllData();
            if (typeof loadKvData === 'function') loadKvData();
            if (typeof renderHodimlarTable === 'function') renderHodimlarTable();
        } else {
            const err = (res && res.error) ? res.error : "Noma'lum xatolik yuz berdi";
            if (statusEl) {
                statusEl.innerHTML = `
                    <div style="background:rgba(239,68,68,0.12); border:1px solid #ef4444; border-radius:10px; padding:12px; margin-top:12px; color:#f87171; text-align:left;">
                        ❌ <b>Xatolik:</b> ${err}
                    </div>
                `;
            }
            showToastMsg("❌ " + err, true);
        }
    } catch (e) {
        if (statusEl) {
            statusEl.innerHTML = `
                <div style="background:rgba(239,68,68,0.12); border:1px solid #ef4444; border-radius:10px; padding:12px; margin-top:12px; color:#f87171; text-align:left;">
                    ❌ <b>Aloqa xatosi:</b> ${e.message}
                </div>
            `;
        }
        showToastMsg("❌ Xatolik: " + e.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>📥</span> Google Sheets dan yuklab olish`;
        }
    }
}


