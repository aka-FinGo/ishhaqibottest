// ============================================================
// src/main.js — Main Bootstrapper & Entry Point
// ============================================================
import { API_URL, tg, user, employeeName, telegramId, APP_VERSION } from './core/config.js';
import { AppState } from './core/state.js';
import { apiRequest } from './core/api.js';
import { AppCache } from './core/cache.js';

console.log(`🚀 Aristokrat Ish Haqi Modular System Initialized (${APP_VERSION})`);

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM Content Loaded in Modular App');
});
