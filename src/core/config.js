// ============================================================
// src/core/config.js — Modular System Configuration & Utils
// ============================================================
export const API_URL = "https://script.google.com/macros/s/AKfycbxvwRMY-t-9_0S0A7zl8DXSMpCCj35D_kv8iREYDTs5TAMbKTVEs5ol2mpeLaedomA5Og/exec";

export const tg = (typeof window !== 'undefined' && window.Telegram?.WebApp)
  ? window.Telegram.WebApp
  : {
      expand: () => {},
      initDataUnsafe: {},
      initData: ''
    };

if (tg.expand) tg.expand();
if (tg.setHeaderColor) tg.setHeaderColor('#0F172A');

export const user = tg.initDataUnsafe?.user;
export const employeeName = user ? `${user.first_name} ${user.last_name || ''}`.trim() : "Test User";
export const telegramId = user ? String(user.id) : "0";
export const tgInitData = typeof tg.initData === 'string' ? tg.initData : '';
export const APP_VERSION = (typeof document !== 'undefined' && document.querySelector('meta[name="app-version"]')?.content) || 'v1.0.24';
export const ITEMS_PER_PAGE = 10;

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseDateParts(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === 'undefined' || str === 'null') return null;

  let day = '';
  let month = '';
  let year = '';

  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(str)) {
    year = str.slice(0, 4);
    month = str.slice(5, 7);
    day = str.slice(8, 10);
  } else {
    const m = str.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (m) {
      day = m[1].padStart(2, '0');
      month = m[2].padStart(2, '0');
      year = m[3];
    } else if (/^\d{5}(?:\.\d+)?$/.test(str)) {
      const serial = Math.floor(Number(str));
      const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      year = String(utc.getUTCFullYear());
      month = String(utc.getUTCMonth() + 1).padStart(2, '0');
      day = String(utc.getUTCDate()).padStart(2, '0');
    } else {
      return null;
    }
  }

  const y = Number(year);
  const mNum = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || year.length !== 4) return null;
  if (!Number.isInteger(mNum) || mNum < 1 || mNum > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;

  const check = new Date(Date.UTC(y, mNum - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mNum - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }

  return {
    day,
    month,
    year,
    iso: `${year}-${month}-${day}`,
    display: `${day}/${month}/${year}`
  };
}

export function getDateMonthYear(value) {
  const parsed = parseDateParts(value);
  if (!parsed) return null;
  return { month: Number(parsed.month), year: Number(parsed.year) };
}

export function getTodayDdMmYyyy(now = new Date()) {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
}
