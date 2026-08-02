// ============================================================
// src/components/ui_utils.js — Global Tab Switching & UI Utilities
// ============================================================

export const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

export function getDavrSortKey(actionPeriod, date, dateISO) {
  if (actionPeriod) return actionPeriod;
  if (dateISO) return dateISO.substring(0, 7);
  const meta = getDateMonthYear(date);
  if (meta) {
    return `${meta.year}-${String(meta.month).padStart(2, '0')}`;
  }
  return date ? date : '0000-00';
}

export function getDavrLabel(davrKey) {
  if (!davrKey || davrKey === '0000-00') return 'Davr noma\'lum';
  const parts = davrKey.split('-');
  if (parts.length >= 2) {
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    if (m >= 1 && m <= 12) {
      return `📅 Davr: ${UZ_MONTHS[m - 1]} ${y}`;
    }
  }
  return `📅 Davr: ${davrKey}`;
}

export function formatRelativeDate(dateStr) {
  if (!dateStr) return 'Sana kiritilmagan';
  const parts = dateStr.split('.');
  if (parts.length !== 3) return dateStr;
  const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  if (isNaN(d.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = (today - d) / msPerDay;
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Kecha';
  return `${parseInt(parts[0])}-${UZ_MONTHS[parseInt(parts[1]) - 1]}`;
}

export function showToastMsg(message, isError = false) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:12px 20px;border-radius:24px;z-index:99999;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,0.3);transition:all 0.3s ease;display:none;align-items:center;gap:8px;';
    document.body.appendChild(toast);
  }
  toast.style.background = isError ? '#ef4444' : '#1e293b';
  toast.innerHTML = isError ? `❌ ${message}` : `✅ ${message}`;
  toast.style.display = 'flex';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// Global Tab Switcher
export function switchTab(tabId, navId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');

  const nav = document.getElementById(navId);
  if (nav) nav.classList.add('active');

  if (tabId === 'moduleTab' && typeof window.initModuleFl === 'function') {
    window.initModuleFl();
  }
}

// Admin Sub-Tab Switcher
export function switchAdminSub(areaId, btnEl) {
  document.querySelectorAll('#adminTab > div[id$="Area"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('#adminNav .admin-sub-btn').forEach(btn => btn.classList.remove('active'));

  const area = document.getElementById(areaId);
  if (area) area.classList.remove('hidden');

  if (btnEl) btnEl.classList.add('active');
}

window.switchTab = switchTab;
window.switchAdminSub = switchAdminSub;
window.showToastMsg = showToastMsg;
