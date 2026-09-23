'use client';

import { useState, useMemo } from 'react';
import {
    X, Plus, MessageSquare, Trash2, Clock, Calendar, Check,
    AlertCircle, Sparkles, ChevronRight, Loader2
} from 'lucide-react';

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function calculateDaysLeft(dateString) {
    if (!dateString) return 30;
    const updated = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    return Math.max(1, 30 - diffDays);
}

export default function ChatHistoryDrawer({
    isOpen,
    onClose,
    threads = [],
    activeThreadId,
    onSelectThread,
    onNewChat,
    onDeleteThread,
    isLoading = false,
    dbMissing = false,
}) {
    const [deletingId, setDeletingId] = useState(null);

    // Kelompokkan thread berdasarkan waktu (Hari Ini, Kemarin, 7 Hari, 30 Hari)
    const groupedThreads = useMemo(() => {
        const groups = {
            today: [],
            yesterday: [],
            last7Days: [],
            last30Days: [],
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
        const startOf7Days = startOfToday - 6 * 24 * 60 * 60 * 1000;

        threads.forEach((t) => {
            const time = new Date(t.updated_at || t.created_at).getTime();
            if (time >= startOfToday) {
                groups.today.push(t);
            } else if (time >= startOfYesterday) {
                groups.yesterday.push(t);
            } else if (time >= startOf7Days) {
                groups.last7Days.push(t);
            } else {
                groups.last30Days.push(t);
            }
        });

        return [
            { label: 'Hari Ini', items: groups.today },
            { label: 'Kemarin', items: groups.yesterday },
            { label: '7 Hari Terakhir', items: groups.last7Days },
            { label: '30 Hari Terakhir', items: groups.last30Days },
        ].filter((g) => g.items.length > 0);
    }, [threads]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer Content */}
            <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 border-r border-slate-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                            <Clock size={16} />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm text-slate-800 leading-tight">Riwayat Percakapan</h2>
                            <p className="text-[10px] text-slate-400">Tersimpan maksimal 30 hari</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                        aria-label="Tutup riwayat"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Info Retensi 30 Hari */}
                <div className="px-4 py-2.5 bg-gradient-to-r from-pink-50/80 to-purple-50/40 border-b border-pink-100/60 flex items-center justify-between text-[11px] text-pink-900">
                    <span className="flex items-center gap-1.5 font-medium">
                        <Sparkles size={12} className="text-pink-600 shrink-0" />
                        Retensi Otomatis 30 Hari
                    </span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-pink-200 text-pink-700 font-mono">
                        Auto-Expire
                    </span>
                </div>

                {dbMissing && (
                    <div className="m-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                        <div className="text-[11px] leading-relaxed">
                            Database Supabase belum memiliki tabel <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">chat_threads</code>. Riwayat disimpan sementara di perangkat lokal.
                        </div>
                    </div>
                )}

                {/* Tombol Percakapan Baru */}
                <div className="p-3 border-b border-slate-100">
                    <button
                        onClick={() => {
                            onNewChat();
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white font-semibold text-xs shadow-xs transition-colors"
                    >
                        <Plus size={15} />
                        Mulai Percakapan Baru
                    </button>
                </div>

                {/* Thread List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 size={20} className="animate-spin text-pink-500" />
                            <span className="text-xs">Memuat riwayat...</span>
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                                <MessageSquare size={20} />
                            </div>
                            <div className="text-xs font-semibold text-slate-700 mb-1">Belum Ada Riwayat</div>
                            <p className="text-[11px] text-slate-400 max-w-[200px]">
                                Percakapan Anda dengan Bebie akan otomatis tersimpan di sini selama 30 hari.
                            </p>
                        </div>
                    ) : (
                        groupedThreads.map((group) => (
                            <div key={group.label} className="space-y-1.5">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                                    {group.label}
                                </div>
                                <div className="space-y-1">
                                    {group.items.map((thread) => {
                                        const isActive = thread.id === activeThreadId;
                                        const daysLeft = calculateDaysLeft(thread.updated_at || thread.created_at);

                                        return (
                                            <div
                                                key={thread.id}
                                                className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all cursor-pointer ${
                                                    isActive
                                                        ? 'bg-pink-50 border border-pink-200 text-pink-900 font-medium'
                                                        : 'hover:bg-slate-100 text-slate-700'
                                                }`}
                                                onClick={() => {
                                                    onSelectThread(thread.id);
                                                    onClose();
                                                }}
                                            >
                                                <div className="min-w-0 flex-1 pr-2">
                                                    <div className="truncate font-medium text-slate-800 group-hover:text-pink-600 transition-colors">
                                                        {thread.title || 'Percakapan Tanpa Judul'}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                                        <span>{formatRelativeTime(thread.updated_at || thread.created_at)}</span>
                                                        <span>•</span>
                                                        <span title="Batas retensi otomatis">sisa {daysLeft} hari</span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (deletingId === thread.id) {
                                                            onDeleteThread(thread.id);
                                                            setDeletingId(null);
                                                        } else {
                                                            setDeletingId(thread.id);
                                                            setTimeout(() => setDeletingId((prev) => (prev === thread.id ? null : prev)), 3000);
                                                        }
                                                    }}
                                                    title={deletingId === thread.id ? 'Klik sekali lagi untuk konfirmasi hapus' : 'Hapus percakapan'}
                                                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                                                        deletingId === thread.id
                                                            ? 'bg-rose-500 text-white opacity-100'
                                                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100'
                                                    }`}
                                                >
                                                    {deletingId === thread.id ? <Check size={13} /> : <Trash2 size={13} />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 text-center text-[10px] text-slate-400 bg-slate-50/50">
                    Setiap percakapan akan otomatis terhapus setelah 30 hari tidak aktif.
                </div>
            </div>
        </div>
    );
}
