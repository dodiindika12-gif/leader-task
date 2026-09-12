'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getRoleLevel, isMeetingSchedule, isWorksheetSchedule } from './WeeklyScheduleView';

// Helper Web Audio API untuk efek denting notifikasi lembut
const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Dua nada harmonik lembut (chime)
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.08); // A5
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now + 0.08);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
    } catch (e) {
        // Fallback hening jika audio dilarang browser
    }
};

const formatDateIndo = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const getDeadlineDiffDays = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function NotificationCenter({
    tasks = [],
    schedules = [],
    notes = [],
    members = [],
    currentPicId = '',
    session = null,
    roles = [],
    projects = [],
    onOpenTask,
    onNavigate
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all'); // 'all' | 'unread' | 'shared' | 'deadline' | 'schedule' | 'radar'
    const [searchQuery, setSearchQuery] = useState('');
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);

    const dropdownRef = useRef(null);

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

    // Helpers pencocokan multi-atribut user (ID, Email, Nama) untuk mendeteksi penugasan & sharing secara akurat
    const isMatchingUser = (val) => {
        if (!val) return false;
        const str = String(val).trim();
        const strLower = str.toLowerCase();
        return userIdentifiers.ids.has(str) || 
               userIdentifiers.emails.has(strLower) || 
               userIdentifiers.names.has(strLower);
    };

    const isArrayContainingUser = (arr) => {
        if (!Array.isArray(arr)) return false;
        return arr.some(item => isMatchingUser(item));
    };

    const userRole = currentMember?.role || currentMember?.position || session?.role || 'Staff';
    const userLevel = getRoleLevel(userRole, roles);
    const userDivision = currentMember?.division || session?.division;

    // Storage Keys
    const storageKeyRead = `task_leader_read_notifications_${activeUserId || 'default'}`;
    const storageKeyDismissed = `task_leader_dismissed_notifications_${activeUserId || 'default'}`;

    // State Read & Dismissed
    const [readIds, setReadIds] = useState(new Set());
    const [dismissedIds, setDismissedIds] = useState(new Set());

    // Load read/dismissed dari localStorage
    useEffect(() => {
        try {
            const storedRead = localStorage.getItem(storageKeyRead);
            if (storedRead) setReadIds(new Set(JSON.parse(storedRead)));
            
            const storedDismissed = localStorage.getItem(storageKeyDismissed);
            if (storedDismissed) setDismissedIds(new Set(JSON.parse(storedDismissed)));
        } catch (e) {}
    }, [storageKeyRead, storageKeyDismissed]);

    // Simpan ke localStorage saat readIds berubah
    const persistReadIds = (newSet) => {
        setReadIds(newSet);
        try {
            localStorage.setItem(storageKeyRead, JSON.stringify(Array.from(newSet)));
        } catch (e) {}
    };

    const persistDismissedIds = (newSet) => {
        setDismissedIds(newSet);
        try {
            localStorage.setItem(storageKeyDismissed, JSON.stringify(Array.from(newSet)));
        } catch (e) {}
    };

    // Tutup popover saat klik di luar (support desktop & mobile touch)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    // Today name in Indonesian
    const todayDayName = useMemo(() => {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[new Date().getDay()];
    }, []);

    // =========================================================================
    // GENERATOR NOTIFIKASI PINTAR (REAL-TIME ENGINE)
    // =========================================================================
    const rawNotifications = useMemo(() => {
        const list = [];

        // ---------------------------------------------------------------------
        // 1. Notifikasi Tugas Pribadi: Terlambat (Overdue) & Hari Ini (Due Today)
        // ---------------------------------------------------------------------
        tasks.forEach(t => {
            if (t.status === 'Done') return;

            const isMyTask = isMatchingUser(t.picId) || 
                (Array.isArray(t.todos) && t.todos.some(todo => !todo.done && isMatchingUser(todo.picId || todo.pic_id)));

            if (isMyTask && t.deadline) {
                const diffDays = getDeadlineDiffDays(t.deadline);
                const proj = projects.find(p => p.id === t.projectId);

                if (diffDays < 0) {
                    // Overdue
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
                        actionType: 'task'
                    });
                } else if (diffDays === 0) {
                    // Due Today
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
                        actionType: 'task'
                    });
                }
            }

            // -----------------------------------------------------------------
            // 2. Notifikasi Tugas Baru yang Ditugaskan / Dibagikan oleh Orang Lain
            // -----------------------------------------------------------------
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
                    actionType: 'task'
                });
            }

            // Subtask / Checklist dalam tugas yang ditugaskan ke user
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
                            actionType: 'task'
                        });
                    }
                });
            }
        });

        // ---------------------------------------------------------------------
        // 3. Notifikasi Jadwal (Meeting / Worksheet) Hari Ini & Dibagikan (Shared)
        // ---------------------------------------------------------------------
        schedules.forEach(s => {
            const isMeeting = isMeetingSchedule(s);
            const isToday = (s.day || '').trim().toLowerCase() === todayDayName.toLowerCase();
            const attendees = Array.isArray(s.attendees) ? s.attendees : [];
            const sharedWith = Array.isArray(s.sharedWith) ? s.sharedWith : (Array.isArray(s.shared_with) ? s.shared_with : []);

            const isPic = isMatchingUser(s.picId || s.pic_id || s.author_id || s.authorId);
            const isAttendee = isArrayContainingUser(attendees);
            const isShared = isArrayContainingUser(sharedWith);

            // Agenda Hari Ini untuk User (PIC atau Peserta/Shared)
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
                    actionType: isMeeting ? 'schedule_meeting' : 'schedule_worksheet'
                });
            }

            // Undangan Rapat / Jadwal yang Dibagikan ke User (User adalah Peserta/Shared, bukan PIC)
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
                    actionType: isMeeting ? 'schedule_meeting' : 'schedule_worksheet'
                });
            }
        });

        // ---------------------------------------------------------------------
        // 4. Notifikasi Catatan (Notes) & Notulensi Rapat (MoM) yang Dibagikan
        // ---------------------------------------------------------------------
        notes.forEach(n => {
            const isMoM = (n.type || '').toLowerCase() === 'meeting';
            const sharedWith = Array.isArray(n.sharedWith) ? n.sharedWith : (Array.isArray(n.shared_with) ? n.shared_with : []);
            const attendees = Array.isArray(n.attendees) ? n.attendees : [];
            const isAuthor = isMatchingUser(n.picId || n.pic_id || n.author_id || n.authorId);
            const isSharedToMe = isArrayContainingUser(sharedWith) || isArrayContainingUser(attendees);

            // A. Dokumen Catatan / MoM yang dibagikan
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
                    actionType: 'notes'
                });
            }

            // B. Action Item Notulensi Rapat yang Ditugaskan ke User
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
                        actionType: 'notes'
                    });
                }
            });
        });

        // ---------------------------------------------------------------------
        // 5. Radar Pimpinan: Pemantauan Tugas Tertunda Bawahan (Khusus Leader)
        // ---------------------------------------------------------------------
        if (userLevel >= 2) {
            tasks.forEach(t => {
                if (t.status === 'Done' || !t.deadline) return;

                // Cek apakah pemilik tugas adalah bawahan (maks 2 level di bawah user)
                const taskPicMember = members.find(m => m.id === t.picId);
                if (!taskPicMember) return;
                if (userIdentifiers.ids.has(taskPicMember.id)) return; // Jangan masukkan diri sendiri di radar

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
                            actionType: 'task'
                        });
                    }
                }
            });
        }

           // Urutkan notifikasi: Prioritas urgensi (1: Danger, 2: Warning/Today, 3: Info/Shared/Radar)
        return list.sort((a, b) => (a.priorityOrder - b.priorityOrder));
    }, [tasks, schedules, notes, members, userIdentifiers, userLevel, userDivision, roles, projects, todayDayName]);

    // Filter notifikasi yang belum dihapus (dismissed)
    const activeNotifications = useMemo(() => {
        return rawNotifications.filter(n => !dismissedIds.has(n.id));
    }, [rawNotifications, dismissedIds]);

    // Hitung jumlah yang belum dibaca (unread count)
    const unreadCount = useMemo(() => {
        return activeNotifications.filter(n => !readIds.has(n.id)).length;
    }, [activeNotifications, readIds]);

    // Hitung jumlah item per kategori untuk badge tab
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

    // Filter tampilan berdasarkan tab di dalam popup
    const displayedNotifications = useMemo(() => {
        let list = activeNotifications;

        if (filterCategory === 'unread') {
            list = list.filter(n => !readIds.has(n.id));
        } else if (filterCategory === 'shared') {
            list = list.filter(n => n.category === 'shared');
        } else if (filterCategory === 'deadline') {
            list = list.filter(n => n.category === 'deadline');
        } else if (filterCategory === 'schedule') {
            list = list.filter(n => n.category === 'schedule');
        } else if (filterCategory === 'radar') {
            list = list.filter(n => n.category === 'radar');
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(n => 
                n.title.toLowerCase().includes(q) || 
                n.description.toLowerCase().includes(q)
            );
        }

        return list;
    }, [activeNotifications, filterCategory, readIds, searchQuery]);

    // Handlers
    const handleToggleOpen = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState && isSoundEnabled && unreadCount > 0) {
            playNotificationSound();
        }
    };

    const handleMarkAsRead = (id, e) => {
        if (e) e.stopPropagation();
        const next = new Set(readIds);
        next.add(id);
        persistReadIds(next);
    };

    const handleDismiss = (id, e) => {
        if (e) e.stopPropagation();
        const nextDismissed = new Set(dismissedIds);
        nextDismissed.add(id);
        persistDismissedIds(nextDismissed);
    };

    const handleMarkAllAsRead = () => {
        const next = new Set(readIds);
        activeNotifications.forEach(n => next.add(n.id));
        persistReadIds(next);
    };

    const handleClearAll = () => {
        const next = new Set(dismissedIds);
        activeNotifications.forEach(n => next.add(n.id));
        persistDismissedIds(next);
    };

    const handleItemClick = (item) => {
        // Tandai sudah dibaca otomatis saat diklik
        handleMarkAsRead(item.id);

        // Lakukan aksi navigasi / modal
        if (item.actionType === 'task' && onOpenTask) {
            onOpenTask(item.targetData);
            setIsOpen(false);
        } else if (item.actionType === 'schedule_meeting' && onNavigate) {
            onNavigate('schedule_meeting');
            setIsOpen(false);
        } else if (item.actionType === 'schedule_worksheet' && onNavigate) {
            onNavigate('schedule_worksheet');
            setIsOpen(false);
        } else if (item.actionType === 'notes' && onNavigate) {
            onNavigate('notes');
            setIsOpen(false);
        }
    };

    return (
        <div className="relative z-50 shrink-0" ref={dropdownRef}>
            {/* ================================================================= */}
            {/* TOMBOL LONCENG DENGAN LABEL TITIK MERAH (RED DOT BADGE ANIMASI)   */}
            {/* ================================================================= */}
            <button
                type="button"
                onClick={handleToggleOpen}
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs ${
                    isOpen 
                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300/60 scale-105' 
                        : 'bg-white/75 text-slate-700 border-white/80 hover:bg-white hover:text-indigo-600 hover:border-indigo-200'
                }`}
                title={unreadCount > 0 ? `${unreadCount} notifikasi baru` : 'Pusat Notifikasi'}
                aria-label="Pusat Notifikasi"
            >
                <i className={`fa-solid fa-bell text-sm transition-transform ${unreadCount > 0 && !isOpen ? 'rotate-12' : ''}`}></i>

                {/* Titik Merah & Badge Counter */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center px-1">
                        {/* Ping radar wave animation */}
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                        {/* Solid badge with unread count */}
                        <span className="relative inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {/* ================================================================= */}
            {/* DROPDOWN PUSAT NOTIFIKASI INTERAKTIF                              */}
            {/* ================================================================= */}
            {isOpen && (
                <>
                    {/* Backdrop khusus Mobile View agar klik di luar menutup popover dengan bersih */}
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 sm:hidden animate-fade-in"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    <div 
                        className="fixed inset-x-3 top-[68px] sm:inset-x-auto sm:right-4 sm:top-16 sm:w-96 md:absolute md:top-full md:right-0 md:mt-2 md:w-[400px] md:max-w-none max-w-[calc(100vw-1.5rem)] rounded-3xl bg-white/98 backdrop-blur-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[calc(100dvh-5.5rem)] sm:max-h-[calc(100vh-100px)] animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                        {/* Header Popover */}
                        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-linear-to-r from-slate-50/90 via-white to-slate-50/90 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-xs shrink-0">
                                        <i className="fa-solid fa-bell"></i>
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-slate-800 tracking-tight">Pusat Notifikasi</h4>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            {unreadCount > 0 ? `${unreadCount} butuh perhatian` : 'Semua sudah beres'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition ${
                                            isSoundEnabled ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'
                                        }`}
                                        title={isSoundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi senyap'}
                                    >
                                        <i className={`fa-solid ${isSoundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs transition"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>

                            {/* Search in notifications */}
                            <div className="mt-3 relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
                                <input
                                    type="text"
                                    placeholder="Cari notifikasi..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-100/70 border border-slate-200/80 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                )}
                            </div>

                            {/* Filter Tabs Pills with Badges */}
                            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 custom-scrollbar text-[11px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('all')}
                                    className={`px-2.5 py-1 rounded-lg shrink-0 transition ${
                                        filterCategory === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    Semua ({categoryCounts.all})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('unread')}
                                    className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1 ${
                                        filterCategory === 'unread' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                    Belum Dibaca ({categoryCounts.unread})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('shared')}
                                    className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1 ${
                                        filterCategory === 'shared' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <i className="fa-solid fa-share-nodes text-[10px]"></i>
                                    Dibagikan ({categoryCounts.shared})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('deadline')}
                                    className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1 ${
                                        filterCategory === 'deadline' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <i className="fa-solid fa-clock text-[10px]"></i>
                                    Tenggat ({categoryCounts.deadline})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterCategory('schedule')}
                                    className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1 ${
                                        filterCategory === 'schedule' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <i className="fa-solid fa-calendar-day text-[10px]"></i>
                                    Jadwal ({categoryCounts.schedule})
                                </button>
                                {userLevel >= 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterCategory('radar')}
                                        className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1 ${
                                            filterCategory === 'radar' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                        }`}
                                    >
                                        <i className="fa-solid fa-users-viewfinder text-[10px]"></i>
                                        Radar Tim ({categoryCounts.radar})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Notification List Container */}
                        <div className="flex-1 min-h-0 sm:max-h-[380px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar p-2 space-y-1">
                            {displayedNotifications.length === 0 ? (
                                <div className="py-10 text-center px-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto mb-2.5 shadow-xs">
                                        <i className="fa-solid fa-circle-check"></i>
                                    </div>
                                    <h5 className="text-xs font-bold text-slate-700">Semua Beres! 🎉</h5>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        {filterCategory === 'unread' 
                                            ? 'Semua notifikasi sudah Anda tandai sebagai dibaca.' 
                                            : 'Tidak ada notifikasi yang memerlukan perhatian saat ini.'}
                                    </p>
                                </div>
                            ) : (
                                displayedNotifications.map(item => {
                                    const isUnread = !readIds.has(item.id);

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleItemClick(item)}
                                            className={`p-3 rounded-2xl transition-all duration-150 flex items-start gap-3 cursor-pointer group relative ${
                                                isUnread 
                                                    ? 'bg-indigo-50/40 hover:bg-indigo-50/70 border border-indigo-100/60' 
                                                    : 'bg-white hover:bg-slate-50 opacity-80 hover:opacity-100 border border-transparent hover:border-slate-100'
                                            }`}
                                        >
                                            {/* Icon */}
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-2xs ${item.iconBg}`}>
                                                <i className={item.icon}></i>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pr-14 sm:pr-6">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${item.badgeColor}`}>
                                                        {item.timeLabel}
                                                    </span>
                                                    {isUnread && (
                                                        <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs" title="Belum dibaca"></span>
                                                    )}
                                                </div>

                                                <h5 className="text-xs font-bold text-slate-800 mt-1 line-clamp-1 group-hover:text-indigo-600 transition">
                                                    {item.title}
                                                </h5>
                                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                    {item.description}
                                                </p>
                                            </div>

                                            {/* Quick Actions (Mark read / dismiss) - Selalu terlihat di touch/mobile, hover di desktop */}
                                            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                                                {isUnread && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleMarkAsRead(item.id, e)}
                                                        className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 flex items-center justify-center text-[10px] shadow-2xs"
                                                        title="Tandai sudah dibaca"
                                                    >
                                                        <i className="fa-solid fa-check"></i>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDismiss(item.id, e)}
                                                    className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center text-[10px] shadow-2xs"
                                                    title="Hapus notifikasi ini"
                                                >
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
                            <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                disabled={unreadCount === 0}
                                className={`flex items-center gap-1.5 font-bold transition ${
                                    unreadCount > 0 
                                        ? 'text-indigo-600 hover:text-indigo-800 cursor-pointer' 
                                        : 'text-slate-400 cursor-not-allowed opacity-60'
                                }`}
                            >
                                <i className="fa-solid fa-check-double text-[11px]"></i>
                                <span>Tandai Semua Dibaca</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleClearAll}
                                disabled={activeNotifications.length === 0}
                                className={`flex items-center gap-1.5 font-semibold transition ${
                                    activeNotifications.length > 0 
                                        ? 'text-slate-500 hover:text-rose-600 cursor-pointer' 
                                        : 'text-slate-300 cursor-not-allowed'
                                }`}
                            >
                                <i className="fa-regular fa-trash-can text-[11px]"></i>
                                <span>Bersihkan</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
