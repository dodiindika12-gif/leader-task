import fs from 'fs/promises';
import path from 'path';
import { verifyMember } from '@/lib/chat-memory';

export const maxDuration = 30;

const ALLOWED_DIR = '/tmp/chat-files';

function deny() {
    return Response.json(
        { error: 'Akses ditolak. File hasil agent hanya untuk sesi login dashboard.' },
        { status: 401 }
    );
}

/**
 * GET /api/chat/files?name=xxx.pptx
 * Melayani file yang dibuat agent (pptx/xlsx/csv) hanya untuk sesi login.
 */
export async function GET(req) {
    const memberId = req.headers.get('x-session-member-id');
    const email = req.headers.get('x-session-email');
    const member = await verifyMember({ memberId, email });
    if (!member) return deny();

    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || '';
    // Cegah path traversal: hanya nama file polos
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        return Response.json({ error: 'Nama file tidak valid.' }, { status: 400 });
    }

    const filePath = path.join(ALLOWED_DIR, name);
    if (!filePath.startsWith(ALLOWED_DIR)) {
        return Response.json({ error: 'Nama file tidak valid.' }, { status: 400 });
    }

    try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error('not a file');
        const data = await fs.readFile(filePath);

        const ext = path.extname(name).toLowerCase();
        const mimes = {
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.csv': 'text/csv; charset=utf-8',
        };

        const headers = {
            'Content-Type': mimes[ext] || 'application/octet-stream',
            'Content-Length': String(data.length),
            'Content-Disposition': `attachment; filename="${name}"`,
            'Cache-Control': 'private, max-age=300',
        };
        return new Response(data, { status: 200, headers });
    } catch {
        return Response.json(
            { error: 'File tidak ditemukan. Mungkin sudah dibersihkan server (file hasil agent disimpan sementara). Minta agent membuat ulang.' },
            { status: 404 }
        );
    }
}
