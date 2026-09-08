-- ==============================================================================
-- Migration: Add Permissions JSONB column to Roles table
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Add permissions column to task_leader.roles if not exists
ALTER TABLE task_leader.roles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- 2. Seed / Update default permissions for each role
-- Staff (Level 1)
UPDATE task_leader.roles
SET permissions = '{
    "task.create": true,
    "task.edit_own": true,
    "task.edit_dept": false,
    "task.edit_div": false,
    "task.edit_all": false,
    "task.delete_own": true,
    "task.delete_div": false,
    "task.delete_all": false,
    "task.view_all_div": false,
    "workspace.create": true,
    "workspace.edit": false,
    "workspace.delete": false,
    "workspace.share_dept": true,
    "workspace.share_div": false,
    "workspace.share_all": false,
    "organization.view_structure": true,
    "organization.manage_division": false,
    "organization.manage_department": false,
    "organization.assign_leaders": false,
    "users.view_list": true,
    "users.create_dept": false,
    "users.create_div": false,
    "users.edit_div": false,
    "users.toggle_status": false,
    "users.reset_password": false,
    "roles_auth.view_matrix": false,
    "roles_auth.edit_matrix": false,
    "roles_auth.manage_roles": false,
    "notes.create_notes": true,
    "notes.share_notes": false,
    "reports.export_excel": false,
    "reports.view_analytics": false
}'::jsonb
WHERE name = 'Staff';

-- Koordinator (Level 2)
UPDATE task_leader.roles
SET permissions = '{
    "task.create": true,
    "task.edit_own": true,
    "task.edit_dept": true,
    "task.edit_div": false,
    "task.edit_all": false,
    "task.delete_own": true,
    "task.delete_div": false,
    "task.delete_all": false,
    "task.view_all_div": false,
    "workspace.create": true,
    "workspace.edit": true,
    "workspace.delete": false,
    "workspace.share_dept": true,
    "workspace.share_div": true,
    "workspace.share_all": false,
    "organization.view_structure": true,
    "organization.manage_division": false,
    "organization.manage_department": false,
    "organization.assign_leaders": false,
    "users.view_list": true,
    "users.create_dept": true,
    "users.create_div": false,
    "users.edit_div": false,
    "users.toggle_status": false,
    "users.reset_password": false,
    "roles_auth.view_matrix": true,
    "roles_auth.edit_matrix": false,
    "roles_auth.manage_roles": false,
    "notes.create_notes": true,
    "notes.share_notes": true,
    "reports.export_excel": true,
    "reports.view_analytics": true
}'::jsonb
WHERE name = 'Koordinator';

-- SPV (Level 3)
UPDATE task_leader.roles
SET permissions = '{
    "task.create": true,
    "task.edit_own": true,
    "task.edit_dept": true,
    "task.edit_div": true,
    "task.edit_all": false,
    "task.delete_own": true,
    "task.delete_div": true,
    "task.delete_all": false,
    "task.view_all_div": false,
    "workspace.create": true,
    "workspace.edit": true,
    "workspace.delete": true,
    "workspace.share_dept": true,
    "workspace.share_div": true,
    "workspace.share_all": false,
    "organization.view_structure": true,
    "organization.manage_division": false,
    "organization.manage_department": true,
    "organization.assign_leaders": false,
    "users.view_list": true,
    "users.create_dept": true,
    "users.create_div": true,
    "users.edit_div": true,
    "users.toggle_status": true,
    "users.reset_password": true,
    "roles_auth.view_matrix": true,
    "roles_auth.edit_matrix": false,
    "roles_auth.manage_roles": false,
    "notes.create_notes": true,
    "notes.share_notes": true,
    "reports.export_excel": true,
    "reports.view_analytics": true
}'::jsonb
WHERE name = 'SPV';

-- Manager (Level 4)
UPDATE task_leader.roles
SET permissions = '{
    "task.create": true,
    "task.edit_own": true,
    "task.edit_dept": true,
    "task.edit_div": true,
    "task.edit_all": false,
    "task.delete_own": true,
    "task.delete_div": true,
    "task.delete_all": false,
    "task.view_all_div": true,
    "workspace.create": true,
    "workspace.edit": true,
    "workspace.delete": true,
    "workspace.share_dept": true,
    "workspace.share_div": true,
    "workspace.share_all": true,
    "organization.view_structure": true,
    "organization.manage_division": true,
    "organization.manage_department": true,
    "organization.assign_leaders": true,
    "users.view_list": true,
    "users.create_dept": true,
    "users.create_div": true,
    "users.edit_div": true,
    "users.toggle_status": true,
    "users.reset_password": true,
    "roles_auth.view_matrix": true,
    "roles_auth.edit_matrix": false,
    "roles_auth.manage_roles": false,
    "notes.create_notes": true,
    "notes.share_notes": true,
    "reports.export_excel": true,
    "reports.view_analytics": true
}'::jsonb
WHERE name = 'Manager';

-- Direksi (Level 5)
UPDATE task_leader.roles
SET permissions = '{
    "task.create": true,
    "task.edit_own": true,
    "task.edit_dept": true,
    "task.edit_div": true,
    "task.edit_all": true,
    "task.delete_own": true,
    "task.delete_div": true,
    "task.delete_all": true,
    "task.view_all_div": true,
    "workspace.create": true,
    "workspace.edit": true,
    "workspace.delete": true,
    "workspace.share_dept": true,
    "workspace.share_div": true,
    "workspace.share_all": true,
    "organization.view_structure": true,
    "organization.manage_division": true,
    "organization.manage_department": true,
    "organization.assign_leaders": true,
    "users.view_list": true,
    "users.create_dept": true,
    "users.create_div": true,
    "users.edit_div": true,
    "users.toggle_status": true,
    "users.reset_password": true,
    "roles_auth.view_matrix": true,
    "roles_auth.edit_matrix": true,
    "roles_auth.manage_roles": true,
    "notes.create_notes": true,
    "notes.share_notes": true,
    "reports.export_excel": true,
    "reports.view_analytics": true
}'::jsonb
WHERE name = 'Direksi';

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
