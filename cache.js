/**
 * AppCache — Markazlashgan kesh tizimi.
 * Ma'lumotlarni localStorage'da versiya va muddati bilan saqlaydi.
 */
const AppCache = {
    VERSION: '1.0.23',
    KEYS: {
        MY_RECORDS: 'ari_my_recs',
        ADMIN_DATA: 'ari_admin_data',
        USER_DATA: 'ari_user_meta',
        KV_RECORDS: 'ari_kv_recs',
        DATA_VERSIONS: 'ari_data_versions'  // Har jadval uchun server timestamp
    },

    /**
     * Ma'lumotni keshga saqlash
     */
    set(key, data) {
        try {
            const payload = {
                v: this.VERSION,
                t: Date.now(),
                d: data
            };
            localStorage.setItem(key, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error('Cache set error:', e);
            if (e.name === 'QuotaExceededError') {
                this.clearAll(); // To'lib qolsa hammasini tozalash
            }
            return false;
        }
    },

    /**
     * Keshdan ma'lumotni o'qish
     * @param {string} key - Kalit
     * @param {number} maxAgeMin - Maksimal amal qilish muddati (daqiqa)
     */
    get(key, maxAgeMin = 60) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;

            const payload = JSON.parse(raw);

            // Versiya mos kelmasa - eski kesh
            if (payload.v !== this.VERSION) {
                this.remove(key);
                return null;
            }

            // Muddati o'tgan bo'lsa
            const ageMin = (Date.now() - payload.t) / 60000;
            if (ageMin > maxAgeMin) {
                this.remove(key);
                return null;
            }

            return payload.d;
        } catch (e) {
            console.error('Cache get error:', e);
            this.remove(key);
            return null;
        }
    },

    /**
     * Keshdan o'chirish
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) { }
    },

    /**
     * Barcha keshni tozalash
     */
    clearAll() {
        Object.values(this.KEYS).forEach(k => this.remove(k));
        console.log('🗑 Barcha kesh tozalandi');
    },

    /**
     * Server dan kelgan dataVersions ni saqlaydi.
     * { kvadratlar: 1748180000, finance: ..., employees: ..., workflow: ... }
     */
    saveDataVersions(versions) {
        try {
            localStorage.setItem(this.KEYS.DATA_VERSIONS, JSON.stringify(versions));
        } catch (e) { }
    },

    /**
     * Saqlangan server versiyalarini qaytaradi.
     */
    getDataVersions() {
        try {
            const raw = localStorage.getItem(this.KEYS.DATA_VERSIONS);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    },

    /**
     * Server versiyasi bilan solishtiradi.
     * O'zgargan kalitlar arrayini qaytaradi.
     * @param {Object} serverVersions - GAS dan kelgan { kvadratlar, finance, employees, workflow }
     * @returns {string[]} - o'zgargan kalitlar, masalan ['kvadratlar', 'employees']
     */
    diffVersions(serverVersions) {
        const local = this.getDataVersions();
        const changed = [];
        Object.keys(serverVersions || {}).forEach(key => {
            if ((serverVersions[key] || 0) > (local[key] || 0)) {
                changed.push(key);
            }
        });
        return changed;
    }
};