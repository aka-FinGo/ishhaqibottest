# KV Buyurtmalar Jadvali Filtr Takliflari

## Nima o'zgardi

- `index.html`ga quyidagi yangi filtrlar qo'shildi:
  - Qidiruv maydoni: Buyurtma raqami, nomi yoki xodim bo'yicha instant qidiruv
  - `Status` filtri: `Yangi`, `Bajarilmoqda`, `Tayyor`, `Qaytarildi`
  - `Filtrlarni tozalash` tugmasi
  - Tanlangan filtrlar bo'yicha ko'rsatkichlar (`kvFilterSummary`)

- `kvadratlar.js`ga quyidagi yaxshilanishlar kiritildi:
  - `resetKvFilters()` — barcha filtrlarni qayta tiklaydi
  - `applyKvFilters()`ga qidiruv va status filtri qo'shildi
  - `renderKvList()`da filtrlangan buyurtmalar soni va jami m² miqdori yangilanadi
  - `updateStaffFilterByProcess()`da jarayon tanlovi orasida xodimlar ro'yxati buzilmasligi ta'minlandi

- `style.css`ga yangi filter tavsifi va reset tugmasi uchun uslublar qo'shildi.

## Foydalanilgan fayllar

- `index.html`
- `kvadratlar.js`
- `style.css`

## Keyingi kengaytirishlar uchun takliflar

1. `Filtrlarni guruhlash` yoki `tablarga ajratish` — misol uchun `Bugun`, `Kecha`, `7 kun`, `30 kun`.
2. `Jadval ustunlarini saralash` — `Buyurtma №`, `Oy`, `m²`, `Status` bo'yicha.
3. Natijalarni eksportga yuborish — hozirgi filtrlangan ro'yxatni CSV/Excelga eksport qilish.
4. `Status` va `Jarayon` funktsiyalarini dinamik ravishda serverdan olish va ro'yxatga qo'shish.

> Bu hozirgi bosqich uchun vazifa ishlaydi va keyingi iterationda yanada kuchaytirilishi mumkin.
