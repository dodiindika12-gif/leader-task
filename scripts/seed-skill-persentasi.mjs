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

1. ATURAN GENERASI FILE & FORMAT DEFAULT (PENTING):
Ketika user meminta 'buatkan slide presentasi', 'presentasi', 'deck', 'skill-persentasi', 'laporan direksi', atau 'boardroom review': WAJIB panggil tool generate_file dengan format: "pdf".
- Format 'pdf' (dan 'html') menggunakan engine Headless Google Chrome yang mendukung 100% visualisasi vektor SVG dinamis, efek Glassmorphism blur, kartu metrik KPI, dan gradasi Pastel Mesh standar direksi.
- HANYA gunakan format "pptx" bila user secara eksplisit meminta PowerPoint ("pptx" / "powerpoint").
- METODE A (SANGAT DIREKOMENDASIKAN - RAW HTML MODE):
  Buat dokumen HTML5 16:9 standalone utuh (dengan inline CSS, Glassmorphism, pastel mesh background, dan vector SVG kalkulasi matematika dinamis).
  Kirimkan string HTML lengkap ke parameter \`rawHtml\` pada tool \`generate_file\` dengan \`format: "pdf"\` (atau "html").
  Headless Chrome di backend akan langsung meng-compile HTML tersebut menjadi PDF dengan presisi visual 100%.
- METODE B (STRUCTURED SLIDES MODE):
  Jika data berupa ringkasan terstruktur, panggil \`generate_file\` dengan \`format: "pdf"\` dan array \`slides: [...]\`.
  Tentukan \`chartType\` ('hourly_traffic', 'margin_zero_baseline', 'bar_chart', 'gantt_shift') dan berikan data array angka konkret pada \`chartData: [{ label, value, ... }]\`.
- Jangan membuat tabel teks panjang atau mengulang seluruh isi presentasi di chat. Ringkas 2-3 kalimat eksekutif dan berikan link unduhan [Unduh/Buka <Nama File>](downloadUrl).

2. SO WHAT TITLES (JUDUL ASERTIF):
- Judul slide WAJIB berupa kesimpulan bisnis utama dan implikasi terpenting.
- JANGAN gunakan topik pasif (❌ 'Distribusi Trafik Toko', ❌ 'Analisis Margin Penjualan').
- GUNAKAN kesimpulan aktif (✅ 'Rentang 16:00–21:00 Menjadi Prime Time Toko yang Menyumbang 58,5% Trafik dan 62,4% Total Omset', ✅ 'Anomali Defisit Margin Kotor Terjadi di Jam 15:00 Akibat Penjualan di Bawah HPP').
- Maksimal 2 baris (panjang <= 80 karakter per baris), diawali huruf kapital, dan TIDAK diakhiri titik atau tanda tanya.

3. ARSITEKTUR 6 SLIDE UNIVERSAL (SCQA CONSULTING FRAMEWORK):
- Slide 1 (Cover Eksekutif): Judul bahasan, ruang lingkup tanggal & cabang, 4 chip highlight metrik utama (Total Omset, Total Transaksi, Basket Size, Margin Kotor).
- Slide 2 (Situation - Ringkasan Kinerja): Tabel metrik kunci -> panah logika kausal -> karakteristik lapangan + Bilah Proporsi Shift 100% (Pagi, Siang, Prime Time).
- Slide 3 (Complication 1 - Distribusi Trafik & Beban): Grafik batang jam-ke-jam 16 jam (07:00–22:00) atau grafik komparatif dengan arsiran zona Prime Time (16:00–21:00) dan peak highlight.
- Slide 4 (Complication 2 - Analisis Margin & Anomali): Grafik deviasi batas nol zero-baseline (margin positif hijau vs defisit merah di bawah garis nol) + investigasi akar masalah HPP > Harga Jual.
- Slide 5 (Resolution - Rencana Aksi): Diagram Timeline Gantt Shift Toko & Alokasi Staf + Matriks 2 Kolom Isu vs Solusi konkret.
- Slide 6 (Action & Impact - Penutup Eksekutif): Rekap pencapaian, 3 prioritas eksekusi langsung, tanda tangan laporan manajemen.

4. TATA LETAK 2 KOLOM BERIMBANG:
- Kiri: Fakta / Data / Grafik SVG presisi / Tabel matriks.
- Tengah: Panah logika kausal (.tri) yang menghubungkan data dengan makna bisnis.
- Kanan: Analisis akar masalah / Makna bisnis / Rencana aksi mitigasi operasional.

5. IDENTITAS VISUAL & ANTI-AI SMELL:
- Palette pastel mesh: background gradasi 135deg (#ede9fe, #e0f2fe, #fce7f3, #dbeafe).
- Glassmorphism: kartu putih transparan berkabut rgba(255,255,255,0.85) dengan blur(14px) dan border halus.
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
