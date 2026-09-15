-- ==============================================================================
-- Migration Script: Tambah Kolom Proof Files (Bukti Berkas Tugas) pada Tabel Tasks
-- Skema: task_leader
--
-- Jalankan script SQL ini di SQL Editor Supabase: https://db.absgroup.biz.id
-- ==============================================================================

-- 1. Tambah kolom proof_files (array objek JSON berkas bukti)
ALTER TABLE task_leader.tasks
ADD COLUMN IF NOT EXISTS proof_files JSONB DEFAULT '[]'::jsonb;

-- 2. Berikan index GIN pada proof_files untuk query dan filter efisien
CREATE INDEX IF NOT EXISTS idx_tasks_proof_files ON task_leader.tasks USING gin (proof_files);

-- 3. Reload cache schema PostgREST agar kolom langsung dikenali API Supabase
NOTIFY pgrst, 'reload schema';
