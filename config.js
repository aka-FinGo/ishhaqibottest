// ============================================================
// config.js — Frontend sozlamalari
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbxvwRMY-t-9_0S0A7zl8DXSMpCCj35D_kv8iREYDTs5TAMbKTVEs5ol2mpeLaedomA5Og/exec";

const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor && tg.setHeaderColor('#0F172A');

const user         = tg.initDataUnsafe?.user;
const employeeName = user ? `${user.first_name} ${user.last_name || ''}`.trim() : "Test User";
const telegramId   = user ? String(user.id) : "0";

// Global state
let globalAdminData   = [];
let filteredData      = [];
let myFullRecords     = [];
let myFilteredRecords = [];
let currentPage       = 1;
const ITEMS_PER_PAGE  = 10;

let myRole       = 'User';
let myUsername   = '';   // Sheetdan kelgan laqab
let myCanAdd     = true; // + tugmasi doim ko'rinadi, ruxsat yo'q bo'lsa ogohlantirish
let myInList     = false;// Hodimlar sheetida bormi

let myPermissions = {
  canViewAll:false, canEdit:false,
  canDelete:false, canExport:false, canViewDash:false
};
