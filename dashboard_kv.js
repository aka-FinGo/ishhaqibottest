// ============================================================
// dashboard_kv.js — Kvadratlar Dashboard Logic
// ============================================================

let kvChartStatus = null;
let kvChartTrends = null;

/**
 * Opens the dashboard modal and loads data.
 * If kvFullRecords is empty, fetches from server first.
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

    // If Kvadratlar tab hasn't been loaded yet, fetch data now
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
    const monthlyM2 = {};   // "YYYY-MM" → m²
    const staffM2 = {};     // staffName → m²

    kvFullRecords.forEach(rec => {
        const m2 = Number(rec.totalM2) || 0;
        totalM2 += m2;

        // Status
        const st = (rec.status || 'yangi').toLowerCase();
        statusCounts[st] = (statusCounts[st] || 0) + 1;

        // Monthly — parse "DD/MM/YYYY"
        if (rec.date) {
            const parts = rec.date.split('/');
            if (parts.length === 3) {
                const key = `${parts[2]}-${parts[1]}`;
                monthlyM2[key] = (monthlyM2[key] || 0) + m2;
            }
        }

        // Staff
        const staff = rec.staffName || "Noma'lum";
        staffM2[staff] = (staffM2[staff] || 0) + m2;
    });

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

    <!-- Staff Ranking -->
    <div class="card" style="padding:14px; background:#fff; border:1px solid var(--border); margin-bottom:20px;">
        <div style="font-weight:700; font-size:13px; color:var(--navy); margin-bottom:12px;">🏆 Xodimlar samaradorligi</div>
        <div id="kvDashStaffRanking"></div>
    </div>`;

    // ── Staff Ranking ─────────────────────────────────────────
    const rankEl = document.getElementById('kvDashStaffRanking');
    if (rankEl) {
        const sorted = Object.entries(staffM2).sort((a, b) => b[1] - a[1]);
        rankEl.innerHTML = sorted.slice(0, 7).map(([name, val], i) => {
            const pct = totalM2 > 0 ? Math.round(val / totalM2 * 100) : 0;
            const medals = ['🥇', '🥈', '🥉'];
            const icon = medals[i] || `${i+1}.`;
            return `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                    <span style="font-weight:700; color:var(--navy);">${icon} ${escapeHtml(name)}</span>
                    <span style="font-weight:800;">${val.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m² <span style="color:var(--text-muted); font-size:11px;">(${pct}%)</span></span>
                </div>
                <div style="height:7px; background:#E2E8F0; border-radius:10px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #0F172A, #3B82F6); border-radius:10px; transition:width .5s;"></div>
                </div>
            </div>`;
        }).join('') || '<p style="font-size:12px; color:var(--text-muted);">Ma\'lumot yo\'q</p>';
    }

    // ── Charts ────────────────────────────────────────────────
    setTimeout(() => _renderKvCharts(statusCounts, monthlyM2), 80);
}

function _renderKvCharts(statusCounts, monthlyM2) {
    if (kvChartStatus) { kvChartStatus.destroy(); kvChartStatus = null; }
    if (kvChartTrends) { kvChartTrends.destroy(); kvChartTrends = null; }

    // Colors for statuses
    const STATUS_COLORS = {
        'yangi':    '#FACC15',
        'tayyor':   '#22C55E',
        'yig\'ildi':'#3B82F6',
        'yig\'ild': '#3B82F6'
    };
    const DEFAULT_COLORS = ['#3B82F6','#22C55E','#FACC15','#F97316','#8B5CF6','#EC4899','#94A3B8'];

    // 1. Doughnut — Status
    const ctxStatus = document.getElementById('kvDashChartStatus');
    if (ctxStatus && typeof Chart !== 'undefined') {
        const labels = Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1));
        const bgColors = Object.keys(statusCounts).map((s, i) => {
            for (const [k, c] of Object.entries(STATUS_COLORS)) {
                if (s.indexOf(k) !== -1) return c;
            }
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
            return (MONTH_SHORT[parseInt(mm)] || mm) + ' \'' + (y || '').slice(2);
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
}
