-- ==============================================================================
-- Create Schedules Table & RLS Policies
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Create the schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS task_leader.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'meeting' or 'worksheet'
    title TEXT NOT NULL,
    day TEXT NOT NULL,  -- 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
    start_time TEXT NOT NULL, -- e.g. '08:00', '08:30', ...
    end_time TEXT NOT NULL,   -- e.g. '09:00', '09:30', ...
    pic_id UUID REFERENCES task_leader.members(id) ON DELETE SET NULL,
    attendees JSONB DEFAULT '[]'::jsonb, -- Array of member IDs (peserta meeting)
    location TEXT,      -- e.g. 'Ruang Rapat 1', 'Google Meet', 'Online'
    notes TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure attendees column exists if table was already created earlier
ALTER TABLE task_leader.schedules 
ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb;

-- 2. Enable Row-Level Security
ALTER TABLE task_leader.schedules ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies to allow all operations
DROP POLICY IF EXISTS "Allow all operations on schedules" ON task_leader.schedules;
CREATE POLICY "Allow all operations on schedules" 
ON task_leader.schedules 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Create index for fast retrieval by type and day
CREATE INDEX IF NOT EXISTS idx_schedules_type_day 
ON task_leader.schedules(type, day);

-- 5. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
