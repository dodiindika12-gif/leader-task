import { createClient } from '@supabase/supabase-js';

/**
 * Server-side helpers untuk memori & skill agent chat.
 * Semua operasi memakai SUPABASE_SERVICE_ROLE_KEY (server only).
 */

let serviceClient = null;

function getServiceClient() {
    if (serviceClient) return serviceClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Konfigurasi Supabase service role tidak lengkap di server.');
    }
    serviceClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: 'task_leader' },
        global: {
            headers: { 'Accept-Profile': 'task_leader' },
        },
    });
    return serviceClient;
}

/**
 * Verifikasi session dashboard: memberId + email harus cocok dengan satu member aktif.
 * Mengembalikan row member atau null.
 */
export async function verifyMember({ memberId, email }) {
    if (!memberId || !email) return null;
    const client = getServiceClient();
    const cleanId = String(memberId).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    const isSuper = cleanId === 'superadmin' || cleanEmail === 'abskdi.markom@gmail.com';

    let query = client
        .from('members')
        .select('id, name, email, role, division, is_active, can_access_bigquery');

    if (isSuper) {
        query = query.ilike('email', 'abskdi.markom@gmail.com');
    } else {
        query = query.eq('id', cleanId).ilike('email', cleanEmail);
    }

    let { data, error } = await query.maybeSingle();

    if (error && (error.code === '42703' || (error.message && error.message.includes('can_access_bigquery')))) {
        // Fallback jika migrasi kolom can_access_bigquery belum dieksekusi di Supabase
        let retryQuery = client
            .from('members')
            .select('id, name, email, role, division, is_active');
        if (isSuper) {
            retryQuery = retryQuery.ilike('email', 'abskdi.markom@gmail.com');
        } else {
            retryQuery = retryQuery.eq('id', cleanId).ilike('email', cleanEmail);
        }
        const retry = await retryQuery.maybeSingle();
        data = retry.data;
        error = retry.error;
    }

    if (error) return null;
    if (!data || data.is_active === false) return null;
    return data;
}

// ============================== MEMORI ==============================

export async function listMemories({ scope, memberId }) {
    const client = getServiceClient();
    let query = client
        .from('chat_memories')
        .select('id, scope, member_id, content, source, confidence, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

    if (scope === 'global') {
        query = query.eq('scope', 'global');
    } else if (scope === 'user' && memberId) {
        query = query.eq('scope', 'user').eq('member_id', memberId);
    } else if (memberId) {
        // semua memori yang relevan untuk user ini
        query = query.or(`scope.eq.global,and(scope.eq.user,member_id.eq.${memberId})`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function activeMemoriesForPrompt({ memberId }) {
    const client = getServiceClient();
    const { data, error } = await client
        .from('chat_memories')
        .select('scope, content, confidence')
        .eq('is_active', true)
        .or(memberId ? `scope.eq.global,and(scope.eq.user,member_id.eq.${memberId})` : 'scope.eq.global')
        .order('confidence', { ascending: false })
        .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createMemory({ scope, memberId, content, source = 'manual', createdBy, confidence = 5 }) {
    const client = getServiceClient();
    const { data, error } = await client
        .from('chat_memories')
        .insert({
            scope,
            member_id: scope === 'user' ? memberId : null,
            content: content.trim().slice(0, 2000),
            source,
            confidence,
            created_by: createdBy || null,
        })
        .select('id, scope, content, source, created_at')
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateMemory({ id, is_active, content }) {
    const client = getServiceClient();
    const patch = {};
    if (typeof is_active === 'boolean') patch.is_active = is_active;
    if (typeof content === 'string' && content.trim()) patch.content = content.trim().slice(0, 2000);
    const { data, error } = await client
        .from('chat_memories')
        .update(patch)
        .eq('id', id)
        .select('id, is_active, content')
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMemory(id) {
    const client = getServiceClient();
    const { error } = await client.from('chat_memories').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
}

// ============================== SKILL ==============================

export async function listSkills({ withPending = false }) {
    const client = getServiceClient();
    const { data, error } = await client
        .from('chat_skills')
        .select('*')
        .neq('slug', 'system-provider-config')
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    const skills = data || [];
    if (withPending && skills.length > 0) {
        const ids = skills.map((s) => s.id);
        const { data: versions } = await client
            .from('chat_skill_versions')
            .select('id, skill_id, version, content, reason, status, created_at')
            .in('skill_id', ids)
            .order('version', { ascending: false })
            .limit(300);
        const pendingBySkill = {};
        const historyBySkill = {};
        (versions || []).forEach((v) => {
            (historyBySkill[v.skill_id] = historyBySkill[v.skill_id] || []).push(v);
            if (v.status === 'pending') {
                (pendingBySkill[v.skill_id] = pendingBySkill[v.skill_id] || []).push(v);
            }
        });
        skills.forEach((s) => {
            s.pending_versions = pendingBySkill[s.id] || [];
            s.history = (historyBySkill[s.id] || []).slice(0, 10);
        });
    }
    return skills;
}

export async function activeSkillsForPrompt() {
    const client = getServiceClient();
    const { data, error } = await client
        .from('chat_skills')
        .select('slug, name, content')
        .eq('is_active', true)
        .eq('always_loaded', true)
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createSkill({ slug, name, description, content, createdBy }) {
    const client = getServiceClient();
    const cleanSlug = String(slug || '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    if (!cleanSlug) throw new Error('Slug skill tidak valid.');
    const { data, error } = await client
        .from('chat_skills')
        .insert({
            slug: cleanSlug,
            name: (name || cleanSlug).slice(0, 120),
            description: (description || '').slice(0, 500),
            content: content.trim().slice(0, 8000),
            version: 1,
            created_by: createdBy || null,
        })
        .select('*')
        .single();
    if (error) throw new Error(error.message);

    // Catat versi 1 sebagai applied
    await client.from('chat_skill_versions').insert({
        skill_id: data.id,
        version: 1,
        content: data.content,
        reason: 'Versi awal',
        status: 'applied',
        applied_at: new Date().toISOString(),
        created_by: createdBy || null,
    });
    return data;
}

export async function updateSkill({ id, is_active, auto_refine, always_loaded, name, description }) {
    const client = getServiceClient();
    const patch = {};
    if (typeof is_active === 'boolean') patch.is_active = is_active;
    if (typeof auto_refine === 'boolean') patch.auto_refine = auto_refine;
    if (typeof always_loaded === 'boolean') patch.always_loaded = always_loaded;
    if (typeof name === 'string' && name.trim()) patch.name = name.trim().slice(0, 120);
    if (typeof description === 'string') patch.description = description.slice(0, 500);
    const { data, error } = await client
        .from('chat_skills')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteSkill(id) {
    const client = getServiceClient();
    const { error } = await client.from('chat_skills').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
}

/**
 * Menyempurnakan skill: membuat versi baru.
 * - skill.auto_refine = true  → versi langsung applied (skill content ter-update)
 * - skill.auto_refine = false → versi pending, menunggu review di UI
 * Mengembalikan { applied: boolean, version: number, reason }
 */
export async function proposeSkillUpdate({ slug, newContent, reason, createdBy }) {
    const client = getServiceClient();
    const { data: skill, error: skillErr } = await client
        .from('chat_skills')
        .select('id, slug, name, version, content, auto_refine, is_active')
        .eq('slug', slug)
        .maybeSingle();
    if (skillErr) throw new Error(skillErr.message);
    if (!skill) return { ok: false, error: `Skill "${slug}" tidak ditemukan.` };
    if (!skill.is_active) return { ok: false, error: `Skill "${slug}" sedang nonaktif, tidak bisa diperbarui.` };

    const content = String(newContent || '').trim().slice(0, 8000);
    if (content.length < 20) {
        return { ok: false, error: 'Konten skill baru terlalu pendek (minimal 20 karakter).' };
    }
    if (content === skill.content) {
        return { ok: true, applied: false, version: skill.version, reason: 'Tidak ada perubahan; konten identik dengan versi sekarang.' };
    }

    const nextVersion = skill.version + 1;
    const cleanReason = String(reason || '').slice(0, 1000) || 'Perbaikan otomatis dari percakapan';
    const shouldAutoApply = Boolean(skill.auto_refine);

    // Simpan versi
    const { data: versionRow, error: verErr } = await client
        .from('chat_skill_versions')
        .insert({
            skill_id: skill.id,
            version: nextVersion,
            content,
            reason: cleanReason,
            status: shouldAutoApply ? 'applied' : 'pending',
            applied_at: shouldAutoApply ? new Date().toISOString() : null,
            created_by: createdBy || null,
        })
        .select('id, version, status')
        .single();
    if (verErr) throw new Error(verErr.message);

    if (shouldAutoApply) {
        const { error: updErr } = await client
            .from('chat_skills')
            .update({ content, version: nextVersion })
            .eq('id', skill.id);
        if (updErr) throw new Error(updErr.message);
    }

    return {
        ok: true,
        applied: shouldAutoApply,
        version: nextVersion,
        skillName: skill.name,
        reason: cleanReason,
        pendingReview: !shouldAutoApply,
    };
}

/** Terapkan atau tolak versi pending dari UI */
export async function reviewSkillVersion({ versionId, action, reviewedBy }) {
    const client = getServiceClient();
    const { data: ver, error: verErr } = await client
        .from('chat_skill_versions')
        .select('id, skill_id, version, content, status')
        .eq('id', versionId)
        .maybeSingle();
    if (verErr) throw new Error(verErr.message);
    if (!ver) throw new Error('Versi skill tidak ditemukan.');
    if (ver.status !== 'pending') throw new Error('Versi ini sudah direview.');

    if (action === 'apply') {
        const { data: skill } = await client
            .from('chat_skills')
            .select('version')
            .eq('id', ver.skill_id)
            .single();
        const newVersion = Math.max((skill?.version || 0), ver.version - 1) + 1;
        // pastikan nomor versi unik
        await client
            .from('chat_skill_versions')
            .update({ version: newVersion, status: 'applied', applied_at: new Date().toISOString(), created_by: reviewedBy || null })
            .eq('id', ver.id);
        await client
            .from('chat_skills')
            .update({ content: ver.content, version: newVersion })
            .eq('id', ver.skill_id);
        return { ok: true, applied: true, version: newVersion };
    }

    // reject
    await client
        .from('chat_skill_versions')
        .update({ status: 'rejected', created_by: reviewedBy || null })
        .eq('id', ver.id);
    return { ok: true, applied: false };
}

// ============================== PENGATURAN PROVIDER GLOBAL ==============================

export function isDireksiOrSuperuser(role) {
    if (!role) return false;
    const clean = String(role).toLowerCase().trim();
    if (clean === 'super user' || clean === 'superuser' || clean === 'superadmin' || clean === 'admin') return true;
    if (clean.includes('direksi') || clean.includes('director')) return true;
    return false;
}

export async function getGlobalProviderSettings() {
    const defaultSettings = {
        baseURL: process.env.NEXT_PUBLIC_HERMES_URL || 'https://9router.absgroup.biz.id/v1',
        apiKey: process.env.HERMES_API_KEY || '',
        model: 'busana',
        updatedAt: null,
        updatedBy: null,
    };

    try {
        const client = getServiceClient();
        const { data, error } = await client
            .from('chat_skills')
            .select('content, updated_at, created_by')
            .eq('slug', 'system-provider-config')
            .maybeSingle();

        if (error || !data?.content) {
            return defaultSettings;
        }

        const parsed = JSON.parse(data.content);
        return {
            baseURL: parsed.baseURL?.trim() || defaultSettings.baseURL,
            apiKey: parsed.apiKey?.trim() || defaultSettings.apiKey,
            model: parsed.model?.trim() || defaultSettings.model,
            updatedAt: data.updated_at || parsed.updatedAt || null,
            updatedBy: parsed.updatedBy || null,
        };
    } catch {
        return defaultSettings;
    }
}

export async function saveGlobalProviderSettings({ baseURL, apiKey, model, memberId, memberName }) {
    const client = getServiceClient();
    const existing = await getGlobalProviderSettings();

    // Jika apiKey tidak diubah (kosong atau tersensor bulat-bulat), pertahankan key lama
    const finalApiKey = (apiKey && !/^•+$/.test(apiKey.trim())) ? apiKey.trim() : existing.apiKey;

    const contentObj = {
        baseURL: baseURL?.trim() || existing.baseURL,
        apiKey: finalApiKey,
        model: model?.trim() || existing.model,
        updatedAt: new Date().toISOString(),
        updatedBy: memberName || memberId || 'Direksi',
    };

    const payload = {
        slug: 'system-provider-config',
        name: 'Pengaturan Provider Global',
        description: 'Konfigurasi provider AI berlaku global untuk semua user',
        content: JSON.stringify(contentObj),
        version: 1,
        is_active: false,
        always_loaded: false,
        auto_refine: false,
        created_by: memberId || null,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
        .from('chat_skills')
        .upsert(payload, { onConflict: 'slug' })
        .select()
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return {
        baseURL: contentObj.baseURL,
        model: contentObj.model,
        hasApiKey: !!contentObj.apiKey,
        updatedAt: contentObj.updatedAt,
        updatedBy: contentObj.updatedBy,
    };
}

