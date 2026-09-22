/**
 * ==============================================================================
 * Busana Task Dashboard - Daily Morning WhatsApp Task Dispatcher (CLI Runner)
 * Jadwal Eksekusi: Setiap Hari Pukul 07:00 WITA (Asia/Makassar, UTC+8)
 * Format Pesan:
 *   1. Task Overdue (Tugas Terlewat Saya)
 *   2. Task Hari Ini (Deadline Hari Ini Saya)
 *   3. Radar Deadline Bawahan:
 *      - Tugas Bawahan yang Overdue
 *      - Tugas Bawahan Hari Ini
 * Dukungan Gateway: Fonnte (aktif saat ini) & WAHA (masa depan)
 * ==============================================================================
 * Cara Menjalankan Manual:
 *   node --env-file=.env.local scripts/morning_dispatch.mjs
 *   node --env-file=.env.local scripts/morning_dispatch.mjs --dry-run
 */

import { runMorningDispatch } from "../lib/morning-dispatch.js";

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("⏰ Memulai broadcast morning task dispatch (CLI)...");
  if (isDryRun) {
    console.log("ℹ️ Berjalan dalam mode simulasi (--dry-run). Pesan tidak akan dikirim.");
  }

  try {
    const result = await runMorningDispatch({
      dryRun: isDryRun,
    });

    console.log("==================================================");
    console.log(`Status: Sukses`);
    console.log(`Waktu   : ${result.todayHuman} (07:00 WITA)`);
    console.log(`Gateway : ${result.provider.toUpperCase()}`);
    console.log(`Total Target : ${result.totalEligible} penerima`);
    console.log(`Terkirim     : ${result.sentCount}`);
    console.log(`Gagal        : ${result.failedCount}`);
    console.log("==================================================");

    for (const d of result.dispatches) {
      if (d.status === "sent" || d.status === "simulated") {
        console.log(`✅ [${d.status.toUpperCase()}] ${d.memberName} (${d.phone})`);
      } else {
        console.error(`❌ [FAILED] ${d.memberName} (${d.phone}): ${d.error}`);
      }
    }
  } catch (err) {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
  }
}

main();
