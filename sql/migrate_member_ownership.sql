-- ==============================================================================
-- Migration Script: Transfer / Handover Ownership, Tasks, PIC & Roles
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure foreign key on projects has ON DELETE SET NULL
ALTER TABLE task_leader.projects 
DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;

ALTER TABLE task_leader.projects 
ADD CONSTRAINT projects_owner_id_fkey 
FOREIGN KEY (owner_id) 
REFERENCES task_leader.members(id) 
ON DELETE SET NULL;

-- 2. Create Stored Procedure for Complete Member Migration & Handover
CREATE OR REPLACE FUNCTION task_leader.transfer_member_ownership(
    p_from_member_id UUID,
    p_to_member_id UUID DEFAULT NULL,
    p_delete_source BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workspaces_count INT := 0;
    v_tasks_count INT := 0;
    v_schedules_count INT := 0;
    v_notes_count INT := 0;
    v_divisions_count INT := 0;
    v_departments_spv_count INT := 0;
    v_departments_coord_count INT := 0;
    v_target_name TEXT := NULL;
    v_result JSONB;
BEGIN
    -- Get target member name if target is specified
    IF p_to_member_id IS NOT NULL THEN
        SELECT name INTO v_target_name FROM task_leader.members WHERE id = p_to_member_id;
    END IF;

    -- 1. Transfer Workspace Ownership (projects)
    WITH updated AS (
        UPDATE task_leader.projects 
        SET owner_id = p_to_member_id 
        WHERE owner_id = p_from_member_id
        RETURNING 1
    )
    SELECT count(*) INTO v_workspaces_count FROM updated;

    -- Also grant access in project_access if transferring to another member
    IF p_to_member_id IS NOT NULL THEN
        INSERT INTO task_leader.project_access (project_id, member_id)
        SELECT id, p_to_member_id 
        FROM task_leader.projects 
        WHERE owner_id = p_to_member_id
        ON CONFLICT (project_id, member_id) DO NOTHING;
    END IF;

    -- 2. Transfer Tasks (pic_id)
    WITH updated AS (
        UPDATE task_leader.tasks 
        SET pic_id = p_to_member_id 
        WHERE pic_id = p_from_member_id
        RETURNING 1
    )
    SELECT count(*) INTO v_tasks_count FROM updated;

    -- 3. Transfer Schedules (pic_id)
    WITH updated AS (
        UPDATE task_leader.schedules 
        SET pic_id = p_to_member_id 
        WHERE pic_id = p_from_member_id
        RETURNING 1
    )
    SELECT count(*) INTO v_schedules_count FROM updated;

    -- 4. Transfer Notes / MoM (pic_id)
    WITH updated AS (
        UPDATE task_leader.notes 
        SET pic_id = p_to_member_id 
        WHERE pic_id = p_from_member_id
        RETURNING 1
    )
    SELECT count(*) INTO v_notes_count FROM updated;

    -- 5. Transfer Divisions Manager
    WITH updated AS (
        UPDATE task_leader.divisions 
        SET manager_id = p_to_member_id,
            manager_name = v_target_name
        WHERE manager_id = p_from_member_id
        RETURNING 1
    )
    SELECT count(*) INTO v_divisions_count FROM updated;

    -- 6. Transfer Departments SPV & Coordinator
    WITH updated AS (
        UPDATE task_leader.departments 
        SET spv_id = p_to_member_id,
            spv_name = v_target_name
        WHERE spv_id = p_from_member_id
        RETURNING 1
    )
    SELECT count(*) INTO v_departments_spv_count FROM updated;

    WITH updated AS (
        UPDATE task_leader.departments 
        SET coordinator_id = p_to_member_id,
            coordinator_name = v_target_name
        WHERE coordinator_id = p_from_member_id
        RETURNING 1
    )
    SELECT count(*) INTO v_departments_coord_count FROM updated;

    -- 7. Clean project_access for source member
    DELETE FROM task_leader.project_access WHERE member_id = p_from_member_id;

    -- 8. Delete source member if requested
    IF p_delete_source THEN
        DELETE FROM task_leader.members WHERE id = p_from_member_id;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'workspaces_transferred', v_workspaces_count,
        'tasks_transferred', v_tasks_count,
        'schedules_transferred', v_schedules_count,
        'notes_transferred', v_notes_count,
        'divisions_transferred', v_divisions_count,
        'departments_transferred', v_departments_spv_count + v_departments_coord_count,
        'deleted_source', p_delete_source
    );

    RETURN v_result;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION task_leader.transfer_member_ownership TO authenticated, anon;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
