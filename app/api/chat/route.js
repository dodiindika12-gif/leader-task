import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

let bigqueryClient = null;

function getBigQueryClient() {
    if (bigqueryClient) return bigqueryClient;

    const credentialPath = process.env.BIGQUERY_SERVICE_ACCOUNT_PATH || '/home/dodi/Migrasi_Data/service-account.json';

    if (!fs.existsSync(credentialPath)) {
        throw new Error(`Service account BigQuery tidak ditemukan di: ${credentialPath}`);
    }

    // Lazy import agar dev tanpa kredensial tetap jalan sampai fitur dipakai
    
    const { BigQuery } = require('@google-cloud/bigquery');
    bigqueryClient = new BigQuery({
        keyFilename: credentialPath,
    });
    return bigqueryClient;
}

async function runBigQueryQuery(sql) {
    const client = getBigQueryClient();
    const [job] = await client.createQueryJob({ query: sql });
    const [rows] = await job.getQueryResults();
    return rows;
}

/**
 * Cek apakah model membalas dengan file/gambar terkompilasi.
 * Model hanya menerima teks: instruksi agar menandai file dengan marker khusus
 * diterjemahkan client menjadi tautan unduh.
 */
function systemPrompt() {
    return [
        'Anda asisten data yang terhubung ke Google BigQuery.',
        'Gunakan tool run_bigquery_query untuk menjawab pertanyaan tentang data.',
        'Aturan tool:',
        '- Selalu tulis SQL standar BigQuery.',
        '- Untuk eksplorasi, daftar dataset/tabel dulu sebelum query besar.',
        '- LIMIT wajib ada pada query SELECT (maksimal 1000 baris).',
        'Jika user meminta file hasil (CSV dan sejenisnya), tulis tabel dalam Markdown dan akhiri dengan baris:',
        '[FILE_CSV] nama-file.csv',
        'Client akan mengubah penanda itu menjadi tombol unduh CSV berisi hasil query terakhir.',
    ].join('\n');
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
            stopWhen: stepCountIs(8),
            tools: {
                run_bigquery_query: tool({
                    description: 'Jalankan query SQL ke Google BigQuery dan kembalikan hasilnya sebagai baris data.',
                    inputSchema: z.object({
                        sql: z.string().describe('Query SQL standar BigQuery yang akan dijalankan. SELECT wajib memakai LIMIT.'),
                    }),
                    execute: async ({ sql }) => {
                        try {
                            const rows = await runBigQueryQuery(sql);
                            return { ok: true, rowCount: rows.length, rows: rows.slice(0, 500) };
                        } catch (err) {
                            return { ok: false, error: String(err.message || err) };
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
