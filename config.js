// ============================================================
// config.js — Frontend sozlamalari
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwXgZ13q3qzNdtj6iKd5LKvYapN-raKMDB9EAVkA4dwAdjK2hGkQVz202zUbfbKeJAkoA/exec";

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
