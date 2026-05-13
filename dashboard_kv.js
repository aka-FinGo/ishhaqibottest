let kvDashboardRecords = [];
let kvChartStatus = null;
let kvChartTrends = null;
let kvChartSteps = null;
let kvChartWorkers = null;
const _kvCharts = {};

function destroyKvChart(id) {
    if (_kvCharts[id]) {
        _kvCharts[id].destroy();
        delete _kvCharts[id];
    }
}

const KV_PALETTE = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9', '#64748B'];
const KV_STEP_PALETTE = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9', '#64748B'];
const KV_STATUS_PALETTE = ['#22C55E', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9', '#64748B'];
const KV_MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function getPaletteColor(index, palette = KV_PALETTE) {
    return palette[index % palette.length];
}

function getWorkflowStepColors(positionIndex) {
    return {
        bg: getPaletteColor(positionIndex, KV_STEP_PALETTE)
    };
}

function getStatusColor(statusLabel, positionIndex) {
    const norm = String(statusLabel || '').toLowerCase();
    if (norm.includes('yangi') || norm.includes('new')) return '#FACC15';
    if (norm.includes('tayyor') || norm.includes('ready')) return '#22C55E';
    if (norm.includes('qadoq') || norm.includes('qadoqlanm') || norm.includes('packed')) return '#3B82F6';
    if (norm.includes('bajar') || norm.includes('done') || norm.includes('finished')) return '#EF4444';
    return getPaletteColor(positionIndex, KV_STATUS_PALETTE);
}

const KV_BF = {
    family: "'Plus Jakarta Sans',sans-serif"
};

// Dinamik rang olish funktsiyasi
function getChartColor(varName, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
}

const KV_TC = {
    get font() { return { ...KV_BF, size: 11 }; },
    get color() { return getChartColor('--chart-text', '#64748b'); }
};

const KV_TU = {
    callbacks: {
        label: c => ` ${c.dataset.label||''}:${Number(c.raw).toLocaleString()}m²`
    }
};

const KV_tickCb = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v;

function kvSCard(icon, label, val, sub = '', ac = '') {
    return `<div class="dash-stat-card" style="${ac ? 'border-top:3px solid '+ac:''}">
        <div class="dash-stat-icon">${icon}</div>
        <div class="dash-stat-body">
            <div class="dash-stat-label">${label}</div>
            <div class="dash-stat-value">${val}</div>
            ${sub ? `<div class="dash-stat-sub">${sub}</div>`:''}
        </div>
    </div>`;
}

function kvCCard(title, id, h = 220) {
    return `<div class="dash-chart-card">
        <div class="dash-chart-title">${title}</div>
        <div style="position:relative;height:${h}px;">
            <canvas id="${id}"></canvas>
        </div>
    </div>`;
}

function kvSecTitle(t) {
    return `<div class="dash-section-title">${t}</div>`;
}

function kvMkDonut(id, labels, vals, colors) {
    destroyKvChart(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const total = vals.reduce((s, v) => s + v, 0);
    if (!total) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: vals,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            cutout: '70%',
            animation: {
                duration: 900,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 14,
                        font: { ...KV_BF,
                            size: 11,
                            weight: '600'
                        },
                        color: KV_TC.color,
                        boxWidth: 10,
                        borderRadius: 3,
                        useBorderRadius: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: c => ` ${c.label}:${Number(c.raw).toLocaleString()}ta`
                    }
                }
            }
        }
    });
}

function kvMkBar(id, labels, datasets, stacked = false) {
    destroyKvChart(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            scales: {
                x: {
                    stacked,
                    grid: {
                        display: false
                    },
                    ticks: KV_TC
                },
                y: {
                    stacked,
                    grid: {
                        color: getChartColor('--chart-grid', 'rgba(0, 0, 0, 0.05)')
                    },
                    ticks: { ...KV_TC,
                        callback: KV_tickCb
                    }
                }
            },
            plugins: {
                legend: {
                    display: datasets.length > 1,
                    labels: {
                        font: { ...KV_BF,
                            size: 11
                        },
                        color: KV_TC.color,
                        boxWidth: 10,
                        borderRadius: 3,
                        useBorderRadius: true
                    }
                },
                tooltip: KV_TU
            }
        }
    });
}

function kvMkHBar(id, labels, vals, colors) {
    destroyKvChart(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: vals,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: 'start'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            scales: {
                x: {
                    grid: {
                        color: getChartColor('--chart-grid', 'rgba(0, 0, 0, 0.05)')
                    },
                    ticks: { ...KV_TC,
                        callback: KV_tickCb
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { ...KV_BF,
                            size: 12,
                            weight: '600'
                        },
                        color: KV_TC.color
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: c => ` ${Number(c.raw).toLocaleString()}m²`
                    }
                }
            }
        }
    });
}

function kvMkLine(id, labels, datasets) {
    destroyKvChart(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    _kvCharts[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 900,
                easing: 'easeOutQuart'
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: KV_TC
                },
                y: {
                    grid: {
                        color: getChartColor('--chart-grid', 'rgba(0, 0, 0, 0.05)')
                    },
                    ticks: { ...KV_TC,
                        callback: KV_tickCb
                    }
                }
            },
            plugins: {
                legend: {
                    display: datasets.length > 1,
                    labels: {
                        font: { ...KV_BF,
                            size: 11
                        },
                        color: KV_TC.color,
                        boxWidth: 10,
                        borderRadius: 3,
                        useBorderRadius: true
                    }
                },
                tooltip: KV_TU
            }
        }
    });
}

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

function _aggregateWorkerM2(records) {
    const workerM2 = {};
    const workerOrders = {};
    if (!Array.isArray(records)) return {
        workerM2,
        workerOrders
    };
    records.forEach(rec => {
        if (!rec) return;
        const m2 = Number(rec.totalM2) || 0;
        if (m2 <= 0) return;
        const logs = Array.isArray(rec.logs) ? rec.logs : [];
        const creditedSteps = new Set();
        const creditedOrders = new Set();
        logs.forEach(log => {
            if (!log) return;
            const uid = String(log.uid || '').trim();
            if (!uid) return;
            const step = String(log.step || '').trim();
            const stepKey = `${uid}|${step}`;
            if (creditedSteps.has(stepKey)) return;
            creditedSteps.add(stepKey);
            const name = _resolveKvName(uid, rec);
            workerM2[name] = (workerM2[name] || 0) + m2;
            const orderKey = `${name}|${rec.rowId||rec.no||rec.orderName||''}`;
            if (!creditedOrders.has(orderKey)) {
                creditedOrders.add(orderKey);
                workerOrders[name] = (workerOrders[name] || 0) + 1;
            }
        });
        if (creditedSteps.size === 0 && rec.staffName) {
            const name = rec.staffName;
            workerM2[name] = (workerM2[name] || 0) + m2;
            workerOrders[name] = (workerOrders[name] || 0) + 1;
        }
    });
    return {
        workerM2,
        workerOrders
    };
}

function getWorkerM2ForStaff(staffName, records) {
    const recs = records || kvDashboardRecords || [];
    if (!recs.length) return 0;
    const {
        workerM2
    } = _aggregateWorkerM2(recs);
    return workerM2[staffName] || 0;
}

function renderKvWorkerStats(records) {
    const bar = document.getElementById('kvWorkerStatsBar');
    if (!bar) return;
    if (!records || !records.length) {
        bar.innerHTML = '';
        return;
    }
    const {
        workerM2,
        workerOrders
    } = _aggregateWorkerM2(records);
    const sorted = Object.entries(workerM2).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) {
        bar.innerHTML = '';
        return;
    }
    const maxM2 = sorted[0][1] || 1;
    const staffFilterEl = document.getElementById('kvFilterStaff');
    const selectedStaff = staffFilterEl ? staffFilterEl.value : 'all';
    if (selectedStaff !== 'all') {
        const val = workerM2[selectedStaff] || 0;
        const orders = workerOrders[selectedStaff] || 0;
        bar.innerHTML = `<div class="kv-worker-card-solo">
            <div class="kv-worker-card-solo-label">👤 ${escapeHtml(selectedStaff)} — Ish oqimi bo'yicha</div>
            <div class="kv-worker-card-solo-main">
                <div class="kv-worker-card-solo-val">${val.toLocaleString('uz-UZ',{maximumFractionDigits:1})}m²</div>
                <div class="kv-worker-card-solo-sub">${orders}ta buyurtma</div>
            </div>
        </div>`;
        return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const rows = sorted.map(([name, val], i) => {
        const pct = Math.round(val / maxM2 * 100);
        const orders = workerOrders[name] || 0;
        const icon = medals[i] || `${i+1}.`;
        return `<div class="kv-worker-row">
            <div class="kv-worker-row-header">
                <span class="kv-worker-row-name">${icon}${escapeHtml(name)}</span>
                <span class="kv-worker-row-val">${val.toLocaleString('uz-UZ',{maximumFractionDigits:1})}m² <span class="kv-worker-row-orders">(${orders}ta)</span></span>
            </div>
            <div class="kv-worker-progress">
                <div class="kv-worker-progress-bar" style="width:${pct}%;"></div>
            </div>
        </div>`;
    }).join('');
    bar.innerHTML = `<div class="kv-worker-list-card">
        <div class="kv-worker-list-title">📐 Hodimlar ish oqimi bo'yicha</div>
        ${rows}
    </div>`;
}

async function openKvDashboard() {
    switchTab('kvDashboardTab', 'nav-kvadrat');
    renderKvDashboardPage();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

let kvPtrInitialized = false;

async function renderKvDashboardPage() {
    console.log('KV Dashboard:renderKvDashboardPage is called');

    if (!kvPtrInitialized) {
        initPullToRefresh('kvDashboardTab', 'kvPtr', async () => {
            kvDashboardRecords = [];
            await renderKvDashboardPage();
        });
        kvPtrInitialized = true;
    }

    const container = document.getElementById('kvDashboardMainBody');
    if (!container) {
        console.error('KV Dashboard:kvDashboardMainBody element not found');
        return;
    }
    container.innerHTML = `<div class="kv-loading-state">
        <div class="kv-loading-box">
            <div class="kv-loading-icon">⏳</div>
            <div class="kv-loading-text">Yuklanmoqda...</div>
            <div class="kv-loading-sub">Ma'lumotlar serverdan olinmoqda</div>
        </div>
    </div>`;
    try {
        if (typeof kvFullRecords !== 'undefined' && kvFullRecords.length) {
            kvDashboardRecords = kvFullRecords;
        } else if (!kvDashboardRecords || !kvDashboardRecords.length) {
            console.log('KV Dashboard:Serverdan yuklanmoqda...');
            const data = await apiRequest({
                action: 'kvadrat_get_all'
            }, {
                timeoutMs: 30000
            });
            if (data && data.success && data.data) {
                kvDashboardRecords = data.data;
            } else {
                throw new Error((data && data.error) || 'Server muvaffaqiyatsiz javob qaytardi');
            }
        }
    } catch (e) {
        console.error('KV Dashboard:Error loading data:', e);
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
        let buttonsHtml = '';
        if (canRetry) {
            buttonsHtml = '<button class="btn-main" onclick="renderKvDashboardPage()" style="padding:12px 24px;font-size:14px;margin-right:8px;">🔄 Qayta urinish</button>' + '<button class="btn-secondary" onclick="showKvDashboardHelp()" style="padding:12px 24px;font-size:14px;">❓ Yordam</button>';
        } else {
            buttonsHtml = '<button class="btn-secondary" onclick="switchTab(\'kvadratTab\',\'nav-kv\')" style="padding:12px 24px;font-size:14px;">📐 Ro\'yxatga qaytish</button>';
        }
        container.innerHTML = `<div class="kv-error-state">
            <div class="kv-error-icon">❌</div>
            <div class="kv-error-title">${errorTitle}</div>
            <div class="kv-error-details">${escapeHtml(errorDetails||e.message||'Noma\'lum xato yuz berdi.')}</div>
            ${buttonsHtml}
        </div>`;
        return;
    }
    renderKvDashboard(container);
}

function showKvDashboardHelp() {
    alert('Yordam:\n\n1. Internet aloqasini tekshiring\n2. Bir necha daqiqa kutib qayta urining\n3. Brauzerni yangilang (Ctrl+F5)\n4. Incognito rejimda oching\n5. Boshqa brauzerda sinab ko\'ring\n\nAgar muammo davom etsa,admin bilan bog\'laning.');
}

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

function renderKvDashboard(body) {
    if (!kvDashboardRecords || !kvDashboardRecords.length) {
        body.innerHTML = `<div class="empty-state">
            <div class="empty-icon">📏</div>
            <p>Hali hech qanday o'lchov kiritilmagan</p>
        </div>`;
        return;
    }
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
            let key = null;
            if (rec.year && rec.month) {
                let mNum = String(rec.month).replace('_', '').padStart(2, '0');
                if (mNum !== '00') {
                    key = `${rec.year}-${mNum}`;
                }
            }
            if (!key && rec.date && typeof rec.date === 'string') {
                const parts = rec.date.split('/');
                if (parts.length === 3) {
                    key = `${parts[2]}-${parts[1]}`;
                }
            }
            if (key) {
                monthlyM2[key] = (monthlyM2[key] || 0) + m2;
            }
            const step = Number(rec.currentStep) || 1;
            stepCounts[step] = (stepCounts[step] || 0) + 1;
        });
    }
    const {
        workerM2,
        workerOrders
    } = _aggregateWorkerM2(kvDashboardRecords);
    const workerGrandTotal = Object.values(workerM2).reduce((s, v) => s + v, 0);
    const completed = Object.entries(statusCounts).filter(([k]) => k.indexOf('tayyor') !== -1 || k.indexOf('landi') !== -1).reduce((s, [, v]) => s + v, 0);
    const avgM2PerOrder = (Array.isArray(kvDashboardRecords) && kvDashboardRecords.length) ? (totalM2 / kvDashboardRecords.length).toFixed(1) : 0;
    const topMonth = Object.entries(monthlyM2).sort((a, b) => b[1] - a[1])[0];
    const topMonthLabel = topMonth ? (() => {
        const [y, m] = topMonth[0].split('-');
        return `${KV_MONTHS_SHORT[parseInt(m)-1]||''}${y}`;
    })() : '—';
    body.innerHTML = `${kvSecTitle('📊 Umumiy Statistikalar')}
        <div class="dash-stats-grid">
            ${kvSCard('📦','Jami Buyurtma',kvDashboardRecords.length+' ta','','#10B981')}
            ${kvSCard('📏','Jami m²',totalM2.toLocaleString('uz-UZ',{maximumFractionDigits:1})+' m²','','#3B82F6')}
            ${kvSCard('📈','O\'rtacha m²/buyurtma',avgM2PerOrder+' m²','','#F59E0B')}
            ${kvSCard('🏆','Eng Faol Oy',topMonthLabel,'','#EC4899')}
        </div>
        <div class="dash-stats-grid" style="margin-bottom:14px;">
            ${kvSCard('✅','Yakunlangan',completed+' ta','','#10B981')}
            ${kvSCard('⏳','Jarayonda',(kvDashboardRecords.length-completed)+' ta','','#F59E0B')}
        </div>
        ${kvCCard('📊 Xodimlarning oylik samaradorligi','kvDashChartComplex',280)}
        ${kvCCard('🔄 Buyurtmalar holati','kvDashChartSteps',220)}
        ${kvCCard('📈 Oylik dinamika (m²)','kvDashChartTrends',220)}
        ${kvSecTitle('🏆 Hodimlar Samaradorligi')}
        <div class="dash-stats-grid">
            ${kvSCard('👥','Faol Hodimlar',Object.keys(workerM2).length+' nafar','','#8B5CF6')}
            ${kvSCard('📐','Jami Ish m²',workerGrandTotal.toLocaleString('uz-UZ',{maximumFractionDigits:1})+' m²','Barcha qatnashuvchilar','#14B8A6')}
        </div>
        ${kvCCard('🏅 Top Hodimlar (m²)','kvDashChartWorkers',Math.max(220,Object.keys(workerM2).length*50))}`;
    setTimeout(() => _renderKvCharts(statusCounts, monthlyM2, workerM2, stepCounts), 200);
}

function _renderKvCharts(statusCounts, monthlyM2, workerM2, stepCounts) {
    console.log('KV Charts:Starting to render charts');
    if (typeof renderComplexStaffMonthlyChart === 'function') {
        renderComplexStaffMonthlyChart('kvDashChartComplex', kvDashboardRecords);
    }
    const ctxSteps = document.getElementById('kvDashChartSteps');
    if (ctxSteps && typeof Chart !== 'undefined') {
        const config = (typeof myPermissions !== 'undefined' && Array.isArray(myPermissions.workflowConfig)) ? myPermissions.workflowConfig : [];
        const stepKeys = Object.keys(stepCounts).sort((a, b) => Number(a) - Number(b));
        const labels = stepKeys.map(step => {
            const stepNum = Number(step);
            const stepCfg = config.find(s => s.index === stepNum);
            return stepCfg ? stepCfg.status || `Bosqich ${stepNum}` : `Bosqich ${stepNum}`;
        });
        const bgColors = stepKeys.map((step, index) => getWorkflowStepColors(index).bg);
        kvMkDonut('kvDashChartSteps', labels, stepKeys.map(k => stepCounts[k]), bgColors);
    }
    const ctxTrends = document.getElementById('kvDashChartTrends');
    if (ctxTrends && typeof Chart !== 'undefined') {
        const sortedKeys = Object.keys(monthlyM2).sort();
        const labels = sortedKeys.map(k => {
            const [y, mm] = k.split('-');
            return (KV_MONTHS_SHORT[parseInt(mm)-1] || mm) + " '" + (y || '').slice(2);
        });
        kvMkBar('kvDashChartTrends', labels, [{
            label: 'm²',
            data: sortedKeys.map(k => parseFloat(monthlyM2[k].toFixed(1))),
            backgroundColor: 'rgba(0,242,255,0.7)',
            borderColor: 'var(--cyan-neon)',
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false
        }]);
    }
    const ctxWorkers = document.getElementById('kvDashChartWorkers');
    if (ctxWorkers && typeof Chart !== 'undefined' && workerM2) {
        const sorted = Object.entries(workerM2).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const WORKER_COLORS = ['#00f2ff', '#0066ff', '#ff8c00', '#ff2a2a', '#00ff88', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#475569'];
        kvMkHBar('kvDashChartWorkers', sorted.map(([n]) => n.length > 12 ? n.slice(0, 11) + '…' : n), sorted.map(([, v]) => parseFloat(v.toFixed(1))), sorted.map((_, i) => WORKER_COLORS[i % WORKER_COLORS.length]));
    }
}