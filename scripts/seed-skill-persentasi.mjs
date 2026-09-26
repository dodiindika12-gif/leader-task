import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(l => {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  });
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'task_leader' } });

const content = `# Skill Persentasi Eksekutif & Boardroom Review Busana

Standar pembuatan slide presentasi eksekutif tingkat direksi (McKinsey / BCG / Bain style) untuk Busana | Beauty Asana:

1. ATURAN GENERASI FILE:
- Ketika user meminta 'buatkan pptx', 'buatkan pdf', 'buatkan html', 'slide deck', atau 'laporan presentasi': WAJIB panggil tool generate_file dengan format 'pdf', 'pptx', atau 'html'.
- Bila user meminta file PDF (misal 'buatkan pdf', 'ekspor ke pdf', 'laporan pdf'), panggil generate_file dengan format: "pdf".
- Bila user meminta PPTX, pakai format: "pptx". Bila meminta HTML presentasi, pakai format: "html".
- Jangan membuat tabel teks panjang atau mengulang seluruh isi presentasi di chat. Ringkas 2-3 kalimat eksekutif dan berikan link unduhan [Unduh/Buka <Nama File>](downloadUrl).

2. SO WHAT TITLES (JUDUL ASERTIF):
- Judul slide WAJIB berupa kesimpulan bisnis utama dan implikasi terpenting.
- JANGAN gunakan topik pasif (❌ 'Distribusi Trafik Toko', ❌ 'Analisis Margin Penjualan').
- GUNAKAN kesimpulan aktif (✅ 'Rentang 16:00–21:00 Menjadi Prime Time Toko yang Menyumbang 58,5% Trafik dan 62,4% Total Omset', ✅ 'Anomali Defisit Margin Kotor Terjadi di Jam 15:00 Akibat Penjualan di Bawah HPP').
- Maksimal 2 baris (panjang <= 80 karakter per baris), diawali huruf kapital, dan TIDAK diakhiri titik atau tanda tanya.

3. STRUKTUR 6 SLIDE BAKU (sesuaikan bila user meminta jumlah slide berbeda):
- Slide 1 (Cover Eksekutif): Judul bahasan, ruang lingkup tanggal & cabang, 4 chip highlight metrik (Total Omset, Total Transaksi, Basket Size, Margin Kotor).
- Slide 2 (Ringkasan Kinerja): Tabel metrik kunci -> panah logika kausal -> karakteristik lapangan + Bilah Proporsi Shift 100% (Pagi, Siang, Prime Time).
- Slide 3 (Distribusi Trafik): Grafik batang jam-ke-jam 16 jam (07:00–22:00) dengan arsiran zona Prime Time (16:00–21:00) dan bintang pada peak hour (17:00).
- Slide 4 (Analisis Margin & Anomali): Grafik deviasi batas nol zero-baseline (margin positif hijau vs defisit merah di bawah garis nol) + investigasi akar masalah HPP > Harga Jual.
- Slide 5 (Rencana Aksi): Diagram Timeline Gantt Shift Toko & Alokasi Staf + Matriks 2 Kolom Isu vs Solusi konkret.
- Slide 6 (Penutup Eksekutif): Rekap pencapaian, 3 prioritas eksekusi langsung, tanda tangan laporan manajemen.

4. TATA LETAK 2 KOLOM BERIMBANG:
- Kiri: Fakta / Data / Grafik SVG presisi / Tabel matriks.
- Tengah: Panah logika kausal (menghubungkan data dengan makna).
- Kanan: Analisis akar masalah / Makna bisnis / Rencana aksi mitigasi operasional.

5. DATA VISUALISASI SVG:
- Selalu tentukan chartType (mis. 'hourly_traffic', 'margin_zero_baseline', 'segmented_bar', 'gantt_shift') dan isi chartData/metrics/table dengan data angka konkret agar grafik SVG ter-render sempurna.

6. ANTI AI-SMELL:
- Angka Rupiah ditulis penuh (misal: Rp 1.952.426.393).
- Hindari kata klise hampa ('sinergi', 'era disrupsi', 'solusi end-to-end', 'dapat dikatakan bahwa').
- Gunakan istilah bisnis riil: omset, HPP, margin kotor, basket size, NoFaktur, SPG/BA, shift.`;

async function main() {
  const { data, error } = await client
    .from('chat_skills')
    .upsert({
      slug: 'skill-persentasi',
      name: 'Skill Persentasi Eksekutif',
      description: 'Standar pembuatan slide presentasi dan laporan boardroom deck (PPTX, PDF, HTML 16:9, So What titles, visual SVG) untuk Busana.',
      content: content.trim(),
      version: 1,
      is_active: true,
      auto_refine: true,
      always_loaded: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'slug' })
    .select();
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  } else {
    console.log('Success:', JSON.stringify(data, null, 2));
  }
}
main();
