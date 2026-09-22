"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Check, 
  Copy, 
  Terminal, 
  Bell, 
  Clock, 
  Smartphone, 
  Database, 
  Shield, 
  BookOpen, 
  Send, 
  Calendar, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  RefreshCw, 
  MessageSquare, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2,
  Code2,
  Server,
  Zap,
  Radio
} from "lucide-react";

export default function WhatsAppDocsPage() {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const copyToClipboard = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sqlMigrationCode = `-- ==============================================================================
-- Migration: Add whatsapp_number column to members table
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Tambahkan kolom whatsapp_number pada tabel task_leader.members jika belum ada
ALTER TABLE task_leader.members 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT NULL;

-- 2. Tambahkan komentar dokumentasi pada kolom
COMMENT ON COLUMN task_leader.members.whatsapp_number IS 'Nomor WhatsApp pengguna (opsional) untuk notifikasi tugas & broadcast rekap pagi 07:00 WIB';

-- 3. Buat index opsional untuk optimasi query anggota ber-WhatsApp
CREATE INDEX IF NOT EXISTS idx_members_whatsapp_number 
ON task_leader.members (whatsapp_number) 
WHERE whatsapp_number IS NOT NULL;

-- 4. Reload schema cache PostgREST agar Supabase API langsung mengenali kolom baru
NOTIFY pgrst, 'reload schema';`;

  const envSampleCode = `# ==============================================================================
# WHATSAPP GATEWAY CONFIGURATION (.env.local)
# ==============================================================================

# Pilih Provider: 'fonnte' (aktif saat ini) atau 'waha' (persiapan masa depan)
WA_PROVIDER=fonnte

# 1. Konfigurasi Fonnte (Aktif Saat Ini)
FONNTE_TOKEN=isi_token_fonnte_anda_di_sini

# 2. Konfigurasi WAHA (WhatsApp HTTP API - Masa Depan / Self-Hosted)
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

  const cronNodeScript = `// ==============================================================================
// Script: Daily WhatsApp Morning Task Dispatcher (Jam 07:00 WITA)
// Mendukung: Fonnte (sekarang) & WAHA (masa depan)
// Format Pesan:
//   1. Task Overdue Saya (Tugas Terlewat)
//   2. Task Hari Ini Saya (Deadline Hari Ini)
//   3. Radar Deadline Bawahan (Overdue & Hari Ini Milik Tim)
// ==============================================================================

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

  const sampleCurl = `curl -X GET "http://localhost:3001/api/tasks?range=today&format=whatsapp&picId=ALL&includeDone=0" \
  -H "Authorization: Bearer 76b0e06d00fbb9bb09b6120a1c1875e1f6611f49076a17e8bddc5366cff0fb78"`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <i className="fa-brands fa-whatsapp text-lg text-slate-950"></i>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                Busana Task Docs
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Internal Docs
                </span>
              </span>
              <p className="text-xs text-slate-400">WhatsApp Notification & 07:00 AM Task Scheduler</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              Rute terisolasi: <code className="text-slate-200">/docs</code>
            </span>
            <Link
              href="/"
              className="text-xs font-medium px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <span>Buka Aplikasi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Hero Section */}
        <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 p-8 sm:p-10 overflow-hidden shadow-2xl">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Fitur Otomatisasi Jadwal & Notifikasi Pesan
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Integrasi WhatsApp (Fonnte & WAHA) & Jadwal Pagi 07:00 WIB
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Dokumentasi teknis arsitektur notifikasi WhatsApp. Sistem dirancang <strong>modular</strong>: 
              menggunakan <strong>Fonnte</strong> untuk operasional saat ini, dan siap beralih ke 
              <strong> WAHA (WhatsApp HTTP API)</strong> di masa depan hanya dengan mengganti satu variabel lingkungan (ENV).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-400 text-xs">Gateway Saat Ini</div>
                <div className="text-emerald-400 font-bold text-base mt-0.5 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Fonnte
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-400 text-xs">Gateway Masa Depan</div>
                <div className="text-sky-400 font-bold text-base mt-0.5 flex items-center gap-1.5">
                  <Server className="w-4 h-4" /> WAHA
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-400 text-xs">Jadwal Broadcast</div>
                <div className="text-amber-400 font-bold text-base mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> 07:00 WIB
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-400 text-xs">Nomor di Profil</div>
                <div className="text-purple-400 font-bold text-base mt-0.5 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" /> Opsional
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          {[
            { id: "overview", label: "Ringkasan Arsitektur", icon: Layers },
            { id: "gateway", label: "Gateway: Fonnte & WAHA", icon: Smartphone },
            { id: "database", label: "Skema Database & SQL", icon: Database },
            { id: "api", label: "Endpoint API Tasks", icon: Terminal },
            { id: "scheduler", label: "Scheduler Pagi 07:00", icon: Clock },
            { id: "preview", label: "Format Pesan WA", icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SECTION 1: OVERVIEW & ARSITEKTUR */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">1. Input Profil Karyawan</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Karyawan dapat memasukkan nomor WhatsApp aktif pada tab <strong>Profil Saya</strong> di Modal Settings. 
                  Field ini bersifat <strong>opsional</strong>. Bila tidak diisi, anggota tetap dapat menggunakan dashboard seperti biasa.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">2. Dual Provider (Fonnte & WAHA)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Adapter modul <code className="text-sky-300">lib/whatsapp.mjs</code> telah disiapkan untuk mendukung Fonnte (cloud) dan WAHA (self-hosted). Pergantian provider dapat dilakukan instan tanpa mengubah kode.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">3. Jadwal Otomatis 07:00 WIB</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scheduler cron dijalankan setiap pagi tepat pukul <strong>07:00 WIB (00:00 UTC)</strong>, 
                  mengambil task yang deadline-nya hari ini, dan mengirimkan pesan rekapitulasi personal via WhatsApp Gateway.
                </p>
              </div>
            </div>

            {/* Workflow Diagram */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Diagram Alur Pengiriman Pesan Harian
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <div className="text-xs font-mono text-emerald-400 font-semibold">07:00 WIB</div>
                  <div className="font-bold text-sm text-white">Cron Trigger</div>
                  <p className="text-[11px] text-slate-400">Trigger harian via Crontab Linux / GitHub Actions / n8n</p>
                </div>
                
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <div className="text-xs font-mono text-purple-400 font-semibold">DB Query</div>
                  <div className="font-bold text-sm text-white">Fetch Anggota</div>
                  <p className="text-[11px] text-slate-400">Ambil daftar PIC aktif yang memiliki nomor WhatsApp</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <div className="text-xs font-mono text-sky-400 font-semibold">API Tasks</div>
                  <div className="font-bold text-sm text-white">Susun Pesan</div>
                  <p className="text-[11px] text-slate-400">Panggil <code className="text-sky-300">/api/tasks</code> dengan format WA per member</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <div className="text-xs font-mono text-emerald-400 font-semibold">Gateway</div>
                  <div className="font-bold text-sm text-white">Fonnte / WAHA</div>
                  <p className="text-[11px] text-slate-400">Pesan mendarat di WhatsApp masing-masing karyawan</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: GATEWAY FONNTE & WAHA */}
        {activeTab === "gateway" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Provider Switch Explanation */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-400" />
                    Cara Berpindah Antara Fonnte & WAHA (Zero Code Changes)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Cukup ubah variabel <code className="text-emerald-300">WA_PROVIDER</code> pada file <code className="text-slate-200">.env.local</code>. Modul adaptor <code className="text-slate-200">lib/whatsapp.mjs</code> akan otomatis menyesuaikan struktur payload, header otentikasi, dan format nomor tujuan.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard("env", envSampleCode)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  {copiedKey === "env" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === "env" ? "Tersalin!" : "Salin ENV"}</span>
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300/90 overflow-x-auto leading-relaxed">
                {envSampleCode}
              </pre>
            </div>

            {/* Provider Cards Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FONNTE CARD */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/30 space-y-4 relative overflow-hidden">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  <Zap className="w-3.5 h-3.5" /> Provider Saat Ini (Cloud Gateway)
                </div>
                <h3 className="text-xl font-bold text-white">Fonnte WhatsApp Gateway</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Layanan WhatsApp gateway berbasis cloud di Indonesia. Sangat praktis untuk tahap awal karena tidak membutuhkan server tambahan.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Endpoint:</span>
                    <code className="text-emerald-400 font-mono">POST https://api.fonnte.com/send</code>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Header Auth:</span>
                    <code className="text-emerald-400 font-mono">Authorization: &lt;FONNTE_TOKEN&gt;</code>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Format Target:</span>
                    <span className="text-slate-200">Nomor lokal / internasional (<code className="text-emerald-300">08xxx</code> / <code className="text-emerald-300">628xxx</code>)</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-bold text-slate-400">Contoh cURL Fonnte:</div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                    {fonnteCurlCode}
                  </pre>
                </div>
              </div>

              {/* WAHA CARD */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-sky-500/30 space-y-4 relative overflow-hidden">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
                  <Server className="w-3.5 h-3.5" /> Provider Masa Depan (Self-Hosted)
                </div>
                <h3 className="text-xl font-bold text-white">WAHA (WhatsApp HTTP API)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Open-source REST API WhatsApp self-hosted via Docker. Menghilangkan biaya langganan bulanan pihak ketiga dan memberikan kontrol penuh atas session.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Endpoint:</span>
                    <code className="text-sky-400 font-mono">POST &lt;WAHA_URL&gt;/api/sendText</code>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Header Auth:</span>
                    <code className="text-sky-400 font-mono">x-api-key: &lt;WAHA_API_KEY&gt;</code>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Format Target:</span>
                    <span className="text-slate-200">Chat ID WhatsApp (<code className="text-sky-300">628xxx@c.us</code>)</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-bold text-slate-400">Perintah Docker Run WAHA:</div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-sky-300 overflow-x-auto">
                    {wahaDockerCommand}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: DATABASE SCHEMA & MIGRATION */}
        {activeTab === "database" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-400" />
                    Skema Kolom: <code className="text-purple-300">task_leader.members.whatsapp_number</code>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    File SQL tersedia di repositori: <code className="text-slate-200">sql/add_whatsapp_number_to_members.sql</code>
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard("sql", sqlMigrationCode)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  {copiedKey === "sql" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === "sql" ? "Tersalin!" : "Salin SQL"}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                  {sqlMigrationCode}
                </pre>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Format Rekomendasi Nomor WhatsApp:
                </div>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  <li>Format Internasional (Indonesia): <code className="text-emerald-400">6281234567890</code></li>
                  <li>Format Standar Lokal: <code className="text-emerald-400">081234567890</code> (akan otomatis dinormalisasi oleh skrip dispatcher ke awalan 62)</li>
                  <li>Dukungan Graceful Fallback: Jika kolom belum dibuat di SQL Editor, sistem aplikasi tetap menyimpan data di sesi lokal tanpa menyebabkan error.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: API ENDPOINTS */}
        {activeTab === "api" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold mb-2">
                    GET /api/tasks
                  </div>
                  <h3 className="text-lg font-bold text-white">Query Tugas dengan Format WhatsApp</h3>
                  <p className="text-xs text-slate-400">
                    Endpoint internal untuk mendapatkan daftar task hari ini dalam bentuk teks terformat rapi untuk WhatsApp.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard("curl", sampleCurl)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  {copiedKey === "curl" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === "curl" ? "Tersalin!" : "Salin cURL"}</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400">Contoh Perintah cURL:</div>
                <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto leading-relaxed">
                  {sampleCurl}
                </pre>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Parameter</th>
                      <th className="p-3">Tipe</th>
                      <th className="p-3">Default</th>
                      <th className="p-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    <tr>
                      <td className="p-3 text-emerald-400">range</td>
                      <td className="p-3 text-slate-400">string</td>
                      <td className="p-3 text-slate-500">today</td>
                      <td className="p-3 font-sans text-slate-300">Rentang tanggal: <code className="text-emerald-400">today</code>, <code className="text-emerald-400">tomorrow</code>, <code className="text-emerald-400">week</code>, <code className="text-emerald-400">overdue</code></td>
                    </tr>
                    <tr>
                      <td className="p-3 text-emerald-400">format</td>
                      <td className="p-3 text-slate-400">string</td>
                      <td className="p-3 text-slate-500">json</td>
                      <td className="p-3 font-sans text-slate-300">Set ke <code className="text-emerald-400">whatsapp</code> atau <code className="text-emerald-400">text</code> untuk output teks WhatsApp siap kirim</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-emerald-400">picId</td>
                      <td className="p-3 text-slate-400">string</td>
                      <td className="p-3 text-slate-500">all</td>
                      <td className="p-3 font-sans text-slate-300">UUID anggota (PIC) untuk memfilter hanya task milik orang tersebut</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-emerald-400">includeDone</td>
                      <td className="p-3 text-slate-400">0 | 1</td>
                      <td className="p-3 text-slate-500">0</td>
                      <td className="p-3 font-sans text-slate-300">Apakah menyertakan task yang sudah berstatus 'Done'</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-emerald-400">division</td>
                      <td className="p-3 text-slate-400">string</td>
                      <td className="p-3 text-slate-500">all</td>
                      <td className="p-3 font-sans text-slate-300">Filter berdasarkan divisi (cth: marcomm, direksi, dll)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: SCHEDULER DISPATCHER */}
        {activeTab === "scheduler" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Skrip Dispatcher Jadwal Pagi (Jam 07:00 WIB)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Skrip Node.js otomatisasi untuk membaca tabel members dan mengirimkan tugas hari ini ke WhatsApp masing-masing via Fonnte atau WAHA.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard("script", cronNodeScript)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  {copiedKey === "script" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === "script" ? "Tersalin!" : "Salin Skrip"}</span>
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300/90 overflow-x-auto leading-relaxed max-h-[500px]">
                {cronNodeScript}
              </pre>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="font-bold text-xs text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    Opsi 1: Vercel Cron (Rekomendasi Produksi)
                  </div>
                  <p className="text-xs text-slate-400">
                    Otomatis aktif via <code className="text-emerald-400">vercel.json</code>. Jadwal <strong>23:00 UTC</strong> = <strong>07:00 WITA</strong>:
                  </p>
                  <code className="block p-2 rounded-lg bg-slate-900 text-emerald-400 text-xs font-mono">
                    schedule: "0 23 * * *"
                  </code>
                  <p className="text-[11px] text-slate-400">
                    Endpoint: <code className="text-slate-300">/api/cron/morning-dispatch</code>. Proteksi via <code className="text-slate-300">CRON_SECRET</code>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-xs text-white flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-sky-400" />
                    Opsi 2: GitHub Actions Workflow
                  </div>
                  <p className="text-xs text-slate-400">
                    Tersedia file <code className="text-sky-300">.github/workflows/morning-dispatch.yml</code>. Bisa dijalankan manual via tab Actions atau otomatis.
                  </p>
                  <code className="block p-2 rounded-lg bg-slate-900 text-sky-300 text-xs font-mono">
                    - cron: '0 23 * * *'
                  </code>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-xs text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    Opsi 3: Linux Systemd / Crontab Lokal
                  </div>
                  <p className="text-xs text-slate-400">
                    Systemd timer lokal <code className="text-amber-300">busana-dispatch.timer</code> setiap 07:00 WITA:
                  </p>
                  <code className="block p-2 rounded-lg bg-slate-900 text-amber-300 text-xs font-mono">
                    node --env-file=.env.local scripts/morning_dispatch.mjs
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: MESSAGE PREVIEW */}
        {activeTab === "preview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Preview Explanation (6 cols) */}
              <div className="lg:col-span-6 space-y-5">
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    Struktur Format Pesan WhatsApp (07:00 WITA)
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Setiap pagi pukul <strong>07:00 WITA</strong>, sistem mengirimkan pesan personalisasi ringkas & to the point:
                  </p>

                  <div className="space-y-3 text-xs text-slate-400">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">👋</span>
                      <div><strong>Sapaan Ramah:</strong> <em>"Selamat pagi [Nama]! Task [Tanggal] yang perlu diperhatikan:"</em></div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                      <div><strong>🔴 1. Task Overdue Saya:</strong> Tugas pribadi yang terlewat (atau <code className="text-emerald-400">✅ Aman</code> jika tidak ada).</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                      <div><strong>🟡 2. Task Hari Ini Saya:</strong> Tugas pribadi deadline hari ini (atau <code className="text-emerald-400">✅ Aman</code> jika tidak ada).</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                      <div><strong>📡 3. Radar Tim / Bawahan:</strong> Khusus Leader untuk memantau tugas bawahan yang Overdue dan Hari Ini.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[10px] shrink-0">🚀</span>
                      <div><strong>Tagline Perusahaan:</strong> <em>"Bersinergi Meraih Kemenangan"</em></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mockup Chat WhatsApp (6 cols) */}
              <div className="lg:col-span-6 flex justify-center">
                <div className="w-full max-w-sm rounded-[32px] bg-slate-900 border-4 border-slate-800 shadow-2xl overflow-hidden">
                  {/* WhatsApp App Bar */}
                  <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 text-white">
                    <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-bold shadow-inner">
                      <i className="fa-solid fa-robot"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">Busana Task Bot</div>
                      <div className="text-[10px] text-emerald-100 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span> Online
                      </div>
                    </div>
                    <i className="fa-solid fa-ellipsis-vertical text-xs opacity-75"></i>
                  </div>

                  {/* Chat Area Background */}
                  <div className="p-4 bg-[#0b141a] space-y-3 min-h-[500px] flex flex-col justify-end">
                    {/* Timestamp Pill */}
                    <div className="text-center">
                      <span className="text-[10px] font-semibold bg-slate-800/80 text-slate-400 px-3 py-1 rounded-md">
                        HARI INI, 07:00 WITA
                      </span>
                    </div>

                    {/* Chat Bubble Incoming */}
                    <div className="bg-[#202c33] text-slate-100 p-3.5 rounded-2xl rounded-tl-xs max-w-[95%] shadow-md text-xs space-y-2 border border-slate-700/50 font-mono">
                      <div className="text-slate-100 text-[11px]">
                        Selamat pagi <strong>*Dodi*</strong>! Task 22 Sep 2026 yang perlu diperhatikan:
                      </div>

                      <div className="text-slate-500 text-[10px]">--------------</div>
                      <div>
                        <div className="font-bold text-rose-400">🔴 *1. Task Overdue Saya*</div>
                        <div className="text-slate-500 text-[10px]">--------------</div>
                        <div className="text-[11px] text-emerald-400">✅ Aman</div>
                      </div>

                      <div className="text-slate-500 text-[10px]">--------------</div>
                      <div>
                        <div className="font-bold text-amber-300">🟡 *2. Task Hari Ini Saya*</div>
                        <div className="text-slate-500 text-[10px]">--------------</div>
                        <div className="text-[11px] text-emerald-400">✅ Aman</div>
                      </div>

                      <div className="text-slate-500 text-[10px]">--------------</div>
                      <div>
                        <div className="font-bold text-sky-300">📡 *3. Radar Tim / Bawahan*</div>
                        <div className="text-slate-500 text-[10px]">--------------</div>
                        <div className="text-[11px] text-slate-300">• Overdue: ✅ Aman</div>
                        <div className="text-[11px] text-amber-300 font-semibold mt-1">🟡 *Hari Ini (2):*</div>
                        <div className="text-[10px] text-slate-300">• [Anne] <strong>*Setting Promo JSM W4*</strong> (To Do)</div>
                        <div className="text-[10px] text-slate-300">• [Heru] <strong>*SUBMIT LAP. TEMUAN BT02*</strong> (To Do)</div>
                      </div>

                      <div className="text-slate-500 text-[10px]">--------------</div>
                      <div className="text-[10px] text-slate-300 italic">
                        _Bersinergi Meraih Kemenangan_ 🚀<br />
                        <span className="text-slate-400 font-medium">_Busana Leader Task_</span>
                      </div>

                      <div className="flex justify-end items-center gap-1 text-[9px] text-slate-400 pt-0.5">
                        <span>07:00</span>
                        <i className="fa-solid fa-check-double text-sky-400"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>
            Busana Leader Dashboard • Dokumentasi Internal Sistem Notifikasi WhatsApp
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Akses langsung via: <code className="text-emerald-400">/docs</code></span>
            <span>•</span>
            <Link href="/" className="text-slate-400 hover:text-white transition">Kembali ke Dashboard</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
