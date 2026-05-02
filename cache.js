/**
 * Smart Cache Manager
 */
const APP_CACHE_KEY = 'aristokrat_app_data';

const AppCache = {
    save: function(data) {
        try {
            const cacheObj = {
                version: data.dataVersion || '0',
                timestamp: Date.now(),
                payload: data
            };
            localStorage.setItem(APP_CACHE_KEY, JSON.stringify(cacheObj));
            console.log('📦 Kesh yangilandi. Versiya:', cacheObj.version);
        } catch (e) {
            console.warn('⚠️ Keshni saqlashda xato:', e);
        }
    },

    get: function() {
        try {
            const raw = localStorage.getItem(APP_CACHE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },

    getVersion: function() {
        const cache = this.get();
        return cache ? cache.version : '0';
    },

    clear: function() {
        localStorage.removeItem(APP_CACHE_KEY);
    }
};
