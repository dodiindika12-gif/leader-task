"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Check,
    Copy,
    Bell,
    Clock,
    Smartphone,
    Database,
    BookOpen,
    MessageSquare,
    AlertCircle,
    Terminal,
} from "lucide-react";

const sqlMigrationCode = `-- ==============================================================================
-- Migration: Add whatsapp_number column to members table
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Tambahkan kolom whatsapp_number pada tabel task_leader.members jika belum ada
ALTER TABLE task_leader.members 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT NULL;

-- 2. Tambahkan komentar dokumentasi pada kolom
COMMENT ON COLUMN task_leader.members.whatsapp_number IS 'Nomor WhatsApp pengguna untuk notifikasi tugas & broadcast rekap pagi 07:00 WIB';

-- 3. Buat index opsional untuk optimasi query anggota ber-WhatsApp
CREATE INDEX IF NOT EXISTS idx_members_whatsapp_number 
ON task_leader.members (whatsapp_number) 
WHERE whatsapp_number IS NOT NULL;

-- 4. Reload schema cache PostgREST agar Supabase API langsung mengenali kolom baru
NOTIFY pgrst, 'reload schema';`;

const envSampleCode = `# WHATSAPP GATEWAY CONFIGURATION (.env.local)

# Pilih Provider: 'fonnte' (aktif saat ini) atau 'waha' (persiapan masa depan)
WA_PROVIDER=fonnte

# 1. Konfigurasi Fonnte (Aktif Saat Ini)
FONNTE_TOKEN=isi_token_fonnte_anda_di_sini

# 2. Konfigurasi WAHA (WhatsApp HTTP API, self-hosted)
WAHA_BASE_URL=http://localhost:3000
WAHA_API_KEY=isi_api_key_waha_opsional
WAHA_SESSION=default`;

const wahaDockerCommand = `# Jalankan container WAHA (WhatsApp HTTP API) di server:
docker run -d \\
  --name waha \\
  -p 3000:3000 \\
  -v /opt/waha/sessions:/app/.sessions \\
  -e WAHA_API_KEY=rahasia_waha_123 \\
  --restart unless-stopped \\
  devlikeapp/waha`;

const fonnteCurlCode = `curl -X POST "https://api.fonnte.com/send" \\
  -H "Authorization: TOKEN_FONNTE_ANDA" \\
  -H "Content-Type: application/json" \\
  -d '{
"target": "6281234567890",
"message": "Halo! Ini notifikasi tugas dari Busana Dashboard.",
"countryCode": "62"
  }'`;

const wahaCurlCode = `curl -X POST "http://localhost:3000/api/sendText" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: rahasia_waha_123" \\
  -d '{
"session": "default",
"chatId": "6281234567890@c.us",
"text": "Halo! Ini notifikasi tugas dari Busana Dashboard via WAHA."
  }'`;

const cronNodeScript = `// =============================================================================
// Script: Daily WhatsApp Morning Task Dispatcher (Jam 07:00 WITA)
// Mendukung: Fonnte (sekarang) & WAHA (masa depan)
// Format Pesan:
//   1. Task Overdue Saya (Tugas Terlewat)
//   2. Task Hari Ini Saya (Deadline Hari Ini)
//   3. Radar Deadline Bawahan (Overdue & Hari Ini Milik Tim)
//   Catatan: task di workspace pribadi tidak ikut dikirim
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage, normalizePhoneNumber } from "../lib/whatsapp.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const WA_PROVIDER = (process.env.WA_PROVIDER || "fonnte").toLowerCase().trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: "task_leader" }
});

// Jalankan otomatis via Systemd User Timer atau Crontab setiap 07:00 WITA
// node --env-file=.env.local scripts/morning_dispatch.mjs`;

const sampleCurl = `curl -X GET "https://domain-anda/api/tasks?range=today&format=whatsapp&picId=ALL&includeDone=0" \\
  -H "Authorization: Bearer <TASK_API_TOKEN>"`;

const CODE_MAP = {
    env: envSampleCode,
    sql: sqlMigrationCode,
    curl: sampleCurl,
    script: cronNodeScript,
    docker: wahaDockerCommand,
};

const CopyButton = ({ id, label, copied, onCopy }) => (
    <button
        onClick={() => onCopy(id, CODE_MAP[id])}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border ${
            copied === id
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        }`}
    >
        {copied === id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied === id ? "Tersalin" : label}</span>
    </button>
);

const SectionHead = ({ num, title, desc, action }) => (
    <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center text-sm font-bold shrink-0">
                {num}
            </span>
            <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">{title}</h3>
                {desc && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>}
            </div>
        </div>
        {action}
    </div>
);

const CodeBlock = ({ id }) => (
    <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-200/90 overflow-x-auto leading-relaxed whitespace-pre">
        {CODE_MAP[id]}
    </pre>
);

export default function WhatsAppDocsPage() {
    const [copiedKey, setCopiedKey] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");

    const copyToClipboard = (key, text) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };



    const TABS = [
        { id: "overview", label: "Ringkasan Arsitektur" },
        { id: "gateway", label: "Gateway Fonnte & WAHA" },
        { id: "database", label: "Skema Database" },
        { id: "api", label: "Endpoint API" },
        { id: "scheduler", label: "Scheduler 07:00" },
        { id: "preview", label: "Format Pesan WA" },
    ];

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
                            <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                Dokumentasi Notifikasi WhatsApp
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">Busana Leader Dashboard, rute internal /docs</p>
                        </div>
                    </div>
                    <Link
                        href="/"
                        className="shrink-0 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white transition-colors"
                    >
                        Kembali ke Aplikasi
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
                {/* Pendahuluan: langsung ke isi, tanpa badge dekoratif di atas judul */}
                <section className="p-6 sm:p-8 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                        Notifikasi WhatsApp &amp; Rekap Tugas Pagi 07:00
                    </h1>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                        Halaman ini menjelaskan cara kerja sistem kirim rekap tugas harian via WhatsApp:
                        dari mana data diambil, gateway yang dipakai, jadwal pengiriman, sampai format pesan yang diterima karyawan.
                        Semua kode yang dirujuk ada di repositori ini, jadi setiap langkah bisa langsung diverifikasi.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-500 pt-1">
                        <span className="inline-flex items-center gap-1.5"><i className="fa-brands fa-whatsapp text-emerald-600"></i>Gateway aktif: Fonnte</span>
                        <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-clock text-amber-600"></i>Jadwal: 07:00 WITA (23:00 UTC)</span>
                        <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-database text-purple-600"></i>Skema: task_leader</span>
                        <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-shield-halved text-slate-400"></i>Task pribadi tidak dikirim</span>
                    </div>
                </section>

                {/* Tab Nav */}
                <nav className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Bagian dokumentasi">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                aria-current={isActive ? "page" : undefined}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap border ${
                                    isActive
                                        ? "bg-slate-950 text-white border-slate-950"
                                        : "bg-white/80 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {/* SECTION: OVERVIEW */}
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-5">
                            <SectionHead
                                num="1"
                                title="Empat langkah pengiriman, sekali sehari"
                                desc="Alur berjalan otomatis tanpa campur tangan admin setelah konfigurasi awal selesai."
                            />
                            <ol className="space-y-3">
                                {[
                                    {
                                        t: "Cron memicu skrip 07:00 WITA",
                                        d: "Vercel Cron memanggil /api/cron/morning-dispatch dengan header CRON_SECRET. Bisa juga lewat GitHub Actions atau crontab server.",
                                    },
                                    {
                                        t: "Ambil anggota aktif yang punya nomor WA",
                                        d: "Query task_leader.members WHERE is_active = true dan whatsapp_number tidak kosong. Nomor lokal 08xx dinormalisasi menjadi 62xx.",
                                    },
                                    {
                                        t: "Susun pesan per anggota",
                                        d: "lib/morning-dispatch.js menyusun 3 seksi: task overdue, task hari ini, dan radar bawahan untuk leader. Task workspace pribadi dilewati.",
                                    },
                                    {
                                        t: "Kirim via gateway, catat hasil",
                                        d: "lib/whatsapp.js memilih Fonnte atau WAHA dari WA_PROVIDER. Setiap hasil (sukses/gagal) dicatat di log skrip untuk trace.",
                                    },
                                ].map((step, i) => (
                                    <li key={i} className="flex items-start gap-3.5">
                                        <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                            {i + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-slate-900">{step.t}</div>
                                            <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{step.d}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-4">
                            <SectionHead num="2" title="File yang terlibat" desc="Lokasi kode di repositori, tanpa file bayangan." />
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                            <th className="p-3">File</th>
                                            <th className="p-3">Peran</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {[
                                            ["lib/whatsapp.js", "Adapter gateway: sendViaFonnte, sendViaWaha, normalizePhoneNumber (08xx jadi 62xx)."],
                                            ["lib/morning-dispatch.js", "Query anggota & task, susun pesan 3 seksi, eksekusi broadcast berurutan."],
                                            ["app/api/cron/morning-dispatch/route.js", "Endpoint HTTP untuk Vercel Cron, diamankan CRON_SECRET."],
                                            ["scripts/morning_dispatch.mjs", "Runner CLI untuk crontab/systemd di server sendiri."],
                                            ["sql/add_whatsapp_number_to_members.sql", "Migrasi kolom members.whatsapp_number."],
                                        ].map(([f, d]) => (
                                            <tr key={f}>
                                                <td className="p-3 font-mono text-[11px] text-pink-700 whitespace-nowrap">{f}</td>
                                                <td className="p-3 text-slate-600">{d}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}

                {/* SECTION: GATEWAY */}
                {activeTab === "gateway" && (
                    <div className="space-y-6">
                        <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-4">
                            <SectionHead
                                num="1"
                                title="Pindah gateway cukup satu variabel"
                                action={<CopyButton id="env" label="Salin ENV" copied={copiedKey} onCopy={copyToClipboard} />}
                            />
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Sistem membaca <code className="text-pink-700 font-mono text-[11px]">WA_PROVIDER</code> dari .env.local.
                                Nilai <code className="font-mono text-[11px]">fonnte</code> memakai layanan cloud Fonnte (aktif sekarang),
                                nilai <code className="font-mono text-[11px]">waha</code> memakai server WAHA sendiri. Tidak ada kode yang perlu diubah.
                            </p>
                            <CodeBlock id="env" />
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-emerald-200/70 shadow-sm space-y-4">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <h3 className="text-base font-bold text-slate-900">Fonnte (aktif)</h3>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">LAYANAN CLOUD</span>
                                </div>
                                <ul className="text-xs text-slate-600 space-y-1.5">
                                    <li>Endpoint: <code className="font-mono text-[11px]">POST api.fonnte.com/send</code></li>
                                    <li>Auth: header <code className="font-mono text-[11px]">Authorization: token</code></li>
                                    <li>Target: nomor <code className="font-mono text-[11px]">628xxx</code></li>
                                    <li>Biaya: langganan bulanan, tanpa server</li>
                                </ul>
                                <div className="space-y-2 pt-1">
                                    <div className="text-[11px] font-semibold text-slate-500">Contoh cURL</div>
                                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-emerald-200/90 overflow-x-auto whitespace-pre">{fonnteCurlCode}</pre>
                                </div>
                            </section>

                            <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-sky-200/70 shadow-sm space-y-4">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <h3 className="text-base font-bold text-slate-900">WAHA (siap pakai)</h3>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">SELF-HOSTED</span>
                                </div>
                                <ul className="text-xs text-slate-600 space-y-1.5">
                                    <li>Endpoint: <code className="font-mono text-[11px]">POST {'{WAHA_URL}'}/api/sendText</code></li>
                                    <li>Auth: header <code className="font-mono text-[11px]">x-api-key</code></li>
                                    <li>Target: chat ID <code className="font-mono text-[11px]">628xxx@c.us</code></li>
                                    <li>Biaya: tanpa langganan, perlu Docker + server</li>
                                </ul>
                                <div className="space-y-2 pt-1">
                                    <div className="text-[11px] font-semibold text-slate-500">Docker run</div>
                                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-sky-200/90 overflow-x-auto whitespace-pre">{wahaDockerCommand}</pre>
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {/* SECTION: DATABASE */}
                {activeTab === "database" && (
                    <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-4">
                        <SectionHead
                            num="1"
                            title="Kolom whatsapp_number di task_leader.members"
                            desc="File migrasi: sql/add_whatsapp_number_to_members.sql. Jalankan sekali di Supabase SQL Editor."
                            action={<CopyButton id="sql" label="Salin SQL" copied={copiedKey} onCopy={copyToClipboard} />}
                        />
                        <CodeBlock id="sql" />
                        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-2">
                            <div className="text-xs font-bold text-amber-900 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Format nomor yang disarankan
                            </div>
                            <ul className="text-xs text-amber-900/90 space-y-1.5 list-disc list-inside leading-relaxed">
                                <li>Nomor lokal <code className="font-mono">081234567890</code> atau internasional <code className="font-mono">6281234567890</code>, keduanya diterima.</li>
                                <li>Dispatcher otomatis menormalkan 08xx menjadi 62xx sebelum kirim (lib/whatsapp.js: normalizePhoneNumber).</li>
                                <li>Jika kolom belum dibuat, aplikasi tetap berjalan: profil tersimpan tanpa nomor WA, dan modal pengisian nomor muncul lagi di sesi berikutnya.</li>
                            </ul>
                        </div>
                    </section>
                )}

                {/* SECTION: API */}
                {activeTab === "api" && (
                    <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-4">
                        <SectionHead
                            num="1"
                            title="GET /api/tasks untuk output teks WhatsApp"
                            desc="Endpoint internal yang juga dipakai dispatcher. Autentikasi memakai header Authorization: Bearer token dari TASK_API_TOKEN."
                            action={<CopyButton id="curl" label="Salin cURL" copied={copiedKey} onCopy={copyToClipboard} />}
                        />
                        <CodeBlock id="curl" />
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs bg-white">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                        <th className="p-3">Parameter</th>
                                        <th className="p-3">Tipe</th>
                                        <th className="p-3">Default</th>
                                        <th className="p-3">Fungsi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[
                                        ["range", "string", "today", "Rentang tanggal: today, tomorrow, week, atau overdue."],
                                        ["format", "string", "json", "Isi whatsapp untuk teks siap kirim."],
                                        ["picId", "string", "all", "UUID anggota untuk filter task satu orang."],
                                        ["includeDone", "0 | 1", "0", "Sertakan task berstatus Done bila 1."],
                                        ["division", "string", "all", "Filter divisi, contoh marcomm."],
                                    ].map(([p, t, d, f]) => (
                                        <tr key={p}>
                                            <td className="p-3 font-mono text-[11px] text-slate-900 font-semibold">{p}</td>
                                            <td className="p-3 text-slate-500 font-mono text-[11px]">{t}</td>
                                            <td className="p-3 text-slate-500 font-mono text-[11px]">{d}</td>
                                            <td className="p-3 text-slate-600">{f}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* SECTION: SCHEDULER */}
                {activeTab === "scheduler" && (
                    <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-4">
                        <SectionHead
                            num="1"
                            title="Skrip dispatcher dan tiga cara menjalankannya"
                            desc="Semua opsi memanggil logika yang sama di lib/morning-dispatch.js. Pilih satu sesuai tempat deployment."
                            action={<CopyButton id="script" label="Salin skrip" copied={copiedKey} onCopy={copyToClipboard} />}
                        />
                        <div className="max-h-[460px] overflow-y-auto rounded-xl border border-slate-800">
                            <pre className="p-4 bg-slate-950 font-mono text-[11px] text-emerald-200/90 overflow-x-auto leading-relaxed whitespace-pre">
                                {cronNodeScript}
                            </pre>
                        </div>
                        <ol className="space-y-3">
                            <li className="flex items-start gap-3.5">
                                <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900">Vercel Cron (dipakai sekarang)</div>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                        Terdaftar di vercel.json, jadwal <code className="font-mono text-[11px]">0 23 * * *</code> (23:00 UTC = 07:00 WITA),
                                        mengarah ke /api/cron/morning-dispatch. Proteksi via CRON_SECRET.
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3.5">
                                <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900">GitHub Actions</div>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                        Workflow <code className="font-mono text-[11px]">.github/workflows/morning-dispatch.yml</code>, jadwal sama, bisa dijalankan manual dari tab Actions.
                                    </p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3.5">
                                <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900">Crontab / systemd timer di server</div>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                        <code className="font-mono text-[11px]">node --env-file=.env.local scripts/morning_dispatch.mjs</code> setiap 07:00 WITA.
                                    </p>
                                </div>
                            </li>
                        </ol>
                    </section>
                )}

                {/* SECTION: PREVIEW */}
                {activeTab === "preview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <section className="p-6 rounded-2xl bg-white/80 backdrop-blur-md border border-white/80 shadow-sm space-y-4">
                            <SectionHead num="1" title="Struktur pesan yang diterima karyawan" desc="Pesan dikirim sebagai chat personal ke nomor WhatsApp yang terdaftar di profil." />
                            <ul className="space-y-3">
                                {[
                                    ["Sapaan", "Selamat pagi, nama anggota, tanggal hari ini."],
                                    ["Seksi 1: Task Overdue Saya", "Tugas yang melewati deadline, diurutkan dari yang paling lama. Kosong berarti Aman."],
                                    ["Seksi 2: Task Hari Ini Saya", "Deadline hari ini, prioritas tinggi lebih dulu. Kosong berarti Aman."],
                                    ["Seksi 3: Radar Tim / Bawahan", "Hanya untuk leader: rekap task overdue dan hari ini milik bawahan langsung, beserta nama PIC."],
                                    ["Penutup", "Tagline perusahaan: Bersinergi Meraih Kemenangan."],
                                ].map(([t, d], i) => (
                                    <li key={t} className="flex items-start gap-3">
                                        <span className="text-[11px] font-bold text-pink-700 bg-pink-50 border border-pink-100 rounded-lg px-2 py-1 shrink-0 mt-0.5">
                                            {i === 0 ? "Semua" : `Seksi ${i}`}
                                        </span>
                                        <div className="min-w-0 text-xs leading-relaxed">
                                            <div className="font-semibold text-slate-900">{t}</div>
                                            <p className="text-slate-500 mt-0.5">{d}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                                Task di workspace pribadi tidak pernah masuk pesan, milik siapa pun.
                            </p>
                        </section>

                        {/* Mockup chat, dibagi ke teks nyata dari template dispatcher */}
                        <section className="p-6 rounded-2xl bg-white/70 border border-slate-200/80 shadow-sm">
                            <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                                <div className="bg-emerald-700 px-4 py-3 flex items-center gap-3 text-white">
                                    <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center">
                                        <i className="fa-brands fa-whatsapp text-lg" aria-hidden="true"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm">Busana Leader Task</div>
                                        <div className="text-[10px] text-emerald-100">akun gateway resmi perusahaan</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-100 space-y-3">
                                    <div className="text-center">
                                        <span className="text-[10px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg shadow-xs">
                                            HARI INI, 07:00
                                        </span>
                                    </div>
                                    <div className="bg-white text-slate-800 p-3.5 rounded-2xl rounded-tr-sm shadow-xs text-[11px] space-y-2 leading-relaxed">
                                        <p>Selamat pagi <strong>*Dodi*</strong>! Task 22 Sep yang perlu diperhatikan:</p>
                                        <p className="text-slate-400 text-[10px]">--------------</p>
                                        <div>
                                            <p className="font-semibold">*1. Task Overdue Saya*</p>
                                            <p className="text-[10px] text-slate-400">--------------</p>
                                            <p>Aman, tidak ada</p>
                                        </div>
                                        <p className="text-slate-400 text-[10px]">--------------</p>
                                        <div>
                                            <p className="font-semibold">*2. Task Hari Ini Saya*</p>
                                            <p className="text-[10px] text-slate-400">--------------</p>
                                            <p>Aman, tidak ada</p>
                                        </div>
                                        <p className="text-slate-400 text-[10px]">--------------</p>
                                        <div>
                                            <p className="font-semibold">*3. Radar Tim / Bawahan*</p>
                                            <p className="text-[10px] text-slate-400">--------------</p>
                                            <p className="text-[10px]">• Overdue: Aman</p>
                                            <p className="font-semibold mt-1">*Hari Ini (2):*</p>
                                            <p className="text-[10px]">• [Anne] Setting Promo JSM W4</p>
                                            <p className="text-[10px]">• [Heru] SUBMIT LAP. TEMUAN BT02</p>
                                        </div>
                                        <p className="text-slate-400 text-[10px]">--------------</p>
                                        <p className="text-[10px] italic text-slate-500">
                                            _Bersinergi Meraih Kemenangan_
                                            <br />_Busana Leader Task_
                                        </p>
                                        <div className="flex justify-end items-center gap-1 text-[9px] text-slate-400">
                                            <span>07:00</span>
                                            <i className="fa-solid fa-check-double text-sky-500" aria-hidden="true"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 text-center mt-3">
                                Nama dan task pada contoh di atas adalah placeholder untuk menunjukkan posisi konten.
                            </p>
                        </section>
                    </div>
                )}

                {/* Footer */}
                <footer className="pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>Busana Leader Dashboard, dokumentasi internal</span>
                    <div className="flex items-center gap-3">
                        <code className="font-mono text-slate-400">/docs</code>
                        <span aria-hidden="true">•</span>
                        <code className="font-mono text-slate-400">/ui</code>
                        <span aria-hidden="true">•</span>
                        <Link href="/" className="font-semibold text-slate-700 hover:text-slate-900 transition-colors">Kembali ke Dashboard</Link>
                    </div>
                </footer>
            </main>
        </div>
    );
}
