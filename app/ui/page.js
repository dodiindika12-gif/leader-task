"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Copy,
    Check,
    Download,
    Info,
    Table2,
    Type,
    ToggleLeft,
    MousePointerClick,
} from "lucide-react";

const MD_URL = "/ui-style-guide.md";

const MD_SNIPPETS = {
    fonts: `| Font | CSS Variable | Kegunaan |
|---|---|---|
| Inter (400-700) | --font-inter | Font utama heading & body |
| Geist Sans | --font-geist-sans | Font default global (@theme) |
| Pacifico | --font-pacifico | Wordmark/logo "Busana" saja |
| Geist Mono | --font-geist-mono | Kode & nilai teknis (docs) |`,
    colors: `tint-lavender  #ede9fe / text #6d28d9 / solid #a78bfa -> #7c3aed
tint-sky       #e0f2fe / text #0369a1 / solid #38bdf8 -> #0284c7
tint-pink      #fce7f3 / text #be185d / solid #f472b6 -> #db2777
tint-peach     #ffedd5 / text #c2410c / solid #fb923c -> #ea580c
tint-mint      #d1fae5 / text #047857 / solid #34d399 -> #059669

Latar dashboard: linear-gradient(135deg,
  #ede9fe 0%, #e0f2fe 35%, #fce7f3 65%, #dbeafe 100%)`,
    button: `// Primer (aksi utama, indigo)
<button className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600
                   hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-md transition">

// Sukses
<button className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600
                   hover:bg-emerald-700 rounded-xl transition shadow-xs">

// Sekunder / ghost
<button className="px-4 py-2 text-sm font-medium text-slate-600
                   hover:bg-slate-100 rounded-xl transition">`,
    input: `<label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
    Nama Lengkap
</label>
<div className="relative">
    <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
    <input type="email"
        className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl
                   bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                   outline-none transition" />
</div>`,
    badge: `// Chip status semantik
<span className="px-2 py-0.5 rounded-full text-[10px] font-medium
                 bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">

// Dot unread dua-layer
<span className="relative flex h-2 w-2 shrink-0">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-xs"></span>
</span>`,
    modal: `<div className="fixed inset-0 z-50 flex items-center justify-center p-4
                bg-slate-900/40 backdrop-blur-xs animate-fade-in">
  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10
                  overflow-hidden animate-scale-in border border-slate-100
                  flex flex-col max-h-[92vh] my-auto">`,
    table: `<thead>
  <tr className="bg-white/80 border-b border-slate-100 text-xs font-semibold
                 text-slate-500 uppercase tracking-wider">
    <th className="p-3 font-medium">Kolom</th>
  </tr>
</thead>
// Baris grup folder: bg-slate-100/90 border-y border-slate-200/80`,
    card: `// Kartu glass standar
<div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80
                shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">

// Kartu kanban (hover lift)
<div className="bg-white/80 p-3.5 rounded-3xl border shadow-sm
                hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-grab">`,
};

const COPY_LABELS = {
    fonts: "Fonts",
    colors: "Warna",
    button: "Tombol",
    input: "Form",
    badge: "Badge",
    modal: "Modal",
    table: "Tabel",
    card: "Kartu",
};

const PRIORITY_DEMO = [
    { label: "High", cls: "text-pink-700 bg-pink-100", icon: "fa-angles-up" },
    { label: "Medium", cls: "text-orange-700 bg-orange-100", icon: "fa-angle-up" },
    { label: "Low", cls: "text-sky-700 bg-sky-100", icon: "fa-angle-down" },
];

const STATUS_DEMO = [
    { label: "To Do", soft: "tint-sky", solid: "tint-sky-solid" },
    { label: "In Progress", soft: "tint-lavender", solid: "tint-lavender-solid" },
    { label: "Done", soft: "tint-mint", solid: "tint-mint-solid" },
];

const TINT_DEMO = [
    { name: "Lavender", soft: "tint-lavender", solid: "tint-lavender-solid" },
    { name: "Sky", soft: "tint-sky", solid: "tint-sky-solid" },
    { name: "Pink", soft: "tint-pink", solid: "tint-pink-solid" },
    { name: "Peach", soft: "tint-peach", solid: "tint-peach-solid" },
    { name: "Mint", soft: "tint-mint", solid: "tint-mint-solid" },
];

const ANIM_ACTIVE = [
    ["animate-ping", "dot unread, radar dua-layer (15 pemakaian)"],
    ["animate-pulse", "indikator status aktif (7 pemakaian)"],
    ["animate-spin", "spinner loading"],
    ["animate-bounce", "typing indicator chat AI"],
];

const ANIM_NOOP = [
    ["animate-fade-in", "44 pemakaian"],
    ["animate-scale-in", "3 pemakaian"],
    ["animate-fade-in-up", "2 pemakaian"],
    ["animate-bounce-short", "1 pemakaian"],
];

const PLAYBOOK = [
    "Warna konsisten dengan palet tint, bukan hex arbitrer",
    "Radius kontainer: xl untuk kontrol, 2xl-3xl untuk panel",
    "text-xs atau text-sm dengan weight semibold untuk teks fungsional",
    "Ikon Font Awesome yang relevan, satu ikon per fungsi",
    "Focus ring eksplisit: focus:ring-2 plus focus:border",
    "Aksi async selalu punya state disabled dan loading",
    "Responsif: truncate, min-w-0, grid sm pada konten padat",
    "Animasi hanya kelas aktif, atau daftarkan keyframes dulu",
];

const DO_LIST = [
    "Chip lembut bg-*-50 text-*-700 dengan border tipis",
    "Glass bg-white/70 dan backdrop-blur di atas latar pastel",
    "Modal max-h-[92vh] dengan scroll di dalam",
    "Shadow xs/sm, cadangkan shadow besar untuk modal",
    "Teks fungsional slate-900/800, meta slate-500/400",
];

const DONT_LIST = [
    "Sudut tajam rounded-none pada kontainer",
    "Warna pekat penuh pada elemen kecil",
    "Latar hitam pekat di dalam aplikasi",
    "Shadow besar untuk semua elemen",
    "Lebih dari satu aksen di satu tempat",
];

const CodeBlock = ({ id, copiedKey, onCopy }) => (
    <div className="relative group">
        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-200/90 overflow-x-auto leading-relaxed whitespace-pre">
            {MD_SNIPPETS[id]}
        </pre>
        <button
            onClick={() => onCopy(id, MD_SNIPPETS[id])}
            className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition ${
                copiedKey === id
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 opacity-100"
                    : "bg-slate-800/90 text-slate-200 border-slate-700 opacity-0 group-hover:opacity-100"
            }`}
        >
            {copiedKey === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copiedKey === id ? "Tersalin" : "Salin"}</span>
        </button>
    </div>
);

const Section = ({ num, title, desc, children, action }) => (
    <section className="p-6 sm:p-8 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center text-sm font-bold shrink-0">
                    {num}
                </span>
                <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">{title}</h2>
                    {desc && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>}
                </div>
            </div>
            {action}
        </div>
        {children}
    </section>
);

export default function UIStyleGuidePage() {
    const [copiedKey, setCopiedKey] = useState(null);
    const [downloaded, setDownloaded] = useState(false);

    const copyToClipboard = (key, text) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleDownloadMd = async () => {
        try {
            const res = await fetch(MD_URL);
            const text = await res.text();
            const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ui-style-guide.md";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 2000);
        } catch (e) {
            window.open(MD_URL, "_blank");
        }
    };

    return (
        <div className="min-h-screen bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] text-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-pink-500 to-rose-400 flex items-center justify-center shadow-sm shadow-pink-500/25 shrink-0">
                            <span className="font-pacifico text-white text-xs leading-none" style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}>B</span>
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900">Panduan UI Busana</div>
                            <p className="text-[11px] text-slate-500 truncate">Referensi elemen antarmuka, rute internal /ui</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleDownloadMd}
                            className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors border ${
                                downloaded
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-950 hover:bg-slate-800 text-white border-slate-950"
                            }`}
                        >
                            {downloaded ? "Terunduh" : "Unduh .md"}
                        </button>
                        <Link
                            href="/"
                            className="hidden sm:inline-flex text-xs font-semibold px-3.5 py-2 rounded-xl bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                            Buka Aplikasi
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
                {/* Pendahuluan */}
                <section className="p-6 sm:p-8 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                        Elemen visual yang dipakai aplikasi Busana
                    </h1>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                        Setiap elemen di halaman ini dirender dengan kelas yang sama seperti aplikasi:
                        font beserta perannya, lima tint warna resmi, tombol, label form, hingga kartu dan modal.
                        Contoh kode bisa disalin langsung, dan seluruh isi halaman tersedia sebagai file Markdown.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-500 pt-1">
                        <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-palette text-pink-600" aria-hidden="true"></i>Tailwind CSS 4, tanpa library komponen</span>
                        <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-font text-sky-600" aria-hidden="true"></i>Inter sebagai font utama</span>
                        <span className="inline-flex items-center gap-1.5"><i className="fa-brands fa-font-awesome text-amber-600" aria-hidden="true"></i>Ikon Font Awesome 6</span>
                        <span className="inline-flex items-center gap-1.5"><i className="fa-regular fa-file-lines text-slate-400" aria-hidden="true"></i>Panduan .md tersedia</span>
                    </div>
                </section>

                {/* 1. Tipografi */}
                <Section num="1" title="Font dan perannya" desc="Empat font dimuat di layout. Pacifico hanya untuk wordmark, sisanya teks fungsional." action={<button onClick={() => copyToClipboard("fonts", MD_SNIPPETS.fonts)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "fonts" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "fonts" ? "Tersalin" : "Salin tabel"}</button>}     >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                            <div className="text-2xl font-bold text-slate-900" style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}>Inter</div>
                            <p className="text-xs text-slate-500">Font utama heading dan body. Kelas <code className="font-mono text-[11px] bg-slate-50 px-1 py-0.5 rounded">.font-inter</code>, weight 400 sampai 700.</p>
                        </div>
                        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                            <div className="text-2xl text-slate-800" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>Geist Sans</div>
                            <p className="text-xs text-slate-500">Font default global lewat <code className="font-mono text-[11px] bg-slate-50 px-1 py-0.5 rounded">--font-sans</code>.</p>
                        </div>
                        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                            <div className="text-2xl text-pink-600" style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}>Busana</div>
                            <p className="text-xs text-slate-500">Pacifico, khusus wordmark. Tidak dipakai untuk teks fungsional.</p>
                        </div>
                        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                            <div className="text-xl text-slate-700 font-mono" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>Geist Mono 0O1l</div>
                            <p className="text-xs text-slate-500">Kode, SQL, dan nilai teknis di halaman dokumentasi.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div className="space-y-2.5">
                            {[
                                ["text-xs semibold", "label form, body padat (paling sering)"],
                                ["text-sm medium/semibold", "body, item nav, tombol besar"],
                                ["text-base sampai lg bold", "judul kartu dan panel"],
                                ["text-[11px] ke [9px]", "timestamp, badge, meta mikro"],
                            ].map(([k, v]) => (
                                <div key={k} className="flex items-baseline justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                                    <code className="text-[11px] font-mono text-pink-700 shrink-0">{k}</code>
                                    <span className="text-xs text-slate-500 text-right">{v}</span>
                                </div>
                            ))}
                        </div>
                        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
                                <div className="h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center px-3 text-sm text-slate-400">Format standar label</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-900 mb-1">Password Baru <span className="text-rose-500">*</span></label>
                                <div className="h-9 rounded-xl border border-slate-300 flex items-center px-3 text-sm font-semibold text-slate-900">Varian wajib, tanpa uppercase</div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* 2. Warna */}
                <Section num="2" title="Lima tint resmi dan semantiknya" desc="Tint terdaftar di globals.css sebagai kelas, dipakai untuk chip, header kolom kanban, dan zona drop." action={<button onClick={() => copyToClipboard("colors", MD_SNIPPETS.colors)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "colors" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "colors" ? "Tersalin" : "Salin daftar"}</button>}>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {TINT_DEMO.map((t) => (
                            <div key={t.name} className="space-y-2">
                                <div className={`p-4 rounded-xl ${t.soft} text-center`}>
                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold ${t.solid}`}>{t.name}</span>
                                </div>
                                <div className={`p-2.5 rounded-xl ${t.solid} text-center text-[10px] font-bold`}>solid</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                        <div className="space-y-3">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Warna status kanban</div>
                            <div className="space-y-2">
                                {STATUS_DEMO.map((s) => (
                                    <div key={s.label} className={`flex items-center justify-between p-2.5 rounded-xl ${s.soft}`}>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.solid}`}>{s.label}</span>
                                        <code className="text-[10px] font-mono text-slate-600">{s.solid}</code>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Warna prioritas task</div>
                            <div className="space-y-2">
                                {PRIORITY_DEMO.map((p) => (
                                    <div key={p.label} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold ${p.cls}`}>
                                            <i className={`fa-solid ${p.icon} text-[10px]`} aria-hidden="true"></i>
                                            {p.label}
                                        </span>
                                        <code className="text-[10px] font-mono text-slate-500">{p.cls}</code>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Feedback memakai semantik yang sama: rose untuk overdue, amber untuk deadline hari ini, emerald untuk selesai, indigo untuk aksi.
                            </p>
                        </div>
                    </div>
                </Section>

                {/* 3. Tombol */}
                <Section num="3" title="Tombol" desc="Enam varian. Klik tombol contoh untuk menyalin kelasnya ke clipboard." action={<button onClick={() => copyToClipboard("button", MD_SNIPPETS.button)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "button" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "button" ? "Tersalin" : "Salin kelas"}
                </button>}>
                    <div className="p-5 rounded-xl bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] flex flex-wrap items-center gap-3">
                        {[
                            ["Primer indigo", "px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition", "text-white bg-indigo-600"],
                            ["Primer gelap", "px-4 py-2 text-xs font-semibold bg-slate-950 text-white rounded-xl hover:bg-slate-800 transition shadow-xs", "bg-slate-950 text-white"],
                            ["Simpan (sukses)", "px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs", "text-white bg-emerald-600"],
                            ["Sekunder", "px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white/70 rounded-xl transition bg-white/50", "text-slate-600 bg-white/50"],
                            ["Batal (outline)", "px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors", "text-slate-700 bg-white border-slate-200"],
                            ["Hapus (danger)", "px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition shadow-xs", "text-white bg-rose-500"],
                            ["Disabled", "px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl opacity-50 cursor-not-allowed", "opacity-50 cursor-not-allowed (tambahkan pada tombol mana pun)"],
                        ].map(([label, cls, copiedCls]) => (
                            <button
                                key={label}
                                onClick={() => copyToClipboard(`demo-${label}`, copiedCls)}
                                title="Klik untuk menyalin kelas tombol ini"
                                className={`${cls} ${copiedKey === `demo-${label}` ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
                            >
                                {copiedKey === `demo-${label}` ? "Kelas tersalin" : label}
                            </button>
                        ))}
                        <span className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl inline-flex items-center gap-1.5" aria-label="Contoh tampilan loading">
                            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                            Menyimpan
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center bg-white/90 p-1 rounded-xl border border-slate-200 shadow-xs text-xs">
                            {["Table", "Board", "Timeline", "Calendar"].map((v, i) => (
                                <button
                                    key={v}
                                    onClick={() => copyToClipboard(`tab-${v}`, `// item tab aktif: bg-slate-900 text-white shadow-sm; nonaktif: text-slate-600 hover:text-slate-900`)}
                                    title="Klik untuk menyalin kelas tab"
                                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${copiedKey === `tab-${v}` ? "bg-emerald-500 text-white shadow-sm" : i === 0 ? "bg-slate-900 text-white shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                        <span className="text-[11px] text-slate-400">Tab segmented untuk pindah view, klik contoh menyalin kelasnya.</span>
                    </div>
                    <CodeBlock id="button" copiedKey={copiedKey} onCopy={copyToClipboard} />
                </Section>

                {/* 4. Form */}
                <Section num="4" title="Form: input, select, dan umpan balik" desc="Satu pola input di seluruh aplikasi: border slate-200, rounded-xl, focus ring tint sesuai konteks." action={<button onClick={() => copyToClipboard("input", MD_SNIPPETS.input)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "input" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "input" ? "Tersalin" : "Salin kelas"}</button>}>
                    <div className="p-5 rounded-xl bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Email</label>
                            <div className="relative">
                                <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
                                <input type="email" defaultValue="nama@abskdi.biz.id" className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition" />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">Placeholder di kode asli memakai domain perusahaan.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nomor WhatsApp</label>
                            <div className="relative">
                                <i className="fa-brands fa-whatsapp absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500 text-base" aria-hidden="true"></i>
                                <input type="tel" placeholder="08123456789" className="w-full text-sm pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">Fokus konteks WA memakai tint emerald.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Divisi</label>
                            <select className="bg-white px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full">
                                <option>Pilih divisi</option>
                                <option>Marcomm</option>
                                <option>Direksi</option>
                            </select>
                        </div>
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2.5 text-sm text-slate-700 bg-white rounded-xl px-3 py-2.5 border border-slate-200">
                                <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-indigo-600" />
                                <span>Checklist todo, selesai ditandai coret</span>
                            </div>
                            <div className="rounded-xl px-3 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                                <i className="fa-solid fa-circle-exclamation mt-0.5" aria-hidden="true"></i>
                                <span>Pesan error: bg-rose-50, border-rose-200, teks rose-700.</span>
                            </div>
                            <div className="rounded-xl px-3 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-start gap-2">
                                <i className="fa-solid fa-circle-check mt-0.5" aria-hidden="true"></i>
                                <span>Pesan sukses memakai pola yang sama.</span>
                            </div>
                        </div>
                    </div>
                    <CodeBlock id="input" copiedKey={copiedKey} onCopy={copyToClipboard} />
                </Section>

                {/* 5. Badges */}
                <Section num="5" title="Badge, chip, dan indikator" desc="Chip lembut untuk status; dot dua-layer hanya untuk status baca yang betul-betul ada." action={<button onClick={() => copyToClipboard("badge", MD_SNIPPETS.badge)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "badge" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "badge" ? "Tersalin" : "Salin kelas"}</button>}>
                    <div className="p-5 rounded-xl bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] flex flex-wrap items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">Chip sukses</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60 shadow-xs">Chip bahaya</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/60 shadow-xs">Chip peringatan</span>
                        <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-2 py-0.5 rounded-full border border-pink-200">Wajib</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200/70">Pribadi</span>
                        <span className="relative flex h-2 w-2 shrink-0" title="Contoh dot unread">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-xs"></span>
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Contoh indikator aktif"></span>
                        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">DP</div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">AB</div>
                        <span className="text-[11px] text-slate-400">Avatar bulat pakai warna members.color plus inisial.</span>
                    </div>
                    <CodeBlock id="badge" copiedKey={copiedKey} onCopy={copyToClipboard} />
                </Section>

                {/* 6. Kartu & Tabel */}
                <Section num="6" title="Kartu, kanban, dan tabel" desc="Tiga jenis kartu: glass utama, panel sekunder, empty state bertepis putus-putus." action={<button onClick={() => copyToClipboard("card", MD_SNIPPETS.card)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "card" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "card" ? "Tersalin" : "Salin kelas"}</button>}>
                    <div className="p-5 rounded-xl bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Glass utama</div>
                            <div className="text-sm font-bold text-slate-800">bg-white/80 backdrop-blur-md</div>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Dipakai untuk panel besar di dashboard.</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Panel sekunder</div>
                            <div className="text-sm font-bold text-slate-800">bg-slate-50/70</div>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Konten di dalam form dan ringkasan.</p>
                        </div>
                        <div className="border border-dashed border-slate-200 rounded-2xl p-5 text-center bg-white/40 flex flex-col items-center justify-center gap-1">
                            <i className="fa-regular fa-folder-open text-slate-400" aria-hidden="true"></i>
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Empty state</div>
                            <p className="text-[11px] text-slate-400">border-dashed, selalu berisi keterangan.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/75 shadow-xs text-xs space-y-1.5">
                            <div className="font-semibold text-slate-800">Normal</div>
                            <span className="tint-sky inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold">To Do</span>
                        </div>
                        <div className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50/60 shadow-xs ring-1 ring-amber-200/50 text-xs space-y-1.5">
                            <div className="font-semibold text-amber-900">Deadline hari ini</div>
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Hari ini</span>
                        </div>
                        <div className="p-3.5 rounded-2xl border border-rose-300 bg-rose-50/60 shadow-xs ring-1 ring-rose-200/50 text-xs space-y-1.5">
                            <div className="font-semibold text-rose-900">Overdue</div>
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">Terlambat</span>
                        </div>
                        <div className="bg-white/40 p-3.5 rounded-2xl border border-white/10 text-xs space-y-1.5">
                            <div className="font-semibold text-slate-400 line-through">Selesai</div>
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Done</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm bg-white">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="p-3 font-medium text-left">Tugas</th>
                                    <th className="p-3 font-medium text-left">PIC</th>
                                    <th className="p-3 font-medium w-28 text-left">Status</th>
                                    <th className="p-3 font-medium w-28 text-left">Prioritas</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-slate-100/90 border-y border-slate-200/80 select-none">
                                    <td colSpan="4" className="px-4 py-2 text-xs font-bold text-slate-600">
                                        <i className="fa-solid fa-folder text-indigo-500 mr-2" aria-hidden="true"></i>General
                                    </td>
                                </tr>
                                <tr className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                                    <td className="p-3 font-semibold text-slate-800">Evaluasi strategi operasional</td>
                                    <td className="p-3"><span className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold">DP</span>Dodi</span></td>
                                    <td className="p-3"><span className="tint-lavender inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold">In Progress</span></td>
                                    <td className="p-3"><span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-pink-700 bg-pink-100 inline-flex items-center gap-1"><i className="fa-solid fa-angles-up text-[9px]" aria-hidden="true"></i>High</span></td>
                                </tr>
                                <tr className="hover:bg-slate-50 text-xs">
                                    <td className="p-3 font-semibold text-slate-800">Siapkan perlengkapan harian</td>
                                    <td className="p-3 text-slate-400">(belum ada PIC)</td>
                                    <td className="p-3"><span className="tint-sky inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold">To Do</span></td>
                                    <td className="p-3"><span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-sky-700 bg-sky-100 inline-flex items-center gap-1"><i className="fa-solid fa-angle-down text-[9px]" aria-hidden="true"></i>Low</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => copyToClipboard("table", MD_SNIPPETS.table)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "table" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "table" ? "Tersalin kelas tabel" : "Salin kelas tabel"}</button>
                    </div>
                </Section>

                {/* 7. Modal */}
                <Section num="7" title="Modal dan dialog" desc="Modal standar bisa ditutup dari backdrop. Modal wajib (nomor WA, ganti password) tidak punya jalan keluar sebelum diisi." action={<button onClick={() => copyToClipboard("modal", MD_SNIPPETS.modal)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-1.5">{copiedKey === "modal" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedKey === "modal" ? "Tersalin" : "Salin kelas"}</button>}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 text-xs">
                            <div className="font-bold text-slate-900">Modal standar (z-50)</div>
                            <p className="text-slate-500 leading-relaxed">Overlay <code className="font-mono text-[11px] bg-slate-50 px-1 rounded">bg-slate-900/40</code>, kartu rounded-3xl, tombol close tersedia, klik backdrop menutup.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-pink-200 space-y-1.5 text-xs">
                            <div className="font-bold text-slate-900">Modal wajib (z-100)</div>
                            <p className="text-slate-500 leading-relaxed">Header berwarna dengan badge Wajib, tanpa tombol close, backdrop tidak menutup. Contoh: pengisian nomor WA sebelum lanjut.</p>
                        </div>
                    </div>
                    <CodeBlock id="modal" copiedKey={copiedKey} onCopy={copyToClipboard} />
                </Section>

                {/* 8. Animasi */}
                <Section num="8" title="Animasi" desc="Audit CSS terkompilasi menunjukkan sebagian kelas animasi di JSX belum punya definisi. Ini penting diketahui sebelum memakai kelasnya." >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/60 space-y-2.5 text-xs">
                            <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" /> Aktif di CSS terkompilasi
                            </div>
                            {ANIM_ACTIVE.map(([k, v]) => (
                                <div key={k} className="flex items-baseline justify-between gap-3">
                                    <code className="font-mono text-emerald-700">{k}</code>
                                    <span className="text-slate-500 text-right">{v}</span>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-2.5 text-xs">
                            <div className="font-bold text-amber-800 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" /> Dipakai di JSX, belum terdefinisi
                            </div>
                            {ANIM_NOOP.map(([k, v]) => (
                                <div key={k} className="flex items-baseline justify-between gap-3">
                                    <code className="font-mono text-amber-700">{k}</code>
                                    <span className="text-slate-500 text-right">{v}</span>
                                </div>
                            ))}
                            <p className="text-slate-500 leading-relaxed pt-1.5 border-t border-amber-200/60">
                                Definisi keyframes yang disarankan ada di file Markdown. Dot ping hanya untuk status baca yang nyata.
                            </p>
                        </div>
                    </div>
                </Section>

                {/* 9. Aturan */}
                <Section num="9" title="Aturan singkat" desc="Ringkasan untuk menjaga konsistensi saat menambah elemen baru.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                        <div className="space-y-2.5">
                            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Lakukan</div>
                            <ul className="space-y-2">
                                {DO_LIST.map((item) => (
                                    <li key={item} className="flex items-start gap-2.5 text-xs text-slate-600">
                                        <i className="fa-solid fa-check text-emerald-500 mt-0.5" aria-hidden="true"></i>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="space-y-2.5">
                            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Hindari</div>
                            <ul className="space-y-2">
                                {DONT_LIST.map((item) => (
                                    <li key={item} className="flex items-start gap-2.5 text-xs text-slate-600">
                                        <i className="fa-solid fa-xmark text-rose-500 mt-0.5" aria-hidden="true"></i>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
                        <div className="text-sm font-bold text-slate-900">Checklist elemen baru</div>
                        <ol className="space-y-2">
                            {PLAYBOOK.map((item, i) => (
                                <li key={item} className="flex items-start gap-3 text-xs text-slate-600">
                                    <span className="w-5 h-5 rounded-lg bg-pink-50 text-pink-700 border border-pink-100 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                                    <span className="pt-0.5">{item}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-center sm:text-left">
                            <div className="text-sm font-bold text-slate-900">Unduh panduan lengkap</div>
                            <code className="text-[11px] font-mono text-slate-500">{MD_URL}</code>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={handleDownloadMd} className="px-4 py-2 text-xs font-bold text-white bg-slate-950 hover:bg-slate-800 rounded-xl transition-colors inline-flex items-center gap-2">
                                <Download className="w-3.5 h-3.5" />
                                {downloaded ? "Terunduh" : "Unduh Markdown"}
                            </button>
                            <button
                                onClick={() => copyToClipboard("mdurl", typeof window !== "undefined" ? window.location.origin + MD_URL : MD_URL)}
                                className={`px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-colors border ${copiedKey === "mdurl" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                            >
                                {copiedKey === "mdurl" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedKey === "mdurl" ? "URL tersalin" : "Salin URL"}
                            </button>
                        </div>
                    </div>
                </Section>
            </main>

            <footer className="pt-2 pb-6">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>Busana Leader Dashboard, panduan internal antarmuka</span>
                    <div className="flex items-center gap-3">
                        <code className="font-mono text-slate-400">/ui</code>
                        <span aria-hidden="true">•</span>
                        <code className="font-mono text-slate-400">/docs</code>
                        <span aria-hidden="true">•</span>
                        <Link href="/" className="font-semibold text-slate-700 hover:text-slate-900 transition-colors">Kembali ke Dashboard</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
