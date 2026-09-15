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
    // Current live time (updates every 1 second for live countdown)
    const [currentTime, setCurrentTime] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
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

        const [startH, startM] = (active.startTimeStr || '00:00').split(':').map(Number);
        const [endH, endM] = (active.endTimeStr || '00:00').split(':').map(Number);
        
        const startTimeSec = (startH || 0) * 3600 + (startM || 0) * 60;
        const endTimeSec = (endH || 0) * 3600 + (endM || 0) * 60;
        const currentTimeSec = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();
        
        const totalDurationSec = Math.max(1, endTimeSec - startTimeSec);
        const elapsedSec = Math.max(0, currentTimeSec - startTimeSec);
        const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedSec / totalDurationSec) * 100)));
        const remainingSec = Math.max(0, endTimeSec - currentTimeSec);

        const remHours = Math.floor(remainingSec / 3600);
        const remMinutes = Math.floor((remainingSec % 3600) / 60);
        const remSeconds = remainingSec % 60;

        let countdownText = '';
        const sPad = String(remSeconds).padStart(2, '0');
        if (remHours > 0) {
            const mPad = String(remMinutes).padStart(2, '0');
            countdownText = `${remHours}j ${mPad}m ${sPad}d`;
        } else {
            countdownText = `${remMinutes}m ${sPad}d`;
        }

        return {
            ...active,
            progressPercent,
            remainingSec,
            countdownText
        };
    }, [myTodaySchedules, currentTimeMinutes, currentTime]);

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
            className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-gradient-to-b from-slate-100/80 via-slate-50/60 to-slate-100/40 backdrop-blur-2xl p-3.5 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_10px_30px_-5px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.03] hover:from-slate-100/90 hover:via-slate-50/75 hover:to-slate-100/50 hover:border-slate-300/80 hover:shadow-[inset_0_1px_1px_0_rgba(255,255,255,1),0_14px_35px_-5px_rgba(0,0,0,0.06)] hover:scale-[1.01] transition-all duration-300 ease-out cursor-pointer select-none"
            title="Klik untuk membuka lembar Jadwal"
        >
            {/* iOS Specular Glare & Ambient Prism Refraction */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none"></div>
            <div className="absolute -top-12 -left-12 w-28 h-28 bg-gradient-to-br from-teal-400/15 to-emerald-300/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-gradient-to-tl from-indigo-400/10 to-purple-300/10 rounded-full blur-xl pointer-events-none"></div>

            {ongoingSchedule ? (
                <div className="relative z-10">
                    {/* Status Header: iOS Live Activity Pill (Layered Glass) */}
                    <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-md border border-slate-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.03)]">
                            <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span>
                            </span>
                            <span className="text-[10px] font-bold text-slate-800 tracking-tight">
                                Berlangsung
                            </span>
                        </div>
                        {/* Jam Mulai dan Berakhir */}
                        <span className="px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-md border border-slate-200/70 text-slate-600 text-[10px] font-bold tracking-tight shrink-0 shadow-2xs">
                            {ongoingSchedule.startTimeStr} - {ongoingSchedule.endTimeStr}
                        </span>
                    </div>

                    {/* Schedule Title (Ringkas tanpa baris subtitle) */}
                    <div className="min-w-0">
                        <div className="text-[13px] font-bold text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors drop-shadow-2xs" title={ongoingSchedule.title}>
                            {ongoingSchedule.title}
                        </div>
                    </div>

                    {/* iOS Frosted Capsule Progress Bar + Live Countdown */}
                    <div className="mt-2.5 flex items-center gap-2" title={`Sisa waktu: ${ongoingSchedule.countdownText} • Progres: ${ongoingSchedule.progressPercent}%`}>
                        <div className="flex-1 bg-black/[0.05] rounded-full h-1.5 overflow-hidden backdrop-blur-xs border border-white/50 p-[0.5px]">
                            <div 
                                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                style={{ width: `${ongoingSchedule.progressPercent}%` }}
                            ></div>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full shrink-0 shadow-2xs tabular-nums" title="Hitung mundur sisa waktu">
                            {ongoingSchedule.countdownText}
                        </span>
                    </div>

                    {/* Next Schedule: iOS Frosted Inset Capsule dengan Logo Next */}
                    {nextSchedule && (
                        <div className="mt-3 p-2 px-2.5 rounded-[14px] bg-slate-200/40 hover:bg-slate-200/60 backdrop-blur-md border border-slate-200/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-between gap-2 transition-all">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 text-[9px] shrink-0" title="Jadwal Berikutnya">
                                    <i className="fa-solid fa-forward-step"></i>
                                </span>
                                <span className="text-[11.5px] font-medium text-slate-700 truncate" title={nextSchedule.title}>
                                    {nextSchedule.title}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600 bg-white/90 px-1.5 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs shrink-0">
                                {nextSchedule.startTimeStr}
                            </span>
                        </div>
                    )}
                </div>
            ) : nextSchedule ? (
                /* Ketika tidak ada jadwal berjalan, tampilkan jadwal berikutnya langsung */
                <div>
                    <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md shadow-2xs">
                            <i className="fa-regular fa-clock text-indigo-500 text-[9px] shrink-0"></i>
                            <span className="text-[10px] font-semibold text-indigo-700 tracking-tight">
                                Jadwal Berikutnya
                            </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-[10px] font-semibold text-indigo-700 border border-indigo-500/15 shrink-0 shadow-2xs">
                            {nextSchedule.timeUntilStr}
                        </span>
                    </div>

                    <div className="min-w-0">
                        <div className="text-[12.5px] font-bold text-slate-800 tracking-tight truncate group-hover:text-indigo-600 transition-colors" title={nextSchedule.title}>
                            {nextSchedule.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5 flex items-center gap-1">
                            <span>{nextSchedule.displayLabel}</span>
                            {nextSchedule.location && (
                                <>
                                    <span>•</span>
                                    <span className="truncate" title={nextSchedule.location}>{nextSchedule.location}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Idle State */
                <div className="flex items-center justify-between gap-2 py-1 text-slate-400">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-slate-900/[0.04] backdrop-blur-xs flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                            <i className="fa-regular fa-calendar-check text-emerald-500"></i>
                        </div>
                        <span className="text-[11.5px] font-medium text-slate-600 truncate">
                            Bebas Jadwal
                        </span>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-900/[0.03] px-2 py-0.5 rounded-full border border-black/[0.03] shrink-0">
                        {currentTimeStr}
                    </span>
                </div>
            )}
        </div>
    );
}
