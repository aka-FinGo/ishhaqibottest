// ============================================================
// ADMIN_AI_CHAT.JS — Webapp ichida AI suhbat paneli
// Faqat SuperAdmin va Direktor uchun
// Chat tarixi: faqat sessiya ichida (xotiraga)
// ============================================================

// Sessiya xotirasi — sahifa yopilsa tozalanadi
const AiChat = {
    history: [],       // { role: 'user'|'assistant', content: '...' }
    isLoading: false,
    contextScope: 'own' // 'own' | 'company' — ruxsatga qarab
};

// ============================================================
// INIT
// ============================================================

function initAIChatArea() {
    // Ruxsat tekshirish
    const canUse = (myRole === 'SuperAdmin' || myRole === 'Direktor' || myRole === 'Admin');
    if (!canUse) {
        showToastMsg('❌ AI Chat ruxsati yo\'q', true);
        return;
    }

    // Kontekst doirasi: SuperAdmin/Direktor kompaniya ma'lumotlarini ko'ra oladi
    AiChat.contextScope = (myRole === 'SuperAdmin' || myRole === 'Direktor') ? 'company' : 'own';

    // Agar allaqachon render qilingan bo'lsa qayta render qilmaymiz
    const container = document.getElementById('aiChatMessages');
    if (container && container.dataset.initialized === '1') return;

    _renderChatHistory();

    // Keyboard: Enter yuborish, Shift+Enter yangi qator
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAIChat();
            }
        });
    }

    if (container) container.dataset.initialized = '1';

    // Xush kelibsiz xabar (faqat birinchi marta)
    if (AiChat.history.length === 0) {
        _addAssistantBubble(
            'Salom! Men Aristokrat ERP AI yordamchisiman. ' +
            (AiChat.contextScope === 'company'
                ? 'Kompaniya ma\'lumotlari (moliya, hodimlar, kvadratlar) bo\'yicha savollar bering.'
                : 'O\'z yozuvlaringiz bo\'yicha savollar bering.'),
            false
        );
    }
}

// ============================================================
// XABAR YUBORISH
// ============================================================

async function sendAIChat() {
    if (AiChat.isLoading) return;

    const input = document.getElementById('aiChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Foydalanuvchi pufakchasini qo'shamiz
    _addUserBubble(text);
    AiChat.history.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';

    // AI javob skeleton
    const thinkingId = _addThinkingBubble();
    AiChat.isLoading = true;
    _setChatSendState(true);

    try {
        const res = await apiRequest({
            action: 'ai_chat',
            message: text,
            history: AiChat.history.slice(-10), // Oxirgi 10 xabar kontekst uchun
            scope: AiChat.contextScope
        }, { timeoutMs: 40000 });

        _removeThinkingBubble(thinkingId);

        if (res.success) {
            _addAssistantBubble(res.reply, true);
            AiChat.history.push({ role: 'assistant', content: res.reply });
        } else {
            _addErrorBubble(res.error || 'AI javob bermadi');
        }
    } catch (e) {
        _removeThinkingBubble(thinkingId);
        _addErrorBubble(
            navigator.onLine
                ? ('Xato: ' + e.message)
                : '📵 Internet yo\'q. Ulanib qayta urinib ko\'ring.'
        );
    } finally {
        AiChat.isLoading = false;
        _setChatSendState(false);
    }
}

function clearAIChat() {
    AiChat.history = [];
    const container = document.getElementById('aiChatMessages');
    if (container) {
        container.innerHTML = '';
        container.dataset.initialized = '0';
    }
    initAIChatArea();
}

// ============================================================
// UI YORDAMCHI FUNKSIYALAR
// ============================================================

function _renderChatHistory() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    container.innerHTML = '';
    AiChat.history.forEach(msg => {
        if (msg.role === 'user') _addUserBubble(msg.content);
        else _addAssistantBubble(msg.content, false);
    });
}

function _addUserBubble(text) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ai-chat-bubble ai-chat-bubble--user';
    div.textContent = text;
    container.appendChild(div);
    _scrollChatToBottom();
}

function _addAssistantBubble(text, animate) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ai-chat-bubble ai-chat-bubble--ai' + (animate ? ' ai-chat-bubble--in' : '');
    div.innerHTML = _formatAIText(text);
    container.appendChild(div);
    _scrollChatToBottom();
    return div;
}

function _addErrorBubble(msg) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ai-chat-bubble ai-chat-bubble--error';
    div.textContent = '❌ ' + msg;
    container.appendChild(div);
    _scrollChatToBottom();
}

function _addThinkingBubble() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return null;
    const id = 'ai-thinking-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'ai-chat-bubble ai-chat-bubble--ai ai-chat-bubble--thinking';
    div.innerHTML = '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>';
    container.appendChild(div);
    _scrollChatToBottom();
    return id;
}

function _removeThinkingBubble(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
}

function _setChatSendState(loading) {
    const btn = document.getElementById('aiChatSendBtn');
    const input = document.getElementById('aiChatInput');
    if (btn) {
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>'
            : '&#9658;';
    }
    if (input) input.disabled = loading;
}

function _scrollChatToBottom() {
    const container = document.getElementById('aiChatMessages');
    if (container) {
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }
}

/**
 * AI javobidagi oddiy formatlash:
 * **bold** → <strong>, \n → <br>, kod bloklar → <code>
 */
function _formatAIText(text) {
    if (!text) return '';
    let s = escapeHtml(text);
    // Kod blok ```...```
    s = s.replace(/```([\s\S]*?)```/g, '<pre class="ai-code">$1</pre>');
    // Inline kod `...`
    s = s.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
    // **bold**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Yangi qator
    s = s.replace(/\n/g, '<br>');
    return s;
}

// Textarea auto-resize
function aiChatInputResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/**
 * Tezkor savol tugmasi bosilganda inputga yozib avtomatik yuboradi
 */
function aiQuickAsk(text) {
    const input = document.getElementById('aiChatInput');
    if (!input) return;
    input.value = text;
    aiChatInputResize(input);
    sendAIChat();
}
