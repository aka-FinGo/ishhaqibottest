// ============================================================
// ADMIN_AI_CHAT.JS — AI Chat iframe boshqaruvi
// v1.0.24
// AI Chat alohida ai_chat.html sahifasida ishlaydi.
// Bu fayl: ruxsat tekshirish + iframe yuklash + postMessage.
// ============================================================

let _aiChatLoaded = false;
let _aiChatInitSent = false;

// ============================================================
// TAB OCHILGANDA
// ============================================================

async function initAIChatArea() {
    // Ruxsat tekshirish (frontend)
    const canUse = myPermissions?.canViewAIChat || myRole === 'SuperAdmin';
    if (!canUse) {
        document.getElementById('aiChatNoAccess').style.display = 'block';
        document.getElementById('aiChatFrame').style.display = 'none';
        // AI Chat tugmasini yashiramiz
        const navBtn = document.getElementById('adminNavAIChat');
        if (navBtn) navBtn.style.display = 'none';
        return;
    }

    document.getElementById('aiChatNoAccess').style.display = 'none';
    const frame = document.getElementById('aiChatFrame');
    if (!frame) return;

    if (!_aiChatLoaded) {
        // Iframe yuklanmagan — yuklaymiz
        frame.style.display = 'block';

        frame.onload = () => {
            _aiChatLoaded = true;
            _sendInitToFrame();
        };
        frame.src = './ai_chat.html?v=1.0.24';
    } else {
        // Allaqachon yuklangan — faqat init yuboramiz
        frame.style.display = 'block';
        _sendInitToFrame();
    }
}

function _sendInitToFrame() {
    const frame = document.getElementById('aiChatFrame');
    if (!frame?.contentWindow) return;
    const isCompany = myRole === 'SuperAdmin' || myRole === 'Direktor';
    frame.contentWindow.postMessage({
        type:     'AI_CHAT_INIT',
        tgId:     myTelegramId || '',
        scope:    isCompany ? 'company' : 'own',
        username: myUsername  || ''
    }, '*');
}

// iframe dan kelgan xabarlarni ushlaymiz
window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'AI_CHAT_READY') {
        // iframe tayyor — init yuboramiz
        _sendInitToFrame();
    }
    if (e.data.type === 'AI_CHAT_BACK') {
        // iframe dan "orqaga" signali — oldingi tabga
        const prevBtn = document.getElementById('adminNavHodimlar');
        if (prevBtn) prevBtn.click();
    }
});

// ============================================================
// RUXSAT BOSHQARISH (SuperAdmin uchun)
// ============================================================

let _aiChatUsersList = [];

async function loadAIChatUsers() {
    const listEl = document.getElementById('aiChatUsersList');
    if (!listEl) return;
    try {
        const data = await apiRequest({ action: 'get_ai_chat_users' });
        if (!data.success) return;
        _aiChatUsersList = data.tgIds || [];
        renderAIChatUsers(listEl);
    } catch(e) {
        handleApiError(e, 'loadAIChatUsers');
    }
}

function renderAIChatUsers(listEl) {
    if (!listEl) return;
    if (!_aiChatUsersList.length) {
        listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px;">Hech kim qo\'shilmagan (SuperAdmin doim kiradi)</div>';
        return;
    }
    listEl.innerHTML = _aiChatUsersList.map(tgId => {
        const emp = globalEmployeeList.find(e => String(e.tgId) === String(tgId));
        const name = emp ? (emp.username || tgId) : tgId;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:8px;background:var(--surface);margin-bottom:6px;">
            <span style="font-size:13px;color:var(--text);">👤 ${escapeHtml(name)}</span>
            <button onclick="revokeAIChatUser('${tgId}')"
                style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;color:var(--text-muted);cursor:pointer;">✖ Olib tashlash</button>
        </div>`;
    }).join('');
}

async function grantAIChatUser() {
    const sel = document.getElementById('aiChatGrantSelect');
    if (!sel) return;
    const tgId = sel.value;
    if (!tgId) { showToastMsg('Foydalanuvchi tanlang', true); return; }
    try {
        const data = await apiRequest({ action: 'set_ai_chat_user', targetTgId: tgId, grant: true });
        if (data.success) {
            _aiChatUsersList = data.tgIds;
            renderAIChatUsers(document.getElementById('aiChatUsersList'));
            showToastMsg('✅ Ruxsat berildi');
        }
    } catch(e) { handleApiError(e, 'grantAIChatUser'); }
}

async function revokeAIChatUser(tgId) {
    try {
        const data = await apiRequest({ action: 'set_ai_chat_user', targetTgId: tgId, grant: false });
        if (data.success) {
            _aiChatUsersList = data.tgIds;
            renderAIChatUsers(document.getElementById('aiChatUsersList'));
            showToastMsg('🔕 Ruxsat olib tashlandi');
        }
    } catch(e) { handleApiError(e, 'revokeAIChatUser'); }
}
