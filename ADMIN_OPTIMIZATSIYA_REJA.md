# Admin Panelni Optimizatsiya Qilish Rejasi

Ushbu hujjat admin panelning ishlash tezligini oshirish va foydalanish qulayligini yaxshilash uchun taklif etilgan rejalarni o'z ichiga oladi.

## 1. Arxitektura: "One-Shot" Loading
Hozirgi holatda har bir bo'lim (Hodimlar, Workflow, Lavozimlar) alohida API so'rov yuboradi.
- **Taklif:** Admin panelga kirganda barcha kerakli ma'lumotlarni (`hodimlar`, `workflow`, `positions`, `global_settings`) bitta API so'rovda (`admin_init`) yuklab olish.
- **Natija:** Server bilan bog'lanishlar soni kamayadi, interfeys tezroq yuklanadi.

## 2. Keshlashtirish (Smart Caching)
- **Taklif:** `localStorage` dan foydalanib, ma'lumotlarni birinchi keshdan ko'rsatish (instant UI).
- **Fondagi yangilanish:** Kesh ko'rsatilgandan so'ng, fonda serverdan yangi ma'lumotlarni olib, keshni yangilab qo'yish (Stale-while-revalidate).

## 3. Hodimlar Ro'yxati (Staff List) Optimizatsiyasi
- **Qidiruv va Filtr:** Ism yoki Telegram ID bo'yicha real-vaqtda qidiruv (live search) qo'shish.
- **Instant Modal:** Hodim sozlamalarini ochganda serverga qayta so'rov yubormasdan, allaqachon yuklangan ma'lumotlardan foydalanish.
- **Ixcham Ko'rinish:** Kartalar o'rniga ixchamroq jadval (Compact Table) ko'rinishini joriy qilish.

## 4. Sozlamalar (Settings) Interfeysi
- **Birlashgan Interfeys:** Workflow, Positions va boshqa sozlamalarni bitta sahifada **Accordion** (ochilib-yopiluvchi) bloklar ko'rinishida guruhlash.
- **Guruhlab Saqlash (Batch Update):** Sozlamalarni bittadan emas, barcha o'zgarishlarni kiritib bo'lgach bitta "Asosiy Saqlash" tugmasi bilan jo'natish.

## 5. Dizayn va UX (Premium Design)
- **Zamonaviy Estetika:** Glassmorphism, yumshoq gradientlar va chiroyli ranglar palitrasi.
- **Animatsiyalar:** Micro-animations (yuklanish, tugma bosilishi, o'tish effektlari).
- **Status Indicators:** Tizim holatini (Online/Offline) ko'rsatuvchi indikatorlar.

---
*Ushbu reja 2026-05-05 dagi muhokama asosida tuzildi.*
