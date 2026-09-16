# Modul Tabiga 3D Portalni Ulash va Kvadratlar Buyurtmalarida 3D Ko'rish Tizimini Joriy Qilish Rejasi

Mazkur reja ilovadagi mavjud "Modul" tabini eskirgan GitHub Pages havolasidan zamonaviy `https://3d.cabix.website/` (Mebel Studio 3D) platformasiga ulash, pastki navigatsiyani yangilash hamda Kvadratlar sahifasidagi buyurtmalar ro'yxatida va har bir buyurtma tafsiloti modalida 3D modelni to'g'ridan-to'g'ri ilova ichida ochuvchi tugmalarni joylashtirishni ta'minlaydi.

---

## Foydalanuvchi Bilan Kelishilgan Asosiy Qoidalar (/grill-me natijasi)
1. **Havola shakllantirish:** Buyurtma raqami (`№`) yoki nomi asosida `https://3d.cabix.website/m/{order_no}?embed=1` avtomatik tarzda shakllantiriladi; agar aniq raqam bo'lmasa umumiy 3D katalogi ochiladi.
2. **Ochilish tajribasi:** Yangi tashqi brauzer oynasiga chiqib ketmasdan, ilova ichidagi "3D Modul" tabiga o'tkaziladi va iframe orqali to'liq ekranda ko'rsatiladi. Yuqoridagi "← Qaytish" tugmasi yana kvadratlar ro'yxatiga qaytaradi.
3. **Tugmalar joylashuvi:**
   - Ro'yxat jadvalidagi har bir buyurtma qatorida ixcham `🧊 3D` tugmasi.
   - Buyurtma tafsiloti (Detail Modal) ichida ko'zga tashlanuvchi keng `👓 3D Ko'rish` tugmasi.
4. **Navigatsiya menyusi:** Pastki navigatsiyadagi tugma `🧊 3D Modul` deb nomlanadi.

---

## Proposed Changes

### Frontend — UI & Navigatsiya

#### [MODIFY] [index.html](file:///e:/Loyihalarim/ishhaqibottest/index.html)
- `#moduleTab` ichidagi `moduleIframe` boshlang'ich manzilini `https://3d.cabix.website/?embed=1` ga o'zgartirish.
- Iframe yuqorisidagi "← Qaytish" tugmasi dizaynini zamonaviy neon/glass uslubiga moslab yaxshilash (`kvadratTab` ga qaytarish).
- Pastki menyudagi `#nav-module` blokini yangilash:
  - Belgisi: `🧊`
  - Yozuvi: `3D Modul`

#### [MODIFY] [ui.js](file:///e:/Loyihalarim/ishhaqibottest/ui.js)
- `updateModuleIframe(customUrl)` funksiyasini kengaytirish:
  - Agar `customUrl` berilgan bo'lsa, iframe ga o'sha manzilni o'rnatish.
  - Aks holda default `https://3d.cabix.website/?embed=1` ni yuklash.
- Yangi global `openKv3DView(orderNo, orderName)` yordamchi funksiyasini yaratish:
  - Buyurtma raqami/nomidan xavfsiz kod (`article`) shakllantiradi.
  - Tegishli havola bilan `moduleTab` ga o'tadi va pastki navigatsiyada `nav-module` ni faollashtiradi.

---

### Kvadratlar Moduli — 3D Tugmalari va Tafsilotlar

#### [MODIFY] [kvadratlar.js](file:///e:/Loyihalarim/ishhaqibottest/kvadratlar.js)
- `renderKvList()` funksiyasida:
  - Jadvalning har bir qatoriga (`trData`) ixcham `🧊 3D` tugmasini joylashtirish (`event.stopPropagation()` bilan, qator bosilganda modal ochilishiga xalaqit bermaydi).
- `showKvDetailModal(idx)` funksiyasida:
  - Buyurtma tafsilotlari kartasi yuqori yoki asosiy harakatlar qismiga chiroyli va qulay `👓 3D Ko'rinishni Ochish` tugmasini qo'shish.
- CSS uslublari:
  - `.kv-row-3d-btn` — ixcham, neon-sariq yoki zamonaviy ko'k aksentli chiroyli nishon.
  - `.kvdm-3d-btn` — tafsilotlar oynasida qulay bosiluvchi keng 3D tugma.

---

### Mebel Studio 3D (Tashqi Iframe Mosligi)

#### [MODIFY] [e:\Loyihalarim\Mebel_Studio\index.html](file:///e:/Loyihalarim/Mebel_Studio/index.html)
- `_tgExtUrl()` skriptiga tekshiruv qo'shish: agar sahifa iframe ichida ochilgan bo'lsa (`window.self !== window.top`) yoki URL da `embed=1` bo'lsa, Telegram tashqi brauzeriga redirect qilmasdan to'g'ridan-to'g'ri iframe ichida 3D WebGL ni ochish.

---

## Verification Plan

### Qo'lda va Integratsion Sinovlar
1. **Navigatsiya sinovi:**
   - Pastki menyudagi `🧊 3D Modul` tugmasi bosilganda `https://3d.cabix.website/` sahifasi ilova ichida yuklanishini tekshirish.
   - "← Qaytish" tugmasi bosilganda oldingi kvadratlar sahifasiga qaytishini tekshirish.
2. **Kvadratlar ro'yxatidan 3D ochish:**
   - Ro'yxatdagi istalgan qatorning `🧊 3D` tugmasini bosish -> `https://3d.cabix.website/m/{order_no}?embed=1` manzili ochilishi.
3. **Buyurtma tafsiloti modalidan 3D ochish:**
   - Buyurtma qatori bosilganda modal ochilishi, u yerdagi `👓 3D Ko'rinish` tugmasi bosilganda modal yopilib, to'g'ridan-to'g'ri 3D tabga o'tishi.
4. **Deploy va Jonli Tekshiruv:**
   - Test muhitiga (`https://test.ish.cabix.website`) va kerak bo'lsa asosiy muhitga yuklash, mobil/desktop Telegram WebApp da sinovdan o'tkazish.
