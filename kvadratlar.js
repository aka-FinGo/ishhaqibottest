// ============================================================
// KVADRATLAR.JS — Measurements Logic
// ============================================================

let kvFullRecords = [];
let kvFilteredRecords = [];

const KV_MONTHS_UZ = [
    '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

/**
 * Month string like "_01" → "Yanvar"
 */
function kvMonthLabel(monthStr) {
    const clean = String(monthStr || '').replace(/^_+/, '').replace(/^'/, '');
    const num = parseInt(clean, 10);
    return (num >= 1 && num <= 12) ? KV_MONTHS_UZ[num] : (clean || '—');
}

/**
 * Populates staff dropdowns and basic filters.
 */
function populateKvadratMeta(staffList) {
    const staffFilter = document.getElementById('kvFilterStaff');
    const kvStaffModal = document.getElementById('kvStaffSelect');

    if (staffFilter) {
        staffFilter.innerHTML = '<option value="all">Barcha hodimlar</option>';
        staffList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            staffFilter.appendChild(opt);
        });
    }

    if (kvStaffModal) {
        kvStaffModal.innerHTML = '<option value="">Hodimni tanlang...</option>';
        staffList.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            kvStaffModal.appendChild(opt);
        });
    }

    // Populate years for kvFilterYear
    const yearSel = document.getElementById('kvFilterYear');
    if (yearSel) {
        const currentYear = new Date().getFullYear();
        yearSel.innerHTML = '<option value="all">Yillar</option>';
        for (let y = currentYear; y >= 2024; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSel.appendChild(opt);
        }
    }

    // Populate month/year in add modal
    _initKvFormYears();
}

function _initKvFormYears() {
    const curYear = new Date().getFullYear();
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    const yearEl = document.getElementById('kvActionYear');
    if (yearEl) {
        yearEl.innerHTML = '';
        for (let y = curYear + 1; y >= curYear - 2; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === curYear) opt.selected = true;
            yearEl.appendChild(opt);
        }
    }

    const monthEl = document.getElementById('kvActionMonth');
    if (monthEl) monthEl.value = curMonth;
}

/**
 * Initializes the tab: loads data from server.
 */
async function initKvadratTab() {
    const listContainer = document.getElementById('kvList');
    if (!listContainer) return;
    listContainer.innerHTML = `
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>
        <div class="skeleton skeleton-item"></div>`;

    try {
        const data = await apiRequest({ action: 'kvadrat_get_all' });
        if (data.success) {
            kvFullRecords = data.data || [];
            applyKvFilters();
        } else {
            listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ ${escapeHtml(data.error || 'Yuklashda xato')}</p></div>`;
        }
    } catch (e) {
        const listEl = document.getElementById('kvList');
        if (listEl) listEl.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Tarmoq xatosi</p></div>`;
    }

    updateKvFabVisibility();
}

/**
 * Shows/hides "+" button for Kvadrat Tab based on Loyihachi position.
 */
function updateKvFabVisibility() {
    const fab = document.getElementById('nav-add');
    if (!fab) return;

    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'kvadratTab') {
        const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        const isLoyihachi = myRole === 'SuperAdmin' || positions.indexOf('Loyihachi') !== -1;
        fab.style.visibility = isLoyihachi ? 'visible' : 'hidden';
        fab.style.pointerEvents = isLoyihachi ? 'auto' : 'none';
        fab.style.opacity = isLoyihachi ? '1' : '0';
        fab.style.transition = 'opacity 0.2s';
    } else {
        // Normal behavior for other tabs where FAB goes to addTab
        fab.style.visibility = 'visible';
        fab.style.pointerEvents = 'auto';
        fab.style.opacity = '1';
    }
}

/**
 * Renders the filtered list of measurements.
 */
function renderKvList() {
    const container = document.getElementById('kvList');
    const totalDisplay = document.getElementById('kvTotalM2');
    if (!container) return;

    if (!kvFilteredRecords.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📏</div>
                <p>Ma'lumot topilmadi</p>
            </div>`;
        if (totalDisplay) totalDisplay.innerText = '0';
        return;
    }

    let totalM2 = 0;
    let html = '';

    kvFilteredRecords.forEach((rec, idx) => {
        totalM2 += Number(rec.totalM2) || 0;

        const isOwner = String(rec.ownerTgId) === String(telegramId);
        const canManage = isOwner || myRole === 'Admin' || myRole === 'SuperAdmin';

        const monthLabel = kvMonthLabel(rec.month);
        const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });

        // Status colors & labels based on dynamic config
        let statusHtml = '';
        const status = rec.status || 'yangi';
        const config = (typeof myPermissions !== 'undefined' && myPermissions.workflowConfig) || [];
        const stepMatch = config.find(s => s.status === status);

        let badgeColor = 'b-yellow'; // default
        if (status === 'yangi') badgeColor = 'b-yellow';
        else if (status.indexOf('yigi') !== -1) badgeColor = 'b-blue';
        else if (status.indexOf('tayyor') !== -1 || status.indexOf('landi') !== -1) badgeColor = 'b-green';

        statusHtml = `<span class="kv-badge ${badgeColor}">${escapeHtml(status.charAt(0).toUpperCase() + status.slice(1))}</span>`;

        // Quick action button logic (DYNAMIC)
        let actionBtn = '';
        const myPoss = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        const currentStepIdx = Number(rec.currentStep) || 1;
        const nextStep = config.find(s => s.index === currentStepIdx + 1);

        if (nextStep && (myRole === 'SuperAdmin' || myPoss.indexOf(nextStep.position) !== -1)) {
            let btnClass = 'b-blue';
            if (nextStep.status.indexOf('tayyor') !== -1 || nextStep.status.indexOf('landi') !== -1) btnClass = 'b-green';
            actionBtn = `<button class="kv-claim-btn ${btnClass}" onclick="event.stopPropagation();claimKvWork(${rec.rowId})">${escapeHtml(nextStep.action)}</button>`;
        }

        html += `
        <div class="history-item kv-item" onclick="showKvDetailModal(${idx})" style="cursor:pointer;">
            <div class="item-header">
                <span class="item-name" style="display:flex;align-items:center;gap:6px;">
                    <span style="background:#EFF6FF;color:#1D4ED8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">
                        №${rec.no || '—'}
                    </span>
                    ${statusHtml}
                </span>
                <span class="item-date">📅 ${escapeHtml(rec.date || '—')}</span>
            </div>
            <div style="font-size:15px;font-weight:700;color:var(--navy);margin:6px 0 4px;">
                📌 ${escapeHtml(rec.orderName || '—')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;color:var(--text-muted);">👤 ${escapeHtml(rec.staffName || '—')}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                     ${actionBtn}
                     <span style="background:#0F172A;color:#fff;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:800;">
                        ${m2Val} m²
                     </span>
                </div>
            </div>
            <div class="item-edit-hint">→ batafsil tarix</div>
        </div>`;
    });

    container.innerHTML = html;
    if (totalDisplay) totalDisplay.innerText = totalM2.toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
}

/**
 * Show detail modal for a kvadrat record
 */
function showKvDetailModal(idx) {
    const rec = kvFilteredRecords[idx];
    if (!rec) return;

    const isOwner = String(rec.ownerTgId) === String(telegramId);
    const canManage = isOwner || myRole === 'Admin' || myRole === 'SuperAdmin';
    const monthLabel = kvMonthLabel(rec.month);
    const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });

    // Workflow actions in modal (DYNAMIC)
    let claimBtnHtml = '';
    const status = rec.status || 'yangi';
    const config = (typeof myPermissions !== 'undefined' && myPermissions.workflowConfig) || [];
    const myPoss = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
    const currentStepIdx = Number(rec.currentStep) || 1;
    const nextStep = config.find(s => s.index === currentStepIdx + 1);

    if (nextStep && (myRole === 'SuperAdmin' || myPoss.indexOf(nextStep.position) !== -1)) {
        claimBtnHtml = `<button class="btn-main" style="background:var(--navy);margin-bottom:10px;" onclick="closeKvDetailModal();claimKvWork(${rec.rowId})">✅ ${escapeHtml(nextStep.action)}</button>`;
    }

    // Build History View
    let historyHtml = '';
    const logs = rec.logs || [];
    logs.forEach(log => {
        const stepCfg = config.find(s => s.index === log.step);
        const name = (log.uid === rec.ownerTgId) ? rec.staffName : (globalEmployeeList && globalEmployeeList.find(e => e.tgId == log.uid)?.username || log.uid);
        historyHtml += `
        <div style="border-left:2px solid var(--border); padding-left:12px; margin-bottom:12px; position:relative;">
            <div style="width:10px; height:10px; border-radius:50%; background:var(--navy); position:absolute; left:-6px; top:4px;"></div>
            <div style="font-size:12px; font-weight:700; color:var(--navy);">${escapeHtml(stepCfg ? stepCfg.status : 'Bajarildi')}</div>
            <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(name)} • ${new Date(log.d).toLocaleString('uz-UZ')}</div>
        </div>`;
    });

    document.getElementById('kvDetailModalBody').innerHTML = `
        <div class="modal-drag"></div>
        <div class="detail-header">
            <span class="detail-badge uzs" style="background:#EFF6FF;color:#1D4ED8;">📐 Ish Oqimi Tarixi</span>
            <div class="detail-comment">📌 ${escapeHtml(rec.orderName || '—')}</div>
            <div class="detail-date">📅 №${rec.no || '—'} | Sana: ${escapeHtml(rec.date || '—')}</div>
        </div>
        
        <div class="card" style="margin-bottom:15px; background:#F8FAFC;">
            <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:10px;">📉 Jarayon tarixi</div>
            ${historyHtml || '<p style="font-size:12px; color:var(--text-muted);">Tarix bo\'sh</p>'}
        </div>

        <div class="detail-card">
            <div class="detail-row">
                <span class="detail-key">Hozirgi Status</span>
                <span class="detail-val"><b>${escapeHtml(status.toUpperCase())}</b></span>
            </div>
            <div class="detail-row">
                <span class="detail-key">Jami m²</span>
                <span class="detail-val" style="color:#0F172A;font-size:18px;">${m2Val} m²</span>
            </div>
        </div>

        ${claimBtnHtml}
        
        <div class="admin-actions" style="display:flex; gap:10px; margin-top:10px;">
            ${myPermissions.canEdit || myRole === 'SuperAdmin' ? `<button class="btn-secondary" style="flex:1;" onclick="closeKvDetailModal();openEditKvModal(${idx})">✏️ Tahrirlash</button>` : ''}
            ${myPermissions.canDelete || myRole === 'SuperAdmin' ? `<button class="btn-secondary" style="flex:1; color:var(--red);" onclick="closeKvDetailModal();deleteKv(${rec.rowId})">🗑 O'chirish</button>` : ''}
        </div>

        <button class="btn-secondary" style="margin-top:12px; width:100%;" onclick="closeKvDetailModal()">✕ Yopish</button>
    `;

    document.getElementById('kvDetailModal').classList.remove('hidden');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function closeKvDetailModal() {
    document.getElementById('kvDetailModal').classList.add('hidden');
}

/**
 * Applies current filters to the full records.
 */
function applyKvFilters() {
    const month = document.getElementById('kvFilterMonth')?.value || 'all';
    const year = document.getElementById('kvFilterYear')?.value || 'all';
    const staff = document.getElementById('kvFilterStaff')?.value || 'all';

    kvFilteredRecords = kvFullRecords.filter(rec => {
        // Month filter: rec.month is "_01", "_02" etc
        if (month !== 'all') {
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            if (cleanMonth !== month) return false;
        }
        // Year filter: rec.date is "DD/MM/YYYY"
        if (year !== 'all') {
            if (!String(rec.date || '').endsWith(String(year))) return false;
        }
        // Staff filter
        if (staff !== 'all') {
            if (rec.staffName !== staff) return false;
        }
        return true;
    });

    renderKvList();
}

/**
 * Open Add/Edit modal
 */
function openKvModal(rowId = null) {
    const modal = document.getElementById('kvadratModal');
    const title = document.getElementById('kvModalTitle');
    const form = document.getElementById('kvForm');

    form.reset();
    document.getElementById('kvRowId').value = rowId || '';
    _initKvFormYears();

    if (rowId) {
        title.innerText = '✏️ Tahrirlash';
        const rec = kvFullRecords.find(r => String(r.rowId) === String(rowId));
        if (rec) {
            document.getElementById('kvOrderName').value = rec.orderName || '';
            document.getElementById('kvTotalM2Input').value = rec.totalM2 || '';
            document.getElementById('kvStaffSelect').value = rec.staffName || '';

            // Parse month from rec.month like "_03" → "03"
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            const monthEl = document.getElementById('kvActionMonth');
            if (monthEl && cleanMonth) monthEl.value = cleanMonth.padStart(2, '0');

            // Parse year from rec.date "DD/MM/YYYY"
            const yearEl = document.getElementById('kvActionYear');
            if (yearEl && rec.date) {
                const parts = String(rec.date).split('/');
                if (parts.length === 3) yearEl.value = parts[2];
            }
        }
    } else {
        const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        if (myRole !== 'SuperAdmin' && positions.indexOf('Loyihachi') === -1) {
            showToastMsg('❌ Faqat "Loyihachi" buyurtma qo\'sha oladi', true);
            return;
        }

        title.innerText = '📐 Yangi o\'lchov kiritish';
        // Auto-select current user
        if (typeof globalEmployeeList !== 'undefined' && globalEmployeeList.includes(myUsername)) {
            const sel = document.getElementById('kvStaffSelect');
            if (sel) sel.value = myUsername;
        }
    }

    modal.classList.remove('hidden');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

function closeKvModal() {
    document.getElementById('kvadratModal').classList.add('hidden');
}

/**
 * Save record (Add or Edit)
 * staffName + ownerTgId yuboriladi — backend hodimlar ro'yxatidan ismni tasdiqlaydi.
 */
async function saveKv() {
    const rowId = document.getElementById('kvRowId').value;
    const orderName = (document.getElementById('kvOrderName').value || '').trim();
    const totalM2 = parseFloat(document.getElementById('kvTotalM2Input').value) || 0;
    const staffName = document.getElementById('kvStaffSelect').value;
    const month = document.getElementById('kvActionMonth')?.value || '';
    const year = document.getElementById('kvActionYear')?.value || '';
    const monthStr = (year && month) ? `_${month}` : '';

    if (!orderName) {
        showToastMsg('❌ Buyurtma nomini kiriting', true);
        return;
    }
    if (totalM2 <= 0) {
        showToastMsg('❌ m² miqdorini kiriting', true);
        return;
    }
    if (!staffName) {
        showToastMsg('❌ Hodimni tanlang', true);
        return;
    }

    // ownerTgId: tanlangan hodimning tgId ni globalEmployeeList dan topamiz
    // globalEmployeeList — { tgId: username } object (buildUsernameMap dan)
    let ownerTgId = telegramId; // default: joriy foydalanuvchi
    if (typeof globalEmployeeList !== 'undefined') {
        // globalEmployeeList Object.values() bo'lganligi sababli
        // tgId ni _MEMO usernameMap dan teskari topamiz
        const empEntries = typeof window._kvEmpMap !== 'undefined' ? window._kvEmpMap : {};
        const found = Object.entries(empEntries).find(([id, name]) => name === staffName);
        if (found) ownerTgId = found[0];
    }

    try {
        const action = rowId ? 'kvadrat_edit' : 'kvadrat_add';
        const data = await apiRequest({
            action,
            rowId: rowId || undefined,
            orderName,
            totalM2,
            staffName,
            ownerTgId,   // Backend uchun — hodimlar ro'yxatidan ism olishda ishlatiladi
            month: monthStr,
            year
        });

        if (data.success) {
            showToastMsg('✅ Saqlandi!');
            closeKvModal();
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || 'Saqlashda xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}

/**
 * Delete record
 */
async function deleteKv(rowId) {
    if (document.activeElement) document.activeElement.blur();
    await new Promise(r => setTimeout(r, 50));

    if (!confirm("Ushbu o'lchovni o'chirishga ishonchingiz komilmi?")) return;

    try {
        const data = await apiRequest({ action: 'kvadrat_delete', rowId });
        if (data.success) {
            showToastMsg("✅ O'chirildi");
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || "O'chirishda xato"), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}

/**
 * Claims work (Yig'uvchi or Qadoqlovchi)
 */
async function claimKvWork(rowId, claimType) {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

    try {
        const data = await apiRequest({
            action: 'kvadrat_claim',
            rowId,
            claimType
        });

        if (data.success) {
            showToastMsg('✅ Muvaffaqiyatli belgilandi!');
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato yuz berdi'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    }
}