// ============================================================
// ui.js — Navigatsiya va dastlabki yuklanish
// ============================================================
window.onload = async () => {
    const firstName = user ? user.first_name : 'Xodim';
    document.getElementById('greeting').innerText = `Salom, ${firstName}!`;

    try {
        const res  = await fetch(API_URL, {
            method: 'POST',
            body:   JSON.stringify({ action: 'init', telegramId })
        });
        const data = await res.json();

        if (data.success) {
            myFullRecords     = data.data || [];
            myFilteredRecords = [...myFullRecords];
            myInList          = data.inList  || false;
            myCanAdd          = data.canAdd  !== false; // default true
            myUsername        = data.username || '';

            // Greeting — laqab bo'lsa uni ko'rsat
            const displayName = myUsername || firstName;
            document.getElementById('greeting').innerText = `Salom, ${displayName}!`;

            // Rol aniqlash
            if      (data.isSuperAdmin)                myRole = 'SuperAdmin';
            else if (data.isAdmin)                     myRole = 'Admin';
            else if (data.isDirector || data.isDirektor) myRole = 'Direktor';
            else                                       myRole = 'User';

            // Ruhsatlar
            if (myRole === 'SuperAdmin') {
                myPermissions = { canViewAll:true, canEdit:true, canDelete:true, canExport:true, canViewDash:true };
            } else if (myRole === 'Direktor') {
                myPermissions = { canViewAll:true, canEdit:false, canDelete:false, canExport:true, canViewDash:true };
            } else if (myRole === 'Admin') {
                myPermissions = {
                    canViewAll:  data.permissions?.canViewAll  ?? false,
                    canEdit:     data.permissions?.canEdit     ?? false,
                    canDelete:   data.permissions?.canDelete   ?? false,
                    canExport:   data.permissions?.canExport   ?? false,
                    canViewDash: data.permissions?.canViewDash ?? false,
                };
            }

            // Admin panel ko'rinishi
            const showAdmin = myRole === 'SuperAdmin' || myRole === 'Direktor' ||
                              (myRole === 'Admin' && myPermissions.canViewAll);
            if (showAdmin) document.getElementById('nav-admin').classList.remove('hidden');

            // Hodimlar boshqaruvi — faqat SuperAdmin
            if (myRole === 'SuperAdmin') document.getElementById('bossNav').classList.remove('hidden');

            initMyFilters();
        }
    } catch(e) {
        console.error('Init xato:', e);
        showToastMsg('❌ Server bilan bog\'lanib bo\'lmadi', true);
    }
};

// ---- Tab almashtirish ----
function switchTab(tabId, navId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (navId !== 'nav-add') {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
    }
    if (tabId === 'adminTab')     loadAdminData();
    if (tabId === 'dashboardTab') loadDashboard();

    // + tugmasiga bosilganda ruxsatni tekshir
    if (tabId === 'addTab') {
        checkAddPermission();
    }
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
    ['adminDataArea','adminRolesArea','adminHodimlarArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(areaId).classList.remove('hidden');
    btn.classList.add('active');

    if (areaId === 'adminHodimlarArea') loadHodimlar();
}

function toggleRate() {
    const isUsd = document.getElementById('currency').value === 'USD';
    document.getElementById('rateDiv').classList.toggle('hidden', !isUsd);
}
