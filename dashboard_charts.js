/**
 * dashboard_charts.js
 * Xodimlarning oylar kesimidagi samaradorligini (m2) ko'rsatuvchi 
 * murakkab stacked bar diagrammasi.
 */

function renderComplexStaffMonthlyChart(canvasId, records) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const { monthlyData, months, employees } = aggregateStaffMonthlyData(records);
    
    // Har bir xodim uchun alohida dataset yaratamiz
    const datasets = employees.map((emp, idx) => {
        const color = KV_PALETTE[idx % KV_PALETTE.length];
        return {
            label: emp,
            data: months.map(m => monthlyData[m][emp] || 0),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.8,
            categoryPercentage: 0.9
        };
    });

    destroyKvChart(canvasId);

    _kvCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => {
                const [y, mm] = m.split('-');
                return (KV_MONTHS_SHORT[parseInt(mm)-1] || mm) + " '" + y.slice(2);
            }),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { ...KV_TC, font: { ...KV_BF, size: 10 } }
                },
                y: {
                    stacked: true,
                    grid: { color: getChartColor('--chart-grid', 'rgba(0, 0, 0, 0.05)') },
                    ticks: { ...KV_TC, callback: KV_tickCb }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { ...KV_BF, size: 9, weight: '600' },
                        color: KV_TC.color,
                        boxWidth: 8,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { ...KV_BF, size: 13 },
                    bodyFont: { ...KV_BF, size: 12 },
                    padding: 12,
                    callbacks: {
                        label: (c) => {
                            const val = Number(c.raw) || 0;
                            if (val <= 0) return null;
                            return ` ${c.dataset.label}: ${val.toLocaleString()} m²`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Ma'lumotlarni agregatsiya qilish: Oylar -> Xodimlar -> m2
 */
function aggregateStaffMonthlyData(records) {
    const monthlyData = {}; // { '2026-01': { 'Ulugbek': 100, 'Sardor': 150 }, ... }
    const monthsSet = new Set();
    const employeesSet = new Set();

    records.forEach(rec => {
        if (!rec || rec.isDeleted) return;
        const m2 = Number(rec.totalM2) || 0;
        if (m2 <= 0) return;

        // Sana va oy kalitini aniqlash
        let monthKey = null;
        if (rec.year && rec.month) {
            let mNum = String(rec.month).replace('_', '').padStart(2, '0');
            if (mNum !== '00') monthKey = `${rec.year}-${mNum}`;
        }
        if (!monthKey && rec.date) {
            const parts = String(rec.date).split('/');
            if (parts.length === 3) monthKey = `${parts[2]}-${parts[1]}`;
        }

        if (!monthKey) return;
        monthsSet.add(monthKey);

        // Xodimlarni aniqlash (logs orqali aniqroq bo'ladi)
        const logs = Array.isArray(rec.logs) ? rec.logs : [];
        if (logs.length > 0) {
            const creditedUsers = new Set();
            logs.forEach(log => {
                const name = _resolveKvName(log.uid, rec);
                if (!creditedUsers.has(name)) {
                    creditedUsers.add(name);
                    employeesSet.add(name);
                    
                    if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
                    monthlyData[monthKey][name] = (monthlyData[monthKey][name] || 0) + m2;
                }
            });
        } else if (rec.staffName) {
            const name = rec.staffName;
            employeesSet.add(name);
            if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
            monthlyData[monthKey][name] = (monthlyData[monthKey][name] || 0) + m2;
        }
    });

    const months = Array.from(monthsSet).sort();
    const employees = Array.from(employeesSet).sort();

    return { monthlyData, months, employees };
}
