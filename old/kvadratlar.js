let kvFullRecords = [];
let kvFilteredRecords = [];

function normalizePos(pos) {
    if (!pos) return '';
    return String(pos).toLowerCase().trim();
}
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
    
    // Eski qiymatlarni saqlab qolish
    const oldStaffVal = staffFilter ? staffFilter.value : 'all';
    const oldModalStaffVal = kvStaffModal ? kvStaffModal.value : '';
    const oldYearVal = document.getElementById('kvFilterYear') ? document.getElementById('kvFilterYear').value : 'all';
    const oldProcessVal = document.getElementById('kvFilterProcess') ? document.getElementById('kvFilterProcess').value : 'all';

    if (staffFilter) {
        staffFilter.innerHTML = '<option value="all">Barcha xodimlar</option>';
        staffList.forEach(emp => {
            const name = (typeof emp === 'object') ? (emp.username || emp.firstName || 'Noma\'lum') : emp;
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            staffFilter.appendChild(opt);
        });
        if (oldStaffVal !== 'all' && staffFilter.querySelector(`option[value="${oldStaffVal}"]`)) {
            staffFilter.value = oldStaffVal;
        }
    }
    if (kvStaffModal) {
        kvStaffModal.innerHTML = '<option value="">Xodimni tanlang...</option>';
        staffList.forEach(emp => {
            const name = (typeof emp === 'object') ? (emp.username || emp.firstName || 'Noma\'lum') : emp;
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            kvStaffModal.appendChild(opt);
        });
        if (oldModalStaffVal && kvStaffModal.querySelector(`option[value="${oldModalStaffVal}"]`)) {
            kvStaffModal.value = oldModalStaffVal;
        }
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
        if (oldYearVal !== 'all' && yearSel.querySelector(`option[value="${oldYearVal}"]`)) {
            yearSel.value = oldYearVal;
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
        if (oldProcessVal !== 'all' && processSelect.querySelector(`option[value="${oldProcessVal}"]`)) {
            processSelect.value = oldProcessVal;
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

async function initKvadratTab() {
    const listContainer = document.getElementById('kvList');
    if (!listContainer) return;

    // Har safar tab ochilganda filtr dropdownlarini yangilaymiz
    if (typeof populateKvadratMeta === 'function') {
        populateKvadratMeta(
            (typeof globalEmployeeList !== 'undefined' && Array.isArray(globalEmployeeList))
                ? globalEmployeeList : []
        );
    }

    // 1. Try to load from cache first (Stale)
    try {
        const cached = localStorage.getItem('kvFullRecords');
        if (cached) {
            kvFullRecords = JSON.parse(cached);
            if (typeof kvDashboardRecords !== 'undefined') kvDashboardRecords = kvFullRecords;
            applyKvFilters();
            console.log('📦 Kvadratlar loaded from cache');
        }
    } catch (e) {
        console.warn('Cache read error:', e);
    }

    // 2. Show skeletons only if cache is empty
    if (!kvFullRecords || kvFullRecords.length === 0) {
        listContainer.innerHTML = `
            <div class="skeleton-container" style="padding:0;">
                ${Array(5).fill('<div class="skeleton-card" style="margin-bottom:12px;"><div class="skeleton" style="height:20px;width:40%;margin-bottom:10px;"></div><div class="skeleton" style="height:15px;width:70%;"></div></div>').join('')}
            </div>`;
    }

    // 3. Revalidate from Server
    try {
        const data = await apiRequest({ action: 'kvadrat_get_all' });
        if (data.success) {
            kvFullRecords = data.data || [];
            if (typeof kvDashboardRecords !== 'undefined') kvDashboardRecords = kvFullRecords;
            
            // Save to cache
            localStorage.setItem('kvFullRecords', JSON.stringify(kvFullRecords));
            
            applyKvFilters();
            console.log('🔄 Kvadratlar revalidated from server');
        } else {
            if (!kvFullRecords || kvFullRecords.length === 0) {
                listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Xato: ${escapeHtml(data.error || 'Yuklashda xato')}</p></div>`;
            }
        }
    } catch (e) {
        console.error('initKvadratTab revalidate error:', e);
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
        const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        const isLoyihachi = myRole === 'SuperAdmin' || positions.indexOf('Loyihachi') !== -1;
        fab.style.visibility = isLoyihachi ? 'visible' : 'hidden';
        fab.style.pointerEvents = isLoyihachi ? 'auto' : 'none';
        fab.style.opacity = isLoyihachi ? '1' : '0';
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

    if (!kvFilteredRecords || !kvFilteredRecords.length) {
        container.innerHTML = `
            <div class="empty-state" style="background:var(--surface); border:2px dashed #CBD5E1; border-radius:24px; padding:60px 20px; text-align:center; margin:20px 0;">
                <div class="empty-icon" style="font-size:48px; margin-bottom:16px;">📏</div>
                <p style="font-size:16px; font-weight:700; color:#1E293B; margin:0;">Ma'lumotlar topilmadi</p>
                <p style="font-size:13px; color:#64748B; margin-top:8px;">Ushbu davr yoki filtrlar bo'yicha ma'lumot yo'q.</p>
            </div>`;
        if (totalDisplay) totalDisplay.innerText = '0';
        return;
    }

    try {
        const totalM2ForFiltered = kvFilteredRecords.reduce((sum, rec) => sum + (Number(rec.totalM2) || 0), 0);
        if (totalDisplay) {
            totalDisplay.innerText = totalM2ForFiltered.toLocaleString('uz-UZ', { maximumFractionDigits: 1 });
        }

        let lastDavr = null;
        const sortedKvData = [...kvFilteredRecords].sort((a, b) => {
            const davrA = a.year && a.month ? `${a.year}-${String(a.month).replace('_', '').padStart(2, '0')}` : getDavrSortKey('', a.date, '');
            const davrB = b.year && b.month ? `${b.year}-${String(b.month).replace('_', '').padStart(2, '0')}` : getDavrSortKey('', b.date, '');
            if (davrB !== davrA) return davrB.localeCompare(davrA);
            const noA = parseInt(a.no, 10) || 0;
            const noB = parseInt(b.no, 10) || 0;
            return noB - noA;
        });

        const totalPages = Math.ceil(sortedKvData.length / KV_ITEMS_PER_PAGE);
        const start = (kvCurrentPage - 1) * KV_ITEMS_PER_PAGE;
        const end = start + KV_ITEMS_PER_PAGE;
        const paginatedData = sortedKvData.slice(start, end);

        const wrap = document.createElement('div');
        wrap.className = 'kv-table-wrap';
        const table = document.createElement('table');
        table.className = 'kv-table';
        table.innerHTML = `<thead><tr><th>№</th><th>Buyurtma №</th><th>Oy</th><th style="text-align:right;">m²</th><th>ST</th></tr></thead>`;
        const tbody = document.createElement('tbody');

        paginatedData.forEach((rec, loopIdx) => {
            const globalIdx = (kvCurrentPage - 1) * KV_ITEMS_PER_PAGE + loopIdx;
            const origIdx = kvFilteredRecords.indexOf(rec);

            const currentDavr = rec.year && rec.month ? `${rec.year}-${String(rec.month).replace('_', '').padStart(2, '0')}` : getDavrSortKey('', rec.date, '');
            let relDavr = getDavrLabel(currentDavr);

            if (relDavr !== lastDavr) {
                const trDate = document.createElement('tr');
                trDate.className = 'kv-date-row';
                trDate.innerHTML = `<td colspan="5" style="border:1px solid #E2E8F0;">🗓 Davr: ${relDavr}</td>`;
                tbody.appendChild(trDate);
                lastDavr = relDavr;
            }

            const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            const monthClean = String(rec.month || '').replace(/^_+/, '').replace(/^'/, '');
            
            // Workflow vizualizatsiyasi
            const currentStepIdx = Number(rec.currentStep) || 1;
            const config = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
            const totalSteps = config.length >= 2 ? config.length : 3;
            
            let phaseColor = '#CBD5E1'; // default gray
            if (typeof getWorkflowStepColors === 'function') {
                const colors = getWorkflowStepColors(Math.max(0, currentStepIdx - 1), totalSteps);
                phaseColor = colors.bg || phaseColor;
            }

            const status = rec.status || 'yangi';
            let stIcon = '🟡';
            if (status.indexOf('yigi') !== -1) stIcon = '🔵';
            else if (status.indexOf('tayyor') !== -1 || status.indexOf('landi') !== -1) stIcon = '🟢';

            const trData = document.createElement('tr');
            trData.className = 'kv-data-row';
            trData.onclick = () => showKvDetailModal(origIdx);
            trData.innerHTML = `
                <td class="kv-col-seq">${globalIdx + 1}</td>
                <td class="kv-col-no"><b>${escapeHtml(String(rec.no || '—'))}</b></td>
                <td class="kv-col-oy">${monthClean || '—'}</td>
                <td class="kv-col-m2" style="text-align:right; font-weight:700;">${m2Val}</td>
                <td class="kv-col-st">
                    <span style="display:inline-flex;align-items:center;gap:4px;">
                        <span style="width:8px;height:8px;border-radius:50%;background:${phaseColor};"></span>
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
                btn.onclick = () => goToKvPage(i);
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

function showKvDetailModal(idx) {
    try {
        const rec = kvFilteredRecords[idx];
        if (!rec) return;
        
        const m2Val = (Number(rec.totalM2) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
        const status = rec.status || 'yangi';
        const config = (typeof myPermissions !== 'undefined' && myPermissions && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
        const myPoss = (typeof myPermissions !== 'undefined' && myPermissions && Array.isArray(myPermissions.positions)) ? myPermissions.positions : [];
        const currentStepIdx = Number(rec.currentStep) || 1;
        
        let claimBtnHtml = '';
        const isStrict = (typeof myPermissions !== 'undefined' && myPermissions && myPermissions.isWorkflowStrict);
        const logs = rec.logs || [];
        const doneSteps = logs.map(l => Number(l.step));
        const normalizedMyPoss = myPoss.map(p => normalizePos(p));

        if (isStrict) {
            const nextStep = config.find(s => s.index === currentStepIdx + 1);
            if (nextStep) {
                const nextStepPos = normalizePos(nextStep.position);
                // Faqat lavozimi bor bo'lsa ko'rinadi (SuperAdmin bo'lsa ham)
                if (normalizedMyPoss.indexOf(nextStepPos) !== -1 || (typeof myRole !== 'undefined' && myRole === 'SuperAdmin' && normalizedMyPoss.length === 0)) {
                    let btnColor = '#10B981';
                    if (typeof getWorkflowStepColors === 'function') {
                        const totalSteps = config.length >= 2 ? config.length : 3;
                        btnColor = getWorkflowStepColors(nextStep.index - 1, totalSteps).bg || btnColor;
                    }
                    claimBtnHtml = `<button class="btn-main" style="background:${btnColor}; color:white; font-weight:800; border:none; box-shadow:0 4px 12px ${btnColor}66; margin-bottom:12px; height:50px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="closeKvDetailModal();claimKvWork(${rec.rowId}, ${nextStep.index})">✅ ${escapeHtml(nextStep.action)}</button>`;
                }
            }
        } else {
            const availableSteps = config.filter(s => {
                if (s.index <= 1) return false; 
                if (doneSteps.indexOf(s.index) !== -1) return false;
                const sPos = normalizePos(s.position);
                // Faqat lavozimi bor bo'lsa (SuperAdmin ham lavozimi bo'lishi kerak yoki barcha lavozimlarga ega bo'lishi kerak)
                return normalizedMyPoss.indexOf(sPos) !== -1;
            });

            availableSteps.forEach(s => {
                let btnColor = '#6366f1';
                if (typeof getWorkflowStepColors === 'function') {
                    const totalSteps = config.length >= 2 ? config.length : 3;
                    btnColor = getWorkflowStepColors(s.index - 1, totalSteps).bg || btnColor;
                }
                claimBtnHtml += `<button class="btn-main" style="background:${btnColor}; color:white; font-weight:800; border:none; box-shadow:0 4px 12px ${btnColor}66; margin-bottom:12px; height:50px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="closeKvDetailModal();claimKvWork(${rec.rowId}, ${s.index})">✅ ${escapeHtml(s.action)}</button>`;
            });
        }

        let historyHtml = '';
        logs.forEach((log, lIdx) => {
            const stepCfg = config.find(s => s.index === log.step);
            let sColor = '#6366f1';
            if (typeof getWorkflowStepColors === 'function') {
                const totalSteps = config.length >= 2 ? config.length : 3;
                sColor = getWorkflowStepColors((log.step || 1) - 1, totalSteps).bg || sColor;
            }
            const name = log.u || (String(log.uid) === String(rec.ownerTgId) ? rec.staffName : (typeof globalEmployeeList !== 'undefined' && globalEmployeeList && globalEmployeeList.find(e => String(e.tgId || e.id) === String(log.uid))?.username || log.uid));
            
            // Tarix elementini yanada kontrastli qilish
            const isLast = lIdx === logs.length - 1;
            historyHtml += `
                <div style="border-left: 2.5px solid ${isLast ? 'transparent' : '#E2E8F0'}; padding-left: 20px; margin-bottom: 0; position: relative; padding-bottom: ${isLast ? '0' : '16px'};">
                    <div style="width: 14px; height: 14px; border-radius: 50%; background: white; border: 3px solid ${sColor}; position: absolute; left: -8.5px; top: 2px; box-shadow: 0 0 0 3px white;"></div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div style="font-size: 13px; font-weight: 800; color: #1E293B; letter-spacing: -0.2px;">${escapeHtml(stepCfg ? stepCfg.status : 'Bajarildi')}</div>
                        <div style="font-size: 11px; color: #64748B; font-weight: 500;">
                            <span style="color: #334155; font-weight: 700;">${escapeHtml(name)}</span> 
                            <span style="margin: 0 4px; opacity: 0.5;">•</span> 
                            ${new Date(log.d).toLocaleString('uz-UZ', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                </div>`;
        });

        const isAdmin = (typeof myRole !== 'undefined') && (myRole === 'SuperAdmin' || myRole === 'Admin' || myRole === 'Direktor');
        const hasPerms = (typeof myPermissions !== 'undefined' && myPermissions);
        const canEditGlobal = isAdmin && hasPerms && myPermissions.canEdit;
        const canDeleteGlobal = isAdmin && hasPerms && myPermissions.canDelete;
        const isOwner = String(rec.ownerTgId) === String(typeof telegramId !== 'undefined' ? telegramId : '0');

        const canEdit = canEditGlobal || isOwner || (typeof myRole !== 'undefined' && myRole === 'SuperAdmin');
        const canDelete = canDeleteGlobal || isOwner || (typeof myRole !== 'undefined' && myRole === 'SuperAdmin');

        const buttonsRow = (canEdit || canDelete) ? `
            <div style="display:flex; gap:8px; margin-bottom:16px;">
                ${canEdit ? `<button onclick="closeKvDetailModal();openKvModal(${rec.rowId})" style="flex:1; padding:10px; border-radius:10px; background:#FEF3C7; color:#92400E; border:1px solid #FCD34D; font-weight:700; font-size:13px;">✏️ Tahrirlash</button>` : ''}
                ${canDelete ? `<button onclick="closeKvDetailModal();deleteKv(${rec.rowId})" style="flex:1; padding:10px; border-radius:10px; background:#FEE2E2; color:#991B1B; border:1px solid #FECACA; font-weight:700; font-size:13px;">🗑 O'chirish</button>` : ''}
            </div>` : '';

        document.getElementById('kvDetailModalBody').innerHTML = `
            <div class="modal-drag"></div>
            ${buttonsRow}
            <div class="detail-header">
                <span class="detail-badge" style="background:#EFF6FF; color:#1D4ED8;">📐 Buyurtma Tafsiloti</span>
                <h3 style="margin:10px 0 5px 0; color:var(--navy); font-weight:800;">📌 ${escapeHtml(rec.orderName || '—')}</h3>
                <div style="font-size:12px; color:var(--text-muted); font-weight:600;">№${escapeHtml(String(rec.no || '—'))} | Sana: ${escapeHtml(rec.date || '—')}</div>
            </div>
            
            <div class="detail-card" style="margin-top:15px;">
                <div class="detail-row"><span class="detail-key">Mas'ul xodim</span><span class="detail-val">${escapeHtml(rec.staffName || '—')}</span></div>
                <div class="detail-row"><span class="detail-key">Hozirgi Holat</span><span class="detail-val"><b style="color:var(--green-dark); text-transform: uppercase;">${escapeHtml(status)}</b></span></div>
                <div class="detail-row" style="border-bottom:none;"><span class="detail-key">O'lcham</span><span class="detail-val" style="font-size:18px; font-weight:800; color:var(--navy);">${m2Val} m²</span></div>
            </div>

            <div style="margin-top:20px; background:#F1F5F9; border-radius:20px; padding:20px; border:1px solid #E2E8F0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size:11px; font-weight:900; color:#475569; text-transform:uppercase; margin-bottom:16px; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
                    <span style="background:#475569; width:12px; height:2px; border-radius:2px;"></span>
                    Jarayon Tarixi
                </div>
                ${historyHtml || '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">Hali harakatlar yo\'q</p>'}
            </div>

            <div style="margin-top:24px;">
                ${claimBtnHtml}
                <button class="btn-secondary" style="width:100%; height:52px; background:white; color:#475569; border:1.5px solid #E2E8F0; font-weight:700; border-radius:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" onclick="closeKvDetailModal()">✕ Yopish</button>
            </div>`;
            
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
    const month = document.getElementById('kvFilterMonth')?.value || 'all';
    const year = document.getElementById('kvFilterYear')?.value || 'all';
    const staff = document.getElementById('kvFilterStaff')?.value || 'all';
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
                const logNames = rec.logs.map(function(log) {
                    if (!log || !log.uid) return '';
                    if (String(log.uid) === String(rec.ownerTgId)) return rec.staffName;
                    // window._kvEmpMap orqali tgId -> name
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
            const mEl = document.getElementById('kvActionMonth');
            if (mEl && cleanMonth) mEl.value = cleanMonth.padStart(2, '0');
            const yEl = document.getElementById('kvActionYear');
            if (yEl) yEl.value = rec.year || (rec.date ? rec.date.split('/').pop() : new Date().getFullYear());
        }
    } else {
        const positions = (typeof myPermissions !== 'undefined' && myPermissions.positions) || [];
        if (myRole !== 'SuperAdmin' && positions.indexOf('Loyihachi') === -1) {
            showToastMsg('❌ Faqat "Loyihachi" buyurtma qo\'sha oladi', true);
            return;
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
    const rowId = document.getElementById('kvRowId').value;
    const orderNumber = (document.getElementById('kvOrderNumber').value || '').trim();
    const orderName = (document.getElementById('kvOrderName').value || '').trim();
    const totalM2 = parseFloat(document.getElementById('kvTotalM2Input').value) || 0;
    const staffName = document.getElementById('kvStaffSelect').value;
    const month = document.getElementById('kvActionMonth')?.value || '';
    const year = document.getElementById('kvActionYear')?.value || new Date().getFullYear();

    if (!orderNumber || !orderName || totalM2 <= 0 || !staffName) {
        showToastMsg('❌ Ma\'lumotlarni to\'liq kiriting', true);
        return;
    }

    if (rowId) {
        const rec = kvFullRecords.find(r => String(r.rowId) === String(rowId));
        const isAdmin = myRole === 'Admin' || myRole === 'SuperAdmin' || myRole === 'Direktor';
        const canEditAll = isAdmin && myPermissions.canEdit;
        const isOwner = rec && String(rec.ownerTgId) === String(telegramId);
        
        if (!canEditAll && !isOwner && myRole !== 'SuperAdmin') {
            showToastMsg('❌ Siz faqat o\'zingiz kiritgan ma\'lumotni tahrirlay olasiz', true);
            return;
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
            action,
            rowId: rowId || undefined,
            no: orderNumber,
            orderName,
            totalM2,
            staffName,
            ownerTgId,
            month: `_${month}`,
            year: year,
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
    const rec = kvFullRecords.find(r => String(r.rowId) === String(rowId));
    if (!rec) return;

    const isAdmin = myRole === 'Admin' || myRole === 'SuperAdmin' || myRole === 'Direktor';
    const canDeleteAll = isAdmin && myPermissions.canDelete;
    const isOwner = String(rec.ownerTgId) === String(telegramId);

    if (!canDeleteAll && !isOwner && myRole !== 'SuperAdmin') {
        showToastMsg('❌ Siz faqat o\'zingiz kiritgan ma\'lumotni o\'chira olasiz', true);
        return;
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
        const data = await apiRequest({ 
            action: 'kvadrat_claim', 
            rowId,
            targetStepIndex: targetStepIndex 
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
