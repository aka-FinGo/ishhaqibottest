// ============================================================
// dashboard_kv.js — Kvadratlar Dashboard (ALOHIDA SAHIFA)
// ============================================================

let kvChartStatus = null;
let kvChartTrends = null;

// Filtrlarni saqlash uchun global o'zgaruvchilar
let kvFilterStaff = 'all';
let kvFilterMonth = 'all';
let kvFilterYear = 'all';

// Sahifani ochish - avval ma'lumotlarni yuklash
async function openKvDashboard() {
    // Agar ma'lumotlar yuklanmagan bo'lsa, avval yuklash
    if (!kvFullRecords || kvFullRecords.length === 0) {
        const listContainer = document.getElementById('kvList');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="skeleton skeleton-item"></div>
                <div class="skeleton skeleton-item"></div>
                <div class="skeleton skeleton-item"></div>`;
        }
        await initKvadratTab();
    }
    switchTab('kvDashboardTab', null);
    // DOM yangilanishini kutamiz
    await new Promise(r => setTimeout(r, 50));
    initKvDashboard();
    populateKvFilters();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

// Sahifani yopish
function closeKvDashboard() {
    const kvDashboardTab = document.getElementById('kvDashboardTab');
    if (kvDashboardTab) {
        kvDashboardTab.style.display = 'none';
    }
    switchTab('kvadratTab', null);
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

// Filtrlarni o'zgartirish
function changeKvFilter() {
    kvFilterStaff = document.getElementById('kvDashboardFilterStaff') ? document.getElementById('kvDashboardFilterStaff').value : 'all';
    kvFilterMonth = document.getElementById('kvDashboardFilterMonth') ? document.getElementById('kvDashboardFilterMonth').value : 'all';
    kvFilterYear = document.getElementById('kvDashboardFilterYear') ? document.getElementById('kvDashboardFilterYear').value : 'all';
    initKvDashboard();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// Filterlangan ma'lumotlarni olish
function getFilteredKvRecords() {
    if (!kvFullRecords || !Array.isArray(kvFullRecords) || !kvFullRecords.length) return [];
    
    return kvFullRecords.filter(rec => {
        // Hodim filter
        if (kvFilterStaff !== 'all' && rec.staffName !== kvFilterStaff) return false;
        
        // Oy/Yil filter
        if (rec.date) {
            const parts = rec.date.split('/');
            if (parts.length === 3) {
                const recMonth = parts[1];
                const recYear = parts[2];
                
                if (kvFilterMonth !== 'all' && recMonth !== kvFilterMonth) return false;
                if (kvFilterYear !== 'all' && recYear !== kvFilterYear) return false;
            }
        }
        
        return true;
    });
}

// Mavjud yillardan filterlarni to'ldirish
function populateKvFilters() {
    // Yillar
    const yearsSet = new Set();
    const staffSet = new Set();
    
    if (kvFullRecords && Array.isArray(kvFullRecords) && kvFullRecords.length) {
        kvFullRecords.forEach(rec => {
            if (rec.date) {
                const parts = rec.date.split('/');
                if (parts.length === 3) {
                    yearsSet.add(parts[2]);
                }
            }
            if (rec.staffName) staffSet.add(rec.staffName);
        });
    }
    
    const years = Array.from(yearsSet).sort();
    const staffMembers = Array.from(staffSet).sort();
    
    // Filter elementlari mavjudligini tekshirish
    const yearSelect = document.getElementById('kvDashboardFilterYear');
    const staffSelect = document.getElementById('kvDashboardFilterStaff');
    
    if (yearSelect) {
        const currentYear = yearSelect.value;
        yearSelect.innerHTML = '<option value="all">Barcha yillar</option>';
        years.forEach(y => {
            yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
        });
        // Avvalgi tanlovni tiklash
        if (years.includes(currentYear)) yearSelect.value = currentYear;
    }
    
    if (staffSelect) {
        const currentStaff = staffSelect.value;
        staffSelect.innerHTML = '<option value="all">Barcha hodimlar</option>';
        staffMembers.forEach(s => {
            staffSelect.innerHTML += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
        });
        if (staffMembers.includes(currentStaff)) staffSelect.value = currentStaff;
    }
}

function initKvDashboard() {
    const body = document.getElementById('kvDashboardMainBody');
    if (!body) {
        console.warn('kvDashboardMainBody elementi topilmadi!');
        return;
    }

    // Agar kvFullRecords yuklanmagan bo'lsa, xabarni ko'rsatamiz
    if (!kvFullRecords || !Array.isArray(kvFullRecords) || kvFullRecords.length === 0) {
        body.innerHTML = `
            <div class="kv-dashboard-container">
                <div class="kv-filter-bar">
                    <select id="kvDashboardFilterStaff" onchange="changeKvFilter()" class="kv-filter-select">
                        <option value="all">Barcha hodimlar</option>
                    </select>
                    <select id="kvDashboardFilterMonth" onchange="changeKvFilter()" class="kv-filter-select">
                        <option value="all">Barcha oylar</option>
                        <option value="01">Yanvar</option>
                        <option value="02">Fevral</option>
                        <option value="03">Mart</option>
                        <option value="04">Aprel</option>
                        <option value="05">May</option>
                        <option value="06">Iyun</option>
                        <option value="07">Iyul</option>
                        <option value="08">Avgust</option>
                        <option value="09">Sentyabr</option>
                        <option value="10">Oktyabr</option>
                        <option value="11">Noyabr</option>
                        <option value="12">Dekabr</option>
                    </select>
                    <select id="kvDashboardFilterYear" onchange="changeKvFilter()" class="kv-filter-select">
                        <option value="all">Barcha yillar</option>
                    </select>
                </div>
                <div class="empty-state" style="padding:60px 20px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:15px;">📊</div>
                    <p style="font-size:16px; color:#64748b; font-weight:600;">Ma'lumotlar topilmadi</p>
                    <p style="font-size:13px; color:#94a3b8; margin-top:8px;">Iltimos, kvadratlar tabiga qaytib ma'lumot qo'shing</p>
                </div>
            </div>
        `;
        populateKvFilters();
        return;
    }

    const filteredRecords = getFilteredKvRecords();

    if (!filteredRecords.length) {
        body.innerHTML = `
            <div class="kv-dashboard-container">
                <div class="kv-filter-bar">
                    <select id="kvDashboardFilterStaff" onchange="changeKvFilter()" class="kv-filter-select">
                        <option value="all">Barcha hodimlar</option>
                    </select>
                    <select id="kvDashboardFilterMonth" onchange="changeKvFilter()" class="kv-filter-select">
                        <option value="all">Barcha oylar</option>
                        <option value="01">Yanvar</option>
                        <option value="02">Fevral</option>
                        <option value="03">Mart</option>
                        <option value="04">Aprel</option>
                        <option value="05">May</option>
                        <option value="06">Iyun</option>
                        <option value="07">Iyul</option>
                        <option value="08">Avgust</option>
                        <option value="09">Sentyabr</option>
                        <option value="10">Oktyabr</option>
                        <option value="11">Noyabr</option>
                        <option value="12">Dekabr</option>
                    </select>
                    <select id="kvDashboardFilterYear" onchange="changeKvFilter()" class="kv-filter-select">
                        <option value="all">Barcha yillar</option>
                    </select>
                </div>
                <div class="empty-state" style="padding:60px 20px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:15px;">📊</div>
                    <p style="font-size:16px; color:#64748b; font-weight:600;">Ma'lumotlar mavjud emas</p>
                    <p style="font-size:13px; color:#94a3b8; margin-top:8px;">Filterlarni o'zgartirib ko'ring</p>
                </div>
            </div>
        `;
        populateKvFilters();
        return;
    }

    // --- Data Processing ---
    let totalM2 = 0;
    const statusCounts = {};
    const monthlyData = {}; // keyed by "YYYY-MM"
    const staffData = {};   // keyed by "StaffName"

    filteredRecords.forEach(rec => {
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

    // Mavjud oylar va yillarni aniqlash
    const availableMonths = Object.keys(monthlyData).sort();
    const availableYears = [...new Set(availableMonths.map(m => m.split('-')[0]))].sort();
    const availableStaff = Object.keys(staffData).sort();

    // --- Render Cards ---
    let html = `
    <div class="kv-dashboard-container">
        <div class="kv-filter-bar">
            <select id="kvDashboardFilterStaff" onchange="changeKvFilter()" class="kv-filter-select">
                <option value="all">Barcha hodimlar</option>
                ${availableStaff.map(s => `<option value="${escapeHtml(s)}" ${kvFilterStaff === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>
            <select id="kvDashboardFilterMonth" onchange="changeKvFilter()" class="kv-filter-select">
                <option value="all">Barcha oylar</option>
                <option value="01" ${kvFilterMonth === '01' ? 'selected' : ''}>Yanvar</option>
                <option value="02" ${kvFilterMonth === '02' ? 'selected' : ''}>Fevral</option>
                <option value="03" ${kvFilterMonth === '03' ? 'selected' : ''}>Mart</option>
                <option value="04" ${kvFilterMonth === '04' ? 'selected' : ''}>Aprel</option>
                <option value="05" ${kvFilterMonth === '05' ? 'selected' : ''}>May</option>
                <option value="06" ${kvFilterMonth === '06' ? 'selected' : ''}>Iyun</option>
                <option value="07" ${kvFilterMonth === '07' ? 'selected' : ''}>Iyul</option>
                <option value="08" ${kvFilterMonth === '08' ? 'selected' : ''}>Avgust</option>
                <option value="09" ${kvFilterMonth === '09' ? 'selected' : ''}>Sentyabr</option>
                <option value="10" ${kvFilterMonth === '10' ? 'selected' : ''}>Oktyabr</option>
                <option value="11" ${kvFilterMonth === '11' ? 'selected' : ''}>Noyabr</option>
                <option value="12" ${kvFilterMonth === '12' ? 'selected' : ''}>Dekabr</option>
            </select>
            <select id="kvDashboardFilterYear" onchange="changeKvFilter()" class="kv-filter-select">
                <option value="all">Barcha yillar</option>
                ${availableYears.map(y => `<option value="${y}" ${kvFilterYear === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
        </div>

        <div class="kv-stats-row">
            <div class="kv-stat-card">
                <div class="kv-stat-icon">📐</div>
                <div class="kv-stat-content">
                    <div class="kv-stat-label">Jami O'lchovlar</div>
                    <div class="kv-stat-value">${filteredRecords.length} ta</div>
                </div>
            </div>
            <div class="kv-stat-card">
                <div class="kv-stat-icon">📏</div>
                <div class="kv-stat-content">
                    <div class="kv-stat-label">Jami m²</div>
                    <div class="kv-stat-value">${totalM2.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m²</div>
                </div>
            </div>
            <div class="kv-stat-card">
                <div class="kv-stat-icon">👥</div>
                <div class="kv-stat-content">
                    <div class="kv-stat-label">Hodimlar</div>
                    <div class="kv-stat-value">${Object.keys(staffData).length} nafar</div>
                </div>
            </div>
            <div class="kv-stat-card">
                <div class="kv-stat-icon">📅</div>
                <div class="kv-stat-content">
                    <div class="kv-stat-label">Oylar</div>
                    <div class="kv-stat-value">${availableMonths.length} oy</div>
                </div>
            </div>
        </div>

        <div class="kv-charts-grid">
            <div class="kv-chart-card">
                <div class="kv-chart-title">📊 Holatlar bo'yicha (${filteredRecords.length} ta)</div>
                <div class="kv-chart-container">
                    <canvas id="kvChartStatus"></canvas>
                </div>
                <div class="kv-chart-legend" id="kvStatusLegend"></div>
            </div>
            <div class="kv-chart-card">
                <div class="kv-chart-title">📈 Oylik dinamika (m²)</div>
                <div class="kv-chart-container">
                    <canvas id="kvChartTrends"></canvas>
                </div>
            </div>
        </div>

        <div class="kv-staff-section">
            <div class="kv-section-title">🏆 Top Hodimlar (m² bo'yicha)</div>
            <div id="kvStaffRanking" class="kv-staff-list"></div>
        </div>

        <div class="kv-records-section">
            <div class="kv-section-title">📋 Amallar ro'yxati</div>
            <div id="kvRecordsList" class="kv-records-list"></div>
        </div>
    </div>
    `;

    body.innerHTML = html;

    // --- Ranking List ---
    const rankingEl = document.getElementById('kvStaffRanking');
    const sortedStaff = Object.entries(staffData).sort((a, b) => b[1] - a[1]);
    
    let rankingHtml = '';
    sortedStaff.slice(0, 10).forEach(([name, val], idx) => {
        const percent = totalM2 > 0 ? (val / totalM2 * 100).toFixed(1) : 0;
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        rankingHtml += `
        <div class="kv-staff-item">
            <div class="kv-staff-rank">${medal}</div>
            <div class="kv-staff-info">
                <div class="kv-staff-name">${escapeHtml(name)}</div>
                <div class="kv-staff-bar">
                    <div class="kv-staff-bar-fill" style="width:${percent}%"></div>
                </div>
            </div>
            <div class="kv-staff-value">${val.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m² <span class="kv-staff-percent">${percent}%</span></div>
        </div>`;
    });
    rankingEl.innerHTML = rankingHtml || '<p style="font-size:13px; color:#94a3b8; text-align:center; padding:20px;">Ma\'lumot yo\'q</p>';

    // --- Records List ---
    const recordsEl = document.getElementById('kvRecordsList');
    const sortedRecords = [...filteredRecords].sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
    });
    
    let recordsHtml = '';
    sortedRecords.forEach(rec => {
        const m2 = Number(rec.totalM2) || 0;
        const statusBadge = getStatusBadge(rec.status);
        recordsHtml += `
        <div class="kv-record-item">
            <div class="kv-record-main">
                <div class="kv-record-order">${escapeHtml(rec.orderName || 'Noma\'lum')}</div>
                <div class="kv-record-meta">
                    <span>👤 ${escapeHtml(rec.staffName || 'Noma\'lum')}</span>
                    <span>📅 ${rec.date || '—'}</span>
                </div>
            </div>
            <div class="kv-record-right">
                <div class="kv-record-m2">${m2.toLocaleString('uz-UZ', {maximumFractionDigits:1})} m²</div>
                ${statusBadge}
            </div>
        </div>`;
    });
    recordsEl.innerHTML = recordsHtml || '<p style="font-size:13px; color:#94a3b8; text-align:center; padding:20px;">Ma\'lumot yo\'q</p>';

    // --- Charts ---
    try {
        renderKvCharts(statusCounts, monthlyData);
    } catch (e) {
        console.error('Chart render xato:', e);
    }
}

function getStatusBadge(status) {
    const colors = {
        'yangi': { bg: '#FEF3C7', text: '#92400E' },
        'bajarildi': { bg: '#D1FAE5', text: '#065F46' },
        'jarayonda': { bg: '#DBEAFE', text: '#1E40AF' },
        'bekor': { bg: '#FEE2E2', text: '#991B1B' }
    };
    const c = colors[status] || colors['yangi'];
    return `<span class="kv-status-badge" style="background:${c.bg}; color:${c.text};">${status || 'yangi'}</span>`;
}

function renderKvCharts(statusCounts, monthlyData) {
    try {
        if (kvChartStatus) {
            try { kvChartStatus.destroy(); } catch (e) { console.warn('kvChartStatus destroy xato'); }
        }
        if (kvChartTrends) {
            try { kvChartTrends.destroy(); } catch (e) { console.warn('kvChartTrends destroy xato'); }
        }

    // Status ranglari
    const statusColors = {
        'yangi': '#FACC15',
        'bajarildi': '#22C55E',
        'jarayonda': '#3B82F6',
        'bekor': '#94A3B8'
    };

    // 1. Status Chart (Pie)
    const ctxStatus = document.getElementById('kvChartStatus');
    if (ctxStatus && Object.keys(statusCounts).length > 0) {
        const labels = Object.keys(statusCounts).map(s => {
            const label = s.charAt(0).toUpperCase() + s.slice(1);
            const count = statusCounts[s];
            return `${label} (${count})`;
        });
        const colors = Object.keys(statusCounts).map(s => statusColors[s] || '#94A3B8');
        
        kvChartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            boxWidth: 12, 
                            font: { size: 11 },
                            padding: 15
                        } 
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((context.raw / total) * 100).toFixed(1);
                                return ` ${context.label}: ${context.raw} ta (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    // 2. Trends Chart (Bar/Line)
    const ctxTrends = document.getElementById('kvChartTrends');
    if (ctxTrends && Object.keys(monthlyData).length > 0) {
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
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    borderRadius: 6,
                    borderSkipped: 'bottom'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { display: true, color: '#E2E8F0' }, 
                        ticks: { font: { size: 10 } } 
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { font: { size: 10 } } 
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.raw.toLocaleString()} m²`;
                            }
                        }
                    }
                }
            }
        });
    }
    } catch (e) {
        console.error('renderKvCharts xato:', e);
    }
}
