'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getRoleLevel, isMeetingSchedule, isWorksheetSchedule } from '../components/WeeklyScheduleView';

// Helper perhitungan selisih hari deadline
export const getDeadlineDiffDays = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// Format tanggal Indonesia
export const formatDateIndo = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

/**
 * Hook Mesin Notifikasi Terpusat:
 * Menghasilkan notifikasi real-time, mengelola status baca/tutup (read/dismissed),
 * dan menyediakan penghitungan notifikasi yang belum dibaca per Proyek Workspace & Menu.
 */
export function useNotifications({
    tasks = [],
    schedules = [],
    notes = [],
    members = [],
    currentPicId = '',
    session = null,
    roles = [],
    projects = []
}) {
    // Identifikasi User Aktif
    const activeUserId = (session && ['Staff', 'Koordinator'].includes(session.role))
        ? session.memberId
        : (currentPicId || session?.memberId || '');

    const currentMember = useMemo(() => {
        return members.find(m =>
            (activeUserId && m.id === activeUserId) ||
            (session?.email && m.email?.toLowerCase() === session.email.toLowerCase())
        ) || session;
    }, [members, activeUserId, session]);

    const userIdentifiers = useMemo(() => {
        const ids = new Set([activeUserId, session?.memberId, currentMember?.id].filter(Boolean));
        const emails = new Set([session?.email, currentMember?.email].filter(Boolean).map(e => e.toLowerCase().trim()));
        const names = new Set([session?.name, currentMember?.name].filter(Boolean).map(n => n.toLowerCase().trim()));
        return { ids, emails, names };
    }, [activeUserId, session, currentMember]);

    const isMatchingUser = useCallback((val) => {
        if (!val) return false;
        const str = String(val).trim();
        const strLower = str.toLowerCase();
        return userIdentifiers.ids.has(str) ||
            userIdentifiers.emails.has(strLower) ||
            userIdentifiers.names.has(strLower);
    }, [userIdentifiers]);

    const isArrayContainingUser = useCallback((arr) => {
        if (!Array.isArray(arr)) return false;
        return arr.some(item => isMatchingUser(item));
    }, [isMatchingUser]);

    const userRole = currentMember?.role || currentMember?.position || session?.role || 'Staff';
    const userLevel = getRoleLevel(userRole, roles);
    const userDivision = currentMember?.division || session?.division;

    // Storage Keys (v3 untuk me-reset dan mem-push ulang notifikasi fresh ke user)
    const storageKeyRead = useMemo(() => `task_leader_read_notifications_v3_${activeUserId || 'default'}`, [activeUserId]);
    const storageKeyDismissed = useMemo(() => `task_leader_dismissed_notifications_v3_${activeUserId || 'default'}`, [activeUserId]);

    // State Read & Dismissed
    const [readIds, setReadIds] = useState(new Set());
    const [dismissedIds, setDismissedIds] = useState(new Set());

    // Load read/dismissed dari localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const storedRead = localStorage.getItem(storageKeyRead);
            if (storedRead) setReadIds(new Set(JSON.parse(storedRead)));

            const storedDismissed = localStorage.getItem(storageKeyDismissed);
            if (storedDismissed) setDismissedIds(new Set(JSON.parse(storedDismissed)));
        } catch (e) {}
    }, [storageKeyRead, storageKeyDismissed]);

    const persistReadIds = useCallback((newSet) => {
        setReadIds(newSet);
        try {
            localStorage.setItem(storageKeyRead, JSON.stringify(Array.from(newSet)));
        } catch (e) {}
    }, [storageKeyRead]);

    const persistDismissedIds = useCallback((newSet) => {
        setDismissedIds(newSet);
        try {
            localStorage.setItem(storageKeyDismissed, JSON.stringify(Array.from(newSet)));
        } catch (e) {}
    }, [storageKeyDismissed]);

    // Hari ini dalam bahasa Indonesia
    const todayDayName = useMemo(() => {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[new Date().getDay()];
    }, []);

    // Generator Notifikasi Real-time
    const rawNotifications = useMemo(() => {
        const list = [];

        // 1. Notifikasi Tugas: Overdue & Due Today
        tasks.forEach(t => {
            if (t.status === 'Done') return;

            const isMyTask = isMatchingUser(t.picId) ||
                (Array.isArray(t.todos) && t.todos.some(todo => !todo.done && isMatchingUser(todo.picId || todo.pic_id)));

            if (isMyTask && t.deadline) {
                const diffDays = getDeadlineDiffDays(t.deadline);
                const proj = projects.find(p => p.id === t.projectId);

                if (diffDays < 0) {
                    list.push({
                        id: `task-overdue-${t.id}`,
                        category: 'deadline',
                        type: 'overdue_task',
                        severity: 'danger',
                        priorityOrder: 1,
                        title: `Tugas Terlambat: "${t.title}"`,
                        description: `Tenggat waktu terlewati ${Math.abs(diffDays)} hari lalu (${formatDateIndo(t.deadline)})${proj ? ` • Proyek: ${proj.name}` : ''}. Mohon segera ditindaklanjuti.`,
                        timeLabel: `Lewat ${Math.abs(diffDays)} hari`,
                        timestamp: t.deadline,
                        badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
                        iconBg: 'bg-rose-500 text-white',
                        icon: 'fa-solid fa-triangle-exclamation',
                        targetData: t,
                        actionType: 'task',
                        projectId: t.projectId,
                        taskId: t.id,
                        menuKey: 'all_calendar'
                    });
                } else if (diffDays === 0) {
                    list.push({
                        id: `task-today-${t.id}`,
                        category: 'deadline',
                        type: 'today_task',
                        severity: 'warning',
                        priorityOrder: 2,
                        title: `Tenggat Hari Ini: "${t.title}"`,
                        description: `Jatuh tempo hari ini (${formatDateIndo(t.deadline)})${proj ? ` • Proyek: ${proj.name}` : ''}. Semangat menyelesaikannya!`,
                        timeLabel: 'Hari ini',
                        timestamp: t.deadline,
                        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
                        iconBg: 'bg-amber-500 text-white',
                        icon: 'fa-solid fa-hourglass-half',
                        targetData: t,
                        actionType: 'task',
                        projectId: t.projectId,
                        taskId: t.id,
                        menuKey: 'all_calendar'
                    });
                }
            }

            // 2. Notifikasi Tugas Ditugaskan / Dibagikan
            const isAssignedToMe = isMatchingUser(t.picId);
            const isCreatorMe = isMatchingUser(t.authorId || t.author_id);
            const isSharedToMe = isArrayContainingUser(t.sharedWith) || isArrayContainingUser(t.shared_with) || isArrayContainingUser(t.collaborators);

            if ((isAssignedToMe || isSharedToMe) && !isCreatorMe && t.status !== 'Done') {
                const authorMember = members.find(m => (m.id === (t.authorId || t.author_id)) && !isMatchingUser(m.id));
                const proj = projects.find(p => p.id === t.projectId);
                list.push({
                    id: `task-shared-${t.id}`,
                    category: 'shared',
                    type: 'shared_task',
                    severity: 'sky',
                    priorityOrder: 3,
                    title: `Tugas Ditugaskan ke Anda: "${t.title}"`,
                    description: `Ditugaskan oleh ${authorMember?.name || 'Rekan Tim'}${proj ? ` di proyek "${proj.name}"` : ''}. Deadline: ${t.deadline ? formatDateIndo(t.deadline) : 'Segera'}.`,
                    timeLabel: 'Tugas Baru',
                    timestamp: t.createdAt || t.created_at || new Date().toISOString(),
                    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
                    iconBg: 'bg-sky-500 text-white',
                    icon: 'fa-solid fa-user-plus',
                    targetData: t,
                    actionType: 'task',
                    projectId: t.projectId,
                    taskId: t.id
                });
            }

            // Subtask / Checklist dalam tugas
            if (Array.isArray(t.todos)) {
                t.todos.forEach((todo, idx) => {
                    const isTodoForMe = isMatchingUser(todo.picId || todo.pic_id);
                    if (isTodoForMe && !todo.done && (!isAssignedToMe || !isCreatorMe)) {
                        list.push({
                            id: `todo-shared-${t.id}-${todo.id || idx}`,
                            category: 'shared',
                            type: 'shared_subtask',
                            severity: 'blue',
                            priorityOrder: 3,
                            title: `Subtask Ditugaskan: "${todo.title || todo.text || 'Item Pekerjaan'}"`,
                            description: `Bagian dari tugas "${t.title}". Harap segera diselesaikan.`,
                            timeLabel: 'Subtask Baru',
                            timestamp: t.createdAt || t.created_at || new Date().toISOString(),
                            badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
                            iconBg: 'bg-blue-600 text-white',
                            icon: 'fa-solid fa-list-check',
                            targetData: t,
                            actionType: 'task',
                            projectId: t.projectId,
                            taskId: t.id
                        });
                    }
                });
            }

            // Log Update Baru pada Tugas yang melibatkan user
            const taskLogs = Array.isArray(t.updateLogs) ? t.updateLogs : (Array.isArray(t.update_logs) ? t.update_logs : []);
            if (taskLogs.length > 0 && (isAssignedToMe || isCreatorMe || isSharedToMe)) {
                const latest = taskLogs[0];
                const isMyLog = isMatchingUser(latest.authorId || latest.author_id);
                if (!isMyLog && latest.content) {
                    list.push({
                        id: `task-log-${t.id}-${latest.id || latest.createdAt || 'latest'}`,
                        category: 'shared',
                        type: 'task_update',
                        severity: 'sky',
                        priorityOrder: 3,
                        title: `Update Baru: "${t.title}"`,
                        description: `${latest.authorName || 'Rekan Tim'}: "${latest.content}"`,
                        timeLabel: 'Update Tugas',
                        timestamp: latest.createdAt || new Date().toISOString(),
                        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
                        iconBg: 'bg-sky-600 text-white',
                        icon: 'fa-solid fa-clock-rotate-left',
                        targetData: t,
                        actionType: 'task',
                        projectId: t.projectId,
                        taskId: t.id
                    });
                }
            }
        });

        // 3. Notifikasi Jadwal (Meeting / Worksheet)
        schedules.forEach(s => {
            const isMeeting = isMeetingSchedule(s);
            const isToday = (s.day || '').trim().toLowerCase() === todayDayName.toLowerCase();
            const attendees = Array.isArray(s.attendees) ? s.attendees : [];
            const sharedWith = Array.isArray(s.sharedWith) ? s.sharedWith : (Array.isArray(s.shared_with) ? s.shared_with : []);

            const isPic = isMatchingUser(s.picId || s.pic_id || s.author_id || s.authorId);
            const isAttendee = isArrayContainingUser(attendees);
            const isShared = isArrayContainingUser(sharedWith);

            if (isToday && (isPic || isAttendee || isShared)) {
                const timeStr = `${s.startTime || s.start_time || '08:00'} - ${s.endTime || s.end_time || '09:00'}`;
                list.push({
                    id: `sched-today-${s.id}`,
                    category: 'schedule',
                    type: isMeeting ? 'today_meeting' : 'today_worksheet',
                    severity: isMeeting ? 'indigo' : 'sky',
                    priorityOrder: 2,
                    title: `${isMeeting ? 'Jadwal Rapat Hari Ini' : 'Worksheet Hari Ini'}: "${s.title}"`,
                    description: `Pukul ${timeStr}${s.location ? ` • Lokasi: ${s.location}` : ''}. Agenda Anda hari ini (${s.day}).`,
                    timeLabel: timeStr,
                    timestamp: new Date().toISOString(),
                    badgeColor: isMeeting ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-sky-100 text-sky-800 border-sky-200',
                    iconBg: isMeeting ? 'bg-indigo-600 text-white' : 'bg-sky-600 text-white',
                    icon: isMeeting ? 'fa-solid fa-handshake' : 'fa-solid fa-table-cells',
                    targetData: s,
                    actionType: isMeeting ? 'schedule_meeting' : 'schedule_worksheet',
                    menuKey: isMeeting ? 'schedule_meeting' : 'schedule_worksheet',
                    parentMenuKey: 'schedule'
                });
            }

            if (!isPic && (isAttendee || isShared)) {
                const picMember = members.find(m => m.id === (s.picId || s.pic_id || s.author_id || s.authorId));
                list.push({
                    id: `sched-invited-${s.id}`,
                    category: 'shared',
                    type: isMeeting ? 'shared_meeting' : 'shared_schedule',
                    severity: isMeeting ? 'indigo' : 'blue',
                    priorityOrder: 3,
                    title: isMeeting ? `Undangan Rapat Dibagikan: "${s.title}"` : `Jadwal Worksheet Dibagikan: "${s.title}"`,
                    description: `Anda diikutsertakan oleh ${picMember?.name || 'PIC'} untuk hari ${s.day} (${s.startTime || s.start_time || '09:00'})${s.location ? ` di ${s.location}` : ''}.`,
                    timeLabel: isMeeting ? 'Undangan Rapat' : 'Jadwal Dibagikan',
                    timestamp: s.createdAt || s.created_at || new Date().toISOString(),
                    badgeColor: isMeeting ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-blue-100 text-blue-800 border-blue-200',
                    iconBg: isMeeting ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white',
                    icon: isMeeting ? 'fa-solid fa-handshake' : 'fa-solid fa-calendar-plus',
                    targetData: s,
                    actionType: isMeeting ? 'schedule_meeting' : 'schedule_worksheet',
                    menuKey: isMeeting ? 'schedule_meeting' : 'schedule_worksheet',
                    parentMenuKey: 'schedule'
                });
            }
        });

        // 4. Notifikasi Catatan (Notes) & Notulensi Rapat (MoM)
        notes.forEach(n => {
            const isMoM = (n.type || '').toLowerCase() === 'meeting';
            const sharedWith = Array.isArray(n.sharedWith) ? n.sharedWith : (Array.isArray(n.shared_with) ? n.shared_with : []);
            const attendees = Array.isArray(n.attendees) ? n.attendees : [];
            const isAuthor = isMatchingUser(n.picId || n.pic_id || n.author_id || n.authorId);
            const isSharedToMe = isArrayContainingUser(sharedWith) || isArrayContainingUser(attendees);

            if (!isAuthor && isSharedToMe) {
                const authorMember = members.find(m => m.id === (n.picId || n.pic_id || n.author_id || n.authorId));
                list.push({
                    id: `note-shared-${n.id}`,
                    category: 'shared',
                    type: isMoM ? 'shared_mom' : 'shared_note',
                    severity: isMoM ? 'emerald' : 'amber',
                    priorityOrder: 3,
                    title: isMoM
                        ? `Notulensi Rapat (MoM) Dibagikan: "${n.title || 'Rapat'}"`
                        : `Catatan Baru Dibagikan: "${n.title || 'Catatan Baru'}"`,
                    description: isMoM
                        ? `Notulensi rapat ${n.meeting_date ? `tanggal ${formatDateIndo(n.meeting_date)}` : ''} dibagikan oleh ${authorMember?.name || 'Notulis/Penyelenggara'}. Klik untuk membaca poin pembahasan & keputusan.`
                        : `Catatan post-it dibagikan oleh ${authorMember?.name || 'Rekan Tim'}. Klik untuk membuka dan membaca catatan.`,
                    timeLabel: isMoM ? 'MoM Dibagikan' : 'Catatan Dibagikan',
                    timestamp: n.createdAt || n.created_at || new Date().toISOString(),
                    badgeColor: isMoM ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200',
                    iconBg: isMoM ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white',
                    icon: isMoM ? 'fa-solid fa-clipboard-list' : 'fa-regular fa-note-sticky',
                    targetData: n,
                    actionType: 'notes',
                    menuKey: isMoM ? 'notes_mom' : 'notes_postit',
                    parentMenuKey: 'notes'
                });
            }

            const actionItems = Array.isArray(n.action_items || n.actionItems) ? (n.action_items || n.actionItems) : [];
            actionItems.forEach((act, actIdx) => {
                const isPicOfAct = isMatchingUser(act.picId || act.pic_id);
                if (!act.done && isPicOfAct) {
                    list.push({
                        id: `mom-act-${n.id}-${act.id || actIdx}`,
                        category: 'shared',
                        type: 'mom_action_item',
                        severity: 'teal',
                        priorityOrder: 2,
                        title: `Action Item MoM Ditugaskan: "${act.text || act.issue || 'Tindakan Tertunda'}"`,
                        description: `Berasal dari rapat "${n.title}". ${act.deadline ? `Deadline: ${formatDateIndo(act.deadline)}` : 'Harap segera diselesaikan.'}`,
                        timeLabel: 'Action Item MoM',
                        timestamp: act.deadline || n.meeting_date || n.createdAt || new Date().toISOString(),
                        badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
                        iconBg: 'bg-teal-600 text-white',
                        icon: 'fa-solid fa-list-check',
                        targetData: n,
                        actionType: 'notes',
                        menuKey: 'notes_mom',
                        parentMenuKey: 'notes'
                    });
                }
            });
        });

        // 5. Radar Pimpinan: Pemantauan Tugas Tertunda Bawahan
        if (userLevel >= 2) {
            tasks.forEach(t => {
                if (t.status === 'Done' || !t.deadline) return;

                const taskPicMember = members.find(m => m.id === t.picId);
                if (!taskPicMember) return;
                if (userIdentifiers.ids.has(taskPicMember.id)) return;

                const subLevel = getRoleLevel(taskPicMember.role || taskPicMember.position, roles);
                const isSubordinate = (userLevel >= 4)
                    ? (subLevel < userLevel)
                    : (subLevel < userLevel && subLevel >= userLevel - 2);

                const divisionMatches = (userLevel >= 4) ||
                    !userDivision ||
                    !taskPicMember.division ||
                    userDivision === 'All' ||
                    taskPicMember.division === userDivision;

                if (isSubordinate && divisionMatches) {
                    const diffDays = getDeadlineDiffDays(t.deadline);
                    if (diffDays < 0) {
                        list.push({
                            id: `radar-sub-${t.id}`,
                            category: 'radar',
                            type: 'subordinate_overdue',
                            severity: 'purple',
                            priorityOrder: 3,
                            title: `Radar Tim: Tugas Terlambat (${taskPicMember.name})`,
                            description: `Tugas "${t.title}" terlambat ${Math.abs(diffDays)} hari. Berikan pendampingan atau koordinasi dengan ${taskPicMember.name}.`,
                            timeLabel: `${taskPicMember.name} • ${Math.abs(diffDays)}h lewat`,
                            timestamp: t.deadline,
                            badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
                            iconBg: 'bg-purple-600 text-white',
                            icon: 'fa-solid fa-users-viewfinder',
                            targetData: t,
                            actionType: 'task',
                            projectId: t.projectId,
                            taskId: t.id,
                            menuKey: 'all_calendar'
                        });
                    } else if (diffDays === 0) {
                        list.push({
                            id: `radar-sub-today-${t.id}`,
                            category: 'radar',
                            type: 'subordinate_today',
                            severity: 'purple',
                            priorityOrder: 3,
                            title: `Radar Tim: Tenggat Hari Ini (${taskPicMember.name})`,
                            description: `Tugas "${t.title}" jatuh tempo hari ini. Pantau progres penyelesaian oleh ${taskPicMember.name}.`,
                            timeLabel: `${taskPicMember.name} • Hari ini`,
                            timestamp: t.deadline,
                            badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
                            iconBg: 'bg-purple-600 text-white',
                            icon: 'fa-solid fa-users-viewfinder',
                            targetData: t,
                            actionType: 'task',
                            projectId: t.projectId,
                            taskId: t.id,
                            menuKey: 'all_calendar'
                        });
                    }
                }
            });
        }

        return list.sort((a, b) => (a.priorityOrder - b.priorityOrder));
    }, [tasks, schedules, notes, members, userIdentifiers, isMatchingUser, isArrayContainingUser, userLevel, userDivision, roles, projects, todayDayName]);

    // Filter yang belum di-dismiss
    const activeNotifications = useMemo(() => {
        return rawNotifications.filter(n => !dismissedIds.has(n.id));
    }, [rawNotifications, dismissedIds]);

    // Daftar notifikasi yang belum dibaca
    const unreadNotifications = useMemo(() => {
        return activeNotifications.filter(n => !readIds.has(n.id));
    }, [activeNotifications, readIds]);

    // Total unread
    const unreadCount = unreadNotifications.length;

    // Hitung unread per Proyek Workspace
    const unreadCountByProject = useMemo(() => {
        const counts = {};
        unreadNotifications.forEach(n => {
            if (n.projectId) {
                counts[n.projectId] = (counts[n.projectId] || 0) + 1;
            }
        });
        return counts;
    }, [unreadNotifications]);

    // Hitung unread per Menu & Submenu
    const unreadCountByMenu = useMemo(() => {
        const counts = {
            notes: 0,
            notes_postit: 0,
            notes_mom: 0,
            schedule: 0,
            schedule_meeting: 0,
            schedule_worksheet: 0,
            all_calendar: 0
        };
        unreadNotifications.forEach(n => {
            if (n.menuKey && counts[n.menuKey] !== undefined) {
                counts[n.menuKey] = (counts[n.menuKey] || 0) + 1;
            }
            if (n.parentMenuKey && counts[n.parentMenuKey] !== undefined) {
                counts[n.parentMenuKey] = (counts[n.parentMenuKey] || 0) + 1;
            }
        });
        return counts;
    }, [unreadNotifications]);

    // Set ID tugas yang memiliki notifikasi aktif belum dibaca
    const unreadTaskIds = useMemo(() => {
        const set = new Set();
        unreadNotifications.forEach(n => {
            if (n.taskId) {
                set.add(n.taskId);
                set.add(String(n.taskId));
            } else if (n.targetData?.id && n.actionType === 'task') {
                set.add(n.targetData.id);
                set.add(String(n.targetData.id));
            }
        });
        return set;
    }, [unreadNotifications]);

    // Kategori hitungan untuk tab notification dropdown
    const categoryCounts = useMemo(() => {
        return {
            all: activeNotifications.length,
            unread: unreadCount,
            shared: activeNotifications.filter(n => n.category === 'shared').length,
            deadline: activeNotifications.filter(n => n.category === 'deadline').length,
            schedule: activeNotifications.filter(n => n.category === 'schedule').length,
            radar: activeNotifications.filter(n => n.category === 'radar').length,
        };
    }, [activeNotifications, unreadCount]);

    // Actions
    const markAsRead = useCallback((idOrIds) => {
        if (!idOrIds) return;
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        const next = new Set(readIds);
        let changed = false;
        ids.forEach(id => {
            if (!next.has(id)) {
                next.add(id);
                changed = true;
            }
        });
        if (changed) {
            persistReadIds(next);
        }
    }, [readIds, persistReadIds]);

    const markAllAsRead = useCallback(() => {
        const next = new Set(readIds);
        activeNotifications.forEach(n => next.add(n.id));
        persistReadIds(next);
    }, [readIds, activeNotifications, persistReadIds]);

    const dismiss = useCallback((idOrIds) => {
        if (!idOrIds) return;
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        const next = new Set(dismissedIds);
        ids.forEach(id => next.add(id));
        persistDismissedIds(next);
    }, [dismissedIds, persistDismissedIds]);

    const clearAll = useCallback(() => {
        const next = new Set(dismissedIds);
        activeNotifications.forEach(n => next.add(n.id));
        persistDismissedIds(next);
    }, [dismissedIds, activeNotifications, persistDismissedIds]);

    // Otomatis tandai dilihat saat user membuka project workspace tertentu
    const markProjectAsViewed = useCallback((projectId) => {
        if (!projectId) return;
        const itemsToMark = unreadNotifications.filter(n => n.projectId === projectId);
        if (itemsToMark.length === 0) return;
        const next = new Set(readIds);
        itemsToMark.forEach(n => next.add(n.id));
        persistReadIds(next);
    }, [unreadNotifications, readIds, persistReadIds]);

    // Otomatis tandai dilihat saat user membuka menu atau submenu tertentu (tidak menandai tugas agar tick tugas tetap ada)
    const markMenuAsViewed = useCallback((menuKey) => {
        if (!menuKey) return;
        const itemsToMark = unreadNotifications.filter(n =>
            (n.menuKey === menuKey || n.parentMenuKey === menuKey) && n.actionType !== 'task'
        );
        if (itemsToMark.length === 0) return;
        const next = new Set(readIds);
        itemsToMark.forEach(n => next.add(n.id));
        persistReadIds(next);
    }, [unreadNotifications, readIds, persistReadIds]);

    // Otomatis tandai dilihat saat user membuka detail tugas tertentu
    const markTaskAsViewed = useCallback((taskId) => {
        if (!taskId) return;
        const targetStr = String(taskId);
        const itemsToMark = unreadNotifications.filter(n =>
            String(n.taskId) === targetStr ||
            (n.targetData?.id && String(n.targetData.id) === targetStr && n.actionType === 'task')
        );
        if (itemsToMark.length === 0) return;
        const next = new Set(readIds);
        itemsToMark.forEach(n => next.add(n.id));
        persistReadIds(next);
    }, [unreadNotifications, readIds, persistReadIds]);

    // Reset status notifikasi (push ulang) agar semua notifikasi menjadi belum dibaca kembali
    const resetAllNotifications = useCallback(() => {
        setReadIds(new Set());
        setDismissedIds(new Set());
        try {
            localStorage.removeItem(storageKeyRead);
            localStorage.removeItem(storageKeyDismissed);
            localStorage.removeItem(`task_leader_read_notifications_${activeUserId || 'default'}`);
            localStorage.removeItem(`task_leader_dismissed_notifications_${activeUserId || 'default'}`);
            localStorage.removeItem(`task_leader_read_notifications_v2_${activeUserId || 'default'}`);
            localStorage.removeItem(`task_leader_dismissed_notifications_v2_${activeUserId || 'default'}`);
        } catch (e) {}
    }, [storageKeyRead, storageKeyDismissed, activeUserId]);

    return {
        userLevel,
        userRole,
        activeNotifications,
        unreadNotifications,
        unreadCount,
        unreadCountByProject,
        unreadCountByMenu,
        unreadTaskIds,
        categoryCounts,
        readIds,
        dismissedIds,
        markAsRead,
        markAllAsRead,
        dismiss,
        clearAll,
        markProjectAsViewed,
        markMenuAsViewed,
        markTaskAsViewed,
        resetAllNotifications
    };
}
