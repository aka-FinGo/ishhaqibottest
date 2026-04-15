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

/* ========== PROCESSING HELPERS ========== */
let activeKvProc = null;

function kvShowProc(msg) {
    if (activeKvProc) kvHideProc();
    const toast = document.createElement('div');
    toast.className = 'kv-proc-toast';
    toast.innerHTML = `<div class="kv-spinner"></div><span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(toast);
    activeKvProc = toast;
}

function kvHideProc(isSuccess = null, finalMsg = null) {
    if (!activeKvProc) return;
    const toast = activeKvProc;
    activeKvProc = null;

    if (isSuccess !== null) {
        toast.innerHTML = `<span>${isSuccess ? '✅' : '❌'}</span><span>${escapeHtml(finalMsg || (isSuccess ? 'Bajarildi' : 'Xatolik'))}</span>`;
        toast.classList.add(isSuccess ? 'success' : 'error');
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    } else {
        toast.remove();
    }
}

async function kvRefreshAll(btn) {
    if (btn) btn.classList.add('spinning');
    kvShowProc('Ma\'lumotlar yangilanmoqda...');
    try {
        await initKvadratTab();
        kvHideProc(true, 'Yangilandi');
    } catch (e) {
        kvHideProc(false, 'Yangilashda xato');
    } finally {
        if (btn) btn.classList.remove('spinning');
    }
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
    
    // Skeleton table rows
    listContainer.innerHTML = `
    <div class="kv-table-wrap">
        <table class="kv-table">
            <thead>
                <tr>
                    <th>№</th>
                    <th>Buyurtma №</th>
                    <th>Oy</th>
                    <th>m²</th>
                    <th>ST</th>
                </tr>
            </thead>
            <tbody>
                ${Array(5).fill('<tr><td colspan="5"><div class="skeleton" style="height:25px; margin:5px 0;"></div></tr>').join('')}
            </tbody>
        </table>
    </div>`;

    try {
        const data = await apiRequest({ action: 'kvadrat_get_all' });
        if (data.success) {
            kvFullRecords = data.data || [];
            applyKvFilters();
        } else {
            listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ ${escapeHtml(data.error || 'Yuklashda xato')}</p></div>`;
        }
    } catch (e) {
        console.error("initKvadratTab error:", e);
        listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Tarmoq xatosi: ${escapeHtml(e.message)}</p></div>`;
    }
    updateKvFabVisibility();
}

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
        fab.style.visibility = 'visible';
        fab.style.pointerEvents = 'auto';
        fab.style.opacity = '1';
    }
}

/**
 * Renders the filtered list of measurements as a table.
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
    let rowsHtml = '';
    let lastDate = '';

    kvFilteredRecords.forEach((rec, idx) => {
        totalM2 += Number(rec.totalM2) || 0;

        // Group by Date rows
        if (rec.date !== lastDate) {
            rowsHtml += `<tr class="kv-date-row"><td colspan="5">📅 ${escapeHtml(rec.date)}</td></tr>`;
            lastDate = rec.date;
        }

        const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const monthClean = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
        
        const config = (typeof myPermissions !== 'undefined' && myPermissions.workflowConfig) || [];
        const currentStepIdx = Number(rec.currentStep) || 1;
        const phaseColors = getWorkflowStepColors(Math.max(0, currentStepIdx - 1), config.length || 1);
        const status = rec.status || 'yangi';
        let stIcon = '🟡';
        if (status.indexOf('yigi') !== -1) stIcon = '🔵';
        else if (status.indexOf('tayyor') !== -1 || status.indexOf('landi') !== -1) stIcon = '🟢';

        rowsHtml += `
        <tr class="kv-data-row" onclick="showKvDetailModal(${idx})">
            <td class="kv-col-seq">${idx + 1}</td>
            <td class="kv-col-no">${escapeHtml(String(rec.no || '—'))}</td>
            <td class="kv-col-oy">${monthClean || '—'}</td>
            <td class="kv-col-m2">${m2Val}</td>
            <td class="kv-col-st" title="${escapeHtml(status)}"><span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:50%; background:${phaseColors.bg}; border:1px solid ${phaseColors.color};"></span>${stIcon}</span></td>
        </tr>`;
    });

    container.innerHTML = `
    <div class="kv-table-wrap">
        <table class="kv-table">
            <thead>
                <tr>
                    <th>№</th>
                    <th>Buyurtma №</th>
                    <th>Oy</th>
                    <th style="text-align:right;">m²</th>
                    <th>ST</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    </div>`;

    if (totalDisplay) totalDisplay.innerText = totalM2.toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
    if (typeof renderKvWorkerStats === 'function') renderKvWorkerStats(kvFilteredRecords);
}

/**
 * Show detail modal for a kvadrat record
 */
function showKvDetailModal(idx) {
    const rec = kvFilteredRecords[idx];
    if (!rec) return;

    const isOwner = String(rec.ownerTgId) === String(telegramId);
    const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });

    let claimBtnHtml = '';
    const status = rec.status || 'yangi';
    const config = (typeof myPermissions !== 'undefined' && myPermissions.workflowConfig) || [];
    const myPoss = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
    const currentStepIdx = Number(rec.currentStep) || 1;
    const nextStep = config.find(s => s.index === currentStepIdx + 1);

    if (nextStep && (myRole === 'SuperAdmin' || myPoss.indexOf(nextStep.position) !== -1)) {
        const nextStepIdx = Number(nextStep.index || currentStepIdx + 1) - 1;
        const nextColors = getWorkflowStepColors(nextStepIdx, config.length || 1);
        claimBtnHtml = `<button class="btn-main" style="background:${nextColors.bg}; color:${nextColors.color}; margin-bottom:10px;" onclick="closeKvDetailModal();claimKvWork(${rec.rowId})">✅ ${escapeHtml(nextStep.action)}</button>`;
    }

    let historyHtml = '';
    const logs = rec.logs || [];
    logs.forEach(log => {
        const stepCfg = config.find(s => s.index === log.step);
        const stepIdx = stepCfg ? (Number(stepCfg.index || 1) - 1) : 0;
        const phaseColors = getWorkflowStepColors(stepIdx, config.length || 1);
        const name = (log.uid === rec.ownerTgId) ? rec.staffName : (globalEmployeeList && globalEmployeeList.find(e => e.tgId == log.uid)?.username || log.uid);
        historyHtml += `
        <div style="border-left:2px solid ${phaseColors.bg}; padding-left:12px; margin-bottom:12px; position:relative;">
            <div style="width:10px; height:10px; border-radius:50%; background:${phaseColors.bg}; position:absolute; left:-6px; top:4px;"></div>
            <div style="font-size:12px; font-weight:700; color:${phaseColors.color};">${escapeHtml(stepCfg ? stepCfg.status : 'Bajarildi')}</div>
            <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(name)} • ${new Date(log.d).toLocaleString('uz-UZ')}</div>
        </div>`;
    });

    document.getElementById('kvDetailModalBody').innerHTML = `
        <div class="modal-drag"></div>
        <div class="detail-header">
            <span class="detail-badge uzs" style="background:#EFF6FF;color:#1D4ED8;">📐 Ish Oqimi Tarixi</span>
            <div class="detail-comment">📌 ${escapeHtml(rec.orderName || '—')}</div>
            <div class="detail-date">📅 №${escapeHtml(String(rec.no || '—'))} | Sana: ${escapeHtml(rec.date || '—')}</div>
        </div>

        <div class="admin-actions" style="display:flex; gap:8px; margin-bottom:14px;">
            ${myPermissions.canEdit || myRole === 'SuperAdmin' ? `<button class="btn-secondary" style="flex:1; font-size:13px; padding:10px;" onclick="closeKvDetailModal();openKvModal(${rec.rowId})">✏️ Tahrirlash</button>` : ''}
            ${myPermissions.canDelete || myRole === 'SuperAdmin' ? `<button class="btn-secondary" style="flex:1; color:var(--red); font-size:13px; padding:10px;" onclick="closeKvDetailModal();deleteKv(${rec.rowId})">🗑 O'chirish</button>` : ''}
        </div>
        
        <div class="detail-card" style="margin-bottom:15px; background:#F8FAFC;">
            <div class="detail-row">
                <span class="detail-key">Mas'ul hodim</span>
                <span class="detail-val">${escapeHtml(rec.staffName || '—')}</span>
            </div>
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

        <button class="btn-secondary" style="margin-top:12px; width:100%;" onclick="closeKvDetailModal()">✕ Yopish</button>
    `;

    document.getElementById('kvDetailModal').classList.remove('hidden');
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function closeKvDetailModal() {
    document.getElementById('kvDetailModal').classList.add('hidden');
}

function applyKvFilters() {
    const month = document.getElementById('kvFilterMonth')?.value || 'all';
    const year = document.getElementById('kvFilterYear')?.value || 'all';
    const staff = document.getElementById('kvFilterStaff')?.value || 'all';

    kvFilteredRecords = kvFullRecords.filter(rec => {
        if (month !== 'all') {
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            if (cleanMonth !== month) return false;
        }
        if (year !== 'all') {
            if (!String(rec.date || '').endsWith(String(year))) return false;
        }
        if (staff !== 'all') {
            var staffMatch = (rec.staffName === staff);
            if (!staffMatch && Array.isArray(rec.logs)) {
                var logNames = rec.logs.map(function(log) {
                    if (!log || !log.uid) return '';
                    var mapped = (typeof window._kvEmpMap !== 'undefined' && window._kvEmpMap[String(log.uid)]) || '';
                    return mapped || String(log.uid);
                });
                staffMatch = logNames.some(function(name) { return name === staff; });
            }
            if (!staffMatch) return false;
        }
        return true;
    });
    renderKvList();
}

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
            document.getElementById('kvOrderNumber').value = rec.no || '';
            document.getElementById('kvOrderName').value = rec.orderName || '';
            document.getElementById('kvTotalM2Input').value = rec.totalM2 || '';
            document.getElementById('kvStaffSelect').value = rec.staffName || '';
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            const monthEl = document.getElementById('kvActionMonth');
            if (monthEl && cleanMonth) monthEl.value = cleanMonth.padStart(2, '0');
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

async function saveKv() {
    const rowId = document.getElementById('kvRowId').value;
    const orderNumber = (document.getElementById('kvOrderNumber').value || '').trim();
    const orderName = (document.getElementById('kvOrderName').value || '').trim();
    const totalM2 = parseFloat(document.getElementById('kvTotalM2Input').value) || 0;
    const staffName = document.getElementById('kvStaffSelect').value;
    const month = document.getElementById('kvActionMonth')?.value || '';
    const year = document.getElementById('kvActionYear')?.value || '';
    const monthStr = (year && month) ? `_${month}` : '';

    if (!orderNumber || !orderName || totalM2 <= 0 || !staffName) {
        showToastMsg('❌ Ma\'lumotlarni to\'liq kiriting', true);
        return;
    }

    const duplicateOrder = (kvFullRecords || []).some(rec => {
        if (!rec || !rec.no) return false;
        if (String(rec.rowId) === String(rowId)) return false;
        return String(rec.no || '').trim().toLowerCase() === String(orderNumber).trim().toLowerCase();
    });
    if (duplicateOrder) {
        showToastMsg('❌ Bu Buyurtma № oldin qoshilgan. Iltimos, boshqa raqam kiriting.', true);
        return;
    }

    let ownerTgId = telegramId;
    if (typeof window._kvEmpMap !== 'undefined') {
        const found = Object.entries(window._kvEmpMap).find(([id, name]) => name === staffName);
        if (found) ownerTgId = found[0];
    }

    kvShowProc('Saqlanmoqda...');
    try {
        const action = rowId ? 'kvadrat_edit' : 'kvadrat_add';
        const data = await apiRequest({
            action,
            rowId: rowId || undefined,
            no: orderNumber,
            orderName,
            totalM2,
            staffName,
            ownerTgId,
            month: monthStr,
            year
        });
        if (data.success) {
            kvHideProc(true, 'Saqlandi');
            closeKvModal();
            initKvadratTab();
        } else {
            kvHideProc(false, data.error || 'Saqlashda xato');
        }
    } catch (e) {
        kvHideProc(false, 'Tarmoq xatosi');
    }
}

async function deleteKv(rowId) {
    if (!confirm("O'chirishga ishonchingiz komilmi?")) return;
    kvShowProc('O\'chirilmoqda...');
    try {
        const data = await apiRequest({ action: 'kvadrat_delete', rowId });
        if (data.success) {
            kvHideProc(true, 'O\'chirildi');
            initKvadratTab();
        } else {
            kvHideProc(false, data.error || 'Xato');
        }
    } catch (e) {
        kvHideProc(false, 'Tarmoq xatosi');
    }
}

async function claimKvWork(rowId) {
    kvShowProc('Bajarilmoqda...');
    try {
        const data = await apiRequest({ action: 'kvadrat_claim', rowId });
        if (data.success) {
            kvHideProc(true, 'Bajarildi!');
            initKvadratTab();
        } else {
            kvHideProc(false, data.error || 'Xato');
        }
    } catch (e) {
        kvHideProc(false, 'Tarmoq xatosi');
    }
}