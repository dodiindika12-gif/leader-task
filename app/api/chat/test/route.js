import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import fs from 'fs';

export const maxDuration = 30;

async function testProvider({ apiKey, baseURL, model }) {
    if (!apiKey) {
        return { ok: false, error: 'API Key belum diisi.' };
    }

    const started = Date.now();
    try {
        const provider = createOpenAI({ apiKey, baseURL });
        const result = await generateText({
            model: provider.chat(model || 'default'),
            prompt: 'Balas dengan satu kata: siap',
            maxOutputTokens: 20,
        });
        return {
            ok: true,
            latencyMs: Date.now() - started,
            model: model || 'default',
            sampleReply: (result.text || '').trim().slice(0, 80),
        };
    } catch (err) {
        return {
            ok: false,
            latencyMs: Date.now() - started,
            error: String(err?.message || err).slice(0, 300),
        };
    }
}

async function testBigQuery() {
    const started = Date.now();
    try {
        const credentialPath = process.env.BIGQUERY_SERVICE_ACCOUNT_PATH || '/home/dodi/Migrasi_Data/service-account.json';
        if (!fs.existsSync(credentialPath)) {
            return { ok: false, latencyMs: Date.now() - started, error: `File service account tidak ditemukan: ${credentialPath}` };
        }

        const { BigQuery } = await import('@google-cloud/bigquery');
        const client = new BigQuery({ keyFilename: credentialPath });

        const [project] = await client.getProjectId();
        const [datasets] = await client.getDatasets({ maxResults: 5 });

        return {
            ok: true,
            latencyMs: Date.now() - started,
            project: project,
            datasetCount: datasets.length,
            datasets: datasets.slice(0, 5).map((d) => d.id),
        };
    } catch (err) {
        return {
            ok: false,
            latencyMs: Date.now() - started,
            error: String(err?.message || err).slice(0, 300),
        };
    }
}

export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const apiKey = body.apiKey || req.headers.get('x-api-key') || process.env.HERMES_API_KEY;
        const baseURL = body.baseURL || req.headers.get('x-endpoint-url') || process.env.NEXT_PUBLIC_HERMES_URL || 'https://hermes.absgroup.biz.id';
        const model = body.model || req.headers.get('x-model-name') || 'default';
        const target = body.target || 'provider';

        if (target === 'bigquery') {
            const result = await testBigQuery();
            return Response.json({ target, ...result });
        }

        const result = await testProvider({ apiKey, baseURL, model });
        return Response.json({ target: 'provider', ...result });
    } catch (error) {
        return Response.json({ ok: false, error: error.message || 'Test gagal.' }, { status: 500 });
    }
}
