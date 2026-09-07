# Analisa Menyeluruh Web Aplikasi (Task Leader Dashboard)

## 1. Arsitektur & Teknologi Utama
- **Framework:** Next.js (App Router) versi `16.2.9` dengan React `19.2.4`.
- **Styling:** Tailwind CSS (v4) beserta modul PostCSS, memanfaatkan tipografi dan utility class tingkat lanjut.
- **Database:** Supabase PostgreSQL dengan skema kustom bernama `task_leader` (bukan skema `public` bawaan).
- **Animasi & UI:** `framer-motion` untuk interaksi UI yang dinamis, ikon dari `lucide-react` dan FontAwesome.
- **AI Integration:** `@ai-sdk/openai` dan pustaka `ai` terintegrasi pada rute API `/api/chat`, yang dikonfigurasi ke endpoint Hermes AI kustom (`https://hermes.absgroup.biz.id`).

## 2. Struktur Kode & Desain Pola
- **Desain Monolitik Frontend:** Hampir seluruh logika komponen React, *state*, dan UI (sekitar ~3.300 baris kode) digabungkan di dalam satu file tunggal: `app/page.js`. Hal ini mencakup komponen-komponen besar seperti `LoginScreen`, `MainDashboard`, `KanbanView`, `TableView`, `WeatherWidget`, `AbsCalendar`, hingga `NotesPage`.
- **Client-Side Rendering:** Karena menggunakan arahan `"use client"` di puncak `app/page.js`, aplikasi ini bertumpu pada *Client-Side Rendering (CSR)* alih-alih fitur *Server Components* Next.js secara maksimal.
- **State Management & Sesi:** Mengelola *state* dengan standard React Hooks (`useState`, `useEffect`) dan melakukan persistensi sesi *(session)* lokal di browser (menggunakan kunci `task_abs_session` & `task_abs_tools_current_pic_id`).

## 3. Fitur & Modul Utama Aplikasi
1. **Manajemen Tugas (Task Manager):**
   - Tampilan ganda: **Kanban Board** (`To Do`, `In Progress`, `Done`) dan **Table View**.
   - Indikator visual progres penyelesaian (`ProgressRing`) dan klasifikasi prioritas tugas (`High`, `Medium`, `Low`).
2. **Manajemen Pengguna & Hak Akses (Members & Roles):**
   - Mengelola keanggotaan berdasarkan Divisi (IT, HCGA, Marcomm, Finance, dll.) dan Peran (Staff, Kordinator, SPV, Manager, Direksi).
   - Memiliki modal keamanan tambahan (PIN/Password) melalui `PIN_UNLOCK_KEY` untuk mengamankan tindakan-tindakan tertentu.
3. **Kolaborasi & Pembagian Proyek (Workspace Sharing):**
   - Melibatkan *sharing selector* dan integrasi database (lewat tabel `project_access`) untuk berbagi proyek antar anggota (terlihat dari `workspace_sharing.sql`).
4. **Produktivitas & Widget Tambahan:**
   - **Shortcut Launcher:** Tombol pintas cepat ke *tools* internal dan eksternal seperti Portal BA, Portal Promo, Meta Ads, Canva, dan Shopee.
   - **Notes & AbsCalendar:** Fitur pencatatan (notes/notulen) dan fitur kalender.
   - **Weather Widget:** Mengambil secara spesifik data iklim dan cuaca untuk wilayah Kendari (Lat: -3.9450, Lon: 122.4989).
5. **Asisten AI Terintegrasi:**
   - Menyediakan fitur *chat interface* langsung (`ChatInput`, `ChatMessage`) yang terhubung ke model bahasa melalui AI SDK.

## 4. Analisis Skema Database (Supabase `task_leader`)
- File `workspace_sharing.sql` mengonfirmasi bahwa ekosistem ini memisahkan data ke dalam tabel `projects`, `members`, dan `project_access` (untuk *sharing control*).
- **Row Level Security (RLS)** telah diimplementasikan, dengan relasi struktural `owner_id` untuk menetapkan kepemilikan proyek.

## 5. Profil Produk & Visi Aplikasi (Asana + Notion for ABS Group)
Aplikasi ini dirancang sebagai **Work Management & Collaborative Workspace** terpadu khusus internal Karyawan **ABS Group**, menggabungkan keunggulan **Asana** (eksekusi tugas & proyek) dan **Notion** (dokumentasi & pengetahuan):
- **Manajemen Task & Proyek Lintas Divisi:** Koordinasi tugas antar tim/divisi (IT, HCGA, Marcomm, Finance, dll.) dengan kepemilikan dan hak akses terdistribusi.
- **Multi-View Task & Proyek:**
  - ✅ **Table View:** Daftar tugas detail dengan filter, status, PIC, dan deadline.
  - ✅ **Kanban Board:** Kolom alur kerja visual (*To Do*, *In Progress*, *Done*).
  - 🔄 **Timeline View (Gantt/Roadmap):** Visualisasi jadwal, rentang waktu pengerjaan tugas, dan milestone proyek (target pengembangan berikutnya).
  - ✅ **Kalender:** Visualisasi tenggat waktu task dan jadwal proyek bulanan.
- **Knowledge & Meeting Hub:**
  - ✅ **Catatan (Notes):** Pencatatan ide, isu, dan memo kerja tim.
  - 🔄 **Minute of Meeting (MoM):** Dokumentasi hasil rapat terstruktur (agenda, peserta, keputusan, serta konversi otomatis poin keputusan menjadi task yang dapat ditugaskan ke PIC).

## 6. Rekomendasi & Rencana Pengembangan
1. **Implementasi Timeline View:** Menambahkan mode tampilan Timeline / Gantt chart di halaman proyek di samping Tab *Table* dan *Board*.
2. **Penguatan Modul Minute of Meeting (MoM):** Menyediakan template khusus notulen rapat dengan penugasan *action items* instan ke anggota divisi terkait.
3. **Refactoring Skala Besar (Pemisahan Komponen):** Memecah `app/page.js` yang berukuran sangat besar (~3.300 baris kode) ke dalam modul komponen terpisah di direktori `components/`.
4. **Optimalisasi Server Components & Keamanan:** Memisahkan rendering statis dan mengamankan endpoint API (misal `/api/chat`) dengan autentikasi sesi.

