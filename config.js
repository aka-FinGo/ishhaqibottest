// ============================================================
// config.js — Frontend sozlamalari
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbxvwRMY-t-9_0S0A7zl8DXSMpCCj35D_kv8iREYDTs5TAMbKTVEs5ol2mpeLaedomA5Og/exec";

const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor && tg.setHeaderColor('#0F172A');

const user = tg.initDataUnsafe?.user;
const employeeName = user ? `${user.first_name} ${user.last_name || ''}`.trim() : "Test User";
const telegramId = user ? String(user.id) : "0";
const tgInitData = typeof tg.initData === 'string' ? tg.initData : '';
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || 'dev';

// Global state
let globalAdminData = [];
let globalAdminDataIsPartial = false;
let filteredData = [];
let myFullRecords = [];
let myFilteredRecords = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

let myRole = 'User';
let myUsername = '';   // Sheetdan kelgan Ism
let myCanAdd = true; // + tugmasi doim ko'rinadi, ruxsat yo'q bo'lsa ogohlantirish
let myInList = false;// Hodimlar sheetida bormi
let myIsSardor = false;
let canViewCompanyActions = false;
let canExportCompanyData = false;
let adminContactId = '';

let myPermissions = {
  canViewAll: false, canEdit: false,
  canDelete: false, canExport: false, canViewDash: false
};

// Keep template rendering safe when using innerHTML with server-provided values.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Parse date safely without locale ambiguity.
// Priority: ISO -> DD/MM/YYYY (also supports DD.MM.YYYY and DD-MM-YYYY).
function parseDateParts(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === 'undefined' || str === 'null') return null;

  let day = '';
  let month = '';
  let year = '';

  // ISO date and ISO datetime
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(str)) {
    year = str.slice(0, 4);
    month = str.slice(5, 7);
    day = str.slice(8, 10);
  } else {
    // DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
    const m = str.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (m) {
      day = m[1].padStart(2, '0');
      month = m[2].padStart(2, '0');
      year = m[3];
    } else if (/^\d{5}(?:\.\d+)?$/.test(str)) {
      // Excel serial date fallback
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

  // Strict calendar validation (e.g., reject 31/02/2026)
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

function getDateMonthYear(value) {
  const parsed = parseDateParts(value);
  if (!parsed) return null;
  return { month: parsed.month, year: parsed.year };
}

function getTodayDdMmYyyy(now = new Date()) {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  return {
    day,
    month,
    year,
    display: `${day}/${month}/${year}`,
    iso: `${year}-${month}-${day}`
  };
}

function setButtonLoading(button, isLoading, text) {
  if (!button) return;
  if (isLoading) {
    if (button.dataset.originalHtml === undefined) {
      button.dataset.originalHtml = button.innerHTML;
    }
    button.disabled = true;
    if (typeof text === 'string' && text.trim()) {
      button.innerHTML = `<span class="btn-text">${escapeHtml(text)}</span>`;
    }
    button.classList.add('btn-loading');
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml !== undefined) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
    button.classList.remove('btn-loading');
  }
}

async function apiRequest(payload, opts) {
  const options = opts || {};
  const timeoutMs = Number(options.timeoutMs) || 25000;

  const body = Object.assign({}, payload || {});
  if (!body.telegramId) body.telegramId = telegramId;
  if (!body.initData && tgInitData) body.initData = tgInitData;

  const canAbort = typeof AbortController !== 'undefined';
  const controller = canAbort ? new AbortController() : null;
  let timeoutId = null;

  if (controller) {
    timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);
  }

  const logAction = 'API [' + (body.action || 'unknown') + ']';
  console.time(logAction);

  try {
    console.log('📤 API so\'rov yuborilmoqda:', body.action || 'unknown');

    const syncEl = document.getElementById('syncIndicator');
    if (syncEl) syncEl.classList.remove('hidden');

    const res = await fetch(API_URL, {
      method: 'POST',
      // IMPORTANT:
      // Leave Content-Type unset to avoid CORS preflight issues in Telegram WebView.
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ' ' + res.statusText);
    }

    const text = await res.text();

    // ✅ FIX: Empty response handling
    if (!text || text.trim() === '') {
      throw new Error('Server bo\'sh javob qaytardi');
    }

    try {
      const parsed = JSON.parse(text);
      console.log('✅ API javob olingan:', body.action || 'unknown');
      console.timeEnd(logAction);
      return parsed;
    } catch (e) {
      console.timeEnd(logAction);
      console.error('❌ JSON parsing xatosi. Response:', text.substring(0, 200));
      throw new Error('Server javobi noto\'g\'ri JSON formatda');
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      console.error('❌ API timeout:', body.action, timeoutMs + 'ms');
      throw new Error('So\'rov vaqti tugadi (' + timeoutMs + 'ms)');
    }

    if (err instanceof TypeError) {
      console.error('❌ Network xatosi:', err.message);
      throw new Error('Tarmoq ulanishida xato: ' + err.message);
    }

    console.timeEnd(logAction);
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    const syncEl = document.getElementById('syncIndicator');
    if (syncEl) syncEl.classList.add('hidden');
  }
}

// ============================================================
// OFFLINE REJIM — Tarmoq holati nazorati
// ============================================================

/**
 * Foydalanuvchiga offline/online holatini ko'rsatish.
 * Banner chiqadi va barcha API so'rovlarida ishlatiladi.
 */
const NetworkStatus = {
  _banner: null,

  init() {
    window.addEventListener('online', () => this._update(true));
    window.addEventListener('offline', () => this._update(false));
    if (!navigator.onLine) this._update(false);
  },

  isOnline() {
    return navigator.onLine;
  },

  _update(online) {
    if (!this._banner) {
      this._banner = document.createElement('div');
      this._banner.id = 'networkBanner';
      this._banner.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0',
        'z-index:9999', 'padding:8px 16px',
        'font-size:13px', 'font-weight:500',
        'text-align:center', 'transition:all 0.3s ease'
      ].join(';');
      document.body.prepend(this._banner);
    }
    if (online) {
      this._banner.style.background = '#1a7a4a';
      this._banner.style.color = '#fff';
      this._banner.textContent = '✅ Tarmoq tiklandi';
      setTimeout(() => {
        if (this._banner) this._banner.style.display = 'none';
      }, 2500);
    } else {
      this._banner.style.display = 'block';
      this._banner.style.background = '#b91c1c';
      this._banner.style.color = '#fff';
      this._banner.textContent = '📵 Internet aloqasi yo\'q — keshdan ko\'rsatilmoqda';
    }
  }
};

// ============================================================
// YAGONA ERROR HANDLER — Barcha API xatolar uchun
// ============================================================

/**
 * API xatosini foydalanuvchiga ko'rsatish.
 * showToastMsg mavjud bo'lsa ishlatadi, aks holda console.error.
 * @param {Error|string} err
 * @param {string} context - Qaysi operatsiyada xato bo'lgani (log uchun)
 */
function handleApiError(err, context) {
  const ctx = context || '';
  const msg = err instanceof Error ? err.message : String(err || 'Noma\'lum xato');
  console.error('❌ [' + (ctx || 'API') + '] ' + msg);

  if (!navigator.onLine) {
    if (typeof showToastMsg === 'function') {
      showToastMsg('📵 Internet yo\'q. Keshdan ma\'lumot ko\'rsatilmoqda.', true);
    }
    return;
  }

  if (typeof showToastMsg === 'function') {
    const userMsg = (msg.includes('timeout') || msg.includes('vaqti'))
      ? '⏱ So\'rov vaqti tugadi. Qayta urinib ko\'ring.'
      : '❌ Xato: ' + msg;
    showToastMsg(userMsg, true);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseDateParts,
    getDateMonthYear,
    getTodayDdMmYyyy
  };
}

// DOMContentLoaded da NetworkStatus ni ishga tushirish (faqat brauzer muhitida)
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', function () { NetworkStatus.init(); });
}