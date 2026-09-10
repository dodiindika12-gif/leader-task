# 📱 Panduan Lengkap Versi Android & Download File APK — Busana

Proyek **Busana (Beauty Task Management)** kini telah dilengkapi dengan struktur aplikasi Android native berbasis **Capacitor** serta sistem **Otomatisasi Build APK (CI/CD GitHub Actions)**.

---

## 🚀 Cara Paling Mudah: Unduh File `.apk` Otomatis dari GitHub

Karena GitHub Actions telah disiapkan, Anda tidak perlu menginstal Android Studio atau SDK berukuran belasan gigabyte di komputer Anda. GitHub akan meng-compile file APK secara otomatis di cloud!

### Langkah-langkah:
1. **Push kode ke GitHub**:
   ```bash
   git push origin main
   ```
2. **Buka tab GitHub Actions**:
   - Buka repositori Anda di browser: [https://github.com/dodiindika12-gif/leader-task/actions](https://github.com/dodiindika12-gif/leader-task/actions)
3. **Pilih workflow terbaru**:
   - Klik alur kerja bernama **"Build Busana Android APK"** yang sedang atau baru selesai berjalan (ditandai ikon centang hijau ✅).
4. **Unduh File APK**:
   - Gulir ke bagian paling bawah di halaman workflow tersebut pada bagian **Artifacts**.
   - Klik **`Busana-Android-APK`** untuk mengunduh berkas zip berisi file `Busana.apk`.
   - File ini siap dibagikan ke anggota tim atau diinstal langsung di smartphone Android.

---

## 📲 Cara Instalasi di Smartphone Android

1. Kirim file `Busana.apk` ke smartphone Anda (bisa lewat WhatsApp, Telegram, Google Drive, atau kabel USB).
2. Ketuk file `Busana.apk` untuk memulai instalasi.
3. **Jika muncul izin keamanan (*Install unknown apps / Sumber tidak dikenal*)**:
   - Ketuk **Settings / Pengaturan**.
   - Aktifkan tombol centang **"Izinkan dari sumber ini" (*Allow from this source*)**.
4. Ketuk **Instal**.
5. Aplikasi **Busana** dengan logo resmi dan splash screen elegan akan muncul di Layar Utama (*Home Screen*) dan daftar aplikasi HP Anda!

---

## 💻 Cara Buka & Build Sendiri di Android Studio (Opsional)

Jika Anda memiliki PC/Laptop yang sudah terpasang **Android Studio**:

1. **Sinkronisasi Asset Terbaru**:
   ```bash
   npm run cap:sync
   ```
2. **Buka Proyek di Android Studio**:
   ```bash
   npm run cap:open
   ```
   *(Atau buka Android Studio secara manual lalu pilih folder `leader-dashboard/android`)*.
3. **Build File APK di Android Studio**:
   - Klik menu atas: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - Setelah selesai, klik notifikasi **"locate"** untuk mengambil file `app-debug.apk`.

---

## 🌐 Menghubungkan ke Domain / Server Produksi (Live Sync)

Agar aplikasi Android otomatis tersinkronisasi langsung dengan data server web Anda secara real-time tanpa perlu re-build APK setiap kali ada perubahan fitur:

1. Buka berkas `capacitor.config.json`.
2. Tambahkan properti `url` pada objek `server`:
   ```json
   {
     "appId": "id.biz.abskdi.busana",
     "appName": "Busana",
     "webDir": "public",
     "server": {
       "url": "https://domain-busana-anda.com",
       "androidScheme": "https",
       "cleartext": true
     }
   }
   ```
3. Jalankan `npm run cap:sync` dan lakukan `git push origin main`.
