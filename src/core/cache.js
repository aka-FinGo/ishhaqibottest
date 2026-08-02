// ============================================================
// src/core/cache.js — Modular AppCache Service
// ============================================================

export const AppCache = {
  get(key) {
    try {
      const raw = localStorage.getItem(`app_cache_${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.ttl && Date.now() > parsed.ttl) {
        localStorage.removeItem(`app_cache_${key}`);
        return null;
      }
      return parsed.data;
    } catch (e) {
      console.warn(`Cache read error (${key}):`, e);
      return null;
    }
  },

  set(key, data, ttlSeconds = 300) {
    try {
      const payload = {
        data,
        ttl: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null,
        updatedAt: Date.now()
      };
      localStorage.setItem(`app_cache_${key}`, JSON.stringify(payload));
    } catch (e) {
      console.warn(`Cache write error (${key}):`, e);
    }
  },

  remove(key) {
    localStorage.removeItem(`app_cache_${key}`);
  },

  clear() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('app_cache_')) localStorage.removeItem(k);
    });
  }
};

window.AppCache = AppCache;
