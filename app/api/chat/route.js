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
import {
    getMemberAccessibleProjects,
    getAvailableMembersForProjects,
    queryAccessibleTasks,
    getAccessibleTaskDetails,
    createTaskForUser,
    updateTaskStatusForUser,
    addTaskUpdateLogForUser,
    attachTaskFileForUser,
} from '@/lib/task-assistant';
import { queryActivePromos } from '@/lib/promos';

export const maxDuration = 180;

export const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-member-id, x-session-email, x-api-key, x-endpoint-url, x-model-name',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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

function systemPrompt({ memories, skills, canUseBigQuery = true, member = null, accessibleProjects = [], availableMembers = [] }) {
    const guide = canUseBigQuery ? loadBigQueryGuide() : null;
    const projectSummary = accessibleProjects.length > 0
        ? accessibleProjects.map((p) => `- "${p.name}" (ID: ${p.id}, Section: ${(p.folders || ['General']).join(', ')})`).join('\n')
        : '- (Tidak ada workspace yang terhubung dengan akun ini)';
    const memberSummary = availableMembers.slice(0, 30).map((m) => `${m.name} (${m.position || m.role || 'Staff'}) [ID: ${m.id}]`).join(', ');

    return [
        canUseBigQuery
            ? 'Nama Anda: Bebie (Beauty Bestie AI), asisten data kecantikan, personal task assistant, & operasional ABS Group (Busana).'
            : 'Nama Anda: Bebie (Beauty Bestie AI), asisten pribadi cerdas, personal task assistant & produktivitas tim ABS Group (Busana).',
        'Kepribadian: Ramah, cerdas, solutif, teliti, dan profesional dengan sentuhan hangat (beauty bestie). Selalu menyajikan analisis dan solusi dengan rapi, jelas, dan akurat.',
        'Waktu user: WITA (GMT+8). Jika user tidak menyebut tanggal, pakai tanggal hari ini.',
        'Jika user menyebut tanggal tanpa tahun (misal "3 September"), prioritaskan tahun berjalan saat ini (2026). Jika menyertakan perbandingan YoY dengan tahun sebelumnya (2025), sebutkan tahun secara eksplisit pada penjelasan.',
        '',
        '== IDENTITAS USER & LINGKUP KERJA ==',
        `User aktif saat ini: ${member?.name || 'User'} (ID: ${member?.id}, Role: ${member?.role || 'Leader'}, Divisi: ${member?.division || '-'}).`,
        '',
        '== PERAN PERSONAL ASSISTANT & PENGELOLA TUGAS (TASK) ==',
        'Anda berfungsi sebagai Personal Assistant bagi user untuk membaca tugas pribadi, mengawasi tugas tim, membuat tugas baru, memperbarui status, dan melampirkan berkas bukti.',
        '',
        '1. HAK AKSES & OTORISASI DATA (ATURAN KETAT):',
        '- Otorisasi data Anda SAMA PERSIS dengan sistem dashboard.',
        '- Anda HANYA boleh menyajikan dan mengelola tugas dari workspace/project yang user ikuti (bergabung di dalamnya) atau miliki.',
        '- DILARANG KERAS menyajikan, membocorkan, atau mengelola tugas di workplace/project di mana user TIDAK join di dalamnya.',
        '- Daftar workspace/project yang resmi boleh diakses oleh user ini:',
        projectSummary,
        '- Konteks "Task Saya": Gunakan tool get_tasks dengan scope="my_tasks" (tugas di mana user adalah PIC atau pembuatnya).',
        '- Konteks "Task Tim Saya": Gunakan tool get_tasks dengan scope="team_tasks" (tugas rekan-rekan tim dalam workspace yang boleh diakses user).',
        '- Jika user menanyakan tugas dari project yang tidak ada dalam daftar workspace di atas, sampaikan secara sopan bahwa user tidak bergabung di project tersebut sehingga data dibatasi demi keamanan.',
        '',
        '2. ATURAN PEMBUATAN TUGAS BARU (WAJIB MENANYAKAN KEMBALI JIKA ELEMEN BELUM LENGKAP):',
        '- Anda BISA membantu membuatkan tugas baru menggunakan tool create_task.',
        '- ATURAN MUTLAK: Sebelum memanggil tool create_task, SEMUA elemen berikut HARUS sudah diinput atau dikonfirmasi oleh user:',
        '  a. Judul Tugas (title)',
        '  b. Workspace/Project tujuan (projectId: wajib dipilih dari daftar workspace user di atas)',
        '  c. PIC / Penanggung jawab (picId: anggota yang ditugaskan)',
        '  d. Tenggat Waktu / Deadline (tanggal jelas format YYYY-MM-DD)',
        '  e. Tingkat Prioritas (priority: Low / Medium / High / Urgent)',
        '  f. Folder / Section (folder: nama folder yang ada di project atau "General")',
        '  g. Memo / Deskripsi catatan instruksi tugas (memo)',
        '- JIKA USER HANYA MENYEBUTKAN SEBAGIAN (misal hanya bilang "Bebie buatkan task cek stok"):',
        '  DILARANG MENEBAK atau langsung memanggil tool create_task!',
        '  Anda WAJIB menanyakan kembali kepada user rincian yang belum lengkap secara ramah dan terstruktur.',
        '  Sajikan opsi workspace yang user ikuti, tanyakan siapa PIC yang ditunjuk, kapan tanggal deadline-nya, dan apa tingkat prioritasnya.',
        '- HANYA panggil tool create_task jika seluruh elemen di atas sudah lengkap dan jelas.',
        '',
        '3. PEMBARUAN STATUS & CATATAN PROGRES:',
        '- Gunakan tool update_task_status untuk mengubah status tugas ("To Do", "In Progress", "Pending Review", "Done"). Anda bisa menyertakan catatan penjelasan pada parameter note.',
        '- Gunakan tool add_task_update_log jika user ingin menambahkan catatan perkembangan/progres tugas tanpa mengubah status.',
        '',
        '4. LAMPIRAN BERKAS / FILE BUKTI:',
        '- Gunakan tool attach_task_file untuk melampirkan berkas dokumen bukti penuntasan atau tautan URL ke dalam tugas.',
        '',
        '5. INFORMASI PROMO AKTIF OUTLET (BEAUTY KENDARI):',
        '- Anda memiliki integrasi langsung ke data promo resmi yang sedang aktif berjalan di semua outlet via tool get_active_promos.',
        '- Gunakan tool get_active_promos jika user menanyakan promo hari ini, diskon, hadiah (GWP), voucher, flash sale, promo brand tertentu (Wardah, Emina, Make Over, Maybelline, Nivea, Azarine, Fav Beauty, dll.), atau promo cabang tertentu.',
        '- Sajikan info promo secara rapi dan menarik: nama promo, brand, mekanisme keuntungan, periode promo, cabang/outlet yang berlaku, dan sertakan tautan Link Materi Promosi / Link SKU jika ada.',
        '- Data promo ini berlaku dan dapat diakses oleh semua pengguna.',
        '',
        'Referensi Anggota Tim / PIC yang tersedia: ' + (memberSummary || '(Belum ada anggota)'),
        '',
        canUseBigQuery
            ? '== CARA KERJA & AKSES DATA BIGQUERY ==\n1. Gunakan tool run_bigquery_query untuk semua pertanyaan data. Jangan menebak angka.\n2. Baca panduan BigQuery di bawah SEBELUM menulis query.\n3. Efisiensi query: Gabungkan kebutuhan metrik (omzet, total transaksi, margin, target, MoM, YoY) dalam 1-2 query terencana (gunakan CTE / subquery / conditional aggregation) daripada banyak query kecil.\n4. Begitu data utama didapatkan, SEGERA susun dan tuliskan jawaban lengkap kepada user.\n5. Saat pertanyaan ambigu (brand vs outlet, kategori vs pareto), periksa lewat query kecil atau tanya user.'
            : '== STATUS AKSES DATA BIGQUERY ==\nAkun user saat ini beroperasi dalam MODE ASISTEN UMUM (akses kueri langsung ke Google BigQuery belum diaktifkan oleh Direksi).\nJika user meminta data penjualan cabang, omzet realtime, atau data transaksi internal database, sampaikan secara sopan dan jelas bahwa akunnya belum diberikan hak akses BigQuery untuk Chat Bebie, dan sarankan untuk menghubungi Direksi jika memerlukan akses data tersebut.\nAnda tetap dapat membantu user secara optimal dalam menyusun strategi, membuat format laporan/presentasi, menganalisis file dokumen/gambar yang dilampirkan, serta merangkum teks.',
        '',
        'Bila user mengunggah gambar, foto struk, grafik, atau dokumen/tabel, baca dan analisis informasi visual atau data di dalamnya secara seksama untuk menjawab pertanyaan user.',
        '',
        buildMemorySection(memories),
        '',
        buildSkillSection(skills),
        '',
        ...(canUseBigQuery ? [
            '== ATURAN TOOL BigQuery ==',
            '- SQL standar BigQuery (useLegacySql false). Nama tabel selalu fully-qualified dengan backtick.',
            '- SELECT wajib memakai LIMIT (maks 1000 baris) kecuali agregasi yang sudah dikelompokkan.',
            '- Kolom HPP di tabel transaksi adalah HPP PER UNIT: total modal selalu SUM(HPP * Qty).',
            '- Proyek TANPA billing: jangan pernah menulis TRUNCATE/DELETE/UPDATE/MERGE/CREATE OR REPLACE.',
            '- Jangan JOIN lintas dataset Laporan_Penjualan_detail dan Master_Data (beda region).',
            '',
        ] : []),
        '== TEKNIS relay ==',
        '- Anda punya tool untuk MENGAJAR DIRI SENDIRI (lihat bagian TEKNIS di akhir tool list).',
        '',
        '== FORMAT JAWABAN ==',
        '- Bahasa Indonesia, ringkas, langsung ke inti.',
        '- Hasil tabel pakai Markdown. Rupiah penuh jangan disingkat.',
        '- FORMAT TABEL WAJIB: header, lalu baris baru, lalu |---|---|, lalu baris baru, lalu isi. Satu baris tabel = satu baris baris teks. JANGAN menyambung semua sel dalam satu baris fisik.',
        '- Tampilkan semua baris relevan, jangan terpotong, kecuali user minta ringkasan.',
        '- Data apa adanya: jangan merevisi atau menafsirkan ulang angka.',
        '',
        '== ATURAN MEMBUAT FILE PRESENTASI & LAPORAN (SKILL-PERSENTASI: PDF / PPTX / HTML / EXCEL) ==',
        'Ketika user meminta file presentasi, deck dewan direksi, slide, laporan PDF, laporan HTML, atau rekapitulasi data (misal: "buatkan slide presentasi", "buatkan presentasi pakai skill-persentasi", "buatkan deck direksi", "ekspor ke pdf", "laporan direksi"):',
        '1. PILIHAN FORMAT FILE PRESENTASI (PENTING):',
        '   - DEFAULT & WAJIB UNTUK PRESENTASI: Gunakan format "pdf". Format PDF diproses melalui Headless Google Chrome sehingga mendukung 100% grafik SVG dinamis, efek Glassmorphism, kartu metrik KPI, dan gradasi Pastel Mesh standar direksi.',
        '   - HANYA gunakan format "pptx" jika user secara eksplisit meminta file PowerPoint ("pptx" / "powerpoint").',
        '2. DUA CARA MEMBUAT SLIDE BERKUALITAS TINGGI VIA TOOL generate_file:',
        '   - CARA A (PALING DIANJURKAN - RAW HTML MODE): Buat file HTML5 lengkap mandiri (16:9, Glassmorphism CSS, inline SVG dengan koordinat presisi sesuai data, palet warna Busana) dan kirimkan ke parameter `rawHtml` di tool `generate_file` dengan format: "pdf" (atau "html"). Sistem akan langsung mengonversinya menjadi PDF via Chrome Headless.',
        '   - CARA B (STRUCTURED SLIDES MODE): Panggil generate_file dengan array `slides: [...]` dan format: "pdf". Tentukan `chartType` ("hourly_traffic", "margin_zero_baseline", "bar_chart", "gantt_shift") dan isi `chartData: [...]` dengan data angka konkret agar grafik SVG ter-render presisi.',
        '3. STANDAR PRESENTASI EKSEKUTIF WAJIB DIPATUHI:',
        '   - So What Titles: Setiap judul slide WAJIB berupa KESIMPULAN BISNIS ASERTIF (BUKAN topik pasif seperti "Distribusi Trafik", melainkan kesimpulan aktif seperti "Rentang 16:00–21:00 Menjadi Prime Time Toko yang Menyumbang 58,5% Trafik"). Maksimal 2 baris, tanpa tanda titik atau tanda tanya di akhir.',
        '   - Tata Letak 2 Kolom Berimbang: Kiri data fakta/grafik, Kanan analisis bisnis & tindakan operasional konkret.',
        '   - Anti-AI Smell: Angka Rupiah ditulis penuh (Rp 1.952.426.393), hindari kata klise hampa ("sinergi", "era disrupsi"), gunakan terminologi bisnis nyata (omset, HPP, margin kotor, basket size, NoFaktur, SPG/BA).',
        '4. Jika data sudah ada di riwayat percakapan sebelumnya, LANGSUNG panggil tool generate_file tanpa mengulang query.',
        '5. SETELAH tool generate_file berhasil, LANGSUNG berikan respon singkat berisi ringkasan eksekutif 2-3 kalimat dan link unduhan: [Buka/Unduh <Nama File>](<downloadUrl>).',
        '6. DILARANG membuat tabel teks panjang atau mengulang isi seluruh data di chat saat membuat file. Langsung berikan link unduhan agar user segera bisa mengunduhnya.',
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
                { status: 401, headers: CORS_HEADERS }
            );
        }

        // ===== Otorisasi role: Khusus Leader (Bukan Staff) =====
        if (member.role === 'Staff') {
            return Response.json(
                { error: 'Akses Chat Bebie hanya diperuntukkan bagi tingkatan Leader (Koordinator, SPV, Manager, Direksi).' },
                { status: 403, headers: CORS_HEADERS }
            );
        }

        const isExec = ['Super User', 'Direksi'].includes(member.role);
        const canUseBigQuery = Boolean(member.can_access_bigquery || isExec);

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
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // ===== Muat memori, skill aktif, project akses, dan anggota tim =====
        const [memories, skills, accessibleProjects] = await Promise.all([
            activeMemoriesForPrompt({ memberId: member.id }).catch(() => []),
            activeSkillsForPrompt().catch(() => []),
            getMemberAccessibleProjects(member).catch((err) => {
                console.error('Failed to get accessible projects for chat user:', err);
                return [];
            }),
        ]);

        const availableMembers = await getAvailableMembersForProjects(accessibleProjects, member.division).catch(() => []);

        const customProvider = createOpenAI({
            apiKey,
            baseURL,
        });

        // ===== Sanitasi dan pemrosesan pesan (gambar vision vs dokumen teks/Excel) =====
        const processedMessages = await Promise.all(
            (messages || []).map(async (msg) => {
                if (!msg) return msg;

                const inputParts = Array.isArray(msg.parts) && msg.parts.length > 0
                    ? msg.parts
                    : [{ type: 'text', text: msg.content || '' }];

                const newParts = [];
                for (const part of inputParts) {
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
            system: systemPrompt({ memories, skills, canUseBigQuery, member, accessibleProjects, availableMembers }),
            messages: modelMessages,
            stopWhen: stepCountIs(25),
            maxTokens: 8192,
            tools: {
                ...(canUseBigQuery ? {
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
                } : {}),

                list_my_projects: tool({
                    description: 'Daftar workspace/project yang diikuti oleh user saat ini dan dapat diakses.',
                    inputSchema: z.object({}),
                    execute: async () => {
                        return {
                            ok: true,
                            total: accessibleProjects.length,
                            projects: accessibleProjects.map((p) => ({
                                id: p.id,
                                name: p.name,
                                division: p.division,
                                folders: p.folders || ['General'],
                                isPersonal: p.description === 'personal',
                            })),
                        };
                    },
                }),

                list_project_members: tool({
                    description: 'Daftar anggota tim / PIC yang tersedia untuk penugasan pada workspace user.',
                    inputSchema: z.object({
                        projectId: z.string().optional().describe('ID project spesifik (opsional)'),
                    }),
                    execute: async ({ projectId }) => {
                        if (projectId && !accessibleProjects.some((p) => p.id === projectId)) {
                            return { ok: false, error: 'Akses ditolak: Anda tidak tergabung dalam workspace ini.' };
                        }
                        return {
                            ok: true,
                            members: availableMembers.map((m) => ({
                                id: m.id,
                                name: m.name,
                                position: m.position || '',
                                division: m.division || '',
                                role: m.role || 'Staff',
                            })),
                        };
                    },
                }),

                get_tasks: tool({
                    description: 'Cari atau baca daftar tugas dalam workspace yang diizinkan untuk user. Bisa untuk membaca "task saya", "task tim saya", atau filter berdasarkan status, deadline, prioritas, dan kata kunci.',
                    inputSchema: z.object({
                        scope: z.enum(['my_tasks', 'team_tasks', 'all_accessible']).default('all_accessible').describe('Cakupan tugas: "my_tasks" (tugas saya/PIC adalah user), "team_tasks" (tugas rekan tim dalam workspace), "all_accessible" (semua tugas dalam workspace yang diizinkan)'),
                        projectId: z.string().optional().describe('Filter spesifik berdasarkan ID project/workspace'),
                        status: z.enum(['all', 'active', 'To Do', 'In Progress', 'Pending Review', 'Done']).optional().describe('Filter status tugas ("active" = semua yang belum selesai)'),
                        priority: z.enum(['all', 'Low', 'Medium', 'High', 'Urgent']).optional().describe('Filter prioritas tugas'),
                        query: z.string().optional().describe('Pencarian kata kunci pada judul tugas atau memo'),
                        picName: z.string().optional().describe('Filter berdasarkan nama PIC'),
                        dateRange: z.enum(['today', 'tomorrow', 'this_week', 'overdue', 'all']).optional().describe('Filter rentang deadline: today, tomorrow, this_week, overdue, all'),
                    }),
                    execute: async (params) => {
                        try {
                            const tasks = await queryAccessibleTasks({
                                member,
                                accessibleProjects,
                                ...params,
                            });
                            return {
                                ok: true,
                                count: tasks.length,
                                tasks,
                            };
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    },
                }),

                get_task_detail: tool({
                    description: 'Lihat rincian lengkap satu tugas (termasuk subtask checklist, riwayat update log, dan berkas lampiran) berdasarkan ID tugas.',
                    inputSchema: z.object({
                        taskId: z.string().describe('ID tugas yang ingin dilihat rinciannya'),
                    }),
                    execute: async ({ taskId }) => {
                        try {
                            const task = await getAccessibleTaskDetails({
                                member,
                                accessibleProjects,
                                taskId,
                            });
                            return {
                                ok: true,
                                task,
                            };
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    },
                }),

                create_task: tool({
                    description: 'Buat tugas baru ke dalam database sistem. PENTING: Hanya panggil tool ini jika seluruh elemen (judul, project, pic, deadline, prioritas) sudah lengkap dikonfirmasi oleh user.',
                    inputSchema: z.object({
                        title: z.string().min(1).describe('Judul tugas'),
                        projectId: z.string().describe('ID project/workspace tujuan (harus dari daftar workspace yang user ikuti)'),
                        picId: z.string().describe('ID member penanggung jawab tugas'),
                        deadline: z.string().describe('Tenggat waktu dalam format YYYY-MM-DD'),
                        priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).describe('Tingkat prioritas'),
                        folder: z.string().optional().default('General').describe('Folder atau section tugas di project'),
                        memo: z.string().optional().describe('Deskripsi singkat atau memo instruksi tugas'),
                        startDate: z.string().optional().describe('Tanggal mulai format YYYY-MM-DD'),
                        todos: z.array(z.object({
                            title: z.string(),
                            done: z.boolean().optional().default(false),
                        })).optional().describe('Daftar checklist subtask'),
                    }),
                    execute: async (taskInput) => {
                        try {
                            const created = await createTaskForUser({
                                member,
                                accessibleProjects,
                                taskInput,
                            });
                            return {
                                ok: true,
                                message: `Tugas "${created.title}" berhasil dibuat di workspace "${created.projectName}".`,
                                task: created,
                            };
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    },
                }),

                update_task_status: tool({
                    description: 'Ubah status tugas dan tambahkan catatan perubahan status ke riwayat log tugas.',
                    inputSchema: z.object({
                        taskId: z.string().describe('ID tugas yang ingin diubah'),
                        status: z.enum(['To Do', 'In Progress', 'Pending Review', 'Done']).describe('Status baru tugas'),
                        note: z.string().optional().describe('Catatan perkembangan atau alasan perubahan status'),
                    }),
                    execute: async ({ taskId, status, note }) => {
                        try {
                            const updated = await updateTaskStatusForUser({
                                member,
                                accessibleProjects,
                                taskId,
                                status,
                                note,
                            });
                            return {
                                ok: true,
                                message: `Status tugas "${updated.title}" berhasil diubah menjadi "${updated.newStatus}".`,
                                task: updated,
                            };
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    },
                }),

                add_task_update_log: tool({
                    description: 'Tambahkan catatan update progres pada tugas tanpa mengubah status.',
                    inputSchema: z.object({
                        taskId: z.string().describe('ID tugas'),
                        content: z.string().describe('Catatan perkembangan / progres tugas'),
                    }),
                    execute: async ({ taskId, content }) => {
                        try {
                            const res = await addTaskUpdateLogForUser({
                                member,
                                accessibleProjects,
                                taskId,
                                content,
                            });
                            return {
                                ok: true,
                                message: `Catatan update berhasil ditambahkan pada tugas "${res.title}".`,
                                log: res.addedLog,
                            };
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    },
                }),

                attach_task_file: tool({
                    description: 'Lampirkan file dokumen / bukti penuntasan ke tugas.',
                    inputSchema: z.object({
                        taskId: z.string().describe('ID tugas'),
                        fileName: z.string().describe('Nama file dokumen/bukti'),
                        fileUrl: z.string().describe('URL atau tautan file dokumen'),
                        note: z.string().optional().describe('Keterangan lampiran berkas'),
                    }),
                    execute: async ({ taskId, fileName, fileUrl, note }) => {
                        try {
                            const res = await attachTaskFileForUser({
                                member,
                                accessibleProjects,
                                taskId,
                                fileName,
                                fileUrl,
                                note,
                            });
                            return {
                                ok: true,
                                message: `Berkas "${res.attachedFile.name}" berhasil dilampirkan ke tugas "${res.title}".`,
                                attachedFile: res.attachedFile,
                            };
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    },
                }),

                get_active_promos: tool({
                    description: 'Dapatkan data promo yang sedang aktif berjalan hari ini di semua outlet Beauty Kendari. Mendukung filter berdasarkan brand, cabang outlet, jenis promo (diskon, gwp/hadiah, voucher, potongan_harga), flash sale, atau pencarian bebas.',
                    inputSchema: z.object({
                        brand: z.string().optional().describe('Filter nama brand (misal: "WARDAH", "EMINA", "MAYBELLINE", "NIVEA", "AZARINE", "IMPLORA")'),
                        outlet: z.string().optional().describe('Filter cabang outlet (misal: "B2", "Beauty 2", "B11", "Online Store", atau "SEMUA")'),
                        jenisPromo: z.string().optional().describe('Jenis promo: diskon, gwp (hadiah), voucher, potongan_harga, dll.'),
                        search: z.string().optional().describe('Kata kunci pencarian bebas (nama promo, brand, produk, mekanisme)'),
                        flashSaleOnly: z.boolean().optional().describe('Filter hanya promo flash sale aktif'),
                        limit: z.number().optional().default(20).describe('Batas maksimal promo yang ditampilkan (default: 20)'),
                    }),
                    execute: async ({ brand, outlet, jenisPromo, search, flashSaleOnly, limit }) => {
                        try {
                            const res = await queryActivePromos({
                                brand,
                                outlet,
                                jenisPromo,
                                search,
                                flashSaleOnly,
                                limit: limit || 20,
                            });
                            return {
                                ok: true,
                                ...res,
                            };
                        } catch (err) {
                            return {
                                ok: false,
                                error: err.message || 'Gagal memuat data promo aktif outlet.',
                            };
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
                    description: 'Buat file nyata (PDF slide 16:9 eksekutif / PPTX presentasi / HTML web report / XLSX Excel / CSV) yang bisa langsung dibuka atau diunduh user. Wajib dipakai saat user meminta presentasi, laporan eksekutif dewan direksi, slide deck, atau rekap data.',
                    inputSchema: z.object({
                        format: z.enum(['pdf', 'pptx', 'html', 'xlsx', 'csv']).describe('Jenis file: "pdf" (DEFAULT dan WAJIB untuk slide presentasi 16:9 eksekutif / skill-persentasi / laporan direksi karena mendukung penuh efek Glassmorphism dan grafik SVG presisi), "pptx" (hanya jika user eksplisit meminta PowerPoint), "html" (web report interaktif), "xlsx" (excel), atau "csv".'),
                        fileName: z.string().max(80).optional().describe('Nama file tanpa ekstensi, mis. evaluasi-trafik-jam-toko-bt26.'),
                        title: z.string().max(160).optional().describe('Judul utama dokumen/laporan, dipakai sebagai judul cover.'),
                        /* Mode A: rawHtml standalone jika ingin kontrol visual penuh (16:9, Glassmorphism, SVG inline) */
                        rawHtml: z.string().optional().describe('Kode HTML lengkap 16:9 standalone jika AI ingin membuat presentasi visual kustom penuh dengan Glassmorphism, CSS, dan SVG dinamis (identik dengan standar skill-persentasi). Sangat disarankan untuk deck visual berkualitas tinggi.'),
                        /* Mode B: PPTX / PDF / HTML: daftar slide terstruktur */
                        slides: z.array(z.object({
                            title: z.string().max(160).describe('So What Title: Kesimpulan bisnis asertif (maks 2 baris, <= 80 karakter per baris, tanpa titik di akhir).'),
                            subtitle: z.string().max(250).optional().describe('Konteks tambahan, periode, atau cabang.'),
                            category: z.string().max(80).optional().describe('Kategori slide, mis. EXECUTIVE SUMMARY, DISTRIBUSI TRAFIK, ANALISIS MARGIN, ACTION PLAN.'),
                            layout: z.enum(['cover', 'split', 'full', 'timeline', 'closing']).optional().describe('Tata letak slide.'),
                            chartType: z.enum(['hourly_traffic', 'margin_zero_baseline', 'segmented_bar', 'gantt_shift', 'bar_chart', 'column_chart', 'none']).optional().describe('Jenis diagram SVG visual.'),
                            chartData: z.any().optional().describe('Data untuk grafik SVG.'),
                            chartTitle: z.string().max(120).optional().describe('Judul grafik SVG.'),
                            chartBadge: z.string().max(80).optional().describe('Pill badge penjelas grafik.'),
                            chartFootnote: z.string().max(150).optional().describe('Catatan kaki penjelas metrik grafik.'),
                            metrics: z.array(z.object({
                                label: z.string(),
                                value: z.string(),
                                sub: z.string().optional(),
                                tint: z.enum(['tint-pink', 'tint-lavender', 'tint-sky', 'tint-peach', 'tint-mint', 'tint-rose', 'tint-amber', 'tint-slate']).optional(),
                            })).max(6).optional().describe('Kartu metrik kunci / chip KPI.'),
                            text: z.string().max(1500).optional(),
                            bullets: z.array(z.string().max(400)).max(12).optional().describe('Poin insight / analisis bisnis / rekomendasi aksi.'),
                            table: z.array(z.array(z.string()).max(12)).max(30).optional().describe('Matriks tabel data (baris 1 = header).'),
                        })).max(20).optional().describe('Daftar slide presentasi 16:9 eksekutif.'),
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
            headers: CORS_HEADERS,
            onError: (err) => String(err?.message || err),
        });
    } catch (error) {
        console.error('Chat API Error:', error);
        return Response.json(
            { error: error.message || 'Terjadi kesalahan saat memproses chat.' },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}
