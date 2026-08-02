// ============================================================
// src/core/api.js — Centralized API Service
// ============================================================
import { API_URL, telegramId, tgInitData } from './config.js';

export async function apiRequest(action, extraParams = {}) {
  const payload = {
    action,
    telegramId,
    tgInitData,
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
