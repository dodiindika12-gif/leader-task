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
    if (project.description === 'personal') return true;
    return Boolean(
        project.owner_id &&
        typeof project.name === 'string' &&
        project.name.startsWith('Task ')
    );
}

/**
 * Cek apakah sebuah project dapat diakses oleh memberId.
 * Workspace pribadi hanya untuk pemiliknya (tanpa pengecualian eksekutif).
 * Workspace non-pribadi selalu dianggap dapat diakses pada level helper ini;
 * pemfilteran berbasis role/akses dilakukan oleh pemanggil.
 */
export function canAccessPersonalProject(project, memberId) {
    if (!isPersonalProject(project)) return true;
    return Boolean(memberId && project.owner_id === memberId);
}
