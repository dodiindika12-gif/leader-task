-- ==============================================================================
-- Migration: Chat Threads & History with 30-Day Auto Retention
-- Schema: task_leader
-- Fitur: Menyimpan riwayat percakapan per member/user, otomatis hilang > 30 hari.
-- Jalankan di Supabase SQL Editor
-- ==============================================================================

-- 1. Buat tabel chat_threads di schema task_leader
CREATE TABLE IF NOT EXISTS task_leader.chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES task_leader.members(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Percakapan Baru',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE task_leader.chat_threads IS 'Riwayat percakapan chat agent per member dengan batas retensi 30 hari.';

-- 2. Index untuk pencarian cepat riwayat pengguna & filter waktu
CREATE INDEX IF NOT EXISTS idx_chat_threads_member_updated 
    ON task_leader.chat_threads (member_id, updated_at DESC);

-- 3. Trigger auto-update field updated_at
CREATE OR REPLACE FUNCTION task_leader.fn_chat_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_threads_updated ON task_leader.chat_threads;
CREATE TRIGGER trg_chat_threads_updated
    BEFORE UPDATE ON task_leader.chat_threads
    FOR EACH ROW EXECUTE FUNCTION task_leader.fn_chat_threads_updated_at();

-- 4. Fungsi pembersihan thread yang sudah lewat 30 hari
CREATE OR REPLACE FUNCTION task_leader.fn_cleanup_expired_chat_threads()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM task_leader.chat_threads
    WHERE updated_at < (now() - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION task_leader.fn_cleanup_expired_chat_threads IS 'Menghapus riwayat percakapan yang tidak aktif lebih dari 30 hari.';
