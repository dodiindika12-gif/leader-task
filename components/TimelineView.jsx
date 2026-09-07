'use strict';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function TimelineView({
    tasks = [],
    members = [],
    projects = [],
    onEdit,
    onAdd,
    onUpdateStatus
}) {
    const [timeScale, setTimeScale] = useState('week'); // 'day', 'week', 'month'
    const [groupBy, setGroupBy] = useState('status'); // 'status', 'project', 'pic'
    const [currentBaseDate, setCurrentBaseDate] = useState(() => new Date());
    const timelineContainerRef = useRef(null);

    // Calculate dates range around currentBaseDate
    const { dates, totalDays, startDateObj, endDateObj } = useMemo(() => {
        const base = new Date(currentBaseDate);
        let daysBefore = 7;
        let daysAfter = 21;

        if (timeScale === 'day') {
            daysBefore = 4;
            daysAfter = 10;
        } else if (timeScale === 'month') {
            daysBefore = 15;
            daysAfter = 45;
        }

        const start = new Date(base);
        start.setDate(start.getDate() - daysBefore);
        start.setHours(0, 0, 0, 0);

        const end = new Date(base);
        end.setDate(end.getDate() + daysAfter);
        end.setHours(23, 59, 59, 999);

        const diffTime = Math.abs(end.getTime() - start.getTime());
        const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const arr = [];
        for (let i = 0; i < daysCount; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            arr.push(d);
        }

        return {
            dates: arr,
            totalDays: daysCount,
            startDateObj: start,
            endDateObj: end
        };
    }, [currentBaseDate, timeScale]);

    // Helpers for task positioning
    const getTaskCoordinates = (task) => {
        const startMillis = startDateObj.getTime();
        const endMillis = endDateObj.getTime();
        const totalDuration = endMillis - startMillis;

        // Parse deadline
        let taskEnd = task.deadline ? new Date(task.deadline) : null;
        if (!taskEnd || isNaN(taskEnd.getTime())) {
            taskEnd = new Date(startDateObj);
            taskEnd.setDate(taskEnd.getDate() + 3);
        }
        taskEnd.setHours(23, 59, 59, 999);

        // Parse start date
        let taskStart = (task.startDate || task.start_date) ? new Date(task.startDate || task.start_date) : null;
        if (!taskStart || isNaN(taskStart.getTime())) {
            // Default start: 2 days before deadline
            taskStart = new Date(taskEnd);
            taskStart.setDate(taskStart.getDate() - 2);
        }
        taskStart.setHours(0, 0, 0, 0);

        // Clamping to current timeline window
        const effectiveStart = Math.max(startMillis, taskStart.getTime());
        const effectiveEnd = Math.min(endMillis, taskEnd.getTime());

        const leftPercent = ((effectiveStart - startMillis) / totalDuration) * 100;
        const widthPercent = Math.max(1.8, ((effectiveEnd - effectiveStart) / totalDuration) * 100);

        const isVisible = taskEnd.getTime() >= startMillis && taskStart.getTime() <= endMillis;

        return {
            left: `${Math.max(0, Math.min(98, leftPercent))}%`,
            width: `${Math.max(2, Math.min(100 - leftPercent, widthPercent))}%`,
            isVisible,
            taskStart,
            taskEnd
        };
    };

    // Calculate Today marker position
    const todayPos = useMemo(() => {
        const today = new Date();
        const startMillis = startDateObj.getTime();
        const endMillis = endDateObj.getTime();
        if (today.getTime() < startMillis || today.getTime() > endMillis) return null;
        const pct = ((today.getTime() - startMillis) / (endMillis - startMillis)) * 100;
        return `${pct}%`;
    }, [startDateObj, endDateObj]);

    // Grouping tasks
    const groupedTasks = useMemo(() => {
        if (groupBy === 'project') {
            const map = {};
            projects.forEach(p => { map[p.id] = { title: p.name, color: p.color || '#3b82f6', tasks: [] }; });
            map['no_project'] = { title: 'Tanpa Proyek', color: '#64748b', tasks: [] };

            tasks.forEach(t => {
                const pId = t.projectId || t.project_id || 'no_project';
                if (map[pId]) {
                    map[pId].tasks.push(t);
                } else {
                    map['no_project'].tasks.push(t);
                }
            });
            return Object.entries(map).filter(([_, g]) => g.tasks.length > 0);
        }

        if (groupBy === 'pic') {
            const map = {};
            members.forEach(m => { map[m.id] = { title: m.name, sub: m.division || m.position, color: m.color || '#6366f1', tasks: [] }; });
            map['unassigned'] = { title: 'Belum Ada PIC', sub: 'Unassigned', color: '#94a3b8', tasks: [] };

            tasks.forEach(t => {
                const picId = t.picId || t.pic_id || 'unassigned';
                if (map[picId]) {
                    map[picId].tasks.push(t);
                } else {
                    map['unassigned'].tasks.push(t);
                }
            });
            return Object.entries(map).filter(([_, g]) => g.tasks.length > 0);
        }

        if (groupBy === 'folder') {
            const map = {};
            tasks.forEach(t => {
                const fName = t.folder || 'General';
                if (!map[fName]) {
                    map[fName] = { title: `Folder: ${fName}`, color: '#8b5cf6', tasks: [] };
                }
                map[fName].tasks.push(t);
            });
            return Object.entries(map).filter(([_, g]) => g.tasks.length > 0);
        }

        // Default: group by status
        const statuses = [
            { key: 'To Do', title: 'To Do (Akan Datang)', color: '#3b82f6' },
            { key: 'In Progress', title: 'In Progress (Sedang Dikerjakan)', color: '#f59e0b' },
            { key: 'Done', title: 'Done (Selesai)', color: '#10b981' }
        ];

        return statuses.map(st => ({
            key: st.key,
            title: st.title,
            color: st.color,
            tasks: tasks.filter(t => (t.status || 'To Do') === st.key)
        }));
    }, [tasks, projects, members, groupBy]);

    // Shift dates
    const handlePrev = () => {
        const n = new Date(currentBaseDate);
        n.setDate(n.getDate() - (timeScale === 'day' ? 5 : timeScale === 'month' ? 20 : 10));
        setCurrentBaseDate(n);
    };

    const handleNext = () => {
        const n = new Date(currentBaseDate);
        n.setDate(n.getDate() + (timeScale === 'day' ? 5 : timeScale === 'month' ? 20 : 10));
        setCurrentBaseDate(n);
    };

    const handleToday = () => {
        setCurrentBaseDate(new Date());
    };

    const formatDateHeader = (d) => {
        const dayNum = d.getDate();
        const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
        const monthName = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d);
        return { dayNum, dayName, monthName, isWeekend: d.getDay() === 0 || d.getDay() === 6 };
    };

    const isToday = (d) => {
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/70 shadow-xl shadow-slate-200/40 p-4 lg:p-6 flex flex-col h-full overflow-hidden animate-fade-in">
            {/* Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                        <i className="fa-solid fa-timeline text-lg"></i>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            Timeline & Roadmap
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700">
                                Asana View
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500">Visualisasi jadwal pengerjaan task dan milestone proyek</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Navigation buttons */}
                    <div className="flex items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
                        <button
                            onClick={handlePrev}
                            className="p-1.5 px-2 text-slate-600 hover:text-slate-950 hover:bg-white rounded-xl text-xs font-medium transition"
                            title="Mundur"
                        >
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        <button
                            onClick={handleToday}
                            className="px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-white rounded-xl transition"
                        >
                            Hari Ini
                        </button>
                        <button
                            onClick={handleNext}
                            className="p-1.5 px-2 text-slate-600 hover:text-slate-950 hover:bg-white rounded-xl text-xs font-medium transition"
                            title="Maju"
                        >
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    {/* Group By selector */}
                    <div className="flex items-center text-xs bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
                        <span className="text-slate-400 px-2 font-medium">Group:</span>
                        <button
                            onClick={() => setGroupBy('status')}
                            className={`px-2.5 py-1 rounded-xl font-medium transition ${groupBy === 'status' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Status
                        </button>
                        <button
                            onClick={() => setGroupBy('project')}
                            className={`px-2.5 py-1 rounded-xl font-medium transition ${groupBy === 'project' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Proyek
                        </button>
                        <button
                            onClick={() => setGroupBy('folder')}
                            className={`px-2.5 py-1 rounded-xl font-medium transition ${groupBy === 'folder' ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Folder
                        </button>
                        <button
                            onClick={() => setGroupBy('pic')}
                            className={`px-2.5 py-1 rounded-xl font-medium transition ${groupBy === 'pic' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            PIC
                        </button>
                    </div>

                    {/* Time Scale selector */}
                    <div className="flex items-center text-xs bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
                        <button
                            onClick={() => setTimeScale('day')}
                            className={`px-2.5 py-1 rounded-xl font-medium transition ${timeScale === 'day' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Hari
                        </button>
                        <button
                            onClick={() => setTimeScale('week')}
                            className={`px-2.5 py-1 rounded-xl font-medium transition ${timeScale === 'week' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Minggu
                        </button>
                        <button
                            onClick={() => setTimeScale('month')}
                            className={`px-2.5 py-1 rounded-xl font-medium transition ${timeScale === 'month' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Bulan
                        </button>
                    </div>

                    {onAdd && (
                        <button
                            onClick={onAdd}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-2xl text-xs font-semibold shadow-sm shadow-indigo-300 flex items-center gap-1.5 transition active:scale-95"
                        >
                            <i className="fa-solid fa-plus text-xs"></i>
                            <span>Task Baru</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Timeline Scrollable Chart Area */}
            <div
                ref={timelineContainerRef}
                className="flex-1 border border-slate-200/70 rounded-2xl overflow-x-auto overflow-y-auto bg-slate-50/40 relative flex flex-col select-none"
            >
                {/* Header Row: Dates */}
                <div className="sticky top-0 z-20 flex bg-white border-b border-slate-200 shadow-sm min-w-max">
                    {/* Left Fixed Column Header */}
                    <div className="w-64 lg:w-72 flex-shrink-0 p-3 bg-white border-r border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <span>Task & Detail</span>
                        <span className="text-[10px] text-slate-400 font-normal">{tasks.length} task</span>
                    </div>

                    {/* Timeline Date Columns */}
                    <div className="flex-1 flex min-w-[700px]">
                        {dates.map((d, idx) => {
                            const { dayNum, dayName, monthName, isWeekend } = formatDateHeader(d);
                            const today = isToday(d);

                            return (
                                <div
                                    key={idx}
                                    className={`flex-1 min-w-[42px] max-w-[80px] py-2 px-1 text-center border-r border-slate-100 flex flex-col items-center justify-center transition-colors ${
                                        today
                                            ? 'bg-rose-50/70 text-rose-700 font-bold'
                                            : isWeekend
                                            ? 'bg-slate-100/50 text-slate-400'
                                            : 'text-slate-600'
                                    }`}
                                >
                                    <span className="text-[10px] uppercase font-medium">{dayName}</span>
                                    <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center mt-0.5 ${today ? 'bg-rose-500 text-white' : ''}`}>
                                        {dayNum}
                                    </span>
                                    {idx === 0 || dayNum === 1 ? (
                                        <span className="text-[9px] font-semibold text-slate-500 mt-0.5">{monthName}</span>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Groups & Task Rows */}
                <div className="flex-1 min-w-max relative pb-8">
                    {/* Today Line Indicator */}
                    {todayPos && (
                        <div
                            className="absolute top-0 bottom-0 z-10 w-[2px] bg-rose-500 pointer-events-none"
                            style={{ left: `calc(16rem + (100% - 16rem) * ${parseFloat(todayPos) / 100})` }}
                        >
                            <div className="sticky top-11 -ml-2.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded shadow">
                                HARI INI
                            </div>
                        </div>
                    )}

                    {groupedTasks.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <i className="fa-regular fa-calendar-xmark text-4xl mb-3 text-slate-300"></i>
                            <p className="text-sm font-medium">Belum ada task untuk ditampilkan di Timeline.</p>
                            <p className="text-xs text-slate-400 mt-1">Tambahkan task baru atau set tenggat waktu (deadline).</p>
                        </div>
                    ) : (
                        groupedTasks.map((group, gIdx) => {
                            const groupTitle = group.title || group[1]?.title;
                            const groupColor = group.color || group[1]?.color || '#3b82f6';
                            const groupTaskList = group.tasks || group[1]?.tasks || [];

                            return (
                                <div key={gIdx} className="border-b border-slate-200/60 last:border-b-0">
                                    {/* Group Header Banner */}
                                    <div className="flex items-center sticky left-0 z-10 bg-slate-100/80 px-4 py-2 border-y border-slate-200/50 backdrop-blur-sm">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full mr-2 shadow-sm"
                                            style={{ backgroundColor: groupColor }}
                                        ></span>
                                        <span className="text-xs font-bold text-slate-800">{groupTitle}</span>
                                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white text-slate-600 border border-slate-200 shadow-xs">
                                            {groupTaskList.length}
                                        </span>
                                    </div>

                                    {/* Task rows in this group */}
                                    {groupTaskList.map((task) => {
                                        const { left, width, isVisible, taskStart, taskEnd } = getTaskCoordinates(task);
                                        const pic = members.find(m => m.id === (task.picId || task.pic_id));
                                        const project = projects.find(p => p.id === (task.projectId || task.project_id));
                                        const todos = Array.isArray(task.todos) ? task.todos : [];
                                        const doneTodos = todos.filter(td => td.done).length;
                                        const progressPct = todos.length > 0 ? Math.round((doneTodos / todos.length) * 100) : (task.status === 'Done' ? 100 : 0);

                                        const priorityColor =
                                            task.priority === 'High'
                                                ? 'from-rose-500 to-rose-600 text-white'
                                                : task.priority === 'Medium'
                                                ? 'from-amber-500 to-amber-600 text-white'
                                                : 'from-blue-500 to-blue-600 text-white';

                                        const statusBadge =
                                            task.status === 'Done'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : task.status === 'In Progress'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-blue-100 text-blue-700';

                                        return (
                                            <div
                                                key={task.id}
                                                className="flex items-center hover:bg-indigo-50/20 border-b border-slate-100 h-14 relative group transition-colors"
                                            >
                                                {/* Left Info Column */}
                                                <div className="w-64 lg:w-72 flex-shrink-0 px-3 py-2 bg-white/95 border-r border-slate-200 sticky left-0 z-10 flex items-center justify-between shadow-[2px_0_5px_-2px_rgba(0,0,0,0.03)]">
                                                    <div className="min-w-0 flex-1 pr-2">
                                                        <div
                                                            onClick={() => onEdit && onEdit(task)}
                                                            className="text-xs font-semibold text-slate-800 truncate cursor-pointer hover:text-indigo-600 transition flex items-center gap-1.5"
                                                            title={task.title}
                                                        >
                                                            {task.status === 'Done' && (
                                                                <i className="fa-solid fa-check-circle text-emerald-500 text-xs"></i>
                                                            )}
                                                            <span className="truncate">{task.title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                                            {project && (
                                                                <span className="font-medium text-slate-600 truncate max-w-[90px]">
                                                                    {project.name}
                                                                </span>
                                                            )}
                                                            {pic && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-indigo-600 font-medium truncate max-w-[80px]">
                                                                        {pic.name}
                                                                    </span>
                                                                    {pic.division && (
                                                                        <span className="px-1 py-0.2 bg-slate-100 text-slate-500 rounded text-[9px]">
                                                                            {pic.division}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${statusBadge}`}>
                                                        {task.status || 'To Do'}
                                                    </span>
                                                </div>

                                                {/* Timeline Bar Area */}
                                                <div className="flex-1 relative h-full flex items-center min-w-[700px] px-2">
                                                    {/* Background grid vertical lines */}
                                                    <div className="absolute inset-0 flex pointer-events-none opacity-40">
                                                        {dates.map((_, i) => (
                                                            <div key={i} className="flex-1 border-r border-slate-200/50"></div>
                                                        ))}
                                                    </div>

                                                    {/* Task Gantt Bar */}
                                                    {isVisible && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.96 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            onClick={() => onEdit && onEdit(task)}
                                                            style={{ left, width }}
                                                            className={`absolute h-8 rounded-xl shadow-md cursor-pointer flex items-center justify-between px-2.5 overflow-hidden transition-all hover:scale-[1.01] hover:shadow-lg active:scale-95 group/bar z-10 bg-gradient-to-r ${
                                                                task.status === 'Done' ? 'from-emerald-500 to-emerald-600 text-white' : priorityColor
                                                            }`}
                                                            title={`${task.title} (${taskStart.toLocaleDateString('id-ID')} - ${taskEnd.toLocaleDateString('id-ID')})`}
                                                        >
                                                            {/* Progress overlay bar */}
                                                            {progressPct > 0 && progressPct < 100 && (
                                                                <div
                                                                    className="absolute top-0 bottom-0 left-0 bg-white/20 pointer-events-none"
                                                                    style={{ width: `${progressPct}%` }}
                                                                ></div>
                                                            )}

                                                            <div className="flex items-center gap-1.5 min-w-0 relative z-10">
                                                                <span className="text-[11px] font-bold truncate">
                                                                    {task.title}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 text-[10px] relative z-10 pl-2">
                                                                {todos.length > 0 && (
                                                                    <span className="bg-black/20 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                                                                        {doneTodos}/{todos.length}
                                                                    </span>
                                                                )}
                                                                {task.deadline && (
                                                                    <span className="text-[9px] opacity-90 hidden lg:inline">
                                                                        {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(task.deadline))}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Footer Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 text-[11px] text-slate-500 border-t border-slate-100">
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700">Prioritas:</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> High</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Medium</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Low</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Done</span>
                </div>
                <div className="text-slate-400">
                    💡 Klik task bar untuk mengedit tanggal mulai, tenggat waktu, PIC, atau sub-task.
                </div>
            </div>
        </div>
    );
}
