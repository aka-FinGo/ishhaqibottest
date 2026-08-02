// ============================================================
// src/core/api.js — Centralized API Service
// ============================================================
import { API_URL, telegramId, tgInitData } from './config.js';

export async function apiRequest(action, extraParams = {}) {
  const isTgWebApp = (typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData));

  const payload = {
    action,
    telegramId: isTgWebApp 
      ? String(window.Telegram.WebApp.initDataUnsafe?.user?.id || telegramId) 
      : ((typeof window !== 'undefined' && window.telegramId) || telegramId || '0'),
    ...extraParams
  };

  // CRITICAL FIX: Only send tgInitData property when running inside Telegram WebApp with valid initData.
  // Omitting empty tgInitData enables Google Apps Script Web Fallback mode for standard browsers.
  if (isTgWebApp && window.Telegram.WebApp.initData) {
    payload.tgInitData = window.Telegram.WebApp.initData;
  }

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

    // Dynamically update global myRole, myPermissions & Profile UI when returned
    if (data && data.success) {
      if (data.myRole) window.myRole = data.myRole;
      if (data.myPermissions) window.myPermissions = data.myPermissions;
      if (typeof window.updateProfileUI === 'function') {
        window.updateProfileUI();
      }
    }

    return data;
  } catch (error) {
    console.error(`❌ API error (${action}):`, error);
    throw error;
  }
}

export async function adminRequest(action, extraParams = {}) {
  return apiRequest(action, extraParams);
}
