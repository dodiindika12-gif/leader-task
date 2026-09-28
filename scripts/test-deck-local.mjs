import { generateAgentFile } from '../lib/file-generator.js';
import fs from 'fs';
import path from 'path';

async function runTests() {
    console.log('=== MEMULAI TEST GENERASI FILE PRESENTASI LOKAL ===\n');

    // TEST 1: Mode A (rawHtml) -> PDF
    console.log('1. Menguji Mode A (rawHtml) -> PDF via Chrome Headless...');
    const sampleHtml = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  @page { size: 338.67mm 190.5mm; margin: 0; }
  body {
    margin: 0; padding: 0; font-family: sans-serif;
    background: linear-gradient(135deg, #ede9fe 0%, #e0f2fe 35%, #fce7f3 65%, #dbeafe 100%);
    -webkit-print-color-adjust: exact;
  }
  .s {
    width: 338.67mm; height: 190.5mm; box-sizing: border-box; padding: 12mm;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .card {
    background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 20px; padding: 8mm;
    box-shadow: 0 10px 30px rgba(100, 116, 139, 0.08);
  }
  h1 { font-size: 22pt; color: #0f172a; margin: 0 0 4mm 0; }
  p { font-size: 11pt; color: #475569; line-height: 1.5; margin: 0; }
</style>
</head>
<body>
  <div class="s">
    <div class="card">
      <h1>Uji Coba Deck Raw HTML Mode: Efisiensi Toko Capai 104,2%</h1>
      <p>Ini adalah pengujian lokal generasi file PDF eksekutif langsung dari kode HTML raw dengan Glassmorphism dan presisi rasio 16:9 widescreen.</p>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:9pt; color:#64748b;">
      <span>Bebie AI Local Verification</span>
      <span>Confidential • Boardroom Review</span>
    </div>
  </div>
</body>
</html>`;

    try {
        const resA = await generateAgentFile({
            format: 'pdf',
            fileName: 'test-mode-a-rawhtml',
            title: 'Uji Coba Raw HTML Mode',
            rawHtml: sampleHtml,
        });
        console.log('✅ Mode A Sukses:', resA.fileName, `(${Math.round(resA.size / 1024)} KB)`);
        console.log('   File path:', resA.relativePath);
    } catch (err) {
        console.error('❌ Mode A Gagal:', err);
    }

    // TEST 2: Mode B (Structured slides dengan dynamic bar_chart) -> PDF
    console.log('\n2. Menguji Mode B (Structured Slides) dengan dynamic bar_chart -> PDF...');
    try {
        const resB = await generateAgentFile({
            format: 'pdf',
            fileName: 'test-mode-b-slides',
            title: 'Evaluasi Penjualan Kategori Produk Q3',
            slides: [
                {
                    title: 'Capaian Omset Kategori Skincare Menyumbang 64% Total Pendapatan Kuartal Ini',
                    subtitle: 'Periode Juli - September 2026 • Seluruh Jaringan Outlet ABS Group',
                    category: 'EXECUTIVE SUMMARY',
                    layout: 'cover',
                    metrics: [
                        { label: 'Total Omset Skincare', value: 'Rp 4.280.000.000', sub: '+18,4% YoY', tint: 'tint-mint' },
                        { label: 'Bodycare & Fragrance', value: 'Rp 1.450.000.000', sub: 'Target 92%', tint: 'tint-sky' },
                        { label: 'Basket Size Rata-rata', value: 'Rp 485.000', sub: 'Stabil', tint: 'tint-lavender' },
                        { label: 'Margin Kotor Konsolidasi', value: '24,6%', sub: 'Target min 22%', tint: 'tint-pink' },
                    ],
                },
                {
                    title: 'Kategori Serum & Sunscreen Mendominasi Penjualan dengan Kontribusi Terbesar',
                    subtitle: 'Volume unit terjual per lini produk utama',
                    category: 'ANALISIS KATEGORI',
                    layout: 'split',
                    chartType: 'bar_chart',
                    chartTitle: 'Unit Terjual Berdasarkan Kategori Produk (Ribu Unit)',
                    chartBadge: 'Top 5 Kategori',
                    chartFootnote: 'Data transaksi POS kasir terverifikasi',
                    chartData: [
                        { label: 'Sunscreen', value: 48, highlight: true },
                        { label: 'Serum', value: 42, highlight: true },
                        { label: 'Toner', value: 29 },
                        { label: 'Moisturizer', value: 25 },
                        { label: 'Cleanser', value: 19 },
                        { label: 'Lipcare', value: 14 },
                    ],
                    bullets: [
                        'Sunscreen & Serum: Menyumbang lebih dari 60% total unit terjual di seluruh gerai.',
                        'Pertumbuhan Kuat: Permintaan produk pelindung UV naik 32% seiring kampanye edukasi cuaca panas.',
                        'Optimasi Stok: Perlu penambahan buffer stock minimal 14 hari di gudang regional.',
                    ],
                },
                {
                    title: 'Margin Produk Unggulan Terjaga Positif di Seluruh Lini Tanpa Ada Anomali HPP',
                    subtitle: 'Perbandingan margin laba kotor terhadap target 20%',
                    category: 'PROFITABILITAS',
                    layout: 'split',
                    chartType: 'margin_zero_baseline',
                    chartTitle: 'Margin Kotor per Lini Produk vs Ambang Batas Nol',
                    chartBadge: 'Semua Lini Sehat',
                    chartFootnote: 'Tidak ditemukan penjualan di bawah HPP',
                    chartData: [
                        { label: 'Sunscreen', margin: 26.5 },
                        { label: 'Serum', margin: 28.2 },
                        { label: 'Toner', margin: 21.0 },
                        { label: 'Moisturizer', margin: 24.5 },
                        { label: 'Cleanser', margin: 18.0 },
                        { label: 'Bundling Promo', margin: -1.5 },
                    ],
                    bullets: [
                        'Margin Kuat: 5 dari 6 kategori berada di atas ambang batas aman 20%.',
                        'Catatan Bundling: Promo paket hemat September tercatat defisit -1.5% akibat diskon ganda.',
                        'Tindakan: Matikan opsi akumulasi voucher pada paket bundling di sistem kasir.',
                    ],
                },
                {
                    title: 'Tiga Inisiatif Utama untuk Mempertahankan Momentum Pertumbuhan Q4',
                    category: 'PENUTUP & REKOMENDASI',
                    layout: 'closing',
                }
            ],
        });
        console.log('✅ Mode B Sukses:', resB.fileName, `(${Math.round(resB.size / 1024)} KB)`);
        console.log('   File path:', resB.relativePath);
    } catch (err) {
        console.error('❌ Mode B Gagal:', err);
    }

    console.log('\n=== PENGUJIAN LOKAL SELESAI ===');
}

runTests();
