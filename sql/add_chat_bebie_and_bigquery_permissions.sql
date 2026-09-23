-- ==============================================================================
-- Migration: Add can_access_bigquery column to members & update chat.bebie permissions
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Tambahkan kolom can_access_bigquery pada tabel task_leader.members (jika belum ada)
ALTER TABLE task_leader.members 
ADD COLUMN IF NOT EXISTS can_access_bigquery BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN task_leader.members.can_access_bigquery IS 'Izin akses Google BigQuery di Chat Bebie, diatur granular per-user oleh Direksi';

-- 2. Berikan akses default BigQuery untuk Direksi dan Super User
UPDATE task_leader.members
SET can_access_bigquery = TRUE
WHERE role IN ('Direksi', 'Super User');

-- 3. Tambahkan izin 'chat.bebie' ke dalam matriks roles task_leader.roles
-- Staff (Level 1) -> chat.bebie = false
UPDATE task_leader.roles
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{chat.bebie}', 'false'::jsonb, true)
WHERE name = 'Staff';

-- Koordinator (Level 2) -> chat.bebie = true
UPDATE task_leader.roles
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{chat.bebie}', 'true'::jsonb, true)
WHERE name = 'Koordinator';

-- SPV (Level 3) -> chat.bebie = true
UPDATE task_leader.roles
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{chat.bebie}', 'true'::jsonb, true)
WHERE name = 'SPV';

-- Manager (Level 4) -> chat.bebie = true
UPDATE task_leader.roles
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{chat.bebie}', 'true'::jsonb, true)
WHERE name = 'Manager';

-- Direksi (Level 5) -> chat.bebie = true
UPDATE task_leader.roles
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{chat.bebie}', 'true'::jsonb, true)
WHERE name = 'Direksi';

-- 4. Reload schema cache untuk PostgREST agar API Supabase segera mengenali perubahan kolom
NOTIFY pgrst, 'reload schema';
