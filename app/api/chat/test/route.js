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

import { testBigQueryConnection } from '@/lib/bigquery';
import { verifyMember } from '@/lib/chat-memory';

export async function POST(req) {
    try {
        // ===== Auth wajib: session dashboard =====
        const memberId = req.headers.get('x-session-member-id');
        const memberEmail = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email: memberEmail });
        if (!member) {
            return Response.json(
                { ok: false, error: 'Akses ditolak: Anda harus login ke dashboard terlebih dahulu.' },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const apiKey = body.apiKey || req.headers.get('x-api-key') || process.env.HERMES_API_KEY;
        const baseURL = body.baseURL || req.headers.get('x-endpoint-url') || process.env.NEXT_PUBLIC_HERMES_URL || 'https://hermes.absgroup.biz.id';
        const model = body.model || req.headers.get('x-model-name') || 'default';
        const target = body.target || 'provider';

        if (target === 'bigquery') {
            const result = await testBigQueryConnection();
            return Response.json({ target, ...result });
        }

        const result = await testProvider({ apiKey, baseURL, model });
        return Response.json({ target: 'provider', ...result });
    } catch (error) {
        return Response.json({ ok: false, error: error.message || 'Test gagal.' }, { status: 500 });
    }
}
