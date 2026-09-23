import {
    verifyMember,
    isDireksiOrSuperuser,
    getGlobalProviderSettings,
    saveGlobalProviderSettings,
} from '@/lib/chat-memory';

export const maxDuration = 30;

export async function GET(req) {
    try {
        const memberId = req.headers.get('x-session-member-id');
        const memberEmail = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email: memberEmail });

        const canEdit = member ? isDireksiOrSuperuser(member.role) : false;
        const globalCfg = await getGlobalProviderSettings();

        const hasApiKey = !!globalCfg.apiKey;
        // Hanya Direksi/Superuser yang bisa melihat atau menerima token aslinya
        const apiKey = canEdit
            ? globalCfg.apiKey
            : (hasApiKey ? '••••••••••••••••••••••••••••••••••••' : '');

        return Response.json({
            ok: true,
            baseURL: globalCfg.baseURL,
            apiKey,
            model: globalCfg.model,
            hasApiKey,
            canEdit,
            userRole: member?.role || null,
            userName: member?.name || null,
            updatedAt: globalCfg.updatedAt,
            updatedBy: globalCfg.updatedBy,
        });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const memberId = req.headers.get('x-session-member-id');
        const memberEmail = req.headers.get('x-session-email');
        const member = await verifyMember({ memberId, email: memberEmail });

        if (!member) {
            return Response.json(
                { ok: false, error: 'Akses ditolak: Anda harus login ke dashboard terlebih dahulu.' },
                { status: 401 }
            );
        }

        if (!isDireksiOrSuperuser(member.role)) {
            return Response.json(
                { ok: false, error: 'Akses ditolak: Hanya level Direksi atau Super User yang dapat mengubah pengaturan provider global.' },
                { status: 403 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const { baseURL, apiKey, model } = body;

        const updated = await saveGlobalProviderSettings({
            baseURL,
            apiKey,
            model,
            memberId: member.id,
            memberName: member.name,
        });

        return Response.json({
            ok: true,
            message: 'Pengaturan provider global berhasil disimpan dan berlaku untuk semua pengguna.',
            settings: updated,
        });
    } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
}
