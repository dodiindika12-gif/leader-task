# 🌸 Panduan Aplikasi Standalone Android — Bebie AI (Chat Bebie)

Aplikasi **Bebie AI (Beauty Bestie AI Assistant)** kini hadir sebagai **aplikasi Android standalone (mandiri)**.

Aplikasi ini didesain khusus hanya untuk interaksi langsung dengan Bebie:
1. **Layar Login**: Menggunakan kredensial akun yang **sama persis dengan Busana** (email & password dari database `task_leader.members`).
2. **Langsung Chat Bebie**: Begitu berhasil login, aplikasi **langsung membuka tampilan Chat Bebie** tanpa tab menu dashboard, tanpa daftar tugas, dan tanpa distraksi lainnya.
3. **Menu Profil & Keluar**: Terdapat avatar pengguna di pojok kanan atas untuk melihat status akun dan tombol keluar (*logout*) yang mudah diakses kapan saja.

---

## 🚀 Cara Paling Mudah: Unduh File `.apk` Otomatis dari GitHub Actions

Anda tidak perlu menginstal Android Studio atau SDK besar di komputer Anda. GitHub Actions akan meng-compile file APK secara otomatis di cloud!

### Langkah-langkah:
1. **Push kode terbaru ke GitHub**:
   ```bash
   git push origin main
   ```
2. **Buka tab GitHub Actions di browser**:
   👉 [https://github.com/dodiindika12-gif/leader-task/actions](https://github.com/dodiindika12-gif/leader-task/actions)
3. **Pilih workflow**:
   - Klik workflow bernama **"Build Bebie AI Android APK"**.
   - Atau klik tombol **"Run workflow"** untuk memicu build manual kapan saja.
4. **Unduh File APK**:
   - Setelah proses build selesai (centang hijau ✅), gulir ke bagian paling bawah di halaman workflow tersebut pada bagian **Artifacts**.
   - Klik **`BebieAI-Android-APK`** untuk mengunduh file zip yang berisi berkas **`BebieAI.apk`**.

---

## 📲 Cara Instalasi di Smartphone Android

1. Kirim file `BebieAI.apk` ke HP Android Anda (melalui WhatsApp, Telegram, Google Drive, atau kabel USB).
2. Ketuk file `BebieAI.apk` untuk memulai instalasi.
3. Jika muncul dialog izin keamanan (*Install unknown apps / Sumber tidak dikenal*):
   - Ketuk **Settings / Pengaturan**.
   - Aktifkan **"Izinkan dari sumber ini" (*Allow from this source*)**.
4. Ketuk **Instal**.
5. Ikon **Bebie AI** dengan tema pink elegan 🌸 akan muncul di Layar Utama HP Anda!

---

## 🔑 Login dengan Kredensial Busana

Buka aplikasi Bebie AI, lalu masukkan email dan password yang sama dengan yang Anda gunakan di web dashboard Busana:
- **Email**: Email kerja Anda (contoh: `dodiindika12@gmail.com` atau akun Leader Anda).
- **Password**: Password akun Busana Anda.
- **Akun Super User (Pengujian Cepat)**:
  - Email: `abskdi.markom@gmail.com`
  - Password: `ABSgroup#123`

Setelah tombol **"Masuk ke Bebie Chat"** ditekan, Anda akan langsung disambut oleh Bebie dengan topik-topik analisa bisnis kecantikan siap pakai:
- 🎁 **Cek Poin & Member Loyalty** (Affari Retail API)
- 👥 **Absensi BA Hari Ini** (Beauty Advisor Shift & Kehadiran Outlet)
- 📹 **Setoran Konten BA** (Video Promosi TikTok/IG)
- 🚨 **Audit KPI & Rekomendasi SP Konten**
- 🏷️ **Promo & Diskon Aktif Hari Ini**
- 📈 **Pencapaian Omset vs Target Per Cabang** (BigQuery)
- 📊 **Format Presentasi PPTX & Rangkuman Rapat**

---

## 💻 Menjalankan di Komputer Lokal / Emulator (Untuk Developer)

Jika ingin menjalankan aplikasi secara lokal dengan Expo di folder `apps/mobile`:

```bash
cd apps/mobile

# Jalankan Expo Dev Server
npx expo start

# Jalankan langsung ke emulator / HP via USB
npx expo run:android
```

---

## 🌐 Akses Web Standalone

Selain melalui aplikasi Android `.apk`, versi web dari Chat Bebie juga kini dapat dibuka langsung secara mandiri di:
👉 **`https://task.absgroup.biz.id/chat`**

Jika pengguna belum login, halaman tersebut kini otomatis menampilkan form login dengan kredensial Busana dan langsung membuka Bebie Chat setelah login berhasil.
