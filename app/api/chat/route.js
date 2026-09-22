import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import { z } from 'zod';
import fs from 'fs';

export const maxDuration = 60;

let bigqueryClient = null;

function getBigQueryClient() {
    if (bigqueryClient) return bigqueryClient;

    const credentialPath = process.env.BIGQUERY_SERVICE_ACCOUNT_PATH || '/home/dodi/Migrasi_Data/service-account.json';

    if (!fs.existsSync(credentialPath)) {
        throw new Error(`Service account BigQuery tidak ditemukan di: ${credentialPath}`);
    }

    // Lazy import agar server tetap start walau paket/kredensial bermasalah sampai fitur dipakai
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

function loadBigQueryGuide() {
    try {
         
        return fs.readFileSync(process.cwd() + '/lib/guides/gcp-bigquery-guide.md', 'utf-8');
    } catch {
        return '';
    }
}

function systemPrompt() {
    const guide = loadBigQueryGuide();
    return [
        'Anda asisten data ABS Group (Busana) yang terhubung ke Google BigQuery.',
        'Waktu user: WITA (GMT+8). Tanggal hari ini ada di pertanyaan/konteks; jika tidak ada, gunakan tanggal server dikurangi 8 jam.',
        '',
        '== CARA KERJA ==',
        '1. Gunakan tool run_bigquery_query untuk semua pertanyaan data. Jangan menebak angka.',
        '2. Baca panduan BigQuery di bawah SEBELUM menulis query. Panduan itu berisi skema tabel, jebakan teknis, template query, dan preferensi format user.',
        '3. Saat pertanyaan ambigu (brand vs outlet, kategori vs pareto), periksa dulu lewat query kecil atau tanya user.',
        '',
        '== ATURAN TOOL ==',
        '- SQL standar BigQuery (useLegacySql false). Nama tabel selalu fully-qualified dengan backtick.',
        '- SELECT wajib memakai LIMIT (maks 1000 baris) kecuali itu agregasi yang sudah dikelompokkan.',
        '- Kolom HPP di tabel transaksi adalah HPP PER UNIT: total modal selalu SUM(HPP * Qty).',
        '- Proyek ini TANPA billing: hanya SELECT/LOAD yang diizinkan. Jangan pernah menulis TRUNCATE/DELETE/UPDATE/MERGE/CREATE OR REPLACE.',
        '- Jangan JOIN lintas dataset Laporan_Penjualan_detail dan Master_Data (beda region). Query terpisah lalu gabungkan manual di jawaban.',
        '',
        '== FORMAT JAWABAN ==',
        '- Jawab dalam Bahasa Indonesia, ringkas dan langsung ke data.',
        '- Sajikan hasil sebagai tabel Markdown. Angka Rupiah penuh, jangan disingkat (Rp 1.952.426.393, bukan Rp 1,9 jt).',
        '- Tampilkan SEMUA baris hasil yang relevan, jangan memotong, kecuali user meminta ringkasan.',
        '- Laporan penjualan selalu sertakan MoM, YoY, dan pencapaian target bila datanya ada; akhiri dengan Action Plan singkat.',
        '- Indikator capaian: 100% ke atas tercapai, 95-99.99% hampir, di bawah 95% belum capai.',
        '- Data apa adanya dari database: jangan merevisi atau menafsirkan ulang angka.',
        '',
        '== FILE HASIL ==',
        'Jika user meminta file/CSV/Excel hasil query: tulis tabel Markdown lengkap, lalu akhiri jawaban dengan baris berikut:',
        '[FILE_CSV] nama-file.csv',
        'Client mengubah penanda itu menjadi tombol unduh CSV. Nama file memakai kata kunci yang relevan (contoh: penjualan-agustus-2026.csv).',
        '',
        (guide ? ('== PANDUAN BIGQUERY ABS GROUP (FONT OF TRUTH) ==\n\n' + guide) : ''),
    ].join('\n');
}

// Guard sederhana: tolak skrip DML/DDL yang akan gagal karena billing, dan paksa LIMIT
function validateSql(sql) {
    const normalized = sql.trim().replace(/;+\s*$/, '');
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
    const hasAggregate = /\b(SUM|COUNT|AVG|MIN|MAX|COUNTDISTINCT)\s*\(/i.test(normalized) && /\bGROUP\s+BY\b/i.test(normalized);
    if (!hasLimit && !hasAggregate) {
        return { ok: false, error: 'SELECT tanpa agregasi wajib memakai LIMIT (maks 1000). Tambahkan LIMIT lalu ulangi.' };
    }
    const limitMatch = normalized.match(/\bLIMIT\s+(\d+)\b/i);
    if (limitMatch && parseInt(limitMatch[1], 10) > 1000) {
        return { ok: false, error: 'LIMIT melebihi 1000 baris. Kecilkan LIMIT-nya.' };
    }
    return { ok: true, sql: normalized + (/[;]$/i.test(normalized) ? '' : '') };
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { messages } = body;

        const apiKey = req.headers.get('x-api-key') || process.env.HERMES_API_KEY;
        const baseURL = req.headers.get('x-endpoint-url') || process.env.NEXT_PUBLIC_HERMES_URL || 'https://hermes.absgroup.biz.id';
        const modelName = req.headers.get('x-model-name') || 'default';

        if (!apiKey) {
            return Response.json(
                { error: 'API Key belum diisi. Buka pengaturan chat untuk mengisinya.' },
                { status: 400 }
            );
        }

        const customProvider = createOpenAI({
            apiKey,
            baseURL,
        });

        const modelMessages = await convertToModelMessages(messages);

        const result = streamText({
            model: customProvider.chat(modelName),
            system: systemPrompt(),
            messages: modelMessages,
            stopWhen: stepCountIs(10),
            tools: {
                run_bigquery_query: tool({
                    description: 'Jalankan query SELECT SQL ke Google BigQuery ABS Group dan kembalikan hasilnya sebagai baris data.',
                    inputSchema: z.object({
                        sql: z.string().describe('Query SQL BigQuery. SELECT harus memakai LIMIT kecuali query agregasi, maksimal 1000 baris. Nama tabel fully-qualified dengan backtick.'),
                    }),
                    execute: async ({ sql }) => {
                        const check = validateSql(sql);
                        if (!check.ok) {
                            return { ok: false, error: check.error };
                        }
                        try {
                            const rows = await runBigQueryQuery(check.sql);
                            return { ok: true, rowCount: rows.length, rows: rows.slice(0, 500) };
                        } catch (err) {
                            return { ok: false, error: String(err.message || err).slice(0, 500) };
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
