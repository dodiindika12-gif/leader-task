import {
    verifyMember,
    listSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    reviewSkillVersion,
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

const isExecRole = (role) => ['Super User', 'Direksi'].includes(role);

export async function GET(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const skills = await listSkills({ withPending: true });
        return Response.json({ skills, canManageAll: isExecRole(member.role) });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const body = await req.json();
        if (!isExecRole(member.role)) {
            return Response.json({ error: 'Hanya Super User/Direksi yang boleh membuat skill.' }, { status: 403 });
        }
        if (!body.slug || !body.content) {
            return Response.json({ error: 'slug dan content wajib diisi.' }, { status: 400 });
        }
        const skill = await createSkill({
            slug: body.slug,
            name: body.name,
            description: body.description,
            content: body.content,
            createdBy: member.id,
        });
        return Response.json({ skill });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        const body = await req.json();

        // Review versi pending
        if (body.versionId && body.action) {
            if (!isExecRole(member.role) && body.action === 'apply') {
                return Response.json({ error: 'Hanya Super User/Direksi yang bisa menerapkan versi skill.' }, { status: 403 });
            }
            const result = await reviewSkillVersion({
                versionId: body.versionId,
                action: body.action === 'apply' ? 'apply' : 'reject',
                reviewedBy: member.id,
            });
            return Response.json(result);
        }

        if (!body.id) return Response.json({ error: 'id wajib.' }, { status: 400 });
        const updated = await updateSkill({
            id: body.id,
            is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
            auto_refine: typeof body.auto_refine === 'boolean' ? body.auto_refine : undefined,
            always_loaded: typeof body.always_loaded === 'boolean' ? body.always_loaded : undefined,
        });
        return Response.json({ skill: updated });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    const member = await requireMember(req);
    if (!member) return deny();

    try {
        if (!isExecRole(member.role)) {
            return Response.json({ error: 'Hanya Super User/Direksi yang boleh menghapus skill.' }, { status: 403 });
        }
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return Response.json({ error: 'id wajib.' }, { status: 400 });
        await deleteSkill(id);
        return Response.json({ ok: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
