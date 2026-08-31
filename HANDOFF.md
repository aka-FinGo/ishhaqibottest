# Loyiha Handoff Hujjati (HANDOFF.md)

## 1. Loyiha Holati va Arxitekturasi
- **Frontend:** Vanilla JS (SPA), CSS3 (neon & iOS switch theme), HTML5.
- **Backend:** Google Apps Script (Web API Gateway, Webhooks, LockService concurrency).
- **Ma'lumotlar Bazasi:** Google Sheets (10-ustunli `dataSheet` Status bilan, `Hodimlar`, `WorkflowSteps`, `Lavozimlar`, `AI_Sozlamalar`).
- **Integratsiyalar:** Telegram WebApp (HMAC SHA256 autentifikatsiya), Telegram Bot API (Inline keyboards, Callback queries).
- **Deploy Holati:** Google Apps Script Web App **Version 108** jonli holatda.

## 2. Amalga Oshirilgan So'nggi O'zgarishlar va Imkoniyatlar
1. **Admin Panel Markaziy Sozlamalar Bo'limi (`adminSettingsArea`):**
   - Faqat Bugalter amal kiritishi rejimi (`ONLY_BUGALTER_ADD`).
   - Xodimlarga tahrirlash/o'chirishni taqiqlash rejimi (`DISABLE_EMP_EDIT_DELETE`).
   - Direktorga bildirishnoma (`NOTIFY_DIRECTOR`).
2. **Bugalter Rejimi va Ikki Tomonlama Telegram Tasdiqlash:**
   - Bugalter va SuperAdmin uchun "➕ Yangi amal" formasida "👤 Xodimni tanlang" ro'yxati.
   - Bugalter xodimga amal kiritganda, xodimning shaxsiy Telegram botiga `[ ✅ Tasdiqlash ] [ ❌ Rad etish ]` tugmalari bilan bildirishnoma borishi va xodim tasdiqlaganda 10-ustun (`Status`) `Tasdiqlandi` ga o'tishi.
   - Oddiy xodim amal kiritganda Bugalterlar va SuperAdminga tasdiqlash so'rovi borishi.
3. **Tahrirlash va O'chirish Taqiqi:**
   - Rejim yoqilganda oddiy xodimlar uchun barcha tahrirlash va o'chirish tugmalari (`✏️`, `🗑`) UI da yashiriladi va backendda bloklanadi.
4. **Tuzatilgan Kritik Muammolar:**
   - Submit paytida tanlangan xodim o'chib ketishi (reset) muammosi alohida `populateAddEmployeeDropdown()` orqali bartaraf etildi.
   - `Telegram.gs` dagi `buildEmployeeList` chaqiruvi `getHodimlar()` ga to'g'irlandi.

## 3. Git va GitHub Mosligi
- **Remote Repository:** `https://github.com/aka-FinGo/ishhaqibottest.git`
- **Branch:** `main`
- **So'nggi Commit Hash:** `9a68b44`
- **Sinxronlik:** 100% to'liq sinxronlangan va toza.

## 4. Muhit va Ulanishlar
- **Asosiy manzil:** `E:\Loyihalarim\GitHub\ishhaqibottest`
- **Google Sheets:** `https://docs.google.com/spreadsheets/d/161ZwGGaORMZOp_Lbug7HWrjEt37kqnLj9QQufxMl-Dc/edit`
- **GAS Deploy Versiyasi:** Version 108 (Active)
