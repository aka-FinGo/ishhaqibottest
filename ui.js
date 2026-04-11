// ============================================================
// ui.js — Navigatsiya va dastlabki yuklanish
// ============================================================
let globalEmployeeList = []; // Global list for dropdowns

window.onload = async () => {
    const firstName = user ? user.first_name : 'Xodim';
    document.getElementById('greeting').innerText = `Salom, ${firstName}!`;

    try {
        const data = await apiRequest({
            action: 'init',
            firstName: user ? (user.first_name || '') : '',
            lastName: user ? (user.last_name || '') : '',
            tgUsername: user ? (user.username || '') : ''
        });

        if (data.success) {
            myFullRecords      = data.data || [];
            myFilteredRecords  = [...myFullRecords];
            myInList           = data.inList  || false;
            myCanAdd           = data.canAdd  !== false;
            myUsername         = data.username || '';
            adminContactId     = String(data.adminContactId || '').trim();
            globalEmployeeList = data.employeeList || [];

            // Populate kvadrat filters and forms
            if (typeof populateKvadratMeta === 'function') {
                populateKvadratMeta(globalEmployeeList);
            }

            // Greeting — laqab bo'lsa uni ko'rsat
            const displayName = myUsername || firstName;
            document.getElementById('greeting').innerText = `Salom, ${displayName}!`;

            // Rol aniqlash
            if      (data.isSuperAdmin)                myRole = 'SuperAdmin';
            else if (data.isAdmin)                     myRole = 'Admin';
            else if (data.isDirector || data.isDirektor) myRole = 'Direktor';
            else                                       myRole = 'User';

            // Ruhsatlar
            const asBool = function (v) {
                return v === true || v === 1 || String(v || '') === '1' || String(v || '').toLowerCase() === 'true';
            };
            if (myRole === 'SuperAdmin') {
                myPermissions = { canViewAll:true, canEdit:true, canDelete:true, canExport:true, canViewDash:true };
            } else {
                const p = data.permissions || {};
                myPermissions = {
                    canViewAll:  asBool(p.canViewAll),
                    canEdit:     asBool(p.canEdit),
                    canDelete:   asBool(p.canDelete),
                    canExport:   asBool(p.canExport),
                    canViewDash: asBool(p.canViewDash),
                };
            }

            canViewCompanyActions = myRole === 'SuperAdmin' || myPermissions.canViewAll;
            canExportCompanyData = myRole === 'SuperAdmin' || (myPermissions.canViewAll && myPermissions.canExport);

            // Admin panel (SuperAdmin va Admin)
            if (myRole === 'SuperAdmin' || myRole === 'Admin') {
                document.getElementById('nav-admin').classList.remove('hidden');
            }

            // Tizim tekshiruv tugmasi — SuperAdmin va Admin
            setSelfCheckButtonsVisibility(myRole === 'SuperAdmin' || myRole === 'Admin');
            setCompanyExportVisibility(canExportCompanyData);
            updateContactAdminButton();

            if (data.autoAdded) {
                showToastMsg("✅ Siz ro'yxatga qo'shildingiz. Ruxsat uchun admin bilan bog'laning.");
            }

            initMyFilters();
        } else {
            showToastMsg('❌ ' + (data.error || 'Init xatosi'), true);
        }
    } catch(e) {
        console.error('Init xato:', e);
        showToastMsg('❌ Server bilan bog\'lanib bo\'lmadi', true);
    }
};

// ---- Tab almashtirish ----
function switchTab(tabId, navId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    const tabEl = document.getElementById(tabId);
    if(tabEl) tabEl.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (navId !== 'nav-add') {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
    }

    if (tabId === 'adminTab') initAdminTab();
    if (tabId === 'dashboardTab') initDashboardTab();
    if (tabId === 'kvadratTab') initKvadratTab();

    // + tugmasiga bosilganda ruxsatni tekshir
    if (tabId === 'addTab') {
        checkAddPermission();
    }
}

function handleFabAction() {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'kvadratTab') {
        openKvModal(); // Kvadratlar formasini ochish
    } else {
        switchTab('addTab', 'nav-add'); // Oylik qo'shish sahifasini ochish
    }
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
    if (!adminContactId) {
        showToastMsg('❌ Admin kontakti topilmadi', true);
        return;
    }
    const deepLink = 'tg://user?id=' + encodeURIComponent(adminContactId);
    window.location.href = deepLink;
}

function initAdminTab() {
    const isSuperAdmin = myRole === 'SuperAdmin';
    const canUseAdminPanel = isSuperAdmin || myRole === 'Admin';
    if (!canUseAdminPanel) {
        showToastMsg('❌ Admin panel ruxsati yo\'q', true);
        switchTab('reportTab', 'nav-report');
        return;
    }

    const navHodimlar = document.getElementById('adminNavHodimlar');
    const navNotify = document.getElementById('adminNavNotify');
    const navService = document.getElementById('adminNavService');

    if (navHodimlar) navHodimlar.classList.toggle('hidden', !isSuperAdmin);
    if (navNotify) navNotify.classList.remove('hidden');
    if (navService) navService.classList.remove('hidden');

    if (isSuperAdmin && navHodimlar) {
        switchAdminSub('adminHodimlarArea', navHodimlar);
    } else if (navNotify) {
        switchAdminSub('adminNotifyArea', navNotify);
    } else if (navService) {
        switchAdminSub('adminServiceArea', navService);
    }
}

function initDashboardTab() {
    const nav = document.getElementById('dashboardNav');
    if (!canViewCompanyActions) {
        if (nav) nav.classList.add('hidden');
        const actionsArea = document.getElementById('dashboardActionsArea');
        const chartsArea  = document.getElementById('dashboardChartsArea');
        if (actionsArea) actionsArea.classList.add('hidden');
        if (chartsArea) chartsArea.classList.remove('hidden');
        loadDashboard();
        return;
    }

    if (nav) nav.classList.remove('hidden');
    const btnActions = document.getElementById('dashNavActions');
    switchDashboardSub('dashboardActionsArea', btnActions || null);
}

function switchDashboardSub(areaId, btn) {
    ['dashboardActionsArea', 'dashboardChartsArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.dash-sub-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(areaId);
    if (target) target.classList.remove('hidden');
    if (btn) btn.classList.add('active');

    if (areaId === 'dashboardActionsArea') loadAdminData();
    if (areaId === 'dashboardChartsArea') loadDashboard();
}

// ---- + bosilganda ruxsat tekshiruvi ----
function checkAddPermission() {
    if (!myInList) {
        // Ro'yxatda yo'q
        showPermWarning(
            '⚠️ Siz tizimda ro\'yxatdan o\'tmagan xodimsiz!',
            'Amal qo\'shish uchun SuperAdminga murojaat qiling va tizimga qo\'shilishingizni so\'rang.'
        );
        return false;
    }
    if (!myCanAdd) {
        // Ro'yxatda bor, lekin ruxsat yo'q
        showPermWarning(
            '🚫 Amal qo\'shish ruxsati yo\'q!',
            'Sizda hozircha amal qo\'shish huquqi berilmagan. SuperAdminga murojaat qiling.'
        );
        return false;
    }
    // Ruxsat bor — formani ko'rsat
    document.getElementById('permWarning').classList.add('hidden');
    document.getElementById('addFormContent').classList.remove('hidden');
    return true;
}

function showPermWarning(title, desc) {
    document.getElementById('addFormContent').classList.add('hidden');
    const w = document.getElementById('permWarning');
    w.classList.remove('hidden');
    document.getElementById('permWarnTitle').innerText = title;
    document.getElementById('permWarnDesc').innerText  = desc;
    updateContactAdminButton();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
}

// ---- Global toast ----
function showToastMsg(msg, isErr=false) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
    t.innerText  = msg;
    t.className  = 'toast' + (isErr ? ' toast-err' : '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function switchAdminSub(areaId, btn) {
    if (areaId === 'adminHodimlarArea' && myRole !== 'SuperAdmin') {
        showToastMsg('❌ Hodimlar bo\'limi faqat SuperAdmin uchun', true);
        return;
    }
    ['adminHodimlarArea', 'adminNotifyArea', 'adminServiceArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.admin-sub-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(areaId);
    if (target) target.classList.remove('hidden');
    if (btn) btn.classList.add('active');

    if (areaId === 'adminHodimlarArea') loadHodimlar();
    if (areaId === 'adminNotifyArea') {
        loadNotifyTargets();
        loadReminderTextSettings();
        cancelReminderSend();
        setNotifyStatus('', false, 'admin');
    }
    if (areaId === 'adminServiceArea') {
        setNotifyStatus('', false, 'admin_service');
    }
}

function toggleRate() {
    const isUsd = document.getElementById('currency').value === 'USD';
    document.getElementById('rateDiv').classList.toggle('hidden', !isUsd);
}
