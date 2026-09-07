-- ==============================================================================
-- Migration Script V3: Folder / Section Support for Tasks & Projects (ABS Group)
-- Schema: task_leader
-- Run this script in Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure tasks table has folder column
ALTER TABLE task_leader.tasks 
ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'General';

-- 2. Ensure projects table has folders JSONB array column
ALTER TABLE task_leader.projects
ADD COLUMN IF NOT EXISTS folders JSONB DEFAULT '["General"]'::jsonb;

-- 3. Create index for faster folder and project queries
CREATE INDEX IF NOT EXISTS idx_tasks_project_folder 
ON task_leader.tasks(project_id, folder);

-- 4. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
