'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { isMeetingSchedule, isWorksheetSchedule } from './WeeklyScheduleView';

const DAYS_ORDER = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function SidebarScheduleWidget({
    schedules = [],
    session = null,
    members = [],
    isSuperUser = false,
    onNavigate = null
}) {
    // Current live time (updates every 10 seconds for real-time accuracy)
    const [currentTime, setCurrentTime] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    // Current day & time in minutes
    const currentDayName = DAYS_ORDER[currentTime.getDay()];
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;
    const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

    // Current user identifiers
    const userIdentifiers = useMemo(() => {
        const matchedMember = (members || []).find(m => 
            (session?.memberId && m.id === session.memberId) ||
            (session?.email && m.email?.toLowerCase() === session.email.toLowerCase()) ||
            (session?.name && m.name?.toLowerCase() === session.name.toLowerCase()) ||
            (isSuperUser && (m.email === 'abskdi.markom@gmail.com' || m.name?.toLowerCase() === 'superadmin'))
        );

        const ids = new Set([
            session?.memberId,
            session?.id,
            matchedMember?.id,
            isSuperUser ? 'superadmin' : null
        ].filter(Boolean));

        const emails = new Set([
            session?.email,
            matchedMember?.email,
            isSuperUser ? 'abskdi.markom@gmail.com' : null
        ].filter(Boolean).map(e => e.toLowerCase().trim()));

        const names = new Set([
            session?.name,
            matchedMember?.name,
            isSuperUser ? 'superadmin' : null
        ].filter(Boolean).map(n => n.toLowerCase().trim()));

        return { ids, emails, names, matchedMember };
    }, [session, isSuperUser, members]);

    // Check if a schedule belongs to current user ("Jadwal Saya")
    const isMySchedule = useCallback((item) => {
        if (!item) return false;

        // 1. PIC / Owner
        const pic = item.picId || item.pic_id || item.author_id || item.authorId || item.userId;
        if (pic) {
            const picStr = String(pic).trim();
            if (
                userIdentifiers.ids.has(picStr) ||
                userIdentifiers.emails.has(picStr.toLowerCase()) ||
                userIdentifiers.names.has(picStr.toLowerCase())
            ) {
                return true;
            }
        }

        // 2. Meeting Attendee / SharedWith
        if (isMeetingSchedule(item)) {
            const attendees = Array.isArray(item.attendees) ? item.attendees : [];
            for (const att of attendees) {
                if (!att) continue;
                const attStr = String(att).trim();
                if (
                    userIdentifiers.ids.has(attStr) ||
                    userIdentifiers.emails.has(attStr.toLowerCase()) ||
                    userIdentifiers.names.has(attStr.toLowerCase())
                ) {
                    return true;
                }
            }

            const sharedWith = [
                ...(Array.isArray(item.sharedWith) ? item.sharedWith : []),
                ...(Array.isArray(item.shared_with) ? item.shared_with : [])
            ];
            for (const sw of sharedWith) {
                if (!sw) continue;
                const swStr = String(sw).trim();
                if (
                    userIdentifiers.ids.has(swStr) ||
                    userIdentifiers.emails.has(swStr.toLowerCase()) ||
                    userIdentifiers.names.has(swStr.toLowerCase())
                ) {
                    return true;
                }
            }
        }

        return false;
    }, [userIdentifiers]);

    // Parse time string 'HH:mm' to minutes
    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = String(timeStr).split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    // My personal schedules for TODAY
    const myTodaySchedules = useMemo(() => {
        return (schedules || [])
            .filter(item => {
                if (!item || !item.day) return false;
                return item.day.trim().toLowerCase() === currentDayName.toLowerCase() && isMySchedule(item);
            })
            .map(item => {
                const startTimeStr = item.startTime || item.start_time || '09:00';
                const endTimeStr = item.endTime || item.end_time || '10:00';
                const startTotalMin = parseTimeToMinutes(startTimeStr);
                const endTotalMin = parseTimeToMinutes(endTimeStr);
                const isMeeting = isMeetingSchedule(item);

                return {
                    ...item,
                    startTimeStr,
                    endTimeStr,
                    startTotalMin,
                    endTotalMin,
                    isMeeting
                };
            })
            .sort((a, b) => a.startTotalMin - b.startTotalMin);
    }, [schedules, currentDayName, isMySchedule]);

    // 1. Ongoing schedule ("Jadwal yang sedang berjalan")
    const ongoingSchedule = useMemo(() => {
        const ongoingList = myTodaySchedules.filter(item => {
            return item.startTotalMin <= currentTimeMinutes && currentTimeMinutes < item.endTotalMin;
        });

        if (ongoingList.length === 0) return null;

        // If multiple, prioritize meeting over worksheet
        const active = ongoingList.find(s => s.isMeeting) || ongoingList[0];
        const duration = Math.max(1, active.endTotalMin - active.startTotalMin);
        const elapsed = Math.max(0, currentTimeMinutes - active.startTotalMin);
        const progressPercent = Math.min(100, Math.round((elapsed / duration) * 100));
        const remainingMinutes = Math.max(0, active.endTotalMin - currentTimeMinutes);

        return {
            ...active,
            progressPercent,
            remainingMinutes
        };
    }, [myTodaySchedules, currentTimeMinutes]);

    // 2. Next schedule ("Jadwal selanjutnya")
    const nextSchedule = useMemo(() => {
        // Find upcoming schedule today
        const upcomingToday = myTodaySchedules.filter(item => item.startTotalMin > currentTimeMinutes);
        if (upcomingToday.length > 0) {
            const next = upcomingToday[0];
            const minutesUntil = next.startTotalMin - currentTimeMinutes;
            let timeUntilStr = '';
            if (minutesUntil < 60) {
                timeUntilStr = `dalam ${minutesUntil} mnt`;
            } else {
                const h = Math.floor(minutesUntil / 60);
                const m = minutesUntil % 60;
                timeUntilStr = m > 0 ? `dalam ${h}j ${m}m` : `dalam ${h} jam`;
            }

            return {
                ...next,
                isToday: true,
                timeUntilStr,
                displayLabel: `Pukul ${next.startTimeStr}`
            };
        }

        // If none left today, find next schedule in coming days of the week
        const currentDayIndex = currentTime.getDay();
        for (let offset = 1; offset <= 6; offset++) {
            const targetDayIndex = (currentDayIndex + offset) % 7;
            const targetDayName = DAYS_ORDER[targetDayIndex];
            const targetDaySchedules = (schedules || [])
                .filter(item => item?.day?.trim().toLowerCase() === targetDayName.toLowerCase() && isMySchedule(item))
                .map(item => {
                    const startTimeStr = item.startTime || item.start_time || '09:00';
                    return {
                        ...item,
                        startTimeStr,
                        startTotalMin: parseTimeToMinutes(startTimeStr),
                        isMeeting: isMeetingSchedule(item)
                    };
                })
                .sort((a, b) => a.startTotalMin - b.startTotalMin);

            if (targetDaySchedules.length > 0) {
                const nextInWeek = targetDaySchedules[0];
                const dayLabel = offset === 1 ? 'Besok' : targetDayName;
                return {
                    ...nextInWeek,
                    isToday: false,
                    displayLabel: `${dayLabel}, ${nextInWeek.startTimeStr}`,
                    timeUntilStr: dayLabel
                };
            }
        }

        return null;
    }, [myTodaySchedules, currentTimeMinutes, currentTime, schedules, isMySchedule]);

    // Handle click to navigate to target schedule view
    const handleCardClick = () => {
        if (!onNavigate) return;
        if (ongoingSchedule) {
            onNavigate(ongoingSchedule.isMeeting ? 'schedule_meeting' : 'schedule_worksheet');
        } else if (nextSchedule) {
            onNavigate(nextSchedule.isMeeting ? 'schedule_meeting' : 'schedule_worksheet');
        } else {
            onNavigate('schedule_meeting');
        }
    };

    return (
        <div 
            onClick={handleCardClick}
            className="group rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-2.5 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer select-none"
            title="Klik untuk membuka lembar Jadwal"
        >
            {ongoingSchedule ? (
                <div>
                    {/* Status Header */}
                    <div className="flex items-center justify-between gap-1 mb-1.5 text-[10.5px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                            <span className="font-semibold text-emerald-700 truncate">
                                Sedang Berjalan
                            </span>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60 shrink-0">
                            {ongoingSchedule.remainingMinutes}m lagi
                        </span>
                    </div>

                    {/* Schedule Title & Time */}
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors" title={ongoingSchedule.title}>
                            {ongoingSchedule.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                            {ongoingSchedule.startTimeStr} - {ongoingSchedule.endTimeStr}
                            {ongoingSchedule.location ? ` • ${ongoingSchedule.location}` : ''}
                        </div>
                    </div>

                    {/* Minimal Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-2 overflow-hidden" title={`Progres: ${ongoingSchedule.progressPercent}%`}>
                        <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${ongoingSchedule.progressPercent}%` }}
                        ></div>
                    </div>

                    {/* Next Schedule - Single compact line */}
                    {nextSchedule && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-[10.5px]">
                            <span className="text-slate-400 font-medium shrink-0">Berikutnya</span>
                            <span className="text-slate-600 font-medium truncate text-right" title={nextSchedule.title}>
                                {nextSchedule.title} <span className="text-slate-400 font-normal">({nextSchedule.startTimeStr})</span>
                            </span>
                        </div>
                    )}
                </div>
            ) : nextSchedule ? (
                /* Ketika tidak ada jadwal berjalan, tampilkan jadwal berikutnya langsung */
                <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5 text-[10.5px]">
                        <div className="flex items-center gap-1.5 min-w-0 text-slate-500">
                            <i className="fa-regular fa-clock text-slate-400 text-[10px] shrink-0"></i>
                            <span className="font-semibold text-slate-700 truncate">
                                Jadwal Berikutnya
                            </span>
                        </div>
                        <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100/70 shrink-0">
                            {nextSchedule.timeUntilStr}
                        </span>
                    </div>

                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors" title={nextSchedule.title}>
                            {nextSchedule.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                            {nextSchedule.displayLabel}
                            {nextSchedule.location ? ` • ${nextSchedule.location}` : ''}
                        </div>
                    </div>
                </div>
            ) : (
                /* Idle State */
                <div className="flex items-center justify-between gap-2 py-0.5 text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <i className="fa-regular fa-calendar-check text-slate-400 text-xs shrink-0"></i>
                        <span className="text-[11px] font-medium text-slate-600 truncate">
                            Tidak ada jadwal aktif
                        </span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 shrink-0">
                        {currentTimeStr}
                    </span>
                </div>
            )}
        </div>
    );
}
