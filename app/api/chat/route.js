import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import {
    verifyMember,
    activeMemoriesForPrompt,
    activeSkillsForPrompt,
    createMemory,
    proposeSkillUpdate,
} from '@/lib/chat-memory';
import { generateAgentFile } from '@/lib/file-generator';

export const maxDuration = 180;

let bigqueryClient = null;

function getBigQueryClient() {
    if (bigqueryClient) return bigqueryClient;

    const credentialPath = process.env.BIGQUERY_SERVICE_ACCOUNT_PATH || '/home/dodi/Migrasi_Data/service-account.json';

    if (!fs.existsSync(credentialPath)) {
        throw new Error(`Service account BigQuery tidak ditemukan di: ${credentialPath}`);
    }

    const { BigQuery } = require('@google-cloud/bigquery');
    const key = JSON.parse(fs.readFileSync(credentialPath, 'utf-8'));
    bigqueryClient = new BigQuery({
        credentials: {
            client_email: key.client_email,
            private_key: key.private_key,
        },
        projectId: key.project_id,
    });
    return bigqueryClient;
}

async function runBigQueryQuery(sql) {
    const client = getBigQueryClient();
    const [job] = await client.createQueryJob({ query: sql, useLegacySql: false });
    const [rows] = await job.getQueryResults();
    return rows;
}

function sanitizeBigQueryRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        const clean = {};
        for (const [key, val] of Object.entries(row)) {
            if (val === null || val === undefined) {
                clean[key] = null;
            } else if (typeof val === 'object') {
                if ('value' in val) {
                    clean[key] = String(val.value);
                } else if (val instanceof Date) {
                    clean[key] = val.toISOString();
                } else {
                    try {
                        clean[key] = JSON.parse(JSON.stringify(val));
                    } catch {
                        clean[key] = String(val);
                    }
                }
            } else if (typeof val === 'bigint') {
                clean[key] = Number(val);
            } else {
                clean[key] = val;
            }
        }
        return clean;
    });
}

function loadBigQueryGuide() {
    try {
        return fs.readFileSync(process.cwd() + '/lib/guides/gcp-bigquery-guide.md', 'utf-8');
    } catch {
        return '';
    }
}

function buildMemorySection(memories) {
    const global = (memories || []).filter((m) => m.scope === 'global');
    const user = (memories || []).filter((m) => m.scope === 'user');
    if (global.length === 0 && user.length === 0) return '';

    const lines = ['== MEMORI =='];
    if (global.length > 0) {
        lines.push('Memori global (berlaku semua user, kepercayaan tertinggi):');
        global.forEach((m) => lines.push(`- ${m.content}`));
    }
    if (user.length > 0) {
        lines.push('Memori pribadi user ini:');
        user.forEach((m) => lines.push(`- ${m.content}`));
    }
    lines.push('Gunakan memori di atas tanpa perlu user mengulanginya. Jika ada konflik, memori pribadi user menang atas global.');
    return lines.join('\n');
}

function buildSkillSection(skills) {
    if (!skills || skills.length === 0) return '';
    return (
        '== SKILL AKTIF (instruksi praktik kerja) ==\n' +
        skills
            .map((s) => `### ${s.name} (${s.slug})\n${s.content}`)
            .join('\n\n')
    );
}

function systemPrompt({ memories, skills }) {
    const guide = loadBigQueryGuide();
    return [
        'Anda asisten data ABS Group (Busana) yang terhubung ke Google BigQuery.',
        'Waktu user: WITA (GMT+8). Jika user tidak menyebut tanggal, pakai tanggal hari ini.',
        'Jika user menyebut tanggal tanpa tahun (misal "3 September"), prioritaskan tahun berjalan saat ini (2026). Jika menyertakan perbandingan YoY dengan tahun sebelumnya (2025), sebutkan tahun secara eksplisit pada penjelasan.',
        '',
        '== CARA KERJA ==',
        '1. Gunakan tool run_bigquery_query untuk semua pertanyaan data. Jangan menebak angka.',
        '2. Baca panduan BigQuery di bawah SEBELUM menulis query.',
        '3. Efisiensi query: Gabungkan kebutuhan metrik (omzet, total transaksi, margin, target, MoM, YoY) dalam 1-2 query terencana (gunakan CTE / subquery / conditional aggregation) daripada menjalankan banyak query kecil secara terpisah.',
        '4. Begitu data utama didapatkan, SEGERA susun dan tuliskan jawaban lengkap kepada user. Jangan menunda atau terus melakukan query tambahan yang tidak esensial.',
        '5. Saat pertanyaan ambigu (brand vs outlet, kategori vs pareto), periksa lewat query kecil atau tanya user.',
        '',
        buildMemorySection(memories),
        '',
        buildSkillSection(skills),
        '',
        '== ATURAN TOOL BigQuery ==',
        '- SQL standar BigQuery (useLegacySql false). Nama tabel selalu fully-qualified dengan backtick.',
        '- SELECT wajib memakai LIMIT (maks 1000 baris) kecuali agregasi yang sudah dikelompokkan.',
        '- Kolom HPP di tabel transaksi adalah HPP PER UNIT: total modal selalu SUM(HPP * Qty).',
        '- Proyek TANPA billing: jangan pernah menulis TRUNCATE/DELETE/UPDATE/MERGE/CREATE OR REPLACE.',
        '- Jangan JOIN lintas dataset Laporan_Penjualan_detail dan Master_Data (beda region).',
        '',
        '== TEKNIS relay ==',
        '- Anda punya tool untuk MENGAJAR DIRI SENDIRI (lihat bagian TEKNIS di akhir tool list).',
        '',
        '== FORMAT JAWABAN ==',
        '- Bahasa Indonesia, ringkas, langsung ke data.',
        '- Hasil tabel pakai Markdown. Rupiah penuh jangan disingkat.',
        '- FORMAT TABEL WAJIB: header, lalu baris baru, lalu |---|---|, lalu baris baru, lalu isi. Satu baris tabel = satu baris baris teks. JANGAN menyambung semua sel dalam satu baris fisik.',
        '- Contoh BENAR:\n| Tipe | Jumlah |\n|---|---|\n| BEAUTY | 17 |',
        '- Contoh SALAH: | Tipe | Jumlah | |---|---| | BEAUTY | 17 |',
        '- Tampilkan semua baris relevan, jangan terpotong, kecuali user minta ringkasan.',
        '- Laporan penjualan lengkap dengan MoM, YoY, pencapaian target bila datanya ada; tutup dengan Action Plan.',
        '- Data apa adanya: jangan merevisi atau menafsirkan ulang angka dari database.',
        '',
        '== ATURAN MEMBUAT FILE (PPTX / EXCEL / CSV) ==',
        'Ketika user meminta file (misal: "buatkan dalam laporan ppt", "ekspor ke excel", "buatkan csv", "jadikan presentasi"):',
        '1. Jika data yang dibutuhkan SUDAH ADA di riwayat percakapan sebelumnya, LANGSUNG panggil tool generate_file menggunakan data tersebut. JANGAN query ulang ke BigQuery.',
        '2. Panggil tool generate_file dengan format yang sesuai:',
        '   - PPTX: isi payload.slides (title, subtitle, text, bullets, table). Tema Merah Muda #FF0088, 16:9, ringkas, rapi, dan berbobot.',
        '   - XLSX: isi payload.rows (baris pertama = header) atau payload.sheets untuk multi-sheet.',
        '   - CSV: isi payload.rows (baris pertama = header).',
        '3. SETELAH tool generate_file berhasil, LANGSUNG berikan respon singkat berisi link unduhan markdown: [Unduh <Nama File>](<downloadUrl>).',
        '   Contoh respon: "File presentasi laporan penjualan sudah siap. Silakan unduh di sini: [Unduh laporan-penjualan.pptx](/api/chat/files?name=laporan-penjualan-xxxx.pptx)"',
        '4. DILARANG membuat tabel teks panjang atau mengulang isi seluruh data di chat saat membuat file. Langsung berikan link unduhan agar user segera bisa mengunduhnya.',
        '5. Untuk data tabel biasa di chat tetap pakai Markdown table; tabel diakhiri [FILE_CSV] hanya jika user minta file CSV tanpa generate_file.',
        '',
        (guide ? ('== PANDUAN BIGQUERY ABS GROUP (FONT OF TRUTH) ==\n\n' + guide) : ''),
    ].filter(Boolean).join('\n');
}

function validateSql(sql) {
    let normalized = sql.trim().replace(/;+\s*$/, '');
    const forbidden = /\b(truncate|delete\s+from|update\s+\w+\s+set|merge\s+into|insert\s+into|create\s+or\s+replace|drop\s+table)\b/i;
    if (forbidden.test(normalized)) {
        return { ok: false, error: 'Proyek BigQuery ini tanpa billing: hanya SELECT dan LOAD yang diizinkan. Jalankan query baca saja.' };
    }
    const upper = normalized.toUpperCase();
    const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');
    if (!isSelect) {
        return { ok: false, error: 'Hanya query SELECT/WITH yang dijalankan lewat chat.' };
    }
    const hasLimit = /\bLIMIT\s+\d+\b/i.test(normalized);
    const hasAggregate = /\b(SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(normalized) && /\bGROUP\s+BY\b/i.test(normalized);
    if (!hasLimit && !hasAggregate) {
        normalized = `${normalized}\nLIMIT 200`;
    }
    const limitMatch = normalized.match(/\bLIMIT\s+(\d+)\b/i);
    if (limitMatch && parseInt(limitMatch[1], 10) > 1000) {
        normalized = normalized.replace(/\bLIMIT\s+\d+\b/i, 'LIMIT 1000');
    }
    return { ok: true, sql: normalized };
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { messages } = body;

        // ===== Auth wajib: session dashboard =====
        const memberId = req.headers.get('x-session-member-id');
        const memberEmail = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email: memberEmail });
        if (!member) {
            return Response.json(
                { error: 'Chat Data wajib memakai login dashboard utama. Buka halaman utama dan masuk dulu, lalu kembali ke sini.' },
                { status: 401 }
            );
        }

        const apiKey = req.headers.get('x-api-key') || process.env.HERMES_API_KEY;
        const baseURL = req.headers.get('x-endpoint-url') || process.env.NEXT_PUBLIC_HERMES_URL || 'https://hermes.absgroup.biz.id';
        const modelName = req.headers.get('x-model-name') || 'default';

        if (!apiKey) {
            return Response.json(
                { error: 'API Key belum diisi. Buka pengaturan chat untuk mengisinya.' },
                { status: 400 }
            );
        }

        // ===== Muat memori & skill aktif =====
        const [memories, skills] = await Promise.all([
            activeMemoriesForPrompt({ memberId: member.id }).catch(() => []),
            activeSkillsForPrompt().catch(() => []),
        ]);

        const customProvider = createOpenAI({
            apiKey,
            baseURL,
        });

        const modelMessages = await convertToModelMessages(messages);

        const result = streamText({
            model: customProvider.chat(modelName),
            system: systemPrompt({ memories, skills }),
            messages: modelMessages,
            stopWhen: stepCountIs(25),
            tools: {
                run_bigquery_query: tool({
                    description: 'Jalankan query SELECT SQL ke Google BigQuery ABS Group dan kembalikan hasilnya sebagai baris data.',
                    inputSchema: z.object({
                        sql: z.string().describe('Query SQL BigQuery. SELECT harus memakai LIMIT kecuali agregasi, maksimal 1000 baris. Nama tabel fully-qualified dengan backtick.'),
                    }),
                    execute: async ({ sql }) => {
                        const check = validateSql(sql);
                        if (!check.ok) {
                            return { ok: false, error: check.error };
                        }
                        try {
                            const rows = await runBigQueryQuery(check.sql);
                            const cleanRows = sanitizeBigQueryRows(rows.slice(0, 500));
                            return { ok: true, rowCount: rows.length, rows: cleanRows };
                        } catch (err) {
                            return { ok: false, error: String(err.message || err).slice(0, 500) };
                        }
                    },
                }),

                remember: tool({
                    description: 'Simpan fakta penting ke memori agar tidak perlu ditanya lagi di percakapan lain. Gunakan saat user menyampaikan preferensi, aturan, konteks tim, atau koreksi.',
                    inputSchema: z.object({
                        scope: z.enum(['global', 'user']).describe('global = berlaku semua user (butuh relay exec pada UI, tetap boleh diusulkan), user = hanya untuk user ini.'),
                        content: z.string().max(500).describe('Fakta/prefensi dalam satu kalimat jelas.'),
                    }),
                    execute: async ({ scope, content }) => {
                        try {
                            // Pemberian memori global dari agent hanya bila user ber-peran exec;
                            // selain itu agent tetap boleh mengusulkan → disimpan ke scope user.
                            const isExec = ['Super User', 'Direksi'].includes(member.role);
                            const finalScope = scope === 'global' && isExec ? 'global' : 'user';
                            const saved = await createMemory({
                                scope: finalScope,
                                memberId: member.id,
                                content,
                                source: 'agent',
                                createdBy: member.id,
                                confidence: 6,
                            });
                            return {
                                ok: true,
                                memoryId: saved.id,
                                savedScope: finalScope,
                                note: finalScope === 'user'
                                    ? 'Disimpan sebagai memori pribadi user ini. Untuk memori global, user dengan peran Super User/Direksi harus menyetujuinya lewat panel Memori.'
                                    : 'Disimpan sebagai memori global.',
                            };
                        } catch (err) {
                            return { ok: false, error: String(err.message || err).slice(0, 300) };
                        }
                    },
                }),

                refine_skill: tool({
                    description: 'Usulkan pembaruan skill (menyempurnakan cara kerja agent). Dipakai setelah menemukan pola query yang berhasil, jebakan baru, atau preferensi user yang ternyata penting.',
                    inputSchema: z.object({
                        slug: z.string().describe('Slug skill yang mau diperbarui, mis. bigquery-playbook atau chat-manner.'),
                        new_content: z.string().max(8000).describe('Isi skill lengkap yang baru (bukan diff). Wajib memuat seluruh isi skill lama yang masih relevan plus tambahannya.'),
                        reason: z.string().max(1000).describe('Alasan singkat perubahan, mis. "Query basket analysis ternyata butuh filter HPP>100 agar plastik tidak terhitung".'),
                    }),
                    execute: async ({ slug, new_content, reason }) => {
                        try {
                            const res = await proposeSkillUpdate({
                                slug,
                                newContent: new_content,
                                reason,
                                createdBy: member.id,
                            });
                            if (!res.ok) return res;
                            return {
                                ok: true,
                                applied: res.applied,
                                version: res.version,
                                skillName: res.skillName,
                                pendingReview: res.pendingReview || false,
                                note: res.applied
                                    ? `Skill "${res.skillName}" otomatis ter-update ke versi ${res.version}.`
                                    : `Versi ${res.version} skill "${res.skillName}" masuk antrean review karena auto-refine nonaktif pada skill ini.`,
                            };
                        } catch (err) {
                            return { ok: false, error: String(err.message || err).slice(0, 300) };
                        }
                    },
                }),

                generate_file: tool({
                    description: 'Buat file nyata (PPTX presentasi / XLSX Excel / CSV) yang bisa langsung diunduh user. Wajib dipakai saat user meminta file, laporan PowerPoint, atau rekap Excel.',
                    inputSchema: z.object({
                        format: z.enum(['pptx', 'xlsx', 'csv']).describe('Jenis file yang diminta user.'),
                        fileName: z.string().max(60).optional().describe('Nama file tanpa ekstensi, mis. laporan-penjualan-bt01-september.'),
                        title: z.string().max(120).optional().describe('Judul dokumen/laporan, dipakai sebagai judul utama.'),
                        /* PPTX: sebuah slide = { title, subtitle?, text?, bullets?[], table?[[...]] } */
                        slides: z.array(z.object({
                            title: z.string().max(120),
                            subtitle: z.string().max(200).optional(),
                            text: z.string().max(1200).optional(),
                            bullets: z.array(z.string().max(300)).max(10).optional(),
                            table: z.array(z.array(z.string()).max(12)).max(25).optional(),
                        })).max(15).optional().describe('PPTX only: daftar slide. Slide 1 biasanya cover, terakhir closing.'),
                        /* XLSX/CSV: baris pertama = header */
                        rows: z.array(z.array(z.union([z.string(), z.number()]))).max(1000).optional().describe('XLSX/CSV only: data tabel, baris pertama adalah header.'),
                        sheets: z.array(z.object({
                            name: z.string().max(30),
                            title: z.string().max(120).optional(),
                            rows: z.array(z.array(z.union([z.string(), z.number()]))).max(1000),
                        })).max(5).optional().describe('XLSX only: multi-sheet.'),
                    }),
                    execute: async (payload) => {
                        try {
                            const file = await generateAgentFile(payload);
                            const downloadUrl = `/api/chat/files?name=${encodeURIComponent(file.fileName)}`;
                            return {
                                ok: true,
                                fileName: file.fileName,
                                downloadUrl,
                                sizeKb: Math.round(file.size / 1024),
                                format: payload.format,
                                title: payload.title || payload.fileName || file.fileName,
                                note: `File "${file.fileName}" berhasil dibuat. LANGSUNG kirimkan link unduhan ini kepada user: [Unduh ${file.fileName}](${downloadUrl})`,
                            };
                        } catch (err) {
                            return { ok: false, error: String(err.message || err).slice(0, 300) };
                        }
                    },
                }),
            },
        });

        return result.toUIMessageStreamResponse({
            onError: (err) => String(err?.message || err),
        });
    } catch (error) {
        console.error('Chat API Error:', error);
        return Response.json(
            { error: error.message || 'Terjadi kesalahan saat memproses chat.' },
            { status: 500 }
        );
    }
}
