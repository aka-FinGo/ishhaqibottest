let kvFullRecords = [];
let kvFilteredRecords = [];
const KV_ITEMS_PER_PAGE = 15;
let kvCurrentPage = 1;

const KV_MONTHS_UZ = ['', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

function kvMonthLabel(monthStr) {
    const clean = String(monthStr || '').replace(/^_+/, '').replace(/^'/, '');
    const num = parseInt(clean, 10);
    return (num >= 1 && num <= 12) ? KV_MONTHS_UZ[num] : (clean || '—');
}

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
        const refreshButtons = document.querySelectorAll('.btn-secondary[title="Yangilash"]');
        refreshButtons.forEach(button => {
            button.classList.remove('spinning');
        });
    }
}

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
    const processSelect = document.getElementById('kvFilterProcess');
    if (processSelect) {
        const workflowConfig = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
        processSelect.innerHTML = '<option value="all">Barcha jarayonlar</option>';
        workflowConfig.forEach((step, idx) => {
            const stepIndex = String(step.index || idx + 1);
            const label = escapeHtml(step.status || step.action || `Bosqich ${idx + 1}`);
            const opt = document.createElement('option');
            opt.value = stepIndex;
            opt.textContent = label;
            processSelect.appendChild(opt);
        });
        processSelect.value = 'all';
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

async function initKvadratTab() {
    const listContainer = document.getElementById('kvList');
    if (!listContainer) return;
    listContainer.innerHTML = `<div class="kv-table-wrap"><table class="kv-table"><thead><tr><th>№</th><th>Buyurtma №</th><th>Oy</th><th>m²</th><th>ST</th></tr></thead><tbody>${Array(5).fill('<tr><td colspan="5"><div class="skeleton" style="height:25px;margin:5px 0;"></div></tr>').join('')}</tbody></table></div>`;
    try {
        const data = await apiRequest({
            action: 'kvadrat_get_all'
        });
        if (data.success) {
            kvFullRecords = data.data || [];
            if (typeof kvDashboardRecords !== 'undefined') {
                kvDashboardRecords = kvFullRecords;
            }
            applyKvFilters();
        } else {
            listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ ${escapeHtml(data.error || 'Yuklashda xato')}</p></div>`;
        }
    } catch (e) {
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

function renderKvList() {
    const container = document.getElementById('kvList');
    const totalDisplay = document.getElementById('kvTotalM2');
    if (!container) return;
    if (!kvFilteredRecords.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📏</div><p>Ma'lumot topilmadi</p></div>`;
        if (totalDisplay) totalDisplay.innerText = '0';
        return;
    }

    let lastDavr = null;
    const sortedKvData = [...kvFilteredRecords].sort((a, b) => {
        // Yil va Oy bo'yicha saralash (Davr)
        const davrA = a.year && a.month ? `${a.year}-${String(a.month).replace('_', '').padStart(2, '0')}` : getDavrSortKey('', a.date, '');
        const davrB = b.year && b.month ? `${b.year}-${String(b.month).replace('_', '').padStart(2, '0')}` : getDavrSortKey('', b.date, '');
        
        if (davrB !== davrA) return davrB.localeCompare(davrA);
        
        // Agar davr bir xil bo'lsa, № bo'yicha (kattasi tepada)
        const noA = parseInt(a.no, 10) || 0;
        const noB = parseInt(b.no, 10) || 0;
        return noB - noA;
    });

    // Pagination logic
    const totalPages = Math.ceil(sortedKvData.length / KV_ITEMS_PER_PAGE);
    const start = (kvCurrentPage - 1) * KV_ITEMS_PER_PAGE;
    const end = start + KV_ITEMS_PER_PAGE;
    const paginatedData = sortedKvData.slice(start, end);

    const fragment = document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'kv-table-wrap';
    const table = document.createElement('table');
    table.className = 'kv-table';
    table.innerHTML = `<thead><tr><th>№</th><th>Buyurtma №</th><th>Oy</th><th style="text-align:right;">m²</th><th>ST</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    const totalM2ForFiltered = kvFilteredRecords.reduce((sum, rec) => sum + (Number(rec.totalM2) || 0), 0);

    paginatedData.forEach((rec, loopIdx) => {
        const globalIdx = (kvCurrentPage - 1) * KV_ITEMS_PER_PAGE + loopIdx;
        const origIdx = kvFilteredRecords.indexOf(rec);

        const currentDavr = rec.year && rec.month ? `${rec.year}-${String(rec.month).replace('_', '').padStart(2, '0')}` : getDavrSortKey('', rec.date, '');
        let relDavr = getDavrLabel(currentDavr);

        if (relDavr !== lastDavr) {
            const trDate = document.createElement('tr');
            trDate.className = 'kv-date-row';
            trDate.innerHTML = `<td colspan="5" style="font-size:13px; font-weight:700; color:#64748b; padding:8px 12px; background:#f8fafc;">${relDavr}</td>`;
            tbody.appendChild(trDate);
            lastDavr = relDavr;
        }
        const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
        const monthClean = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
        const config = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
        const totalSteps = config.length >= 2 ? config.length : 3;
        const currentStepIdx = Number(rec.currentStep) || 1;
        const phaseColors = getWorkflowStepColors(Math.max(0, currentStepIdx - 1), totalSteps);
        const status = rec.status || 'yangi';
        let stIcon = '🟡';
        if (status.indexOf('yigi') !== -1) stIcon = '🔵';
        else if (status.indexOf('tayyor') !== -1 || status.indexOf('landi') !== -1) stIcon = '🟢';

        const trData = document.createElement('tr');
        trData.className = 'kv-data-row';
        trData.addEventListener('click', () => showKvDetailModal(origIdx));
        trData.innerHTML = `<td class="kv-col-seq">${globalIdx + 1}</td><td class="kv-col-no">${escapeHtml(String(rec.no || '—'))}</td><td class="kv-col-oy">${monthClean || '—'}</td><td class="kv-col-m2">${m2Val}</td><td class="kv-col-st" title="${escapeHtml(status)}"><span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${phaseColors.bg};border:1px solid ${phaseColors.color};"></span>${stIcon}</span></td>`;
        tbody.appendChild(trData);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    fragment.appendChild(wrap);

    if (totalPages > 1) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';
        paginationDiv.style.cssText = 'display:flex; justify-content:center; gap:8px; padding:20px 0; flex-wrap:wrap;';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === kvCurrentPage ? 'active' : ''}`;
            btn.onclick = () => goToKvPage(i);
            btn.innerText = i;
            paginationDiv.appendChild(btn);
        }
        fragment.appendChild(paginationDiv);
    }

    container.innerHTML = '';
    container.appendChild(fragment);

    if (totalDisplay) totalDisplay.innerText = totalM2ForFiltered.toLocaleString('uz-UZ', {
        maximumFractionDigits: 2
    });
    if (typeof renderKvWorkerStats === 'function') renderKvWorkerStats(kvFilteredRecords);
}

function goToKvPage(page) {
    kvCurrentPage = page;
    renderKvList();
    document.getElementById('kvList').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function showKvDetailModal(idx) {
    const rec = kvFilteredRecords[idx];
    if (!rec) return;
    const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', {
        maximumFractionDigits: 2
    });
    const logs = rec.logs || [];
    const config = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
    const myPoss = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.positions)) ? myPermissions.positions : [];
    let claimBtnHtml = '';
    
    const isStrict = !!myPermissions.isWorkflowStrict;
    
    // Independent Step Buttons: Show buttons based on strict mode
    config.forEach(step => {
        // Skip Step 1 (Designer) as it's the start
        if (step.index <= 1) return;
        
        // Check if this specific step is already completed in logs
        const isDone = logs.some(l => l.step === step.index);
        if (isDone) return;
        
        // Permission Check
        const hasPosition = myPoss.indexOf(step.position) !== -1;
        const canClaim = myRole === 'SuperAdmin' || (myIsSardor && hasPosition);
        
        if (canClaim) {
            // STRICT MODE: Only show if this is exactly the next step
            if (isStrict && step.index !== currentStepIdx + 1) return;
            
            const totalSteps = config.length >= 2 ? config.length : 3;
            const stepColors = getWorkflowStepColors(step.index - 1, totalSteps);
            claimBtnHtml += `<button class="btn-main" style="background:${stepColors.bg};color:${stepColors.color};margin-bottom:10px;" onclick="closeKvDetailModal();claimKvWork(${rec.rowId}, ${step.index})">✅ ${escapeHtml(step.action)}</button>`;
        }
    });
    let historyHtml = '';
    const logs = rec.logs || [];
    logs.forEach(log => {
        const totalSteps = config.length >= 2 ? config.length : 3;
        const stepCfg = config.find(s => s.index === log.step);
        const stepIdx = stepCfg ? (Number(stepCfg.index || 1) - 1) : 0;
        const phaseColors = getWorkflowStepColors(stepIdx, totalSteps);
        
        // Robust Name Resolution
        let name = log.uid;
        if (String(log.uid) === String(rec.ownerTgId)) {
            name = rec.staffName;
        } else if (String(log.uid) === String(telegramId)) {
            name = myUsername;
        } else if (globalEmployeeList && Array.isArray(globalEmployeeList)) {
            const emp = globalEmployeeList.find(e => String(e.tgId) === String(log.uid));
            if (emp) name = emp.username || emp.tgUsername || log.uid;
        }
        
        let logDisplay = escapeHtml(name);
        if (log.group) logDisplay += ` (${escapeHtml(log.group)})`;

        historyHtml += `<div style="border-left:2px solid ${phaseColors.bg}; padding-left:20px; margin-bottom:20px; position:relative;">
            <div style="width:12px; height:12px; border-radius:50%; background:white; border:3px solid ${phaseColors.bg}; position:absolute; left:-7px; top:2px; box-shadow:0 0 0 2px white;"></div>
            <div style="font-size:13px; font-weight:700; color:#1E293B;">${escapeHtml(stepCfg ? stepCfg.status : 'Bajarildi')}</div>
            <div style="font-size:11px; color:#64748B; margin-top:2px; display:flex; align-items:center; gap:6px;">
                <span>👤 ${logDisplay}</span>
                <span style="color:#CBD5E1;">•</span>
                <span>🕒 ${new Date(log.d).toLocaleString('uz-UZ', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
            </div>
        </div>`;
    });

    const editBtn = myPermissions.canEdit || myRole === 'SuperAdmin' ? `<button style="width:36px; height:36px; border-radius:10px; background:#FEF3C7; color:#92400E; border:none; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" title="Tahrirlash" onclick="closeKvDetailModal();openKvModal(${rec.rowId})">✏️</button>` : '';
    const deleteBtn = myPermissions.canDelete || myRole === 'SuperAdmin' ? `<button style="width:36px; height:36px; border-radius:10px; background:#FEE2E2; color:#991B1B; border:none; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" title="O'chirish" onclick="closeKvDetailModal();deleteKv(${rec.rowId})">🗑</button>` : '';
    
    // Order number format: 230_04
    const orderNoDisplay = `${escapeHtml(String(rec.no || '—'))}${escapeHtml(String(rec.month || '').replace(/^_+/, '_'))}`;

    document.getElementById('kvDetailModalBody').innerHTML = `
        <div class="modal-drag"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div class="detail-badge" style="background:#E0F2FE; color:#0369A1; font-weight:700; font-size:10px; padding:4px 10px; border-radius:20px; letter-spacing:0.5px;">📐 ISH OQIMI TARIXI</div>
            <div style="display:flex; gap:8px;">
                ${editBtn}
                ${deleteBtn}
            </div>
        </div>

        <div style="margin-bottom:20px;">
            <h2 style="margin:0; font-size:22px; color:#1E293B; font-weight:800; display:flex; align-items:center; gap:8px;">
                📌 ${escapeHtml(rec.orderName || '—')}
            </h2>
            <div style="display:flex; align-items:center; gap:12px; margin-top:6px;">
                <span style="background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:6px; font-weight:700; font-size:13px; font-family:monospace;">
                    № ${orderNoDisplay}
                </span>
                <span style="color:#94A3B8; font-size:12px; display:flex; align-items:center; gap:4px;">
                    📅 ${escapeHtml(rec.date || '—')}
                </span>
            </div>
        </div>

        <div class="detail-card" style="margin-bottom:20px; background:white; border:1px solid #E2E8F0; box-shadow:0 1px 2px rgba(0,0,0,0.05); padding:12px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:10px; color:#64748B; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Mas'ul hodim</div>
                    <div style="font-size:15px; color:#1E293B; font-weight:700; margin-top:2px;">${escapeHtml(rec.staffName || '—')}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:10px; color:#64748B; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Hozirgi Status</div>
                    <div style="font-size:12px; color:#0369A1; font-weight:800; margin-top:2px; background:#F0F9FF; padding:3px 10px; border-radius:6px; display:inline-block; border:1px solid #BAE6FD;">${escapeHtml(status.toUpperCase())}</div>
                </div>
            </div>
        </div>

        <div style="margin-bottom:20px; background:#F8FAFC; border-radius:16px; padding:15px; border:1px solid #F1F5F9;">
            <div style="font-size:11px; font-weight:800; color:#64748B; margin-bottom:15px; display:flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:0.5px;">
                <span style="width:24px; height:24px; background:white; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:12px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">📉</span> Jarayon Tarixi
            </div>
            <div style="padding-left:8px;">
                ${historyHtml || '<p style="font-size:12px; color:#94A3B8; text-align:center; padding:20px 0;">Hozircha tarix bo\'sh</p>'}
            </div>
        </div>

        <div style="background:linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border-radius:18px; padding:20px; color:white; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 10px 15px -3px rgba(15, 23, 42, 0.2);">
            <div>
                <div style="font-size:12px; opacity:0.7; font-weight:600; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Jami Kvadratura</div>
                <div style="font-size:32px; font-weight:800; letter-spacing:-1px;">${m2Val}<span style="font-size:18px; font-weight:600; margin-left:4px; opacity:0.8;">m²</span></div>
            </div>
            <div style="width:52px; height:52px; background:rgba(255,255,255,0.1); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:26px; backdrop-filter:blur(4px);">
                📐
            </div>
        </div>

        ${claimBtnHtml}
        <button class="btn-secondary" style="width:100%; height:48px; border-radius:14px; font-weight:700; font-size:14px; margin-top:8px; border:1px solid #E2E8F0;" onclick="closeKvDetailModal()">✕ Yopish</button>
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
    const process = document.getElementById('kvFilterProcess')?.value || 'all';
    kvFilteredRecords = kvFullRecords.filter(rec => {
        // Filtrlash: faqat rowId yoki no mavjud bo'lgan haqiqiy yozuvlarni qoldiramiz
        if (!rec || (!rec.rowId && !rec.no)) return false;

        if (month !== 'all') {
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            if (cleanMonth !== month) return false;
        }
        if (year !== 'all') {
            const recYear = rec.year || (rec.date ? rec.date.split('/').pop() : '');
            if (String(recYear) !== String(year)) return false;
        }
        if (staff !== 'all') {
            var staffMatch = (rec.staffName === staff);
            if (!staffMatch && Array.isArray(rec.logs)) {
                var logNames = rec.logs.map(function(log) {
                    if (!log || !log.uid) return '';
                    if (String(log.uid) === String(rec.ownerTgId)) return rec.staffName;
                    var mapped = (typeof window._kvEmpMap !== 'undefined' && window._kvEmpMap[String(log.uid)]) || '';
                    if (!mapped && typeof globalEmployeeList !== 'undefined' && Array.isArray(globalEmployeeList)) {
                        const emp = globalEmployeeList.find(e => String(e.tgId) === String(log.uid));
                        if (emp) mapped = emp.username;
                    }
                    return mapped || String(log.uid);
                });
                staffMatch = logNames.some(function(name) {
                    return name === staff;
                });
            }
            if (!staffMatch) return false;
        }
        if (process !== 'all') {
            if (!rec.currentStep || String(rec.currentStep) !== String(process)) return false;
        }
        return true;
    });
    kvCurrentPage = 1;
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
            if (yearEl) {
                if (rec.year) {
                    yearEl.value = rec.year;
                } else if (rec.date) {
                    const parts = String(rec.date).split('/');
                    if (parts.length === 3) yearEl.value = parts[2];
                }
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
    const year = document.getElementById('kvActionYear')?.value || new Date().getFullYear();
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
    const saveBtn = document.querySelector('#kvForm .btn-main[type="submit"]');
    setButtonLoading(saveBtn, true, 'Saqlanmoqda...');
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
            year: year
        });
        if (data.success) {
            showToastMsg('✅ Saqlandi');
            closeKvModal();
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || 'Saqlashda xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    } finally {
        setButtonLoading(saveBtn, false);
    }
}

async function deleteKv(rowId) {
    if (!confirm("O'chirishga ishonchingiz komilmi?")) return;
    kvShowProc('O\'chirilmoqda...');
    try {
        const data = await apiRequest({
            action: 'kvadrat_delete',
            rowId
        });
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

function updateKvFabVisibility() {
    const fab = document.getElementById('nav-add');
    if (!fab) return;
    
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'kvadratTab') {
        const myPoss = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.positions)) ? myPermissions.positions : [];
        const isLoyihachi = myRole === 'SuperAdmin' || myPoss.indexOf('Loyihachi') !== -1;
        
        if (!isLoyihachi) {
            fab.style.display = 'none';
        } else {
            fab.style.display = 'flex';
        }
    } else {
        fab.style.display = 'flex';
    }
}

async function claimKvWork(rowId) {
    kvShowProc('Bajarilmoqda...');
    try {
        const data = await apiRequest({
            action: 'kvadrat_claim',
            rowId
        });
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