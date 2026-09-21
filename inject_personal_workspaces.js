import { supabase } from './lib/supabase.js';

export function getPersonalWorkspaceName(fullName) {
    if (!fullName) return 'Task Pribadi';
    const clean = fullName.trim().replace(/^(dr\.|drg\.|drs\.|dra\.|ir\.|h\.|hj\.)\s+/i, '');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Task Pribadi';
    
    let firstName = parts[0];
    if (parts[0].toLowerCase() === 'la' && parts[1] && parts[1].toLowerCase() === 'ode') {
        firstName = 'La Ode';
    }
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    return `Task ${firstName}`;
}

async function injectPersonalWorkspaces() {
    console.log('--- Memulai Injeksi Workspace Pribadi untuk User Lama ---');

    // 1. Ambil semua anggota
    const { data: members, error: membersError } = await supabase
        .from('members')
        .select('*');

    if (membersError) {
        console.error('Gagal mengambil data members:', membersError);
        return;
    }

    console.log(`Ditemukan ${members.length} anggota.`);

    // 2. Ambil semua proyek yang ada
    const { data: existingProjects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, owner_id, description');

    if (projectsError) {
        console.error('Gagal mengambil data projects:', projectsError);
        return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const member of members) {
        const workspaceName = getPersonalWorkspaceName(member.name);

        // Periksa apakah member sudah memiliki workspace pribadi
        const alreadyHasWorkspace = existingProjects.some(p => 
            p.owner_id === member.id && (p.name === workspaceName || p.description === 'personal')
        );

        if (alreadyHasWorkspace) {
            console.log(`[SKIP] ${member.name} sudah memiliki workspace.`);
            skippedCount++;
            continue;
        }

        const projectId = crypto.randomUUID();
        const projectPayload = {
            id: projectId,
            name: workspaceName,
            color: member.color || '#6366f1',
            is_pinned: false,
            show_in_calendar: false,
            division: member.division || 'Task ABS',
            owner_id: member.id,
            folders: ['General'],
            description: 'personal'
        };

        const { error: insertError } = await supabase
            .from('projects')
            .insert(projectPayload);

        if (insertError) {
            console.error(`[ERROR] Gagal membuat workspace untuk ${member.name}:`, insertError.message);
            continue;
        }

        // Daftarkan akses pemilik di project_access
        const { error: accessError } = await supabase
            .from('project_access')
            .insert({
                project_id: projectId,
                member_id: member.id
            });

        if (accessError) {
            console.warn(`[WARN] Project_access warning untuk ${member.name}:`, accessError.message);
        }

        console.log(`[SUCCESS] Dibuat: "${workspaceName}" untuk ${member.name} (${member.division})`);
        createdCount++;
    }

    console.log('--- Selesai Injeksi ---');
    console.log(`Total dibuat: ${createdCount}, Dilewati: ${skippedCount}`);
}

injectPersonalWorkspaces().catch(console.error);
