-- ==============================================================================
-- Create Roles (Jabatan) Table & RLS Policies
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Create the roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS task_leader.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    level INTEGER DEFAULT 1,
    description TEXT DEFAULT '',
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row-Level Security
ALTER TABLE task_leader.roles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies to allow reading, inserting, updating, and deleting
DROP POLICY IF EXISTS "Allow all operations on roles" ON task_leader.roles;
CREATE POLICY "Allow all operations on roles" 
ON task_leader.roles 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Seed with default roles
INSERT INTO task_leader.roles (name, level, description, permissions)
VALUES 
    ('Staff', 1, 'Staf pelaksana teknis di departemen', '{"task.create":true,"task.edit_own":true,"task.delete_own":true,"workspace.create":true,"workspace.share_dept":true,"organization.view_structure":true,"users.view_list":true,"notes.create_notes":true}'::jsonb),
    ('Koordinator', 2, 'Atasan / Kepala Departemen (langsung di bawah SPV)', '{"task.create":true,"task.edit_own":true,"task.edit_dept":true,"task.delete_own":true,"workspace.create":true,"workspace.edit":true,"workspace.share_dept":true,"workspace.share_div":true,"organization.view_structure":true,"users.view_list":true,"users.create_dept":true,"roles_auth.view_matrix":true,"notes.create_notes":true,"notes.share_notes":true,"reports.export_excel":true,"reports.view_analytics":true}'::jsonb),
    ('SPV', 3, 'Supervisor pengawas operasional divisi & departemen', '{"task.create":true,"task.edit_own":true,"task.edit_dept":true,"task.edit_div":true,"task.delete_own":true,"task.delete_div":true,"workspace.create":true,"workspace.edit":true,"workspace.delete":true,"workspace.share_dept":true,"workspace.share_div":true,"organization.view_structure":true,"organization.manage_department":true,"users.view_list":true,"users.create_dept":true,"users.create_div":true,"users.edit_div":true,"users.toggle_status":true,"users.reset_password":true,"roles_auth.view_matrix":true,"notes.create_notes":true,"notes.share_notes":true,"reports.export_excel":true,"reports.view_analytics":true}'::jsonb),
    ('Manager', 4, 'Manajer divisi dan perencana strategi', '{"task.create":true,"task.edit_own":true,"task.edit_dept":true,"task.edit_div":true,"task.delete_own":true,"task.delete_div":true,"task.view_all_div":true,"workspace.create":true,"workspace.edit":true,"workspace.delete":true,"workspace.share_dept":true,"workspace.share_div":true,"workspace.share_all":true,"organization.view_structure":true,"organization.manage_division":true,"organization.manage_department":true,"organization.assign_leaders":true,"users.view_list":true,"users.create_dept":true,"users.create_div":true,"users.edit_div":true,"users.toggle_status":true,"users.reset_password":true,"roles_auth.view_matrix":true,"notes.create_notes":true,"notes.share_notes":true,"reports.export_excel":true,"reports.view_analytics":true}'::jsonb),
    ('Direksi', 5, 'Jajaran direksi dan eksekutif tertinggi', '{"task.create":true,"task.edit_own":true,"task.edit_dept":true,"task.edit_div":true,"task.edit_all":true,"task.delete_own":true,"task.delete_div":true,"task.delete_all":true,"task.view_all_div":true,"workspace.create":true,"workspace.edit":true,"workspace.delete":true,"workspace.share_dept":true,"workspace.share_div":true,"workspace.share_all":true,"organization.view_structure":true,"organization.manage_division":true,"organization.manage_department":true,"organization.assign_leaders":true,"users.view_list":true,"users.create_dept":true,"users.create_div":true,"users.edit_div":true,"users.toggle_status":true,"users.reset_password":true,"roles_auth.view_matrix":true,"roles_auth.edit_matrix":true,"roles_auth.manage_roles":true,"notes.create_notes":true,"notes.share_notes":true,"reports.export_excel":true,"reports.view_analytics":true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 5. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
