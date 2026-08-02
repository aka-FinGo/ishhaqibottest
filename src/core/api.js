// ============================================================
// src/core/api.js — Centralized API Service
// ============================================================
import { API_URL, telegramId, tgInitData } from './config.js';

export async function apiRequest(action, extraParams = {}) {
  const currentTgId = (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user?.id)
    ? String(window.Telegram.WebApp.initDataUnsafe.user.id)
    : (localStorage.getItem('saved_telegram_id') || (typeof window !== 'undefined' && window.telegramId) || telegramId || '0');

  const currentInitData = (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData)
    ? window.Telegram.WebApp.initData
    : ((typeof window !== 'undefined' && window.tgInitData) || tgInitData || '');

  const payload = {
    action,
    telegramId: currentTgId,
    tgInitData: currentInitData,
    ...extraParams
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ API error (${action}):`, error);
    throw error;
  }
}

export async function adminRequest(action, extraParams = {}) {
  return apiRequest(action, extraParams);
}
