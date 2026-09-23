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
    getGlobalProviderSettings,
} from '@/lib/chat-memory';
import { generateAgentFile } from '@/lib/file-generator';

export const maxDuration = 180;

import { runBigQueryQuery, sanitizeBigQueryRows } from '@/lib/bigquery';

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
        'Nama Anda: Bebie (Beauty Bestie AI), asisten data kecantikan & operasional ABS Group (Busana) yang terhubung ke Google BigQuery.',
        'Kepribadian: Ramah, cerdas, solutif, dan profesional dengan sentuhan hangat (beauty bestie). Selalu menyajikan analisis data dengan rapi, jelas, dan akurat.',
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
        'Bila user mengunggah gambar, foto struk, grafik, atau dokumen/tabel, baca dan analisis informasi visual atau data di dalamnya secara seksama untuk menjawab pertanyaan user.',
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
        '== ATURAN MEMBUAT FILE (PPTX / HTML / EXCEL / CSV) ==',
        'Ketika user meminta file (misal: "buatkan dalam laporan ppt", "buatkan presentasi html", "ekspor ke excel", "buatkan csv", "jadikan presentasi"):',
        '1. Jika data yang dibutuhkan SUDAH ADA di riwayat percakapan sebelumnya, LANGSUNG panggil tool generate_file menggunakan data tersebut. JANGAN query ulang ke BigQuery.',
        '2. Panggil tool generate_file dengan format yang sesuai:',
        '   - PPTX: isi payload.slides (title, subtitle, text, bullets, table). Gaya Executive Board Deck (Deep Navy #0F172A & Rose #E11D48), 16:9, split layout (tabel di kiri, takeaways di kanan). DILARANG menggunakan karakter batang chart ASCII (████░░) di tabel!',
        '   - HTML: isi payload.slides atau payload.rows. Menghasilkan laporan/presentasi web interaktif mandiri yang cantik, responsif, dan siap dibuka di browser atau dicetak PDF.',
        '   - XLSX: isi payload.rows (baris pertama = header) atau payload.sheets untuk multi-sheet.',
        '   - CSV: isi payload.rows (baris pertama = header).',
        '3. SETELAH tool generate_file berhasil, LANGSUNG berikan respon singkat berisi link: [Buka/Unduh <Nama File>](<downloadUrl>).',
        '   Contoh respon: "File presentasi laporan sudah siap. Silakan buka atau unduh di sini: [Unduh laporan-penjualan.pptx](/api/chat/files?name=laporan-penjualan-xxxx.pptx)"',
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

async function extractTextFromFilePart(part) {
    const filename = part.filename || 'file';
    const mediaType = (part.mediaType || '').toLowerCase();
    const url = part.url || '';

    let buffer = null;
    if (url.startsWith('data:')) {
        const base64Index = url.indexOf(';base64,');
        if (base64Index !== -1) {
            const base64Data = url.slice(base64Index + 8);
            buffer = Buffer.from(base64Data, 'base64');
        }
    }

    if (!buffer) {
        return `[Lampiran file "${filename}" (${mediaType})]`;
    }

    const ext = filename.split('.').pop()?.toLowerCase();

    // 1. File Excel (.xlsx, .xls)
    if (ext === 'xlsx' || ext === 'xls' || mediaType.includes('spreadsheet') || mediaType.includes('excel')) {
        try {
            const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const sheetsText = [];
            workbook.eachSheet((worksheet) => {
                const rows = [];
                worksheet.eachRow({ includeEmpty: false }, (row) => {
                    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
                    rows.push(values.map((v) => (v === null || v === undefined ? '' : String(v))).join(' | '));
                });
                if (rows.length > 0) {
                    const preview = rows.slice(0, 150).join('\n');
                    const truncated = rows.length > 150 ? `\n... (${rows.length - 150} baris lainnya dipotong)` : '';
                    sheetsText.push(`### Sheet: ${worksheet.name}\n${preview}${truncated}`);
                }
            });
            return `[Konten File Excel "${filename}"]:\n\n${sheetsText.join('\n\n') || '(Sheet kosong)'}`;
        } catch (e) {
            return `[Lampiran File Excel "${filename}": gagal mengekstrak data (${e.message})]`;
        }
    }

    // 2. Teks / CSV / JSON / Markdown / SQL / Dokumen Kode
    const isText =
        mediaType.startsWith('text/') ||
        mediaType.includes('json') ||
        mediaType.includes('csv') ||
        ['csv', 'txt', 'json', 'sql', 'md', 'xml', 'yaml', 'yml', 'log', 'tsv'].includes(ext);

    if (isText) {
        let text = buffer.toString('utf-8');
        if (text.length > 15000) {
            text = text.slice(0, 15000) + '\n\n... [isi file terpotong karena terlalu panjang (maks 15.000 karakter)]';
        }
        return `[Konten File "${filename}"]:\n\`\`\`\n${text}\n\`\`\``;
    }

    return `[Lampiran file: "${filename}" (${mediaType || 'binary'}), ukuran ${(buffer.length / 1024).toFixed(1)} KB]`;
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

        const globalCfg = await getGlobalProviderSettings().catch(() => ({}));
        const rawApiKey = req.headers.get('x-api-key');
        const apiKey = (rawApiKey && !/^•+$/.test(rawApiKey.trim()))
            ? rawApiKey.trim()
            : (globalCfg.apiKey || process.env.HERMES_API_KEY);
        const baseURL = req.headers.get('x-endpoint-url') || globalCfg.baseURL || process.env.NEXT_PUBLIC_HERMES_URL || 'https://hermes.absgroup.biz.id';
        const modelName = req.headers.get('x-model-name') || globalCfg.model || 'busana';

        if (!apiKey) {
            return Response.json(
                { error: 'API Key provider belum diatur oleh Direksi/Super User.' },
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

        // ===== Sanitasi dan pemrosesan pesan (gambar vision vs dokumen teks/Excel) =====
        const processedMessages = await Promise.all(
            (messages || []).map(async (msg) => {
                if (!msg || !Array.isArray(msg.parts)) return msg;

                const newParts = [];
                for (const part of msg.parts) {
                    // Mencegah crash jika part kosong atau tidak memiliki properti type
                    if (!part || !part.type) continue;

                    if (part.type === 'file') {
                        const isImage =
                            part.mediaType?.startsWith('image/') ||
                            /\.(png|jpe?g|webp|gif|svg)$/i.test(part.filename || '');

                        if (isImage) {
                            newParts.push({
                                ...part,
                                mediaType: part.mediaType || 'image/jpeg',
                            });
                        } else {
                            // Format non-gambar (CSV, Excel, TXT, JSON):
                            // Ekstrak teks agar AI dapat membaca dan menganalisis isinya
                            try {
                                const extractedText = await extractTextFromFilePart(part);
                                newParts.push({
                                    type: 'text',
                                    text: extractedText,
                                });
                            } catch (err) {
                                newParts.push({
                                    type: 'text',
                                    text: `[Lampiran file "${part.filename || 'dokumen'}": gagal membaca konten (${err.message})]`,
                                });
                            }
                        }
                    } else {
                        newParts.push(part);
                    }
                }

                if (newParts.length === 0) {
                    newParts.push({ type: 'text', text: msg.content || '' });
                }

                return {
                    ...msg,
                    parts: newParts,
                };
            })
        );

        const modelMessages = await convertToModelMessages(processedMessages);

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
                    description: 'Buat file nyata (PPTX presentasi / HTML web report / XLSX Excel / CSV) yang bisa langsung dibuka atau diunduh user. Wajib dipakai saat user meminta file presentasi, laporan web, atau rekap data.',
                    inputSchema: z.object({
                        format: z.enum(['pptx', 'html', 'xlsx', 'csv']).describe('Jenis file yang diminta user: pptx (slide presentasi), html (laporan web interaktif), xlsx (excel), atau csv.'),
                        fileName: z.string().max(60).optional().describe('Nama file tanpa ekstensi, mis. laporan-penjualan-bt01-september.'),
                        title: z.string().max(120).optional().describe('Judul dokumen/laporan, dipakai sebagai judul utama.'),
                        /* PPTX / HTML: sebuah slide = { title, subtitle?, text?, bullets?[], table?[[...]] } */
                        slides: z.array(z.object({
                            title: z.string().max(120),
                            subtitle: z.string().max(200).optional(),
                            text: z.string().max(1200).optional(),
                            bullets: z.array(z.string().max(300)).max(10).optional(),
                            table: z.array(z.array(z.string()).max(12)).max(25).optional(),
                        })).max(15).optional().describe('PPTX/HTML: daftar slide. Slide 1 biasanya cover, terakhir closing.'),
                        /* XLSX/CSV/HTML: baris pertama = header */
                        rows: z.array(z.array(z.union([z.string(), z.number()]))).max(1000).optional().describe('XLSX/CSV/HTML: data tabel, baris pertama adalah header.'),
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
