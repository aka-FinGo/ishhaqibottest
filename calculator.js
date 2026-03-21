// ============================================================
// calculator.js — Netto kalkulyator + What-if + local history
// ============================================================
const CALC_HISTORY_KEY = 'ish_haqi_calc_history_v1';
let lastCalc = null;

function fmtMoney(v) {
  return `${Math.round(v || 0).toLocaleString()} UZS`;
}

function calculateSalary() {
  const brutto = Number(document.getElementById('calcBrutto').value) || 0;
  const taxPct = Number(document.getElementById('calcTax').value) || 0;
  const bonus = Number(document.getElementById('calcBonus').value) || 0;
  const overtimeHours = Number(document.getElementById('calcOvertimeHours').value) || 0;
  const overtimeRate = Number(document.getElementById('calcOvertimeRate').value) || 0;
  const penalty = Number(document.getElementById('calcPenalty').value) || 0;

  if (brutto <= 0) {
    showToastMsg('❗ Brutto maosh kiriting', true);
    return;
  }

  const overtime = overtimeHours * overtimeRate;
  const taxableBase = brutto + overtime + bonus;
  const taxAmount = taxableBase * (taxPct / 100);
  const netto = taxableBase - taxAmount - penalty;

  lastCalc = {
    brutto, taxPct, bonus, overtimeHours, overtimeRate, overtime,
    penalty, taxAmount, netto,
    date: new Date().toISOString()
  };

  renderCalcResult(lastCalc);
  persistCalcHistory(lastCalc);
  updateRaisePreview();
}

function renderCalcResult(data) {
  const box = document.getElementById('calcResult');
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="card-title">Hisob-kitob natijasi</div>
    <div class="calc-result-grid">
      <div class="mini-stat"><div class="k">Brutto</div><div class="v">${fmtMoney(data.brutto)}</div></div>
      <div class="mini-stat"><div class="k">Soliq (${data.taxPct}%)</div><div class="v">-${fmtMoney(data.taxAmount)}</div></div>
      <div class="mini-stat"><div class="k">Bonus</div><div class="v">+${fmtMoney(data.bonus)}</div></div>
      <div class="mini-stat"><div class="k">Overtime</div><div class="v">+${fmtMoney(data.overtime)}</div></div>
      <div class="mini-stat"><div class="k">Ushlanma</div><div class="v">-${fmtMoney(data.penalty)}</div></div>
      <div class="mini-stat"><div class="k">Netto</div><div class="v" style="color:var(--green-dark)">${fmtMoney(data.netto)}</div></div>
    </div>
  `;
}

function getCalcHistory() {
  try {
    return JSON.parse(localStorage.getItem(CALC_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistCalcHistory(item) {
  const hist = getCalcHistory();
  hist.unshift(item);
  localStorage.setItem(CALC_HISTORY_KEY, JSON.stringify(hist.slice(0, 10)));
  renderCalcHistory();
}

function renderCalcHistory() {
  const el = document.getElementById('calcHistory');
  if (!el) return;
  const hist = getCalcHistory();
  if (!hist.length) {
    el.innerHTML = '<div class="empty-state"><p>Hozircha hisob-kitob yo\'q</p></div>';
    return;
  }

  el.innerHTML = hist.map(h => {
    const d = new Date(h.date);
    const when = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    return `<div class="compact-item">
      <div>
        <div style="font-weight:700;">${fmtMoney(h.netto)}</div>
        <div style="font-size:11px;color:var(--text-muted)">Brutto: ${fmtMoney(h.brutto)}</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted)">${when}</div>
    </div>`;
  }).join('');
}

function updateRaisePreview() {
  const slider = document.getElementById('raisePercent');
  const label = document.getElementById('raisePercentLabel');
  const preview = document.getElementById('raisePreview');
  if (!slider || !label || !preview) return;

  const pct = Number(slider.value) || 0;
  label.innerText = `${pct}%`;

  const base = lastCalc?.brutto || (Number(document.getElementById('calcBrutto')?.value) || 0);
  if (!base) {
    preview.innerText = 'Brutto kiriting va hisoblang.';
    return;
  }

  const newBrutto = base * (1 + pct / 100);
  preview.innerHTML = `
    <b>Yangi brutto:</b> ${fmtMoney(newBrutto)} <br>
    <span style="color:var(--text-muted);font-size:12px;">+${fmtMoney(newBrutto - base)} o'sish</span>
  `;
}

window.addEventListener('load', () => {
  renderCalcHistory();
  updateRaisePreview();
});
