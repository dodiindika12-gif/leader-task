**Panduan Lengkap GCP BigQuery — ABS Group**  
*Dokumen ini disusun sebagai panduan komprehensif untuk AI Agent baru yang akan menangani data operasional, penjualan, dan inventory ABS Group. Baca dan pahami seluruh isi dokumen ini sebelum menjalankan query apapun.*  
**1. OVERVIEW & ARSITEKTUR DATA**  
**GCP BigQuery adalah SATU-SATUNYA sumber data utama (source of truth)** untuk seluruh kebutuhan analitik ABS Group (penjualan, stok, info outlet, target). HO API hanya digunakan secara eksklusif untuk proses backfill/sync data yang belum masuk ke BigQuery.  
- **Project ID:**gen-lang-client-0006576805  
- **Limitasi Billing:** GCP Project ini TIDAK memiliki billing aktif. Artinya, operasi DML seperti TRUNCATE, DELETE, atau UPDATE akan gagal. Hanya operasi LOAD dan SELECT yang bisa dilakukan.  
**2. DATASET DAN SKEMA TABEL**  
**2.1. Dataset: **Laporan_Penjualan_detail  
Berisi seluruh riwayat transaksi penjualan perusahaan.  
***A. *** *tabel_transactions_v2* *** ✅ (TABEL UTAMA / PRIMER)***  
Ini adalah tabel yang WAJIB digunakan untuk semua query penjualan.  
- **Volume:** 23.5 Juta+ baris  
- **Range Data:** 1 Januari 2025 – 11 September 2026  
- **Skema:**  
| | | |  
|-|-|-|  
| **Field** | **Type** | **Deskripsi** |   
| Cabang | STRING | Kode outlet (contoh: BT01, BDM1, ABS) |   
| NoFaktur | STRING | Nomor invoice (format: XXX-YYMMDDHHMMSSXXX) |   
| Barcode | STRING | Barcode produk (EAN-13, 13 digit) |   
| NamaBarang | STRING | Nama lengkap produk |   
| Pareto | STRING | Klasifikasi kecepatan jual: FM, SM, BM, BB |   
| Qty | INTEGER | Jumlah barang terjual |   
| HPP | FLOAT | ⚠️ Harga Pokok Penjualan PER UNIT (bukan total) |   
| Jumlah | FLOAT | Total omzet penjualan (Harga × Qty) |   
| tanggal_transactions | DATETIME | Tanggal & waktu transaksi (sudah terisi otomatis) |   
   
***B. *** *Tabel_penjualan*  
- Tabel alternatif di mana kolom HPP sudah dikalikan dengan Qty (Total Cost). Gunakan ini jika ingin menghindari kalkulasi manual HPP * Qty, namun range datanya mungkin berbeda dengan tabel utama.  
***C. *** *tabel_transaksi* *** ❌ (DEPRECATED)***  
- **SUDAH DIHAPUS** per 18 Agustus 2026. Jangan pernah mereferensikan tabel ini dalam query apapun.  
**2.2. Dataset: **Master_Data  
Berisi data master inventory dan stok barang.  
***A. *** *tabel_stok_all* *** (1.6 Juta+ baris)***  
- **Skema:**  
| | | |  
|-|-|-|  
| **Field** | **Type** | **Deskripsi** |   
| Branch | STRING | Kode outlet (sama dengan Cabang di tabel sales) |   
| Kategori | STRING | Kategori produk (FACE CARE, BODY CARE, INSTAN FOOD, dll) |   
| SubKategori | STRING | Sub-kategori (FACE SERUM, BODY LOTION, MIE INSTAN, dll) |   
| Departemen | STRING | Departemen (SKIN CARE, MAKEUP, FOOD, dll) |   
| Divisi | STRING | Divisi (BEAUTY, CONSUMER GOODS, MOMS & KIDS) |   
| Hjual | FLOAT64 | Harga jual |   
| Status | STRING | Aktif, Non Aktif, Terhapus, - |   
| QtyBadStock | FLOAT | Stok rusak |   
| QtyAkhir | FLOAT | Stok akhir di toko |   
| QtyGD | FLOAT | Stok di gudang |   
| Pareto | STRING | FM, SM, BM, BB |   
| Nama | STRING | Nama produk |   
| BarcodeAktif | STRING | Barcode pendek (10 digit) |   
| Merek | STRING | Brand / Manufacturer |   
| Kode | INTEGER | Kode produk (INT64) |   
   
- **Aturan Status:** Default query HANYA menampilkan Status = 'Aktif' kecuali user meminta secara spesifik untuk melihat status lain.  
- Distribusi: Aktif (510K), Non Aktif (233K), Terhapus (924K).  
***B. *** *tabel_stok_history* *** (Dibuat 15 Agu 2026)***  
- Berisi snapshot stok harian untuk analisis pergerakan/trend.  
- Kolom tambahan: Tanggal (DATE), Waktu_Sync (TIMESTAMP).  
- Pola data: Setiap produk bisa memiliki 2 baris per outlet (BarcodeAktif="-" dan BarcodeAktif=asli).  
**2.3. Dataset: **Target_Harian  
- **Tabel:**Target_Harian (6,233 baris)  
- **Skema:**  
| | | |  
|-|-|-|  
| **Field** | **Type** | **Deskripsi** |   
| cabang | STRING | Kode outlet (huruf kecil semua!) |   
| tanggal | DATE | Tanggal target |   
| bulan | STRING | Nama bulan dalam Bahasa Indonesia |   
| target_bulanan | INTEGER | Target penjualan bulanan (Rupiah) |   
| jumlah_hari | INTEGER | Jumlah hari dalam bulan tersebut |   
| target_harian | FLOAT | Target harian (target_bulanan / jumlah_hari) |   
   
- **Nama Bulan:** Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus, September, Oktober, November, Desember.  
**2.4. Dataset: **Daftar_Outlet  
- **Tabel:**Daftar_Outlet (31 baris)  
- **Skema:**  
| | | |  
|-|-|-|  
| **Field** | **Type** | **Deskripsi** |   
| Cabang | STRING | Kode outlet |   
| Nama Outlet | STRING | Nama lengkap outlet (ADA SPASI!) |   
| Tipe | STRING | BEAUTY, BEXMART, GUDANG, ONLONE, CERIA |   
| Kota | STRING | Lokasi kota |   
   
- **Distribusi Tipe:** BEAUTY (17), BEXMART (9), GUDANG (2), ONLONE (2), CERIA (1).  
- **Distribusi Kota:** KENDARI (20), BAUBAU (5), ONLINE (2), KOLAKA/MOWILA/RAHA/UNAAHA (1 masing-masing).  
- **Catatan Penting:**  
  - ABS = Head Office / Gudang Kendari (bukan retail).  
  - DCBB = Gudang Baubau (belum aktif).  
  - ONLONE = Typo dari ONLINE (BDM1 & BDM2).  
  - BDM1 = Online Store aktif. BDM2 = Non-aktif (punya master data tapi 0 stok & 0 transaksi).  
**3. ATURAN KRITIS & PITFALLS (WAJIB DIBACA)**  
Bagian ini berisi "jebakan" teknis yang sering menyebabkan error atau data salah. Hafalkan dan terapkan selalu.  
**3.1. 🚨 CRITICAL: HPP Per-Unit Bug (Pitfall #27)**  
Di tabel_transactions_v2, kolom HPP menyimpan nilai **per unit**, bukan total cost. Jika Qty > 1, margin akan terlihat sangat tinggi (salah).  
- **STANDAR FIX WAJIB:** Selalu gunakan SUM(HPP * Qty) untuk menghitung total modal/HPP di SEMUA query.  
- Contoh benar: ROUND(SUM(Jumlah) - SUM(HPP * Qty), 0) as laba_kotor  
- Instruksi user (Agu 2026): "aktifkan ini ke semua user."  
**3.2. ⚠️ Jebakan Agregasi Target Harian (Pitfall #25)**  
Tabel Target_Harian memiliki 1 baris per hari per cabang. Jika Anda melakukan SUM(target_bulanan) langsung, hasilnya akan terlipat ganda sebanyak jumlah hari (misal 30x lebih besar).  
- **SALAH:**SELECT SUM(target_bulanan) FROM Target_Harian WHERE bulan = 'Agustus'  
- **BENAR:**  
SELECT SUM(target_per_cabang) as target_total  
 FROM (  
   SELECT cabang, MAX(target_bulanan) as target_per_cabang  
   FROM `Target_Harian.Target_Harian`  
   WHERE bulan = 'Agustus'  
   GROUP BY cabang  
 )  
   
**3.3. ⚠️ Case Sensitivity saat Merge DataFrame (Pitfall #26)**  
Kolom di Target_Harian menggunakan huruf kecil (cabang), sedangkan di Daftar_Outlet menggunakan huruf besar (Cabang). Pandas akan gagal merge.  
- **Fix:** Selalu alias di SQL: SELECT cabang AS Cabang, ...  
**3.4. ⚠️ Spasi pada Nama Kolom (Pitfall #22)**  
Kolom Nama Outlet di Daftar_Outlet mengandung spasi. Wajib pakai backtick.  
- **BENAR:**SELECT `Nama Outlet` FROM ...  
- **SALAH:**SELECT Nama_Outlet FROM ... atau SELECT Nama Outlet FROM ...  
**3.5. ⚠️ Cross-Dataset JOIN Tidak Bisa Dilakukan (Pitfall #27/28)**  
Anda TIDAK BISA melakukan JOIN langsung antara Laporan_Penjualan_detail dan Master_Data karena beda region dataset di BigQuery. Selain itu, format barcode berbeda (EAN-13 vs 10 digit).  
- **Solusi:** Query masing-masing tabel secara terpisah, lalu gabungkan (merge) menggunakan Python/Pandas. Untuk analisis brand dari data sales, ekstrak kata pertama dari NamaBarang.  
**3.6. ⚠️ Reserved Word di SQL (Pitfall #6)**  
Jangan gunakan kata rows sebagai alias kolom (misal COUNT(*) as rows). BigQuery akan error. Gunakan cnt, jumlah, atau total.  
**3.7. ⚠️ Fungsi Tanggal BigQuery (Pitfall #24)**  
BigQuery TIDAK memiliki fungsi MONTH(), YEAR(), atau DAY().  
- Gunakan: EXTRACT(MONTH FROM tanggal_transactions), EXTRACT(YEAR FROM ...), dst.  
**3.8. ⚠️ Tipe Data Kolom Kode (Pitfall #11)**  
Kolom Kode di tabel_stok_all bertipe INT64. Jika ingin menggunakan fungsi string seperti LEFT() atau SUBSTR(), wajib di-cast dulu: CAST(Kode AS STRING).  
**3.9. ⚠️ Format Response HO API (Pitfall #17)**  
Jika menarik data dari HO API, total records ada di root level: response.json()["total_records"]. JANGAN cari di meta.total. Array datanya ada di response.json()["data"].  
**3.10. ⚠️ Fully Qualified Table Name**  
Selalu gunakan backticks untuk nama tabel lengkap:  
   
 `gen-lang-client-0006576805.Dataset.Table`  
**3.11. ⚠️ NaN di Pandas akibat EXTRACT (Pitfall #34)**  
EXTRACT() mengembalikan nullable INT64 yang dibaca pandas sebagai float dengan NaN.  
- **Fix:** Gunakan CAST(EXTRACT(...) AS INT64) di SQL, atau df.dropna() + .astype(int) di Python.  
**3.12. ⚠️ Excel Serial Date Conversion (Pitfall #31)**  
Saat membaca file Excel master data via openpyxl/pandas, kolom harga (HJual, HNettoK) kadang terbaca sebagai datetime (Excel serial date).  
- **Fix:** Konversi menggunakan epoch Excel: value = (datetime - datetime(1899,12,30)).days.  
**3.13. ⚠️ Disambiguasi Brand vs Outlet Code**  
Jika user menyebut istilah ambigu (misal "G2G", "OMG"), cek apakah itu nama outlet di Daftar_Outlet atau nama brand di tabel_stok_all (kolom Merek/NamaBarang). Jangan asumsi.  
**3.14. ⚠️ Kategori ≠ Pareto**  
Jika user minta analisis "kategori", gunakan kolom Kategori (FACE CARE, BODY CARE, dll) dari tabel_stok_all. JANGAN gunakan Pareto (FM/SM/BB/BM) karena itu klasifikasi kecepatan jual.  
**3.15. ⚠️ Brand Aliases & Pencarian Fuzzy**  
Beberapa brand disingkat di database (misal: MYBLN = MyBling, G&L = Glow & Lovely). Jika pencarian brand menghasilkan 0, coba gunakan LIKE '%keyword%' atau cek referensi alias. Untuk pencarian brand umum, gunakan prefix-match LIKE 'BRAND %' (dengan spasi) agar tidak false positive.  
**4. TEMPLATE QUERY STANDAR**  
Gunakan environment setup ini di setiap script Python:  
import os  
 os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/opt/data/profiles/abs-internal/credentials/gcp-service-account.json'  
 from google.cloud import bigquery  
 client = bigquery.Client()  
   
**4.1. Query Penjualan Standar (Sales by Branch)**  
SELECT   
   Cabang,  
   COUNT(DISTINCT NoFaktur) as traffic,  
   SUM(Qty) as total_qty,  
   ROUND(SUM(Jumlah), 0) as penjualan,  
   ROUND(SUM(HPP * Qty), 0) as total_hpp, -- WAJIB HPP * Qty  
   ROUND(SUM(Jumlah) - SUM(HPP * Qty), 0) as laba_kotor,  
   ROUND(SAFE_DIVIDE(SUM(Jumlah) - SUM(HPP * Qty), SUM(Jumlah)) * 100, 1) as margin_pct  
 FROM `gen-lang-client-0006576805.Laporan_Penjualan_detail.tabel_transactions_v2`  
 WHERE tanggal_transactions >= '2026-08-01' AND tanggal_transactions < '2026-09-01'  
 GROUP BY Cabang  
 ORDER BY penjualan DESC  
   
**4.2. Query Komparatif Multi-Periode (MoM / YoY / Target)**  
Laporan penjualan SELALU menyertakan MoM, YoY, dan Target Achievement.  
WITH sales AS (  
   SELECT   
     CASE   
       WHEN tanggal_transactions >= '2026-08-01' AND tanggal_transactions < '2026-09-01' THEN 'AGUSTUS_2026'  
       WHEN tanggal_transactions >= '2026-07-01' AND tanggal_transactions < '2026-08-01' THEN 'JULI_2026'  
       WHEN tanggal_transactions >= '2025-08-01' AND tanggal_transactions < '2025-09-01' THEN 'AGUSTUS_2025'  
     END as periode,  
     t.Cabang as outlet_code,  
     COUNT(DISTINCT t.NoFaktur) as traffic,  
     SUM(t.Qty) as total_qty,  
     ROUND(SUM(t.Jumlah), 0) as penjualan,  
     ROUND(SUM(t.HPP * t.Qty), 0) as total_hpp,  
     ROUND(SUM(t.Jumlah) - SUM(t.HPP * t.Qty), 0) as laba_kotor  
   FROM `gen-lang-client-0006576805.Laporan_Penjualan_detail.tabel_transactions_v2` t  
   WHERE (t.tanggal_transactions >= '2026-08-01' AND t.tanggal_transactions < '2026-09-01')  
      OR (t.tanggal_transactions >= '2026-07-01' AND t.tanggal_transactions < '2026-08-01')  
      OR (t.tanggal_transactions >= '2025-08-01' AND t.tanggal_transactions < '2025-09-01')  
   GROUP BY periode, t.Cabang  
 ),  
 target_aug AS (  
   SELECT cabang as outlet_code, MAX(target_bulanan) as target_bulanan  
   FROM `gen-lang-client-0006576805.Target_Harian.Target_Harian`  
   WHERE bulan = 'Agustus'  
   GROUP BY cabang  
 )  
 SELECT s.*, t.target_bulanan,  
   ROUND(SAFE_DIVIDE(s.penjualan, t.target_bulanan) * 100, 1) as pencapaian_pct  
 FROM sales s  
 LEFT JOIN target_aug t ON s.outlet_code = t.outlet_code AND s.periode = 'AGUSTUS_2026'  
 ORDER BY s.periode, s.penjualan DESC  
   
**4.3. Query Stok Aktif**  
SELECT Branch, Nama, BarcodeAktif, QtyAkhir, QtyGD, QtyBadStock, Pareto, Merek  
 FROM `gen-lang-client-0006576805.Master_Data.tabel_stok_all`  
 WHERE Status = 'Aktif' AND Branch = 'BT01'  
 LIMIT 100  
   
**4.4. Query Daftar Outlet**  
SELECT Cabang, `Nama Outlet`, Tipe, Kota  
 FROM `gen-lang-client-0006576805.Daftar_Outlet.Daftar_Outlet`  
 ORDER BY Kota, Cabang  
   
**4.5. Analisis SKU Penetration**  
Membandingkan SKU yang terjual vs SKU yang tersedia di master data.  
-- SKU Terjual  
 SELECT COUNT(DISTINCT NamaBarang) as sku_sold  
 FROM `gen-lang-client-0006576805.Laporan_Penjualan_detail.tabel_transactions_v2`  
 WHERE tanggal_transactions >= '2026-07-01' AND Cabang = 'BDM1';  
   
 -- SKU Tersedia  
 SELECT COUNT(DISTINCT Nama) as sku_available  
 FROM `gen-lang-client-0006576805.Master_Data.tabel_stok_all`  
 WHERE Status = 'Aktif' AND Branch = 'BDM1';  
   
**5. KEMAMPUAN ANALISIS LANJUTAN**  
1. **Basket Analysis (Market Basket):** Mencari produk yang sering dibeli bersamaan dalam 1 faktur (self-join via NoFaktur). Filter HPP > 100 untuk mengabaikan plastik/kartu member.  
2. **Time-Based Analysis:** Mengekstrak jam dari NoFaktur (SAFE_CAST(SUBSTR(NoFaktur, 11, 2) AS INT64)) untuk analisis jam sibuk atau late night sale.  
3. **Product Trending:** Membandingkan pertumbuhan qty/sales suatu produk antara periode N hari terakhir vs N hari sebelumnya.  
4. **Data Quality Audit:** Mengecek tanggal kosong (missing dates) dengan membandingkan list tanggal unik di BigQuery vs generate date range di Python.  
5. **Brand Extraction:** Karena tidak bisa JOIN langsung, ekstrak brand dari kata pertama NamaBarang di Python, lalu mapping manual untuk brand multi-kata (MAKE OVER, MAMY POKO, HADA LABO, MY BLING).  
**6. WORKFLOW SINKRONISASI & BACKFILL (HO API → BigQuery)**  
Proses ini HANYA dilakukan jika ada data yang hilang di BigQuery.  
- **API Endpoint:**https://ho-api.absgroup.biz.id/api/v1/sales/export  
- **API Key:**ncalenk001 (Header: {'x-api-key': API_KEY})  
- **Cron Job:** Jalan tiap 30 menit antara jam 07:00–12:00 WITA (Schedule UTC: 0,30 23,0,1,2,3,4 * * *).  
- **ATURAN MUTLAK:** JANGAN sync otomatis. Jika data ditemukan di API, laporkan ke user dan TUNGGU APPROVAL.  
- **Post-Sync:** Setelah sync sukses, LANGSUNG jalankan generate_pencapaian_report.py dan kirim hasilnya.  
- **Timeout:** Tiap tanggal butuh ~40-50 detik. Pecah backfill besar (>15 tanggal) menjadi beberapa bagian agar tidak timeout 600s. Gunakan time.sleep(0.5) antar request.  
- **Deduplikasi:** Gunakan kombinasi (NoFaktur, Barcode) untuk dedup, bukan hanya NoFaktur.  
- **Parsing NoFaktur:** Format XXX-YYMMDDHHMMSSXXX. 3 digit awal = nomor kasir/POS terminal.  
- **Schema Load:** Saat insert JSON, WAJIB define schema eksplisit (terutama Barcode harus STRING, bukan auto-detect INTEGER).  
**7. FORMAT OUTPUT & PREFERENSI USER (DODI / ARI)**  
AI baru WAJIB mengikuti preferensi user berikut tanpa pengecualian:  
1. **Format Penyajian:** User lebih suka  **Markdown Table langsung di Telegram** untuk laporan data. Gunakan bullet points untuk insight. File berat dikirim dalam bentuk  **Excel** (bukan PPTX). Gambar/Chart hanya dibuat jika diminta eksplisit.  
2. **Data Mentah:** Jika user minta "data mentah", sajikan dalam format  **JSON**.  
3. **Kelengkapan Data:** Tampilkan  **SEMUA DATA**, jangan disingkat atau diabbreviasi.  
4. **Prinsip Data:***"Jangan revisi data, apa yang ditampilkan di database seperti itulah yang kami gunakan."* Jangan mencoba membenarkan atau menginterpretasikan ulang angka dari database.  
5. **Default Branch:** Jika user tidak menyebutkan outlet/cabang spesifik, gunakan  **Branch = 'ABS'** (Head Office).  
6. **Outlet Ready:** Selalu tampilkan status kesiapan outlet di output promo.  
7. **Warna Indikator Status (Progress Bar / Persentase):**  
  - 🟢 **≥100%** (Hijau / Tercapai)  
  - 🟡 **95% - 99.99%** (Kuning / Hampir)  
  - 🔴 **<95%** (Merah / Belum capai)  
8. **Format Laporan Sync:**  
  - Outlet yang 0 records **TETAP HARUS DI-LIST** dengan tanda  **❗Bold**.  
  - BDM2 selalu 0 (non-aktif) tapi tetap ditampilkan.  
  - Urutkan outlet secara alfabetis (BDM1, BDM2, BT01... BT27).  
9. **Laporan Penjualan (Marketing POV):**  
  - WAJIB menyertakan MoM, YoY, dan Target Achievement. Ini bukan opsional.  
  - Selalu sertakan Action Plan di bagian akhir.  
10. **Rupiah Format:** Angka penuh, jangan disingkat (Contoh: Rp 1.952.426.393, BUKAN Rp 1.952 jt).  
11. **Timezone:** User berada di WITA (GMT+8). Server berjalan di UTC (GMT+0). Script konversi waktu WAJIB menambahkan +8 jam.  
**8. VISUALISASI & PRESENTASI**  
- **Matplotlib:** Untuk chart statis PNG (gunakan matplotlib.use('Agg')). Simpan di /opt/data/profiles/abs-internal/cache/.  
- **pptxgenjs:** Untuk presentasi formal direksi (Board Presentation). Struktur standar 8-slide: Cover → Exec Summary → Monthly Comp → Top/Bottom 5 → Detail 1 → Detail 2 → Analysis → Closing. Tema Light/Pink (#FF0088).  
- **Image Slide-Ready:** Resolusi 1980×1080 px, 150 DPI. Layout kolom: Outlet | Nama Outlet | Pencapaian (%) | Progress Bar. (Jangan tampilkan kolom nominal Rupiah di gambar slide jika user takut data tersebar).  
**9. DEFINISI BISNIS (BUSINESS LOGIC)**  
- **Traffic:**COUNT(DISTINCT NoFaktur) — jumlah transaksi unik, BUKAN jumlah barang.  
- **Modal / HPP:** Sama dengan HPP.  
- **Pareto:** FM (Fast Moving), SM (Slow Moving), BM (Bad Moving / Bazar Minimum), BB (Barang Baru / Bazar Blocked).  
- **Margin BigQuery vs Laba Rugi:** Margin di BigQuery (24-25%) adalah Gross Margin bruto apa adanya. Laporan Laba Rugi keuangan (20%) adalah Net Margin setelah diskon/PPN/retur/biaya operasional. Jangan anggap ini error, jelaskan perbedaan definisinya jika user bertanya.  
**10. REFERENSI FILE PENDUKUNG**  
Untuk pola query yang lebih kompleks, pelajari file-file referensi berikut di direktori skill gcp-bigquery/references/:  
- nofaktur_format.md — Struktur detail NoFaktur.  
- retail_analytics_patterns.md — Pola query performa outlet & tren produk.  
- sales-growth-analysis.md — Workflow analisis pertumbuhan MoM.  
- basket-analysis-patterns.md — Query Market Basket Analysis.  
- brand-extraction-patterns.md — Cara ekstrak brand dari NamaBarang.  
- brand-aliases.md — Kamus singkatan/alias brand.  
- hpp-qty-scaling-bug.md — Dokumentasi lengkap bug HPP per unit.  
- overstock-ito-analysis.md — Analisis overstock & Inventory Turn Over.  
- promo-evaluation-pattern.md — Evaluasi efektivitas promo.  
- ytd-sales-pattern.md — Pola laporan YTD & proporsional target.  
- inventory-overstock-analysis.md — Analisis stok berdasarkan Kategori (bukan Pareto).  
- laba-rugi-excel-workflow.md — Template pembuatan Excel Laba Rugi.  
- master-data-field-quirks.md — Keanehan field di Master Data.  
- backfill-operations.md — Panduan script backfill & limitasi free tier.  
*Dokumen ini disusun pada September 2026. Pastikan untuk selalu memverifikasi skema terbaru jika ada perubahan struktur dari tim IT.*  
   