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

import { useNotifications } from '../lib/useNotifications';

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
    onNavigate,
    notificationEngine: externalEngine
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all'); // 'all' | 'unread' | 'shared' | 'deadline' | 'schedule' | 'radar'
    const [searchQuery, setSearchQuery] = useState('');
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);

    const dropdownRef = useRef(null);

    const internalEngine = useNotifications({
        tasks,
        schedules,
        notes,
        members,
        currentPicId,
        session,
        roles,
        projects
    });

    const engine = externalEngine || internalEngine;
    const userLevel = engine?.userLevel ?? getRoleLevel(session?.role, roles);
    const {
        activeNotifications = [],
        unreadCount = 0,
        categoryCounts = { all: 0, unread: 0, shared: 0, deadline: 0, schedule: 0, radar: 0 },
        readIds = new Set(),
        markAsRead,
        markAllAsRead,
        dismiss,
        clearAll,
        resetAllNotifications
    } = engine;

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
        markAsRead(id);
    };

    const handleDismiss = (id, e) => {
        if (e) e.stopPropagation();
        dismiss(id);
    };

    const handleMarkAllAsRead = () => {
        markAllAsRead();
    };

    const handleClearAll = () => {
        clearAll();
    };

    const handleItemClick = (item) => {
        // Tandai sudah dibaca otomatis saat diklik
        markAsRead(item.id);

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
                        <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 text-xs shrink-0 flex-wrap">
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

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (resetAllNotifications) resetAllNotifications();
                                    }}
                                    className="flex items-center gap-1 font-semibold text-slate-500 hover:text-indigo-600 transition cursor-pointer text-[11px]"
                                    title="Reset dan muat ulang notifikasi agar berstatus belum dibaca kembali"
                                >
                                    <i className="fa-solid fa-arrows-rotate text-[10px]"></i>
                                    <span>Push Ulang</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleClearAll}
                                    disabled={activeNotifications.length === 0}
                                    className={`flex items-center gap-1 font-semibold transition ${
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
                    </div>
                </>
            )}
        </div>
    );
}
