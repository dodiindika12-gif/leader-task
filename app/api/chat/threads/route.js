import { verifyMember } from '@/lib/chat-memory';
import { listUserThreads, saveUserThread } from '@/lib/chat-threads';

export async function GET(req) {
    try {
        const memberId = req.headers.get('x-session-member-id');
        const email = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email });

        if (!member) {
            return Response.json({ error: 'Sesi tidak valid atau telah berakhir.' }, { status: 401 });
        }

        const threads = await listUserThreads(member.id);
        return Response.json({ ok: true, threads });
    } catch (err) {
        if (err.code === 'TABLE_NOT_FOUND') {
            return Response.json({
                ok: false,
                code: 'TABLE_NOT_FOUND',
                error: 'Tabel task_leader.chat_threads belum dibuat di database Supabase.',
                threads: [],
            }, { status: 200 }); // Return status 200 with code so frontend can fallback gracefully to local storage
        }
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const memberId = req.headers.get('x-session-member-id');
        const email = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email });

        if (!member) {
            return Response.json({ error: 'Sesi tidak valid.' }, { status: 401 });
        }

        const body = await req.json();
        const { id, title, messages } = body;

        const saved = await saveUserThread({
            id,
            memberId: member.id,
            title,
            messages,
        });

        return Response.json({ ok: true, thread: saved });
    } catch (err) {
        if (err.code === 'TABLE_NOT_FOUND') {
            return Response.json({
                ok: false,
                code: 'TABLE_NOT_FOUND',
                error: 'Tabel belum ada di Supabase, silakan jalankan sql/create_chat_threads.sql',
            }, { status: 200 });
        }
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}
