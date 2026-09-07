-- ==============================================================================
-- Migration Script V4: Google Keep Post-It Notes & MoM Enhanced Sharing (ABS Group)
-- Schema: task_leader
-- Run this script in Supabase SQL Editor if you wish to add dedicated columns.
-- Note: The application also supports storing metadata gracefully in existing columns.
-- ==============================================================================

-- 1. Add color, is_pinned, and shared_with to notes table
ALTER TABLE task_leader.notes
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow',
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shared_with JSONB DEFAULT '[]'::jsonb;

-- 2. Index for faster queries on note types and owners
CREATE INDEX IF NOT EXISTS idx_notes_owner_type 
ON task_leader.notes(pic_id, type);

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
