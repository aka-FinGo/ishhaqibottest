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
            baseURL:  card.querySelector('.ai-url-input').value
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

