import {
    verifyMember,
    listMemories,
    updateMemory,
    deleteMemory,
} from '@/lib/chat-memory';

export const maxDuration = 30;

async function requireMember(req) {
    const memberId = req.headers.get('x-session-member-id');
    const email = req.headers.get('x-session-email');
    const member = await verifyMember({ memberId, email });
    if (!member) return null;
    return member;
}

function deny() {
    return Response.json(
        { ok: false, error: 'Akses ditolak. Chat Data hanya bisa dipakai dengan login dashboard aktif.' },
        { status: 401 }
    );
}

export async function DELETE(req, { params }) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const resolvedParams = await params;
        const id = resolvedParams?.id;
        if (!id) return Response.json({ ok: false, error: 'id wajib.' }, { status: 400 });

        const existing = await listMemories({ scope: 'all', memberId: member.id });
        const target = (existing || []).find((m) => m.id === id);
        if (!target) {
            return Response.json({ ok: false, error: 'Memori tidak ditemukan atau bukan milik Anda.' }, { status: 404 });
        }
        const isExec = ['Super User', 'Direksi'].includes(member.role);
        if (target.scope === 'global' && !isExec) {
            return Response.json({ ok: false, error: 'Memori global hanya bisa dihapus Super User/Direksi.' }, { status: 403 });
        }

        await deleteMemory(id);
        return Response.json({ ok: true });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const resolvedParams = await params;
        const id = resolvedParams?.id;
        if (!id) return Response.json({ ok: false, error: 'id wajib.' }, { status: 400 });

        const existing = await listMemories({ scope: 'all', memberId: member.id });
        const target = (existing || []).find((m) => m.id === id);
        if (!target) {
            return Response.json({ ok: false, error: 'Memori tidak ditemukan atau bukan milik Anda.' }, { status: 404 });
        }
        const isExec = ['Super User', 'Direksi'].includes(member.role);
        if (target.scope === 'global' && !isExec) {
            return Response.json({ ok: false, error: 'Memori global hanya bisa diubah Super User/Direksi.' }, { status: 403 });
        }

        const body = await req.json();
        const updated = await updateMemory({
            id,
            is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
            content: typeof body.content === 'string' ? body.content : undefined,
        });
        return Response.json({ ok: true, memory: updated });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}
