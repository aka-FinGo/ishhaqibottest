# 🛡️ SERVER HODISASI TAHLILI VA SSL MUAMMOSINI BARTARAF ETISH HISOBOTI
**Loyiha:** Aristokrat Ish Haqi (`https://ish.cabix.website`)  
**Server IP:** `205.209.126.158` (Ubuntu Linux / Nginx / PM2 / Node.js)  
**Loyiha Egasi:** `iRealBy_3D`  
**Sana:** 2026-09-08  
**Fayl manzili:** `E:\Loyihalarim\ishhaqibottest\SERVER_INCIDENT_AND_SSL_RESOLUTION.md`

---

## 1. HODISA TAVSIFI (INCIDENT SUMMARY)

* **Muammo:**  
  Foydalanuvchi `https://ish.cabix.website/` manziliga kirganda, "Aristokrat Ish Haqi" tizimi o'rniga "Mebel Studio 3D" (`3d.cabix.website`) sayti ochilib qolayotgan edi.
* **Qo'shimcha belgi:**  
  aaPanel veb-boshqaruv panelining "PHP Project" ro'yxatida `ish.cabix.website` umuman ko'rinmayotgan edi (faqat `pos.cabix.website`, `cabix.website` va `3d.cabix.website` bor edi).

---

## 2. TUB TEXNIK SABAB (ROOT CAUSE ANALYSIS)

Ushbu xatolik Nginx veb-serverining virtual hostlarni (vhost) qayta ishlash arxitekturasi bilan bog'liq bo'lib, quyidagi 2 ta sababdan kelib chiqqan:

1. **Nginx da 443 (SSL) Blokining Yo'qligi:**
   * Serverdagi `/www/server/panel/vhost/nginx/ish.cabix.website.conf` faylida dastlab faqat **`listen 80;`** (oddiy HTTP) sozlangan edi.
   * Faylda **`listen 443 ssl;`** (HTTPS) bloki va SSL sertifikati umuman mavjud emas edi.
2. **Nginx ning Standart SSL Xulq-atvori (Fallback to Default SSL Vhost):**
   * Brauzer yoki telefon avtomatik ravishda xavfsiz **`https://`** (443-port) orqali murojaat qilganda, Nginx 443-portda `server_name ish.cabix.website;` nomli SSL blokni qidirgan va topa olmagan.
   * Nginx qoidasiga ko'ra, agar so'ralgan domenda 443-port konfiguratsiyasi bo'lmasa, u serverdagi 443-portda ishlovchi **birinchi faol SSL vhost** ni ochib beradi.
   * Serverdagi birinchi SSL vhost esa **`3d.cabix.website.conf`** edi! Shu sababli Nginx adashib 3D Mebel Studiyasini ochib yuborgan.
3. **aaPanel Bazasiga Bog'lanmaganligi:**
   * `ish.cabix.website` aaPanel oynasidagi «Add site» tugmasi orqali emas, balki to'g'ridan-to'g'ri terminal orqali Nginx vhost qilib ochilgani uchun aaPanel ning SQLite bazasida (`/www/server/panel/data/default.db`) qayd etilmagan edi.

---

## 3. AMALGA OSHIRILGAN TUZATISHLAR (RESOLUTION STEPS)

Muammoni tubdan va professional darajada hal qilish uchun quyidagi amallar bajarildi:

### 1-qadam: Let's Encrypt SSL Sertifikatini Generatsiya Qilish
Serverdagi `acme.sh` mexanizmi orqali `ish.cabix.website` uchun zamonaviy va xavfsiz **EC-256** shifrli SSL sertifikati olindi va maxsus katalogga o'rnatildi:
* Sertifikat zanjiri: `/www/server/panel/vhost/cert/ish.cabix.website/fullchain.pem`
* Maxfiy kalit: `/www/server/panel/vhost/cert/ish.cabix.website/privkey.pem`
* Amal qilish muddati: 90 kun (Avtomatik yangilanadi).

### 2-qadam: Nginx Virtual Host Konfiguratsiyasini Yangilash
`/www/server/panel/vhost/nginx/ish.cabix.website.conf` fayliga quyidagi to'liq SSL va yo'naltirish bloki kiritildi:
```nginx
server
{
    listen 80;
    listen 443 ssl http2;
    server_name ish.cabix.website;
    index index.html index.htm;
    root /www/wwwroot/ishhaqibottest;

    # SSL Configuration (Let's Encrypt EC-256)
    ssl_certificate    /www/server/panel/vhost/cert/ish.cabix.website/fullchain.pem;
    ssl_certificate_key    /www/server/panel/vhost/cert/ish.cabix.website/privkey.pem;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_ciphers EECDH+CHACHA20:EECDH+CHACHA20-draft:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256:EECDH+3DES:RSA+3DES:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_tickets on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    add_header Strict-Transport-Security "max-age=31536000";

    # Force HTTPS Redirect (80 -> 443 majburiy yo'naltirish)
    if ($server_port !~ 443){
        rewrite ^(/.*)$ https://$host$1 permanent;
    }

    # Certbot / acme.sh tekshiruv yo'li
    location ~ \.well-known {
        allow all;
    }

    # Node.js Express API (Port 3010)
    location /api {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Telegram Bot Webhook (Port 3010)
    location /webhook {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Xavfsizlik: Maxfiy fayllarni bloklash (.env, .db, server, logs, node_modules)
    location ~ ^/(\.user\.ini|\.htaccess|\.git|\.env|\.secrets|\.db|data|server|logs|node_modules|ecosystem\.config\.js|package\.json|package-lock\.json)
    {
        deny all;
        return 404;
    }
}
```

### 3-qadam: aaPanel Boshqaruv Paneliga Muhrlash
aaPanel SQLite bazasiga (`/www/server/panel/data/default.db`) quyidagi yozuv kiritildi:
* **Site ID:** `4`
* **Nomi:** `ish.cabix.website`
* **Ildiz papkasi:** `/www/wwwroot/ishhaqibottest`
* **Domen:** `ish.cabix.website`
* **Status:** `1` (Active / Ishlamoqda)
* **SSL holati:** `89 Days` (Yashil qulf)

### 4-qadam: Nginx Sintaksisini Sinash va Qayta Yuklash
* `nginx -t` buyrug'i berildi: `syntax is ok, test is successful`.
* Nginx veb-serveri qayta yuklandi: `/etc/init.d/nginx reload`.

---

## 4. TEKSHIRUV VA AUDIT NATIJALARI (VERIFICATION)

Browser Tester subagenti orqali to'g'ridan-to'g'ri brauzerda tekshirildi:
1. **`https://ish.cabix.website/`**:
   * **Status:** `HTTP/2 200 OK`
   * **SSL:** `isSecureContext: true` (To'liq yashil qulf)
   * **Sarlavha (Title):** `Aristokrat Ish Haqi (v1.0.23.1)`
   * **Xulosa:** Sayt endi begona 3D loyihasiga kirmaydi, o'zining "Aristokrat Ish Haqi" tizimini to'g'ri va xavfsiz ochmoqda.
2. **`http://ish.cabix.website/` (HTTP)**:
   * `301 Moved Permanently` orqali avtomatik `https://ish.cabix.website/` ga yo'naltirilmoqda.
3. **aaPanel Ro'yxati:**
   * aaPanel da 4 ta sayt (`cabix.website`, `pos.cabix.website`, `3d.cabix.website`, `ish.cabix.website`) to'liq faol ko'rinishga ega bo'ldi.

---

*Hujjat muallifi: Antigravity AI Engine (Cabix OS Architecture)*  
*Tasdiqlovchi: `iRealBy_3D`*
