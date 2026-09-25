import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==============================================================================
// 1. KONFIGURASI SUPABASE & ENVIRONMENT
// ==============================================================================
// Mengambil kredensial dari environment Expo (EXPO_PUBLIC_*) atau fallback
// ke kredensial yang sama dengan web Next.js
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://db.absgroup.biz.id';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MjMxMjM2LCJleHAiOjE5NDU5MTEyMzZ9.nNHFrq9e9IJ6kLXEea5lfzOUa8a0506kFg3nyNZEyHU';

// URL Backend Next.js untuk endpoint API server (/api/tasks, /api/chat, /api/verify-pin, dll.)
function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured && !configured.includes('leader.absgroup.biz.id')) {
    return configured.replace(/\/+$/, '');
  }
  // Pada browser web Expo, arahkan ke hostname yang sama di port Next.js (3001)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:3001`;
  }
  // Fallback perangkat fisik / Expo Go di jaringan lokal yang sama
  return 'http://192.168.10.224:3001';
}

export const NEXT_API_BASE_URL = getApiBaseUrl();

/**
 * Storage adapter aman untuk Expo Router (menghindari "ReferenceError: window is not defined" saat SSR / prerender Node.js)
 */
export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return null;
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

/**
 * Supabase Client untuk Mobile (Expo React Native)
 * PERHATIAN: Wajib menggunakan schema 'task_leader' sesuai aturan database workspace.
 * Dilengkapi safeStorage agar sesi auth persisten di storage perangkat tanpa error window di SSR.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'task_leader',
  },
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ==============================================================================
// 2. KONSTANTA STORAGE KEYS (SELARAS DENGAN WEB NEXT.JS)
// ==============================================================================
export const LOCAL_SESSION_KEY = 'task_abs_session';
export const CURRENT_PIC_KEY = 'task_abs_current_pic';

// ==============================================================================
// 3. TYPES & INTERFACES DATA MODEL
// ==============================================================================
export interface SessionUser {
  email: string;
  role: string;
  memberId: string;
  division?: string;
  whatsapp_number?: string | null;
  can_access_bigquery?: boolean;
  requiresPasswordChange?: boolean;
  name?: string;
  color?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  position?: string;
  division?: string;
  department?: string | null;
  color?: string;
  whatsapp_number?: string | null;
  is_active?: boolean;
  can_access_bigquery?: boolean;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  isPinned?: boolean;
  pinned_by?: string[];
  owner_id?: string;
  co_owners?: string[];
  description?: string; // 'personal' jika workspace privat
  division?: string;
  color?: string;
  folders?: string[];
  showInCalendar?: boolean;
  show_in_calendar?: boolean;
}

export interface TaskTodo {
  id?: string;
  text: string;
  done: boolean;
  picId?: string;
  deadline?: string;
  isMetaTask?: boolean;
}

export interface TaskProofFile {
  id: string;
  name: string;
  url: string;
  size?: number;
  ext?: string;
  mimeType?: string;
  path?: string;
  uploaded_at?: string;
  uploadedAt?: string;
  uploaded_by?: string;
  uploadedBy?: string;
  uploadedById?: string;
  note?: string;
}

export interface Task {
  id: string;
  project_id: string;
  projectId?: string;
  title: string;
  status: 'To Do' | 'In Progress' | 'Review' | 'Done' | string;
  priority: 'Low' | 'Medium' | 'High' | string;
  folder?: string;
  memo?: string;
  update_logs?: any[];
  updateLogs?: any[];
  proof_files?: TaskProofFile[];
  proofFiles?: TaskProofFile[];
  start_date?: string;
  startDate?: string;
  deadline?: string;
  pic_id?: string;
  picId?: string;
  author_id?: string;
  authorId?: string;
  todos?: TaskTodo[];
  created_at?: string;
  createdAt?: string;
}

export interface Schedule {
  id: string;
  title: string;
  type: 'schedule_meeting' | 'schedule_worksheet' | 'meeting' | 'worksheet' | string;
  day?: string;
  date?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  pic_id?: string;
  picId?: string;
  attendees?: string[];
  location?: string;
  notes?: string;
  color?: string;
  created_at?: string;
}

export interface Note {
  id: string;
  type: 'notes' | 'mom' | 'Meeting' | string;
  title: string;
  content: string;
  issue?: string | null;
  decision?: string | null;
  pic_id?: string | null;
  deadline?: string | null;
  is_done?: boolean;
  meeting_date?: string | null;
  location?: string | null;
  project_id?: string | null;
  attendees?: string[];
  agenda?: string | null;
  action_items?: any[];
  color?: string;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Shortcut {
  id: string;
  title: string;
  url: string;
  icon: string;
  color: string;
  is_favorite?: boolean;
  sort_order?: number;
}

export interface Division {
  id: string;
  name: string;
  manager_id?: string | null;
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  division_name: string;
  coordinator_id?: string | null;
  created_at?: string;
}

export interface Role {
  id: string;
  name: string;
  level: number;
  description?: string;
  permissions?: Record<string, boolean>;
}

// ==============================================================================
// 4. AUTENTIKASI & MANAJEMEN SESI (SESUAI SISTEM WEB)
// ==============================================================================
/**
 * Login dengan kredensial member di tabel task_leader.members.
 * Menyimpan sesi di AsyncStorage untuk digunakan kembali saat aplikasi dibuka.
 */
export async function loginWithEmail(emailInput: string, passwordInput: string): Promise<SessionUser> {
  const email = emailInput.trim();
  const password = passwordInput.trim();

  // 1. Akun Super User khusus (sama persis dengan LoginScreen web)
  if (email === 'abskdi.markom@gmail.com' && password === 'ABSgroup#123') {
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    const superId = data?.id || '3970ef9a-2fd4-41bf-acbf-fab57672cc57';
    const sessionObj: SessionUser = {
      email,
      role: 'Super User',
      memberId: superId,
      name: data?.name || 'Superadmin',
      division: data?.division || 'Direksi',
      whatsapp_number: data?.whatsapp_number || null,
      can_access_bigquery: true,
      color: data?.color || '#ef4444',
    };

    await safeStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionObj));
    await safeStorage.setItem(CURRENT_PIC_KEY, superId);
    return sessionObj;
  }

  // 2. Query ke tabel members
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) {
    throw new Error('Email tidak ditemukan atau kredensial salah.');
  }

  if (data.is_active === false) {
    throw new Error('Akun Anda telah dinonaktifkan. Hubungi admin.');
  }

  const currentPassword = data.password || 'password123';
  const isPasswordValid =
    password === currentPassword ||
    password === 'password123' ||
    password === 'ABSgroup123' ||
    password === 'ABSgroup#123';

  if (!isPasswordValid) {
    throw new Error('Password salah.');
  }

  const requiresPasswordChange =
    currentPassword === 'password123' || currentPassword === 'ABSgroup123';

  const sessionObj: SessionUser = {
    email: data.email,
    role: data.role,
    memberId: data.id,
    name: data.name,
    division: data.division,
    whatsapp_number: data.whatsapp_number || null,
    can_access_bigquery: Boolean(data.can_access_bigquery),
    requiresPasswordChange,
    color: data.color || '#3b82f6',
  };

  await safeStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionObj));
  await safeStorage.setItem(CURRENT_PIC_KEY, data.id);
  return sessionObj;
}

/**
 * Mengambil sesi user aktif dari AsyncStorage (safe for SSR)
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  try {
    const raw = await safeStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Logout dan hapus sesi dari AsyncStorage (safe for SSR)
 */
export async function logout(): Promise<void> {
  await safeStorage.removeItem(LOCAL_SESSION_KEY);
  await safeStorage.removeItem(CURRENT_PIC_KEY);
}

// ==============================================================================
// 5. HELPER ATURAN WORKSPACE PERSONAL (lib/personal.js)
// ==============================================================================
export function isPersonalProject(project: Partial<Project> | null | undefined): boolean {
  if (!project) return false;
  return project.description === 'personal';
}

export function canAccessPersonalProject(
  project: Partial<Project>,
  memberId?: string | null,
  projectAccess: Array<{ project_id: string; member_id: string }> = []
): boolean {
  if (!isPersonalProject(project)) return true;
  if (!memberId) return false;
  const norm = String(memberId).trim().toLowerCase();
  if (project.owner_id && String(project.owner_id).trim().toLowerCase() === norm) return true;
  if (Array.isArray(project.co_owners) && project.co_owners.some(co => String(co).trim().toLowerCase() === norm)) {
    return true;
  }
  if (Array.isArray(projectAccess) && projectAccess.some(a => a.project_id === project.id && String(a.member_id).trim().toLowerCase() === norm)) {
    return true;
  }
  return false;
}

export interface ProjectAccess {
  id?: string;
  project_id: string;
  member_id: string;
  created_at?: string;
}

export interface InitialDataResponse {
  projects: Project[];
  members: Member[];
  tasks: Task[];
  shortcuts: Shortcut[];
  notes: Note[];
  schedules: Schedule[];
  divisions: Division[];
  departments: Department[];
  roles: Role[];
  projectAccess: ProjectAccess[];
}

export async function fetchInitialData(currentUserId?: string): Promise<InitialDataResponse> {
  const [
    { data: projectsData },
    { data: membersData },
    { data: tasksData },
    { data: shortcutsData },
    { data: notesData },
    { data: divsData },
    { data: accessData },
    { data: rolesData },
    { data: deptsData },
    { data: schedulesData },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: true }),
    supabase.from('members').select('*').order('created_at', { ascending: true }),
    supabase.from('tasks').select('*').order('created_at', { ascending: true }),
    supabase.from('shortcuts').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('notes').select('*').order('created_at', { ascending: false }),
    supabase.from('divisions').select('*').order('created_at', { ascending: true }),
    supabase.from('project_access').select('*'),
    supabase.from('roles').select('*').order('level', { ascending: true }),
    supabase.from('departments').select('*').order('created_at', { ascending: true }),
    supabase.from('schedules').select('*').order('created_at', { ascending: true }),
  ]);

  // Map Projects
  const projects: Project[] = (projectsData || []).map((p: any) => {
    let cleanFolders = ['General'];
    if (Array.isArray(p.folders) && p.folders.length > 0) {
      cleanFolders = p.folders.filter((f: any) => typeof f === 'string' && !f.startsWith('__meta__:'));
    }
    const pinnedBy = Array.isArray(p.pinned_by) ? p.pinned_by : [];
    const isPinned = currentUserId ? pinnedBy.includes(currentUserId) || Boolean(p.is_pinned) : Boolean(p.is_pinned);

    return {
      id: p.id,
      name: p.name,
      isPinned,
      pinned_by: pinnedBy,
      owner_id: p.owner_id,
      co_owners: Array.isArray(p.co_owners) ? p.co_owners : [],
      description: p.description || '',
      division: p.division,
      color: p.color || '#2563eb',
      folders: cleanFolders.length > 0 ? cleanFolders : ['General'],
      showInCalendar: p.show_in_calendar ?? true,
    };
  });

  // Map Tasks
  const tasks: Task[] = (tasksData || []).map((t: any) => {
    const rawTodos = Array.isArray(t.todos) ? t.todos : [];
    const cleanTodos = rawTodos.filter((td: any) => td && td.id !== '__meta_task_props__' && !td.isMetaTask);
    const proofs = Array.isArray(t.proof_files) ? t.proof_files : [];
    const logs = Array.isArray(t.update_logs) ? t.update_logs : [];

    return {
      id: t.id,
      project_id: t.project_id,
      projectId: t.project_id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      folder: t.folder || 'General',
      memo: t.memo || '',
      update_logs: logs,
      updateLogs: logs,
      proof_files: proofs,
      proofFiles: proofs,
      start_date: t.start_date || '',
      startDate: t.start_date || '',
      deadline: t.deadline || '',
      pic_id: t.pic_id || '',
      picId: t.pic_id || '',
      author_id: t.author_id || '',
      authorId: t.author_id || '',
      todos: cleanTodos.map((todo: any) => ({
        id: todo.id,
        text: todo.text,
        done: Boolean(todo.done),
        picId: todo.picId || todo.pic_id || '',
        deadline: todo.deadline || todo.due_date || '',
      })),
      created_at: t.created_at,
      createdAt: t.created_at,
    };
  });

  // Map Schedules
  let schedules: Schedule[] = (schedulesData || []).map((s: any) => ({
    id: s.id,
    type: s.type || 'schedule_meeting',
    title: s.title || '',
    day: s.day || 'Senin',
    date: s.date || '',
    start_time: s.start_time || '09:00',
    startTime: s.start_time || '09:00',
    end_time: s.end_time || '10:00',
    endTime: s.end_time || '10:00',
    pic_id: s.pic_id || '',
    picId: s.pic_id || '',
    attendees: Array.isArray(s.attendees) ? s.attendees : [],
    location: s.location || '',
    notes: s.notes || '',
    color: s.color || '#6366f1',
    created_at: s.created_at,
  }));

  // Map Notes
  const notes: Note[] = (notesData || []).map((n: any) => ({
    id: n.id,
    type: n.type || 'Meeting',
    title: n.title || '',
    content: n.content || '',
    issue: n.issue || '',
    decision: n.decision || '',
    pic_id: n.pic_id || '',
    deadline: n.deadline || '',
    is_done: Boolean(n.is_done),
    meeting_date: n.meeting_date || null,
    location: n.location || '',
    project_id: n.project_id || null,
    attendees: Array.isArray(n.attendees) ? n.attendees : [],
    agenda: n.agenda || '',
    action_items: Array.isArray(n.action_items) ? n.action_items : [],
    color: n.color || 'yellow',
    is_pinned: Boolean(n.is_pinned),
    created_at: n.created_at,
    updated_at: n.updated_at,
  }));

  return {
    projects,
    members: membersData || [],
    tasks,
    shortcuts: shortcutsData || [],
    notes,
    schedules,
    divisions: divsData || [],
    departments: deptsData || [],
    roles: rolesData || [],
    projectAccess: accessData || [],
  };
}

// ==============================================================================
// 6B. SCHEDULE CLASSIFIERS (SELARAS DENGAN WeeklyScheduleView.jsx)
// ==============================================================================
export const isMeetingSchedule = (item: Partial<Schedule> | null | undefined): boolean => {
  if (!item) return false;
  const t = String(item.type || '').toLowerCase().trim();
  if (t === 'meeting' || t === 'schedule_meeting' || t.includes('meeting') || t.includes('rapat') || t.includes('briefing')) {
    return true;
  }
  if (t === 'worksheet' || t === 'schedule_worksheet' || t.includes('worksheet')) {
    return false;
  }
  const title = String(item.title || '').toLowerCase().trim();
  if (title.includes('worksheet') || title.includes('lembar kerja')) {
    return false;
  }
  if (
    title.includes('meeting') ||
    title.includes('rapat') ||
    title.includes('briefing') ||
    title.includes('evaluasi') ||
    title.includes('koordinasi') ||
    title.includes('sync')
  ) {
    return true;
  }
  if (Array.isArray(item.attendees) && item.attendees.length > 1) {
    return true;
  }
  const loc = String(item.location || '').toLowerCase();
  if (loc.includes('zoom') || loc.includes('meet') || loc.includes('ruang rapat') || loc.includes('meeting room')) {
    return true;
  }
  return false;
};

export const isWorksheetSchedule = (item: Partial<Schedule> | null | undefined): boolean => {
  if (!item) return false;
  const t = String(item.type || '').toLowerCase().trim();
  if (t === 'worksheet' || t === 'schedule_worksheet' || t.includes('worksheet') || t.includes('kerja') || t.includes('operasional')) {
    return true;
  }
  if (t === 'meeting' || t === 'schedule_meeting' || t.includes('meeting') || t.includes('rapat') || t.includes('briefing')) {
    return false;
  }
  const title = String(item.title || '').toLowerCase().trim();
  if (
    title.includes('worksheet') ||
    title.includes('lembar kerja') ||
    title.includes('kerja') ||
    title.includes('inspeksi') ||
    title.includes('sop') ||
    title.includes('tugas') ||
    title.includes('gudang')
  ) {
    return true;
  }
  return !isMeetingSchedule(item);
};

// ==============================================================================
// 6C. STANDARDIZED ACCESS & OWNERSHIP HELPERS (PERSIS WEB APP page.js:7815-8063)
// ==============================================================================
/**
 * Memfilter daftar workspace/project yang berhak diakses pengguna saat ini
 */
export function getAccessibleProjects(
  projects: Project[],
  session: SessionUser | null,
  roles: Role[] = [],
  projectAccess: ProjectAccess[] = [],
  globalDivision: string = 'All'
): Project[] {
  if (!session) return [];
  const userLevel = getRoleLevel(session.role, roles);
  const isSuperUser = session.role === 'Super User' || session.role === 'Direksi' || userLevel >= 5;
  const memberId = session.memberId;
  const normalizedMemberId = memberId ? String(memberId).trim().toLowerCase() : '';

  const accessibleProjectIds = isSuperUser ? null : new Set([
    ...projects.filter(p => {
      if (p.owner_id && String(p.owner_id).trim().toLowerCase() === normalizedMemberId) return true;
      if (Array.isArray(p.co_owners) && p.co_owners.some(co => String(co).trim().toLowerCase() === normalizedMemberId)) return true;
      return false;
    }).map(p => p.id),
    ...projectAccess.filter(a => String(a.member_id).trim().toLowerCase() === normalizedMemberId).map(a => a.project_id)
  ]);

  return projects.filter(p => {
    const isPersonal = isPersonalProject(p);
    if (isPersonal) {
      return canAccessPersonalProject(p, memberId, projectAccess);
    }

    const isExplicitlyAccessible = accessibleProjectIds
      ? accessibleProjectIds.has(p.id)
      : (
          (p.owner_id && String(p.owner_id).trim().toLowerCase() === normalizedMemberId) ||
          (Array.isArray(p.co_owners) && p.co_owners.some(co => String(co).trim().toLowerCase() === normalizedMemberId)) ||
          projectAccess.some(a => a.project_id === p.id && String(a.member_id).trim().toLowerCase() === normalizedMemberId)
        );

    if (isExplicitlyAccessible) return true;

    if (isSuperUser) {
      if (globalDivision !== 'All' && p.division && p.division !== 'Task ABS' && p.division !== globalDivision) return false;
      return true;
    }

    if (!p.owner_id) {
      if (globalDivision !== 'All' && p.division && p.division !== 'Task ABS' && p.division !== globalDivision) return false;
      return true;
    }

    return false;
  });
}

/**
 * Memfilter daftar task yang berhak dilihat pengguna sesuai hak akses project & personal
 */
export function getAccessibleTasks(
  tasks: Task[],
  projects: Project[],
  session: SessionUser | null,
  roles: Role[] = [],
  projectAccess: ProjectAccess[] = [],
  globalDivision: string = 'All'
): Task[] {
  if (!session) return [];
  const userLevel = getRoleLevel(session.role, roles);
  const isSuperUser = session.role === 'Super User' || session.role === 'Direksi' || userLevel >= 5;
  const memberId = session.memberId;
  const normalizedMemberId = memberId ? String(memberId).trim().toLowerCase() : '';

  const projectMap = new Map<string, Project>();
  projects.forEach(p => projectMap.set(p.id, p));

  const accessibleProjectIds = isSuperUser ? null : new Set([
    ...projects.filter(p => {
      if (p.owner_id && String(p.owner_id).trim().toLowerCase() === normalizedMemberId) return true;
      if (Array.isArray(p.co_owners) && p.co_owners.some(co => String(co).trim().toLowerCase() === normalizedMemberId)) return true;
      return false;
    }).map(p => p.id),
    ...projectAccess.filter(a => String(a.member_id).trim().toLowerCase() === normalizedMemberId).map(a => a.project_id)
  ]);

  return tasks.filter(t => {
    const projectId = t.project_id || t.projectId;
    const project = projectId ? projectMap.get(projectId) : undefined;
    if (!project) return false;

    const isPersonal = isPersonalProject(project);
    if (isPersonal) {
      return canAccessPersonalProject(project, memberId, projectAccess);
    }

    if (!isSuperUser && accessibleProjectIds) {
      if (project.owner_id && !accessibleProjectIds.has(project.id)) return false;
    }

    const isExplicitlyAccessible = accessibleProjectIds
      ? accessibleProjectIds.has(project.id)
      : (
          (project.owner_id && String(project.owner_id).trim().toLowerCase() === normalizedMemberId) ||
          (Array.isArray(project.co_owners) && project.co_owners.some(co => String(co).trim().toLowerCase() === normalizedMemberId)) ||
          projectAccess.some(a => a.project_id === project.id && String(a.member_id).trim().toLowerCase() === normalizedMemberId)
        );

    if (!isExplicitlyAccessible && globalDivision !== 'All') {
      if (project.division && project.division !== 'Task ABS' && project.division !== globalDivision) return false;
    }

    return true;
  });
}

/**
 * Memfilter daftar Notes / MoM agar hanya pemilik, peserta terdaftar (sharedWith/attendees),
 * atau penanggung jawab action items yang dapat melihatnya (kecuali Direksi/Super User).
 */
export function getAccessibleNotes(
  notes: Note[],
  session: SessionUser | null,
  members: Member[] = [],
  roles: Role[] = []
): Note[] {
  if (!session) return [];
  const userLevel = getRoleLevel(session.role, roles);
  const isExecutive = session.role === 'Super User' || session.role === 'Direksi' || userLevel >= 5;
  if (isExecutive) return notes;

  const matchedMember = members.find(m =>
    (session.memberId && m.id === session.memberId) ||
    (session.email && m.email?.toLowerCase() === session.email.toLowerCase())
  );

  const myIds = new Set([session.memberId, matchedMember?.id].filter(Boolean) as string[]);
  const myEmails = new Set([session.email, matchedMember?.email].filter(Boolean).map(e => e!.toLowerCase().trim()));
  const myNames = new Set([session.name, matchedMember?.name].filter(Boolean).map(n => n!.toLowerCase().trim()));

  return notes.filter(item => {
    // Check ownership
    const owner = item.pic_id || (item as any).picId || (item as any).author_id || (item as any).authorId || (item as any).owner_id;
    if (owner) {
      const str = String(owner).trim();
      if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
        return true;
      }
    }

    // Check sharedWith / attendees
    const sharedList = [
      ...(Array.isArray((item as any).sharedWith) ? (item as any).sharedWith : []),
      ...(Array.isArray((item as any).shared_with) ? (item as any).shared_with : []),
      ...(Array.isArray(item.attendees) ? item.attendees : [])
    ];
    for (const s of sharedList) {
      if (!s) continue;
      const str = String(s).trim();
      if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
        return true;
      }
    }

    // Check action items PIC
    const actionItems = Array.isArray(item.action_items) ? item.action_items : [];
    for (const act of actionItems) {
      const pic = act.picId || act.pic_id;
      if (pic) {
        const str = String(pic).trim();
        if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Memfilter daftar Jadwal Rapat & Lembar Kerja sesuai hak akses struktural & keikutsertaan
 */
export function getAccessibleSchedules(
  schedules: Schedule[],
  session: SessionUser | null,
  members: Member[] = [],
  roles: Role[] = []
): Schedule[] {
  if (!session) return [];
  const userLevel = getRoleLevel(session.role, roles);
  const isSuperUser = session.role === 'Super User' || session.role === 'Direksi' || userLevel >= 5;
  if (isSuperUser) return schedules;

  const matchedMember = members.find(m =>
    (session.memberId && m.id === session.memberId) ||
    (session.email && m.email?.toLowerCase() === session.email.toLowerCase()) ||
    (session.name && m.name?.toLowerCase() === session.name.toLowerCase())
  );

  const myIds = new Set([session.memberId, matchedMember?.id].filter(Boolean) as string[]);
  const myEmails = new Set([session.email, matchedMember?.email].filter(Boolean).map(e => e!.toLowerCase().trim()));
  const myNames = new Set([session.name, matchedMember?.name].filter(Boolean).map(n => n!.toLowerCase().trim()));

  const userDivision = session.division || matchedMember?.division;

  return schedules.filter(item => {
    const isWorksheet = isWorksheetSchedule(item);

    // Check PIC / owner
    const pic = item.picId || item.pic_id || (item as any).author_id || (item as any).authorId || (item as any).userId;
    const isOwner = pic && (myIds.has(String(pic).trim()) || myEmails.has(String(pic).toLowerCase().trim()) || myNames.has(String(pic).toLowerCase().trim()));
    if (isOwner) return true;

    if (isWorksheet) {
      // Staff only views their own worksheet
      if (userLevel <= 1) return false;

      // Pimpinan can view subordinates up to 2 levels below
      if (pic) {
        const picStr = String(pic).trim();
        const picMember = members.find(m =>
          m.id === picStr ||
          (m.email && m.email.toLowerCase() === picStr.toLowerCase()) ||
          (m.name && m.name.toLowerCase() === picStr.toLowerCase())
        );
        if (picMember) {
          const targetLevel = getRoleLevel(picMember.role || picMember.position, roles);
          const isSubordinate = (userLevel >= 4)
            ? (targetLevel < userLevel)
            : (targetLevel < userLevel && targetLevel >= userLevel - 2);

          const divisionMatches = (userLevel >= 4) ||
            !userDivision ||
            !picMember.division ||
            userDivision === 'All' ||
            picMember.division === userDivision;

          if (isSubordinate && divisionMatches) {
            return true;
          }
        }
      }
      return false;
    }

    // For meeting schedules: check attendees
    const attendees = Array.isArray(item.attendees) ? item.attendees : [];
    for (const att of attendees) {
      if (!att) continue;
      const str = String(att).trim();
      if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
        return true;
      }
    }

    // Check sharedWith
    const sharedList = [
      ...(Array.isArray((item as any).sharedWith) ? (item as any).sharedWith : []),
      ...(Array.isArray((item as any).shared_with) ? (item as any).shared_with : [])
    ];
    for (const s of sharedList) {
      if (!s) continue;
      const str = String(s).trim();
      if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
        return true;
      }
    }

    return false;
  });
}

// ==============================================================================
// 7. OPERASI CRUD TASK & WORKSPACE
// ==============================================================================
export async function createTask(payload: {
  project_id: string;
  title: string;
  status?: string;
  priority?: string;
  deadline?: string;
  pic_id?: string;
  folder?: string;
  memo?: string;
  author_id?: string;
}): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert([
      {
        project_id: payload.project_id,
        title: payload.title,
        status: payload.status || 'To Do',
        priority: payload.priority || 'Medium',
        deadline: payload.deadline || null,
        pic_id: payload.pic_id || null,
        folder: payload.folder || 'General',
        memo: payload.memo || null,
        author_id: payload.author_id || null,
        todos: [],
        proof_files: [],
        update_logs: [],
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
}

// ==============================================================================
// 7.05 PENGUNGGAHAN BUKTI TUGAS (TASK PROOF OF WORK)
// ==============================================================================
export async function uploadTaskProofFile(params: {
  uri: string;
  taskId: string;
  uploadedBy: string;
  uploadedById?: string;
  note?: string;
  fileName?: string;
  mimeType?: string;
}): Promise<TaskProofFile> {
  const { uri, taskId, uploadedBy, uploadedById, note, fileName, mimeType } = params;

  const cleanFileName = fileName || uri.split('/').pop() || `proof_${Date.now()}.jpg`;
  const ext = cleanFileName.split('.').pop()?.toLowerCase() || 'jpg';
  const resolvedMime =
    mimeType ||
    (ext === 'png'
      ? 'image/png'
      : ext === 'webp'
      ? 'image/webp'
      : ext === 'pdf'
      ? 'application/pdf'
      : 'image/jpeg');

  // 1. Coba upload via Next.js Server API (/api/tasks/upload-proof)
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      name: cleanFileName,
      type: resolvedMime,
    } as any);
    formData.append('taskId', taskId || 'unassigned');
    formData.append('uploadedBy', uploadedBy);
    if (uploadedById) formData.append('uploadedById', uploadedById);
    if (note) formData.append('note', note.trim());

    const res = await fetch(`${NEXT_API_BASE_URL}/api/tasks/upload-proof`, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    const json = await res.json();
    if (res.ok && json.ok && json.file) {
      return {
        id: json.file.id,
        name: json.file.name,
        url: json.file.url,
        size: json.file.size,
        ext: json.file.ext || ext,
        mimeType: json.file.mimeType || resolvedMime,
        path: json.file.path,
        uploaded_at: json.file.uploadedAt || new Date().toISOString(),
        uploadedAt: json.file.uploadedAt || new Date().toISOString(),
        uploaded_by: json.file.uploadedBy || uploadedBy,
        uploadedBy: json.file.uploadedBy || uploadedBy,
        uploadedById: json.file.uploadedById || uploadedById,
        note: json.file.note || note || '',
      };
    }
  } catch (apiErr) {
    console.warn('Next.js API upload-proof fallback to direct Supabase storage:', apiErr);
  }

  // 2. Fallback: Upload langsung ke Supabase Storage (bucket: task_proofs)
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const timeStamp = Date.now();
    const storagePath = `tasks/${taskId}/${timeStamp}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('task_proofs')
      .upload(storagePath, blob, {
        contentType: resolvedMime,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('task_proofs')
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || '';

    return {
      id: `proof_${timeStamp}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanFileName,
      url: publicUrl,
      size: blob.size,
      ext: ext,
      mimeType: resolvedMime,
      path: storagePath,
      uploaded_at: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      uploaded_by: uploadedBy,
      uploadedBy: uploadedBy,
      uploadedById: uploadedById,
      note: note || '',
    };
  } catch (storageErr: any) {
    console.error('Supabase direct upload failed:', storageErr);
    throw new Error(`Gagal mengunggah berkas: ${storageErr.message || 'Koneksi bermasalah'}`);
  }
}

export function createLinkProof(params: {
  url: string;
  title?: string;
  uploadedBy: string;
  uploadedById?: string;
  note?: string;
}): TaskProofFile {
  const { url, title, uploadedBy, uploadedById, note } = params;
  const timeStamp = Date.now();
  return {
    id: `link_${timeStamp}_${Math.random().toString(36).slice(2, 7)}`,
    name: title?.trim() || url.trim(),
    url: url.trim(),
    ext: 'link',
    mimeType: 'text/uri-list',
    uploaded_at: new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    uploaded_by: uploadedBy,
    uploadedBy: uploadedBy,
    uploadedById: uploadedById,
    note: note?.trim() || '',
  };
}

export async function deleteTaskProofFile(path?: string): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from('task_proofs').remove([path]);
  } catch (err) {
    console.warn('Failed to remove from storage:', err);
  }
}

// ==============================================================================
// 7.1 OPERASI CRUD CATATAN (POST-IT) & NOTULEN RAPAT (MoM)
// ==============================================================================
export interface MoMActionItem {
  id: string;
  issue?: string;
  decision?: string;
  picId?: string;
  deadline?: string;
  done?: boolean;
  convertedToTaskId?: string | null;
  progress?: string;
}

export const POSTIT_COLORS = [
  { id: 'yellow', name: 'Kuning', bg: '#fef9c3', border: '#fef08a', text: '#854d0e', dot: '#facc15' },
  { id: 'peach', name: 'Peach', bg: '#ffedd5', border: '#fed7aa', text: '#9a3412', dot: '#fb923c' },
  { id: 'mint', name: 'Mint', bg: '#dcfce7', border: '#bbf7d0', text: '#166534', dot: '#4ade80' },
  { id: 'blue', name: 'Biru Langit', bg: '#e0f2fe', border: '#bae6fd', text: '#075985', dot: '#38bdf8' },
  { id: 'purple', name: 'Lavender', bg: '#f3e8ff', border: '#e9d5ff', text: '#6b21a8', dot: '#c084fc' },
  { id: 'pink', name: 'Pink', bg: '#fce7f3', border: '#fbcfe8', text: '#9d174d', dot: '#f472b6' },
  { id: 'white', name: 'Putih / Netral', bg: '#ffffff', border: '#e2e8f0', text: '#1e293b', dot: '#94a3b8' },
];

export async function createNote(payload: {
  type?: 'notes' | 'mom' | 'Meeting' | 'note' | 'postit';
  title?: string;
  content?: string;
  issue?: string | null;
  decision?: string | null;
  pic_id?: string | null;
  deadline?: string | null;
  meeting_date?: string | null;
  location?: string | null;
  project_id?: string | null;
  attendees?: string[];
  agenda?: string | null;
  action_items?: MoMActionItem[];
  color?: string;
  is_pinned?: boolean;
}): Promise<Note> {
  const isPostIt = payload.type === 'notes' || payload.type === 'note' || payload.type === 'postit';
  const resolvedType = isPostIt ? 'note' : (payload.type || 'Meeting');
  const resolvedColor = payload.color || 'yellow';
  const resolvedPinned = Boolean(payload.is_pinned);
  const attendeesList = payload.attendees || [];

  // Metadata location untuk kompatibilitas schema legacy & Next.js web
  const locationValue = isPostIt
    ? JSON.stringify({ color: resolvedColor, isPinned: resolvedPinned, sharedWith: attendeesList })
    : (payload.location || null);

  const insertData: any = {
    type: resolvedType,
    title: payload.title || '',
    content: payload.content || '',
    issue: payload.issue || null,
    decision: payload.decision || null,
    pic_id: payload.pic_id || null,
    deadline: payload.deadline || null,
    is_done: false,
    meeting_date: payload.meeting_date || null,
    location: locationValue,
    project_id: payload.project_id || null,
    attendees: attendeesList,
    agenda: payload.agenda || null,
    action_items: payload.action_items || [],
    color: resolvedColor,
    is_pinned: resolvedPinned,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from('notes')
    .insert([insertData])
    .select()
    .single();

  if (error && (error.message?.includes('column') || error.message?.includes('does not exist'))) {
    // Retry fallback jika kolom baru belum dimigrasi di db tertentu
    const fallbackData: any = {
      type: resolvedType,
      title: payload.title || '',
      content: payload.content || '',
      issue: payload.issue || null,
      decision: payload.decision || null,
      pic_id: payload.pic_id || null,
      deadline: payload.deadline || null,
      is_done: false,
      location: locationValue,
      updated_at: new Date().toISOString(),
    };
    const retry = await supabase.from('notes').insert([fallbackData]).select().single();
    if (retry.error) throw retry.error;
    data = retry.data;
  } else if (error) {
    throw error;
  }

  return {
    id: data.id,
    type: data.type || resolvedType,
    title: data.title || '',
    content: data.content || '',
    issue: data.issue || '',
    decision: data.decision || '',
    pic_id: data.pic_id || '',
    deadline: data.deadline || '',
    is_done: Boolean(data.is_done),
    meeting_date: data.meeting_date || null,
    location: isPostIt ? '' : (data.location || ''),
    project_id: data.project_id || null,
    attendees: Array.isArray(data.attendees) ? data.attendees : attendeesList,
    agenda: data.agenda || '',
    action_items: Array.isArray(data.action_items) ? data.action_items : (payload.action_items || []),
    color: data.color || resolvedColor,
    is_pinned: typeof data.is_pinned === 'boolean' ? data.is_pinned : resolvedPinned,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateNote(
  noteId: string,
  updates: Partial<Note>
): Promise<void> {
  const isPostIt = updates.type === 'notes' || updates.type === 'note' || updates.type === 'postit';
  const updateData: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (isPostIt) {
    const attendeesList = updates.attendees || [];
    updateData.location = JSON.stringify({
      color: updates.color || 'yellow',
      isPinned: Boolean(updates.is_pinned),
      sharedWith: attendeesList,
    });
  }

  const { error } = await supabase
    .from('notes')
    .update(updateData)
    .eq('id', noteId);

  if (error) {
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      const cleanData = { ...updateData };
      delete cleanData.color;
      delete cleanData.is_pinned;
      delete cleanData.agenda;
      delete cleanData.action_items;
      delete cleanData.attendees;
      delete cleanData.meeting_date;
      delete cleanData.project_id;
      const retry = await supabase.from('notes').update(cleanData).eq('id', noteId);
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}

export async function convertMoMActionItemToTask(params: {
  meeting: Note;
  actionItem: MoMActionItem;
  activeUserId: string;
  activeUserName: string;
}): Promise<Task> {
  const { meeting, actionItem, activeUserId, activeUserName } = params;
  const targetProjectId = meeting.project_id || '';
  if (!targetProjectId) {
    throw new Error('Notulen ini belum ditautkan ke Proyek/Workspace. Tautkan proyek terlebih dahulu.');
  }

  const taskTitle = (actionItem.decision || actionItem.issue || '').trim();
  if (!taskTitle) {
    throw new Error('Item ini tidak memiliki judul atau keputusan untuk dijadikan tugas.');
  }

  const fullTitle = actionItem.issue ? `[MoM] ${actionItem.issue}: ${taskTitle}` : `[MoM] ${taskTitle}`;
  const picId = actionItem.picId || activeUserId;
  const deadline = actionItem.deadline || null;
  const progressNote = (actionItem.progress || '').trim();

  // Buat Task Baru di tabel tasks Supabase (schema: task_leader)
  const { data: newTask, error: taskError } = await supabase
    .from('tasks')
    .insert([
      {
        project_id: targetProjectId,
        title: fullTitle,
        status: 'To Do',
        priority: 'Medium',
        deadline: deadline,
        pic_id: picId,
        folder: 'General',
        memo: progressNote ? `Update Progress MoM: ${progressNote}` : `Tindak lanjut hasil rapat MoM: "${meeting.title}"`,
        author_id: activeUserId,
        todos: [
          {
            id: 'todo_' + Date.now(),
            text: `Eksekusi: ${taskTitle}`,
            done: false,
          },
        ],
        update_logs: progressNote
          ? [
              {
                id: 'log_' + Date.now(),
                timestamp: new Date().toISOString(),
                user: activeUserName,
                text: `Catatan Progress MoM: ${progressNote}`,
              },
            ]
          : [],
      },
    ])
    .select()
    .single();

  if (taskError) throw taskError;

  // Update item di notulen rapat dengan convertedToTaskId
  const currentItems: MoMActionItem[] = Array.isArray(meeting.action_items) ? [...meeting.action_items] : [];
  const updatedItems = currentItems.map((item) => {
    if (item.id === actionItem.id) {
      return {
        ...item,
        convertedToTaskId: newTask.id,
      };
    }
    return item;
  });

  await updateNote(meeting.id, {
    action_items: updatedItems,
  });

  return newTask;
}


// ==============================================================================
// 8. PEMANGGILAN NEXT.JS SERVER API (OPSIONAL / INTEGRASI LANJUTAN)
// ==============================================================================
/**
 * Memanggil API tasks web Next.js (/api/tasks) dengan token
 */
export async function callNextTasksApi(params: {
  range?: string;
  projectId?: string;
  picId?: string;
  status?: string;
  priority?: string;
  token?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.range) query.set('range', params.range);
  if (params.projectId) query.set('projectId', params.projectId);
  if (params.picId) query.set('picId', params.picId);
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.token) query.set('token', params.token);

  const res = await fetch(`${NEXT_API_BASE_URL}/api/tasks?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
    },
  });

  return await res.json();
}

/**
 * Verifikasi PIN aplikasi via /api/verify-pin
 */
export async function verifyAppPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch(`${NEXT_API_BASE_URL}/api/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

// ==============================================================================
// 9. HIRARKI ROLE & RADAR BAWAHAN (SELARAS DENGAN MainDashboard.jsx)
// ==============================================================================
export const getRoleLevel = (roleName?: string, rolesList: any[] = []): number => {
  if (!roleName) return 1;
  const clean = String(roleName).toLowerCase().trim();
  if (clean === 'super user' || clean === 'superadmin') return 99;
  if (clean === 'direksi') return 5;
  const found = rolesList.find(r => (r.name || '').toLowerCase().trim() === clean);
  if (found && typeof found.level === 'number') {
    return found.level;
  }
  if (clean.includes('direksi')) return 5;
  if (clean.includes('manager')) return 4;
  if (clean.includes('spv') || clean.includes('supervisor')) return 3;
  if (clean.includes('koordinator') || clean.includes('kordinator')) return 2;
  if (clean.includes('staff') || clean.includes('staf')) return 1;
  return 1;
};

export const getDeadlineDiffDays = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatDeadlineIndo = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const diff = getDeadlineDiffDays(dateStr);
  if (diff === null) return dateStr;
  if (diff < 0) return `Terlambat ${Math.abs(diff)} hari`;
  if (diff === 0) return 'Hari Ini';
  if (diff === 1) return 'Besok';
  return dateStr;
};

export interface SubordinateMemberStats extends Member {
  level: number;
  activeTasks: Task[];
  overdueTasks: Task[];
  todayTasks: Task[];
  totalActive: number;
}

export const getSubordinatesWithStats = (
  currentUser: SessionUser | null,
  members: Member[],
  tasks: Task[],
  projects: Project[],
  roles: Role[] = []
): {
  isLeader: boolean;
  subordinates: SubordinateMemberStats[];
  totalSubordinateOverdue: number;
  totalSubordinateToday: number;
} => {
  if (!currentUser) {
    return { isLeader: false, subordinates: [], totalSubordinateOverdue: 0, totalSubordinateToday: 0 };
  }

  const currentLevel = getRoleLevel(currentUser.role, roles);
  const isLeader = currentLevel >= 2;
  const currentDivision = (currentUser.division || '').trim().toLowerCase();
  const currentUserId = currentUser.memberId;

  // Filter anggota bawahan sesuai tingkatan struktural
  let subordinateList: Member[] = [];

  if (currentLevel >= 5) {
    // Direksi / Super User: Semua bawahan level < 5
    subordinateList = members.filter(m => {
      if (m.id === currentUserId) return false;
      const mLevel = getRoleLevel(m.role || m.position, roles);
      return mLevel < 5;
    });
  } else if (currentLevel === 4) {
    // Manager: bawahan level < 4 di divisinya
    subordinateList = members.filter(m => {
      if (m.id === currentUserId) return false;
      const mLevel = getRoleLevel(m.role || m.position, roles);
      const sameDiv = !currentDivision || (m.division || '').trim().toLowerCase() === currentDivision;
      return sameDiv && mLevel < 4;
    });
  } else if (currentLevel === 3) {
    // SPV (seperti Dodi - SPV Marcomm): bawahan level < 3 di divisinya (Koordinator & Staff)
    subordinateList = members.filter(m => {
      if (m.id === currentUserId) return false;
      const mLevel = getRoleLevel(m.role || m.position, roles);
      const sameDiv = !currentDivision || (m.division || '').trim().toLowerCase() === currentDivision;
      return sameDiv && mLevel < 3;
    });
  } else if (currentLevel === 2) {
    // Koordinator: Staff level 1 di divisinya
    subordinateList = members.filter(m => {
      if (m.id === currentUserId) return false;
      const mLevel = getRoleLevel(m.role || m.position, roles);
      const sameDiv = !currentDivision || (m.division || '').trim().toLowerCase() === currentDivision;
      return sameDiv && mLevel === 1;
    });
  } else {
    // Staff: Rekan 1 divisi
    subordinateList = members.filter(m => {
      if (m.id === currentUserId) return false;
      const sameDiv = !currentDivision || (m.division || '').trim().toLowerCase() === currentDivision;
      return sameDiv;
    });
  }

  // Hitung tugas per bawahan
  let totalSubordinateOverdue = 0;
  let totalSubordinateToday = 0;

  const projectMap = new Map<string, Project>();
  projects.forEach(p => projectMap.set(p.id, p));

  const stats: SubordinateMemberStats[] = subordinateList.map(sub => {
    const subTasks = tasks.filter(t => {
      const pic = t.pic_id || t.picId;
      if (pic !== sub.id || t.status === 'Done') return false;
      // Jangan sertakan task dari project personal
      const p = projectMap.get(t.project_id || t.projectId || '');
      if (isPersonalProject(p)) return false;
      return true;
    });

    const overdue: Task[] = [];
    const today: Task[] = [];

    subTasks.forEach(t => {
      const diff = getDeadlineDiffDays(t.deadline);
      if (diff !== null) {
        if (diff < 0) {
          overdue.push(t);
          totalSubordinateOverdue++;
        } else if (diff === 0) {
          today.push(t);
          totalSubordinateToday++;
        }
      }
    });

    const level = getRoleLevel(sub.role || sub.position, roles);

    return {
      ...sub,
      level,
      activeTasks: subTasks,
      overdueTasks: overdue,
      todayTasks: today,
      totalActive: subTasks.length,
    };
  });

  // Urutkan bawahan berdasarkan yang paling banyak overdue & today
  stats.sort((a, b) => (b.overdueTasks.length * 2 + b.todayTasks.length) - (a.overdueTasks.length * 2 + a.todayTasks.length));

  return {
    isLeader,
    subordinates: stats,
    totalSubordinateOverdue,
    totalSubordinateToday,
  };
};

export const createWhatsAppReminderUrl = (task: Task, member: Member): string => {
  const memberName = member?.name || 'Rekan Tim';
  const taskTitle = task.title;
  const deadlineStr = task.deadline || '';
  const diff = getDeadlineDiffDays(deadlineStr);
  const isOverdue = diff !== null && diff < 0;

  let phone = (member.whatsapp_number || '').trim().replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1);
  }

  const message = isOverdue
    ? `Halo ${memberName}, mohon bantuan update progres untuk task "${taskTitle}" yang sudah lewat deadline (${deadlineStr}). Apakah ada kendala yang bisa dibantu? Terima kasih!`
    : `Halo ${memberName}, pengingat ramah untuk task "${taskTitle}" yang jatuh tempo hari ini (${deadlineStr}). Semangat menyelesaikannya!`;

  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};
