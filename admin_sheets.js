/**
 * admin_sheets.js — Google Sheets Uslubidagi Admin Panel
 * Aristokrat Ish Haqi & Kvadratlar
 * 
 * Barcha katakcha o'zgarishlari to'g'ridan-to'g'ri SQLite bazasiga saqlanadi!
 */

// ── Global Boshqaruv Holati (State) ─────────────────────────
const SheetsApp = {
    activeTab: 'dataSheet', // 'dataSheet' | 'Kvadratlar' | 'Hodimlar' | 'Sozlamalar'
    auth: {
        telegramId: '2112012311', // default SuperAdmin iRealBy_3D
        username: 'iRealBy_3D',
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
        canEdit: true,
        canDelete: true,
        initData: ''
    },
    data: {
        records: [],
        kvadratlar: [],
        employees: [],
        settings: [],
        workflowSteps: [],
        positions: []
    },
    filters: {
        search: '',
        status: '',
        period: '',
        role: '',
        group: '',
        year: '',
        month: ''
    },
    sort: {
        column: null,
        order: 'asc'
    },
    editingCell: null
};

// ── Boshlang'ich Sozlash (Init) ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTheme();
    setupEventListeners();
    loadAllData();
});

// Telegram yoki Desktop Auth aniqlash
function initAuth() {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        tg.setHeaderColor && tg.setHeaderColor('#0F172A');
        if (tg.initData) {
            SheetsApp.auth.initData = tg.initData;
        }
        if (tg.initDataUnsafe?.user?.id) {
            SheetsApp.auth.telegramId = String(tg.initDataUnsafe.user.id);
            SheetsApp.auth.username = tg.initDataUnsafe.user.username || 
                `${tg.initDataUnsafe.user.first_name || ''} ${tg.initDataUnsafe.user.last_name || ''}`.trim() || 'Foydalanuvchi';
        }
    }

    // URL parametrlari orqali tekshirish
    const params = new URLSearchParams(window.location.search);
    if (params.has('tgId')) {
        SheetsApp.auth.telegramId = params.get('tgId');
    } else if (localStorage.getItem('admin_sheets_tg_id')) {
        SheetsApp.auth.telegramId = localStorage.getItem('admin_sheets_tg_id');
    }

    // Foydalanuvchi nomi qoidasi: Agar iRealBy_3D bo'lsa
    if (SheetsApp.auth.telegramId === '2112012311') {
        SheetsApp.auth.username = 'iRealBy_3D';
    }

    updateUserUI();
}

function updateUserUI() {
    const userBadge = document.getElementById('gsUserBadge');
    if (userBadge) {
        userBadge.textContent = `👤 ${SheetsApp.auth.username} (${SheetsApp.auth.telegramId})`;
    }
}

// ── API So'rov Yuborish Yordamchisi ─────────────────────────
async function apiRequest(action, payload = {}) {
    const body = {
        action,
        telegramId: SheetsApp.auth.telegramId,
        initData: SheetsApp.auth.initData,
        ...payload
    };

    try {
        const res = await fetch('/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            throw new Error(`Server xatosi: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data;
    } catch (err) {
        console.error(`[API Error: ${action}]`, err);
        return { success: false, error: err.message || 'Tarmoq xatosi' };
    }
}

// ── Barcha Ma'lumotlarni Yuklash ────────────────────────────
async function loadAllData() {
    showStatus('⏳ SQLite bazasidan yuklanmoqda...');
    setSyncIndicator(true);

    try {
        // Avval foydalanuvchi huquqlarini tekshirish
        const initRes = await apiRequest('init');
        if (initRes && initRes.success) {
            SheetsApp.auth.isSuperAdmin = !!initRes.isSuperAdmin;
            SheetsApp.auth.role = initRes.roleKey || initRes.role || 'EMPLOYEE';
            SheetsApp.auth.username = (SheetsApp.auth.telegramId === '2112012311') ? 'iRealBy_3D' : (initRes.username || SheetsApp.auth.username);
            SheetsApp.auth.canEdit = initRes.isSuperAdmin || !!initRes.permissions?.canEdit;
            SheetsApp.auth.canDelete = initRes.isSuperAdmin || !!initRes.permissions?.canDelete;
            if (initRes.workflowConfig) SheetsApp.data.workflowSteps = initRes.workflowConfig;
            if (initRes.allPositions) SheetsApp.data.positions = initRes.allPositions;
            updateUserUI();
        }

        // Barcha jadvallarni parallel ravishda SQLite dan yuklash
        const [recRes, kvRes, empRes, setRes] = await Promise.all([
            apiRequest('admin_get_all'),
            apiRequest('kvadrat_get_all'),
            apiRequest('get_hodimlar'),
            apiRequest('get_global_settings')
        ]);

        if (recRes && recRes.success) {
            SheetsApp.data.records = recRes.data || [];
        }

        if (kvRes && kvRes.success) {
            SheetsApp.data.kvadratlar = kvRes.data || [];
        }

        if (empRes && empRes.success) {
            SheetsApp.data.employees = empRes.data || [];
        }

        if (setRes && setRes.success) {
            if (Array.isArray(setRes.settings?.allList)) {
                SheetsApp.data.settings = setRes.settings.allList;
            } else {
                SheetsApp.data.settings = [
                    { key: 'ONLY_BUGALTER_ADD', value: setRes.settings?.onlyBugalterAdd ? '1' : '0' },
                    { key: 'DISABLE_EMP_EDIT_DELETE', value: setRes.settings?.disableEmpEditDelete ? '1' : '0' },
                    { key: 'NOTIFY_DIRECTOR', value: setRes.settings?.notifyDirector ? '1' : '0' },
                    { key: 'WORKFLOW_STRICT_MODE', value: setRes.settings?.workflowStrictMode ? '1' : '0' }
                ];
            }
        }

        updateTabBadges();
        updateFilterOptions();
        renderActiveTable();
        showToast('Barcha ma\'lumotlar SQLite bazasidan yangilandi ✅');
        showStatus('SQLite WAL Baza: Sinxronlangan');
    } catch (e) {
        console.error('[loadAllData error]', e);
        showToast('Ma\'lumotlarni yuklashda xatolik yuz berdi ❌', true);
        showStatus('Xatolik yuz berdi!');
    } finally {
        setSyncIndicator(false);
    }
}

// ── Tab Badges (Hisoblagichlar) ─────────────────────────────
function updateTabBadges() {
    const bRecords = document.getElementById('badgeRecords');
    const bKv = document.getElementById('badgeKvadratlar');
    const bEmp = document.getElementById('badgeHodimlar');
    const bSet = document.getElementById('badgeSettings');

    if (bRecords) bRecords.textContent = SheetsApp.data.records.length;
    if (bKv) bKv.textContent = SheetsApp.data.kvadratlar.length;
    if (bEmp) bEmp.textContent = SheetsApp.data.employees.length;
    if (bSet) bSet.textContent = SheetsApp.data.settings.length;
}

// ── Tabni almashtirish ──────────────────────────────────────
function switchSheet(tabName) {
    SheetsApp.activeTab = tabName;
    SheetsApp.sort.column = null;
    SheetsApp.sort.order = 'asc';
    SheetsApp.filters.search = '';
    const searchInp = document.getElementById('gsSearchInput');
    if (searchInp) searchInp.value = '';

    document.querySelectorAll('.gs-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    updateFilterOptions();
    renderActiveTable();
}

// ── Filtrlarni Yangilash (Dynamic Filter UI) ────────────────
function updateFilterOptions() {
    const filterContainer = document.getElementById('gsDynamicFilters');
    if (!filterContainer) return;
    filterContainer.innerHTML = '';

    if (SheetsApp.activeTab === 'dataSheet') {
        // Status filter
        const selStatus = document.createElement('select');
        selStatus.className = 'gs-select';
        selStatus.innerHTML = `
            <option value="">Holat: Barchasi</option>
            <option value="Tasdiqlandi">✅ Tasdiqlandi</option>
            <option value="Kutilmoqda">⏳ Kutilmoqda</option>
            <option value="Rad etildi">❌ Rad etildi</option>
        `;
        selStatus.value = SheetsApp.filters.status;
        selStatus.onchange = (e) => {
            SheetsApp.filters.status = e.target.value;
            renderActiveTable();
        };
        filterContainer.appendChild(selStatus);

        // Davr filter
        const periods = [...new Set(SheetsApp.data.records.map(r => r.actionPeriod || r.action_period).filter(Boolean))].sort().reverse();
        if (periods.length) {
            const selPeriod = document.createElement('select');
            selPeriod.className = 'gs-select';
            selPeriod.innerHTML = `<option value="">Davr: Barchasi</option>` + periods.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
            selPeriod.value = SheetsApp.filters.period;
            selPeriod.onchange = (e) => {
                SheetsApp.filters.period = e.target.value;
                renderActiveTable();
            };
            filterContainer.appendChild(selPeriod);
        }
    } else if (SheetsApp.activeTab === 'Kvadratlar') {
        // Status filter
        const selStatus = document.createElement('select');
        selStatus.className = 'gs-select';
        selStatus.innerHTML = `
            <option value="">Holat: Barchasi</option>
            <option value="yangi">🆕 Yangi</option>
            <option value="Jarayonda">⚡ Jarayonda</option>
            <option value="Bajarildi">🏁 Bajarildi</option>
        `;
        selStatus.value = SheetsApp.filters.status;
        selStatus.onchange = (e) => {
            SheetsApp.filters.status = e.target.value;
            renderActiveTable();
        };
        filterContainer.appendChild(selStatus);

        // Yil filter
        const years = [...new Set(SheetsApp.data.kvadratlar.map(k => k.yil).filter(Boolean))].sort().reverse();
        if (years.length) {
            const selYear = document.createElement('select');
            selYear.className = 'gs-select';
            selYear.innerHTML = `<option value="">Yil: Barchasi</option>` + years.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');
            selYear.value = SheetsApp.filters.year;
            selYear.onchange = (e) => {
                SheetsApp.filters.year = e.target.value;
                renderActiveTable();
            };
            filterContainer.appendChild(selYear);
        }

        // Oy filter
        const months = [...new Set(SheetsApp.data.kvadratlar.map(k => k.oy).filter(Boolean))];
        if (months.length) {
            const selMonth = document.createElement('select');
            selMonth.className = 'gs-select';
            selMonth.innerHTML = `<option value="">Oy: Barchasi</option>` + months.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
            selMonth.value = SheetsApp.filters.month;
            selMonth.onchange = (e) => {
                SheetsApp.filters.month = e.target.value;
                renderActiveTable();
            };
            filterContainer.appendChild(selMonth);
        }
    } else if (SheetsApp.activeTab === 'Hodimlar') {
        // Rol filter
        const selRole = document.createElement('select');
        selRole.className = 'gs-select';
        selRole.innerHTML = `
            <option value="">Rol: Barchasi</option>
            <option value="SUPER_ADMIN">👑 SuperAdmin</option>
            <option value="ADMIN">🛡 Admin</option>
            <option value="DIRECTOR">💼 Direktor</option>
            <option value="BUGALTER">💰 Bugalter</option>
            <option value="BRIGADIR">👷 Brigadir</option>
            <option value="STAFF">👔 Staff</option>
            <option value="EMPLOYEE">👤 Xodim</option>
        `;
        selRole.value = SheetsApp.filters.role;
        selRole.onchange = (e) => {
            SheetsApp.filters.role = e.target.value;
            renderActiveTable();
        };
        filterContainer.appendChild(selRole);
    }
}

// ── Asosiy Jadvalni Render Qilish ───────────────────────────
function renderActiveTable() {
    switch (SheetsApp.activeTab) {
        case 'dataSheet':
            renderDataSheetTable();
            break;
        case 'Kvadratlar':
            renderKvadratlarTable();
            break;
        case 'Hodimlar':
            renderHodimlarTable();
            break;
        case 'Sozlamalar':
            renderSettingsTable();
            break;
    }
}

// ─────────────────────────────────────────────────────────────
// 1. dataSheet (Moliyaviy Yozuvlar)
// ─────────────────────────────────────────────────────────────
function renderDataSheetTable() {
    const thead = document.getElementById('gsThead');
    const tbody = document.getElementById('gsTbody');
    if (!thead || !tbody) return;

    let items = [...SheetsApp.data.records];

    // Qidiruv va filtrlar
    const search = SheetsApp.filters.search.toLowerCase().trim();
    if (search) {
        items = items.filter(r => {
            return (r.name && r.name.toLowerCase().includes(search)) ||
                   (r.comment && r.comment.toLowerCase().includes(search)) ||
                   (r.date && r.date.toLowerCase().includes(search)) ||
                   (r.telegram_id && String(r.telegram_id).includes(search)) ||
                   (r.action_period && r.action_period.toLowerCase().includes(search)) ||
                   (r.id && String(r.id).includes(search));
        });
    }
    if (SheetsApp.filters.status) {
        items = items.filter(r => (r.status || 'Tasdiqlandi') === SheetsApp.filters.status);
    }
    if (SheetsApp.filters.period) {
        items = items.filter(r => (r.actionPeriod || r.action_period) === SheetsApp.filters.period);
    }

    // Saralash (Sort)
    if (SheetsApp.sort.column) {
        const col = SheetsApp.sort.column;
        const dir = SheetsApp.sort.order === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            let valA = a[col] ?? '';
            let valB = b[col] ?? '';
            if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir;
            return String(valA).localeCompare(String(valB)) * dir;
        });
    }

    // Sarlavhalar (Header)
    thead.innerHTML = `
        <tr>
            <th class="gs-col-row-num">#</th>
            <th onclick="sortTable('id')">ID ${getSortIcon('id')}</th>
            <th onclick="sortTable('date')">Sana 📅 ${getSortIcon('date')}</th>
            <th onclick="sortTable('name')">Hodim Ismi 👤 ${getSortIcon('name')}</th>
            <th onclick="sortTable('telegram_id')">Telegram ID 🆔 ${getSortIcon('telegram_id')}</th>
            <th onclick="sortTable('amount_uzs')" style="text-align:right;">Summa (UZS) 🇺🇿 ${getSortIcon('amount_uzs')}</th>
            <th onclick="sortTable('amount_usd')" style="text-align:right;">Summa (USD) 🇺🇸 ${getSortIcon('amount_usd')}</th>
            <th onclick="sortTable('rate')" style="text-align:right;">Kurs 📈 ${getSortIcon('rate')}</th>
            <th onclick="sortTable('action_period')">Davr / Oy 🗓 ${getSortIcon('action_period')}</th>
            <th onclick="sortTable('status')">Holat 🟢 ${getSortIcon('status')}</th>
            <th>Izoh 📝</th>
            <th>Kiritgan 🛡</th>
            <th style="text-align:center; width: 70px;">Amallar ⚙️</th>
        </tr>
    `;

    // Qatorlar (Rows)
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding: 40px; color: var(--gs-text-muted);">Yozuvlar topilmadi</td></tr>`;
        updateStatsBar(0, 0, 0);
        return;
    }

    let totalUZS = 0;
    let totalUSD = 0;

    tbody.innerHTML = items.map((r, idx) => {
        const amtUZS = Number(r.amount_uzs || r.amountUZS || 0);
        const amtUSD = Number(r.amount_usd || r.amountUSD || 0);
        totalUZS += amtUZS;
        totalUSD += amtUSD;

        const statusStr = r.status || 'Tasdiqlandi';
        const badgeClass = statusStr === 'Tasdiqlandi' ? 'gs-badge-tasdiqlandi' :
                           statusStr === 'Rad etildi' ? 'gs-badge-rad' : 'gs-badge-kutilmoqda';

        return `
            <tr data-row-id="${r.id}">
                <td class="gs-col-row-num">${idx + 1}</td>
                <td style="color: var(--gs-text-muted); font-size:11px;">#${r.id}</td>
                <td class="gs-cell-editable" data-col="date" data-id="${r.id}" data-type="date" title="2 marta bosing tahrirlash uchun">${escapeHtml(r.date)}</td>
                <td class="gs-cell-editable" data-col="name" data-id="${r.id}" data-type="text" title="2 marta bosing tahrirlash uchun"><b>${escapeHtml(r.name)}</b></td>
                <td class="gs-cell-editable" data-col="telegram_id" data-id="${r.id}" data-type="text" title="2 marta bosing tahrirlash uchun" style="font-family: var(--gs-mono); font-size:11.5px;">${escapeHtml(r.telegram_id || r.telegramId || '')}</td>
                <td class="gs-cell-editable gs-num gs-amount-uzs" data-col="amount_uzs" data-id="${r.id}" data-type="number" title="2 marta bosing tahrirlash uchun">${formatMoney(amtUZS)} so'm</td>
                <td class="gs-cell-editable gs-num gs-amount-usd" data-col="amount_usd" data-id="${r.id}" data-type="number" title="2 marta bosing tahrirlash uchun">${amtUSD ? '$ ' + formatMoney(amtUSD) : '—'}</td>
                <td class="gs-cell-editable gs-num" data-col="rate" data-id="${r.id}" data-type="number" title="2 marta bosing tahrirlash uchun">${r.rate ? formatMoney(r.rate) : '—'}</td>
                <td class="gs-cell-editable" data-col="action_period" data-id="${r.id}" data-type="text" title="2 marta bosing tahrirlash uchun">${escapeHtml(r.actionPeriod || r.action_period || '—')}</td>
                <td class="gs-cell-editable" data-col="status" data-id="${r.id}" data-type="select-status" title="2 marta bosing tahrirlash uchun">
                    <span class="gs-status-badge ${badgeClass}">${escapeHtml(statusStr)}</span>
                </td>
                <td class="gs-cell-editable" data-col="comment" data-id="${r.id}" data-type="text" title="2 marta bosing tahrirlash uchun" style="max-width: 200px;">${escapeHtml(r.comment || '')}</td>
                <td style="color: var(--gs-text-muted); font-size:11px;">${escapeHtml(r.actor_name || r.actorName || '—')}</td>
                <td style="text-align:center;">
                    <div class="gs-row-actions" style="justify-content:center;">
                        <button class="gs-act-btn gs-act-btn-del" onclick="deleteRecordPrompt(${r.id}, '${escapeHtml(r.name)}')" title="O'chirish (SQLite)">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateStatsBar(items.length, totalUZS, totalUSD);
}

// ─────────────────────────────────────────────────────────────
// 2. Kvadratlar (Buyurtmalar & Oqim)
// ─────────────────────────────────────────────────────────────
function renderKvadratlarTable() {
    const thead = document.getElementById('gsThead');
    const tbody = document.getElementById('gsTbody');
    if (!thead || !tbody) return;

    let items = [...SheetsApp.data.kvadratlar];

    // Qidiruv va filtrlar
    const search = SheetsApp.filters.search.toLowerCase().trim();
    if (search) {
        items = items.filter(k => {
            return (k.order_name && k.order_name.toLowerCase().includes(search)) ||
                   (k.order_no && String(k.order_no).toLowerCase().includes(search)) ||
                   (k.staff_name && k.staff_name.toLowerCase().includes(search)) ||
                   (k.sana && k.sana.toLowerCase().includes(search)) ||
                   (k.owner_tg_id && String(k.owner_tg_id).includes(search));
        });
    }
    if (SheetsApp.filters.status) {
        items = items.filter(k => (k.status || 'yangi') === SheetsApp.filters.status);
    }
    if (SheetsApp.filters.year) {
        items = items.filter(k => String(k.yil) === SheetsApp.filters.year);
    }
    if (SheetsApp.filters.month) {
        items = items.filter(k => String(k.oy) === SheetsApp.filters.month);
    }

    // Saralash (Sort)
    if (SheetsApp.sort.column) {
        const col = SheetsApp.sort.column;
        const dir = SheetsApp.sort.order === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            let valA = a[col] ?? '';
            let valB = b[col] ?? '';
            if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir;
            return String(valA).localeCompare(String(valB)) * dir;
        });
    }

    // Sarlavhalar (Header)
    thead.innerHTML = `
        <tr>
            <th class="gs-col-row-num">#</th>
            <th onclick="sortTable('id')">ID ${getSortIcon('id')}</th>
            <th onclick="sortTable('sana')">Sana 📅 ${getSortIcon('sana')}</th>
            <th onclick="sortTable('order_no')">№ ${getSortIcon('order_no')}</th>
            <th onclick="sortTable('order_name')">Buyurtma Nomi 🏷 ${getSortIcon('order_name')}</th>
            <th onclick="sortTable('total_m2')" style="text-align:right;">Maydon (m²) 📐 ${getSortIcon('total_m2')}</th>
            <th onclick="sortTable('oy')">Oy 🗓 ${getSortIcon('oy')}</th>
            <th onclick="sortTable('yil')">Yil 📅 ${getSortIcon('yil')}</th>
            <th onclick="sortTable('owner_tg_id')">Mulkdor ID 🆔 ${getSortIcon('owner_tg_id')}</th>
            <th onclick="sortTable('staff_name')">Xodim 👤 ${getSortIcon('staff_name')}</th>
            <th onclick="sortTable('current_step')">Joriy Bosqich ⚡ ${getSortIcon('current_step')}</th>
            <th onclick="sortTable('status')">Holat 🟢 ${getSortIcon('status')}</th>
            <th style="text-align:center; width: 70px;">Amallar ⚙️</th>
        </tr>
    `;

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding: 40px; color: var(--gs-text-muted);">Buyurtmalar topilmadi</td></tr>`;
        updateStatsBar(0, 0, 0, 0);
        return;
    }

    let totalM2 = 0;

    tbody.innerHTML = items.map((k, idx) => {
        const m2 = Number(k.total_m2 || 0);
        totalM2 += m2;

        const statusStr = k.status || 'yangi';
        let badgeClass = 'gs-badge-kutilmoqda';
        if (statusStr.toLowerCase().includes('bajarildi') || statusStr.toLowerCase().includes('yakunlandi')) {
            badgeClass = 'gs-badge-tasdiqlandi';
        } else if (statusStr.toLowerCase().includes('yangi')) {
            badgeClass = 'gs-badge-kutilmoqda';
        }

        return `
            <tr data-row-id="${k.id}">
                <td class="gs-col-row-num">${idx + 1}</td>
                <td style="color: var(--gs-text-muted); font-size:11px;">#${k.id}</td>
                <td class="gs-cell-editable" data-col="sana" data-id="${k.id}" data-type="date" title="2 marta bosing tahrirlash uchun">${escapeHtml(k.sana)}</td>
                <td class="gs-cell-editable" data-col="order_no" data-id="${k.id}" data-type="text" title="2 marta bosing tahrirlash uchun" style="font-weight:700;">${escapeHtml(k.order_no || '—')}</td>
                <td class="gs-cell-editable" data-col="order_name" data-id="${k.id}" data-type="text" title="2 marta bosing tahrirlash uchun"><b>${escapeHtml(k.order_name)}</b></td>
                <td class="gs-cell-editable gs-num" data-col="total_m2" data-id="${k.id}" data-type="number" title="2 marta bosing tahrirlash uchun" style="font-weight:800; color: #0284c7;">${m2.toLocaleString('uz-UZ', {minimumFractionDigits: 1, maximumFractionDigits: 2})} m²</td>
                <td class="gs-cell-editable" data-col="oy" data-id="${k.id}" data-type="text" title="2 marta bosing tahrirlash uchun">${escapeHtml(k.oy || '—')}</td>
                <td class="gs-cell-editable" data-col="yil" data-id="${k.id}" data-type="text" title="2 marta bosing tahrirlash uchun">${escapeHtml(k.yil || '—')}</td>
                <td class="gs-cell-editable" data-col="owner_tg_id" data-id="${k.id}" data-type="text" title="2 marta bosing tahrirlash uchun" style="font-family: var(--gs-mono); font-size:11.5px;">${escapeHtml(k.owner_tg_id || '')}</td>
                <td class="gs-cell-editable" data-col="staff_name" data-id="${k.id}" data-type="text" title="2 marta bosing tahrirlash uchun">${escapeHtml(k.staff_name || '—')}</td>
                <td class="gs-cell-editable" data-col="current_step" data-id="${k.id}" data-type="select-step" title="2 marta bosing tahrirlash uchun" style="text-align:center;">
                    <span style="font-weight:700; background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 8px; border-radius:6px;">Bosqich ${k.current_step || 1}</span>
                </td>
                <td class="gs-cell-editable" data-col="status" data-id="${k.id}" data-type="select-kv-status" title="2 marta bosing tahrirlash uchun">
                    <span class="gs-status-badge ${badgeClass}">${escapeHtml(statusStr)}</span>
                </td>
                <td style="text-align:center;">
                    <div class="gs-row-actions" style="justify-content:center;">
                        <button class="gs-act-btn gs-act-btn-del" onclick="deleteKvadratPrompt(${k.id}, '${escapeHtml(k.order_name)}')" title="O'chirish (SQLite)">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateStatsBar(items.length, 0, 0, totalM2);
}

// ─────────────────────────────────────────────────────────────
// 3. Hodimlar (Xodimlar & Huquqlar)
// ─────────────────────────────────────────────────────────────
function renderHodimlarTable() {
    const thead = document.getElementById('gsThead');
    const tbody = document.getElementById('gsTbody');
    if (!thead || !tbody) return;

    let items = [...SheetsApp.data.employees];

    // Qidiruv va filtrlar
    const search = SheetsApp.filters.search.toLowerCase().trim();
    if (search) {
        items = items.filter(e => {
            return (e.username && e.username.toLowerCase().includes(search)) ||
                   (e.telegram_id && String(e.telegram_id).includes(search)) ||
                   (e.lavozim && e.lavozim.toLowerCase().includes(search)) ||
                   (e.guruh && e.guruh.toLowerCase().includes(search)) ||
                   (e.role && e.role.toLowerCase().includes(search));
        });
    }
    if (SheetsApp.filters.role) {
        items = items.filter(e => (e.roleKey || e.role) === SheetsApp.filters.role);
    }

    // Saralash (Sort)
    if (SheetsApp.sort.column) {
        const col = SheetsApp.sort.column;
        const dir = SheetsApp.sort.order === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            let valA = a[col] ?? '';
            let valB = b[col] ?? '';
            return String(valA).localeCompare(String(valB)) * dir;
        });
    }

    // Sarlavhalar (Header)
    thead.innerHTML = `
        <tr>
            <th class="gs-col-row-num">#</th>
            <th onclick="sortTable('telegram_id')">Telegram ID 🆔 ${getSortIcon('telegram_id')}</th>
            <th onclick="sortTable('username')">Ism / Username 👤 ${getSortIcon('username')}</th>
            <th onclick="sortTable('role')">Rol 👑 ${getSortIcon('role')}</th>
            <th onclick="sortTable('lavozim')">Lavozimlar 💼 ${getSortIcon('lavozim')}</th>
            <th onclick="sortTable('guruh')">Guruh 🏷 ${getSortIcon('guruh')}</th>
            <th style="text-align:center;">Sardor ⭐</th>
            <th style="text-align:center;">Qo'shish ➕</th>
            <th style="text-align:center;">Ko'rish 👁</th>
            <th style="text-align:center;">Tahrirlash ✏️</th>
            <th style="text-align:center;">O'chirish 🗑</th>
            <th style="text-align:center;">Eksport 📥</th>
            <th style="text-align:center;">Dash 📊</th>
            <th style="text-align:center; width: 70px;">Amallar ⚙️</th>
        </tr>
    `;

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding: 40px; color: var(--gs-text-muted);">Xodimlar topilmadi</td></tr>`;
        updateStatsBar(0);
        return;
    }

    tbody.innerHTML = items.map((e, idx) => {
        const tgId = String(e.telegram_id || e.tgId || '');
        const roleStr = e.roleKey || e.role || 'EMPLOYEE';

        return `
            <tr data-emp-id="${tgId}">
                <td class="gs-col-row-num">${idx + 1}</td>
                <td style="font-family: var(--gs-mono); font-size:11.5px; font-weight:700;">${tgId}</td>
                <td class="gs-cell-editable" data-col="username" data-id="${tgId}" data-type="text" title="2 marta bosing tahrirlash uchun"><b>${escapeHtml(e.username)}</b></td>
                <td class="gs-cell-editable" data-col="role" data-id="${tgId}" data-type="select-role" title="2 marta bosing tahrirlash uchun">
                    <span class="gs-status-badge gs-badge-tasdiqlandi">${escapeHtml(roleStr)}</span>
                </td>
                <td class="gs-cell-editable" data-col="lavozim" data-id="${tgId}" data-type="text" title="2 marta bosing tahrirlash uchun">${escapeHtml(e.lavozim || '—')}</td>
                <td class="gs-cell-editable" data-col="guruh" data-id="${tgId}" data-type="text" title="2 marta bosing tahrirlash uchun">${escapeHtml(e.guruh || '—')}</td>
                <td style="text-align:center;" onclick="toggleEmpPerm('${tgId}', 'is_sardor', ${e.is_sardor || e.isSardor ? 0 : 1})">${renderToggleIcon(e.is_sardor || e.isSardor)}</td>
                <td style="text-align:center;" onclick="toggleEmpPerm('${tgId}', 'can_add', ${e.can_add || e.canAdd ? 0 : 1})">${renderToggleIcon(e.can_add || e.canAdd)}</td>
                <td style="text-align:center;" onclick="toggleEmpPerm('${tgId}', 'can_view_all', ${e.can_view_all || e.canViewAll ? 0 : 1})">${renderToggleIcon(e.can_view_all || e.canViewAll)}</td>
                <td style="text-align:center;" onclick="toggleEmpPerm('${tgId}', 'can_edit', ${e.can_edit || e.canEdit ? 0 : 1})">${renderToggleIcon(e.can_edit || e.canEdit)}</td>
                <td style="text-align:center;" onclick="toggleEmpPerm('${tgId}', 'can_delete', ${e.can_delete || e.canDelete ? 0 : 1})">${renderToggleIcon(e.can_delete || e.canDelete)}</td>
                <td style="text-align:center;" onclick="toggleEmpPerm('${tgId}', 'can_export', ${e.can_export || e.canExport ? 0 : 1})">${renderToggleIcon(e.can_export || e.canExport)}</td>
                <td style="text-align:center;" onclick="toggleEmpPerm('${tgId}', 'can_view_dash', ${e.can_view_dash || e.canViewDash ? 0 : 1})">${renderToggleIcon(e.can_view_dash || e.canViewDash)}</td>
                <td style="text-align:center;">
                    <div class="gs-row-actions" style="justify-content:center;">
                        <button class="gs-act-btn gs-act-btn-del" onclick="deleteHodimPrompt('${tgId}', '${escapeHtml(e.username)}')" title="O'chirish (SQLite)">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateStatsBar(items.length);
}

function renderToggleIcon(val) {
    return val ? `<span style="color: var(--gs-green); font-weight:800; cursor:pointer; font-size:14px;" title="O'zgartirish uchun bosing">✅</span>` 
               : `<span style="color: var(--gs-text-muted); opacity:0.4; cursor:pointer; font-size:14px;" title="O'zgartirish uchun bosing">❌</span>`;
}

// ─────────────────────────────────────────────────────────────
// 4. Sozlamalar (Global Settings)
// ─────────────────────────────────────────────────────────────
function renderSettingsTable() {
    const thead = document.getElementById('gsThead');
    const tbody = document.getElementById('gsTbody');
    if (!thead || !tbody) return;

    let items = [...SheetsApp.data.settings];

    // Qidiruv
    const search = SheetsApp.filters.search.toLowerCase().trim();
    if (search) {
        items = items.filter(s => {
            return (s.key && s.key.toLowerCase().includes(search)) ||
                   (s.value && s.value.toLowerCase().includes(search));
        });
    }

    thead.innerHTML = `
        <tr>
            <th class="gs-col-row-num">#</th>
            <th style="width: 250px;">Kalit (Setting Key) 🔑</th>
            <th style="width: 250px;">Qiymat (Value) ⚙️</th>
            <th>Tavsif (Description) ℹ️</th>
            <th style="text-align:center; width: 100px;">Amal</th>
        </tr>
    `;

    const DESCRIPTIONS = {
        'ONLY_BUGALTER_ADD': "Faqat bugalter va SuperAdmin yozuv qo'sha oladi (1 = Ha, 0 = Yo'q)",
        'DISABLE_EMP_EDIT_DELETE': "Oddiy xodimlarga o'z yozuvlarini tahrirlash/o'chirishni taqiqlash",
        'NOTIFY_DIRECTOR': "Katta o'zgarishlar haqida Direktorga Telegram bildirishnoma yuborish",
        'WORKFLOW_STRICT_MODE': "Kvadratlar oqimida bosqichlarni ketma-ket (qat'iy) tasdiqlash rejimi",
        'WORKFLOW_STEPS': "Ish oqimi bosqichlarining JSON konfiguratsiyasi",
        'REMINDER_TEXT': "Xodimlarga eslatma yuborishdagi standart xabar matni"
    };

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--gs-text-muted);">Sozlamalar topilmadi</td></tr>`;
        updateStatsBar(0);
        return;
    }

    tbody.innerHTML = items.map((s, idx) => {
        const desc = DESCRIPTIONS[s.key] || 'Tizimning global sozlama parametri';
        const isBool = (s.value === '1' || s.value === '0');

        return `
            <tr data-setting-key="${escapeHtml(s.key)}">
                <td class="gs-col-row-num">${idx + 1}</td>
                <td style="font-family: var(--gs-mono); font-weight:700; color: var(--gs-green-dark);">${escapeHtml(s.key)}</td>
                <td class="gs-cell-editable" data-col="value" data-id="${escapeHtml(s.key)}" data-type="${isBool ? 'select-bool' : 'text'}" title="2 marta bosing tahrirlash uchun">
                    ${isBool 
                        ? `<span class="gs-status-badge ${s.value === '1' ? 'gs-badge-tasdiqlandi' : 'gs-badge-rad'}">${s.value === '1' ? '1 (Faol ✅)' : '0 (O\'chiq ❌)'}</span>` 
                        : `<b>${escapeHtml(s.value)}</b>`
                    }
                </td>
                <td style="color: var(--gs-text-muted); font-size:12px;">${desc}</td>
                <td style="text-align:center;">
                    ${isBool 
                        ? `<button class="gs-btn" onclick="toggleSettingBool('${escapeHtml(s.key)}', '${s.value === '1' ? '0' : '1'}')">O'zgartirish</button>`
                        : `<button class="gs-btn" onclick="editSettingPrompt('${escapeHtml(s.key)}', '${escapeHtml(s.value)}')">Tahrirlash</button>`
                    }
                </td>
            </tr>
        `;
    }).join('');

    updateStatsBar(items.length);
}

// ── Status Bar (Pastki statistika paneli) ───────────────────
function updateStatsBar(count, totalUZS = 0, totalUSD = 0, totalM2 = 0) {
    const statsEl = document.getElementById('gsStatsGroup');
    if (!statsEl) return;

    let html = `<div class="gs-stat-item">Jami qatorlar: <b>${count} ta</b></div>`;

    if (SheetsApp.activeTab === 'dataSheet') {
        html += `
            <div class="gs-stat-item">Jami So'm: <b style="color:var(--gs-green-dark);">${formatMoney(totalUZS)} UZS</b></div>
            <div class="gs-stat-item">Jami Dollar: <b style="color:#d97706;">$ ${formatMoney(totalUSD)}</b></div>
        `;
    } else if (SheetsApp.activeTab === 'Kvadratlar') {
        html += `
            <div class="gs-stat-item">Jami Maydon: <b style="color:#0284c7;">${totalM2.toLocaleString('uz-UZ', {minimumFractionDigits: 1, maximumFractionDigits: 2})} m²</b></div>
        `;
    }

    statsEl.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// KATAKCHA BO'YICHA INLINE TAHRIRLASH (INLINE CELL EDITING)
// Google Sheets tajribasi: 2 marta bosganda katakcha inputga aylanadi!
// ─────────────────────────────────────────────────────────────
function setupEventListeners() {
    const table = document.getElementById('gsTable');
    if (!table) return;

    // Double-click or single-click edit
    table.addEventListener('dblclick', handleCellDblClick);

    // Qidiruv inputi
    const searchInp = document.getElementById('gsSearchInput');
    if (searchInp) {
        searchInp.addEventListener('input', (e) => {
            SheetsApp.filters.search = e.target.value;
            renderActiveTable();
        });
    }

    // Modal tashqarisini bosganda yopish
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('gsAddModal');
        if (e.target === modal) {
            closeAddModal();
        }
    });

    // Escape tugmasi bosilganda tahrirlashni bekor qilish
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (SheetsApp.editingCell) {
                cancelCellEdit(SheetsApp.editingCell);
            }
            closeAddModal();
        }
    });
}

function handleCellDblClick(e) {
    const td = e.target.closest('td.gs-cell-editable');
    if (!td || td.classList.contains('gs-cell-editing')) return;

    startCellEdit(td);
}

function startCellEdit(td) {
    if (SheetsApp.editingCell && SheetsApp.editingCell !== td) {
        commitCellEdit(SheetsApp.editingCell);
    }

    SheetsApp.editingCell = td;
    const colName = td.getAttribute('data-col');
    const rowId = td.getAttribute('data-id');
    const type = td.getAttribute('data-type') || 'text';

    td.classList.add('gs-cell-editing');

    // Joriy xom qiymatni topish
    let currentRawVal = '';
    if (SheetsApp.activeTab === 'dataSheet') {
        const rec = SheetsApp.data.records.find(r => String(r.id) === String(rowId));
        if (rec) currentRawVal = rec[colName] ?? rec[snakeToCamel(colName)] ?? '';
    } else if (SheetsApp.activeTab === 'Kvadratlar') {
        const kv = SheetsApp.data.kvadratlar.find(k => String(k.id) === String(rowId));
        if (kv) currentRawVal = kv[colName] ?? '';
    } else if (SheetsApp.activeTab === 'Hodimlar') {
        const emp = SheetsApp.data.employees.find(e => String(e.telegram_id || e.tgId) === String(rowId));
        if (emp) currentRawVal = emp[colName] ?? '';
    } else if (SheetsApp.activeTab === 'Sozlamalar') {
        const st = SheetsApp.data.settings.find(s => String(s.key) === String(rowId));
        if (st) currentRawVal = st.value ?? '';
    }

    td.setAttribute('data-original-val', String(currentRawVal));

    // Input yoki Select yaratish
    let inputEl;

    if (type === 'select-status') {
        inputEl = document.createElement('select');
        inputEl.className = 'gs-cell-input';
        inputEl.innerHTML = `
            <option value="Tasdiqlandi">Tasdiqlandi</option>
            <option value="Kutilmoqda">Kutilmoqda</option>
            <option value="Rad etildi">Rad etildi</option>
        `;
        inputEl.value = currentRawVal || 'Tasdiqlandi';
    } else if (type === 'select-kv-status') {
        inputEl = document.createElement('select');
        inputEl.className = 'gs-cell-input';
        inputEl.innerHTML = `
            <option value="yangi">yangi</option>
            <option value="Jarayonda">Jarayonda</option>
            <option value="Bajarildi">Bajarildi</option>
        `;
        inputEl.value = currentRawVal || 'yangi';
    } else if (type === 'select-role') {
        inputEl = document.createElement('select');
        inputEl.className = 'gs-cell-input';
        inputEl.innerHTML = `
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="DIRECTOR">DIRECTOR</option>
            <option value="BUGALTER">BUGALTER</option>
            <option value="BRIGADIR">BRIGADIR</option>
            <option value="STAFF">STAFF</option>
            <option value="EMPLOYEE">EMPLOYEE</option>
        `;
        inputEl.value = currentRawVal || 'EMPLOYEE';
    } else if (type === 'select-step') {
        inputEl = document.createElement('select');
        inputEl.className = 'gs-cell-input';
        const steps = SheetsApp.data.workflowSteps.length ? SheetsApp.data.workflowSteps : [
            { step_index: 1, action_label: '1-bosqich' },
            { step_index: 2, action_label: '2-bosqich' },
            { step_index: 3, action_label: '3-bosqich' },
            { step_index: 4, action_label: '4-bosqich' }
        ];
        inputEl.innerHTML = steps.map(s => `<option value="${s.step_index || s.index}">${s.step_index || s.index} - ${escapeHtml(s.action_label || s.action || '')}</option>`).join('');
        inputEl.value = currentRawVal || 1;
    } else if (type === 'select-bool') {
        inputEl = document.createElement('select');
        inputEl.className = 'gs-cell-input';
        inputEl.innerHTML = `
            <option value="1">1 (Faol ✅)</option>
            <option value="0">0 (O'chiq ❌)</option>
        `;
        inputEl.value = currentRawVal === '1' ? '1' : '0';
    } else if (type === 'number') {
        inputEl = document.createElement('input');
        inputEl.type = 'number';
        inputEl.step = 'any';
        inputEl.className = 'gs-cell-input';
        inputEl.value = currentRawVal;
    } else if (type === 'date') {
        inputEl = document.createElement('input');
        inputEl.type = 'date';
        inputEl.className = 'gs-cell-input';
        inputEl.value = currentRawVal;
    } else {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'gs-cell-input';
        inputEl.value = currentRawVal;
    }

    td.innerHTML = '';
    td.appendChild(inputEl);
    inputEl.focus();
    if (inputEl.select && type !== 'date' && !type.startsWith('select')) {
        inputEl.select();
    }

    // Saqlash hodisasi
    inputEl.addEventListener('blur', () => {
        commitCellEdit(td);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitCellEdit(td);
        }
    });
}

// O'zgarishni SQLite bazasiga saqlash (Commit to SQLite)
async function commitCellEdit(td) {
    if (!td || !td.classList.contains('gs-cell-editing')) return;

    const inputEl = td.querySelector('.gs-cell-input');
    if (!inputEl) {
        td.classList.remove('gs-cell-editing');
        SheetsApp.editingCell = null;
        return;
    }

    const newVal = inputEl.value.trim();
    const origVal = td.getAttribute('data-original-val');
    const colName = td.getAttribute('data-col');
    const rowId = td.getAttribute('data-id');

    td.classList.remove('gs-cell-editing');
    SheetsApp.editingCell = null;

    // Agar o'zgarmagan bo'lsa qayta render qilish
    if (String(newVal) === String(origVal)) {
        renderActiveTable();
        return;
    }

    showStatus(`💾 SQLite bazasida saqlanmoqda (${colName})...`);

    let res = { success: false };

    if (SheetsApp.activeTab === 'dataSheet') {
        const payload = {
            rowId: parseInt(rowId, 10)
        };
        // Tegishli parametr nomini yuborish
        if (colName === 'amount_uzs') payload.amountUZS = newVal;
        else if (colName === 'amount_usd') payload.amountUSD = newVal;
        else if (colName === 'telegram_id') payload.telegramId = newVal;
        else if (colName === 'action_period') payload.actionPeriod = newVal;
        else payload[colName] = newVal;

        res = await apiRequest('admin_edit', payload);

        if (res && res.success) {
            const rec = SheetsApp.data.records.find(r => String(r.id) === String(rowId));
            if (rec) {
                rec[colName] = newVal;
                if (colName === 'amount_uzs') rec.amountUZS = newVal;
                if (colName === 'amount_usd') rec.amountUSD = newVal;
                if (colName === 'action_period') rec.actionPeriod = newVal;
            }
        }
    } else if (SheetsApp.activeTab === 'Kvadratlar') {
        const payload = {
            rowId: parseInt(rowId, 10)
        };
        if (colName === 'total_m2') payload.totalM2 = newVal;
        else if (colName === 'order_no') payload.no = newVal;
        else if (colName === 'order_name') payload.orderName = newVal;
        else if (colName === 'staff_name') payload.staffName = newVal;
        else if (colName === 'current_step') payload.currentStep = newVal;
        else payload[colName] = newVal;

        res = await apiRequest('kvadrat_edit', payload);

        if (res && res.success) {
            const kv = SheetsApp.data.kvadratlar.find(k => String(k.id) === String(rowId));
            if (kv) kv[colName] = newVal;
        }
    } else if (SheetsApp.activeTab === 'Hodimlar') {
        const emp = SheetsApp.data.employees.find(e => String(e.telegram_id || e.tgId) === String(rowId));
        if (!emp) return;

        const payload = {
            tgId: rowId,
            username: emp.username,
            role: emp.roleKey || emp.role || 'EMPLOYEE',
            lavozim: emp.lavozim || '',
            guruh: emp.guruh || '',
            isSardor: emp.is_sardor || emp.isSardor ? 1 : 0,
            canAdd: emp.can_add || emp.canAdd ? 1 : 0,
            canViewAll: emp.can_view_all || emp.canViewAll ? 1 : 0,
            canEdit: emp.can_edit || emp.canEdit ? 1 : 0,
            canDelete: emp.can_delete || emp.canDelete ? 1 : 0,
            canExport: emp.can_export || emp.canExport ? 1 : 0,
            canViewDash: emp.can_view_dash || emp.canViewDash ? 1 : 0
        };
        payload[colName] = newVal;

        res = await apiRequest('update_hodim', payload);

        if (res && res.success) {
            emp[colName] = newVal;
        }
    } else if (SheetsApp.activeTab === 'Sozlamalar') {
        res = await apiRequest('set_global_setting', {
            key: rowId,
            value: newVal
        });

        if (res && res.success) {
            const st = SheetsApp.data.settings.find(s => String(s.key) === String(rowId));
            if (st) st.value = newVal;
        }
    }

    if (res && res.success) {
        renderActiveTable();
        // Muvaffaqiyatli saqlanish animatsiyasi
        const updatedRow = document.querySelector(`[data-row-id="${rowId}"], [data-emp-id="${rowId}"], [data-setting-key="${rowId}"]`);
        if (updatedRow) {
            const cell = updatedRow.querySelector(`[data-col="${colName}"]`) || updatedRow;
            cell.classList.add('gs-cell-saved');
            setTimeout(() => cell.classList.remove('gs-cell-saved'), 1300);
        }
        showToast(`Saqlandi ✅ (${colName}: ${newVal})`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
    } else {
        renderActiveTable();
        const updatedRow = document.querySelector(`[data-row-id="${rowId}"], [data-emp-id="${rowId}"], [data-setting-key="${rowId}"]`);
        if (updatedRow) {
            const cell = updatedRow.querySelector(`[data-col="${colName}"]`) || updatedRow;
            cell.classList.add('gs-cell-error');
            setTimeout(() => cell.classList.remove('gs-cell-error'), 1600);
        }
        showToast(`Xatolik: ${res.error || 'Saqlab bo\'lmadi'} ❌`, true);
        showStatus('Saqlashda xatolik yuz berdi!');
    }
}

function cancelCellEdit(td) {
    td.classList.remove('gs-cell-editing');
    SheetsApp.editingCell = null;
    renderActiveTable();
}

// ─────────────────────────────────────────────────────────────
// XODIMLAR RUXSATLARINI 1-KLIK BILAN O'ZGARTIRISH (TOGGLE PERM)
// ─────────────────────────────────────────────────────────────
async function toggleEmpPerm(tgId, permField, newVal) {
    const emp = SheetsApp.data.employees.find(e => String(e.telegram_id || e.tgId) === String(tgId));
    if (!emp) return;

    showStatus(`💾 SQLite huquqlari saqlanmoqda (${permField})...`);

    const payload = {
        tgId,
        username: emp.username,
        role: emp.roleKey || emp.role || 'EMPLOYEE',
        lavozim: emp.lavozim || '',
        guruh: emp.guruh || '',
        isSardor: emp.is_sardor || emp.isSardor ? 1 : 0,
        canAdd: emp.can_add || emp.canAdd ? 1 : 0,
        canViewAll: emp.can_view_all || emp.canViewAll ? 1 : 0,
        canEdit: emp.can_edit || emp.canEdit ? 1 : 0,
        canDelete: emp.can_delete || emp.canDelete ? 1 : 0,
        canExport: emp.can_export || emp.canExport ? 1 : 0,
        canViewDash: emp.can_view_dash || emp.canViewDash ? 1 : 0
    };

    if (permField === 'is_sardor') payload.isSardor = newVal;
    else if (permField === 'can_add') payload.canAdd = newVal;
    else if (permField === 'can_view_all') payload.canViewAll = newVal;
    else if (permField === 'can_edit') payload.canEdit = newVal;
    else if (permField === 'can_delete') payload.canDelete = newVal;
    else if (permField === 'can_export') payload.canExport = newVal;
    else if (permField === 'can_view_dash') payload.canViewDash = newVal;

    const res = await apiRequest('update_hodim', payload);

    if (res && res.success) {
        emp[permField] = newVal;
        if (permField === 'is_sardor') emp.isSardor = newVal;
        if (permField === 'can_add') emp.canAdd = newVal;
        if (permField === 'can_view_all') emp.canViewAll = newVal;
        if (permField === 'can_edit') emp.canEdit = newVal;
        if (permField === 'can_delete') emp.canDelete = newVal;
        if (permField === 'can_export') emp.canExport = newVal;
        if (permField === 'can_view_dash') emp.canViewDash = newVal;

        renderActiveTable();
        showToast(`Huquq yangilandi va SQLite bazasiga yozildi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
    } else {
        showToast(`Xatolik: ${res.error || 'Saqlab bo\'lmadi'} ❌`, true);
    }
}

async function toggleSettingBool(key, newVal) {
    showStatus(`💾 SQLite sozlamasi saqlanmoqda (${key})...`);
    const res = await apiRequest('set_global_setting', { key, value: newVal });
    if (res && res.success) {
        const st = SheetsApp.data.settings.find(s => s.key === key);
        if (st) st.value = newVal;
        renderActiveTable();
        showToast(`Sozlama saqlandi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
    } else {
        showToast(`Xatolik: ${res.error || 'Saqlab bo\'lmadi'} ❌`, true);
    }
}

// ─────────────────────────────────────────────────────────────
// O'CHIRISH AMALLARI (DELETE)
// ─────────────────────────────────────────────────────────────
async function deleteRecordPrompt(id, name) {
    if (!confirm(`Haqiqatan ham #${id} — "${name}" moliyaviy yozuvini o'chirmoqchimisiz? (SQLite records)`)) return;

    showStatus(`🗑 SQLite yozuvi o'chirilmoqda...`);
    const res = await apiRequest('admin_delete', { rowId: id });
    if (res && res.success) {
        SheetsApp.data.records = SheetsApp.data.records.filter(r => r.id !== id);
        updateTabBadges();
        renderActiveTable();
        showToast(`Yozuv #${id} o'chirildi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
    } else {
        showToast(`Xatolik: ${res.error || 'O\'chirib bo\'lmadi'} ❌`, true);
    }
}

async function deleteKvadratPrompt(id, orderName) {
    if (!confirm(`Haqiqatan ham #${id} — "${orderName}" buyurtmasini o'chirmoqchimisiz? (SQLite kvadratlar)`)) return;

    showStatus(`🗑 SQLite buyurtmasi o'chirilmoqda...`);
    const res = await apiRequest('kvadrat_delete', { rowId: id });
    if (res && res.success) {
        SheetsApp.data.kvadratlar = SheetsApp.data.kvadratlar.filter(k => k.id !== id);
        updateTabBadges();
        renderActiveTable();
        showToast(`Buyurtma #${id} o'chirildi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
    } else {
        showToast(`Xatolik: ${res.error || 'O\'chirib bo\'lmadi'} ❌`, true);
    }
}

async function deleteHodimPrompt(tgId, username) {
    if (!confirm(`Haqiqatan ham "${username}" (${tgId}) xodimini o'chirmoqchimisiz? (SQLite employees)`)) return;

    showStatus(`🗑 SQLite xodimi o'chirilmoqda...`);
    const res = await apiRequest('delete_hodim', { tgId });
    if (res && res.success) {
        SheetsApp.data.employees = SheetsApp.data.employees.filter(e => String(e.telegram_id || e.tgId) !== String(tgId));
        updateTabBadges();
        renderActiveTable();
        showToast(`Xodim o'chirildi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
    } else {
        showToast(`Xatolik: ${res.error || 'O\'chirib bo\'lmadi'} ❌`, true);
    }
}

// ─────────────────────────────────────────────────────────────
// YANGI QATOR QO'SHISH MODALI (ADD ROW MODAL)
// ─────────────────────────────────────────────────────────────
function openAddModal() {
    const modal = document.getElementById('gsAddModal');
    const title = document.getElementById('gsModalTitle');
    const body = document.getElementById('gsModalBody');
    if (!modal || !body) return;

    modal.style.display = 'flex';

    if (SheetsApp.activeTab === 'dataSheet') {
        title.textContent = '➕ Yangi Moliyaviy Yozuv Qo\'shish (dataSheet)';
        const empOptions = SheetsApp.data.employees.map(e => 
            `<option value="${e.telegram_id}">${escapeHtml(e.username)} (${e.telegram_id})</option>`
        ).join('');

        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddRecord(event)">
                <div class="gs-form-group">
                    <label>Sana (YYYY-MM-DD):</label>
                    <input type="date" id="addRecDate" class="gs-form-input" value="${new Date().toISOString().slice(0,10)}" required>
                </div>
                <div class="gs-form-group">
                    <label>Hodimni tanlang:</label>
                    <select id="addRecTgId" class="gs-form-select" required>
                        ${empOptions}
                    </select>
                </div>
                <div class="gs-form-group">
                    <label>Summa (UZS):</label>
                    <input type="number" id="addRecUzs" class="gs-form-input" placeholder="0" value="0">
                </div>
                <div class="gs-form-group">
                    <label>Summa (USD):</label>
                    <input type="number" id="addRecUsd" class="gs-form-input" placeholder="0" value="0">
                </div>
                <div class="gs-form-group">
                    <label>Kurs:</label>
                    <input type="number" id="addRecRate" class="gs-form-input" placeholder="12600" value="12600">
                </div>
                <div class="gs-form-group">
                    <label>Davr (Masalan: Mart 2026):</label>
                    <input type="text" id="addRecPeriod" class="gs-form-input" placeholder="Mart 2026">
                </div>
                <div class="gs-form-group">
                    <label>Izoh:</label>
                    <textarea id="addRecComment" class="gs-form-textarea" rows="2" placeholder="Izoh..."></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                    <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
                </div>
            </form>
        `;
    } else if (SheetsApp.activeTab === 'Kvadratlar') {
        title.textContent = '➕ Yangi Buyurtma Qo\'shish (Kvadratlar)';
        const curDate = new Date();
        const curYear = String(curDate.getFullYear());
        const curMonthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
        const curMonth = curMonthNames[curDate.getMonth()];

        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddKvadrat(event)">
                <div class="gs-form-group">
                    <label>Sana (YYYY-MM-DD):</label>
                    <input type="date" id="addKvDate" class="gs-form-input" value="${curDate.toISOString().slice(0,10)}" required>
                </div>
                <div class="gs-form-group">
                    <label>Buyurtma raqami (№):</label>
                    <input type="text" id="addKvNo" class="gs-form-input" placeholder="Masalan: 1045" required>
                </div>
                <div class="gs-form-group">
                    <label>Buyurtma Nomi:</label>
                    <input type="text" id="addKvName" class="gs-form-input" placeholder="Masalan: Oshxona mebeli" required>
                </div>
                <div class="gs-form-group">
                    <label>Maydon (m²):</label>
                    <input type="number" step="0.01" id="addKvM2" class="gs-form-input" placeholder="0.00" required>
                </div>
                <div class="gs-form-group">
                    <label>Oy va Yil:</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="addKvMonth" class="gs-form-input" value="${curMonth}" style="flex:1;">
                        <input type="text" id="addKvYear" class="gs-form-input" value="${curYear}" style="flex:1;">
                    </div>
                </div>
                <div class="gs-form-group">
                    <label>Xodim nomi:</label>
                    <input type="text" id="addKvStaff" class="gs-form-input" value="${escapeHtml(SheetsApp.auth.username)}">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                    <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
                </div>
            </form>
        `;
    } else if (SheetsApp.activeTab === 'Hodimlar') {
        title.textContent = '➕ Yangi Xodim Qo\'shish (Hodimlar)';
        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddHodim(event)">
                <div class="gs-form-group">
                    <label>Telegram ID:</label>
                    <input type="text" id="addEmpTgId" class="gs-form-input" placeholder="Masalan: 123456789" required>
                </div>
                <div class="gs-form-group">
                    <label>Ism / Foydalanuvchi:</label>
                    <input type="text" id="addEmpName" class="gs-form-input" placeholder="Masalan: Azizbek" required>
                </div>
                <div class="gs-form-group">
                    <label>Rol:</label>
                    <select id="addEmpRole" class="gs-form-select">
                        <option value="EMPLOYEE">EMPLOYEE (Oddiy xodim)</option>
                        <option value="STAFF">STAFF (Usta)</option>
                        <option value="BRIGADIR">BRIGADIR (Brigadir)</option>
                        <option value="BUGALTER">BUGALTER (Bugalter)</option>
                        <option value="DIRECTOR">DIRECTOR (Direktor)</option>
                        <option value="ADMIN">ADMIN (Admin)</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN (Boshqaruvchi)</option>
                    </select>
                </div>
                <div class="gs-form-group">
                    <label>Lavozimlar (vergul bilan):</label>
                    <input type="text" id="addEmpLavozim" class="gs-form-input" placeholder="Kesish, Krovka, Qadoqlash">
                </div>
                <div class="gs-form-group">
                    <label>Guruh:</label>
                    <input type="text" id="addEmpGuruh" class="gs-form-input" placeholder="A guruh">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                    <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
                </div>
            </form>
        `;
    } else if (SheetsApp.activeTab === 'Sozlamalar') {
        title.textContent = '➕ Yangi Sozlama Qo\'shish (Sozlamalar)';
        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddSetting(event)">
                <div class="gs-form-group">
                    <label>Kalit (Key):</label>
                    <input type="text" id="addSetKey" class="gs-form-input" placeholder="PARAMETR_NOMI" required>
                </div>
                <div class="gs-form-group">
                    <label>Qiymat (Value):</label>
                    <input type="text" id="addSetVal" class="gs-form-input" placeholder="1 yoki matn" required>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                    <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
                </div>
            </form>
        `;
    }
}

function closeAddModal() {
    const modal = document.getElementById('gsAddModal');
    if (modal) modal.style.display = 'none';
}

async function submitAddRecord(e) {
    e.preventDefault();
    const date = document.getElementById('addRecDate').value;
    const targetTgId = document.getElementById('addRecTgId').value;
    const amountUZS = Number(document.getElementById('addRecUzs').value || 0);
    const amountUSD = Number(document.getElementById('addRecUsd').value || 0);
    const rate = Number(document.getElementById('addRecRate').value || 12600);
    const actionPeriod = document.getElementById('addRecPeriod').value;
    const comment = document.getElementById('addRecComment').value;

    const emp = SheetsApp.data.employees.find(x => String(x.telegram_id) === String(targetTgId));
    const empName = emp ? emp.username : 'Xodim';

    showStatus('💾 SQLite records jadvaliga yozilmoqda...');
    closeAddModal();

    const res = await apiRequest('add', {
        targetTgId,
        employeeName: empName,
        date,
        amountUZS,
        amountUSD,
        rate,
        actionPeriod,
        comment
    });

    if (res && res.success) {
        showToast('Yangi yozuv SQLite bazasida saqlandi ✅');
        loadAllData();
    } else {
        showToast(`Xatolik: ${res.error || 'Qo\'shib bo\'lmadi'} ❌`, true);
    }
}

async function submitAddKvadrat(e) {
    e.preventDefault();
    const sana = document.getElementById('addKvDate').value;
    const orderNo = document.getElementById('addKvNo').value;
    const orderName = document.getElementById('addKvName').value;
    const totalM2 = Number(document.getElementById('addKvM2').value || 0);
    const month = document.getElementById('addKvMonth').value;
    const year = document.getElementById('addKvYear').value;
    const staffName = document.getElementById('addKvStaff').value;

    showStatus('💾 SQLite kvadratlar jadvaliga yozilmoqda...');
    closeAddModal();

    const res = await apiRequest('kvadrat_add', {
        sana,
        no: orderNo,
        orderName,
        totalM2,
        month,
        year,
        staffName
    });

    if (res && res.success) {
        showToast('Yangi buyurtma SQLite bazasida saqlandi ✅');
        loadAllData();
    } else {
        showToast(`Xatolik: ${res.error || 'Qo\'shib bo\'lmadi'} ❌`, true);
    }
}

async function submitAddHodim(e) {
    e.preventDefault();
    const tgId = document.getElementById('addEmpTgId').value.trim();
    const username = document.getElementById('addEmpName').value.trim();
    const role = document.getElementById('addEmpRole').value;
    const lavozim = document.getElementById('addEmpLavozim').value.trim();
    const guruh = document.getElementById('addEmpGuruh').value.trim();

    showStatus('💾 SQLite employees jadvaliga yozilmoqda...');
    closeAddModal();

    const res = await apiRequest('add_hodim', {
        tgId,
        username,
        role,
        lavozim,
        guruh
    });

    if (res && res.success) {
        showToast('Yangi xodim SQLite bazasida saqlandi ✅');
        loadAllData();
    } else {
        showToast(`Xatolik: ${res.error || 'Qo\'shib bo\'lmadi'} ❌`, true);
    }
}

async function submitAddSetting(e) {
    e.preventDefault();
    const key = document.getElementById('addSetKey').value.trim();
    const value = document.getElementById('addSetVal').value.trim();

    showStatus('💾 SQLite global_settings jadvaliga yozilmoqda...');
    closeAddModal();

    const res = await apiRequest('set_global_setting', { key, value });

    if (res && res.success) {
        showToast('Sozlama SQLite bazasida saqlandi ✅');
        loadAllData();
    } else {
        showToast(`Xatolik: ${res.error || 'Qo\'shib bo\'lmadi'} ❌`, true);
    }
}

// ─────────────────────────────────────────────────────────────
// EXCEL EXPORT (SheetJS or CSV fallback)
// ─────────────────────────────────────────────────────────────
function exportToExcel() {
    let filename = `Aristokrat_${SheetsApp.activeTab}_${new Date().toISOString().slice(0,10)}.xlsx`;
    let dataToExport = [];

    if (SheetsApp.activeTab === 'dataSheet') {
        dataToExport = SheetsApp.data.records.map(r => ({
            "ID": r.id,
            "Sana": r.date,
            "Hodim Ismi": r.name,
            "Telegram ID": r.telegram_id || r.telegramId,
            "Summa (UZS)": r.amount_uzs || r.amountUZS || 0,
            "Summa (USD)": r.amount_usd || r.amountUSD || 0,
            "Kurs": r.rate || 0,
            "Davr / Oy": r.action_period || r.actionPeriod,
            "Holat": r.status || 'Tasdiqlandi',
            "Izoh": r.comment || '',
            "Kiritgan": r.actor_name || r.actorName || ''
        }));
    } else if (SheetsApp.activeTab === 'Kvadratlar') {
        dataToExport = SheetsApp.data.kvadratlar.map(k => ({
            "ID": k.id,
            "Sana": k.sana,
            "Buyurtma №": k.order_no,
            "Buyurtma Nomi": k.order_name,
            "Maydon (m²)": k.total_m2 || 0,
            "Oy": k.oy,
            "Yil": k.yil,
            "Mulkdor ID": k.owner_tg_id,
            "Xodim": k.staff_name,
            "Bosqich": k.current_step || 1,
            "Holat": k.status || 'yangi'
        }));
    } else if (SheetsApp.activeTab === 'Hodimlar') {
        dataToExport = SheetsApp.data.employees.map(e => ({
            "Telegram ID": e.telegram_id || e.tgId,
            "Ism": e.username,
            "Rol": e.roleKey || e.role,
            "Lavozimlar": e.lavozim,
            "Guruh": e.guruh,
            "Sardor": e.is_sardor || e.isSardor ? 1 : 0,
            "Qo'shish": e.can_add || e.canAdd ? 1 : 0,
            "Barchasini ko'rish": e.can_view_all || e.canViewAll ? 1 : 0,
            "Tahrirlash": e.can_edit || e.canEdit ? 1 : 0,
            "O'chirish": e.can_delete || e.canDelete ? 1 : 0,
            "Eksport": e.can_export || e.canExport ? 1 : 0
        }));
    } else if (SheetsApp.activeTab === 'Sozlamalar') {
        dataToExport = SheetsApp.data.settings.map(s => ({
            "Kalit": s.key,
            "Qiymat": s.value
        }));
    }

    if (!dataToExport.length) {
        showToast('Eksport qilish uchun ma\'lumot yo\'q ⚠️', true);
        return;
    }

    if (window.XLSX) {
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, SheetsApp.activeTab);
        XLSX.writeFile(wb, filename);
        showToast('Excel fayl yuklab olindi ✅');
    } else {
        // Fallback: CSV yuklash
        const keys = Object.keys(dataToExport[0]);
        const csvContent = "\uFEFF" + [
            keys.join(','),
            ...dataToExport.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
        ].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename.replace('.xlsx', '.csv'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV fayl yuklab olindi ✅');
    }
}

// ─────────────────────────────────────────────────────────────
// QIDIRUV VA SARALASH (SORT & FILTER HELPERS)
// ─────────────────────────────────────────────────────────────
function sortTable(column) {
    if (SheetsApp.sort.column === column) {
        SheetsApp.sort.order = SheetsApp.sort.order === 'asc' ? 'desc' : 'asc';
    } else {
        SheetsApp.sort.column = column;
        SheetsApp.sort.order = 'asc';
    }
    renderActiveTable();
}

function getSortIcon(column) {
    if (SheetsApp.sort.column !== column) return '';
    return SheetsApp.sort.order === 'asc' ? '▲' : '▼';
}

// ── Foydali Yordamchilar (Utility Functions) ─────────────────
function formatMoney(num) {
    if (!num && num !== 0) return '0';
    return Number(num).toLocaleString('uz-UZ').replace(/,/g, ' ');
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function snakeToCamel(s) {
    return s.replace(/(_\w)/g, m => m[1].toUpperCase());
}

function showStatus(text) {
    const el = document.getElementById('gsStatusText');
    if (el) el.textContent = text;
}

function setSyncIndicator(active) {
    const dot = document.getElementById('gsDbDot');
    if (dot) {
        dot.style.background = active ? '#eab308' : 'var(--gs-green)';
    }
}

function showToast(msg, isError = false) {
    const container = document.getElementById('gsToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `gs-toast ${isError ? 'error' : ''}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initTheme() {
    const saved = localStorage.getItem('gs_theme');
    if (saved === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('gs_theme', 'light');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('gs_theme', 'dark');
    }
}

function returnToApp() {
    if (window.parent && window.parent !== window) {
        window.parent.location.href = 'index.html';
    } else {
        window.location.href = 'index.html';
    }
}
