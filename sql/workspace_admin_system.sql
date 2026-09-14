-- ==============================================================================
-- Migration: Sistem Pemilik & Hak Akses Workspace (WhatsApp Group Admin Style)
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Tambahkan kolom co_owners (daftar ID pemilik tambahan) dan description di tabel projects
ALTER TABLE task_leader.projects 
ADD COLUMN IF NOT EXISTS co_owners JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 2. Pastikan tabel project_access memiliki index untuk performa query cepat
CREATE INDEX IF NOT EXISTS idx_project_access_proj_mem 
ON task_leader.project_access(project_id, member_id);

-- 3. Reload schema cache untuk PostgREST
NOTIFY pgrst, 'reload schema';
