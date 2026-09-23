/**
 * Deteksi apakah sebuah project (workspace) adalah workspace pribadi.
 *
 * Workspace pribadi ditandai dengan `description === 'personal'`.
 * Fallback heuristik: project milik seseorang (punya owner_id) dengan nama
 * bawaan "Task <Nama>" (lihat getPersonalWorkspaceName / trigger DB).
 *
 * Task di dalam workspace pribadi TIDAK boleh dieskalasi ke atasan dan
 * hanya boleh dilihat oleh pemiliknya.
 */
export function isPersonalProject(project) {
    if (!project) return false;
    return project.description === 'personal';
}

/**
 * Cek apakah sebuah project dapat diakses oleh memberId.
 * Workspace pribadi dapat diakses oleh pemiliknya, co-owners, atau anggota yang secara eksplisit dishare.
 */
export function canAccessPersonalProject(project, memberId, projectAccess = []) {
    if (!isPersonalProject(project)) return true;
    if (!memberId) return false;
    const norm = String(memberId).trim().toLowerCase();
    if (project.owner_id && String(project.owner_id).trim().toLowerCase() === norm) return true;
    if (Array.isArray(project.co_owners) && project.co_owners.some(co => String(co).trim().toLowerCase() === norm)) return true;
    if (Array.isArray(projectAccess) && projectAccess.some(a => a.project_id === project.id && String(a.member_id).trim().toLowerCase() === norm)) return true;
    return false;
}
