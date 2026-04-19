let globalEmployeeList=[];

// Helpers
function formatRelativeDate(dateStr) {
    if(!dateStr) return 'Sana kiritilmagan';
    const parts = dateStr.split('.');
    if(parts.length !== 3) return dateStr;
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if(isNaN(d.getTime())) return dateStr;
    const today = new Date();
    today.setHours(0,0,0,0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = (today - d) / msPerDay;

    if(diff === 0) return 'Bugun';
    if(diff === 1) return 'Kecha';

    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    return `${parseInt(parts[0])}-${monthNames[parseInt(parts[1])-1]}`;
}

function showCustomConfirm(title, message, confirmText, cancelText, requireReason, onConfirm, onCancel) {
    const overlayId = 'customConfirmOverlay';
    let overlay = document.getElementById(overlayId);
    if(overlay) overlay.remove();

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
    if(rs) rs.focus();

    document.getElementById('customConfirmCancel').onclick = () => {
        document.getElementById(overlayId).remove();
        if(onCancel) onCancel();
    };
    document.getElementById('customConfirmOk').onclick = () => {
        let reason = '';
        if(requireReason) {
            reason = document.getElementById('customConfirmReason').value.trim();
            if(!reason) return showToastMsg('❌ Sabab kiritilishi shart', true);
        }
        document.getElementById(overlayId).remove();
        onConfirm(reason);
    };
}

window.onload=async ()=>{
    const firstName=user ? user.first_name:'Xodim';
    document.getElementById('greeting').innerText=`Salom,${firstName}!`;
    
    try {
        const cachedData = localStorage.getItem('myFullRecords');
        if (cachedData) {
            myFullRecords = JSON.parse(cachedData);
            myFilteredRecords = [...myFullRecords];
            if (typeof initMyFilters === 'function' && myFullRecords.length > 0) {
                initMyFilters();
            }
        }
    } catch(e) {}

    try {
        const data=await apiRequest({
            action:'init',
            firstName:user ? (user.first_name||''):'',
            lastName:user ? (user.last_name||''):'',
            tgUsername:user ? (user.username||''):''
        });
        if (data.success){
            myFullRecords=data.data||[];
            localStorage.setItem('myFullRecords', JSON.stringify(myFullRecords));
            myFilteredRecords=[...myFullRecords];
            myInList=data.inList||false;
            myCanAdd=data.canAdd!==false;
            myUsername=data.username||'';
            adminContactId=String(data.adminContactId||'').trim();
            const _empRaw=data.employeeList||{};
            window._kvEmpMap=_empRaw;
            globalEmployeeList=Array.isArray(_empRaw) ? _empRaw:Object.values(_empRaw).filter(Boolean);
            const displayName=myUsername||firstName;
            document.getElementById('greeting').innerText=`Salom,${displayName}!`;
            if (data.isSuperAdmin) myRole='SuperAdmin';
            else if (data.isAdmin) myRole='Admin';
            else if (data.isDirector||data.isDirektor) myRole='Direktor';
            else myRole='User';
            const asBool=function (v){return v===true||v===1||String(v||'')==='1'||String(v||'').toLowerCase()==='true';};
            if (myRole==='SuperAdmin'){
                myPermissions={canViewAll:true,canEdit:true,canDelete:true,canExport:true,canViewDash:true,positions:data.positions||[],workflowConfig:data.workflowConfig||[],allPositions:data.allPositions||[]};
            } else {
                const p=data.permissions||{};
                myPermissions={canViewAll:asBool(p.canViewAll),canEdit:asBool(p.canEdit),canDelete:asBool(p.canDelete),canExport:asBool(p.canExport),canViewDash:asBool(p.canViewDash),positions:data.positions||[],workflowConfig:data.workflowConfig||[],allPositions:data.allPositions||[]};
            }
            if (typeof updateTechnicalPositions==='function'){updateTechnicalPositions(data.allPositions||[]);}
            canViewCompanyActions=myRole==='SuperAdmin'||myPermissions.canViewAll;
            canExportCompanyData=myRole==='SuperAdmin'||(myPermissions.canViewAll&&myPermissions.canExport);
            if (typeof populateKvadratMeta==='function'){populateKvadratMeta(globalEmployeeList);}
            if (myRole==='SuperAdmin'||myRole==='Admin'){document.getElementById('nav-admin').classList.remove('hidden');}
            setSelfCheckButtonsVisibility(myRole==='SuperAdmin'||myRole==='Admin');
            setCompanyExportVisibility(canExportCompanyData);
            updateContactAdminButton();
            if (data.autoAdded){showToastMsg("✅ Siz ro'yxatga qo'shildingiz. Ruxsat uchun admin bilan bog'laning.");}
            initMyFilters();
        } else {
            showToastMsg('❌ '+(data.error||'Init xatosi'),true);
        }
    } catch (e) {
        console.error('Init xato:',e);
        showToastMsg('❌ Server bilan bog\'lanib bo\'lmadi',true);
    }
};function switchTab(tabId,navId){document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));const tabEl=document.getElementById(tabId);if (tabEl) tabEl.classList.add('active');document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));if (navId!=='nav-add'){const el=document.getElementById(navId);if (el) el.classList.add('active');}if (tabId==='adminTab') initAdminTab();if (tabId==='dashboardTab') initDashboardTab();if (tabId==='kvadratTab'){console.log("Switching to kvadrat tab,initializing...");initKvadratTab();}if (tabId==='kvDashboardTab'&&typeof renderKvDashboardPage==='function') renderKvDashboardPage();if (tabId==='addTab'){checkAddPermission();}if (typeof updateKvFabVisibility==='function'){updateKvFabVisibility();}}function handleFabAction(){const activeTab=document.querySelector('.tab-content.active');if (activeTab&&activeTab.id==='kvadratTab'){openKvModal();}else{switchTab('addTab','nav-add');}}function setSelfCheckButtonsVisibility(canRunSelfCheck){['selfCheckBtnAdmin'].forEach(function (id){const btn=document.getElementById(id);if (btn) btn.style.display=canRunSelfCheck ? '':'none';});}function setCompanyExportVisibility(canExport){const btn=document.getElementById('companyExportBtn');if (btn) btn.style.display=canExport ? '':'none';}function updateContactAdminButton(){const btn=document.getElementById('contactAdminBtn');if (!btn) return;btn.classList.toggle('hidden',!adminContactId);}function contactAdmin(){if (!adminContactId){showToastMsg('❌ Admin kontakti topilmadi',true);return;}const deepLink='tg://user?id='+encodeURIComponent(adminContactId);window.location.href=deepLink;}function initAdminTab(){const isSuperAdmin=myRole==='SuperAdmin';const canUseAdminPanel=isSuperAdmin||myRole==='Admin';if (!canUseAdminPanel){showToastMsg('❌ Admin panel ruxsati yo\'q',true);switchTab('reportTab','nav-report');return;}const navHodimlar=document.getElementById('adminNavHodimlar');const navNotify=document.getElementById('adminNavNotify');const navService=document.getElementById('adminNavService');if (navHodimlar) navHodimlar.classList.toggle('hidden',!isSuperAdmin);if (navNotify) navNotify.classList.remove('hidden');if (navService) navService.classList.remove('hidden');if (isSuperAdmin&&navHodimlar){switchAdminSub('adminHodimlarArea',navHodimlar);}else if (navNotify){switchAdminSub('adminNotifyArea',navNotify);}else if (navService){switchAdminSub('adminServiceArea',navService);}}function initDashboardTab(){if (!canViewCompanyActions){const actionsArea=document.getElementById('dashboardActionsArea');const chartsArea=document.getElementById('dashboardChartsArea');if (actionsArea) actionsArea.classList.add('hidden');if (chartsArea) chartsArea.classList.remove('hidden');document.getElementById('dashTopCharts').classList.add('active');document.getElementById('dashTopActions').classList.remove('active');loadDashboard();return;}switchDashboardSub('dashboardActionsArea',document.getElementById('dashTopActions'));}function switchDashboardSub(areaId,btn){['dashboardActionsArea','dashboardChartsArea'].forEach(id=>{const el=document.getElementById(id);if (el) el.classList.add('hidden');});document.querySelectorAll('.dash-sub-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('#dashboardTab .page-switcher-btn').forEach(b=>b.classList.remove('active'));const target=document.getElementById(areaId);if (target) target.classList.remove('hidden');if (btn) btn.classList.add('active');const topBtnId=areaId==='dashboardActionsArea' ? 'dashTopActions':'dashTopCharts';const topBtn=document.getElementById(topBtnId);if (topBtn) topBtn.classList.add('active');if (areaId==='dashboardActionsArea') loadAdminData();if (areaId==='dashboardChartsArea') loadDashboard();}function checkAddPermission(){if (!myInList){showPermWarning( '⚠️ Siz tizimda ro\'yxatdan o\'tmagan xodimsiz!','Amal qo\'shish uchun SuperAdminga murojaat qiling va tizimga qo\'shilishingizni so\'rang.' );return false;}if (!myCanAdd){showPermWarning( '🚫 Amal qo\'shish ruxsati yo\'q!','Sizda hozircha amal qo\'shish huquqi berilmagan. SuperAdminga murojaat qiling.' );return false;}document.getElementById('permWarning').classList.add('hidden');document.getElementById('addFormContent').classList.remove('hidden');return true;}function showPermWarning(title,desc){document.getElementById('addFormContent').classList.add('hidden');const w=document.getElementById('permWarning');w.classList.remove('hidden');document.getElementById('permWarnTitle').innerText=title;document.getElementById('permWarnDesc').innerText=desc;updateContactAdminButton();if (tg&&tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');}function showToastMsg(msg,isErr=false){let t=document.getElementById('toast');if (!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}t.innerText=msg;t.className='toast'+(isErr ? ' toast-err':'');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}function switchAdminSub(areaId,btn){if ((areaId==='adminHodimlarArea'||areaId==='adminWorkflowArea'||areaId==='adminPositionsArea')&&myRole!=='SuperAdmin'){showToastMsg('❌ Bu bo\'lim faqat SuperAdmin uchun',true);return;}['adminHodimlarArea','adminWorkflowArea','adminPositionsArea','adminNotifyArea','adminServiceArea'].forEach(id=>{const el=document.getElementById(id);if (el) el.classList.add('hidden');});document.querySelectorAll('.admin-sub-btn').forEach(b=>b.classList.remove('active'));const target=document.getElementById(areaId);if (target) target.classList.remove('hidden');if (btn) btn.classList.add('active');if (areaId==='adminHodimlarArea') loadHodimlar();if (areaId==='adminWorkflowArea'){if (typeof initWorkflowAdmin==='function') initWorkflowAdmin();}if (areaId==='adminPositionsArea'){if (typeof initPositionsUI==='function') initPositionsUI(myPermissions.allPositions);}if (areaId==='adminNotifyArea'){loadNotifyTargets();loadReminderTextSettings();cancelReminderSend();setNotifyStatus('',false,'admin');}if (areaId==='adminServiceArea'){setNotifyStatus('',false,'admin_service');}}function toggleRate(){const isUsd=document.getElementById('currency').value==='USD';document.getElementById('rateDiv').classList.toggle('hidden',!isUsd);}