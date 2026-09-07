-- ==============================================================================
-- Migration Script V2: Asana & Notion Features for Task Leader Dashboard (ABS Group)
-- Schema: task_leader
-- Run this script in Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure tasks table has start_date for Timeline/Gantt view
ALTER TABLE task_leader.tasks 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- 2. Add MoM (Minute of Meeting) columns to notes table
ALTER TABLE task_leader.notes
ADD COLUMN IF NOT EXISTS meeting_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES task_leader.projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS agenda TEXT,
ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]'::jsonb;

-- 3. Create index for faster deadline and start_date queries
CREATE INDEX IF NOT EXISTS idx_tasks_dates 
ON task_leader.tasks(deadline, start_date);

CREATE INDEX IF NOT EXISTS idx_notes_type_date 
ON task_leader.notes(type, created_at DESC);

-- 4. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
