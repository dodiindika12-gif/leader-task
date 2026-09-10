'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getRoleLevel } from './WeeklyScheduleView';

// Helper format tanggal deadline
const formatDeadline = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Hitung selisih hari ke deadline
const getDeadlineDiffDays = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

// Helper format countdown jam:menit:detik
const formatCountdown = (ms) => {
    if (ms <= 0) return '00:00:00';
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    if (hours > 0) {
        return `${hours}j ${mins}m ${secs}d`;
    }
    return `${mins}m ${secs}d`;
};

// Inisial nama
const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const PRIORITIES = {
    'High': { color: 'text-rose-700 bg-rose-100 border-rose-200', dot: 'bg-rose-500', icon: 'fa-angles-up', label: 'Tinggi' },
    'Medium': { color: 'text-amber-700 bg-amber-100 border-amber-200', dot: 'bg-amber-500', icon: 'fa-angle-up', label: 'Sedang' },
    'Low': { color: 'text-sky-700 bg-sky-100 border-sky-200', dot: 'bg-sky-500', icon: 'fa-angle-down', label: 'Rendah' }
};

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function MainDashboard({
    tasks = [],
    allTasks = [],
    projects = [],
    members = [],
    allMembers = [],
    shortcuts = [],
    currentPicId,
    session,
    schedules = [],
    roles = [],
    divisions = [],
    departments = [],
    onEdit,
    onQuickAddTask,
    navigateView
}) {
    // 1. Live ticking clock setiap detik untuk countdown
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // 2. Filter tabs internal dashboard
    const [myTasksTab, setMyTasksTab] = useState('all'); // 'all' | 'overdue' | 'today' | 'upcoming' | 'todos'
    const [scheduleFilterType, setScheduleFilterType] = useState('all'); // 'all' | 'meeting' | 'worksheet'
    const [subordinateSearch, setSubordinateSearch] = useState('');
    const [copiedTaskId, setCopiedTaskId] = useState(null);

    // 3. User aktif & identifikasi hirarki jabatan
    const effectiveMembers = allMembers.length > 0 ? allMembers : members;
    const effectiveTasks = allTasks.length > 0 ? allTasks : tasks;

    const activeUserId = (session && ['Staff', 'Koordinator'].includes(session.role)) 
        ? session.memberId 
        : (currentPicId || session?.memberId);

    const currMember = effectiveMembers.find(m => m.id === activeUserId || m.email === session?.email) || session;
    const currentUserName = currMember?.name || session?.name || 'Leader';
    const currentUserRole = currMember?.role || currMember?.position || session?.role || 'Staff';
    const currentUserLevel = getRoleLevel(currentUserRole, roles);
    const currentUserDivision = currMember?.division || session?.division;
    const currentUserDepartment = currMember?.department || session?.department;

    // Greeting dinamis
    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 11) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    // 4. Kalkulasi Tugas & Deadline Milik User Sendiri
    const myTasks = useMemo(() => {
        return effectiveTasks.filter(t => t.picId === activeUserId);
    }, [effectiveTasks, activeUserId]);

    const myActiveTasks = useMemo(() => {
        return myTasks.filter(t => t.status !== 'Done');
    }, [myTasks]);

    // Sub-tugas (todos) milik user
    const myTodos = useMemo(() => {
        const list = [];
        effectiveTasks.forEach(t => {
            if (t.status === 'Done') return;
            const todos = Array.isArray(t.todos) ? t.todos : [];
            todos.forEach(todo => {
                if (!todo.done && ((todo.picId || todo.pic_id) === activeUserId || (!todo.picId && t.picId === activeUserId))) {
                    const diffDays = getDeadlineDiffDays(todo.deadline || t.deadline);
                    list.push({
                        ...todo,
                        parentTaskId: t.id,
                        parentTaskTitle: t.title,
                        project: projects.find(p => p.id === t.projectId),
                        diffDays
                    });
                }
            });
        });
        return list.sort((a, b) => (a.diffDays ?? 999) - (b.diffDays ?? 999));
    }, [effectiveTasks, activeUserId, projects]);

    // Klasifikasi deadline user
    const myDeadlinesSummary = useMemo(() => {
        let overdueCount = 0;
        let todayCount = 0;
        let upcomingCount = 0;
        let completedCount = 0;

        const overdueList = [];
        const todayList = [];
        const upcomingList = [];

        myTasks.forEach(t => {
            if (t.status === 'Done') {
                completedCount++;
                return;
            }
            const diffDays = getDeadlineDiffDays(t.deadline);
            const enriched = {
                ...t,
                diffDays,
                project: projects.find(p => p.id === t.projectId)
            };

            if (diffDays !== null) {
                if (diffDays < 0) {
                    overdueCount++;
                    overdueList.push(enriched);
                } else if (diffDays === 0) {
                    todayCount++;
                    todayList.push(enriched);
                } else if (diffDays <= 7) {
                    upcomingCount++;
                    upcomingList.push(enriched);
                }
            } else {
                upcomingList.push(enriched);
            }
        });

        // Urutkan dari yang paling mendesak
        overdueList.sort((a, b) => (a.diffDays ?? 0) - (b.diffDays ?? 0));
        todayList.sort((a, b) => (a.priority === 'High' ? -1 : 1));
        upcomingList.sort((a, b) => (a.diffDays ?? 999) - (b.diffDays ?? 999));

        return {
            overdueCount,
            todayCount,
            upcomingCount,
            completedCount,
            overdueList,
            todayList,
            upcomingList,
            totalActive: myActiveTasks.length
        };
    }, [myTasks, myActiveTasks, projects]);

    // 5. Perhitungan Hirarki Bawahan 2 Level di Bawahnya
    const subordinateData = useMemo(() => {
        const isSuperOrDireksi = currentUserLevel >= 5;
        const isLeader = currentUserLevel >= 2;

        let subordinateMembers = [];

        if (isSuperOrDireksi) {
            // Semua bawahan (level < currentUserLevel)
            subordinateMembers = effectiveMembers.filter(m => {
                if (m.id === activeUserId) return false;
                const mLevel = getRoleLevel(m.role || m.position, roles);
                return mLevel < 5;
            });
        } else if (currentUserLevel === 4) {
            // Manager: SPV (L3) dan Koordinator (L2) & Staff (L1) di divisinya
            subordinateMembers = effectiveMembers.filter(m => {
                if (m.id === activeUserId) return false;
                const mLevel = getRoleLevel(m.role || m.position, roles);
                const sameDiv = !currentUserDivision || m.division === currentUserDivision;
                return sameDiv && mLevel < 4;
            });
        } else if (currentUserLevel === 3) {
            // SPV: Koordinator (L2) dan Staff (L1) di divisinya/departemennya
            subordinateMembers = effectiveMembers.filter(m => {
                if (m.id === activeUserId) return false;
                const mLevel = getRoleLevel(m.role || m.position, roles);
                const sameDiv = !currentUserDivision || m.division === currentUserDivision;
                return sameDiv && mLevel < 3;
            });
        } else if (currentUserLevel === 2) {
            // Koordinator: Staff (L1) di departemennya
            subordinateMembers = effectiveMembers.filter(m => {
                if (m.id === activeUserId) return false;
                const mLevel = getRoleLevel(m.role || m.position, roles);
                const sameDept = !currentUserDepartment || m.department === currentUserDepartment;
                const sameDiv = !currentUserDivision || m.division === currentUserDivision;
                return (sameDept || sameDiv) && mLevel === 1;
            });
        } else {
            // Staff: Rekan 1 divisi/departemen
            subordinateMembers = effectiveMembers.filter(m => {
                if (m.id === activeUserId) return false;
                const sameDiv = !currentUserDivision || m.division === currentUserDivision;
                return sameDiv;
            });
        }

        // Hitung beban kerja dan deadline per bawahan
        let totalSubordinateOverdue = 0;
        let totalSubordinateToday = 0;
        const urgentSubordinateTasks = [];

        const membersWithStats = subordinateMembers.map(sub => {
            const subTasks = effectiveTasks.filter(t => t.picId === sub.id && t.status !== 'Done');
            let subOverdue = 0;
            let subToday = 0;

            subTasks.forEach(t => {
                const diffDays = getDeadlineDiffDays(t.deadline);
                if (diffDays !== null) {
                    if (diffDays < 0) {
                        subOverdue++;
                        totalSubordinateOverdue++;
                        urgentSubordinateTasks.push({
                            ...t,
                            member: sub,
                            diffDays,
                            type: 'overdue',
                            project: projects.find(p => p.id === t.projectId)
                        });
                    } else if (diffDays === 0) {
                        subToday++;
                        totalSubordinateToday++;
                        urgentSubordinateTasks.push({
                            ...t,
                            member: sub,
                            diffDays,
                            type: 'today',
                            project: projects.find(p => p.id === t.projectId)
                        });
                    }
                }
            });

            const level = getRoleLevel(sub.role || sub.position, roles);

            return {
                ...sub,
                level,
                activeTaskCount: subTasks.length,
                overdueCount: subOverdue,
                todayCount: subToday
            };
        });

        // Urutkan bawahan berdasarkan yang paling banyak task tertunda/hari ini
        membersWithStats.sort((a, b) => (b.overdueCount * 2 + b.todayCount) - (a.overdueCount * 2 + a.todayCount));
        urgentSubordinateTasks.sort((a, b) => (a.diffDays ?? 0) - (b.diffDays ?? 0));

        return {
            isLeader,
            subordinateMembers: membersWithStats,
            totalSubordinateOverdue,
            totalSubordinateToday,
            urgentSubordinateTasks
        };
    }, [currentUserLevel, currentUserDivision, currentUserDepartment, effectiveMembers, activeUserId, effectiveTasks, roles, projects]);

    // 6. Jadwal Meeting & Worksheet Hari Ini + Countdown Real-Time
    const todayDayName = DAYS_ID[currentTime.getDay()];

    const todaySchedulesWithCountdown = useMemo(() => {
        // Ambil jadwal hari ini
        const todayList = schedules.filter(s => {
            if (!s.day) return false;
            return s.day.trim().toLowerCase() === todayDayName.toLowerCase();
        });

        return todayList.map(item => {
            const startTimeStr = item.startTime || item.start_time || '08:00';
            const endTimeStr = item.endTime || item.end_time || '09:00';

            const [startH, startM] = startTimeStr.split(':').map(Number);
            const [endH, endM] = endTimeStr.split(':').map(Number);

            const startDateTime = new Date(currentTime);
            startDateTime.setHours(startH || 0, startM || 0, 0, 0);

            const endDateTime = new Date(currentTime);
            endDateTime.setHours(endH || 0, endM || 0, 0, 0);

            const nowMs = currentTime.getTime();
            const startMs = startDateTime.getTime();
            const endMs = endDateTime.getTime();

            let status = 'upcoming'; // 'ongoing' | 'upcoming' | 'passed'
            let countdownMs = 0;
            let progressPercent = 0;

            if (nowMs >= startMs && nowMs < endMs) {
                status = 'ongoing';
                countdownMs = endMs - nowMs;
                const totalDuration = endMs - startMs;
                const elapsed = nowMs - startMs;
                progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
            } else if (nowMs < startMs) {
                status = 'upcoming';
                countdownMs = startMs - nowMs;
            } else {
                status = 'passed';
                countdownMs = 0;
                progressPercent = 100;
            }

            const pic = effectiveMembers.find(m => m.id === (item.picId || item.pic_id));

            return {
                ...item,
                startTimeStr,
                endTimeStr,
                status,
                countdownMs,
                progressPercent,
                countdownFormatted: formatCountdown(countdownMs),
                pic
            };
        }).sort((a, b) => {
            const statusOrder = { ongoing: 0, upcoming: 1, passed: 2 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return a.startTimeStr.localeCompare(b.startTimeStr);
        });
    }, [schedules, todayDayName, currentTime, effectiveMembers]);

    // Filter jadwal meeting vs worksheet
    const filteredTodaySchedules = useMemo(() => {
        if (scheduleFilterType === 'all') return todaySchedulesWithCountdown;
        return todaySchedulesWithCountdown.filter(s => s.type === scheduleFilterType);
    }, [todaySchedulesWithCountdown, scheduleFilterType]);

    // Active ongoing schedule (jika ada yang sedang berlangsung)
    const activeOngoingSchedule = todaySchedulesWithCountdown.find(s => s.status === 'ongoing');

    // 7. Handler WhatsApp Reminder Follow-Up
    const handleSendWhatsAppReminder = (task, member) => {
        const memberName = member?.name || 'Rekan Tim';
        const taskTitle = task.title;
        const deadlineFormatted = task.deadline ? formatDeadline(task.deadline) : 'segera';
        const isOverdue = (task.diffDays ?? 0) < 0;

        const message = isOverdue
            ? `Halo ${memberName}, mohon bantuan update progres untuk task "${taskTitle}" yang sudah lewat deadline (${deadlineFormatted}). Apakah ada kendala yang bisa dibantu? Terima kasih!`
            : `Halo ${memberName}, pengingat ramah untuk task "${taskTitle}" yang jatuh tempo hari ini (${deadlineFormatted}). Semangat menyelesaikannya!`;

        const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        
        window.open(waUrl, '_blank');
        setCopiedTaskId(task.id);
        setTimeout(() => setCopiedTaskId(null), 2500);
    };

    // Filter list tugas saya sesuai tab yang dipilih
    const displayedMyTasks = useMemo(() => {
        if (myTasksTab === 'overdue') return myDeadlinesSummary.overdueList;
        if (myTasksTab === 'today') return myDeadlinesSummary.todayList;
        if (myTasksTab === 'upcoming') return myDeadlinesSummary.upcomingList;
        return [...myDeadlinesSummary.overdueList, ...myDeadlinesSummary.todayList, ...myDeadlinesSummary.upcomingList];
    }, [myTasksTab, myDeadlinesSummary]);

    // Skor kepatuhan tepat waktu (On-time Completion Radar)
    const onTimeScore = useMemo(() => {
        const total = myDeadlinesSummary.completedCount + myDeadlinesSummary.overdueCount + myDeadlinesSummary.todayCount;
        if (total === 0) return 100;
        return Math.max(0, Math.round(((myDeadlinesSummary.completedCount + myDeadlinesSummary.todayCount) / (total + myDeadlinesSummary.overdueCount)) * 100));
    }, [myDeadlinesSummary]);

    return (
        <div className="space-y-6 pb-12 animate-fade-in">
            {/* ========================================================================= */}
            {/* 1. HERO BANNER: PUSAT KOMANDO & DAILY MOTIVATIONAL BRIEFING               */}
            {/* ========================================================================= */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/15 border border-white/10">
                {/* Background decorative glowing orbs */}
                <div className="absolute -right-16 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute right-1/3 -bottom-20 w-60 h-60 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase text-blue-100 border border-white/20">
                                {currentUserRole} {currentUserDivision ? `• ${currentUserDivision}` : ''}
                            </span>
                            {activeOngoingSchedule && (
                                <span className="bg-emerald-400/30 text-emerald-200 border border-emerald-300/40 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    {activeOngoingSchedule.type === 'meeting' ? 'Meeting Sedang Berlangsung' : 'Worksheet Sedang Berlangsung'}
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-xs">
                            {getGreeting()}, {currentUserName}! 👋
                        </h1>

                        <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
                            {myDeadlinesSummary.overdueCount > 0 ? (
                                <span>
                                    Perhatian! Ada <strong className="text-rose-300 underline font-bold">{myDeadlinesSummary.overdueCount} tugas</strong> yang telah lewat deadline dan{' '}
                                    <strong className="text-amber-200">{myDeadlinesSummary.todayCount} tugas</strong> jatuh tempo hari ini.
                                </span>
                            ) : myDeadlinesSummary.todayCount > 0 ? (
                                <span>
                                    Fokus hari ini: Selesaikan <strong className="text-amber-200">{myDeadlinesSummary.todayCount} tugas</strong> yang jatuh tempo hari ini agar tidak tertunda!
                                </span>
                            ) : (
                                <span>
                                    Semua tugas Anda aman dari keterlambatan. Pertahankan ritme kerja yang hebat ini! 🚀
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Widget Kalender & Jam Real-Time */}
                    <div className="shrink-0 flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                        <div className="text-center px-2">
                            <div className="text-3xl sm:text-4xl font-black text-white">{currentTime.getDate()}</div>
                            <div className="text-xs uppercase tracking-wider font-semibold text-blue-200">
                                {currentTime.toLocaleDateString('id-ID', { month: 'short' })}
                            </div>
                        </div>
                        <div className="border-l border-white/20 pl-4 space-y-0.5">
                            <div className="text-xs text-blue-200 font-medium">{todayDayName}</div>
                            <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-wider">
                                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-blue-200/80">Waktu Indonesia Tengah</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. STATISTIK KPI RINGKASAN DEADLINE CEPAT (4 KARTU)                       */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {/* 1. Lewat Deadline (Overdue) */}
                <button
                    type="button"
                    onClick={() => setMyTasksTab('overdue')}
                    className={`text-left p-4 sm:p-5 rounded-3xl border transition-all duration-200 group relative overflow-hidden ${
                        myTasksTab === 'overdue'
                            ? 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/25 ring-2 ring-rose-400'
                            : 'bg-white/80 backdrop-blur hover:bg-rose-50/70 border-rose-200/80 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shadow-xs ${
                            myTasksTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'
                        }`}>
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        {myDeadlinesSummary.overdueCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase animate-pulse ${
                                myTasksTab === 'overdue' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                            }`}>
                                Perlu Aksi
                            </span>
                        )}
                    </div>
                    <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${myTasksTab === 'overdue' ? 'text-white' : 'text-rose-600'}`}>
                        {myDeadlinesSummary.overdueCount}
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${myTasksTab === 'overdue' ? 'text-rose-100' : 'text-slate-600'}`}>
                        Lewat Deadline (Overdue)
                    </div>
                    <div className={`text-[11px] mt-0.5 ${myTasksTab === 'overdue' ? 'text-rose-200' : 'text-slate-400'}`}>
                        Tugas aktif tertunda
                    </div>
                </button>

                {/* 2. Deadline Hari Ini */}
                <button
                    type="button"
                    onClick={() => setMyTasksTab('today')}
                    className={`text-left p-4 sm:p-5 rounded-3xl border transition-all duration-200 group relative overflow-hidden ${
                        myTasksTab === 'today'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400'
                            : 'bg-white/80 backdrop-blur hover:bg-amber-50/70 border-amber-200/80 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shadow-xs ${
                            myTasksTab === 'today' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
                        }`}>
                            <i className="fa-solid fa-clock"></i>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            myTasksTab === 'today' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                            Hari Ini
                        </span>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${myTasksTab === 'today' ? 'text-white' : 'text-amber-600'}`}>
                        {myDeadlinesSummary.todayCount}
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${myTasksTab === 'today' ? 'text-amber-100' : 'text-slate-600'}`}>
                        Jatuh Tempo Hari Ini
                    </div>
                    <div className={`text-[11px] mt-0.5 ${myTasksTab === 'today' ? 'text-amber-200' : 'text-slate-400'}`}>
                        Target tuntas hari ini
                    </div>
                </button>

                {/* 3. Minggu Ini (Upcoming) */}
                <button
                    type="button"
                    onClick={() => setMyTasksTab('upcoming')}
                    className={`text-left p-4 sm:p-5 rounded-3xl border transition-all duration-200 group relative overflow-hidden ${
                        myTasksTab === 'upcoming'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-600/25 ring-2 ring-indigo-400'
                            : 'bg-white/80 backdrop-blur hover:bg-indigo-50/70 border-indigo-200/80 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shadow-xs ${
                            myTasksTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                            <i className="fa-solid fa-calendar-week"></i>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            myTasksTab === 'upcoming' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                            7 Hari ke Depan
                        </span>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${myTasksTab === 'upcoming' ? 'text-white' : 'text-indigo-600'}`}>
                        {myDeadlinesSummary.upcomingCount}
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${myTasksTab === 'upcoming' ? 'text-indigo-100' : 'text-slate-600'}`}>
                        Tugas Mendatang
                    </div>
                    <div className={`text-[11px] mt-0.5 ${myTasksTab === 'upcoming' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        Jadwal tuntas minggu ini
                    </div>
                </button>

                {/* 4. Selesai (Completed) */}
                <button
                    type="button"
                    onClick={() => setMyTasksTab('all')}
                    className={`text-left p-4 sm:p-5 rounded-3xl border transition-all duration-200 group relative overflow-hidden ${
                        myTasksTab === 'all'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-600/25 ring-2 ring-emerald-400'
                            : 'bg-white/80 backdrop-blur hover:bg-emerald-50/70 border-emerald-200/80 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shadow-xs ${
                            myTasksTab === 'all' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                            <i className="fa-solid fa-circle-check"></i>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            myTasksTab === 'all' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                            Skor {onTimeScore}%
                        </span>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${myTasksTab === 'all' ? 'text-white' : 'text-emerald-600'}`}>
                        {myDeadlinesSummary.completedCount}
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${myTasksTab === 'all' ? 'text-emerald-100' : 'text-slate-600'}`}>
                        Tugas Tuntas
                    </div>
                    <div className={`text-[11px] mt-0.5 ${myTasksTab === 'all' ? 'text-emerald-200' : 'text-slate-400'}`}>
                        Dari total {myTasks.length} tugas
                    </div>
                </button>
            </div>

            {/* ========================================================================= */}
            {/* 3. LIVE WIDGET: JADWAL MEETING & WORKSHEET HARI INI + COUNTDOWN REAL-TIME */}
            {/* ========================================================================= */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-2xs">
                                <i className="fa-solid fa-stopwatch-20"></i>
                            </span>
                            <span>Jadwal Meeting & Worksheet Hari Ini ({todayDayName})</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Pantau agenda yang sedang berlangsung dan hitungan mundur menuju jadwal berikutnya
                        </p>
                    </div>

                    {/* Filter Button: Semua, Meeting, Worksheet */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-semibold shrink-0">
                        <button
                            type="button"
                            onClick={() => setScheduleFilterType('all')}
                            className={`px-3 py-1.5 rounded-xl transition ${scheduleFilterType === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Semua ({todaySchedulesWithCountdown.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleFilterType('meeting')}
                            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${scheduleFilterType === 'meeting' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <i className="fa-solid fa-handshake text-indigo-500 text-[10px]"></i>
                            Meeting
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleFilterType('worksheet')}
                            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${scheduleFilterType === 'worksheet' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <i className="fa-solid fa-table-cells text-sky-500 text-[10px]"></i>
                            Worksheet
                        </button>
                    </div>
                </div>

                {filteredTodaySchedules.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                        <i className="fa-regular fa-calendar-check text-2xl text-slate-300 mb-2 block"></i>
                        Tidak ada agenda meeting atau worksheet tetap yang dijadwalkan untuk hari {todayDayName}.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTodaySchedules.map(item => {
                            const isOngoing = item.status === 'ongoing';
                            const isUpcoming = item.status === 'upcoming';
                            const isPassed = item.status === 'passed';

                            return (
                                <div
                                    key={item.id}
                                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 relative overflow-hidden ${
                                        isOngoing
                                            ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border-emerald-300 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-400/40'
                                            : isUpcoming
                                            ? 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-sm'
                                            : 'bg-slate-50/60 border-slate-200/60 opacity-70'
                                    }`}
                                >
                                    {/* Header Status & Jam */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                                                item.type === 'meeting' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                                            }`}>
                                                <i className={`fa-solid ${item.type === 'meeting' ? 'fa-handshake' : 'fa-table-cells'}`}></i>
                                            </span>
                                            <span className="text-xs font-bold text-slate-700">
                                                {item.startTimeStr} - {item.endTimeStr}
                                            </span>
                                        </div>

                                        {/* Status Badge */}
                                        {isOngoing ? (
                                            <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs animate-pulse">
                                                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                                Sedang Berlangsung
                                            </span>
                                        ) : isUpcoming ? (
                                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                                Akan Datang
                                            </span>
                                        ) : (
                                            <span className="bg-slate-200 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                                Selesai
                                            </span>
                                        )}
                                    </div>

                                    {/* Judul & Detail Lokasi */}
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 line-clamp-1" title={item.title}>
                                            {item.title}
                                        </h4>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                            {item.location && (
                                                <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                                    <i className="fa-solid fa-location-dot text-rose-500 text-[10px]"></i>
                                                    <span className="truncate max-w-[150px]">{item.location}</span>
                                                </span>
                                            )}
                                            {item.pic && (
                                                <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                                    <i className="fa-regular fa-user text-slate-400 text-[10px]"></i>
                                                    <span>{item.pic.name}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Countdown Timer Card */}
                                    <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                                        isOngoing
                                            ? 'bg-emerald-600 text-white font-semibold'
                                            : isUpcoming
                                            ? 'bg-slate-100 text-slate-700 font-medium'
                                            : 'bg-slate-100/60 text-slate-400'
                                    }`}>
                                        <div className="flex items-center gap-1.5">
                                            <i className={`fa-solid ${isOngoing ? 'fa-hourglass-half animate-spin' : isUpcoming ? 'fa-clock' : 'fa-circle-check'} text-xs`}></i>
                                            <span className="text-[11px]">
                                                {isOngoing ? 'Sisa Waktu:' : isUpcoming ? 'Hitung Mundur:' : 'Status:'}
                                            </span>
                                        </div>
                                        <span className={`font-mono font-bold ${isOngoing ? 'text-white' : 'text-slate-800'}`}>
                                            {isOngoing || isUpcoming ? item.countdownFormatted : 'Telah Berakhir'}
                                        </span>
                                    </div>

                                    {/* Progress bar jika sedang berlangsung */}
                                    {isOngoing && (
                                        <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${item.progressPercent}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 4. DUA PANEL UTAMA: DEADLINE TUGAS SAYA & RADAR DEADLINE 2 LEVEL BAWAHAN   */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* --------------------------------------------------------------------- */}
                {/* PANEL KIRI: RINGKASAN DEADLINE TUGAS SAYA (7 COLS)                   */}
                {/* --------------------------------------------------------------------- */}
                <div className="lg:col-span-7 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm shadow-2xs">
                                    <i className="fa-solid fa-list-check"></i>
                                </span>
                                <span>Tugas & Deadline Saya</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Pantau tugas yang mendesak, hari ini, dan sub-kegiatan tertunda
                            </p>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl text-xs font-semibold overflow-x-auto custom-scrollbar">
                            <button
                                type="button"
                                onClick={() => setMyTasksTab('all')}
                                className={`px-2.5 py-1.5 rounded-xl transition ${myTasksTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Semua ({myDeadlinesSummary.totalActive})
                            </button>
                            <button
                                type="button"
                                onClick={() => setMyTasksTab('overdue')}
                                className={`px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 ${myTasksTab === 'overdue' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'}`}
                            >
                                <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                                Overdue ({myDeadlinesSummary.overdueCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setMyTasksTab('today')}
                                className={`px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 ${myTasksTab === 'today' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'}`}
                            >
                                <i className="fa-solid fa-clock text-[10px]"></i>
                                Hari Ini ({myDeadlinesSummary.todayCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setMyTasksTab('todos')}
                                className={`px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 ${myTasksTab === 'todos' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'}`}
                            >
                                <i className="fa-regular fa-square-check text-[10px]"></i>
                                To-Do ({myTodos.length})
                            </button>
                        </div>
                    </div>

                    {/* Konten List Tugas Sesuai Tab */}
                    {myTasksTab === 'todos' ? (
                        /* List Sub-Tasks (Todos) */
                        <div className="space-y-2.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                            {myTodos.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-xs">
                                    <i className="fa-solid fa-champagne-glasses text-3xl text-slate-300 mb-2 block"></i>
                                    Hebat! Seluruh sub-tugas (to-do) Anda telah terselesaikan.
                                </div>
                            ) : (
                                myTodos.map((todo, idx) => {
                                    const isOverdue = (todo.diffDays ?? 0) < 0;
                                    const isDueToday = todo.diffDays === 0;

                                    return (
                                        <div
                                            key={todo.id || idx}
                                            className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                                                isOverdue
                                                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                                    : isDueToday
                                                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                                                    : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/70'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <i className={`fa-regular fa-circle-dot mt-1 text-sm ${isOverdue ? 'text-rose-500' : isDueToday ? 'text-amber-500' : 'text-emerald-500'}`}></i>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{todo.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                                        Tugas Induk: <span className="font-medium text-slate-700">{todo.parentTaskTitle}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Badge Deadline */}
                                            <div className="shrink-0 flex items-center gap-2">
                                                {todo.deadline && (
                                                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                                                        isOverdue
                                                            ? 'bg-rose-600 text-white'
                                                            : isDueToday
                                                            ? 'bg-amber-600 text-white'
                                                            : 'bg-white text-slate-600 border border-slate-200'
                                                    }`}>
                                                        <i className={`fa-regular ${isOverdue ? 'fa-triangle-exclamation' : isDueToday ? 'fa-clock' : 'fa-calendar'} text-[10px]`}></i>
                                                        {isOverdue ? `Lewat ${Math.abs(todo.diffDays)} Hari` : isDueToday ? 'Hari Ini' : formatDeadline(todo.deadline)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        /* List Task Utama */
                        <div className="space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                            {displayedMyTasks.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-xs">
                                    <i className="fa-regular fa-circle-check text-3xl text-emerald-300 mb-2 block"></i>
                                    Tidak ada tugas dalam kategori ini. Semua terkendali! 🎉
                                </div>
                            ) : (
                                displayedMyTasks.map(task => {
                                    const isOverdue = (task.diffDays ?? 0) < 0;
                                    const isDueToday = task.diffDays === 0;
                                    const pConfig = PRIORITIES[task.priority] || PRIORITIES['Medium'];

                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => onEdit && onEdit(task)}
                                            className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                                                isOverdue
                                                    ? 'bg-rose-50/60 hover:bg-rose-50 border-rose-300/80 shadow-xs ring-1 ring-rose-200/50'
                                                    : isDueToday
                                                    ? 'bg-amber-50/60 hover:bg-amber-50 border-amber-300/80 shadow-xs ring-1 ring-amber-200/50'
                                                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/70 hover:shadow-xs'
                                            }`}
                                        >
                                            {/* Info Tugas */}
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${pConfig.dot}`}></div>
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition truncate">
                                                            {task.title}
                                                        </h4>
                                                        {task.project && (
                                                            <span
                                                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md text-white shadow-2xs shrink-0"
                                                                style={{ backgroundColor: task.project.color || '#4f46e5' }}
                                                            >
                                                                {task.project.name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                                        {task.folder && task.folder !== 'General' && (
                                                            <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-medium border border-indigo-100">
                                                                <i className="fa-solid fa-folder text-[9px]"></i> {task.folder}
                                                            </span>
                                                        )}
                                                        {task.todos && task.todos.length > 0 && (
                                                            <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                                                <i className="fa-regular fa-square-check text-slate-400"></i>
                                                                <span>{task.todos.filter(t => t.done).length}/{task.todos.length} sub-tugas</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Badge Status & Deadline */}
                                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                                                {/* Badge Deadline Menonjol */}
                                                {task.deadline ? (
                                                    <div className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
                                                        isOverdue
                                                            ? 'bg-rose-600 text-white animate-pulse'
                                                            : isDueToday
                                                            ? 'bg-amber-500 text-white'
                                                            : 'bg-white text-slate-700 border border-slate-200'
                                                    }`}>
                                                        <i className={`fa-solid ${isOverdue ? 'fa-triangle-exclamation' : isDueToday ? 'fa-clock' : 'fa-calendar'} text-[11px]`}></i>
                                                        <span>
                                                            {isOverdue 
                                                                ? `Lewat ${Math.abs(task.diffDays)} Hari` 
                                                                : isDueToday 
                                                                ? 'Hari Ini' 
                                                                : formatDeadline(task.deadline)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">No Deadline</span>
                                                )}

                                                <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-xl border border-slate-200 text-slate-600 shadow-2xs">
                                                    {task.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* --------------------------------------------------------------------- */}
                {/* PANEL KANAN: RADAR DEADLINE 2 LEVEL DI BAWAHNYA (5 COLS)              */}
                {/* --------------------------------------------------------------------- */}
                <div className="lg:col-span-5 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-sm shadow-2xs">
                                    <i className="fa-solid fa-sitemap"></i>
                                </span>
                                <span>
                                    {subordinateData.isLeader ? 'Radar Deadline Bawahan' : 'Beban Kerja Tim'}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {subordinateData.isLeader 
                                    ? 'Memantau deadline tugas anggota 2 tingkatan di bawah Anda' 
                                    : 'Daftar beban kerja rekan satu divisi/departemen Anda'}
                            </p>
                        </div>

                        {/* Total Overdue Alert Badge */}
                        {subordinateData.totalSubordinateOverdue > 0 && (
                            <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs">
                                <i className="fa-solid fa-bell text-[10px] text-rose-600 animate-bounce"></i>
                                {subordinateData.totalSubordinateOverdue} Overdue
                            </span>
                        )}
                    </div>

                    {/* Search Subordinate */}
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                            type="text"
                            value={subordinateSearch}
                            onChange={e => setSubordinateSearch(e.target.value)}
                            placeholder="Cari anggota tim..."
                            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition"
                        />
                    </div>

                    {/* Daftar Anggota Tim & Task Mendesak */}
                    <div className="space-y-3 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
                        {subordinateData.subordinateMembers.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-xs">
                                Tidak ada anggota tim terdaftar di bawah tingkatan ini.
                            </div>
                        ) : (
                            subordinateData.subordinateMembers
                                .filter(m => !subordinateSearch || m.name.toLowerCase().includes(subordinateSearch.toLowerCase()) || (m.role || '').toLowerCase().includes(subordinateSearch.toLowerCase()))
                                .map(sub => {
                                    const hasOverdue = sub.overdueCount > 0;
                                    const hasToday = sub.todayCount > 0;

                                    return (
                                        <div
                                            key={sub.id}
                                            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                                                hasOverdue
                                                    ? 'bg-rose-50/40 border-rose-200/80 shadow-2xs'
                                                    : hasToday
                                                    ? 'bg-amber-50/40 border-amber-200/80 shadow-2xs'
                                                    : 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-100/60'
                                            }`}
                                        >
                                            {/* Baris Profil Bawahan */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div
                                                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs"
                                                        style={{ backgroundColor: sub.color || '#4f46e5' }}
                                                    >
                                                        {getInitials(sub.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <h5 className="text-xs font-bold text-slate-800 truncate">{sub.name}</h5>
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                                                                Lvl {sub.level}: {sub.role || sub.position || 'Staff'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 truncate">
                                                            {sub.department ? `${sub.department} • ` : ''}{sub.division || ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Badge Ringkasan Keterlambatan */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {hasOverdue && (
                                                        <span className="bg-rose-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-2xs">
                                                            {sub.overdueCount} Overdue
                                                        </span>
                                                    )}
                                                    {hasToday && (
                                                        <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-2xs">
                                                            {sub.todayCount} Hari Ini
                                                        </span>
                                                    )}
                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-200/60">
                                                        {sub.activeTaskCount} Tugas
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Task Mendasar Bawahan yang Butuh Perhatian (Need Attention) */}
                                            {(hasOverdue || hasToday) && (
                                                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                                        <span>Tugas Butuh Perhatian Segera:</span>
                                                        <span className="text-indigo-600 font-semibold cursor-default">Tindakan Follow-Up</span>
                                                    </div>

                                                    {subordinateData.urgentSubordinateTasks
                                                        .filter(t => t.member.id === sub.id)
                                                        .slice(0, 2)
                                                        .map(ut => (
                                                            <div
                                                                key={ut.id}
                                                                className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="font-semibold text-slate-800 truncate text-[11px]" title={ut.title}>
                                                                        {ut.title}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400">
                                                                        Deadline: <strong className={ut.type === 'overdue' ? 'text-rose-600' : 'text-amber-600'}>{formatDeadline(ut.deadline)}</strong>
                                                                    </div>
                                                                </div>

                                                                {/* Tombol Follow Up WhatsApp Cepat */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSendWhatsAppReminder(ut, sub)}
                                                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shrink-0"
                                                                    title="Kirim pengingat ramah via WhatsApp"
                                                                >
                                                                    <i className="fa-brands fa-whatsapp text-emerald-600 text-xs"></i>
                                                                    <span>{copiedTaskId === ut.id ? 'Tersalin!' : 'Ingatkan'}</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
