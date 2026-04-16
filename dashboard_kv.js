// ============================================================
// dashboard_kv.js — Kvadratlar Dashboard Logic
// ============================================================

let kvDashboardRecords = []; // Global records cache
let kvChartStatus = null;
let kvChartTrends = null;
let kvChartSteps = null;
let kvChartWorkers = null;

const _kvCharts = {};
function destroyKvChart(id) { if (_kvCharts[id]) { _kvCharts[id].destroy(); delete _kvCharts[id]; } }

const KV_PALETTE   = ['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];
const KV_MONTHS_SHORT = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];

const KV_BF = { family: "'Plus Jakarta Sans',sans-serif" };
const KV_TC = { font: { ...KV_BF, size: 11 }, color: '#64748B' };
const KV_TU = { callbacks: { label: c => ` ${c.dataset.label || ''}: ${Number(c.raw).toLocaleString()} m²` } };
const KV_tickCb = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v;

// Helper functions for pro dashboard
function kvSCard(icon, label, val, sub = '', ac = '') {
    return `<div class="dash-stat-card" style="${ac ? 'border-top:3px solid ' + ac : ''}">
        <div class="dash-stat-icon">${icon}</div>
        <div class="dash-stat-body">
            <div class="dash-stat-label">${label}</div>
            <div class="dash-stat-value">${val}</div>
            ${sub ? `<div class="dash-stat-sub">${sub}</div>` : ''}
        </div></div>`;
}

function kvCCard(title, id, h = 220) {
    return `<div class="dash-chart-card">
        <div class="dash-chart-title">${title}</div>
        <div style="position:relative;height:${h}px;"><canvas id="${id}"></canvas></div>
    </div>`;
}

function kvSecTitle(t) { return `<div class="dash-section-title">${t}</div>`; }

function kvMkDonut(id, labels, vals, colors) {
    destroyKvChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    const total = vals.reduce((s, v) => s + v, 0);
    if (!total) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
        options: {
            cutout: '70%',
            animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: { position: 'bottom', labels: { padding: 14, font: { ...KV_BF, size: 11, weight: '600' }, color: '#334155', boxWidth: 10, borderRadius: 3, useBorderRadius: true } },
                tooltip: { callbacks: { label: c => ` ${c.label}: ${Number(c.raw).toLocaleString()} ta` } }
            }
        }
    });
}

function kvMkBar(id, labels, datasets, stacked = false) {
    destroyKvChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            scales: {
                x: { stacked, grid: { display: false }, ticks: KV_TC },
                y: { stacked, grid: { color: '#F1F5F9' }, ticks: { ...KV_TC, callback: KV_tickCb } }
            },
            plugins: {
                legend: { display: datasets.length > 1, labels: { font: { ...KV_BF, size: 11 }, color: '#334155', boxWidth: 10, borderRadius: 3, useBorderRadius: true } },
                tooltip: KV_TU
            }
        }
    });
}

function kvMkHBar(id, labels, vals, colors) {
    destroyKvChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderRadius: 6, borderSkipped: 'start' }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            scales: {
                x: { grid: { color: '#F1F5F9' }, ticks: { ...KV_TC, callback: KV_tickCb } },
                y: { grid: { display: false }, ticks: { font: { ...KV_BF, size: 12, weight: '600' }, color: '#0F172A' } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${Number(c.raw).toLocaleString()} m²` } } }
        }
    });
}

function kvMkLine(id, labels, datasets) {
    destroyKvChart(id);
    const ctx = document.getElementById(id); if (!ctx) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutQuart' },
            scales: {
                x: { grid: { display: false }, ticks: KV_TC },
                y: { grid: { color: '#F1F5F9' }, ticks: { ...KV_TC, callback: KV_tickCb } }
            },
            plugins: {
                legend: { display: datasets.length > 1, labels: { font: { ...KV_BF, size: 11 }, color: '#334155', boxWidth: 10, borderRadius: 3, useBorderRadius: true } },
                tooltip: KV_TU
            }
        }
    });
}

/**
 * Resolves a Telegram UID to a display name.
 * Uses window._kvEmpMap {tgId: username} for reverse lookup.
 */
function _resolveKvName(uid, rec) {
    if (!uid) return (rec && rec.staffName) ? rec.staffName : "Noma'lum";
    const map = window._kvEmpMap || {};
    if (map[uid]) return map[uid];
    
    if (typeof globalEmployeeList !== 'undefined' && Array.isArray(globalEmployeeList)) {
        const emp = globalEmployeeList.find(e => String(e.tgId) === String(uid));
        if (emp && emp.username) return emp.username;
    }
    
    if (rec && rec.ownerTgId && String(uid) === String(rec.ownerTgId)) {
        return rec.staffName;
    }
    
    return String(uid);
}

/**
 * Aggregates m² by WORKFLOW PARTICIPANTS.
 * Each worker who completed a step in the workflow gets credited
 * with that order's totalM2.
 *
 * Example: Loyihachi creates 10m² order, Yig'uvchi claims it,
 * Qadoqlovchi claims it → each gets 10m² credited.
 */
function _aggregateWorkerM2(records) {
    const workerM2 = {};   // workerName → total m²
    const workerOrders = {}; // workerName → count of orders

    if (!Array.isArray(records)) return { workerM2, workerOrders };

    records.forEach(rec => {
        if (!rec) return;
        const m2 = Number(rec.totalM2) || 0;
        if (m2 <= 0) return;

        const logs = Array.isArray(rec.logs) ? rec.logs : [];
        const credited = new Set(); // avoid double-crediting same person on same order

        // Credit each unique participant from the workflow logs
        logs.forEach(log => {
            if (!log) return;
            const uid = String(log.uid || '').trim();
            if (!uid) return;
            const name = _resolveKvName(uid, rec);
            if (credited.has(name)) return;
            credited.add(name);
            workerM2[name] = (workerM2[name] || 0) + m2;
            workerOrders[name] = (workerOrders[name] || 0) + 1;
        });

        // If no logs at all, credit the staffName (creator)
        if (credited.size === 0 && rec.staffName) {
            const name = rec.staffName;
            workerM2[name] = (workerM2[name] || 0) + m2;
            workerOrders[name] = (workerOrders[name] || 0) + 1;
        }
    });

    return { workerM2, workerOrders };
}

/**
 * Gets worker m² for a specific staff filter value.
 * @param {string} staffName
 * @param {Array} [records] — defaults to kvDashboardRecords
 */
function getWorkerM2ForStaff(staffName, records) {
    const recs = records || kvDashboardRecords || [];
    if (!recs.length) return 0;
    const { workerM2 } = _aggregateWorkerM2(recs);
    return workerM2[staffName] || 0;
}

/**
 * Renders the worker stats bar inside #kvWorkerStatsBar on the Kvadrat tab.
 * Uses the FILTERED records so stats match active filters.
 * @param {Array} records — typically kvFilteredRecords
 */
function renderKvWorkerStats(records) {
    const bar = document.getElementById('kvWorkerStatsBar');
    if (!bar) return;

    if (!records || !records.length) {
        bar.innerHTML = '';
        return;
    }

    const { workerM2, workerOrders } = _aggregateWorkerM2(records);
    const sorted = Object.entries(workerM2).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) { bar.innerHTML = ''; return; }

    const maxM2 = sorted[0][1] || 1;

    // Check if a specific staff is selected
    const staffFilterEl = document.getElementById('kvFilterStaff');
    const selectedStaff = staffFilterEl ? staffFilterEl.value : 'all';

    if (selectedStaff !== 'all') {
        // Single worker highlight card
        const val = workerM2[selectedStaff] || 0;
        const orders = workerOrders[selectedStaff] || 0;
        bar.innerHTML = `
        <div style="background:linear-gradient(135deg,#0F172A,#1E40AF); color:#fff; border-radius:14px; padding:14px 16px; margin-bottom:4px;">
            <div style="font-size:11px; opacity:0.7; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">👤 ${escapeHtml(selectedStaff)} — Ish oqimi bo'yicha</div>
            <div style="display:flex; align-items:baseline; gap:10px;">
                <div style="font-size:28px; font-weight:800;">${val.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m²</div>
                <div style="font-size:13px; opacity:0.7;">${orders} ta buyurtma</div>
            </div>
        </div>`;
        return;
    }

    // All workers — compact list
    const medals = ['🥇','🥈','🥉'];
    const rows = sorted.map(([name, val], i) => {
        const pct = Math.round(val / maxM2 * 100);
        const orders = workerOrders[name] || 0;
        const icon = medals[i] || `${i+1}.`;
        return `
        <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
                <span style="font-weight:700; color:var(--navy);">${icon} ${escapeHtml(name)}</span>
                <span style="font-weight:800; color:var(--navy);">${val.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m² <span style="color:var(--text-muted); font-weight:400;">(${orders} ta)</span></span>
            </div>
            <div style="height:6px; background:#E2E8F0; border-radius:10px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#0F172A,#3B82F6); border-radius:10px;"></div>
            </div>
        </div>`;
    }).join('');

    bar.innerHTML = `
    <div class="card" style="padding:12px 14px; margin-bottom:4px; background:#fff; border:1px solid var(--border);">
        <div style="font-weight:700; font-size:12px; color:var(--navy); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.4px;">📐 Hodimlar ish oqimi bo'yicha</div>
        ${rows}
    </div>`;
}

/**
 * Opens the dashboard page as a separate tab view.
 */
async function openKvDashboard() {
    switchTab('kvDashboardTab', 'nav-kvadrat');
    renderKvDashboardPage();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

/**
 * Renders the full dashboard page (standalone tab).
 */
async function renderKvDashboardPage() {
    console.log('KV Dashboard: renderKvDashboardPage is called');
    const container = document.getElementById('kvDashboardMainBody');
    if (!container) {
        console.error('KV Dashboard: kvDashboardMainBody element not found');
        return;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:center; padding:40px;">
            <div style="text-align:center;">
                <div style="font-size:32px; margin-bottom:12px;">⏳</div>
                <div style="font-size:14px; color:var(--text-muted);">Yuklanmoqda...</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">Ma'lumotlar serverdan olinmoqda</div>
            </div>
        </div>`;

    try {
        // Agar kvadratlar.js allaqachon ma'lumot yuklagan bo'lsa, undan foydalanish
        if (typeof kvFullRecords !== 'undefined' && kvFullRecords.length) {
            kvDashboardRecords = kvFullRecords;
        } else if (!kvDashboardRecords || !kvDashboardRecords.length) {
            console.log('KV Dashboard: Serverdan yuklanmoqda...');
            const data = await apiRequest({ action: 'kvadrat_get_all' }, { timeoutMs: 30000 });
            if (data && data.success && data.data) {
                kvDashboardRecords = data.data;
            } else {
                throw new Error((data && data.error) || 'Server muvaffaqiyatsiz javob qaytardi');
            }
        }
    } catch (e) {
        console.error('KV Dashboard: Error loading data:', e);

        // Determine error type and provide helpful message
        let errorTitle = 'Ma\'lumot yuklab bo\'lmadi';
        let errorDetails = '';
        let canRetry = true;

        if (e.message.includes('Internet aloqasi yo\'q')) {
            errorTitle = 'Internet yo\'q';
            errorDetails = 'Internet bilan bog\'lanish yo\'q. Wi-Fi yoki mobil internetni yoqing.';
        } else if (e.message.includes('vaqti tugadi') || e.message.includes('timeout') || e.message.includes('tugadi')) {
            errorTitle = 'Vaqt tugadi';
            errorDetails = 'Server juda sekin javob berdi. Internet tezligini tekshiring.';
        } else if (e.message.includes('NetworkError') || e.message.includes('fetch')) {
            errorTitle = 'Tarmoq xatosi';
            errorDetails = 'Internet bilan bog\'lanishda muammo. Wi-Fi yoki mobil internetni tekshiring.';
        } else if (e.message.includes('HTTP')) {
            errorTitle = 'Server xatosi';
            errorDetails = 'Server vaqtincha ishlamayapti. Keyinroq urinib ko\'ring.';
            canRetry = false;
        } else if (e.message.includes('CORS') || e.message.includes('Access')) {
            errorTitle = 'Kirish cheklovi';
            errorDetails = 'Brauzerda kirish cheklovi. Boshqa brauzerda yoki incognito rejimda urinib ko\'ring.';
        }

        // Show error with retry option
        let buttonsHtml = '';
        if (canRetry) {
            buttonsHtml = '<button class="btn-main" onclick="renderKvDashboardPage()" style="padding:12px 24px; font-size:14px; margin-right:8px;">🔄 Qayta urinish</button>' +
                         '<button class="btn-secondary" onclick="showKvDashboardHelp()" style="padding:12px 24px; font-size:14px;">❓ Yordam</button>';
        } else {
            buttonsHtml = '<button class="btn-secondary" onclick="switchTab(\'kvadratTab\', \'nav-kv\')" style="padding:12px 24px; font-size:14px;">📐 Ro\'yxatga qaytish</button>';
        }

        container.innerHTML = '<div class="empty-state">' +
            '<div style="text-align:center; padding:40px;">' +
                '<div style="font-size:48px; margin-bottom:16px;">❌</div>' +
                '<div style="font-size:16px; font-weight:600; color:var(--red); margin-bottom:8px;">' + errorTitle + '</div>' +
                '<div style="font-size:12px; color:var(--text-muted); margin-bottom:20px; max-width:350px; margin-left:auto; margin-right:auto;">' +
                    escapeHtml(errorDetails || e.message || 'Noma\'lum xato yuz berdi.') +
                '</div>' +
                buttonsHtml +
            '</div>' +
        '</div>';
        return;
    }

    renderKvDashboard(container);
}

// Help function for dashboard errors
function showKvDashboardHelp() {
    const helpHtml = `
        <div style="text-align:left; max-width:400px; margin:0 auto; font-size:14px; line-height:1.5;">
            <h3 style="color:var(--navy); margin-bottom:12px;">🔧 Muammo hal qilish</h3>
            <ul style="padding-left:20px;">
                <li><b>Internet tekshiring:</b> Wi-Fi yoki mobil internet ishlayotganini tekshiring</li>
                <li><b>Vaqtni kutib turing:</b> Server vaqtincha band bo'lishi mumkin</li>
                <li><b>Brauzerni yangilang:</b> Ctrl+F5 bosib sahifani to'liq yangilang</li>
                <li><b>Incognito rejim:</b> Yangi incognito oynada ochib ko'ring</li>
                <li><b>Boshqa brauzer:</b> Chrome, Firefox yoki Edge'da urinib ko'ring</li>
            </ul>
            <p style="margin-top:12px; font-size:12px; color:var(--text-muted);">
                Agar muammo davom etsa, admin bilan bog'laning.
            </p>
        </div>
    `;

    // Simple alert for now, could be improved with a modal
    alert('Yordam:\n\n1. Internet aloqasini tekshiring\n2. Bir necha daqiqa kutib qayta urining\n3. Brauzerni yangilang (Ctrl+F5)\n4. Incognito rejimda oching\n5. Boshqa brauzerda sinab ko\'ring\n\nAgar muammo davom etsa, admin bilan bog\'laning.');
}

// Test basic connectivity
async function testConnectivity() {
    try {
        const response = await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
        });
        return true;
    } catch (e) {
        return false;
    }
}

// Remove closeKvDashboard function since we're using separate page now
// function closeKvDashboard() {
//     const modal = document.getElementById('kvDashboardModal');
//     if (modal) modal.classList.add('hidden');
// }

function renderKvDashboard(body) {
    if (!kvDashboardRecords || !kvDashboardRecords.length) {
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📏</div>
                <p>Hali hech qanday o'lchov kiritilmagan</p>
            </div>`;
        return;
    }

    // ── Data Aggregation ──────────────────────────────────────
    let totalM2 = 0;
    const statusCounts = {};
    const monthlyM2 = {};
    const stepCounts = {};

    if (Array.isArray(kvDashboardRecords)) {
        kvDashboardRecords.forEach(rec => {
            if (!rec) return;
            const m2 = Number(rec.totalM2) || 0;
            totalM2 += m2;

            const st = String(rec.status || 'yangi').toLowerCase();
            statusCounts[st] = (statusCounts[st] || 0) + 1;

            if (rec.date && typeof rec.date === 'string') {
                const parts = rec.date.split('/');
                if (parts.length === 3) {
                    const key = `${parts[2]}-${parts[1]}`;
                    monthlyM2[key] = (monthlyM2[key] || 0) + m2;
                }
            }

            // Aggregate by workflow step
            const step = Number(rec.currentStep) || 1;
            stepCounts[step] = (stepCounts[step] || 0) + 1;
        });
    }

    // Worker m² — aggregated by workflow participation
    const { workerM2, workerOrders } = _aggregateWorkerM2(kvDashboardRecords);

    // Grand total of all worker m² (will be > totalM2 because multiple workers share same orders)
    const workerGrandTotal = Object.values(workerM2).reduce((s, v) => s + v, 0);

    const completed = Object.entries(statusCounts)
        .filter(([k]) => k.indexOf('tayyor') !== -1 || k.indexOf('landi') !== -1)
        .reduce((s, [, v]) => s + v, 0);

    // Additional metrics
    const avgM2PerOrder = (Array.isArray(kvDashboardRecords) && kvDashboardRecords.length) ? (totalM2 / kvDashboardRecords.length).toFixed(1) : 0;
    const topMonth = Object.entries(monthlyM2).sort((a, b) => b[1] - a[1])[0];
    const topMonthLabel = topMonth ? (() => {
        const [y, m] = topMonth[0].split('-');
        return `${KV_MONTHS_SHORT[parseInt(m) - 1] || ''} ${y}`;
    })() : '—';

    // ── HTML ──────────────────────────────────────────────────
    body.innerHTML = `
    <div class="dash-role-badge kv">
        📐 Kvadratlar Dashboard
        <button class="btn-secondary" onclick="renderKvDashboardPage()" style="margin-left:auto; padding:4px 12px; font-size:11px; border-radius:12px;" title="Yangilash">
            🔄
        </button>
    </div>

    ${kvSecTitle('📊 Umumiy Statistikalar')}
    <div class="dash-stats-grid">
        ${kvSCard('📦', 'Jami Buyurtma', kvDashboardRecords.length + ' ta', '', '#10B981')}
        ${kvSCard('📏', 'Jami m²', totalM2.toLocaleString('uz-UZ', {maximumFractionDigits:1}) + ' m²', '', '#3B82F6')}
        ${kvSCard('📈', 'O\'rtacha m²/buyurtma', avgM2PerOrder + ' m²', '', '#F59E0B')}
        ${kvSCard('🏆', 'Eng Faol Oy', topMonthLabel, '', '#EC4899')}
    </div>

    <div class="dash-stats-grid" style="margin-bottom:14px;">
        ${kvSCard('✅', 'Yakunlangan', completed + ' ta', '', '#10B981')}
        ${kvSCard('⏳', 'Jarayonda', (kvDashboardRecords.length - completed) + ' ta', '', '#F59E0B')}
    </div>

    ${kvCCard('📊 Holat bo\'yicha taqsimot', 'kvDashChartStatus', 200)}
    ${kvCCard('🔄 Ish oqimi bosqichlari', 'kvDashChartSteps', 200)}
    ${kvCCard('📈 Oylik dinamika (m²)', 'kvDashChartTrends', 220)}

    ${kvSecTitle('🏆 Hodimlar Samaradorligi')}
    <div class="dash-stats-grid">
        ${kvSCard('👥', 'Faol Hodimlar', Object.keys(workerM2).length + ' nafar', '', '#8B5CF6')}
        ${kvSCard('📐', 'Jami Ish m²', workerGrandTotal.toLocaleString('uz-UZ', {maximumFractionDigits:1}) + ' m²', 'Barcha qatnashuvchilar', '#14B8A6')}
    </div>
    ${kvCCard('🏅 Top Hodimlar (m²)', 'kvDashChartWorkers', Math.max(200, Object.keys(workerM2).length * 50))}`;

    // ── Charts ────────────────────────────────────────────────
    setTimeout(() => _renderKvCharts(statusCounts, monthlyM2, workerM2, stepCounts), 200);
}

function _renderKvCharts(statusCounts, monthlyM2, workerM2, stepCounts) {
    console.log('KV Charts: Starting to render charts');
    console.log('KV Charts: Chart.js available:', typeof Chart !== 'undefined');
    console.log('KV Charts: statusCounts:', statusCounts);
    console.log('KV Charts: monthlyM2:', monthlyM2);
    console.log('KV Charts: workerM2:', workerM2);
    console.log('KV Charts: stepCounts:', stepCounts);

    const STATUS_COLORS = { 'yangi': '#FACC15', 'tayyor': '#22C55E' };
    const DEFAULT_COLORS = ['#3B82F6','#22C55E','#FACC15','#F97316','#8B5CF6','#EC4899','#94A3B8'];

    // 1. Doughnut — Status
    const ctxStatus = document.getElementById('kvDashChartStatus');
    console.log('KV Charts: Status canvas element:', ctxStatus);
    if (ctxStatus && typeof Chart !== 'undefined') {
        const labels = Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1));
        const bgColors = Object.keys(statusCounts).map((s, i) => {
            for (const [k, c] of Object.entries(STATUS_COLORS)) {
                if (s.indexOf(k) !== -1) return c;
            }
            if (s.indexOf('yig') !== -1) return '#3B82F6';
            return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        });

        kvMkDonut('kvDashChartStatus', labels, Object.values(statusCounts), bgColors);
        console.log('KV Charts: Status chart created');
    } else {
        console.error('KV Charts: Status chart not created - canvas or Chart.js missing');
    }

    // 2. Doughnut — Workflow Steps
    const ctxSteps = document.getElementById('kvDashChartSteps');
    console.log('KV Charts: Steps canvas element:', ctxSteps);
    if (ctxSteps && typeof Chart !== 'undefined') {
        const config = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
        const totalSteps = config.length >= 2 ? config.length : 3;

        const labels = Object.keys(stepCounts).map(step => {
            const stepNum = Number(step);
            const stepCfg = config.find(s => s.index === stepNum);
            return stepCfg ? stepCfg.status || `Bosqich ${stepNum}` : `Bosqich ${stepNum}`;
        });

        const bgColors = Object.keys(stepCounts).map(step => {
            const stepNum = Number(step) - 1;
            const colors = getWorkflowStepColors(stepNum, totalSteps);
            return colors.bg;
        });

        kvMkDonut('kvDashChartSteps', labels, Object.values(stepCounts), bgColors);
        console.log('KV Charts: Steps chart created');
    } else {
        console.error('KV Charts: Steps chart not created - canvas or Chart.js missing');
    }

    // 3. Bar — Monthly m²
    const ctxTrends = document.getElementById('kvDashChartTrends');
    console.log('KV Charts: Trends canvas element:', ctxTrends);
    if (ctxTrends && typeof Chart !== 'undefined') {
        const MONTH_SHORT = KV_MONTHS_SHORT;
        const sortedKeys = Object.keys(monthlyM2).sort();
        const labels = sortedKeys.map(k => {
            const [y, mm] = k.split('-');
            return (MONTH_SHORT[parseInt(mm)] || mm) + " '" + (y || '').slice(2);
        });

        kvMkBar('kvDashChartTrends', labels, [{
            label: 'm²',
            data: sortedKeys.map(k => parseFloat(monthlyM2[k].toFixed(1))),
            backgroundColor: 'rgba(15,23,42,0.82)',
            borderRadius: 6,
            borderSkipped: false
        }]);
        console.log('KV Charts: Trends chart created');
    } else {
        console.error('KV Charts: Trends chart not created - canvas or Chart.js missing');
    }

    // 4. Horizontal Bar — Worker comparison
    const ctxWorkers = document.getElementById('kvDashChartWorkers');
    console.log('KV Charts: Workers canvas element:', ctxWorkers);
    if (ctxWorkers && typeof Chart !== 'undefined' && workerM2) {
        const sorted = Object.entries(workerM2).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const WORKER_COLORS = ['#0F172A','#1E40AF','#7C3AED','#DB2777','#EA580C','#059669','#CA8A04','#475569'];

        kvMkHBar('kvDashChartWorkers', sorted.map(([n]) => n.length > 12 ? n.slice(0,11) + '…' : n), sorted.map(([, v]) => parseFloat(v.toFixed(1))), sorted.map((_, i) => WORKER_COLORS[i % WORKER_COLORS.length]));
        console.log('KV Charts: Workers chart created');
    } else {
        console.error('KV Charts: Workers chart not created - canvas or Chart.js missing');
    }
}
