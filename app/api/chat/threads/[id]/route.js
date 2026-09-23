import { verifyMember } from '@/lib/chat-memory';
import { getUserThread, deleteUserThread } from '@/lib/chat-threads';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const memberId = req.headers.get('x-session-member-id');
        const email = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email });

        if (!member) {
            return Response.json({ error: 'Sesi tidak valid.' }, { status: 401 });
        }

        const thread = await getUserThread(id, member.id);
        if (!thread) {
            return Response.json({ error: 'Percakapan tidak ditemukan atau sudah kadaluarsa (> 30 hari).' }, { status: 404 });
        }

        return Response.json({ ok: true, thread });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const memberId = req.headers.get('x-session-member-id');
        const email = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email });

        if (!member) {
            return Response.json({ error: 'Sesi tidak valid.' }, { status: 401 });
        }

        const deleted = await deleteUserThread(id, member.id);
        return Response.json({ ok: true, deleted });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}
