let kvFullRecords = [];
let kvFilteredRecords = [];

function normalizePos(pos) {
    if (!pos) return '';
    return String(pos).toLowerCase().trim();
}
const KV_ITEMS_PER_PAGE = 15;
let kvCurrentPage = 1;

const KV_MONTHS_UZ = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'];

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
        document.querySelectorAll('.btn-secondary[title="Yangilash"]').forEach(b => b.classList.remove('spinning'));
    }
}

function populateKvadratMeta(staffList) {
    const staffFilter = document.getElementById('kvFilterStaff');
    const kvStaffModal = document.getElementById('kvStaffSelect');
    if (staffFilter) {
        staffFilter.innerHTML = '<option value="all">Barcha hodimlar</option>';
        staffList.forEach(emp => {
            const name = (typeof emp === 'object') ? (emp.username || emp.firstName || 'Noma\'lum') : emp;
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            staffFilter.appendChild(opt);
        });
    }
    if (kvStaffModal) {
        kvStaffModal.innerHTML = '<option value="">Hodimni tanlang...</option>';
        staffList.forEach(emp => {
            const name = (typeof emp === 'object') ? (emp.username || emp.firstName || 'Noma\'lum') : emp;
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            kvStaffModal.appendChild(opt);
        });
    }
    const yearSel = document.getElementById('kvFilterYear');
    if (yearSel) {
        const currentYear = new Date().getFullYear();
        yearSel.innerHTML = '<option value="all">Yillar</option>';
        for (let y = currentYear; y >= 2024; y--) {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            yearSel.appendChild(opt);
        }
    }
    const processSelect = document.getElementById('kvFilterProcess');
    if (processSelect) {
        const workflowConfig = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
        processSelect.innerHTML = '<option value="all">Barcha jarayonlar</option>';
        workflowConfig.forEach((step, idx) => {
            const opt = document.createElement('option');
            opt.value = String(step.index || idx + 1);
            opt.textContent = escapeHtml(step.status || step.action || `Bosqich ${idx + 1}`);
            processSelect.appendChild(opt);
        });
    }
    _initKvFormYears();
}

function _initKvFormYears() {
    const curYear  = new Date().getFullYear();
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const yearEl   = document.getElementById('kvActionYear');
    if (yearEl) {
        yearEl.innerHTML = '';
        for (let y = curYear + 1; y >= curYear - 2; y--) {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            if (y === curYear) opt.selected = true;
            yearEl.appendChild(opt);
        }
    }
    const monthEl = document.getElementById('kvActionMonth');
    if (monthEl) monthEl.value = curMonth;
}

async function initKvadratTab() {
    if (typeof populateKvadratMeta === 'function') {
        populateKvadratMeta(typeof globalEmployeeList !== 'undefined' ? globalEmployeeList : []);
    }
    const listContainer = document.getElementById('kvList');
    if (!listContainer) return;

    /* Keshdan ko'rsat */
    try {
        const cached = localStorage.getItem('kvFullRecords');
        if (cached) {
            kvFullRecords = JSON.parse(cached);
            if (typeof kvDashboardRecords !== 'undefined') kvDashboardRecords = kvFullRecords;
            applyKvFilters();
        }
    } catch (e) { console.warn('Cache read error:', e); }

    if (!kvFullRecords || kvFullRecords.length === 0) {
        listContainer.innerHTML = `
            <div class="skeleton-container" style="padding:0;">
                ${Array(5).fill(`
                <div class="js-skeleton-card" style="margin-bottom:12px;">
                    <div class="js-skeleton-line" style="height:20px; width:40%; margin-bottom:10px;"></div>
                    <div class="js-skeleton-line" style="height:15px; width:70%;"></div>
                </div>`).join('')}
            </div>`;
    }

    try {
        const data = await apiRequest({ action: 'kvadrat_get_all' });
        if (data.success) {
            kvFullRecords = data.data || [];
            if (typeof kvDashboardRecords !== 'undefined') kvDashboardRecords = kvFullRecords;
            localStorage.setItem('kvFullRecords', JSON.stringify(kvFullRecords));
            applyKvFilters();
        } else {
            if (!kvFullRecords || kvFullRecords.length === 0) {
                listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Xato: ${escapeHtml(data.error || 'Yuklashda xato')}</p></div>`;
            }
        }
    } catch (e) {
        console.error('initKvadratTab error:', e);
        if (!kvFullRecords || kvFullRecords.length === 0) {
            listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Tarmoq xatosi: ${escapeHtml(e.message)}</p></div>`;
        }
    }
    updateKvFabVisibility();
}

function updateKvFabVisibility() {
    const fab = document.getElementById('nav-add');
    if (!fab) return;
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'kvadratTab') {
        const positions  = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        const isLoyihachi = myRole === 'SuperAdmin' || positions.indexOf('Loyihachi') !== -1;
        fab.style.visibility   = isLoyihachi ? 'visible' : 'hidden';
        fab.style.pointerEvents = isLoyihachi ? 'auto' : 'none';
        fab.style.opacity       = isLoyihachi ? '1' : '0';
    } else {
        fab.style.visibility   = 'visible';
        fab.style.pointerEvents = 'auto';
        fab.style.opacity       = '1';
    }
}

function renderKvList() {
    const container    = document.getElementById('kvList');
    const totalDisplay = document.getElementById('kvTotalM2');
    if (!container) return;

    if (!kvFilteredRecords || !kvFilteredRecords.length) {
        container.innerHTML = `
            <div class="empty-state" style="background:var(--surface); border:2px dashed var(--border); border-radius:24px; padding:60px 20px;">
                <div class="empty-icon" style="font-size:48px; margin-bottom:16px;">📏</div>
                <p style="font-size:16px; font-weight:700; color:var(--navy); margin:0;">Ma'lumotlar topilmadi</p>
                <p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Ushbu davr yoki filtrlar bo'yicha ma'lumot yo'q.</p>
            </div>`;
        if (totalDisplay) totalDisplay.innerText = '0';
        return;
    }

    try {
        const totalM2ForFiltered = kvFilteredRecords.reduce((sum, rec) => sum + (Number(rec.totalM2) || 0), 0);
        if (totalDisplay) totalDisplay.innerText = totalM2ForFiltered.toLocaleString('uz-UZ', { maximumFractionDigits: 1 });

        let lastDavr = null;
        const sortedKvData = [...kvFilteredRecords].sort((a, b) => {
            const davrA = a.year && a.month ? `${a.year}-${String(a.month).replace('_','').padStart(2,'0')}` : getDavrSortKey('', a.date, '');
            const davrB = b.year && b.month ? `${b.year}-${String(b.month).replace('_','').padStart(2,'0')}` : getDavrSortKey('', b.date, '');
            if (davrB !== davrA) return davrB.localeCompare(davrA);
            return (parseInt(b.no, 10) || 0) - (parseInt(a.no, 10) || 0);
        });

        const totalPages    = Math.ceil(sortedKvData.length / KV_ITEMS_PER_PAGE);
        const start         = (kvCurrentPage - 1) * KV_ITEMS_PER_PAGE;
        const paginatedData = sortedKvData.slice(start, start + KV_ITEMS_PER_PAGE);

        const wrap  = document.createElement('div');
        wrap.className = 'kv-table-wrap';
        const table = document.createElement('table');
        table.className = 'kv-table';
        table.innerHTML = `<thead><tr><th>№</th><th>Buyurtma №</th><th>Oy</th><th style="text-align:right;">m²</th><th>ST</th></tr></thead>`;
        const tbody = document.createElement('tbody');

        paginatedData.forEach((rec, loopIdx) => {
            const globalIdx = (kvCurrentPage - 1) * KV_ITEMS_PER_PAGE + loopIdx;
            const origIdx   = kvFilteredRecords.indexOf(rec);
            const currentDavr = rec.year && rec.month ? `${rec.year}-${String(rec.month).replace('_','').padStart(2,'0')}` : getDavrSortKey('', rec.date, '');
            const relDavr     = getDavrLabel(currentDavr);

            if (relDavr !== lastDavr) {
                const trDate = document.createElement('tr');
                trDate.className = 'kv-date-row';
                trDate.innerHTML = `<td colspan="5" style="border:1px solid var(--border);">${relDavr}</td>`;
                tbody.appendChild(trDate);
                lastDavr = relDavr;
            }

            const m2Val      = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { minimumFractionDigits:1, maximumFractionDigits:1 });
            const monthClean = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            const config     = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
            const totalSteps = config.length >= 2 ? config.length : 3;
            const currentStepIdx = Number(rec.currentStep) || 1;

            let phaseColor = 'var(--border)';
            if (typeof getWorkflowStepColors === 'function') {
                phaseColor = getWorkflowStepColors(Math.max(0, currentStepIdx - 1), totalSteps).bg || phaseColor;
            }

            const status = rec.status || 'yangi';
            let stIcon = '🟡';
            if (status.indexOf('yigi') !== -1) stIcon = '🔵';
            else if (status.indexOf('tayyor') !== -1 || status.indexOf('landi') !== -1) stIcon = '🟢';

            const trData = document.createElement('tr');
            trData.className = 'kv-data-row';
            trData.onclick   = () => showKvDetailModal(origIdx);
            trData.innerHTML = `
                <td class="kv-col-seq">${globalIdx + 1}</td>
                <td class="kv-col-no"><b>${escapeHtml(String(rec.no || '—'))}</b></td>
                <td class="kv-col-oy">${monthClean || '—'}</td>
                <td class="kv-col-m2" style="text-align:right; font-weight:700;">${m2Val}</td>
                <td class="kv-col-st">
                    <span style="display:inline-flex; align-items:center; gap:4px;">
                        <span style="width:8px; height:8px; border-radius:50%; background:${phaseColor};"></span>
                        ${stIcon}
                    </span>
                </td>`;
            tbody.appendChild(trData);
        });

        table.appendChild(tbody);
        wrap.appendChild(table);
        container.innerHTML = '';
        container.appendChild(wrap);

        if (totalPages > 1) {
            const pagDiv = document.createElement('div');
            pagDiv.className = 'pagination';
            pagDiv.style.cssText = 'display:flex; justify-content:center; gap:6px; padding:20px 0;';
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.className = `page-btn ${i === kvCurrentPage ? 'active' : ''}`;
                btn.onclick   = () => goToKvPage(i);
                btn.innerText = i;
                pagDiv.appendChild(btn);
            }
            container.appendChild(pagDiv);
        }

        if (typeof renderKvWorkerStats === 'function') renderKvWorkerStats(kvFilteredRecords);

    } catch (err) {
        console.error('renderKvList crash:', err);
        container.innerHTML = `<div class="empty-state" style="color:var(--red);">❌ Ro'yxatni chizishda xato yuz berdi.</div>`;
    }
}

function goToKvPage(page) {
    kvCurrentPage = page;
    renderKvList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------------------------------------------------------
   showKvDetailModal — CSS klasslari + CSS o'zgaruvchilar
   Dinamik ranglar: element.style.setProperty('--step-clr', color)
   --------------------------------------------------------------- */
function showKvDetailModal(idx) {
    try {
        const rec = kvFilteredRecords[idx];
        if (!rec) return;

        const m2Val        = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
        const status       = rec.status || 'yangi';
        const config       = (typeof myPermissions !== 'undefined' && myPermissions && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
        const myPoss       = (typeof myPermissions !== 'undefined' && myPermissions && Array.isArray(myPermissions.positions)) ? myPermissions.positions : [];
        const currentStepIdx = Number(rec.currentStep) || 1;
        const isStrict     = (typeof myPermissions !== 'undefined' && myPermissions && myPermissions.isWorkflowStrict);
        const logs         = rec.logs || [];
        const doneSteps    = logs.map(l => Number(l.step));
        const normalizedMyPoss = myPoss.map(p => normalizePos(p));
        const totalSteps   = config.length >= 2 ? config.length : 3;

        /* ---- Claim tugmalari ---- */
        let claimBtnsHtml = '';

        if (isStrict) {
            const nextStep = config.find(s => s.index === currentStepIdx + 1);
            if (nextStep) {
                const nextStepPos = normalizePos(nextStep.position);
                if (normalizedMyPoss.indexOf(nextStepPos) !== -1 ||
                    (typeof myRole !== 'undefined' && myRole === 'SuperAdmin' && normalizedMyPoss.length === 0)) {
                    /* Barcha claim tugmalari to'q yashil bo'lsin */
                    const btnColor = '#065f46'; 

                    /* CSS o'zgaruvchisi orqali rang */
                    claimBtnsHtml = `
                        <button class="wf-claim-btn"
                            style="--wf-bg:${btnColor}; --wf-shadow:${btnColor}66;"
                            onclick="closeKvDetailModal();claimKvWork(${rec.rowId}, ${nextStep.index})">
                            ✅ ${escapeHtml(nextStep.action)}
                        </button>`;
                }
            }
        } else {
            const availableSteps = config.filter(s => {
                if (s.index <= 1) return false;
                if (doneSteps.indexOf(s.index) !== -1) return false;
                return normalizedMyPoss.indexOf(normalizePos(s.position)) !== -1;
            });
            availableSteps.forEach(s => {
                /* Barcha claim tugmalari to'q yashil bo'lsin */
                const btnColor = '#065f46';

                claimBtnsHtml += `
                    <button class="wf-claim-btn"
                        style="--wf-bg:${btnColor}; --wf-shadow:${btnColor}66;"
                        onclick="closeKvDetailModal();claimKvWork(${rec.rowId}, ${s.index})">
                        ✅ ${escapeHtml(s.action)}
                    </button>`;
            });
        }

        /* ---- Tarix ---- */
        let historyHtml = '';
        logs.forEach((log, lIdx) => {
            const stepCfg  = config.find(s => s.index === log.step);
            const stepColor = typeof getWorkflowStepColors === 'function'
                ? (getWorkflowStepColors((log.step || 1) - 1, totalSteps).bg || 'var(--green)')
                : 'var(--green)';
            const name = log.u ||
                (String(log.uid) === String(rec.ownerTgId) ? rec.staffName :
                (typeof globalEmployeeList !== 'undefined' && globalEmployeeList &&
                    globalEmployeeList.find(e => String(e.tgId || e.id) === String(log.uid))?.username || log.uid));
            const isLast = lIdx === logs.length - 1;

            historyHtml += `
                <div class="kvdm-tl-item ${isLast ? '' : 'kvdm-tl-border'}">
                    <div class="kvdm-tl-dot" style="--step-clr:${stepColor};"></div>
                    <div class="kvdm-tl-status">${escapeHtml(stepCfg ? stepCfg.status : 'Bajarildi')}</div>
                    <div class="kvdm-tl-meta">
                        <span class="kvdm-tl-who">${escapeHtml(name)}</span>
                        <span class="kvdm-tl-sep">•</span>
                        ${new Date(log.d).toLocaleString('uz-UZ', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                </div>`;
        });

        /* ---- Tahrirlash / O'chirish tugmalari ---- */
        const isAdmin       = (typeof myRole !== 'undefined') && (myRole === 'SuperAdmin' || myRole === 'Admin' || myRole === 'Direktor');
        const hasPerms      = (typeof myPermissions !== 'undefined' && myPermissions);
        const canEdit       = (isAdmin && hasPerms && myPermissions.canEdit)  || String(rec.ownerTgId) === String(typeof telegramId !== 'undefined' ? telegramId : '0') || myRole === 'SuperAdmin';
        const canDelete     = (isAdmin && hasPerms && myPermissions.canDelete) || String(rec.ownerTgId) === String(typeof telegramId !== 'undefined' ? telegramId : '0') || myRole === 'SuperAdmin';

        const buttonsRow = (canEdit || canDelete) ? `
            <div class="kvdm-btn-row">
                ${canEdit   ? `<button class="kvdm-edit-btn" onclick="closeKvDetailModal();openKvModal(${rec.rowId})">✏️ Tahrirlash</button>` : ''}
                ${canDelete ? `<button class="kvdm-del-btn"  onclick="closeKvDetailModal();deleteKv(${rec.rowId})">🗑 O'chirish</button>`   : ''}
            </div>` : '';

        /* ---- Modal kontent ---- */
        document.getElementById('kvDetailModalBody').innerHTML = `
            <div class="modal-drag"></div>
            ${buttonsRow}

            <div class="detail-header">
                <span class="detail-badge" style="background:var(--comp-chip-usd-bg); color:var(--comp-chip-usd-text);">
                    📐 Buyurtma Tafsiloti
                </span>
                <h3 style="margin:10px 0 5px; color:var(--navy); font-weight:800; font-size: 19px; letter-spacing: -0.5px;">
                    ${escapeHtml(String(rec.no || '—'))}${rec.month ? '_' + String(rec.month).replace(/^_+/, '').replace(/^'/, '') : ''} | Sana: ${escapeHtml(rec.date || '—')}
                </h3>
                <div style="font-size:14px; color:var(--text-muted); font-weight:700; letter-spacing: 0.2px;">
                    📌 ${escapeHtml(rec.orderName || '—')}
                </div>
            </div>

            <div class="detail-card" style="margin-top:15px;">
                <div class="detail-row">
                    <span class="detail-key">Mas'ul xodim</span>
                    <span class="detail-val">${escapeHtml(rec.staffName || '—')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-key">Hozirgi Holat</span>
                    <span class="detail-val" style="font-weight:800; text-transform:uppercase; color:var(--green-dark);">
                        ${escapeHtml(status)}
                    </span>
                </div>
                <div class="detail-row" style="border-bottom:none;">
                    <span class="detail-key">O'lcham</span>
                    <span class="detail-val" style="font-size:18px; font-weight:800; color:var(--navy);">
                        ${m2Val} m²
                    </span>
                </div>
            </div>

            <div class="kvdm-info-box">
                <div class="kvdm-info-title">
                    <span class="kvdm-info-title__line"></span>
                    Jarayon Tarixi
                </div>
                ${historyHtml || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">Hali harakatlar yo\'q</p>'}
            </div>

            <div style="margin-top:24px;">
                ${claimBtnsHtml}
                <button class="kvdm-close-btn" onclick="closeKvDetailModal()">✕ Yopish</button>
            </div>
        `;

        document.getElementById('kvDetailModal').classList.remove('hidden');
    } catch (err) {
        alert('showKvDetailModal error: ' + err.message + '\n' + err.stack);
        console.error(err);
    }
}

function closeKvDetailModal() {
    document.getElementById('kvDetailModal').classList.add('hidden');
}

function applyKvFilters() {
    const month   = document.getElementById('kvFilterMonth')?.value   || 'all';
    const year    = document.getElementById('kvFilterYear')?.value    || 'all';
    const staff   = document.getElementById('kvFilterStaff')?.value   || 'all';
    const process = document.getElementById('kvFilterProcess')?.value || 'all';

    kvFilteredRecords = kvFullRecords.filter(rec => {
        if (!rec || (!rec.rowId && !rec.no)) return false;
        if (month !== 'all') {
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            if (cleanMonth !== month) return false;
        }
        if (year !== 'all') {
            if (!String(rec.date || '').endsWith(String(year))) return false;
        }
        if (staff !== 'all') {
            let staffMatch = (rec.staffName === staff);
            if (!staffMatch && Array.isArray(rec.logs)) {
                const logNames = rec.logs.map(function (log) {
                    if (!log || !log.uid) return '';
                    if (String(log.uid) === String(rec.ownerTgId)) return rec.staffName;
                    let mapped = (typeof window._kvEmpMap !== 'undefined' && window._kvEmpMap[String(log.uid)]) || '';
                    if (!mapped && typeof globalEmployeeList !== 'undefined' && Array.isArray(globalEmployeeList)) {
                        const emp = globalEmployeeList.find(e => String(e.tgId) === String(log.uid));
                        if (emp) mapped = emp.username || emp.firstName || '';
                    }
                    return mapped || String(log.uid);
                });
                staffMatch = logNames.some(name => name === staff);
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
    const form  = document.getElementById('kvForm');
    form.reset();
    document.getElementById('kvRowId').value = rowId || '';
    _initKvFormYears();

    if (rowId) {
        title.innerText = '✏️ Tahrirlash';
        const rec = kvFullRecords.find(r => String(r.rowId) === String(rowId));
        if (rec) {
            document.getElementById('kvOrderNumber').value  = rec.no       || '';
            document.getElementById('kvOrderName').value    = rec.orderName || '';
            document.getElementById('kvTotalM2Input').value = rec.totalM2  || '';
            document.getElementById('kvStaffSelect').value  = rec.staffName || '';
            const cleanMonth = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            const mEl = document.getElementById('kvActionMonth');
            if (mEl && cleanMonth) mEl.value = cleanMonth.padStart(2, '0');
            const yEl = document.getElementById('kvActionYear');
            if (yEl) yEl.value = rec.year || (rec.date ? rec.date.split('/').pop() : new Date().getFullYear());
        }
    } else {
        const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        if (myRole !== 'SuperAdmin' && positions.indexOf('Loyihachi') === -1) {
            showToastMsg('❌ Faqat "Loyihachi" buyurtma qo\'sha oladi', true); return;
        }
        title.innerText = '📐 Yangi o\'lchov kiritish';
        const sel = document.getElementById('kvStaffSelect');
        if (sel && myUsername) sel.value = myUsername;
    }
    modal.classList.remove('hidden');
}

function closeKvModal() {
    document.getElementById('kvadratModal').classList.add('hidden');
}

async function saveKv() {
    const rowId       = document.getElementById('kvRowId').value;
    const orderNumber = (document.getElementById('kvOrderNumber').value || '').trim();
    const orderName   = (document.getElementById('kvOrderName').value   || '').trim();
    const totalM2     = parseFloat(document.getElementById('kvTotalM2Input').value) || 0;
    const staffName   = document.getElementById('kvStaffSelect').value;
    const month       = document.getElementById('kvActionMonth')?.value || '';
    const year        = document.getElementById('kvActionYear')?.value  || new Date().getFullYear();

    if (!orderNumber || !orderName || totalM2 <= 0 || !staffName) {
        showToastMsg('❌ Ma\'lumotlarni to\'liq kiriting', true); return;
    }

    // Dublikatni tekshirish (Buyurtma raqami bo'yicha)
    const isDuplicate = kvFullRecords.some(r => {
        if (rowId && String(r.rowId) === String(rowId)) return false;
        return String(r.no || '').trim().toLowerCase() === orderNumber.toLowerCase();
    });

    if (isDuplicate) {
        showToastMsg('❌ Bu Buyurtma № oldin kiritilgan!', true);
        return;
    }

    if (rowId) {
        const rec        = kvFullRecords.find(r => String(r.rowId) === String(rowId));
        const isAdmin    = myRole === 'Admin' || myRole === 'SuperAdmin' || myRole === 'Direktor';
        const canEditAll = isAdmin && myPermissions.canEdit;
        const isOwner    = rec && String(rec.ownerTgId) === String(telegramId);
        if (!canEditAll && !isOwner && myRole !== 'SuperAdmin') {
            showToastMsg('❌ Siz faqat o\'zingiz kiritgan ma\'lumotni tahrirlay olasiz', true); return;
        }
        const reason = await askActionReason("Tahrirlash sababini kiriting");
        if (!reason) return;
        window._kvEditReason = reason;
    }

    const saveBtn = document.querySelector('#kvForm .btn-main[type="submit"]');
    setButtonLoading(saveBtn, true, 'Saqlanmoqda...');

    try {
        const action = rowId ? 'kvadrat_edit' : 'kvadrat_add';
        let ownerTgId = telegramId;
        if (typeof window._kvEmpMap !== 'undefined') {
            const found = Object.entries(window._kvEmpMap).find(([id, name]) => name === staffName);
            if (found) ownerTgId = found[0];
        }
        const data = await apiRequest({
            action, rowId: rowId || undefined,
            no: orderNumber, orderName, totalM2,
            staffName, ownerTgId,
            month: `_${month}`, year,
            reason: window._kvEditReason || ''
        });
        window._kvEditReason = '';
        if (data.success) {
            showToastMsg('✅ Saqlandi');
            closeKvModal();
            initKvadratTab();
        } else {
            showToastMsg('❌ ' + (data.error || 'Xato'), true);
        }
    } catch (e) {
        showToastMsg('❌ Tarmoq xatosi', true);
    } finally {
        setButtonLoading(saveBtn, false);
    }
}

async function deleteKv(rowId) {
    const rec        = kvFullRecords.find(r => String(r.rowId) === String(rowId));
    if (!rec) return;
    const isAdmin    = myRole === 'Admin' || myRole === 'SuperAdmin' || myRole === 'Direktor';
    const canDeleteAll = isAdmin && myPermissions.canDelete;
    const isOwner    = String(rec.ownerTgId) === String(telegramId);
    if (!canDeleteAll && !isOwner && myRole !== 'SuperAdmin') {
        showToastMsg('❌ Siz faqat o\'zingiz kiritgan ma\'lumotni o\'chira olasiz', true); return;
    }
    const isOk = await askConfirmDialog("Buyurtmani o'chirish", "Ushbu buyurtmani butunlay o'chirishga ishonchingiz komilmi?");
    if (!isOk) return;
    const reason = await askActionReason("O'chirish sababini kiriting");
    if (!reason) return;

    kvShowProc('O\'chirilmoqda...');
    try {
        const data = await apiRequest({ action: 'kvadrat_delete', rowId, reason });
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

async function claimKvWork(rowId, targetStepIndex = null) {
    kvShowProc('Bajarilmoqda...');
    try {
        const data = await apiRequest({ action: 'kvadrat_claim', rowId, targetStepIndex });
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
