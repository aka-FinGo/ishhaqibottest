// ============================================================
// src/main.js — Main Bootstrapper & Entry Point for Vite SPA
// ============================================================

// Core imports
import { API_URL, tg, user, employeeName, telegramId, APP_VERSION } from './core/config.js';
import { AppState } from './core/state.js';
import { apiRequest } from './core/api.js';
import { AppCache } from './core/cache.js';

// Stylesheet imports
import './styles/style.css';
import './styles/components.css';
import './styles/dark.css';
import './styles/ai_chat.css';
import './styles/gloss.css';
import './styles/module_fl.css';

// Component imports
import { UZ_MONTHS, getDavrSortKey, getDavrLabel, formatRelativeDate, showToastMsg } from './components/ui_utils.js';

// Global window bindings for HTML event handlers
window.API_URL = API_URL;
window.tg = tg;
window.user = user;
window.employeeName = employeeName;
window.telegramId = telegramId;
window.APP_VERSION = APP_VERSION;

window.AppState = AppState;
window.apiRequest = apiRequest;
window.AppCache = AppCache;

window.UZ_MONTHS = UZ_MONTHS;
window.getDavrSortKey = getDavrSortKey;
window.getDavrLabel = getDavrLabel;
window.formatRelativeDate = formatRelativeDate;
window.showToastMsg = showToastMsg;

console.log(`🚀 Aristokrat Ish Haqi Modular System Initialized (${APP_VERSION})`);

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Aristokrat Modular System Bootstrapped successfully');
});
