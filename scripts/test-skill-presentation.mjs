import { generateAgentFile } from '../lib/file-generator.js';
import fs from 'fs/promises';

async function run() {
    console.log('--- Testing Presentation Generation (skill-persentasi) ---');

    const samplePayload = {
        title: 'Review Kinerja Penjualan Q1 & Strategi Scaling',
        subtitle: 'Analisis Komparatif Unit Bisnis & Mitigasi Channel Digital',
        date: '26 Maret 2026',
        author: 'Bebie AI Executive Assistant',
        presenterRole: 'Strategic Business Analyst',
        badge: 'Q1 Performance & Strategy',
        slides: [
            {
                slideNumber: 1,
                isCover: true,
                title: 'Review Kinerja Penjualan Q1 & Strategi Scaling',
                subtitle: 'Analisis Komparatif Unit Bisnis & Mitigasi Channel Digital',
                category: 'EXECUTIVE BRIEF',
                soWhat: 'Transformasi Channel Digital Mengangkat Profit Margin Sebesar +24.8% YoY',
                date: '26 Maret 2026',
                author: 'Bebie AI Executive Assistant',
                presenterRole: 'Strategic Business Analyst',
            },
            {
                slideNumber: 2,
                category: 'FINANCIAL HIGHLIGHT',
                title: 'Pertumbuhan Laba Bersih Terdorong Efisiensi Biaya Operasional',
                soWhat: 'Margin Bersih Q1 Melonjak ke 21.4% Berkat Otomasi Fulfillment dan Optimasi Logistik',
                tag: 'PROFITABILITY',
                tagColor: 'tint-pink',
                source: 'Sumber: BigQuery ABS Group • Data Validasi Keuangan Q1',
                metrics: [
                    { label: 'Total Revenue', value: 'Rp 48.2 M', change: '+18.4% YoY', trend: 'up' },
                    { label: 'Operating Margin', value: '28.6%', change: '+3.2% vs target', trend: 'up' },
                    { label: 'Net Profit', value: 'Rp 10.3 M', change: '+24.8% YoY', trend: 'up' },
                    { label: 'CAC Efficiency', value: 'Rp 42.500', change: '-12.0% MoM', trend: 'down' },
                ],
                leftTitle: 'Komposisi Kontribusi Unit Bisnis',
                segments: [
                    { label: 'E-Commerce / Marketplace', pct: 45, color: '#e11d48' },
                    { label: 'Offline Store & Pop-up', pct: 30, color: '#0f172a' },
                    { label: 'Direct to Consumer (D2C)', pct: 25, color: '#8b5cf6' },
                ],
                rightTitle: 'Faktor Pengungkit Utama',
                rootCauses: [
                    {
                        bold: 'Efisiensi Pergudangan Terpusat:',
                        text: 'Konsolidasi 3 hub logistik memangkas waktu kirim 35% dan biaya ekspedisi 14%.',
                    },
                    {
                        bold: 'Penetrasi SKU Premium:',
                        text: 'Peluncuran lini skincare exclusive menyumbang 32% dari kenaikan basket size pelanggan.',
                    },
                ],
            },
            {
                slideNumber: 3,
                category: 'TRAFFIC DYNAMICS',
                title: 'Lonjakan Traffic Prime Time Memerlukan Alokasi Server Dinamis',
                soWhat: 'Traffic Jam 20:00–22:00 Mencapai 3.4x Rata-rata Harian Menimbulkan Kerentanan Latensi',
                tag: 'USER BEHAVIOR',
                tagColor: 'tint-lavender',
                chartType: 'traffic',
                chartData: [
                    { hour: '06', count: 120 },
                    { hour: '08', count: 480 },
                    { hour: '10', count: 850 },
                    { hour: '12', count: 1240 },
                    { hour: '14', count: 980 },
                    { hour: '16', count: 1100 },
                    { hour: '18', count: 1750 },
                    { hour: '20', count: 3200 },
                    { hour: '22', count: 2800 },
                    { hour: '24', count: 900 },
                ],
                leftTitle: 'Distribusi Traffic per Jam (Kunjungan Aktif)',
                rightTitle: 'Implikasi & Tindakan Mitigasi',
                rootCauses: [
                    {
                        bold: 'Beban Checkout Puncak:',
                        text: 'Lonjakan transaksi jam 20:00-22:00 sempat menaikkan payment gateway drop-off sebesar 2.1%.',
                    },
                    {
                        bold: 'Auto-Scaling Pods:',
                        text: 'Pemberlakuan auto-scaling terjadwal 15 menit sebelum flash sale menormalkan respons latency <120ms.',
                    },
                ],
            },
            {
                slideNumber: 4,
                category: 'STRATEGIC ROADMAP',
                title: 'Peta Jalan Implementasi Inisiatif Prioritas Q2 2026',
                soWhat: 'Fase Rollout Omni-Channel Ditargetkan Rampung Minggu ke-3 Mei 2026',
                tag: 'EXECUTION PLAN',
                tagColor: 'tint-mint',
                chartType: 'gantt',
                ganttPhases: [
                    {
                        name: 'Fase 1: Optimasi Backend & Inventory Sync',
                        lead: 'Tech & Ops Team',
                        progress: 85,
                        subtasks: [
                            { name: 'Integrasi API Multi-Warehouse', duration: 'W1 - W3 Apr' },
                            { name: 'UAT Stress Testing Puncak Beban', duration: 'W4 Apr' },
                        ],
                    },
                    {
                        name: 'Fase 2: Omni-Channel Loyalty & App Redesign',
                        lead: 'Product & Growth',
                        progress: 50,
                        subtasks: [
                            { name: 'Penyatuan Point Member Offline-Online', duration: 'W1 - W2 Mei' },
                            { name: 'Soft Launch Bebie Member Club 2.0', duration: 'W3 Mei' },
                        ],
                    },
                ],
                leftTitle: 'Jadwal Kerja & Pencapaian Utama',
                rightTitle: 'Critical Path & Pengawasan Risiko',
                rootCauses: [
                    {
                        bold: 'Ketergantungan Vendor Ekspedisi:',
                        text: 'SLA API pihak ketiga diproteksi dengan fallback multi-courier switch otomatis.',
                    },
                    {
                        bold: 'Kesiapan Tim Store Frontline:',
                        text: 'Modul pelatihan kilat 3 hari untuk 120 personil toko dimulai serentak pekan depan.',
                    },
                ],
            },
            {
                slideNumber: 5,
                category: 'ACTIONABLE RECOMMENDATION',
                title: '3 Keputusan Dewan Direksi yang Diperlukan Hari Ini',
                soWhat: 'Persetujuan Alokasi Capex Rp 2.5 M Diperlukan Guna Mengunci Slot Server & Lisensi',
                tag: 'DECISION MATRIX',
                tagColor: 'tint-peach',
                recommendations: [
                    {
                        title: '1. Capex Cloud Infrastructure Q2',
                        body: 'Setujui alokasi Rp 2.5 M untuk reservasi instance cloud server multi-region demi menjaga SLA 99.98%.',
                        badge: 'URGENT',
                    },
                    {
                        title: '2. Otomasi Dynamic Pricing',
                        body: 'Implementasikan sistem dynamic pricing berbasis margin tier untuk memaksimalkan GMV saat flash sale.',
                        badge: 'STRATEGIC',
                    },
                    {
                        title: '3. Ekspansi Tim Customer Success',
                        body: 'Rekrut 8 spesialis live shopping & chat concierge untuk menyambut campaign festive season.',
                        badge: 'OPERATIONAL',
                    },
                ],
            },
        ],
    };

    console.log('1. Generating HTML Presentation...');
    const htmlRes = await generateAgentFile({ ...samplePayload, format: 'html' });
    console.log(`✓ HTML created: ${htmlRes.fileName} (${(htmlRes.size / 1024).toFixed(1)} KB)`);

    console.log('2. Generating PDF Presentation via Chrome Headless...');
    const pdfRes = await generateAgentFile({ ...samplePayload, format: 'pdf' });
    console.log(`✓ PDF created: ${pdfRes.fileName} (${(pdfRes.size / 1024).toFixed(1)} KB)`);

    console.log('3. Generating PPTX Presentation...');
    const pptxRes = await generateAgentFile({ ...samplePayload, format: 'pptx' });
    console.log(`✓ PPTX created: ${pptxRes.fileName} (${(pptxRes.size / 1024).toFixed(1)} KB)`);

    console.log('\nAll formats generated successfully!');
}

run().catch((err) => {
    console.error('Error during generation:', err);
    process.exit(1);
});
