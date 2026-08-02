// ============================================================
// src/core/config.js — Modular System Configuration
// ============================================================
export const API_URL = "https://script.google.com/macros/s/AKfycbwwCfiCjL6Nvi3uXw6gfLkrXJrV30SS7YKoeQbnzJj0wXieWjTHrcn9vtPBtvonFQa4RA/exec";

export const tg = window.Telegram?.WebApp || {
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
export const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || 'v1.0.24';
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
