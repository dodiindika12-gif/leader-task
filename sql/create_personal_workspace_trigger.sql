-- ==============================================================================
-- Trigger & Function: Auto-Create Personal Workspace for New Members
-- Schema: task_leader
-- Format: "Task <Nama Depan>" (e.g. "Dodi Indika" -> "Task Dodi")
-- ==============================================================================

CREATE OR REPLACE FUNCTION task_leader.fn_auto_create_personal_workspace()
RETURNS TRIGGER AS $$
DECLARE
    clean_name TEXT;
    first_name TEXT;
    ws_name TEXT;
    new_proj_id UUID;
BEGIN
    -- Bersihkan gelar umum
    clean_name := regexp_replace(NEW.name, '^(dr\.|drg\.|drs\.|dra\.|ir\.|h\.|hj\.)\s+', '', 'i');
    clean_name := trim(clean_name);
    
    -- Ambil kata pertama
    first_name := split_part(clean_name, ' ', 1);
    
    -- Tangani nama majemuk khas Indonesia (seperti La Ode)
    IF lower(first_name) = 'la' AND lower(split_part(clean_name, ' ', 2)) = 'ode' THEN
        first_name := 'La Ode';
    ELSE
        -- Kapitalisasi huruf pertama
        first_name := initcap(first_name);
    END IF;

    IF first_name IS NULL OR first_name = '' THEN
        first_name := 'Pribadi';
    END IF;

    ws_name := 'Task ' || first_name;
    new_proj_id := gen_random_uuid();

    -- 1. Buat project workspace pribadi
    INSERT INTO task_leader.projects (
        id,
        name,
        color,
        is_pinned,
        show_in_calendar,
        division,
        owner_id,
        folders,
        description
    ) VALUES (
        new_proj_id,
        ws_name,
        COALESCE(NEW.color, '#6366f1'),
        false,
        false,
        COALESCE(NEW.division, 'Task ABS'),
        NEW.id,
        ARRAY['General']::text[],
        'personal'
    );

    -- 2. Berikan akses kepemilikan di project_access
    INSERT INTO task_leader.project_access (
        project_id,
        member_id
    ) VALUES (
        new_proj_id,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger pada tabel task_leader.members
DROP TRIGGER IF EXISTS trg_auto_create_personal_workspace ON task_leader.members;

CREATE TRIGGER trg_auto_create_personal_workspace
AFTER INSERT ON task_leader.members
FOR EACH ROW
EXECUTE FUNCTION task_leader.fn_auto_create_personal_workspace();
