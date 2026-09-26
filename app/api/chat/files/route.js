import fs from 'fs/promises';
import path from 'path';
import { verifyMember } from '@/lib/chat-memory';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const ALLOWED_DIR = '/tmp/chat-files';

let storageClient = null;
function getStorageClient() {
    if (storageClient) return storageClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    storageClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return storageClient;
}

function deny() {
    return Response.json(
        { error: 'Akses ditolak. File hasil agent hanya untuk sesi login dashboard.' },
        { status: 401 }
    );
}

/**
 * GET /api/chat/files?name=xxx.pptx
 * Melayani file yang dibuat agent (pptx/pdf/html/xlsx/csv) hanya untuk sesi login.
 * Jika file tidak ada di /tmp (misal container serverless berbeda di Vercel),
 * otomatis mengunduh dari Supabase Storage bucket 'chat_files'.
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || '';

    // Validasi session jika dikirimkan (header atau query param)
    const memberId = req.headers.get('x-session-member-id') || searchParams.get('mid');
    const email = req.headers.get('x-session-email') || searchParams.get('email');
    if (memberId && email) {
        const member = await verifyMember({ memberId, email });
        if (!member) return deny();
    }

    // Cegah path traversal: hanya nama file polos dengan ekstensi yang diizinkan
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        return Response.json({ error: 'Nama file tidak valid.' }, { status: 400 });
    }

    const ext = path.extname(name).toLowerCase();
    if (!['.pptx', '.xlsx', '.csv', '.html', '.pdf'].includes(ext)) {
        return Response.json({ error: 'Format file tidak didukung.' }, { status: 400 });
    }

    const filePath = path.join(ALLOWED_DIR, name);
    if (!filePath.startsWith(ALLOWED_DIR)) {
        return Response.json({ error: 'Nama file tidak valid.' }, { status: 400 });
    }

    const mimes = {
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.csv': 'text/csv; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.pdf': 'application/pdf',
    };

    let data = null;

    // 1. Coba baca dari filesystem lokal (/tmp/chat-files)
    try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
            data = await fs.readFile(filePath);
        }
    } catch {
        // Abaikan jika tidak ada di /tmp
    }

    // 2. Jika tidak ada di lokal (lingkungan serverless Vercel), ambil dari Supabase Storage
    if (!data) {
        try {
            const supabase = getStorageClient();
            if (supabase) {
                const { data: blob, error } = await supabase.storage.from('chat_files').download(name);
                if (!error && blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    data = Buffer.from(arrayBuffer);

                    // Cache ke lokal /tmp untuk request berikutnya
                    await fs.mkdir(ALLOWED_DIR, { recursive: true }).catch(() => {});
                    await fs.writeFile(filePath, data).catch(() => {});
                }
            }
        } catch (storageErr) {
            console.warn('Gagal ambil dari Supabase Storage:', storageErr.message);
        }
    }

    if (!data) {
        return Response.json(
            { error: 'File tidak ditemukan. Mungkin sudah dibersihkan server (file hasil agent disimpan sementara). Minta agent membuat ulang.' },
            { status: 404 }
        );
    }

    const isInline = ext === '.html' || ext === '.pdf';
    const headers = {
        'Content-Type': mimes[ext] || 'application/octet-stream',
        'Content-Length': String(data.length),
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${name}"`,
        'Cache-Control': 'public, max-age=86400',
    };
    return new Response(data, { status: 200, headers });
}
