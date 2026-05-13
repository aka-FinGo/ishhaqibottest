let globalEmployeeList = [];

const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

function getDavrSortKey(actionPeriod, date, dateISO) {
    if (actionPeriod) return actionPeriod;
    if (dateISO) return dateISO.substring(0, 7);
    const meta = getDateMonthYear(date);
    if (meta) {
        return `${meta.year}-${String(meta.month).padStart(2, '0')}`;
    }
    return date ? date : '0000-00';
}

function getDavrLabel(davrKey) {
    if (!davrKey || davrKey === '0000-00') return 'Davr noma\'lum';
    const parts = davrKey.split('-');
    if (parts.length >= 2) {
        const y = parts[0];
        const m = parseInt(parts[1], 10);
        if (m >= 1 && m <= 12) {
            return `📅 Davr: ${UZ_MONTHS[m - 1]} ${y}`;
        }
    }
    return `📅 Davr: ${davrKey}`;
}

function formatRelativeDate(dateStr) {
    if (!dateStr) return 'Sana kiritilmagan';
    const parts = dateStr.split('.');
    if (parts.length !== 3) return dateStr;
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (isNaN(d.getTime())) return dateStr;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = (today - d) / msPerDay;
    if (diff === 0) return 'Bugun';
    if (diff === 1) return 'Kecha';
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    return `${parseInt(parts[0])}-${monthNames[parseInt(parts[1]) - 1]}`;
}

/* ---------------------------------------------------------------
   showCustomConfirm — inline stillar o'rniga CSS klasslari
   --------------------------------------------------------------- */
function showCustomConfirm(title, message, confirmText, cancelText, requireReason, onConfirm, onCancel) {
    const overlayId = 'customConfirmOverlay';
    let overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();

    const reasonBlock = requireReason ? `
        <div class="js-reason-wrap">
            <label class="js-reason-label">Sababini kiriting:</label>
            <textarea id="customConfirmReason" rows="3"
                placeholder="Qisqacha izoh..."></textarea>
        </div>` : '';

    const html = `
        <div id="${overlayId}" class="js-overlay">
            <div class="js-confirm-box">
                <h3 class="js-confirm-title">${title}</h3>
                <p class="js-confirm-msg">${message}</p>
                ${reasonBlock}
                <div class="js-confirm-actions">
                    <button class="js-btn-confirm-ok" id="customConfirmOk">${confirmText}</button>
                    <button class="js-btn-confirm-del" id="customConfirmCancel">${cancelText}</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    const rs = document.getElementById('customConfirmReason');
    if (rs) rs.focus();

    document.getElementById('customConfirmCancel').onclick = () => {
        document.getElementById(overlayId).remove();
        if (onCancel) onCancel();
    };
    document.getElementById('customConfirmOk').onclick = () => {
        let reason = '';
        if (requireReason) {
            reason = document.getElementById('customConfirmReason').value.trim();
            if (!reason) return showToastMsg('❌ Sabab kiritilishi shart', true);
        }
        document.getElementById(overlayId).remove();
        onConfirm(reason);
    };
}

let _globalDebounceTimers = {};
function performDebounce(key, func, wait = 300) {
    if (_globalDebounceTimers[key]) clearTimeout(_globalDebounceTimers[key]);
    _globalDebounceTimers[key] = setTimeout(func, wait);
}

let _appInitialized = false;
let _appInitRetries = 0;
const MAX_INIT_RETRIES = 3;

function loadCachedData() {
    const cached = AppCache.get(AppCache.KEYS.MY_RECORDS, 120);
    if (cached && Array.isArray(cached)) {
        myFullRecords = cached;
        myFilteredRecords = [...myFullRecords];
        console.log('✅ Records cached:', myFullRecords.length);
        if (myFullRecords.length > 0) {
            showToastMsg('⚡ Ma\'lumotlar keshdan yuklandi', false);
        }
    }
    const cachedUser = AppCache.get(AppCache.KEYS.USER_DATA, 120);
    if (cachedUser) {
        processUserData(cachedUser);
        console.log('✅ User meta cached');
        return true;
    }
    return !!cached;
}

function saveCacheData(records, userData) {
    if (records) AppCache.set(AppCache.KEYS.MY_RECORDS, records);
    if (userData) AppCache.set(AppCache.KEYS.USER_DATA, userData);
}

function processUserData(data) {
    if (!data) return;
    myInList = data.inList || false;
    myCanAdd = data.canAdd !== false;
    myUsername = data.username || '';
    adminContactId = String(data.adminContactId || '').trim();
    const displayName = data.username || (user ? user.first_name : 'Xodim');
    document.getElementById('greeting').innerText = `Salom, ${displayName}!`;

    if (data.isSuperAdmin) myRole = 'SuperAdmin';
    else if (data.isAdmin) myRole = 'Admin';
    else if (data.isDirector || data.isDirektor) myRole = 'Direktor';
    else myRole = 'User';

    myIsSardor = !!data.isSardor;
    const asBool = (v) => v === true || v === 1 || String(v || '') === '1' || String(v || '').toLowerCase() === 'true';

    if (myRole === 'SuperAdmin') {
        myPermissions = {
            canViewAll: true, canEdit: true, canDelete: true, canExport: true, canViewDash: true,
            positions: data.positions || [], workflowConfig: data.workflowConfig || [], allPositions: data.allPositions || [],
            isWorkflowStrict: !!data.isWorkflowStrict
        };
    } else {
        const p = data.permissions || {};
        myPermissions = {
            canViewAll: asBool(p.canViewAll), canEdit: asBool(p.canEdit), canDelete: asBool(p.canDelete),
            canExport: asBool(p.canExport), canViewDash: asBool(p.canViewDash),
            positions: data.positions || [], workflowConfig: data.workflowConfig || [], allPositions: data.allPositions || [],
            isWorkflowStrict: !!data.isWorkflowStrict
        };
    }
    if (typeof updateTechnicalPositions === 'function') updateTechnicalPositions(data.allPositions || []);
    canViewCompanyActions = myRole === 'SuperAdmin' || myPermissions.canViewAll;
    canExportCompanyData = myRole === 'SuperAdmin' || (myPermissions.canViewAll && myPermissions.canExport);

    applyRoleBasedUI();
    applyTheme();
    updateProfileUI();

    if (typeof populateKvadratMeta === 'function') populateKvadratMeta(globalEmployeeList);
}

function applyRoleBasedUI() {
    setSelfCheckButtonsVisibility(myRole === 'SuperAdmin' || myRole === 'Admin');
    setCompanyExportVisibility(canExportCompanyData);
    updateContactAdminButton();
}

let _appLoadingToast = null;
function showAppLoading(msg = 'Yuklanmoqda...') {
    if (_appLoadingToast) _appLoadingToast.remove();
    const html = `<div id="appLoadingToast" class="app-loading-bar">
        <div class="spinner"></div>
        <span>${msg}</span>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    _appLoadingToast = document.getElementById('appLoadingToast');
    requestAnimationFrame(() => {
        if (_appLoadingToast) _appLoadingToast.classList.add('show');
    });
}
function hideAppLoading() {
    if (_appLoadingToast) {
        _appLoadingToast.classList.remove('show');
        setTimeout(() => {
            if (_appLoadingToast) {
                _appLoadingToast.remove();
                _appLoadingToast = null;
            }
        }, 300);
    }
}

/**
 * Pull to Refresh funksiyasini initsializatsiya qilish
 */
function initPullToRefresh(containerId, ptrId, refreshCallback) {
    const container = document.getElementById(containerId);
    const ptr = document.getElementById(ptrId);
    if (!container || !ptr) return;

    const arrow = ptr.querySelector('.ptr-arrow');
    const icon = ptr.querySelector('.ptr-icon');

    let startY = 0;
    let isPulling = false;
    const threshold = 70;

    container.addEventListener('touchstart', (e) => {
        if (container.scrollTop <= 5) {
            startY = e.touches[0].pageY;
        } else {
            startY = 0;
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (startY === 0) return;
        const y = e.touches[0].pageY;
        const diff = y - startY;

        if (diff > 10 && container.scrollTop <= 5) {
            isPulling = true;
            ptr.classList.add('active');
            
            if (diff > threshold) {
                ptr.classList.add('pulling');
            } else {
                ptr.classList.remove('pulling');
            }
            
            ptr.style.height = Math.min(diff * 0.5, 80) + 'px';
            ptr.style.opacity = Math.min(diff / threshold, 1);
        }
    }, { passive: false });

    container.addEventListener('touchend', async () => {
        if (!isPulling) return;
        isPulling = false;
        
        const currentHeight = parseInt(ptr.style.height || 0);
        ptr.style.height = ''; 
        ptr.style.opacity = '';

        if (currentHeight >= 35) {
            arrow.classList.add('hidden');
            icon.classList.remove('hidden');
            ptr.classList.add('active');
            
            try {
                if (window.tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                await refreshCallback();
            } catch (err) {
                console.error('Refresh error:', err);
                if (window.tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            } finally {
                setTimeout(() => {
                    ptr.classList.remove('active', 'pulling');
                    setTimeout(() => {
                        arrow.classList.remove('hidden');
                        icon.classList.add('hidden');
                    }, 300);
                }, 500);
            }
        } else {
            ptr.classList.remove('active', 'pulling');
        }
        startY = 0;
    });
}

async function initializeApp() {
    try {
        if (typeof tg !== 'undefined') {
            tg.ready();
            tg.expand();
        }
        const firstName = user ? user.first_name : 'Xodim';
        document.getElementById('greeting').innerText = `Salom, ${firstName}!`;

        showAppLoading('Kesh yuklanmoqda...');
        loadCachedData();
        if (myFullRecords.length > 0) {
            if (typeof initMyFilters === 'function') initMyFilters();
            if (typeof renderMyRecords === 'function') renderMyRecords();
            if (typeof initKvadratTab === 'function') initKvadratTab();
            showAppLoading('Keshdan yuklandi, server bilan yangilanmoqda...');
        } else {
            showAppLoading('Server bilan bog\'lanmoqda...');
        }

        const data = await apiRequest({
            action: 'init',
            firstName: user ? (user.first_name || '') : '',
            lastName: user ? (user.last_name || '') : '',
            tgUsername: user ? (user.username || '') : ''
        }, { timeoutMs: 30000 });

        if (data && data.success) {
            myFullRecords = data.data || [];
            myFilteredRecords = [...myFullRecords];

            const _empRaw = data.employeeList || {};
            window._kvEmpMap = _empRaw;
            globalEmployeeList = Array.isArray(_empRaw) ? _empRaw : Object.values(_empRaw).filter(Boolean);

            processUserData(data);
            saveCacheData(myFullRecords, data);

            if (data.autoAdded) showToastMsg("✅ Siz ro'yxatga qo'shildingiz. Ruxsat uchun admin bilan bog'laning.");
            if (typeof initMyFilters === 'function') initMyFilters();
            if (typeof populateKvadratMeta === 'function') populateKvadratMeta(globalEmployeeList);
            _appInitialized = true; _appInitRetries = 0;
            if (typeof updateModuleIframe === 'function') updateModuleIframe();
            startBackgroundSync();
            hideAppLoading();
        } else { throw new Error(data?.error || 'Init xatosi'); }
    } catch (error) {
        hideAppLoading();
        console.error('❌ Init xatosi:', error);
        if (_appInitRetries < MAX_INIT_RETRIES) {
            _appInitRetries++;
            const delay = 2000 * _appInitRetries;
            setTimeout(initializeApp, delay);
            if (myFullRecords.length === 0) {
                showToastMsg(`⏳ Ulanmoqda... (${_appInitRetries}/${MAX_INIT_RETRIES})`);
            } else {
                console.log(`🔄 Fon yangilanishi: urinish ${_appInitRetries}/${MAX_INIT_RETRIES}`);
            }
        } else {
            _appInitialized = false;
            if (myFullRecords.length > 0) {
                console.warn('⚠️ Server ulanmadi, kesh ma\'lumotlari ishlatilmoqda');
            } else {
                showToastMsg('❌ Server bilan bog\'lanib bo\'lmadi. Tarmoqni tekshiring.', true);
            }
        }
    }
}

window.addEventListener('load', initializeApp);

let _lastActiveTime = Date.now();
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

function _handleAppResume() {
    const now = Date.now();
    const elapsed = now - _lastActiveTime;

    document.querySelectorAll('select').forEach(sel => {
        sel.blur();
        sel.style.pointerEvents = 'none';
        requestAnimationFrame(() => { sel.style.pointerEvents = ''; });
    });

    if (elapsed > REFRESH_THRESHOLD_MS && _appInitialized) {
        console.log(`⏰ App ${Math.round(elapsed / 60000)} daqiqadan keyin faollashdi. Fon yangilanishi...`);
        _appInitialized = false;
        _appInitRetries = 0;
        initializeApp().catch(e => console.warn('Resume refresh xatosi:', e));
    } else {
        if (myFullRecords.length > 0 && typeof initMyFilters === 'function') {
            initMyFilters();
        }
        applyTheme();
    }
    _lastActiveTime = now;
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        _handleAppResume();
    } else {
        _lastActiveTime = Date.now();
    }
});

if (tg && typeof tg.onEvent === 'function') {
    tg.onEvent('activated', () => {
        console.log('📱 Telegram activated event');
        _handleAppResume();
    });
}

window.addEventListener('focus', () => {
    const elapsed = Date.now() - _lastActiveTime;
    if (elapsed > 30000) {
        _handleAppResume();
    }
});

function switchTab(tabId, navId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (navId && navId !== 'nav-add') {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
    }

    // Modul sahifasi bo'lsa bottom-nav ni yashiramiz
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.classList.toggle('hidden', tabId === 'moduleTab');
    }
    if (tabId === 'adminTab') {
        if (typeof initAdminTab === 'function') initAdminTab();
        else if (typeof loadAdminData === 'function') loadAdminData();
    }
    if (tabId === 'dashboardTab') {
        if (typeof initDashboardTab === 'function') initDashboardTab();
        else if (typeof renderDashboard === 'function') renderDashboard();
    }
    if (tabId === 'kvadratTab') {
        if (typeof initKvadratTab === 'function') initKvadratTab();
        else if (typeof loadKvData === 'function') loadKvData();
    }
    if (tabId === 'reportTab') {
        if (typeof initMyFilters === 'function') initMyFilters();
        if (typeof renderMyRecords === 'function') renderMyRecords();
    }
    if (tabId === 'profileTab') updateProfileUI();
    if (tabId === 'kvDashboardTab' && typeof renderKvDashboardPage === 'function') renderKvDashboardPage();
    if (tabId === 'addTab') checkAddPermission();
    if (tabId === 'moduleTab') {
        // Iframe allaqachon yuklangan, agar kerak bo'lsa refresh qilish mumkin
    }
    if (typeof updateKvFabVisibility === 'function') updateKvFabVisibility();
}

function updateModuleIframe() {
    const iframe = document.getElementById('moduleIframe');
    if (iframe && typeof tgInitData !== 'undefined' && tgInitData) {
        // GitHub Pages uchun URL. tgInitData ni hash orqali uzatamiz 
        // shunda ichki modul ham xuddi Telegram ichida ochilgandek ishlaydi
        const baseUrl = "https://aka-fingo.github.io/module_fl/";
        iframe.src = baseUrl + "#tgWebAppData=" + encodeURIComponent(tgInitData);
    }
}

function setTheme(themeFile) {
    const link = document.getElementById('dynamic-theme');
    if (!link) return;

    link.href = themeFile ? themeFile : '';
    localStorage.setItem('user_theme', themeFile || '');

    const defEl = document.getElementById('theme-default');
    const darkEl = document.getElementById('theme-dark');
    if (defEl) defEl.classList.toggle('checked', !themeFile);
    if (darkEl) darkEl.classList.toggle('checked', themeFile === 'dark.css');

    showToast(themeFile ? "Mavzu o'zgardi" : "Standart mavzu");
}

function applyTheme() {
    const saved = localStorage.getItem('user_theme');
    if (saved !== null) {
        setTheme(saved);
    }
}

function updateProfileUI() {
    console.log('👤 Profil UI yangilanmoqda. Rol:', myRole);
    const nameEl = document.getElementById('profileUserName');
    const roleEl = document.getElementById('profileUserRole');
    if (nameEl) nameEl.textContent = myUsername || 'Foydalanuvchi';
    if (roleEl) roleEl.textContent = myRole || 'User';

    const adminSection = document.getElementById('profileAdminSection');
    if (adminSection) {
        const hasAdminAccess = (myRole === 'SuperAdmin' || myRole === 'Admin' || myRole === 'Direktor');
        adminSection.classList.toggle('hidden', !hasAdminAccess);
    }

    // --- Joriy oy statistikasi ---
    try {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        const curPeriod = `${curYear}-${String(curMonth).padStart(2, '0')}`;

        // 1. Ish haqi (So'mda)
        let monthlyUzs = 0;
        if (typeof myFullRecords !== 'undefined' && Array.isArray(myFullRecords)) {
            monthlyUzs = myFullRecords.reduce((sum, r) => {
                if (r.actionPeriod === curPeriod) return sum + (Number(r.amountUZS) || 0);
                return sum;
            }, 0);
        }
        const uzsEl = document.getElementById('profileCurrentMonthUzs');
        if (uzsEl) uzsEl.textContent = monthlyUzs.toLocaleString();

        // 2. Kvadratlar (m²)
        let monthlyM2 = 0;
        if (typeof kvFullRecords !== 'undefined' && Array.isArray(kvFullRecords)) {
            const myName = myUsername || (typeof employeeName !== 'undefined' ? employeeName : '');
            monthlyM2 = kvFullRecords.reduce((sum, r) => {
                const rYear = Number(r.year);
                const rMonth = Number(String(r.month || '').replace('_', '').replace("'", ""));
                const rStaff = r.staffName || '';
                if (rYear === curYear && rMonth === curMonth && rStaff === myName) {
                    return sum + (Number(r.totalM2) || 0);
                }
                return sum;
            }, 0);
        }
        const m2El = document.getElementById('profileCurrentMonthM2');
        if (m2El) m2El.textContent = monthlyM2.toLocaleString('uz-UZ', { maximumFractionDigits: 1 });

        // Toggles holatini yuklash
        const notifOn = localStorage.getItem('app_notifications') !== 'false'; // default true
        const offlineOn = localStorage.getItem('app_offline_mode') === 'true'; // default false
        
        const notifToggle = document.getElementById('toggleNotifications');
        const offlineToggle = document.getElementById('toggleOfflineMode');
        
        if (notifToggle) notifToggle.checked = notifOn;
        if (offlineToggle) offlineToggle.checked = offlineOn;

    } catch (err) {
        console.warn('Profile stats calculation error:', err);
    }
}

function toggleSetting(type, isEnabled) {
    console.log(`⚙️ Sozlama o'zgardi: ${type} = ${isEnabled}`);
    
    // Haptic feedback
    if (window.tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }

    if (type === 'notifications') {
        localStorage.setItem('app_notifications', isEnabled);
        showToastMsg(isEnabled ? '✅ Bildirishnomalar yoqildi' : '🔔 Bildirishnomalar o\'chirildi');
    } else if (type === 'offline') {
        localStorage.setItem('app_offline_mode', isEnabled);
        showToastMsg(isEnabled ? '📶 Offline rejim faollashdi' : '🌐 Onlayn rejimga o\'tildi');
    }
}



function handleFabAction() {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'kvadratTab') { openKvModal(); }
    else { switchTab('addTab', 'nav-add'); }
}

function setSelfCheckButtonsVisibility(canRunSelfCheck) {
    ['selfCheckBtnAdmin'].forEach(function (id) {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = canRunSelfCheck ? '' : 'none';
    });
}

function setCompanyExportVisibility(canExport) {
    const btn = document.getElementById('companyExportBtn');
    if (btn) btn.style.display = canExport ? '' : 'none';
}

function updateContactAdminButton() {
    const btn = document.getElementById('contactAdminBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', !adminContactId);
}

function contactAdmin() {
    if (!adminContactId) { showToastMsg('❌ Admin kontakti topilmadi', true); return; }
    window.location.href = 'tg://user?id=' + encodeURIComponent(adminContactId);
}

function initAdminTab() {
    const isSuperAdmin = myRole === 'SuperAdmin';
    if (myRole !== 'SuperAdmin' && myRole !== 'Admin') {
        showToastMsg('❌ Admin panel ruxsati yo\'q', true);
        switchTab('kvadratTab', 'nav-kvadrat'); return;
    }
    const navHodimlar = document.getElementById('adminNavHodimlar');
    const navNotify = document.getElementById('adminNavNotify');
    if (navHodimlar) navHodimlar.classList.toggle('hidden', !isSuperAdmin);
    if (isSuperAdmin && navHodimlar) switchAdminSub('adminHodimlarArea', navHodimlar);
    else if (navNotify) switchAdminSub('adminNotifyArea', navNotify);
}

function handleDashboardNav() {
    // Admin, SuperAdmin, Direktor → kompaniya budjeti (dashboardTab)
    // Oddiy hodim → faqat o'z amallari (reportTab)
    if (canViewCompanyActions || myRole === 'Admin' || myRole === 'SuperAdmin' || myRole === 'Direktor') {
        switchTab('dashboardTab', 'nav-dashboard');
    } else {
        switchTab('reportTab', 'nav-dashboard');
    }
}

function switchReportSub(areaId, btn) {
    ['reportActionsArea', 'reportDashArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== areaId);
    });
    document.querySelectorAll('#reportTab .page-switcher-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Dashboard ochilganda, hodim uchun renderUserDashboard chaqiriladi
    if (areaId === 'reportDashArea') {
        const container = document.getElementById('reportDashContent');
        if (container && typeof renderUserDashboard === 'function') {
            renderUserDashboard(container);
        }
    }
}

function initDashboardTab() {
    if (!canViewCompanyActions) {
        const actionsArea = document.getElementById('dashboardActionsArea');
        if (actionsArea) actionsArea.classList.add('hidden');
        document.getElementById('dashTopCharts').classList.add('active');
        document.getElementById('dashTopActions').classList.remove('active');
        loadDashboard(); return;
    }
    switchDashboardSub('dashboardActionsArea', document.getElementById('dashTopActions'));
}

function switchDashboardSub(areaId, btn) {
    ['dashboardActionsArea', 'dashboardChartsArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.dash-sub-btn, #dashboardTab .page-switcher-btn').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(areaId);
    if (target) target.classList.remove('hidden');
    if (btn) btn.classList.add('active');
    const topBtn = document.getElementById(areaId === 'dashboardActionsArea' ? 'dashTopActions' : 'dashTopCharts');
    if (topBtn) topBtn.classList.add('active');
    if (areaId === 'dashboardActionsArea') loadAdminData();
    if (areaId === 'dashboardChartsArea') loadDashboard();
}

function checkAddPermission() {
    if (!myInList) { showPermWarning('⚠️ Siz tizimda ro\'yxatdan o\'tmagan xodimsiz!', 'Amal qo\'shish uchun SuperAdminga murojaat qiling.'); return false; }
    if (!myCanAdd) { showPermWarning('🚫 Amal qo\'shish ruxsati yo\'q!', 'Sizda ruxsat yo\'q. SuperAdminga murojaat qiling.'); return false; }
    document.getElementById('permWarning').classList.add('hidden');
    document.getElementById('addFormContent').classList.remove('hidden');
    return true;
}

function showPermWarning(title, desc) {
    document.getElementById('addFormContent').classList.add('hidden');
    const w = document.getElementById('permWarning');
    w.classList.remove('hidden');
    document.getElementById('permWarnTitle').innerText = title;
    document.getElementById('permWarnDesc').innerText = desc;
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
}

function showToastMsg(msg, isErr = false) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.innerText = msg; t.className = 'toast' + (isErr ? ' toast-err' : '');
    t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
}

let adminInitData = null;

async function ensureAdminDataLoaded(force = false) {
    if (adminInitData && !force) return adminInitData;

    try {
        const data = await apiRequest({ action: 'admin_init' });
        if (data.success) {
            adminInitData = data;
            globalEmployeeList = data.employees;
            if (myPermissions) {
                myPermissions.allPositions = data.positions;
                myPermissions.workflowConfig = data.workflowSteps;
                myPermissions.isWorkflowStrict = data.isWorkflowStrict;
            }
            if (typeof updateTechnicalPositions === 'function') updateTechnicalPositions(data.positions);
            if (typeof populateKvadratMeta === 'function') populateKvadratMeta(data.employees);
            return data;
        }
    } catch (e) {
        console.error('admin_init error:', e);
    }
    return null;
}

async function switchAdminSub(areaId, btn) {
    if ((areaId === 'adminHodimlarArea' || areaId === 'adminWorkflowArea' || areaId === 'adminPositionsArea') && myRole !== 'SuperAdmin') {
        showToastMsg('❌ Faqat SuperAdmin uchun', true); return;
    }

    ['adminHodimlarArea', 'adminWorkflowArea', 'adminPositionsArea', 'adminNotifyArea', 'adminServiceArea'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.admin-sub-btn').forEach(b => b.classList.remove('active'));
    if (document.getElementById(areaId)) document.getElementById(areaId).classList.remove('hidden');
    if (btn) btn.classList.add('active');

    if (['adminHodimlarArea', 'adminWorkflowArea', 'adminPositionsArea'].includes(areaId)) {
        await ensureAdminDataLoaded();
    }

    if (areaId === 'adminHodimlarArea') renderHodimlarList(globalEmployeeList);
    if (areaId === 'adminWorkflowArea' && typeof renderWorkflowSteps === 'function') {
        currentWorkflowSteps = JSON.parse(JSON.stringify(myPermissions.workflowConfig || []));
        renderWorkflowSteps();
    }
    if (areaId === 'adminPositionsArea' && typeof renderPositionsUI === 'function') {
        renderPositionsUI(myPermissions.allPositions);
    }
    if (areaId === 'adminNotifyArea') { loadNotifyTargets(); loadReminderTextSettings(); cancelReminderSend(); }
    if (areaId === 'adminServiceArea') { setNotifyStatus('', false, 'admin_service'); }
}

function toggleRate() {
    const isUsd = document.getElementById('currency').value === 'USD';
    document.getElementById('rateDiv').classList.toggle('hidden', !isUsd);
}

/* ---------------------------------------------------------------
   showConfirmModal — tez tasdiqlash modali
   --------------------------------------------------------------- */
function showConfirmModal(message, onConfirm) {
    const modalId = 'customConfirmModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
        <div id="${modalId}" class="js-overlay" style="z-index:99999;">
            <div class="js-confirm-box" style="max-width:340px;">
                <div style="font-size:54px; text-align:center; margin-bottom:20px;">⚠️</div>
                <div class="js-confirm-title" style="text-align:center; font-size:17px; line-height:1.5;">
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <p class="js-confirm-msg" style="text-align:center;">
                    Ushbu amalni davom ettirmoqchimisiz?
                </p>
                <div class="js-confirm-actions">
                    <button id="modalYes" class="js-btn-confirm-ok">Ha, saqlash</button>
                    <button id="modalNo"  class="js-btn-confirm-del">Yo'q</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('modalYes').onclick = function () {
        document.getElementById(modalId).remove();
        if (onConfirm) onConfirm();
    };
    document.getElementById('modalNo').onclick = function () {
        document.getElementById(modalId).remove();
    };
}

let _bgSyncInterval = null;
function startBackgroundSync() {
    if (_bgSyncInterval) clearInterval(_bgSyncInterval);
    _bgSyncInterval = setInterval(async () => {
        try {
            console.log('🔄 Fon sinxronizatsiyasi boshlandi...');
            // Faqat init qilamiz, u barcha kerakli ma'lumotlarni yangilaydi
            const data = await apiRequest({ action: 'init' }, { timeoutMs: 15000 });
            if (data && data.success) {
                myFullRecords = data.data || [];
                myFilteredRecords = [...myFullRecords];
                const _empRaw = data.employeeList || {};
                window._kvEmpMap = _empRaw;
                globalEmployeeList = Array.isArray(_empRaw) ? _empRaw : Object.values(_empRaw).filter(Boolean);
                
                // UI ni yangilash (agar foydalanuvchi hozir ko'rayotgan bo'lsa)
                if (typeof renderMyRecords === 'function') renderMyRecords();
                if (typeof initKvadratTab === 'function') initKvadratTab();
                if (typeof populateKvadratMeta === 'function') populateKvadratMeta(globalEmployeeList);
                
                saveCacheData(myFullRecords, data);
                console.log('✅ Fon sinxronizatsiyasi yakunlandi');
            }
        } catch (e) {
            console.error('⚠️ Fon sinxronizatsiyasi xatosi:', e);
        }
    }, 180000); // 3 daqiqa
}
