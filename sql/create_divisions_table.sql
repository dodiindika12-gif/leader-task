-- ==============================================================================
-- Create Divisions Table & RLS Policies
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Create the divisions table if it doesn't exist
CREATE TABLE IF NOT EXISTS task_leader.divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    manager_id UUID REFERENCES task_leader.members(id) ON DELETE SET NULL,
    manager_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if table was already created earlier
ALTER TABLE task_leader.divisions 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES task_leader.members(id) ON DELETE SET NULL;

ALTER TABLE task_leader.divisions 
ADD COLUMN IF NOT EXISTS manager_name TEXT;

-- 2. Enable Row-Level Security
ALTER TABLE task_leader.divisions ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies to allow reading and inserting
DROP POLICY IF EXISTS "Allow all operations on divisions" ON task_leader.divisions;
CREATE POLICY "Allow all operations on divisions" 
ON task_leader.divisions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Seed with default divisions (optional, will ignore duplicates)
INSERT INTO task_leader.divisions (name)
VALUES 
    ('IT'), ('HCGA'), ('Marcomm'), ('Finance'), 
    ('Accounting'), ('Distribution'), ('Operations'), 
    ('Business Project'), ('Logistic'), ('Buyer'), ('Audit')
ON CONFLICT (name) DO NOTHING;

-- 5. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
