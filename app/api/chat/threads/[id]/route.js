import { verifyMember } from '@/lib/chat-memory';
import { getUserThread, deleteUserThread } from '@/lib/chat-threads';

export const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-member-id, x-session-email, x-api-key, x-endpoint-url, x-model-name',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const memberId = req.headers.get('x-session-member-id');
        const email = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email });

        if (!member) {
            return Response.json({ error: 'Sesi tidak valid.' }, { status: 401, headers: CORS_HEADERS });
        }

        if (member.role === 'Staff') {
            return Response.json({ error: 'Akses Chat Bebie hanya untuk tingkatan Leader.' }, { status: 403, headers: CORS_HEADERS });
        }

        const thread = await getUserThread(id, member.id);
        if (!thread) {
            return Response.json({ error: 'Percakapan tidak ditemukan atau sudah kadaluarsa (> 30 hari).' }, { status: 404, headers: CORS_HEADERS });
        }

        return Response.json({ ok: true, thread }, { headers: CORS_HEADERS });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const memberId = req.headers.get('x-session-member-id');
        const email = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email });

        if (!member) {
            return Response.json({ error: 'Sesi tidak valid.' }, { status: 401, headers: CORS_HEADERS });
        }

        if (member.role === 'Staff') {
            return Response.json({ error: 'Akses Chat Bebie hanya untuk tingkatan Leader.' }, { status: 403, headers: CORS_HEADERS });
        }

        const deleted = await deleteUserThread(id, member.id);
        return Response.json({ ok: true, deleted }, { headers: CORS_HEADERS });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
}

