-- ==============================================================================
-- Migration Script V5: Google Calendar Daily & Weekly View + Recurrence for Jadwal Meeting
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor if you want dedicated columns.
-- (Note: The application also supports storing recurrence metadata gracefully in the notes column).
-- ==============================================================================

-- 1. Add recurrence and schedule_date columns to task_leader.schedules
ALTER TABLE task_leader.schedules
ADD COLUMN IF NOT EXISTS recurrence JSONB DEFAULT '{"type":"weekly"}'::jsonb,
ADD COLUMN IF NOT EXISTS schedule_date DATE;

-- 2. Index for faster query by schedule_date
CREATE INDEX IF NOT EXISTS idx_schedules_schedule_date 
ON task_leader.schedules(schedule_date);

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
