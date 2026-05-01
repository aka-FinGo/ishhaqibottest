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

function showCustomConfirm(title, message, confirmText, cancelText, requireReason, onConfirm, onCancel) {
    const overlayId = 'customConfirmOverlay';
    let overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
    const html = `
        <div id="${overlayId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1001;backdrop-filter:blur(4px);">
            <div style="background:white;border-radius:16px;padding:24px;margin:20px;max-width:90%;width:350px;box-shadow:0 10px 25px rgba(0,0,0,0.2);animation:modalSlideIn 0.3s cubic-bezier(0.16,1,0.3,1);">
                <h3 style="margin:0 0 12px;color:#1e293b;font-size:18px;">${title}</h3>
                <p style="color:#64748b;margin:0 0 20px;font-size:14px;line-height:1.5;">${message}</p>
                ${requireReason ? `
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:600;font-size:13px;color:#334155;">Sababini kiriting:</label>
                    <textarea id="customConfirmReason" rows="3" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:14px;resize:vertical;outline:none;" placeholder="Qisqacha izoh..."></textarea>
                </div>` : ''}
                <div style="display:flex;gap:12px;">
                    <button id="customConfirmCancel" style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;">${cancelText}</button>
                    <button id="customConfirmOk" style="flex:1;background:#ef4444;color:white;border:none;padding:12px;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;">${confirmText}</button>
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
    try {
        const cachedData = localStorage.getItem('myFullRecords');
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed)) {
                myFullRecords = parsed;
                myFilteredRecords = [...myFullRecords];
                console.log('✅ Cache dan yuklandi:', myFullRecords.length, 'ta amal');
                return true;
            }
        }
    } catch (e) {
        console.error('❌ Cache parsing xatosi:', e);
        try { localStorage.removeItem('myFullRecords'); } catch (e2) { }
    }
    return false;
}

function saveCacheData(data) {
    try {
        localStorage.setItem('myFullRecords', JSON.stringify(data));
        console.log('✅ Cache saqlandi');
    } catch (e) {
        if (e.name === 'QuotaExceededError') console.warn('⚠️ localStorage quota to\'lgan');
        else console.error('❌ Cache save xatosi:', e);
    }
}

async function initializeApp() {
    try {
        const firstName = user ? user.first_name : 'Xodim';
        document.getElementById('greeting').innerText = `Salom, ${firstName}!`;
        const cacheLoaded = loadCachedData();
        if (cacheLoaded && myFullRecords.length > 0) {
            if (typeof initMyFilters === 'function') initMyFilters();
        }
        console.log('🔄 Server dan ma\'lumot yuklanyapti...');
        const data = await apiRequest({
            action: 'init',
            firstName: user ? (user.first_name || '') : '',
            lastName: user ? (user.last_name || '') : '',
            tgUsername: user ? (user.username || '') : ''
        }, { timeoutMs: 30000 });

        if (data && data.success) {
            myFullRecords = data.data || [];
            saveCacheData(myFullRecords);
            myFilteredRecords = [...myFullRecords];
            myInList = data.inList || false;
            myCanAdd = data.canAdd !== false;
            myUsername = data.username || '';
            adminContactId = String(data.adminContactId || '').trim();
            const _empRaw = data.employeeList || {};
            window._kvEmpMap = _empRaw;
            globalEmployeeList = Array.isArray(_empRaw) ? _empRaw : Object.values(_empRaw).filter(Boolean);
            const displayName = myUsername || firstName;
            document.getElementById('greeting').innerText = `Salom, ${displayName}!`;
            if (data.isSuperAdmin) myRole = 'SuperAdmin';
            else if (data.isAdmin) myRole = 'Admin';
            else if (data.isDirector || data.isDirektor) myRole = 'Direktor';
            else myRole = 'User';
            const asBool = (v) => v === true || v === 1 || String(v || '') === '1' || String(v || '').toLowerCase() === 'true';
            if (myRole === 'SuperAdmin') {
                myPermissions = {
                    canViewAll: true, canEdit: true, canDelete: true, canExport: true, canViewDash: true,
                    positions: data.positions || [], workflowConfig: data.workflowConfig || [], allPositions: data.allPositions || []
                };
            } else {
                const p = data.permissions || {};
                myPermissions = {
                    canViewAll: asBool(p.canViewAll), canEdit: asBool(p.canEdit), canDelete: asBool(p.canDelete),
                    canExport: asBool(p.canExport), canViewDash: asBool(p.canViewDash), positions: data.positions || [],
                    workflowConfig: data.workflowConfig || [], allPositions: data.allPositions || []
                };
            }
            if (typeof updateTechnicalPositions === 'function') updateTechnicalPositions(data.allPositions || []);
            canViewCompanyActions = myRole === 'SuperAdmin' || myPermissions.canViewAll;
            canExportCompanyData = myRole === 'SuperAdmin' || (myPermissions.canViewAll && myPermissions.canExport);
            if (typeof populateKvadratMeta === 'function') populateKvadratMeta(globalEmployeeList);
            if (myRole === 'SuperAdmin' || myRole === 'Admin') {
                const navAdmin = document.getElementById('nav-admin');
                if (navAdmin) navAdmin.classList.remove('hidden');
            }
            setSelfCheckButtonsVisibility(myRole === 'SuperAdmin' || myRole === 'Admin');
            setCompanyExportVisibility(canExportCompanyData);
            updateContactAdminButton();
            if (data.autoAdded) showToastMsg("✅ Siz ro'yxatga qo'shildingiz. Ruxsat uchun admin bilan bog'laning.");
            if (typeof initMyFilters === 'function') initMyFilters();
            _appInitialized = true; _appInitRetries = 0;
        } else { throw new Error(data?.error || 'Init xatosi'); }
    } catch (error) {
        console.error('❌ Init xatosi:', error);
        if (_appInitRetries < MAX_INIT_RETRIES) {
            _appInitRetries++;
            const delay = 2000 * _appInitRetries;
            setTimeout(initializeApp, delay);
            showToastMsg(`⚠️ Qayta urinish... (${_appInitRetries}/${MAX_INIT_RETRIES})`);
        } else {
            _appInitialized = false;
            showToastMsg('❌ ' + (error.message || "Server bilan bog'lanib bo'mladi"), true);
            if (myFullRecords.length > 0) showToastMsg('📱 Offline rejimda ishlayapti (cache ma\'lumotlar)', false);
        }
    }
}

window.addEventListener('load', initializeApp);

function switchTab(tabId, navId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (navId !== 'nav-add') {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
    }
    if (tabId === 'adminTab') initAdminTab();
    if (tabId === 'dashboardTab') initDashboardTab();
    if (tabId === 'kvadratTab') initKvadratTab();
    if (tabId === 'kvDashboardTab' && typeof renderKvDashboardPage === 'function') renderKvDashboardPage();
    if (tabId === 'addTab') checkAddPermission();
    if (typeof updateKvFabVisibility === 'function') updateKvFabVisibility();
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
        switchTab('reportTab', 'nav-report'); return;
    }
    const navHodimlar = document.getElementById('adminNavHodimlar');
    const navNotify = document.getElementById('adminNavNotify');
    const navService = document.getElementById('adminNavService');
    if (navHodimlar) navHodimlar.classList.toggle('hidden', !isSuperAdmin);
    if (isSuperAdmin && navHodimlar) switchAdminSub('adminHodimlarArea', navHodimlar);
    else if (navNotify) switchAdminSub('adminNotifyArea', navNotify);
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

function switchAdminSub(areaId, btn) {
    if ((areaId === 'adminHodimlarArea' || areaId === 'adminWorkflowArea' || areaId === 'adminPositionsArea') && myRole !== 'SuperAdmin') {
        showToastMsg('❌ Faqat SuperAdmin uchun', true); return;
    }
    ['adminHodimlarArea', 'adminWorkflowArea', 'adminPositionsArea', 'adminNotifyArea', 'adminServiceArea'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.admin-sub-btn').forEach(b => b.classList.remove('active'));
    if (document.getElementById(areaId)) document.getElementById(areaId).classList.remove('hidden');
    if (btn) btn.classList.add('active');
    if (areaId === 'adminHodimlarArea') loadHodimlar();
    if (areaId === 'adminWorkflowArea' && typeof initWorkflowAdmin === 'function') initWorkflowAdmin();
    if (areaId === 'adminPositionsArea' && typeof initPositionsUI === 'function') initPositionsUI(myPermissions.allPositions);
    if (areaId === 'adminNotifyArea') { loadNotifyTargets(); loadReminderTextSettings(); cancelReminderSend(); }
    if (areaId === 'adminServiceArea') { setNotifyStatus('', false, 'admin_service'); }
}

function toggleRate() {
    const isUsd = document.getElementById('currency').value === 'USD';
    document.getElementById('rateDiv').classList.toggle('hidden', !isUsd);
}

/**
 * Custom Confirmation Modal for WebApp interface
 */
function showConfirmModal(message, onConfirm) {
    const modalId = 'customConfirmModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
        <div id="${modalId}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:99999; animation:fadeConfirm .2s ease;">
            <div style="background:#fff; width:90%; max-width:340px; border-radius:24px; padding:28px; box-shadow:0 20px 50px rgba(0,0,0,0.3); animation:popConfirm .3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                <div style="font-size:54px; text-align:center; margin-bottom:20px;">⚠️</div>
                <div style="font-size:17px; font-weight:800; color:#0F172A; text-align:center; margin-bottom:12px; line-height:1.5; font-family:sans-serif;">${message.replace(/\n/g, '<br>')}</div>
                <p style="font-size:14px; color:#64748B; text-align:center; margin-bottom:24px; font-weight:500;">Ushbu amalni davom ettirmoqchimisiz?</p>
                <div style="display:flex; gap:12px;">
                    <button id="modalNo" style="flex:1; padding:14px; border-radius:14px; border:1.5px solid #E2E8F0; background:#fff; color:#64748B; font-weight:700; cursor:pointer; font-size:15px; transition:all .2s;">Yo'q</button>
                    <button id="modalYes" style="flex:1; padding:14px; border-radius:14px; border:none; background:#0F172A; color:#fff; font-weight:700; cursor:pointer; font-size:15px; box-shadow:0 8px 20px rgba(15,23,42,0.25); transition:all .2s;">Ha, saqlash</button>
                </div>
            </div>
        </div>
        <style>
            @keyframes fadeConfirm { from { opacity: 0; } to { opacity: 1; } }
            @keyframes popConfirm { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            #modalNo:active { transform: scale(0.96); background: #F8FAFC; }
            #modalYes:active { transform: scale(0.96); background: #000; }
        </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('modalYes').onclick = function() {
        document.getElementById(modalId).remove();
        if (onConfirm) onConfirm();
    };
    document.getElementById('modalNo').onclick = function() {
        document.getElementById(modalId).remove();
    };
}