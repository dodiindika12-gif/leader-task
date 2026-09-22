# UI Style Guide: Busana Leader Dashboard

> Panduan resmi elemen antarmuka (UI) aplikasi **Busana | Beauty Asana**.
> Halaman interaktif: `/ui`: File ini juga bisa diunduh dari halaman tersebut.
> Terakhir diperbarui: 22 September 2026.

---

## 1. Prinsip Desain

| Prinsip | Penjelasan |
|---|---|
| Soft & Feminine | Nuansa pastel (pink, lavender, peach, mint) sebagai identitas brand beauty. |
| Glassmorphism | Kartu半 transparan `bg-white/60–80` + `backdrop-blur` di atas latar gradasi pastel. |
| Rounded ekstensif | Sudut membulat dominan: `rounded-xl` sampai `rounded-3xl`; pill/badge `rounded-full`. |
| Hierarki teks kecil | Ukuran body `text-xs`–`text-sm`; label mikro `text-[9px]`–`text-[11px]`. |
| Ikon Font Awesome | Semua ikon memakai Font Awesome 6.4 (`fa-solid`, `fa-regular`, `fa-brands`). |
| Feedback halus | Hover lembut (`hover:bg-slate-100`), shadow tipis, transition bawaan Tailwind. |

---

## 2. Teknologi & Stack UI

| Teknologi | Peran |
|---|---|
| Next.js 16 (App Router) | Framework: seluruh UI di `app/page.js`, `components/`, halaman terpisah `/docs`, `/ui`, `/chat`. |
| React 19 + React Compiler | Rendering & optimasi otomatis. |
| Tailwind CSS 4 | Satu-satunya sistem styling (`@import "tailwindcss"` di `app/globals.css`). |
| Font Awesome 6.4.0 (CDN) | Ikon di seluruh aplikasi. |
| lucide-react | Ikon tambahan khusus halaman docs (`/docs`). |
| next/font (Google Fonts) | Memuat Inter, Pacifico, Geist, Geist Mono. |
| Capacitor | Wrapper Android (PWA-installable, manifest tersedia). |

Tidak menggunakan library komponen (tanpa shadcn/ui, Radix, MUI). Semua komponen hand-rolled dengan Tailwind.

---

## 3. Tipografi / Font

| Font | CSS Variable | Kelas | Kegunaan |
|---|---|---|---|
| **Inter** (400–700) | `--font-inter` | `.font-inter` | Font utama heading & body (halaman login, brand sekunder). |
| **Geist Sans** | `--font-geist-sans` | `--font-sans` (theme) | Font default global via `@theme`. |
| **Pacifico** | `--font-pacifico` | `.font-pacifico` | Wordmark/logo "Busana" saja: tidak untuk teks fungsional. |
| **Geist Mono** | `--font-geist-mono` | `--font-mono` (theme) | Kode, SQL, value teknis di halaman docs. |

### Skala font yang dipakai

| Tailwind | Penggunaan |
|---|---|
| `text-3xl` / `text-4xl` (font-extrabold) | Judul hero halaman docs. |
| `text-2xl`/`text-3xl` font-bold | Judul view (Board, Table). |
| `text-base`–`text-lg` font-bold | Judul kartu/panel. |
| `text-sm` font-medium/semibold | Body, item navigasi, tombol besar. |
| `text-xs` font-semibold/bold | Body padat, label form, tombol kecil. (paling umum) |
| `text-[11px]`, `text-[10px]`, `text-[9px]` | Mikro-meta: timestamp, badge, keterangan bantu. |

### Label form (pola resmi)

```jsx
<label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
    Nama Lengkap
</label>
// varian form wajib (login/ganti password):
<label className="block text-xs font-bold text-slate-900 mb-1">
    Password Baru <span className="text-rose-500">*</span>
</label>
```

---

## 4. Sistem Warna

### 4.1 Latar aplikasi (identity background)

- Dashboard utama: gradasi pastel diagonal 135°:
  `bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)]`
  (lavender ke sky ke pink ke biru muda). CSS var: `--pastel-mesh`.
- Layar login: `bg-gradient-to-br from-pink-50/80 via-slate-50 to-purple-50/60`.
- Halaman docs/UI docs: tema gelap slate-950 + aksen emerald.
- Theme-color / brand aksen: `#ff008c` (pink brand metadata PWA).

### 4.2 Tint pastel terdaftar (CSS class, `app/globals.css`)

| Kelas | Soft bg | Teks | Solid gradient (135°) |
|---|---|---|---|
| `tint-lavender` | `#ede9fe` | `#6d28d9` | `#a78bfa ke #7c3aed` |
| `tint-sky` | `#e0f2fe` | `#0369a1` | `#38bdf8 ke #0284c7` |
| `tint-pink` | `#fce7f3` | `#be185d` | `#f472b6 ke #db2777` |
| `tint-peach` | `#ffedd5` | `#c2410c` | `#fb923c ke #ea580c` |
| `tint-mint` | `#d1fae5` | `#047857` | `#34d399 ke #059669` |

Varian `tint-*-solid` dipakai untuk chip aktif/avatar gradasi.

### 4.3 Palet netral & semantik (Tailwind)

| Kegunaan | Kelas |
|---|---|
| Teks primer | `text-slate-900` / `text-slate-800` |
| Teks sekunder | `text-slate-600` / `text-slate-700` |
| Teks tersier/mikro | `text-slate-500` / `text-slate-400` |
| Border halus | `border-slate-200` (+ varian opacity `/60`, `/80`) |
| Border kartu glass | `border-white/70`–`/80` |
| Permukaan kartu | `bg-white` opaque, atau glass `bg-white/60`–`/80` |
| Footer/strip tabel grup | `bg-slate-100/90`, `bg-slate-50/70` |
| Bahaya / overdue | `rose-*` (`bg-rose-500`, `text-rose-600`, `bg-rose-50`) |
| Peringatan / due today | `amber-*` (`bg-amber-50`, `text-amber-600/700`) |
| Sukses / selesai | `emerald-*` (`bg-emerald-600`, `text-emerald-700`) |
| Info / aksi primer | `indigo-*` (`bg-indigo-600`, `text-indigo-600`) |
| Brand khusus WA | `emerald` (ikon `fa-brands fa-whatsapp`) |
| What's-new / brand pink | `pink-*` (`bg-pink-100 text-pink-700`) |

### 4.4 Warna status kanban (COLUMN_TINTS di `app/page.js`)

| Status | Chip | Header kolom | Zona drop |
|---|---|---|---|
| To Do | `tint-sky` | `bg-sky-50/70` | `bg-sky-50/40 border-sky-100` |
| In Progress | `tint-lavender` | `bg-violet-50/70` | `bg-violet-50/40 border-violet-100` |
| Done | `tint-mint` | `bg-emerald-50/70` | `bg-emerald-50/40 border-emerald-100` |

### 4.5 Warna prioritas (PRIORITIES di `app/page.js`)

| Prioritas | Kelas chip | Ikon |
|---|---|---|
| High | `text-pink-700 bg-pink-100` | `fa-angles-up` |
| Medium | `text-orange-700 bg-orange-100` | `fa-angle-up` |
| Low | `text-sky-700 bg-sky-100` | `fa-angle-down` |

### 4.6 Warna member (avatar)

Setiap member punya warna sendiri kolom `members.color`
(default `#6366f1`). Avatar = lingkaran penuh warna member + inisial putih.

---

## 5. Elemen Inti

### 5.1 Kartu (Card)

```jsx
// Kartu glass standar (utama)
<div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80
                shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">

// Kartu panel sekunder (solid, tipis)
<div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">

// Kartu pagar (empty state)
<div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50/50">
```

### 5.2 App shell / Sidebar

- Shell: `bg-white/60 border border-white/70 shadow-2xl backdrop-blur-xl lg:rounded-[32px]`, tinggi `h-[calc(100vh-1.5rem)]`.
- Sidebar: `w-72 lg:w-64`, mobile drawer `fixed inset-y-0 z-[80]`, desktop `lg:bg-white/25`.
- Item aktif: `bg-white text-slate-950 shadow-sm font-semibold rounded-2xl`.
- Item nonaktif: `text-slate-600 hover:bg-white/55`.
- Ikon folder dinamis `style={{ color: project.color }}`; proyek pribadi diberi badge `Pribadi` indigo.

### 5.3 Badge / Chip / Pill

```jsx
// Chip status semantik (soft + border)
<span className="px-2 py-0.5 rounded-full text-[10px] font-medium
                 bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">

// Badge "Wajib" (modal paksa)
<span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold
                 px-2 py-0.5 rounded-full border border-emerald-200">

// Indikator unread (dot ping)
<span className="relative flex h-2 w-2 shrink-0">
    <span className="animate-ping absolute inline-flex h-full w-full
                     rounded-full bg-rose-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-xs"></span>
</span>
```

Prioritas & status tiap tugas memakai pasangan `bg-*-100 text-*-700` (lihat 4.4–4.5).

### 5.4 Tombol

```jsx
// Primer (aksi utama, indigo)
<button className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600
                   hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-md transition">

// Primer alt (brand gelap)
<button className="px-4 py-2 text-xs font-semibold bg-slate-950 text-white
                   rounded-xl hover:bg-slate-800 disabled:opacity-40
                   disabled:cursor-not-allowed transition shadow-xs">

// Sukses (konfirmasi / simpan hijau)
<button className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600
                   hover:bg-emerald-700 rounded-xl transition shadow-xs">

// Sekunder / ghost
<button className="px-4 py-2 text-sm font-medium text-slate-600
                   hover:bg-slate-100 rounded-xl transition">

// Outline cancel (dalam modal)
<button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white
                   border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">

// Danger / destroy
<button className="... bg-rose-500 hover:bg-rose-600 text-white rounded-xl ...">

// Tab segmented (pindah view)
<div className="flex items-center bg-white/70 backdrop-blur-sm p-1 rounded-2xl
                border border-slate-200/80 shadow-xs text-xs">
    <button className="px-3 py-1.5 rounded-xl font-medium
                       {active ? 'bg-slate-900 text-white shadow-sm' :
                                 'text-slate-600 hover:text-slate-900'}">
```

Ketentuan umum tombol:
- Radius `rounded-xl` (modal besar `rounded-2xl`, chip/table kecil `rounded-lg`).
- Disabled selalu `disabled:opacity-40/50 disabled:cursor-not-allowed`.
- Menyimpan = loading `fa-spinner fa-spin` + teks "Menyimpan...".
- Spasi padding umum: `px-4/5 py-2/2.5`; mini `px-2/3 py-1/1.5`.

### 5.5 Input / Form

```jsx
// Input teks standar (akses ikon kiri opsional)
<div className="relative">
    <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2
                  text-slate-400 text-sm"></i>
    <input type="email"
        className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl
                   bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                   outline-none transition"
        placeholder="nama@abskdi.biz.id" />
</div>

// Varian focus warna WA (emerald)
className="... focus:ring-emerald-500/20 focus:border-emerald-500 ..."

// Input modal wajib (lebih tegas)
className="w-full text-sm font-semibold text-slate-900 bg-white border border-slate-300
           rounded-xl pl-10 pr-3.5 py-2.5 focus:outline-none focus:ring-2
           focus:ring-emerald-500/20 focus:border-emerald-500 transition
           placeholder:font-normal disabled:bg-slate-50"

// Select
<select className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm
                   text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">

// Inline edit kecil (di dalam tabel)
className="text-xs font-bold px-2 py-1 border border-indigo-300 rounded-lg
           outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
```

Aturan validasi visual: error message `bg-rose-50 border-rose-200 text-rose-700 text-xs rounded-xl`;
sukses `bg-emerald-*`; peringatan `bg-amber-50 border-amber-200 text-amber-900`.
Wajib ditandai bintang merah `<span className="text-rose-500">*</span>`.

### 5.6 Checkbox & Toggle

- Checkbox todo: kotak rounded kecil `rounded`, klik toggle garis coret `line-through text-gray-400`.
- Progress subtask ditampilkan bilah/angka dengan warna `indigo`/`emerald`.
- Toggleswitch memakai pill `rounded-full` dengan knob `w-2 h-2 rounded-full bg-emerald-500 animate-pulse` (status aktif).

### 5.7 Tabel (Task Table)

```jsx
<div className="overflow-x-auto rounded-2xl border border-slate-200/60">
  <table className="w-full text-sm">
    <thead>
      <tr className="bg-white/80 border-b border-slate-100 text-xs font-semibold
                     text-slate-500 uppercase tracking-wider">
        <th className="p-3 font-medium">…</th>
      </tr>
    </thead>
    <tbody>…</tbody>
  </table>
</div>
// Baris grup folder
<tr className="bg-slate-100/90 border-y border-slate-200/80 select-none">
// Badge selesai
<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
```

### 5.8 Kartu Kanban

```jsx
<div className="bg-white/80 p-3.5 rounded-3xl border shadow-sm
                hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-grab
                active:cursor-grabbing group mb-3 backdrop-blur"
     className2={
        Done:        'border-white/60 bg-white/45',
        Overdue:     'border-rose-300 bg-rose-50/25 ring-1 ring-rose-200/50',
        DueToday:    'border-amber-300 bg-amber-50/25 ring-1 ring-amber-200/50',
        Normal:      'border-white/75' }>
```

### 5.9 Modal / Dialog

```jsx
// Overlay (paling umum)
<div className="fixed inset-0 z-50 flex items-center justify-center p-4
                bg-slate-900/40 backdrop-blur-xs animate-fade-in">
  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg
                  relative z-10 overflow-hidden animate-scale-in
                  border border-slate-100 flex flex-col max-h-[92vh] my-auto">

// Modal wajib: z-[100] + header berwarna + TANPA tombol close
<div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
  ...
</div>
```

Hierarki z-index modal: `z-50` normal ke `z-[60..70]` dialog global ke `z-[80]` sidebar drawer ke `z-[100]` modal wajib (WA setup, ganti password paksa).

### 5.10 Notifikasi & Toast

- Dropdown notifikasi: panel `absolute right-0 top-12 w-80 bg-white rounded-3xl shadow-2xl border z-50 animate-fade-in`.
- Kategori severity ke warna: `danger=rose`, `warning=amber`, `sky=sky`, `purple/pink=brand radar`, `indigo=jadwal`.
- Tab kategori: Semua / Belum dibaca / Shared / Deadline / Jadwal / Radar.

### 5.11 Ikon

| Konteks | Ikon (Font Awesome) |
|---|---|
| Navigasi utama | `fa-list`, `fa-table`, `fa-columns`, `fa-calendar` |
| Tambah data | `fa-plus` |
| Proyek pribadi | `fa-id-badge` |
| Proyek biasa | `fa-folder`, `fa-folder-open` |
| Sematkan | `fa-thumbtack` |
| Prioritas | `fa-angles-up`, `fa-angle-up`, `fa-angle-down` |
| Deadline | `fa-triangle-exclamation`, `fa-hourglass-half` |
| WhatsApp | `fa-brands fa-whatsapp` |
| Peringatan | `fa-circle-exclamation` |
| Simpan/loading | `fa-spinner fa-spin` |
| Close modal | `fa-xmark` |
| Pengaturan | `fa-gear` |
| Kolaborasi | `fa-users-viewfinder` |

Anchor mapping lucide (khusus /docs & /chat): `Copy, Check, Terminal, Bell, Clock, Database, Shield, Sparkles, Layers, Zap, Radio, Server`.

---

## 6. Animasi & Motion

### 6.1 Kelas aktif (ter-generate oleh Tailwind)

| Kelas | Efek |
|---|---|
| `animate-ping` | Radar dot unread (2 Layers: ping + solid). dipakai 15×. |
| `animate-pulse` | Dot "live" status. dipakai 7×. |
| `animate-spin` | Spinner loading (`fa-spinner` + CSS). |
| `animate-bounce` | Typing indicator chat AI. |

### 6.2 Kelas kustom TIDAK AKTIF (no-op) ⚠️

| Kelas dipakai di JSX | Status | Faktual |
|---|---|---|
| `animate-fade-in` | 44 pemakaian | Tidak ada di CSS terkompilasi (no-op). |
| `animate-scale-in` | 3 pemakaian | Tidak di-generate (no-op). |
| `animate-fade-in-up` | 2 pemakaian | Tidak di-generate (no-op). |
| `animate-bounce-short` | 1 pemakaian | Tidak di-generate (no-op). |
| `animate-in fade-in zoom-in-95` | 6 pemakaian | Belum terdefinisi (tanpa plugin tw-animate). |

**Rekomendasi**: tambahkan definisi berikut di `app/globals.css` agar seluruh
animasi transisi modal/panel benar-benar berjalan:

```css
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96) translateY(8px); }
                     to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); }
                      to { opacity: 1; transform: translateY(0px); } }
@keyframes bounceShort { 0%,100% { transform: translateY(0); }
                         50% { transform: translateY(-6px); } }

.animate-fade-in    { animation: fadeIn .25s ease-out both; }
.animate-scale-in   { animation: scaleIn .2s ease-out both; }
.animate-fade-in-up { animation: fadeInUp .3s ease-out both; }
.animate-bounce-short { animation: bounceShort .6s ease-in-out infinite; }
```

Atau instal plugin `tw-animate-css` untuk `animate-in fade-in zoom-in-95`.

### 6.3 Transisi hover

Standar: `transition` bawaan Tailwind (duration 150ms, ease default),
tambahan khusus: `transition-colors`, `transition-all` (hover kartu kanban
dengan `-translate-y-0.5`), sidebar `transition-transform duration-300`.

---

## 7. Pola Responsif & Layout

- Mobile-first, breakpoint standar Tailwind: `sm: 640`, `md: 768`, `lg: 1024`.
- Sidebar: drawer overlay di < lg (`fixed inset-y-0 z-[80] -translate-x-full`), statik `lg:w-64` ≥ lg.
- Grid dashboard: `grid grid-cols-1 lg:grid-cols-12 gap-6`: panel utama `lg:col-span-7/8`.
- Shell app: container `max-w-[1720px] mx-auto` dengan padding `lg:p-3`.
- Modal responsif: padding `p-3 sm:p-4`, tinggi maks `max-h-[92vh] my-auto`.
- Scrollbar: `custom-scrollbar` (dipakai di nav; styling opsional, belum ada implementasi CSS khusus global).

---

## 8. Pola Aksesibilitas

- Label selalu `htmlFor`/nested pada input wajib.
- Wajib-text ditandai ikon bintang + `aria-*` pada tombol ikon utama (`aria-label="Pengaturan Sistem"`).
- Perubahan fokus selalu terlihat: `focus:ring-2 focus:ring-{warna}-500/20 focus:border-{warna}-500`.
- Ikon informasional dipasangkan teks (`title="..."` dot unread, `title` tombol header).
- Kontras teks utama: slate-900 di atas putih/pastel (ratio > 7:1).

---

## 9. Do & Don't

| ✔ Lakukan | ✘ Hindari |
|---|---|
| Gunakan `rounded-xl/2xl/3xl` untuk semua kontainer | Sudut tajam / `rounded-none` |
| Pasangan `bg-*-50 text-*-700` untuk chip | Warna pekat penuh pada elemen kecil |
| `text-xs` + icon FA di tombol sekunder | Ukuran font > base di dalam kartu padat |
| Glass `bg-white/70 + backdrop-blur` di area pastel | Latar hitam pekat di dalam app |
| Modal `max-h-[92vh]` + `overflow-y-auto` | Modal lebih tinggi dari viewport |
| Shadow tipis `shadow-sm/xs` | Shadow besar pada elemen inline (kecuali modal) |

---

## 10. Konvensi Penamaan & Struktur Kode

| Path | Isi |
|---|---|
| `app/page.js` | Seluruh dashboard & komponen inline (TaskManagerApp + 30+ sub-komponen). |
| `app/layout.js` | Font globals, metadata, PWA. |
| `app/globals.css` | Tailwind import, tint classes, dark-scheme var. |
| `components/*.jsx` | Fitur besar: MainDashboard, WeeklyScheduleView, ProjectSettingsModal, NotificationCenter, MemberMigrationModal, PWAInstaller, TaskProofSection, SidebarScheduleWidget, TimelineView, MinuteOfMeeting, SettingsModal (chat), TaskEditModal. |
| `lib/*.js` | Helper: useNotifications (notifikasi), morning-dispatch (cron WA), whatsapp (gateway), personal (akses personal), supabase (client schema task_leader). |
| `app/docs/page.js` | Docs internal (WhatsApp & cron), tema dark slate. |
| `app/chat/page.js` | AI chat (lucide icons). |

---

## 11. Checklist Elemen Baru

Saat menambah elemen UI baru, pastikan:

- [ ] Warna konsisten dengan palet 4.3–4.6 (bukan hex arbitrer).
- [ ] Radius sesuai aturan 5.1–5.9.
- [ ] Font size `text-xs`/`text-sm` + weight semibold/bold untuk fungsional.
- [ ] Ikon Font Awesome yang dipakai sudah ada di daftar 5.11.
- [ ] Focus ring ter-definisi (`focus:ring-2 ... focus:border-...`).
- [ ] State disabled dan loading (spinner + label) tersedia untuk aksi async.
- [ ] Responsif mobile: tidak merusak layout drawer (`sm:` grid, `truncate`, `min-w-0`).
- [ ] Animasi pakai kelas 6.1, atau tambah keyframes 6.2 ke globals.css bila butuh.

---

*Dokumen ini dihasilkan dari audit kode aktual aplikasi Busana Leader Dashboard (September 2026). Cocok dipakai sebagai kontrak visual oleh manusia maupun AI agent.*
