import { createClient } from '@supabase/supabase-js';
import { isPersonalProject, canAccessPersonalProject } from './personal.js';

let serviceClient = null;

export function getTaskServiceClient() {
    if (serviceClient) return serviceClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Konfigurasi Supabase service role tidak lengkap di server.');
    }
    serviceClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: 'task_leader' },
        global: {
            headers: { 'Accept-Profile': 'task_leader' },
        },
    });
    return serviceClient;
}

/**
 * Mendapatkan daftar project/workspace yang berhak diakses oleh member.
 * Aturan otorisasi identik dengan sistem dashboard utama:
 * 1. Super User / Direksi: berhak mengakses seluruh project non-pribadi dan project pribadi miliknya / yang dishare.
 * 2. Non-Eksekutif: HANYA project di mana user adalah owner, co-owner, atau terdapat di project_access (dishare).
 * 3. Proyek legacy tanpa owner_id: hanya jika divisinya cocok dengan divisi user (atau divisi 'Task ABS').
 * 4. Workspace pribadi (description: 'personal'): HANYA jika user adalah pemilik / co-owner / terdaftar di project_access.
 */
export async function getMemberAccessibleProjects(member) {
    const client = getTaskServiceClient();
    const isExecutive = ['Super User', 'Direksi'].includes(member.role);
    const normalizedMemberId = String(member.id).trim().toLowerCase();

    // 1. Ambil semua project
    const { data: allProjects, error: pError } = await client
        .from('projects')
        .select('id, name, color, division, owner_id, co_owners, description, folders')
        .order('name');
    if (pError) throw new Error(`Gagal memuat projects: ${pError.message}`);

    // 2. Ambil project_access user
    const { data: userAccess, error: aError } = await client
        .from('project_access')
        .select('project_id, member_id')
        .eq('member_id', member.id);
    if (aError) throw new Error(`Gagal memuat project_access: ${aError.message}`);

    const userAccessList = userAccess || [];
    const userAccessSet = new Set(userAccessList.map(a => a.project_id));

    const accessibleProjects = (allProjects || []).filter(p => {
        const isPersonal = isPersonalProject(p);
        if (isPersonal) {
            return canAccessPersonalProject(p, member.id, userAccessList);
        }

        const isExplicitlyAccessible =
            (p.owner_id && String(p.owner_id).trim().toLowerCase() === normalizedMemberId) ||
            (Array.isArray(p.co_owners) && p.co_owners.some(co => String(co).trim().toLowerCase() === normalizedMemberId)) ||
            userAccessSet.has(p.id);

        if (isExplicitlyAccessible) return true;

        if (isExecutive) {
            return true;
        }

        if (!p.owner_id) {
            if (p.division && (p.division === 'Task ABS' || p.division === member.division)) {
                return true;
            }
        }

        return false;
    });

    return accessibleProjects;
}

/**
 * Ambil daftar anggota/member yang valid untuk penugasan (PIC).
 */
export async function getAvailableMembersForProjects(accessibleProjects, memberDivision) {
    const client = getTaskServiceClient();
    const { data: members, error } = await client
        .from('members')
        .select('id, name, position, division, role, email')
        .eq('is_active', true)
        .order('name');
    if (error) throw new Error(`Gagal memuat members: ${error.message}`);
    return members || [];
}

/**
 * Cari dan filter tugas dalam batas otorisasi project user.
 */
export async function queryAccessibleTasks({
    member,
    accessibleProjects,
    scope = 'all_accessible', // 'my_tasks' | 'team_tasks' | 'all_accessible'
    projectId = null,
    status = null,
    priority = null,
    query = null,
    picName = null,
    dateRange = null, // 'today' | 'tomorrow' | 'this_week' | 'overdue' | 'all'
    limit = 50,
}) {
    const accessibleProjectIds = accessibleProjects.map(p => p.id);
    if (accessibleProjectIds.length === 0) {
        return [];
    }

    if (projectId && !accessibleProjectIds.includes(projectId)) {
        throw new Error('Akses ditolak: Anda tidak tergabung dalam workspace/project tersebut.');
    }

    const targetProjectIds = projectId ? [projectId] : accessibleProjectIds;

    const client = getTaskServiceClient();
    let dbQuery = client
        .from('tasks')
        .select('id, project_id, title, status, priority, folder, memo, start_date, deadline, pic_id, todos, update_logs, created_at, updated_at')
        .in('project_id', targetProjectIds)
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(limit);

    if (status) {
        if (status === 'active') {
            dbQuery = dbQuery.neq('status', 'Done');
        } else {
            dbQuery = dbQuery.eq('status', status);
        }
    }

    if (priority) {
        dbQuery = dbQuery.eq('priority', priority);
    }

    const { data: rawTasks, error } = await dbQuery;
    if (error) throw new Error(`Gagal memuat task: ${error.message}`);

    const projectMap = new Map(accessibleProjects.map(p => [p.id, p]));
    const authorIds = (rawTasks || []).map(t => {
        const meta = Array.isArray(t.todos) ? t.todos.find(td => td && (td.id === '__meta_task_props__' || td.isMetaTask)) : null;
        return meta?.author_id || meta?.authorId || (Array.isArray(t.update_logs) ? t.update_logs[0]?.authorId : null);
    }).filter(Boolean);

    const memberIds = Array.from(new Set([
        member.id,
        ...(rawTasks || []).map(t => t.pic_id).filter(Boolean),
        ...authorIds
    ]));

    let memberMap = new Map();
    if (memberIds.length > 0) {
        const { data: membersData } = await client
            .from('members')
            .select('id, name, position, division, role')
            .in('id', memberIds);
        memberMap = new Map((membersData || []).map(m => [m.id, m]));
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    let tasks = (rawTasks || []).map(t => {
        const project = projectMap.get(t.project_id);
        const pic = t.pic_id ? memberMap.get(t.pic_id) : null;
        const metaTodo = Array.isArray(t.todos) ? t.todos.find(td => td && (td.id === '__meta_task_props__' || td.isMetaTask)) : null;
        const authorId = metaTodo?.author_id || metaTodo?.authorId || (Array.isArray(t.update_logs) ? t.update_logs[0]?.authorId : null);
        const author = authorId ? memberMap.get(authorId) : null;
        const authorName = author?.name || metaTodo?.authorName || (Array.isArray(t.update_logs) ? t.update_logs[0]?.authorName : null) || 'Sistem';
        const todos = Array.isArray(t.todos) ? t.todos.filter(item => item && item.id !== '__meta_task_props__' && !item.isMetaTask) : [];
        const updateLogs = Array.isArray(t.update_logs) ? t.update_logs : (Array.isArray(metaTodo?.update_logs) ? metaTodo.update_logs : []);
        const proofFiles = Array.isArray(metaTodo?.proof_files) ? metaTodo.proof_files : [];
        const memo = t.memo || metaTodo?.memo || '';

        let deadlineInfo = 'Tanpa Deadline';
        let isOverdue = false;
        let isDueToday = false;
        if (t.deadline) {
            if (t.deadline < todayStr && t.status !== 'Done') {
                isOverdue = true;
                deadlineInfo = `${t.deadline} (Terlambat)`;
            } else if (t.deadline === todayStr) {
                isDueToday = true;
                deadlineInfo = `${t.deadline} (Hari ini)`;
            } else {
                deadlineInfo = t.deadline;
            }
        }

        return {
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            projectName: project?.name || 'Project',
            folder: t.folder || 'General',
            status: t.status || 'To Do',
            priority: t.priority || 'Medium',
            deadline: t.deadline || null,
            deadlineInfo,
            isOverdue,
            isDueToday,
            startDate: t.start_date || null,
            picId: t.pic_id || null,
            picName: pic?.name || 'Belum ada PIC',
            picDivision: pic?.division || null,
            authorId: authorId || null,
            authorName,
            memo,
            todosCount: todos.length,
            todosDoneCount: todos.filter(td => td?.done).length,
            updateLogsCount: updateLogs.length,
            proofFilesCount: proofFiles.length,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
        };
    });

    // Filter scope
    if (scope === 'my_tasks') {
        const normMyId = String(member.id).trim().toLowerCase();
        tasks = tasks.filter(t => 
            (t.picId && String(t.picId).trim().toLowerCase() === normMyId) ||
            (t.authorId && String(t.authorId).trim().toLowerCase() === normMyId)
        );
    } else if (scope === 'team_tasks') {
        const normMyId = String(member.id).trim().toLowerCase();
        tasks = tasks.filter(t => !t.picId || String(t.picId).trim().toLowerCase() !== normMyId);
    }

    // Filter keyword query
    if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        tasks = tasks.filter(t => 
            t.title.toLowerCase().includes(q) || 
            (t.memo && t.memo.toLowerCase().includes(q)) ||
            (t.projectName && t.projectName.toLowerCase().includes(q)) ||
            (t.picName && t.picName.toLowerCase().includes(q))
        );
    }

    // Filter picName
    if (picName && picName.trim()) {
        const pName = picName.trim().toLowerCase();
        tasks = tasks.filter(t => t.picName.toLowerCase().includes(pName));
    }

    // Filter dateRange
    if (dateRange) {
        if (dateRange === 'today') {
            tasks = tasks.filter(t => t.deadline === todayStr);
        } else if (dateRange === 'overdue') {
            tasks = tasks.filter(t => t.isOverdue);
        } else if (dateRange === 'tomorrow') {
            const tom = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
            tasks = tasks.filter(t => t.deadline === tom);
        } else if (dateRange === 'this_week') {
            const endOfWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
            tasks = tasks.filter(t => t.deadline && t.deadline >= todayStr && t.deadline <= endOfWeek);
        }
    }

    return tasks;
}

/**
 * Mengambil detail lengkap satu tugas dengan verifikasi otorisasi.
 */
export async function getAccessibleTaskDetails({ member, accessibleProjects, taskId }) {
    const accessibleProjectIds = accessibleProjects.map(p => p.id);
    const client = getTaskServiceClient();

    const { data: task, error } = await client
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

    if (error || !task) {
        throw new Error('Tugas tidak ditemukan.');
    }

    if (!accessibleProjectIds.includes(task.project_id)) {
        throw new Error('Akses ditolak: Anda tidak tergabung dalam workspace tugas ini.');
    }

    const project = accessibleProjects.find(p => p.id === task.project_id);
    let pic = null;
    if (task.pic_id) {
        const { data: mData } = await client.from('members').select('id, name, position, division').eq('id', task.pic_id).maybeSingle();
        pic = mData;
    }

    const metaTodo = Array.isArray(task.todos) ? task.todos.find(td => td && (td.id === '__meta_task_props__' || td.isMetaTask)) : null;
    const authorId = metaTodo?.author_id || metaTodo?.authorId || (Array.isArray(task.update_logs) ? task.update_logs[0]?.authorId : null);
    const cleanTodos = Array.isArray(task.todos) ? task.todos.filter(item => item && item.id !== '__meta_task_props__' && !item.isMetaTask) : [];
    const updateLogs = Array.isArray(task.update_logs) ? task.update_logs : (Array.isArray(metaTodo?.update_logs) ? metaTodo.update_logs : []);
    const proofFiles = Array.isArray(metaTodo?.proof_files) ? metaTodo.proof_files : [];
    const memo = task.memo || metaTodo?.memo || '';

    return {
        ...task,
        memo,
        todos: cleanTodos,
        update_logs: updateLogs,
        proof_files: proofFiles,
        author_id: authorId,
        authorId,
        projectName: project?.name || 'Project',
        picName: pic?.name || 'Tanpa PIC',
        picPosition: pic?.position || '',
        picDivision: pic?.division || '',
    };
}

/**
 * Membuat tugas baru dengan validasi ketat seluruh elemen.
 */
export async function createTaskForUser({ member, accessibleProjects, taskInput }) {
    const accessibleProjectIds = accessibleProjects.map(p => p.id);
    let { title, projectId, picId, deadline, priority, folder, memo, startDate, todos } = taskInput || {};

    if (!title?.trim()) {
        throw new Error('Elemen "title" (judul tugas) wajib diisi.');
    }

    // Smart default untuk projectId jika user hanya memiliki 1 project akses
    if (!projectId && accessibleProjects.length === 1) {
        projectId = accessibleProjects[0].id;
    }
    if (!projectId) {
        throw new Error('Elemen "projectId" (workspace/project tujuan) wajib ditentukan.');
    }
    if (!accessibleProjectIds.includes(projectId)) {
        throw new Error('Akses ditolak: Anda tidak tergabung dalam workspace/project tersebut.');
    }

    // Smart default untuk PIC jika tidak ditentukan (tunjuk ke pembuat/user sendiri)
    const targetPicId = picId || member.id;

    // Smart default deadline jika tidak ditentukan (default ke besok)
    const targetDeadline = deadline || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const targetPriority = priority || 'Medium';
    const targetFolder = folder || 'General';

    const client = getTaskServiceClient();
    const now = new Date().toISOString();
    const newTaskId = crypto.randomUUID();

    const normalizedTodos = (Array.isArray(todos) ? todos : [])
        .filter(td => td && (td.title || td.text))
        .map(td => ({
            id: crypto.randomUUID(),
            title: (td.title || td.text).trim(),
            done: Boolean(td.done),
            picId: td.picId || targetPicId,
            deadline: td.deadline || targetDeadline,
        }));

    const initialLog = [{
        id: crypto.randomUUID(),
        content: `Tugas dibuat melalui asisten Bebie AI oleh ${member.name}.`,
        authorId: member.id,
        authorName: member.name,
        createdAt: now,
    }];

    const metaTodo = {
        id: '__meta_task_props__',
        isMetaTask: true,
        author_id: member.id,
        authorId: member.id,
        authorName: member.name,
        memo: memo ? memo.trim() : '',
        update_logs: initialLog,
        proof_files: [],
    };

    const payload = {
        id: newTaskId,
        project_id: projectId,
        title: title.trim(),
        status: 'To Do',
        priority: targetPriority,
        folder: targetFolder,
        memo: memo ? memo.trim() : '',
        start_date: startDate || null,
        deadline: targetDeadline,
        pic_id: targetPicId,
        todos: [...normalizedTodos, metaTodo],
        update_logs: initialLog,
        created_at: now,
        updated_at: now,
    };

    let { error } = await client.from('tasks').insert([payload]);
    if (error && error.message) {
        let safePayload = { ...payload };
        if (error.message.includes('folder')) delete safePayload.folder;
        if (error.message.includes('start_date')) delete safePayload.start_date;
        if (error.message.includes('memo')) delete safePayload.memo;
        if (error.message.includes('update_logs')) delete safePayload.update_logs;
        const retry = await client.from('tasks').insert([safePayload]);
        error = retry.error;
    }

    if (error) {
        throw new Error(`Gagal menyimpan task ke database: ${error.message}`);
    }

    const project = accessibleProjects.find(p => p.id === projectId);
    return {
        id: newTaskId,
        title: payload.title,
        projectName: project?.name || 'Project',
        status: payload.status,
        priority: payload.priority,
        folder: payload.folder,
        deadline: payload.deadline,
        picId: payload.pic_id,
        memo: payload.memo,
        todosCount: normalizedTodos.length,
    };
}

/**
 * Memperbarui status tugas.
 */
export async function updateTaskStatusForUser({ member, accessibleProjects, taskId, status, note }) {
    const task = await getAccessibleTaskDetails({ member, accessibleProjects, taskId });
    const client = getTaskServiceClient();
    const now = new Date().toISOString();

    const existingLogs = Array.isArray(task.update_logs) ? task.update_logs : [];
    const logText = `Status diubah dari "${task.status}" menjadi "${status}" oleh ${member.name}${note ? `. Catatan: ${note}` : ''}`;
    const newLog = {
        id: crypto.randomUUID(),
        content: logText,
        authorId: member.id,
        authorName: member.name,
        createdAt: now,
    };

    const { error } = await client
        .from('tasks')
        .update({
            status,
            update_logs: [newLog, ...existingLogs],
            updated_at: now,
        })
        .eq('id', taskId);

    if (error) throw new Error(`Gagal memperbarui status: ${error.message}`);

    return {
        id: taskId,
        title: task.title,
        previousStatus: task.status,
        newStatus: status,
        projectName: task.projectName,
        note: logText,
    };
}

/**
 * Menambahkan riwayat progres / update log ke tugas.
 */
export async function addTaskUpdateLogForUser({ member, accessibleProjects, taskId, content }) {
    const task = await getAccessibleTaskDetails({ member, accessibleProjects, taskId });
    const client = getTaskServiceClient();
    const now = new Date().toISOString();

    const existingLogs = Array.isArray(task.update_logs) ? task.update_logs : [];
    const newLog = {
        id: crypto.randomUUID(),
        content: content.trim(),
        authorId: member.id,
        authorName: member.name,
        createdAt: now,
    };

    const { error } = await client
        .from('tasks')
        .update({
            update_logs: [newLog, ...existingLogs],
            updated_at: now,
        })
        .eq('id', taskId);

    if (error) throw new Error(`Gagal menambahkan update log: ${error.message}`);

    return {
        id: taskId,
        title: task.title,
        projectName: task.projectName,
        addedLog: newLog,
    };
}

/**
 * Melampirkan file berkas/bukti penuntasan ke tugas.
 */
export async function attachTaskFileForUser({ member, accessibleProjects, taskId, fileName, fileUrl, note }) {
    const task = await getAccessibleTaskDetails({ member, accessibleProjects, taskId });
    const client = getTaskServiceClient();
    const now = new Date().toISOString();

    const existingTodos = Array.isArray(task.todos) ? task.todos : [];
    let metaTodo = existingTodos.find(t => t && (t.id === '__meta_task_props__' || t.isMetaTask));
    const existingProofs = Array.isArray(metaTodo?.proof_files) ? metaTodo.proof_files : [];

    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    const newProof = {
        id: crypto.randomUUID(),
        name: fileName || 'Lampiran Berkas',
        url: fileUrl,
        path: '',
        size: 0,
        ext,
        mimeType: '',
        uploadedBy: member.name,
        uploadedById: member.id,
        uploadedAt: now,
        note: note ? note.trim() : '',
    };
    const updatedProofs = [newProof, ...existingProofs];

    const cleanTodos = existingTodos.filter(t => t && t.id !== '__meta_task_props__' && !t.isMetaTask);
    const newMetaTodo = {
        ...(metaTodo || {}),
        id: '__meta_task_props__',
        isMetaTask: true,
        proof_files: updatedProofs,
    };

    const existingLogs = Array.isArray(task.update_logs) ? task.update_logs : [];
    const newLog = {
        id: crypto.randomUUID(),
        content: `Berkas "${newProof.name}" dilampirkan oleh ${member.name}${note ? `: ${note}` : ''}`,
        authorId: member.id,
        authorName: member.name,
        createdAt: now,
    };

    const updatePayload = {
        todos: [...cleanTodos, newMetaTodo],
        update_logs: [newLog, ...existingLogs],
        updated_at: now,
    };

    const { error } = await client
        .from('tasks')
        .update(updatePayload)
        .eq('id', taskId);

    if (error) throw new Error(`Gagal melampirkan berkas: ${error.message}`);

    return {
        id: taskId,
        title: task.title,
        projectName: task.projectName,
        attachedFile: newProof,
    };
}
