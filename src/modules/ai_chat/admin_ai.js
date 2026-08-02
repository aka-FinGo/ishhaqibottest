/**
 * AI Agent Sozlamalarini yuklash
 */
async function loadAIConfig() {
    const listContainer = document.getElementById('aiConfigList');
    listContainer.innerHTML = '<div class="dash-empty">⏳ Yuklanmoqda...</div>';

    try {
        const res = await apiRequest({ action: 'ai_get_config' });
        if (!res.success) {
            listContainer.innerHTML = `<div class="status-msg error">${res.error}</div>`;
            return;
        }

        renderAIConfigList(res.config.all);
    } catch (e) {
        listContainer.innerHTML = `<div class="status-msg error">Ulanishda xato: ${e.message}</div>`;
    }
}

/**
 * AI Provayderlar ro'yxatini UI-da ko'rsatish
 */
function renderAIConfigList(providers) {
    const container = document.getElementById('aiConfigList');
    container.innerHTML = '';

    if (!providers || providers.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Provayderlar topilmadi.</p>';
        return;
    }

    // Priority bo'yicha tartiblaymiz
    providers.sort((a, b) => a.priority - b.priority);

    providers.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.background = 'var(--comp-period-bg)';
        card.style.border = '1px solid var(--border)';
        card.style.marginBottom = '10px';
        card.style.padding = '15px';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="font-weight:bold; color:var(--cyan-neon);">${p.provider}</div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:10px; color:var(--text-muted);">Aktivmi?</span>
                    <label class="toggle-switch">
                        <input type="checkbox" class="ai-active-check" ${p.isActive ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
            
            <div class="input-group">
                <label style="font-size:11px;">Model Nomi:</label>
                <input type="text" class="ai-model-input" value="${p.model}" placeholder="Masalan: gpt-4, llama3...">
            </div>
            
            <div class="input-group">
                <label style="font-size:11px;">API Kalit:</label>
                <input type="password" class="ai-key-input" value="${p.apiKey}" placeholder="sk-...">
            </div>

            <div class="input-group">
                <label style="font-size:11px;">Tizim Ko'rsatmasi (System/Custom Prompt):</label>
                <textarea class="ai-prompt-input" rows="4" placeholder="Sen kuchli tizim adminisan...">${escapeHtml(p.customPrompt || '')}</textarea>
            </div>

            <div style="display:flex; gap:10px;">
                <div class="input-group" style="flex:1;">
                    <label style="font-size:11px;">Priority:</label>
                    <input type="number" class="ai-priority-input" value="${p.priority}" min="1" max="99">
                </div>
                <div class="input-group" style="flex:2;">
                    <label style="font-size:11px;">Base URL:</label>
                    <input type="text" class="ai-url-input" value="${p.baseURL}" placeholder="https://api...">
                </div>
            </div>
            <input type="hidden" class="ai-provider-name" value="${p.provider}">
        `;
        container.appendChild(card);
    });
}

/**
 * AI Sozlamalarini saqlash
 */
async function saveAIConfigUI() {
    const container = document.getElementById('aiConfigList');
    const cards = container.querySelectorAll('.card');
    const config = [];

    cards.forEach(card => {
        config.push({
            provider: card.querySelector('.ai-provider-name').value,
            model:    card.querySelector('.ai-model-input').value,
            apiKey:   card.querySelector('.ai-key-input').value,
            priority: parseInt(card.querySelector('.ai-priority-input').value) || 99,
            isActive: card.querySelector('.ai-active-check').checked,
            baseURL:  card.querySelector('.ai-url-input').value,
            customPrompt: card.querySelector('.ai-prompt-input').value
        });
    });

    tg.MainButton.setText('SAQLANMOQDA...').show().disable();

    try {
        const res = await apiRequest({ action: 'ai_save_config', config: config });
        if (res.success) {
            tg.showAlert('AI Sozlamalari saqlandi! ✅');
            loadAIConfig(); // Qayta yuklash
        } else {
            tg.showAlert('Xato: ' + res.error);
        }
    } catch (e) {
        tg.showAlert('Xato: ' + e.message);
    } finally {
        tg.MainButton.hide();
    }
}

/**
 * AI Hisobotini qo'lda ishga tushirish (Test)
 */
async function runAIReportTest() {
    const status = document.getElementById('aiTestStatus');
    status.className = 'status-msg';
    status.innerText = '🚀 Jarayon boshlandi...';

    try {
        const res = await apiRequest({ action: 'ai_run_report' });
        if (res.success) {
            status.className = 'status-msg success';
            status.innerText = '✅ ' + res.message;
        } else {
            status.className = 'status-msg error';
            status.innerText = '❌ Xato: ' + res.error;
        }
    } catch (e) {
        status.className = 'status-msg error';
        status.innerText = '❌ Xato: ' + e.message;
    }
}

// AI Agent Sozlamalarini ochish/yopish
function toggleAiSettings() {
    const block = document.getElementById('aiSettingsBlock');
    const chevron = document.getElementById('aiSettingsChevron');
    if (block.classList.contains('hidden')) {
        block.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)';
        // agar hali yuklanmagan bo'lsa
        if (document.getElementById('aiConfigList').innerHTML.includes('js-skeleton-card')) {
            loadAIConfig();
        }
    } else {
        block.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)';
    }
}
// ── YERLIK AI CHAT MANTIG'I ──────────────────────────────────────────
let aiChatHistory = [];
let isAiLoading = false;

function openFullAiChat() {
    // Tabni almashtiramiz
    switchTab('aiChatTab', 'nav-profile');
    
    // Agar chat bosh bo'lsa, xush kelibsiz xabarni qo'shamiz
    if (aiChatHistory.length === 0) {
        // scopeLabel ni sozlash
        const scopeLabel = document.getElementById('indexAiScopeLabel');
        const isCompany = typeof currentUser !== 'undefined' && (currentUser.isSuperAdmin || currentUser.isDirector);
        if (scopeLabel) {
            scopeLabel.textContent = isCompany ? "📊 Kompaniya ma'lumotlari bilan" : "👤 Faqat o'z ma'lumotlarim";
        }
        
        let welcomeMsg = 'Salom! Men Aristokrat ERP AI yordamchisiman. ';
        welcomeMsg += isCompany ? 'Kompaniya ma\'lumotlari bo\'yicha savollar bering.' : 'O\'z yozuvlaringiz bo\'yicha savollar bering.';
        addAiBubble('assistant', welcomeMsg);
        
        // Enter bosilganda jo'natish
        const input = document.getElementById('aiChatInput');
        if (input) {
            // FAQAT Bitta event listener qo'shish uchun eski clone qilib olish mumkin, lekin oddiy holatda osonroq yo'li:
            input.onkeydown = function(e) {
                if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    sendAiMsg(); 
                }
            };
        }
    }
}

async function sendAiMsg() {
    if (isAiLoading) return;
    const input = document.getElementById('aiChatInput');
    const text = input.value.trim();
    if (!text) return;
    
    addAiBubble('user', text);
    aiChatHistory.push({ role: 'user', content: text });
    input.value = ''; 
    input.style.height = 'auto';
    
    const thinkId = addAiThinking();
    setAiLoading(true);
    
    try {
        const isCompany = typeof currentUser !== 'undefined' && (currentUser.isSuperAdmin || currentUser.isDirector);
        const chatScope = isCompany ? 'company' : 'own';
        
        const res = await apiRequest({
            action: 'ai_chat',
            message: text,
            history: aiChatHistory.slice(-10),
            scope: chatScope,
            telegramId: typeof telegramId !== 'undefined' ? telegramId : ''
        }, { timeoutMs: 40000 });
        
        removeAiThinking(thinkId);
        
        if (res.success) {
            addAiBubble('assistant', res.reply);
            aiChatHistory.push({ role: 'assistant', content: res.reply });
        } else {
            addAiError(res.error || 'AI javob bermadi');
        }
    } catch(e) {
        removeAiThinking(thinkId);
        addAiError(navigator.onLine ? e.message : "📵 Internet yo'q");
    } finally { 
        setAiLoading(false); 
    }
}

function quickAskAi(text) {
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = text;
        sendAiMsg();
    }
}

function clearAiChat() {
    aiChatHistory.length = 0;
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.innerHTML = '';
    
    const isCompany = typeof currentUser !== 'undefined' && (currentUser.isSuperAdmin || currentUser.isDirector);
    let welcomeMsg = 'Salom! Men Aristokrat ERP AI yordamchisiman. ';
    welcomeMsg += isCompany ? 'Kompaniya ma\'lumotlari bo\'yicha savollar bering.' : 'O\'z yozuvlaringiz bo\'yicha savollar bering.';
    addAiBubble('assistant', welcomeMsg);
}

function addAiBubble(role, text) {
    const el = document.createElement('div');
    el.className = role === 'user' ? 'ai-chat-bubble ai-chat-bubble--user' : 'ai-chat-bubble ai-chat-bubble--ai ai-chat-bubble--in';
    el.innerHTML = role === 'user' ? escapeHtml(text) : formatAI(text);
    const msgs = document.getElementById('chatMessages');
    if (msgs) {
        msgs.appendChild(el);
        scrollAiDown();
    }
}

function addAiThinking() {
    const id = 'think-' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'ai-chat-bubble ai-chat-bubble--ai ai-chat-bubble--thinking';
    el.innerHTML = '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>';
    const msgs = document.getElementById('chatMessages');
    if (msgs) {
        msgs.appendChild(el);
        scrollAiDown(); 
    }
    return id;
}

function removeAiThinking(id) { 
    const el = document.getElementById(id);
    if (el) el.remove(); 
}

function addAiError(msg) {
    const el = document.createElement('div');
    el.className = 'ai-chat-bubble ai-chat-bubble--error';
    el.textContent = '❌ ' + msg;
    const msgs = document.getElementById('chatMessages');
    if (msgs) {
        msgs.appendChild(el);
        scrollAiDown();
    }
}

function setAiLoading(v) {
    isAiLoading = v;
    const btn = document.getElementById('aiChatSendBtn');
    const inp = document.getElementById('aiChatInput');
    if (btn) {
        btn.disabled = v;
        btn.innerHTML = v ? '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>' : '&#9658;';
    }
    if (inp) {
        inp.disabled = v;
    }
}

function scrollAiDown() {
    const m = document.getElementById('chatMessages');
    if (m) {
        requestAnimationFrame(() => { m.scrollTop = m.scrollHeight; });
    }
}

function formatAI(text) {
    let s = escapeHtml(text);
    s = s.replace(/```([\s\S]*?)```/g, '<pre class="ai-code">$1</pre>');
    s = s.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n/g, '<br>');
    return s;
}

function autoResizeAi(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
