-- Run this in your Supabase SQL Editor

-- 1. Add owner_id to projects
ALTER TABLE task_leader.projects 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES task_leader.members(id);

-- Optional: Set default owner to the first member or admin if needed
-- UPDATE task_leader.projects SET owner_id = (SELECT id FROM task_leader.members LIMIT 1) WHERE owner_id IS NULL;

-- 2. Create project_access table for sharing
CREATE TABLE IF NOT EXISTS task_leader.project_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES task_leader.projects(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES task_leader.members(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, member_id)
);

-- 3. Fix Row-Level Security (RLS) for project_access and projects
-- Allow inserts and selects for everyone in the app
ALTER TABLE task_leader.project_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on project_access" ON task_leader.project_access;
CREATE POLICY "Allow all operations on project_access" 
ON task_leader.project_access 
FOR ALL 
USING (true) 
WITH CHECK (true);

ALTER TABLE task_leader.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on projects" ON task_leader.projects;
CREATE POLICY "Allow all operations on projects" 
ON task_leader.projects 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Note: Make sure to reload your schema cache if you're using PostgREST or Supabase JS client.
NOTIFY pgrst, 'reload schema';
