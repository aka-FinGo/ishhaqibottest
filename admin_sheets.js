/**
 * admin_sheets.js — Google Sheets Uslubidagi Admin Panel
 * Aristokrat Ish Haqi & Kvadratlar
 * 
 * Barcha katakcha o'zgarishlari to'g'ridan-to'g'ri SQLite bazasiga saqlanadi!
 */

// ── Global Boshqaruv Holati (State) ─────────────────────────
const SheetsApp = {
    activeTab: 'dataSheet', // 'dataSheet' | 'Kvadratlar' | 'Hodimlar' | 'Sozlamalar' | 'AI_Providers'
    isLoaded: false,
    auth: {
        telegramId: '', // Telegram orqali aniqlanadi (xavfsizlik uchun default bo'sh)
        username: '',
        role: 'EMPLOYEE',
        isSuperAdmin: false,
        canEdit: false,
        canDelete: false,
        initData: ''
    },
    data: {
        records: [],
        kvadratlar: [],
        employees: [],
        settings: [],
        aiProviders: [],
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
    const isStandalone = window.location.pathname.includes('admin_sheets.html');
    if (isStandalone) {
        // Mustaqil sahifa: ochiq internetdan himoya qilish
        if (!checkAccessGuard()) return;
        initAuth();
        initTheme();
        setupEventListeners();
        setupRealtimeListeners();
        loadAllData();
    } else {
        // index.html ichida embed rejimida: event listenerlarni tayyorlash
        initTheme();
        setupEventListeners();
        setupRealtimeListeners();
    }
});

// WebApp ichidan chaqiriladigan asosiy yuklash funksiyasi
window.initSheetsApp = function() {
    initAuth();
    if (!SheetsApp.isLoaded) {
        loadAllData();
    } else {
        renderActiveTable();
    }
};

// Telegram yoki Desktop Auth aniqlash
function initAuth() {
    let initData = '';

    // 1. Hash dan (#tgWebAppData=...)
    if (window.location.hash.includes('tgWebAppData=')) {
        try {
            const hashStr = window.location.hash.substring(1);
            const hashParams = new URLSearchParams(hashStr);
            initData = hashParams.get('tgWebAppData') || '';
        } catch(e) {}
    }

    // 2. Telegram WebApp obyekti orqali (o'zi yoki ota oyna orqali)
    const tg = window.Telegram?.WebApp || (window.parent && window.parent !== window ? window.parent.Telegram?.WebApp : null);
    if (tg) {
        tg.expand && tg.expand();
        tg.setHeaderColor && tg.setHeaderColor('#0F172A');
        if (tg.initData && !initData) {
            initData = tg.initData;
        }
        if (tg.initDataUnsafe?.user?.id) {
            SheetsApp.auth.telegramId = String(tg.initDataUnsafe.user.id);
            SheetsApp.auth.username = tg.initDataUnsafe.user.username || 
                `${tg.initDataUnsafe.user.first_name || ''} ${tg.initDataUnsafe.user.last_name || ''}`.trim() || 'Foydalanuvchi';
        }
    }

    if (initData) {
        SheetsApp.auth.initData = initData;
    }

    // 3. URL parametrlari orqali tekshirish
    const params = new URLSearchParams(window.location.search);
    if (params.has('tgId') && !SheetsApp.auth.telegramId) {
        SheetsApp.auth.telegramId = params.get('tgId');
    }

    // Foydalanuvchi nomi qoidasi: Agar iRealBy_3D bo'lsa
    if (SheetsApp.auth.telegramId === '2112012311') {
        SheetsApp.auth.username = 'iRealBy_3D';
        SheetsApp.auth.isSuperAdmin = true;
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
            SheetsApp.data.records = (recRes.data || []).map(r => ({
                id: r.rowId || r.id,
                rowId: r.rowId || r.id,
                name: r.name || '',
                telegram_id: String(r.telegram_id || r.telegramId || ''),
                telegramId: String(r.telegram_id || r.telegramId || ''),
                amount_uzs: Number(r.amount_uzs ?? r.amountUZS ?? 0),
                amountUZS: Number(r.amount_uzs ?? r.amountUZS ?? 0),
                amount_usd: Number(r.amount_usd ?? r.amountUSD ?? 0),
                amountUSD: Number(r.amount_usd ?? r.amountUSD ?? 0),
                rate: Number(r.rate || 0),
                comment: r.comment || '',
                date: r.date || '',
                action_period: r.action_period || r.actionPeriod || '',
                actionPeriod: r.action_period || r.actionPeriod || '',
                status: r.status || 'Tasdiqlandi',
                actor_name: r.actor_name || r.actorName || '',
                actorName: r.actor_name || r.actorName || ''
            }));
        }

        if (kvRes && kvRes.success) {
            SheetsApp.data.kvadratlar = (kvRes.data || []).map(k => ({
                id: k.rowId || k.id,
                rowId: k.rowId || k.id,
                date: k.date || k.sana || '',
                sana: k.date || k.sana || '',
                no: k.no || k.order_no || String(k.rowId || k.id || ''),
                order_no: k.no || k.order_no || String(k.rowId || k.id || ''),
                orderName: k.orderName || k.order_name || '',
                order_name: k.orderName || k.order_name || '',
                totalM2: Number(k.totalM2 ?? k.total_m2 ?? 0),
                total_m2: Number(k.totalM2 ?? k.total_m2 ?? 0),
                month: String(k.month || k.oy || ''),
                oy: String(k.month || k.oy || ''),
                year: String(k.year || k.yil || ''),
                yil: String(k.year || k.yil || ''),
                ownerTgId: String(k.ownerTgId || k.owner_tg_id || ''),
                owner_tg_id: String(k.ownerTgId || k.owner_tg_id || ''),
                staffName: k.staffName || k.staff_name || '',
                staff_name: k.staffName || k.staff_name || '',
                currentStep: Number(k.currentStep ?? k.current_step ?? 1),
                current_step: Number(k.currentStep ?? k.current_step ?? 1),
                status: k.status || 'yangi',
                logs: k.logs || []
            }));
        }

        SheetsApp.isLoaded = true;

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

            // AI_PROVIDERS_CONFIG ni alohida ustunlar uchun parse qilish
            const aiSetting = SheetsApp.data.settings.find(s => s.key === 'AI_PROVIDERS_CONFIG');
            if (aiSetting && aiSetting.value) {
                try {
                    const parsed = JSON.parse(aiSetting.value);
                    SheetsApp.data.aiProviders = Array.isArray(parsed) ? parsed : (parsed.all || []);
                } catch(e) {
                    SheetsApp.data.aiProviders = [];
                }
            } else {
                // Agar global_settings da bo'lmasa, ai_get_config orqali tekshirish
                try {
                    const aiRes = await apiRequest('ai_get_config');
                    if (aiRes && aiRes.success && aiRes.config) {
                        SheetsApp.data.aiProviders = aiRes.config.all || [];
                    }
                } catch(e) {}
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

// ── Realtime Sinxronizatsiya Tinglovchisi ────────────────────
function setupRealtimeListeners() {
    if (typeof RealtimeSync === 'undefined') return;

    const refreshRecords = RealtimeSync.debounce(async () => {
        if (SheetsApp.editingCell) return;
        try {
            const recRes = await apiRequest('admin_get_all');
            if (recRes && recRes.success) {
                SheetsApp.data.records = (recRes.data || []).map(r => ({
                    id: r.rowId || r.id,
                    rowId: r.rowId || r.id,
                    name: r.name || '',
                    telegram_id: String(r.telegram_id || r.telegramId || ''),
                    telegramId: String(r.telegram_id || r.telegramId || ''),
                    amount_uzs: Number(r.amount_uzs ?? r.amountUZS ?? 0),
                    amountUZS: Number(r.amount_uzs ?? r.amountUZS ?? 0),
                    amount_usd: Number(r.amount_usd ?? r.amountUSD ?? 0),
                    amountUSD: Number(r.amount_usd ?? r.amountUSD ?? 0),
                    rate: Number(r.rate || 0),
                    comment: r.comment || '',
                    date: r.date || '',
                    action_period: r.action_period || r.actionPeriod || '',
                    actionPeriod: r.action_period || r.actionPeriod || '',
                    status: r.status || 'Tasdiqlandi',
                    actor_name: r.actor_name || r.actorName || '',
                    actorName: r.actor_name || r.actorName || ''
                }));
                updateTabBadges();
                if (SheetsApp.activeTab === 'dataSheet') {
                    const container = document.querySelector('.gs-table-container');
                    const sLeft = container ? container.scrollLeft : 0;
                    const sTop = container ? container.scrollTop : 0;
                    renderDataSheetTable();
                    if (container) {
                        container.scrollLeft = sLeft;
                        container.scrollTop = sTop;
                    }
                }
                showStatus('🟢 Jonli yangilandi (Realtime)');
            }
        } catch (e) {
            console.warn('[Realtime refresh error]', e);
        }
    }, 300);

    const refreshKvadratlar = RealtimeSync.debounce(async () => {
        if (SheetsApp.editingCell) return;
        try {
            const kvRes = await apiRequest('kvadrat_get_all');
            if (kvRes && kvRes.success) {
                SheetsApp.data.kvadratlar = (kvRes.data || []).map(k => ({
                    id: k.rowId || k.id,
                    rowId: k.rowId || k.id,
                    date: k.date || k.sana || '',
                    sana: k.date || k.sana || '',
                    no: k.no || k.order_no || String(k.rowId || k.id || ''),
                    order_no: k.no || k.order_no || String(k.rowId || k.id || ''),
                    orderName: k.orderName || k.order_name || '',
                    order_name: k.orderName || k.order_name || '',
                    totalM2: Number(k.totalM2 ?? k.total_m2 ?? 0),
                    total_m2: Number(k.totalM2 ?? k.total_m2 ?? 0),
                    month: String(k.month || k.oy || ''),
                    oy: String(k.month || k.oy || ''),
                    year: String(k.year || k.yil || ''),
                    yil: String(k.year || k.yil || ''),
                    ownerTgId: String(k.ownerTgId || k.owner_tg_id || ''),
                    owner_tg_id: String(k.ownerTgId || k.owner_tg_id || ''),
                    staffName: k.staffName || k.staff_name || '',
                    staff_name: k.staffName || k.staff_name || '',
                    currentStep: Number(k.currentStep ?? k.current_step ?? 1),
                    current_step: Number(k.currentStep ?? k.current_step ?? 1),
                    status: k.status || 'yangi',
                    logs: k.logs || []
                }));
                updateTabBadges();
                if (SheetsApp.activeTab === 'Kvadratlar') {
                    const container = document.querySelector('.gs-table-container');
                    const sLeft = container ? container.scrollLeft : 0;
                    const sTop = container ? container.scrollTop : 0;
                    renderKvadratlarTable();
                    if (container) {
                        container.scrollLeft = sLeft;
                        container.scrollTop = sTop;
                    }
                }
                showStatus('🟢 Jonli yangilandi (Realtime)');
            }
        } catch (e) {}
    }, 300);

    const refreshEmployees = RealtimeSync.debounce(async () => {
        if (SheetsApp.editingCell) return;
        try {
            const empRes = await apiRequest('get_hodimlar');
            if (empRes && empRes.success) {
                SheetsApp.data.employees = empRes.data || [];
                updateTabBadges();
                if (SheetsApp.activeTab === 'Hodimlar') {
                    renderHodimlarTable();
                }
                showStatus('🟢 Jonli yangilandi (Realtime)');
            }
        } catch (e) {}
    }, 300);

    const refreshSettings = RealtimeSync.debounce(async () => {
        if (SheetsApp.editingCell) return;
        try {
            const setRes = await apiRequest('get_global_settings');
            if (setRes && setRes.success) {
                if (Array.isArray(setRes.settings?.allList)) {
                    SheetsApp.data.settings = setRes.settings.allList;
                }
                if (SheetsApp.activeTab === 'Sozlamalar' || SheetsApp.activeTab === 'AI_Providers') {
                    renderActiveTable();
                }
                showStatus('🟢 Jonli yangilandi (Realtime)');
            }
        } catch (e) {}
    }, 300);

    RealtimeSync.on('records', refreshRecords);
    RealtimeSync.on('kvadratlar', refreshKvadratlar);
    RealtimeSync.on('employees', refreshEmployees);
    RealtimeSync.on('settings', refreshSettings);
    RealtimeSync.on('workflow', refreshKvadratlar);
    RealtimeSync.on('positions', refreshKvadratlar);

    RealtimeSync.onStatusChange((connected) => {
        if (connected) {
            showStatus('🟢 Realtime: Jonli ulangan');
        } else {
            showStatus('🟡 Qayta ulanmoqda...');
        }
    });
}

// ── Tab Badges (Hisoblagichlar) ─────────────────────────────
function updateTabBadges() {
    const bRecords = document.getElementById('badgeRecords');
    const bKv = document.getElementById('badgeKvadratlar');
    const bEmp = document.getElementById('badgeHodimlar');
    const bSet = document.getElementById('badgeSettings');
    const bAi = document.getElementById('badgeAIProviders');

    if (bRecords) bRecords.textContent = SheetsApp.data.records.length;
    if (bKv) bKv.textContent = SheetsApp.data.kvadratlar.length;
    if (bEmp) bEmp.textContent = SheetsApp.data.employees.length;
    if (bSet) bSet.textContent = SheetsApp.data.settings.filter(s => s.key !== 'AI_PROVIDERS_CONFIG').length;
    if (bAi) bAi.textContent = SheetsApp.data.aiProviders.length;
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
        const years = [...new Set(SheetsApp.data.kvadratlar.map(k => k.year).filter(Boolean))].sort().reverse();
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
        const months = [...new Set(SheetsApp.data.kvadratlar.map(k => k.month).filter(Boolean))];
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
        case 'AI_Providers':
            renderAIProvidersTable();
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

    // Qidiruv va filtrlar — API camelCase: orderName, no, staffName, date, ownerTgId
    const search = SheetsApp.filters.search.toLowerCase().trim();
    if (search) {
        items = items.filter(k => {
            return (k.orderName && k.orderName.toLowerCase().includes(search)) ||
                   (k.no && String(k.no).toLowerCase().includes(search)) ||
                   (k.staffName && k.staffName.toLowerCase().includes(search)) ||
                   (k.date && k.date.toLowerCase().includes(search)) ||
                   (k.ownerTgId && String(k.ownerTgId).includes(search));
        });
    }
    if (SheetsApp.filters.status) {
        items = items.filter(k => (k.status || 'yangi') === SheetsApp.filters.status);
    }
    if (SheetsApp.filters.year) {
        items = items.filter(k => String(k.year) === SheetsApp.filters.year);
    }
    if (SheetsApp.filters.month) {
        items = items.filter(k => String(k.month) === SheetsApp.filters.month);
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
            <th onclick="sortTable('rowId')">ID ${getSortIcon('rowId')}</th>
            <th onclick="sortTable('date')">Sana 📅 ${getSortIcon('date')}</th>
            <th onclick="sortTable('no')">№ ${getSortIcon('no')}</th>
            <th onclick="sortTable('orderName')">Buyurtma Nomi 🏷 ${getSortIcon('orderName')}</th>
            <th onclick="sortTable('totalM2')" style="text-align:right;">Maydon (m²) 📐 ${getSortIcon('totalM2')}</th>
            <th onclick="sortTable('month')">Oy 🗓 ${getSortIcon('month')}</th>
            <th onclick="sortTable('year')">Yil 📅 ${getSortIcon('year')}</th>
            <th onclick="sortTable('ownerTgId')">Mulkdor ID 🆔 ${getSortIcon('ownerTgId')}</th>
            <th onclick="sortTable('staffName')">Xodim 👤 ${getSortIcon('staffName')}</th>
            <th onclick="sortTable('currentStep')">Bosqich ⚡ ${getSortIcon('currentStep')}</th>
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
        const m2 = Number(k.totalM2 || 0);
        totalM2 += m2;
        const id = k.rowId || k.id;
        const statusStr = k.status || 'yangi';
        let badgeClass = 'gs-badge-kutilmoqda';
        if (statusStr.toLowerCase().includes('bajarildi') || statusStr.toLowerCase().includes('yakunlandi')) {
            badgeClass = 'gs-badge-tasdiqlandi';
        }

        return `
            <tr data-row-id="${id}">
                <td class="gs-col-row-num">${idx + 1}</td>
                <td style="color: var(--gs-text-muted); font-size:11px;">#${id}</td>
                <td class="gs-cell-editable" data-col="date" data-id="${id}" data-type="date" title="2 marta bosing">${escapeHtml(k.date || '')}</td>
                <td class="gs-cell-editable" data-col="no" data-id="${id}" data-type="text" title="2 marta bosing" style="font-weight:700;">${escapeHtml(k.no || '—')}</td>
                <td class="gs-cell-editable" data-col="orderName" data-id="${id}" data-type="text" title="2 marta bosing"><b>${escapeHtml(k.orderName || '')}</b></td>
                <td class="gs-cell-editable gs-num" data-col="totalM2" data-id="${id}" data-type="number" title="2 marta bosing" style="font-weight:800; color: #0284c7;">${m2.toLocaleString('uz-UZ', {minimumFractionDigits: 1, maximumFractionDigits: 2})} m²</td>
                <td class="gs-cell-editable" data-col="month" data-id="${id}" data-type="text" title="2 marta bosing">${escapeHtml(k.month || '—')}</td>
                <td class="gs-cell-editable" data-col="year" data-id="${id}" data-type="text" title="2 marta bosing">${escapeHtml(k.year || '—')}</td>
                <td class="gs-cell-editable" data-col="ownerTgId" data-id="${id}" data-type="text" title="2 marta bosing" style="font-family: var(--gs-mono); font-size:11.5px;">${escapeHtml(k.ownerTgId || '')}</td>
                <td class="gs-cell-editable" data-col="staffName" data-id="${id}" data-type="text" title="2 marta bosing">${escapeHtml(k.staffName || '—')}</td>
                <td class="gs-cell-editable" data-col="currentStep" data-id="${id}" data-type="select-step" title="2 marta bosing" style="text-align:center;">
                    <span style="font-weight:700; background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 8px; border-radius:6px;">Bosqich ${k.currentStep || 1}</span>
                </td>
                <td class="gs-cell-editable" data-col="status" data-id="${id}" data-type="select-kv-status" title="2 marta bosing">
                    <span class="gs-status-badge ${badgeClass}">${escapeHtml(statusStr)}</span>
                </td>
                <td style="text-align:center;">
                    <div class="gs-row-actions" style="justify-content:center;">
                        <button class="gs-act-btn gs-act-btn-del" onclick="deleteKvadratPrompt(${id}, '${escapeHtml(k.orderName || '')}')" title="O'chirish">🗑</button>
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

    // AI_PROVIDERS_CONFIG ni oddiy sozlamalar jadvalidan ajratamiz (chunki u ulkan JSON va alohida AI varag'ida ustunlar bo'yicha ko'rsatiladi)
    let items = SheetsApp.data.settings.filter(s => s.key !== 'AI_PROVIDERS_CONFIG');

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

    let aiBanner = `
        <tr style="background: rgba(14,165,233,0.08); border-bottom: 2px solid rgba(14,165,233,0.3);">
            <td class="gs-col-row-num" style="background: rgba(14,165,233,0.15); font-weight:bold; color:#0284c7;">AI</td>
            <td style="font-family: var(--gs-mono); font-weight:800; color: #0284c7;">🤖 AI_PROVIDERS_CONFIG</td>
            <td>
                <span class="gs-badge" style="background:rgba(2,132,199,0.15); color:#0284c7; font-weight:700; padding:3px 8px; border-radius:6px;">
                    ${SheetsApp.data.aiProviders.length} ta provayder sozlangan
                </span>
            </td>
            <td style="color: var(--gs-text); font-size:12px;">
                AI provayderlar (Groq, Gemini, OpenRouter, Ollama) alohida ustunlarga ajratilgan maxsus varaqda boshqariladi.
            </td>
            <td style="text-align:center;">
                <button class="gs-btn gs-btn-primary" onclick="switchSheet('AI_Providers')" style="font-size:11px; white-space:nowrap;">
                    Ochish ➔
                </button>
            </td>
        </tr>
    `;

    if (!items.length) {
        tbody.innerHTML = aiBanner + `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--gs-text-muted);">Boshqa sozlamalar topilmadi</td></tr>`;
        updateStatsBar(0);
        return;
    }

    tbody.innerHTML = aiBanner + items.map((s, idx) => {
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

// ─────────────────────────────────────────────────────────────
// 5. AI Provayderlar (AI_PROVIDERS_CONFIG — Alohida Ustunlar)
// ─────────────────────────────────────────────────────────────
function renderAIProvidersTable() {
    const thead = document.getElementById('gsThead');
    const tbody = document.getElementById('gsTbody');
    if (!thead || !tbody) return;

    let items = [...(SheetsApp.data.aiProviders || [])];

    // Qidiruv
    const search = SheetsApp.filters.search.toLowerCase().trim();
    if (search) {
        items = items.filter(p => {
            return (p.provider && p.provider.toLowerCase().includes(search)) ||
                   (p.model && p.model.toLowerCase().includes(search)) ||
                   (p.baseURL && p.baseURL.toLowerCase().includes(search));
        });
    }

    // Priority bo'yicha saralash
    items.sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99));

    thead.innerHTML = `
        <tr>
            <th class="gs-col-row-num">#</th>
            <th style="width: 140px;">🤖 Provayder</th>
            <th style="width: 200px;">🧠 Model</th>
            <th style="width: 180px;">🔑 API Kalit</th>
            <th style="width: 90px; text-align:center;">⭐ Tartib</th>
            <th style="width: 110px; text-align:center;">⚡ Holat</th>
            <th style="width: 240px;">🌐 Base URL</th>
            <th>📝 Tizim Ko'rsatmasi (Prompt)</th>
            <th style="text-align:center; width: 130px;">⚙️ Amallar</th>
        </tr>
    `;

    if (!items.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding: 40px; color: var(--gs-text-muted);">
                    <div style="font-size:28px; margin-bottom:8px;">🤖</div>
                    Hozircha AI provayderlar kiritilmagan.<br>
                    <button class="gs-btn gs-btn-primary" style="margin-top:12px;" onclick="openAddModal()">➕ Yangi AI Provayder qo'shish</button>
                </td>
            </tr>
        `;
        updateStatsBar(0);
        return;
    }

    tbody.innerHTML = items.map((p, idx) => {
        const maskedKey = p.apiKey ? (p.apiKey.length > 12 ? p.apiKey.substring(0, 6) + '...' + p.apiKey.substring(p.apiKey.length - 4) : '••••••••') : '<i style="color:var(--gs-red);">Yo\'q</i>';
        const isActive = !!p.isActive;
        const promptPreview = p.customPrompt ? (p.customPrompt.length > 45 ? escapeHtml(p.customPrompt.substring(0, 45)) + '...' : escapeHtml(p.customPrompt)) : '<i style="color:var(--gs-text-muted);">Standart prompt</i>';

        return `
            <tr data-ai-provider="${escapeHtml(p.provider)}">
                <td class="gs-col-row-num">${idx + 1}</td>
                <td style="font-weight:800; color:var(--gs-green-dark); font-size:13px;">
                    🤖 ${escapeHtml(p.provider)}
                </td>
                <td style="font-family:var(--gs-mono); font-weight:600; color:var(--gs-text);">
                    ${escapeHtml(p.model || '—')}
                </td>
                <td style="font-family:var(--gs-mono); font-size:12px;">
                    <code>${maskedKey}</code>
                </td>
                <td style="text-align:center; font-weight:700;">
                    <span class="gs-badge" style="background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 8px; border-radius:6px;">
                        ${p.priority || (idx + 1)}
                    </span>
                </td>
                <td style="text-align:center;">
                    <span class="gs-status-badge ${isActive ? 'gs-badge-tasdiqlandi' : 'gs-badge-rad'}" 
                          style="cursor:pointer;" 
                          title="Holatni almashtirish uchun bosing"
                          onclick="toggleAIProviderActive('${escapeHtml(p.provider)}')">
                        ${isActive ? 'Faol ✅' : 'Nofaol ❌'}
                    </span>
                </td>
                <td style="font-size:12px; color:var(--gs-text-muted); font-family:var(--gs-mono);" title="${escapeHtml(p.baseURL || '')}">
                    ${escapeHtml(p.baseURL ? (p.baseURL.length > 30 ? p.baseURL.substring(0, 27) + '...' : p.baseURL) : '—')}
                </td>
                <td style="font-size:12px; color:var(--gs-text-muted);">
                    ${promptPreview}
                </td>
                <td style="text-align:center; white-space:nowrap;">
                    <button class="gs-btn" onclick="openEditAIProviderModal('${escapeHtml(p.provider)}')" title="Tahrirlash">✏️</button>
                    <button class="gs-btn" style="color:var(--gs-red);" onclick="deleteAIProvider('${escapeHtml(p.provider)}')" title="O'chirish">🗑</button>
                </td>
            </tr>
        `;
    }).join('');

    updateStatsBar(items.length);
}

async function toggleAIProviderActive(providerName) {
    const prov = SheetsApp.data.aiProviders.find(p => p.provider === providerName);
    if (!prov) return;
    prov.isActive = !prov.isActive;
    await saveAIProvidersToDB();
}

async function deleteAIProvider(providerName) {
    if (!confirm(`Haqiqatan ham "${providerName}" AI provayderini o'chirmoqchimisiz?`)) return;
    SheetsApp.data.aiProviders = SheetsApp.data.aiProviders.filter(p => p.provider !== providerName);
    await saveAIProvidersToDB();
    showToast(`"${providerName}" o'chirildi ✅`);
}

async function saveAIProvidersToDB() {
    showStatus('💾 SQLite AI_PROVIDERS_CONFIG saqlanmoqda...');
    setSyncIndicator(true);
    const activeList = SheetsApp.data.aiProviders.filter(p => p.isActive && p.apiKey);
    activeList.sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99));

    const payload = {
        all: SheetsApp.data.aiProviders,
        active: activeList
    };

    const res = await apiRequest('set_global_setting', {
        key: 'AI_PROVIDERS_CONFIG',
        value: JSON.stringify(payload)
    });

    setSyncIndicator(false);
    if (res && res.success) {
        showToast('AI Provayderlar konfiguratsiyasi SQLite ga saqlandi ✅');
        showStatus('SQLite WAL Baza: Sinxronlangan');
        updateTabBadges();
        renderActiveTable();
    } else {
        showToast(`Xatolik: ${res.error || 'Saqlab bo\'lmadi'} ❌`, true);
    }
}

function openEditAIProviderModal(providerName) {
    const p = SheetsApp.data.aiProviders.find(x => x.provider === providerName);
    if (!p) return;

    const modal = document.getElementById('gsAddModal');
    const title = document.getElementById('gsModalTitle');
    const body = document.getElementById('gsModalBody');
    if (!modal || !body) return;

    modal.style.display = 'flex';
    title.textContent = `✏️ AI Provayder: ${p.provider}`;

    body.innerHTML = `
        <form id="gsEditAIForm" onsubmit="submitSaveAIProvider(event, '${escapeHtml(p.provider)}')">
            <div class="gs-form-group">
                <label>Provayder Nomi:</label>
                <input type="text" id="editAiProviderName" class="gs-form-input" value="${escapeHtml(p.provider)}" readonly style="opacity:0.8; font-weight:700;">
            </div>
            <div class="gs-form-group">
                <label>Model Nomi:</label>
                <input type="text" id="editAiModel" class="gs-form-input" value="${escapeHtml(p.model || '')}" placeholder="groq/compound, gemini-2.5-flash..." required>
            </div>
            <div class="gs-form-group">
                <label>API Kalit (API Key):</label>
                <input type="text" id="editAiKey" class="gs-form-input" value="${escapeHtml(p.apiKey || '')}" placeholder="sk-... yoki gsk_...">
            </div>
            <div style="display:flex; gap:10px;">
                <div class="gs-form-group" style="flex:1;">
                    <label>Tartib (Priority):</label>
                    <select id="editAiPriority" class="gs-form-select">
                        ${[1,2,3,4,5,6,7,8,9,10].map(num => `<option value="${num}" ${p.priority == num ? 'selected' : ''}>${num}${num === 1 ? ' (Birlamchi)' : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="gs-form-group" style="flex:1;">
                    <label>Holat (Faollik):</label>
                    <select id="editAiActive" class="gs-form-select">
                        <option value="1" ${p.isActive ? 'selected' : ''}>Faol ✅</option>
                        <option value="0" ${!p.isActive ? 'selected' : ''}>Nofaol ❌</option>
                    </select>
                </div>
            </div>
            <div class="gs-form-group">
                <label>Base URL (API Manzili):</label>
                <input type="text" id="editAiBaseUrl" class="gs-form-input" value="${escapeHtml(p.baseURL || '')}" placeholder="https://api...">
            </div>
            <div class="gs-form-group">
                <label>Tizim Ko'rsatmasi (System Prompt):</label>
                <textarea id="editAiPrompt" class="gs-form-textarea" rows="3" placeholder="Sen kuchli AI yordamchisisan...">${escapeHtml(p.customPrompt || '')}</textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
            </div>
        </form>
    `;
}

async function submitSaveAIProvider(e, originalProviderName) {
    e.preventDefault();
    const prov = SheetsApp.data.aiProviders.find(p => p.provider === originalProviderName);
    if (!prov) return;

    prov.model = document.getElementById('editAiModel').value.trim();
    prov.apiKey = document.getElementById('editAiKey').value.trim();
    prov.priority = parseInt(document.getElementById('editAiPriority').value, 10) || 1;
    prov.isActive = document.getElementById('editAiActive').value === '1';
    prov.baseURL = document.getElementById('editAiBaseUrl').value.trim();
    prov.customPrompt = document.getElementById('editAiPrompt').value;

    closeAddModal();
    await saveAIProvidersToDB();
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
    } else if (SheetsApp.activeTab === 'AI_Providers') {
        const activeCount = SheetsApp.data.aiProviders.filter(p => p.isActive).length;
        html += `
            <div class="gs-stat-item">Faol provayderlar: <b style="color:var(--gs-green-dark);">${activeCount} ta</b></div>
            <div class="gs-stat-item">Nofaol: <b style="color:var(--gs-text-muted);">${SheetsApp.data.aiProviders.length - activeCount} ta</b></div>
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
        const kv = SheetsApp.data.kvadratlar.find(k => String(k.rowId || k.id) === String(rowId));
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
        const payload = { rowId: parseInt(rowId, 10) };
        // colName endi camelCase: date, no, orderName, totalM2, month, year, ownerTgId, staffName, currentStep, status
        if (colName === 'totalM2') payload.totalM2 = newVal;
        else if (colName === 'no') payload.no = newVal;
        else if (colName === 'orderName') payload.orderName = newVal;
        else if (colName === 'staffName') payload.staffName = newVal;
        else if (colName === 'currentStep') payload.currentStep = newVal;
        else if (colName === 'date') payload.sana = newVal;
        else if (colName === 'month') payload.month = newVal;
        else if (colName === 'year') payload.year = newVal;
        else if (colName === 'ownerTgId') payload.ownerTgId = newVal;
        else payload[colName] = newVal;

        res = await apiRequest('kvadrat_edit', payload);

        if (res && res.success) {
            // rowId yoki id orqali topish
            const kv = SheetsApp.data.kvadratlar.find(k => String(k.rowId || k.id) === String(rowId));
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
        if (typeof RealtimeSync !== 'undefined') {
            const tbl = SheetsApp.activeTab === 'dataSheet' ? 'records' :
                        SheetsApp.activeTab === 'Kvadratlar' ? 'kvadratlar' :
                        SheetsApp.activeTab === 'Hodimlar' ? 'employees' : 'settings';
            RealtimeSync.notifyLocalChange(tbl, 'edit', { rowId, colName, newVal });
        }
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
    const numId = parseInt(id, 10);
    if (!numId || isNaN(numId)) {
        showToast("Xatolik: Yozuv ID aniqlanmadi ❌", true);
        return;
    }
    if (!confirm(`Haqiqatan ham #${numId} — "${name}" moliyaviy yozuvini o'chirmoqchimisiz? (SQLite records)`)) return;

    showStatus(`🗑 SQLite yozuvi o'chirilmoqda...`);
    const res = await apiRequest('admin_delete', { rowId: numId });
    if (res && res.success) {
        SheetsApp.data.records = SheetsApp.data.records.filter(r => String(r.rowId || r.id) !== String(numId));
        updateTabBadges();
        renderActiveTable();
        showToast(`Yozuv #${numId} o'chirildi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
        // Asosiy WebApp kesh va jadvallari bilan sinxronlash
        if (typeof fullRecords !== 'undefined') {
            fullRecords = fullRecords.filter(r => String(r.rowId || r.id) !== String(numId));
            if (typeof renderReportTable === 'function') renderReportTable();
        }
        if (typeof AppCache !== 'undefined' && AppCache.KEYS?.RECORDS) {
            AppCache.set(AppCache.KEYS.RECORDS, SheetsApp.data.records);
        }
        if (typeof RealtimeSync !== 'undefined') {
            RealtimeSync.notifyLocalChange('records', 'delete', { rowId: numId });
        }
    } else {
        showToast(`Xatolik: ${res.error || 'O\'chirib bo\'lmadi'} ❌`, true);
    }
}

async function deleteKvadratPrompt(id, orderName) {
    const numId = parseInt(id, 10);
    if (!numId || isNaN(numId)) {
        showToast("Xatolik: Buyurtma ID aniqlanmadi ❌", true);
        return;
    }
    if (!confirm(`Haqiqatan ham #${numId} — "${orderName}" buyurtmasini o'chirmoqchimisiz? (SQLite kvadratlar)`)) return;

    showStatus(`🗑 SQLite buyurtmasi o'chirilmoqda...`);
    const res = await apiRequest('kvadrat_delete', { rowId: numId });
    if (res && res.success) {
        SheetsApp.data.kvadratlar = SheetsApp.data.kvadratlar.filter(k => String(k.rowId || k.id) !== String(numId));
        updateTabBadges();
        renderActiveTable();
        showToast(`Buyurtma #${numId} o'chirildi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
        // Asosiy WebApp kesh va jadvallari bilan sinxronlash
        if (typeof kvFullRecords !== 'undefined') {
            kvFullRecords = kvFullRecords.filter(k => String(k.rowId || k.id) !== String(numId));
            if (typeof renderKvadratList === 'function') renderKvadratList(kvFullRecords);
        }
        if (typeof AppCache !== 'undefined' && AppCache.KEYS?.KV_RECORDS) {
            AppCache.set(AppCache.KEYS.KV_RECORDS, SheetsApp.data.kvadratlar);
        }
        if (typeof RealtimeSync !== 'undefined') {
            RealtimeSync.notifyLocalChange('kvadratlar', 'delete', { rowId: numId });
        }
    } else {
        showToast(`Xatolik: ${res.error || 'O\'chirib bo\'lmadi'} ❌`, true);
    }
}

async function deleteHodimPrompt(tgId, username) {
    const cleanId = String(tgId !== undefined && tgId !== null ? tgId : '').trim();
    if (cleanId === '') {
        showToast("Xatolik: Xodim ID topilmadi ❌", true);
        return;
    }
    if (!confirm(`Haqiqatan ham "${username}" (${cleanId}) xodimini o'chirmoqchimisiz? (SQLite employees)`)) return;

    showStatus(`🗑 SQLite xodimi o'chirilmoqda...`);
    const res = await apiRequest('delete_hodim', { tgId: cleanId });
    if (res && res.success) {
        SheetsApp.data.employees = SheetsApp.data.employees.filter(e => String(e.telegram_id || e.tgId) !== cleanId);
        updateTabBadges();
        renderActiveTable();
        showToast(`Xodim o'chirildi ✅`);
        showStatus('SQLite WAL Baza: Sinxronlangan');
        if (typeof RealtimeSync !== 'undefined') {
            RealtimeSync.notifyLocalChange('employees', 'delete', { tgId: cleanId });
        }
    } else {
        showToast(`Xatolik: ${res.error || 'O\'chirib bo\'lmadi'} ❌`, true);
    }
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// YANGI QATOR QO'SHISH MODALI (ADD ROW MODAL)
// Barcha maydonlar avtomatik moslashuvchan <select> dropdown
// ─────────────────────────────────────────────────────────────
function openAddModal() {
    const modal = document.getElementById('gsAddModal');
    const title = document.getElementById('gsModalTitle');
    const body = document.getElementById('gsModalBody');
    if (!modal || !body) return;

    modal.style.display = 'flex';

    if (SheetsApp.activeTab === 'dataSheet') {
        title.textContent = '➕ Yangi Moliyaviy Yozuv Qo\'shish (dataSheet)';
        const empOptions = (SheetsApp.data.employees || []).map(e => 
            `<option value="${e.telegram_id}">${escapeHtml(e.username || 'Xodim')} (${escapeHtml(e.lavozim || 'Xodim')}) - ID:${e.telegram_id}</option>`
        ).join('');

        // Mavjud va standart davrlar (Oylar) ro'yxati
        const UZ_MONTH_NAMES = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
        const curDate = new Date();
        const generatedPeriods = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
            generatedPeriods.push(`${UZ_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
        }
        // Records jadvalidagi mavjud boshqa davrlarni ham qo'shamiz
        const existingPeriods = [...new Set((SheetsApp.data.records || []).map(r => r.action_period || r.actionPeriod).filter(Boolean))];
        const allPeriodOptions = [...new Set([...generatedPeriods, ...existingPeriods])];

        const periodOptionsHtml = allPeriodOptions.map((p, idx) => 
            `<option value="${escapeHtml(p)}" ${idx === 0 ? 'selected' : ''}>${escapeHtml(p)}</option>`
        ).join('');

        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddRecord(event)">
                <div class="gs-form-group">
                    <label>Sana (YYYY-MM-DD):</label>
                    <input type="date" id="addRecDate" class="gs-form-input" value="${new Date().toISOString().slice(0,10)}" required>
                </div>
                <div class="gs-form-group">
                    <label>Hodimni tanlang (Xodimlar bazasidan):</label>
                    <select id="addRecTgId" class="gs-form-select" required>
                        ${empOptions || '<option value="">Hodimlar mavjud emas</option>'}
                    </select>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="gs-form-group" style="flex:1;">
                        <label>Summa (UZS):</label>
                        <input type="number" id="addRecUzs" class="gs-form-input" placeholder="0" value="0">
                    </div>
                    <div class="gs-form-group" style="flex:1;">
                        <label>Summa (USD):</label>
                        <input type="number" id="addRecUsd" class="gs-form-input" placeholder="0" value="0">
                    </div>
                </div>
                <div class="gs-form-group">
                    <label>Valyuta kursi (USD -> UZS):</label>
                    <input type="number" id="addRecRate" class="gs-form-input" placeholder="12600" value="12600">
                </div>
                <div class="gs-form-group">
                    <label>Hisob davri (Oy va Yil):</label>
                    <select id="addRecPeriodSelect" class="gs-form-select" onchange="toggleCustomPeriod(this.value)">
                        ${periodOptionsHtml}
                        <option value="__custom__">✍️ Boshqa davr yozish...</option>
                    </select>
                    <input type="text" id="addRecPeriodCustom" class="gs-form-input" placeholder="Masalan: Sentabr 2026" style="display:none; margin-top:6px;">
                </div>
                <div class="gs-form-group">
                    <label>Holati (Status):</label>
                    <select id="addRecStatus" class="gs-form-select">
                        <option value="Tasdiqlandi" selected>Tasdiqlandi ✅</option>
                        <option value="Kutilmoqda">Kutilmoqda ⏳</option>
                        <option value="Rad etildi">Rad etildi ❌</option>
                    </select>
                </div>
                <div class="gs-form-group">
                    <label>Izoh / Maqsad:</label>
                    <textarea id="addRecComment" class="gs-form-textarea" rows="2" placeholder="Oylik, avans yoki mukofot..."></textarea>
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
        const curMonthNum = String(curDate.getMonth() + 1).padStart(2, '0');
        const curMonthCode = '_' + curMonthNum;

        // Navbatdagi buyurtma raqamini hisoblash
        let nextNo = 1;
        if (SheetsApp.data.kvadratlar && SheetsApp.data.kvadratlar.length) {
            const numbers = SheetsApp.data.kvadratlar.map(k => parseInt(k.no || k.order_no, 10)).filter(n => !isNaN(n));
            if (numbers.length) nextNo = Math.max(...numbers) + 1;
        }

        // Oylar tanlovi
        const MONTHS_OPTIONS = [
            { code: '_01', label: '01 - Yanvar' },
            { code: '_02', label: '02 - Fevral' },
            { code: '_03', label: '03 - Mart' },
            { code: '_04', label: '04 - Aprel' },
            { code: '_05', label: '05 - May' },
            { code: '_06', label: '06 - Iyun' },
            { code: '_07', label: '07 - Iyul' },
            { code: '_08', label: '08 - Avgust' },
            { code: '_09', label: '09 - Sentabr' },
            { code: '_10', label: '10 - Oktabr' },
            { code: '_11', label: '11 - Noyabr' },
            { code: '_12', label: '12 - Dekabr' }
        ];

        const monthSelectHtml = MONTHS_OPTIONS.map(m => 
            `<option value="${m.code}" ${m.code === curMonthCode ? 'selected' : ''}>${m.label}</option>`
        ).join('');

        // Yillar tanlovi
        const yearsList = [curDate.getFullYear() + 1, curDate.getFullYear(), curDate.getFullYear() - 1, curDate.getFullYear() - 2];
        const yearSelectHtml = yearsList.map(y => 
            `<option value="${y}" ${String(y) === curYear ? 'selected' : ''}>${y}</option>`
        ).join('');

        // Xodimlar tanlovi
        const staffOptionsHtml = (SheetsApp.data.employees || []).map(e => 
            `<option value="${escapeHtml(e.username || '')}" ${String(e.telegram_id) === String(SheetsApp.auth.telegramId) ? 'selected' : ''}>${escapeHtml(e.username || '')} (${escapeHtml(e.lavozim || 'Xodim')})</option>`
        ).join('');

        // Bosqichlar tanlovi
        const stepOptionsHtml = (SheetsApp.data.workflowSteps && SheetsApp.data.workflowSteps.length)
            ? SheetsApp.data.workflowSteps.map(s => `<option value="${s.step_index || s.index || 1}">${s.step_index || s.index || 1} - ${escapeHtml(s.action_label || s.position_name || s.action || 'Bosqich')}</option>`).join('')
            : `
                <option value="1">1 - Loyihachi</option>
                <option value="2">2 - Qadoqlovchi</option>
                <option value="3">3 - Yig'uvchi</option>
            `;

        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddKvadrat(event)">
                <div class="gs-form-group">
                    <label>Sana (YYYY-MM-DD):</label>
                    <input type="date" id="addKvDate" class="gs-form-input" value="${curDate.toISOString().slice(0,10)}" required>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="gs-form-group" style="flex:1;">
                        <label>Buyurtma raqami (№):</label>
                        <input type="text" id="addKvNo" class="gs-form-input" value="${nextNo}" placeholder="1045" required>
                    </div>
                    <div class="gs-form-group" style="flex:1;">
                        <label>Maydon (m²):</label>
                        <input type="number" step="0.01" id="addKvM2" class="gs-form-input" placeholder="0.00" required>
                    </div>
                </div>
                <div class="gs-form-group">
                    <label>Buyurtma Nomi / Mijoz:</label>
                    <input type="text" id="addKvName" class="gs-form-input" placeholder="Masalan: Oshxona mebeli (Mijoz)" required>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="gs-form-group" style="flex:1;">
                        <label>Oy (Oylar tanlovi):</label>
                        <select id="addKvMonth" class="gs-form-select">
                            ${monthSelectHtml}
                        </select>
                    </div>
                    <div class="gs-form-group" style="flex:1;">
                        <label>Yil:</label>
                        <select id="addKvYear" class="gs-form-select">
                            ${yearSelectHtml}
                        </select>
                    </div>
                </div>
                <div class="gs-form-group">
                    <label>Mas'ul Xodim (Mavjud xodimlar):</label>
                    <select id="addKvStaffSelect" class="gs-form-select" onchange="toggleCustomKvStaff(this.value)">
                        ${staffOptionsHtml}
                        <option value="__custom__">✍️ Boshqa xodim nomini yozish...</option>
                    </select>
                    <input type="text" id="addKvStaffCustom" class="gs-form-input" placeholder="Xodim ismi..." style="display:none; margin-top:6px;">
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="gs-form-group" style="flex:1;">
                        <label>Boshlang'ich Bosqich:</label>
                        <select id="addKvStep" class="gs-form-select">
                            ${stepOptionsHtml}
                        </select>
                    </div>
                    <div class="gs-form-group" style="flex:1;">
                        <label>Holat (Status):</label>
                        <select id="addKvStatus" class="gs-form-select">
                            <option value="yangi" selected>Yangi (yangi)</option>
                            <option value="Jarayonda">Jarayonda</option>
                            <option value="Kesishga berildi">Kesishga berildi</option>
                            <option value="Qadoqlandi">Qadoqlandi</option>
                            <option value="Yakunlandi">Yakunlandi</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                    <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
                </div>
            </form>
        `;
    } else if (SheetsApp.activeTab === 'Hodimlar') {
        title.textContent = '➕ Yangi Xodim Qo\'shish (Hodimlar)';

        // Mavjud lavozimlar ro'yxati
        const knownPositions = ['Loyihachi', 'Qadoqlovchi', "Yig'uvchi", "Loyihachi,Yig'uvchi,Qadoqlovchi", 'Usta', 'Kesish', 'Kromka', 'Boshqaruvchi'];
        if (Array.isArray(SheetsApp.data.positions)) {
            SheetsApp.data.positions.forEach(p => {
                const name = p.position_name || p.name;
                if (name && !knownPositions.includes(name)) knownPositions.push(name);
            });
        }
        (SheetsApp.data.employees || []).forEach(e => {
            if (e.lavozim && !knownPositions.includes(e.lavozim)) knownPositions.push(e.lavozim);
        });

        const lavozimOptionsHtml = knownPositions.map(l => 
            `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`
        ).join('');

        // Mavjud guruhlar ro'yxati
        const knownGroups = ['1-guruh', '2-guruh', '3-guruh', 'A-guruh', 'B-guruh'];
        (SheetsApp.data.employees || []).forEach(e => {
            if (e.guruh && !knownGroups.includes(e.guruh)) knownGroups.push(e.guruh);
        });

        const guruhOptionsHtml = knownGroups.map(g => 
            `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`
        ).join('');

        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddHodim(event)">
                <div class="gs-form-group">
                    <label>Telegram ID (Faqat raqamlar):</label>
                    <input type="text" id="addEmpTgId" class="gs-form-input" placeholder="Masalan: 123456789" required>
                </div>
                <div class="gs-form-group">
                    <label>Ism / Familiya (Foydalanuvchi):</label>
                    <input type="text" id="addEmpName" class="gs-form-input" placeholder="Masalan: Azizbek" required>
                </div>
                <div class="gs-form-group">
                    <label>Rol (Tizimdagi darajasi):</label>
                    <select id="addEmpRole" class="gs-form-select">
                        <option value="EMPLOYEE" selected>EMPLOYEE (Oddiy xodim)</option>
                        <option value="STAFF">STAFF (Usta)</option>
                        <option value="BRIGADIR">BRIGADIR (Brigadir)</option>
                        <option value="BUGALTER">BUGALTER (Bugalter)</option>
                        <option value="DIRECTOR">DIRECTOR (Direktor)</option>
                        <option value="ADMIN">ADMIN (Admin)</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN (Boshqaruvchi)</option>
                    </select>
                </div>
                <div class="gs-form-group">
                    <label>Lavozim (Mavjud lavozimlar):</label>
                    <select id="addEmpLavozimSelect" class="gs-form-select" onchange="toggleCustomEmpLavozim(this.value)">
                        ${lavozimOptionsHtml}
                        <option value="__custom__">✍️ Boshqa lavozim yozish...</option>
                    </select>
                    <input type="text" id="addEmpLavozimCustom" class="gs-form-input" placeholder="Masalan: Kesish, Krovka" style="display:none; margin-top:6px;">
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="gs-form-group" style="flex:1;">
                        <label>Guruh:</label>
                        <select id="addEmpGuruhSelect" class="gs-form-select" onchange="toggleCustomEmpGuruh(this.value)">
                            <option value="">[ Guruhsiz ]</option>
                            ${guruhOptionsHtml}
                            <option value="__custom__">✍️ Yangi guruh yozish...</option>
                        </select>
                        <input type="text" id="addEmpGuruhCustom" class="gs-form-input" placeholder="Masalan: 1-guruh" style="display:none; margin-top:6px;">
                    </div>
                    <div class="gs-form-group" style="flex:1;">
                        <label>Guruh Sardorimi?</label>
                        <select id="addEmpSardor" class="gs-form-select">
                            <option value="0" selected>Yo'q (0)</option>
                            <option value="1">Ha (1 - Sardor ⭐)</option>
                        </select>
                    </div>
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
                    <label>Sozlama parametri (Kalit):</label>
                    <select id="addSetKeySelect" class="gs-form-select" onchange="handleSettingKeyChange(this.value)">
                        <option value="ONLY_BUGALTER_ADD">ONLY_BUGALTER_ADD (Faqat bugalter qo'shishi)</option>
                        <option value="DISABLE_EMP_EDIT_DELETE">DISABLE_EMP_EDIT_DELETE (Tahrir/o'chirishni taqiqlash)</option>
                        <option value="NOTIFY_DIRECTOR">NOTIFY_DIRECTOR (Direktorga bildirishnoma)</option>
                        <option value="WORKFLOW_STRICT_MODE">WORKFLOW_STRICT_MODE (Qat'iy oqim rejimi)</option>
                        <option value="REMINDER_TEXT">REMINDER_TEXT (Eslatma xabari matni)</option>
                        <option value="__custom__">✍️ Yangi parametr kiritish...</option>
                    </select>
                    <input type="text" id="addSetKeyCustom" class="gs-form-input" placeholder="PARAMETR_NOMI" style="display:none; margin-top:6px;">
                </div>
                <div class="gs-form-group">
                    <label>Qiymat (Value):</label>
                    <select id="addSetValSelect" class="gs-form-select" onchange="handleSettingValChange(this.value)">
                        <option value="1" selected>1 (Faol / Ha ✅)</option>
                        <option value="0">0 (O'chiq / Yo'q ❌)</option>
                        <option value="__text__">✍️ Matn kiritish...</option>
                    </select>
                    <input type="text" id="addSetValText" class="gs-form-input" placeholder="Qiymatni kiriting..." style="display:none; margin-top:6px;">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                    <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
                </div>
            </form>
        `;
    } else if (SheetsApp.activeTab === 'AI_Providers') {
        title.textContent = '➕ Yangi AI Provayder Qo\'shish';
        body.innerHTML = `
            <form id="gsAddForm" onsubmit="submitAddAIProvider(event)">
                <div class="gs-form-group">
                    <label>Provayder Nomi:</label>
                    <select id="addAiProviderSelect" class="gs-form-select" onchange="handleAiProviderChange(this.value)" required>
                        <option value="Groq" selected>Groq (Tezkor Llama 3.3)</option>
                        <option value="Gemini">Gemini (Google 2.5 Flash)</option>
                        <option value="OpenRouter">OpenRouter (Universal)</option>
                        <option value="OpenAI">OpenAI (ChatGPT)</option>
                        <option value="DeepSeek">DeepSeek (V3 / R1)</option>
                        <option value="Anthropic">Anthropic (Claude)</option>
                        <option value="Ollama">Ollama (Lokal / VPS)</option>
                        <option value="__custom__">✍️ Boshqa provayder yozish...</option>
                    </select>
                    <input type="text" id="addAiProviderCustom" class="gs-form-input" placeholder="Provayder nomi..." style="display:none; margin-top:6px;">
                </div>
                <div class="gs-form-group">
                    <label>Model Nomi:</label>
                    <input type="text" id="addAiModel" class="gs-form-input" value="groq/compound" placeholder="groq/compound, gpt-4o..." required>
                </div>
                <div class="gs-form-group">
                    <label>API Kalit (API Key):</label>
                    <input type="password" id="addAiKey" class="gs-form-input" placeholder="sk-... yoki gsk_..." required>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="gs-form-group" style="flex:1;">
                        <label>Tartib (Priority):</label>
                        <select id="addAiPriority" class="gs-form-select">
                            ${[1,2,3,4,5,6,7,8,9,10].map(num => `<option value="${num}" ${num === (SheetsApp.data.aiProviders.length + 1) ? 'selected' : ''}>${num}${num === 1 ? ' (Birlamchi)' : ''}</option>`).join('')}
                        </select>
                    </div>
                    <div class="gs-form-group" style="flex:1;">
                        <label>Holat (Faollik):</label>
                        <select id="addAiActive" class="gs-form-select">
                            <option value="1" selected>Faol ✅</option>
                            <option value="0">Nofaol ❌</option>
                        </select>
                    </div>
                </div>
                <div class="gs-form-group">
                    <label>Base URL:</label>
                    <input type="text" id="addAiUrl" class="gs-form-input" value="https://api.groq.com/openai/v1/chat/completions" placeholder="https://...">
                </div>
                <div class="gs-form-group">
                    <label>Tizim Ko'rsatmasi (System Prompt):</label>
                    <textarea id="addAiPrompt" class="gs-form-textarea" rows="3" placeholder="Sen Aristokrat hisobot va tahlil AI yordamchisisan..."></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                    <button type="button" class="gs-btn" onclick="closeAddModal()">Bekor qilish</button>
                    <button type="submit" class="gs-btn gs-btn-primary">💾 SQLite ga saqlash</button>
                </div>
            </form>
        `;
    }
}

// ── Modallardagi dinamik select/input almashtiruvchilari ─────────
function toggleCustomPeriod(val) {
    const cust = document.getElementById('addRecPeriodCustom');
    if (cust) cust.style.display = (val === '__custom__') ? 'block' : 'none';
}

function toggleCustomKvStaff(val) {
    const cust = document.getElementById('addKvStaffCustom');
    if (cust) cust.style.display = (val === '__custom__') ? 'block' : 'none';
}

function toggleCustomEmpLavozim(val) {
    const cust = document.getElementById('addEmpLavozimCustom');
    if (cust) cust.style.display = (val === '__custom__') ? 'block' : 'none';
}

function toggleCustomEmpGuruh(val) {
    const cust = document.getElementById('addEmpGuruhCustom');
    if (cust) cust.style.display = (val === '__custom__') ? 'block' : 'none';
}

function handleSettingKeyChange(val) {
    const cust = document.getElementById('addSetKeyCustom');
    if (cust) cust.style.display = (val === '__custom__') ? 'block' : 'none';
}

function handleSettingValChange(val) {
    const cust = document.getElementById('addSetValText');
    if (cust) cust.style.display = (val === '__text__') ? 'block' : 'none';
}

function handleAiProviderChange(val) {
    const customInp = document.getElementById('addAiProviderCustom');
    const modelInp = document.getElementById('addAiModel');
    const urlInp = document.getElementById('addAiUrl');

    if (val === '__custom__') {
        if (customInp) customInp.style.display = 'block';
        return;
    }
    if (customInp) customInp.style.display = 'none';

    const PRESETS = {
        'Groq': { model: 'groq/compound', url: 'https://api.groq.com/openai/v1/chat/completions' },
        'Gemini': { model: 'gemini-2.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
        'OpenRouter': { model: 'google/gemma-4-31b-it:free', url: 'https://openrouter.ai/api/v1/chat/completions' },
        'OpenAI': { model: 'gpt-4o', url: 'https://api.openai.com/v1/chat/completions' },
        'DeepSeek': { model: 'deepseek-chat', url: 'https://api.deepseek.com/chat/completions' },
        'Anthropic': { model: 'claude-3-5-sonnet-20241022', url: 'https://api.anthropic.com/v1/messages' },
        'Ollama': { model: 'gpt-oss:20b-cloud', url: 'https://ollama.com/api/v1/chat/completions' }
    };

    if (PRESETS[val]) {
        if (modelInp) modelInp.value = PRESETS[val].model;
        if (urlInp) urlInp.value = PRESETS[val].url;
    }
}

function closeAddModal() {
    const modal = document.getElementById('gsAddModal');
    if (modal) modal.style.display = 'none';
}

// ── Submit Handlers ──────────────────────────────────────────
async function submitAddRecord(e) {
    e.preventDefault();
    const date = document.getElementById('addRecDate').value;
    const targetTgId = document.getElementById('addRecTgId').value;
    const amountUZS = Number(document.getElementById('addRecUzs').value || 0);
    const amountUSD = Number(document.getElementById('addRecUsd').value || 0);
    const rate = Number(document.getElementById('addRecRate').value || 12600);
    
    const periodSel = document.getElementById('addRecPeriodSelect').value;
    const actionPeriod = (periodSel === '__custom__') 
        ? (document.getElementById('addRecPeriodCustom').value.trim() || 'Joriy davr') 
        : periodSel;

    const status = document.getElementById('addRecStatus')?.value || 'Tasdiqlandi';
    const comment = document.getElementById('addRecComment').value;

    const emp = (SheetsApp.data.employees || []).find(x => String(x.telegram_id) === String(targetTgId));
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
        comment,
        status
    });

    if (res && res.success) {
        showToast('Yangi moliyaviy yozuv SQLite bazasida saqlandi ✅');
        if (typeof RealtimeSync !== 'undefined') RealtimeSync.notifyLocalChange('records', 'add', { rowId: res.rowId });
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

    const staffSel = document.getElementById('addKvStaffSelect').value;
    const staffName = (staffSel === '__custom__') 
        ? (document.getElementById('addKvStaffCustom').value.trim() || SheetsApp.auth.username || 'Xodim') 
        : staffSel;

    const currentStep = parseInt(document.getElementById('addKvStep')?.value, 10) || 1;
    const status = document.getElementById('addKvStatus')?.value || 'yangi';

    showStatus('💾 SQLite kvadratlar jadvaliga yozilmoqda...');
    closeAddModal();

    const res = await apiRequest('kvadrat_add', {
        sana,
        no: orderNo,
        orderName,
        totalM2,
        month,
        year,
        staffName,
        currentStep,
        status
    });

    if (res && res.success) {
        showToast('Yangi buyurtma SQLite bazasida saqlandi ✅');
        if (typeof RealtimeSync !== 'undefined') RealtimeSync.notifyLocalChange('kvadratlar', 'add', { rowId: res.rowId });
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

    const lavSel = document.getElementById('addEmpLavozimSelect').value;
    const lavozim = (lavSel === '__custom__') 
        ? document.getElementById('addEmpLavozimCustom').value.trim() 
        : lavSel;

    const gurSel = document.getElementById('addEmpGuruhSelect').value;
    const guruh = (gurSel === '__custom__') 
        ? document.getElementById('addEmpGuruhCustom').value.trim() 
        : gurSel;

    const isSardor = parseInt(document.getElementById('addEmpSardor').value, 10) || 0;

    showStatus('💾 SQLite employees jadvaliga yozilmoqda...');
    closeAddModal();

    const res = await apiRequest('add_hodim', {
        tgId,
        username,
        role,
        lavozim,
        guruh,
        isSardor
    });

    if (res && res.success) {
        showToast('Yangi xodim SQLite bazasida saqlandi ✅');
        if (typeof RealtimeSync !== 'undefined') RealtimeSync.notifyLocalChange('employees', 'add', { tgId });
        loadAllData();
    } else {
        showToast(`Xatolik: ${res.error || 'Qo\'shib bo\'lmadi'} ❌`, true);
    }
}

async function submitAddSetting(e) {
    e.preventDefault();
    const keySel = document.getElementById('addSetKeySelect').value;
    const key = (keySel === '__custom__') 
        ? document.getElementById('addSetKeyCustom').value.trim().toUpperCase() 
        : keySel;

    const valSel = document.getElementById('addSetValSelect').value;
    const value = (valSel === '__text__') 
        ? document.getElementById('addSetValText').value.trim() 
        : valSel;

    if (!key) {
        showToast('Sozlama kaliti kiritilmadi ❌', true);
        return;
    }

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

async function submitAddAIProvider(e) {
    e.preventDefault();
    const provSel = document.getElementById('addAiProviderSelect').value;
    const provider = (provSel === '__custom__') 
        ? (document.getElementById('addAiProviderCustom').value.trim() || 'CustomAI') 
        : provSel;

    const model = document.getElementById('addAiModel').value.trim();
    const apiKey = document.getElementById('addAiKey').value.trim();
    const priority = parseInt(document.getElementById('addAiPriority').value, 10) || 1;
    const isActive = document.getElementById('addAiActive').value === '1';
    const baseURL = document.getElementById('addAiUrl').value.trim();
    const customPrompt = document.getElementById('addAiPrompt').value;

    closeAddModal();

    // Agar bu provayder mavjud bo'lsa yangilaymiz, aks holda qo'shamiz
    const existingIdx = SheetsApp.data.aiProviders.findIndex(p => p.provider.toLowerCase() === provider.toLowerCase());
    const newObj = { provider, model, apiKey, priority, isActive, baseURL, customPrompt };

    if (existingIdx >= 0) {
        SheetsApp.data.aiProviders[existingIdx] = newObj;
    } else {
        SheetsApp.data.aiProviders.push(newObj);
    }

    await saveAIProvidersToDB();
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
            "ID": k.rowId || k.id,
            "Sana": k.date || k.sana || '',
            "Buyurtma №": k.no || k.order_no || '',
            "Buyurtma Nomi": k.orderName || k.order_name || '',
            "Maydon (m²)": k.totalM2 ?? k.total_m2 ?? 0,
            "Oy": k.month || k.oy || '',
            "Yil": k.year || k.yil || '',
            "Mulkdor ID": k.ownerTgId || k.owner_tg_id || '',
            "Xodim": k.staffName || k.staff_name || '',
            "Bosqich": k.currentStep ?? k.current_step ?? 1,
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
    // 1. Agar iframe ichida bo'lsa
    if (window.parent && window.parent !== window) {
        // Agar katta ekranda bo'lsa, avval kichik ekranga qaytaradi
        const parentArea = window.parent.document?.getElementById('adminSheetsArea');
        if (parentArea && parentArea.classList.contains('sheets-is-fullscreen')) {
            if (typeof window.parent.toggleAdminSheetsFullscreen === 'function') {
                window.parent.toggleAdminSheetsFullscreen();
                return;
            }
        }
        // Asosiy ilovaning boshqaruv paneliga o'tish
        if (typeof window.parent.switchView === 'function') {
            window.parent.switchView('dashboard');
            return;
        }
        if (typeof window.parent.switchAdminSub === 'function') {
            const el = window.parent.document.getElementById('adminSubNavReport');
            if (el) window.parent.switchAdminSub('adminReportArea', el);
            return;
        }
        window.parent.location.href = 'index.html';
        return;
    }
    // 2. Standalone rejimda
    window.location.href = 'index.html';
}

function toggleSheetsFullscreenFromInside() {
    if (window.parent && window.parent !== window && typeof window.parent.toggleAdminSheetsFullscreen === 'function') {
        window.parent.toggleAdminSheetsFullscreen();
    } else {
        // Standalone rejimda brauzer fullscreen API
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
            updateScreenButtonLabel(true);
        } else {
            document.exitFullscreen().catch(() => {});
            updateScreenButtonLabel(false);
        }
    }
}

function updateScreenButtonLabel(isFull) {
    const btn = document.getElementById('btnInsideScreenToggle');
    if (!btn) return;
    if (isFull) {
        btn.innerHTML = '🗗 Kichik ekran';
        btn.title = 'Kichik ekran rejimiga qaytish';
        btn.style.borderColor = '#eab308';
        btn.style.color = '#eab308';
        btn.style.background = 'rgba(234,179,8,0.15)';
    } else {
        btn.innerHTML = '⛶ Katta ekran';
        btn.title = 'To\'liq katta ekranga yoyish';
        btn.style.borderColor = '#10b981';
        btn.style.color = '#10b981';
        btn.style.background = 'rgba(16,185,129,0.15)';
    }
}
window.updateScreenButtonLabel = updateScreenButtonLabel;

// ─────────────────────────────────────────────────────────────
// XAVFSIZLIK TEKSHIRUVI — Ochiq internetdan himoya
// Faqat: Telegram WebApp (initData) YOKI index.html ichida
// ─────────────────────────────────────────────────────────────
function checkAccessGuard() {
    // 1. Iframe ichida bo'lsa (index.html ichidagi embed)
    if (window.parent && window.parent !== window) {
        return true;
    }

    // 2. Hash orqali Telegram WebApp auth ma'lumotlari uzatilgan bo'lsa
    if (window.location.hash.includes('tgWebAppData=') && window.location.hash.length > 20) {
        return true;
    }

    // 3. Localhost / 127.0.0.1 da ishlayotgan bo'lsa (ishlab chiqish rejimi)
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
        return true;
    }

    // 4. Telegram WebApp orqali ochilgan — initData mavjud
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData && tg.initData.length > 10) {
        return true;
    }

    // Ochiq internetda to'g'ridan-to'g'ri ochilgan — kirish mutlaqo taqiqlanadi!
    showAccessDenied();
    return false;
}

function showAccessDenied() {
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:'Plus Jakarta Sans',sans-serif;color:#fff;padding:20px;box-sizing:border-box;">
            <div style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:36px;max-width:440px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.6);">
                <div style="width:72px;height:72px;background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.4);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 20px;">
                    🔒
                </div>
                <h2 style="color:#f8fafc;font-size:22px;margin:0 0 12px;font-weight:800;letter-spacing:-0.5px;">Kirish Taqiqlangan</h2>
                <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
                    Ushbu boshqaruv jadvali maxfiy ma'lumotlarni o'z ichiga oladi. Sahifaga faqat <b>@ishhaqitestbot</b> Telegram WebApp ilovasi orqali kirish mumkin.
                </p>
                <div style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:24px;text-align:left;font-size:12px;color:#64748b;line-height:1.5;">
                    🛡️ <b>Xavfsizlik protokoli:</b> Telegram OAuth va HMAC-SHA256 imzosi tekshirilmagan ochiq brauzer so'rovlari bloklanadi.
                </div>
                <a href="https://t.me/ishhaqitestbot" 
                   style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg, #0284c7, #0ea5e9);color:#fff;text-decoration:none;font-size:15px;font-weight:700;box-shadow:0 8px 20px rgba(14,165,233,0.3);box-sizing:border-box;">
                    🤖 Telegram Botga O'tish
                </a>
            </div>
        </div>
    `;
}

