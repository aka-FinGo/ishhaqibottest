// ============================================================
// dashboard_kv.js — Kvadratlar Dashboard Logic
// ============================================================

let kvChartStatus = null;
let kvChartTrends = null;

/**
 * Resolves a Telegram UID to a display name.
 * Uses window._kvEmpMap {tgId: username} for reverse lookup.
 */
function _resolveKvName(uid, fallbackStaffName) {
    if (!uid) return fallbackStaffName || "Noma'lum";
    const map = window._kvEmpMap || {};
    if (map[uid]) return map[uid];
    // Check globalEmployeeList array
    if (typeof globalEmployeeList !== 'undefined' && Array.isArray(globalEmployeeList)) {
        // Can't reverse-lookup from array of names, so fall back
    }
    return fallbackStaffName || String(uid);
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

    records.forEach(rec => {
        const m2 = Number(rec.totalM2) || 0;
        if (m2 <= 0) return;

        const logs = rec.logs || [];
        const credited = new Set(); // avoid double-crediting same person on same order

        // Credit each unique participant from the workflow logs
        logs.forEach(log => {
            const uid = String(log.uid || '').trim();
            if (!uid) return;
            const name = _resolveKvName(uid, rec.staffName);
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
 * Used by renderKvList to show filtered worker stats.
 */
function getWorkerM2ForStaff(staffName) {
    if (!kvFullRecords || !kvFullRecords.length) return 0;
    const { workerM2 } = _aggregateWorkerM2(kvFullRecords);
    return workerM2[staffName] || 0;
}

/**
 * Opens the dashboard modal and loads data.
 */
async function openKvDashboard() {
    const modal = document.getElementById('kvDashboardModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const body = document.getElementById('kvDashboardBody');
    if (!body) return;

    body.innerHTML = `
        <div style="display:flex; justify-content:center; padding:40px;">
            <div style="text-align:center;">
                <div style="font-size:32px; margin-bottom:12px;">⏳</div>
                <div style="font-size:14px; color:var(--text-muted);">Yuklanmoqda...</div>
            </div>
        </div>`;

    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

    // Fetch data if not loaded yet
    try {
        if (!kvFullRecords || !kvFullRecords.length) {
            const data = await apiRequest({ action: 'kvadrat_get_all' });
            if (data && data.success && data.data) {
                kvFullRecords = data.data;
            }
        }
    } catch (e) {
        body.innerHTML = `<div class="empty-state"><p style="color:var(--red);">❌ Ma'lumot yuklab bo'lmadi</p></div>`;
        return;
    }

    renderKvDashboard(body);
}

function closeKvDashboard() {
    const modal = document.getElementById('kvDashboardModal');
    if (modal) modal.classList.add('hidden');
}

function renderKvDashboard(body) {
    if (!kvFullRecords || !kvFullRecords.length) {
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

    kvFullRecords.forEach(rec => {
        const m2 = Number(rec.totalM2) || 0;
        totalM2 += m2;

        const st = (rec.status || 'yangi').toLowerCase();
        statusCounts[st] = (statusCounts[st] || 0) + 1;

        if (rec.date) {
            const parts = rec.date.split('/');
            if (parts.length === 3) {
                const key = `${parts[2]}-${parts[1]}`;
                monthlyM2[key] = (monthlyM2[key] || 0) + m2;
            }
        }
    });

    // Worker m² — aggregated by workflow participation
    const { workerM2, workerOrders } = _aggregateWorkerM2(kvFullRecords);

    // Grand total of all worker m² (will be > totalM2 because multiple workers share same orders)
    const workerGrandTotal = Object.values(workerM2).reduce((s, v) => s + v, 0);

    const completed = Object.entries(statusCounts)
        .filter(([k]) => k.indexOf('tayyor') !== -1 || k.indexOf('landi') !== -1)
        .reduce((s, [, v]) => s + v, 0);

    // ── HTML ──────────────────────────────────────────────────
    body.innerHTML = `
    <!-- Quick Stats -->
    <div class="stats-grid" style="margin-bottom:14px;">
        <div class="stat-card" style="background:#fff; border:1px solid var(--border);">
            <div class="stat-label">Jami buyurtma</div>
            <div class="stat-value" style="color:var(--navy); font-size:26px;">${kvFullRecords.length}</div>
        </div>
        <div class="stat-card" style="background:#fff; border:1px solid var(--border);">
            <div class="stat-label">Jami m²</div>
            <div class="stat-value" style="color:var(--navy); font-size:22px;">${totalM2.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m²</div>
        </div>
    </div>

    <div class="stats-grid" style="margin-bottom:14px;">
        <div class="stat-card" style="background:#DCFCE7; border:1px solid #BBF7D0;">
            <div class="stat-label" style="color:#166534;">Yakunlangan</div>
            <div class="stat-value" style="color:#15803D; font-size:26px;">✅ ${completed}</div>
        </div>
        <div class="stat-card" style="background:#FEF9C3; border:1px solid #FDE68A;">
            <div class="stat-label" style="color:#854D0E;">Jarayonda</div>
            <div class="stat-value" style="color:#92400E; font-size:26px;">⏳ ${kvFullRecords.length - completed}</div>
        </div>
    </div>

    <!-- Status Pie Chart -->
    <div class="card" style="margin-bottom:14px; padding:14px; background:#fff; border:1px solid var(--border);">
        <div style="font-weight:700; font-size:13px; color:var(--navy); margin-bottom:12px;">📊 Holat bo'yicha taqsimot</div>
        <div style="height:190px; display:flex; justify-content:center;">
            <canvas id="kvDashChartStatus"></canvas>
        </div>
    </div>

    <!-- Monthly Trend Chart -->
    <div class="card" style="margin-bottom:14px; padding:14px; background:#fff; border:1px solid var(--border);">
        <div style="font-weight:700; font-size:13px; color:var(--navy); margin-bottom:12px;">📈 Oylik dinamika (m²)</div>
        <div style="height:200px;">
            <canvas id="kvDashChartTrends"></canvas>
        </div>
    </div>

    <!-- Worker Stats (by workflow participation) -->
    <div class="card" style="padding:14px; background:#fff; border:1px solid var(--border); margin-bottom:14px;">
        <div style="font-weight:700; font-size:13px; color:var(--navy); margin-bottom:4px;">🏆 Xodimlar samaradorligi</div>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:14px;">Ish oqimida qatnashgan har bir hodimga buyurtma m² hisoblanadi</div>
        <div id="kvDashStaffRanking"></div>
    </div>

    <!-- Worker Comparison Chart -->
    <div class="card" style="padding:14px; background:#fff; border:1px solid var(--border); margin-bottom:20px;">
        <div style="font-weight:700; font-size:13px; color:var(--navy); margin-bottom:12px;">📐 Hodimlar taqqoslash (m²)</div>
        <div style="height:220px;">
            <canvas id="kvDashChartWorkers"></canvas>
        </div>
    </div>`;

    // ── Staff Ranking ─────────────────────────────────────────
    const rankEl = document.getElementById('kvDashStaffRanking');
    if (rankEl) {
        const sorted = Object.entries(workerM2).sort((a, b) => b[1] - a[1]);
        const maxM2 = sorted.length ? sorted[0][1] : 1;
        rankEl.innerHTML = sorted.map(([name, val], i) => {
            const pct = maxM2 > 0 ? Math.round(val / maxM2 * 100) : 0;
            const orders = workerOrders[name] || 0;
            const medals = ['🥇', '🥈', '🥉'];
            const icon = medals[i] || `${i+1}.`;
            return `
            <div style="margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:4px;">
                    <span style="font-weight:700; color:var(--navy);">${icon} ${escapeHtml(name)}</span>
                    <span style="font-weight:800; color:var(--navy);">
                        ${val.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m²
                        <span style="color:var(--text-muted); font-size:11px; font-weight:500;">(${orders} ta)</span>
                    </span>
                </div>
                <div style="height:8px; background:#E2E8F0; border-radius:10px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #0F172A, #3B82F6); border-radius:10px; transition:width .5s;"></div>
                </div>
            </div>`;
        }).join('') || '<p style="font-size:12px; color:var(--text-muted);">Ma\'lumot yo\'q</p>';
    }

    // ── Charts ────────────────────────────────────────────────
    setTimeout(() => _renderKvCharts(statusCounts, monthlyM2, workerM2), 80);
}

function _renderKvCharts(statusCounts, monthlyM2, workerM2) {
    if (kvChartStatus) { kvChartStatus.destroy(); kvChartStatus = null; }
    if (kvChartTrends) { kvChartTrends.destroy(); kvChartTrends = null; }

    const STATUS_COLORS = { 'yangi': '#FACC15', 'tayyor': '#22C55E' };
    const DEFAULT_COLORS = ['#3B82F6','#22C55E','#FACC15','#F97316','#8B5CF6','#EC4899','#94A3B8'];

    // 1. Doughnut — Status
    const ctxStatus = document.getElementById('kvDashChartStatus');
    if (ctxStatus && typeof Chart !== 'undefined') {
        const labels = Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1));
        const bgColors = Object.keys(statusCounts).map((s, i) => {
            for (const [k, c] of Object.entries(STATUS_COLORS)) {
                if (s.indexOf(k) !== -1) return c;
            }
            if (s.indexOf('yig') !== -1) return '#3B82F6';
            return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        });

        kvChartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: Object.values(statusCounts), backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, padding: 10 } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} ta` } }
                }
            }
        });
    }

    // 2. Bar — Monthly m²
    const ctxTrends = document.getElementById('kvDashChartTrends');
    if (ctxTrends && typeof Chart !== 'undefined') {
        const MONTH_SHORT = ['', 'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyu', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
        const sortedKeys = Object.keys(monthlyM2).sort();
        const labels = sortedKeys.map(k => {
            const [y, mm] = k.split('-');
            return (MONTH_SHORT[parseInt(mm)] || mm) + " '" + (y || '').slice(2);
        });

        kvChartTrends = new Chart(ctxTrends, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'm²',
                    data: sortedKeys.map(k => parseFloat(monthlyM2[k].toFixed(1))),
                    backgroundColor: 'rgba(15,23,42,0.82)',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // 3. Horizontal Bar — Worker comparison
    const ctxWorkers = document.getElementById('kvDashChartWorkers');
    if (ctxWorkers && typeof Chart !== 'undefined' && workerM2) {
        const sorted = Object.entries(workerM2).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const WORKER_COLORS = ['#0F172A','#1E40AF','#7C3AED','#DB2777','#EA580C','#059669','#CA8A04','#475569'];

        // Destroy previous if exists
        const prevChart = Chart.getChart(ctxWorkers);
        if (prevChart) prevChart.destroy();

        new Chart(ctxWorkers, {
            type: 'bar',
            data: {
                labels: sorted.map(([n]) => n.length > 12 ? n.slice(0,11) + '…' : n),
                datasets: [{
                    label: 'm²',
                    data: sorted.map(([, v]) => parseFloat(v.toFixed(1))),
                    backgroundColor: sorted.map((_, i) => WORKER_COLORS[i % WORKER_COLORS.length]),
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 } } },
                    y: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}
