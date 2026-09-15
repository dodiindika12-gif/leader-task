-- ==============================================================================
-- Migration Script: Tambah Kolom Memo dan Update Logs pada Tabel Tasks (ABS Group)
-- Skema: task_leader
--
-- Jalankan script SQL ini di SQL Editor Supabase: https://db.absgroup.biz.id
-- ==============================================================================

-- 1. Tambah kolom memo (teks catatan/brief) dan update_logs (riwayat update jsonb)
ALTER TABLE task_leader.tasks
ADD COLUMN IF NOT EXISTS memo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS update_logs JSONB DEFAULT '[]'::jsonb;

-- 2. Berikan index GIN pada update_logs untuk query efisien di masa depan
CREATE INDEX IF NOT EXISTS idx_tasks_update_logs ON task_leader.tasks USING gin (update_logs);

-- 3. Reload cache schema PostgREST agar kolom langsung dikenali API Supabase
NOTIFY pgrst, 'reload schema';
