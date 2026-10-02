import { createClient } from '@supabase/supabase-js';

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

const RETENTION_DAYS = 30;

function getExpiryCutoffDate() {
    const d = new Date();
    d.setDate(d.getDate() - RETENTION_DAYS);
    return d.toISOString();
}

/**
 * Bersihkan thread yang tidak aktif lebih dari 30 hari.
 * Dijalankan di background saat listThreads dipanggil.
 */
async function cleanupExpiredThreads() {
    try {
        const client = getServiceClient();
        const cutoff = getExpiryCutoffDate();
        await client
            .from('chat_threads')
            .delete()
            .lt('updated_at', cutoff);
    } catch {
        // Abaikan error background cleanup
    }
}

/**
 * Ambil daftar ringkasan thread milik member (maksimal 30 hari terakhir).
 * Kolom messages dikecualikan untuk efisiensi payload jaringan.
 */
export async function listUserThreads(memberId) {
    if (!memberId) return [];
    const client = getServiceClient();
    const cutoff = getExpiryCutoffDate();

    // Jalankan auto-cleanup di background
    cleanupExpiredThreads().catch(() => {});

    const { data, error } = await client
        .from('chat_threads')
        .select('id, title, created_at, updated_at')
        .eq('member_id', memberId)
        .gte('updated_at', cutoff)
        .order('updated_at', { ascending: false })
        .limit(100);

    if (error) {
        if (error.code === 'PGRST205') {
            // Tabel belum dibuat di database Supabase
            const err = new Error('Tabel task_leader.chat_threads belum dibuat di Supabase.');
            err.code = 'TABLE_NOT_FOUND';
            throw err;
        }
        throw new Error(error.message);
    }

    return data || [];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(val) {
    return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Ambil detail thread dan seluruh pesan di dalamnya.
 */
export async function getUserThread(id, memberId) {
    if (!id || !memberId) return null;
    if (!isValidUUID(id)) return null;
    const client = getServiceClient();
    const cutoff = getExpiryCutoffDate();

    const { data, error } = await client
        .from('chat_threads')
        .select('id, title, messages, created_at, updated_at')
        .eq('id', id)
        .eq('member_id', memberId)
        .gte('updated_at', cutoff)
        .maybeSingle();

    if (error) {
        if (error.code === 'PGRST205') {
            const err = new Error('Tabel task_leader.chat_threads belum dibuat di Supabase.');
            err.code = 'TABLE_NOT_FOUND';
            throw err;
        }
        throw new Error(error.message);
    }

    return data;
}

/**
 * Simpan atau perbarui thread.
 * Jika id belum ada atau bukan UUID, Supabase membuat record baru dengan UUID baru.
 */
export async function saveUserThread({ id, memberId, title, messages }) {
    if (!memberId) throw new Error('memberId wajib diisi.');
    const client = getServiceClient();

    const payload = {
        member_id: memberId,
        title: (title || 'Percakapan Baru').trim().slice(0, 100),
        messages: Array.isArray(messages) ? messages : [],
        updated_at: new Date().toISOString(),
    };

    const hasValidUuid = isValidUUID(id);
    if (hasValidUuid) {
        payload.id = id;
    }

    const query = hasValidUuid
        ? client
            .from('chat_threads')
            .upsert(payload, { onConflict: 'id' })
            .select('id, title, created_at, updated_at')
            .single()
        : client
            .from('chat_threads')
            .insert(payload)
            .select('id, title, created_at, updated_at')
            .single();

    const { data, error } = await query;

    if (error) {
        if (error.code === 'PGRST205') {
            const err = new Error('Tabel task_leader.chat_threads belum dibuat di Supabase.');
            err.code = 'TABLE_NOT_FOUND';
            throw err;
        }
        console.error('Error saving user chat thread:', error);
        throw new Error(error.message);
    }

    return data;
}

/**
 * Hapus suatu thread milik pengguna.
 */
export async function deleteUserThread(id, memberId) {
    if (!id || !memberId) return false;
    if (!isValidUUID(id)) return false;
    const client = getServiceClient();

    const { error } = await client
        .from('chat_threads')
        .delete()
        .eq('id', id)
        .eq('member_id', memberId);

    if (error) {
        if (error.code === 'PGRST205') {
            const err = new Error('Tabel task_leader.chat_threads belum dibuat di Supabase.');
            err.code = 'TABLE_NOT_FOUND';
            throw err;
        }
        throw new Error(error.message);
    }

    return true;
}
