-- ==============================================================================
-- Create Departments Table & Schema Extension
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Create the departments table
CREATE TABLE IF NOT EXISTS task_leader.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    division_name TEXT NOT NULL,
    spv_id UUID REFERENCES task_leader.members(id) ON DELETE SET NULL,
    spv_name TEXT,
    coordinator_id UUID REFERENCES task_leader.members(id) ON DELETE SET NULL,
    coordinator_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if table was already created earlier
ALTER TABLE task_leader.departments 
ADD COLUMN IF NOT EXISTS spv_id UUID REFERENCES task_leader.members(id) ON DELETE SET NULL;

ALTER TABLE task_leader.departments 
ADD COLUMN IF NOT EXISTS spv_name TEXT;

-- 2. Ensure members table has department column
ALTER TABLE task_leader.members 
ADD COLUMN IF NOT EXISTS department TEXT;

-- 3. Enable Row-Level Security
ALTER TABLE task_leader.departments ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for departments
DROP POLICY IF EXISTS "Allow all operations on departments" ON task_leader.departments;
CREATE POLICY "Allow all operations on departments" 
ON task_leader.departments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
