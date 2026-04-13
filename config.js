// ============================================================
// config.js — Frontend sozlamalari
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwwCfiCjL6Nvi3uXw6gfLkrXJrV30SS7YKoeQbnzJj0wXieWjTHrcn9vtPBtvonFQa4RA/exec";

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

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      // IMPORTANT:
      // Leave Content-Type unset to avoid CORS preflight issues in Telegram WebView.
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Server javobi noto\'g\'ri formatda');
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error("So'rov vaqti tugadi");
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseDateParts,
    getDateMonthYear,
    getTodayDdMmYyyy
  };
}
