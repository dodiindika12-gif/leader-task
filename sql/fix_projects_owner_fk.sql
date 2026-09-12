-- ==============================================================================
-- Fix Foreign Key Constraint on projects.owner_id
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Drop the old foreign key constraint that blocks member deletion
ALTER TABLE task_leader.projects 
DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;

-- 2. Re-create the foreign key with ON DELETE SET NULL
-- When a member is deleted, any projects they owned will remain safe with owner_id set to NULL
ALTER TABLE task_leader.projects 
ADD CONSTRAINT projects_owner_id_fkey 
FOREIGN KEY (owner_id) 
REFERENCES task_leader.members(id) 
ON DELETE SET NULL;

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
