// ============================================================
// dashboard_kv.js — Kvadratlar Dashboard Logic
// ============================================================

let kvChartStatus = null;
let kvChartTrends = null;

function openKvDashboard() {
    const modal = document.getElementById('kvDashboardModal');
    if (modal) modal.classList.remove('hidden');
    initKvDashboard();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

function closeKvDashboard() {
    const modal = document.getElementById('kvDashboardModal');
    if (modal) modal.classList.add('hidden');
}

function initKvDashboard() {
    const body = document.getElementById('kvDashboardBody');
    if (!body) return;

    if (!kvFullRecords || !kvFullRecords.length) {
        body.innerHTML = `<div class="empty-state"><p>Ma'lumotlar mavjud emas</p></div>`;
        return;
    }

    // --- Data Processing ---
    let totalM2 = 0;
    const statusCounts = {};
    const monthlyData = {}; // keyed by "YYYY-MM"
    const staffData = {};   // keyed by "StaffName"

    kvFullRecords.forEach(rec => {
        const m2 = Number(rec.totalM2) || 0;
        totalM2 += m2;

        // Status
        const st = rec.status || 'yangi';
        statusCounts[st] = (statusCounts[st] || 0) + 1;

        // Monthly
        if (rec.date) {
            const parts = rec.date.split('/'); // DD/MM/YYYY
            if (parts.length === 3) {
                const key = `${parts[2]}-${parts[1]}`;
                monthlyData[key] = (monthlyData[key] || 0) + m2;
            }
        }

        // Staff
        const staff = rec.staffName || 'Noma\'lum';
        staffData[staff] = (staffData[staff] || 0) + m2;
    });

    // --- Render Cards ---
    let html = `
    <div class="stats-grid" style="margin-bottom:15px;">
        <div class="stat-card" style="background:#fff; border:1px solid var(--border);">
            <div class="stat-label">Jami O'lchov</div>
            <div class="stat-value" style="color:var(--navy);">${kvFullRecords.length} ta</div>
        </div>
        <div class="stat-card" style="background:#fff; border:1px solid var(--border);">
            <div class="stat-label">Jami m²</div>
            <div class="stat-value" style="color:var(--navy);">${totalM2.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m²</div>
        </div>
    </div>

    <div class="card" style="margin-bottom:15px; padding:15px;">
        <div class="card-title" style="margin-bottom:12px; font-size:14px;">📊 Holatlar bo'yicha (ta)</div>
        <div style="height:200px; display:flex; justify-content:center;">
            <canvas id="kvChartStatus"></canvas>
        </div>
    </div>

    <div class="card" style="margin-bottom:15px; padding:15px;">
        <div class="card-title" style="margin-bottom:12px; font-size:14px;">📈 Oylik dinamika (m²)</div>
        <div style="height:220px;">
            <canvas id="kvChartTrends"></canvas>
        </div>
    </div>

    <div class="card" style="padding:15px;">
        <div class="card-title" style="margin-bottom:12px; font-size:14px;">🏆 Top Hodimlar (m²)</div>
        <div id="kvStaffRanking"></div>
    </div>
    `;

    body.innerHTML = html;

    // --- Ranking List ---
    const rankingEl = document.getElementById('kvStaffRanking');
    const sortedStaff = Object.entries(staffData).sort((a, b) => b[1] - a[1]);
    let rankingHtml = '';
    sortedStaff.slice(0, 5).forEach(([name, val], idx) => {
        const percent = (val / totalM2 * 100).toFixed(0);
        rankingHtml += `
        <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                <span style="font-weight:700; color:var(--navy);">${idx+1}. ${escapeHtml(name)}</span>
                <span style="font-weight:800;">${val.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m²</span>
            </div>
            <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${percent}%; background:var(--navy); border-radius:3px;"></div>
            </div>
        </div>`;
    });
    rankingEl.innerHTML = rankingHtml || '<p style="font-size:12px; color:var(--text-muted);">Ma\'lumot yo\'q</p>';

    // --- Charts ---
    setTimeout(() => {
        renderKvCharts(statusCounts, monthlyData);
    }, 100);
}

function renderKvCharts(statusCounts, monthlyData) {
    if (kvChartStatus) kvChartStatus.destroy();
    if (kvChartTrends) kvChartTrends.destroy();

    // 1. Status Chart (Pie)
    const ctxStatus = document.getElementById('kvChartStatus');
    if (ctxStatus) {
        kvChartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: ['#FACC15', '#3B82F6', '#22C55E', '#94A3B8'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                },
                cutout: '70%'
            }
        });
    }

    // 2. Trends Chart (Line/Bar)
    const ctxTrends = document.getElementById('kvChartTrends');
    if (ctxTrends) {
        // Sort months YYYY-MM
        const sortedMonths = Object.keys(monthlyData).sort();
        const labels = sortedMonths.map(m => {
            const [y, mm] = m.split('-');
            const months = ['', 'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyu', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
            return months[parseInt(mm)] + ' ' + y.slice(2);
        });

        kvChartTrends = new Chart(ctxTrends, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'm²',
                    data: sortedMonths.map(m => monthlyData[m]),
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}
