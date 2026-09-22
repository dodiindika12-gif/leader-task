import {
    verifyMember,
    listMemories,
    createMemory,
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
        { error: 'Akses ditolak. Chat Data hanya bisa dipakai dengan login dashboard aktif.' },
        { status: 401 }
    );
}

export async function GET(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'all';
    try {
        const memories = await listMemories({ scope, memberId: member.id });
        return Response.json({ memories });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const body = await req.json();
        const content = String(body.content || '').trim();
        if (!content) {
            return Response.json({ error: 'Isi memori tidak boleh kosong.' }, { status: 400 });
        }
        const targetScope = body.scope === 'user' ? 'user' : 'global';
        const isExec = ['Super User', 'Direksi'].includes(member.role);
        if (targetScope === 'global' && !isExec) {
            return Response.json(
                { error: 'Hanya Super User/Direksi yang boleh menulis memori global.' },
                { status: 403 }
            );
        }
        const memory = await createMemory({
            scope: targetScope,
            memberId: member.id,
            content,
            source: 'manual',
            createdBy: member.id,
            confidence: Math.min(Math.max(parseInt(body.confidence, 10) || 5, 1), 10),
        });
        return Response.json({ memory });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const body = await req.json();
        if (!body.id) return Response.json({ error: 'id wajib.' }, { status: 400 });

        const { data: existing } = await import('@/lib/chat-memory').then((m) =>
            m.listMemories({ scope: 'all', memberId: member.id })
        );
        const target = (existing || []).find((m) => m.id === body.id);
        if (!target) {
            return Response.json({ error: 'Memori tidak ditemukan atau bukan milik Anda.' }, { status: 404 });
        }
        const isExec = ['Super User', 'Direksi'].includes(member.role);
        if (target.scope === 'global' && !isExec) {
            return Response.json({ error: 'Memori global hanya bisa diubah Super User/Direksi.' }, { status: 403 });
        }

        const updated = await updateMemory({
            id: body.id,
            is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
            content: typeof body.content === 'string' ? body.content : undefined,
        });
        return Response.json({ memory: updated });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return Response.json({ error: 'id wajib.' }, { status: 400 });

        const { listMemories: lm } = await import('@/lib/chat-memory');
        const existing = await lm({ scope: 'all', memberId: member.id });
        const target = (existing || []).find((m) => m.id === id);
        if (!target) {
            return Response.json({ error: 'Memori tidak ditemukan atau bukan milik Anda.' }, { status: 404 });
        }
        const isExec = ['Super User', 'Direksi'].includes(member.role);
        if (target.scope === 'global' && !isExec) {
            return Response.json({ error: 'Memori global hanya bisa dihapus Super User/Direksi.' }, { status: 403 });
        }

        await deleteMemory(id);
        return Response.json({ ok: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
