'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef, useCallback, startTransition, useSyncExternalStore, useMemo } from 'react';
import Link from 'next/link';
import {
    Settings2, Settings, X, Check, Loader2, Feather, ShieldCheck, Database,
    Brain, Zap, Trash2, Plus, Power, GitBranch, LogIn, ArrowLeft, RotateCcw, Lock,
    History, TrendingUp, Store, Sparkles, Target, ArrowUpRight, AlertCircle,
} from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import ChatHistoryDrawer from '@/components/ChatHistoryDrawer';

const BIGQUERY_SUGGESTED_QUERIES = [
    {
        title: 'Pencapaian Omset',
        desc: 'Berapa pencapaian penjualan bulan ini dibanding target per cabang?',
        query: 'Berapa pencapaian omset bulan ini dibanding target per cabang?',
        icon: TrendingUp,
        iconBg: 'bg-rose-100 text-rose-600',
    },
    {
        title: 'Peringkat Cabang',
        desc: 'Cabang mana dengan performa penjualan tertinggi saat ini?',
        query: 'Tampilkan ranking cabang berdasarkan penjualan bulan ini.',
        icon: Store,
        iconBg: 'bg-indigo-100 text-indigo-600',
    },
    {
        title: 'Top Produk & Layanan',
        desc: 'Apa 5 treatment dan produk terlaris di seluruh outlet bulan ini?',
        query: 'Apa 5 treatment dan produk terlaris di seluruh outlet bulan ini?',
        icon: Sparkles,
        iconBg: 'bg-amber-100 text-amber-600',
    },
    {
        title: 'Evaluasi Under-Target',
        desc: 'Daftar outlet yang pencapaian targetnya masih di bawah 80%.',
        query: 'Tampilkan cabang-cabang yang pencapaian targetnya masih di bawah 80%.',
        icon: Target,
        iconBg: 'bg-emerald-100 text-emerald-600',
    },
];

const GENERAL_SUGGESTED_QUERIES = [
    {
        title: 'Format Presentasi Slide',
        desc: 'Buatkan kerangka slide presentasi HTML atau PPTX yang profesional.',
        query: 'Buatkan kerangka presentasi PPTX eksekutif 5 slide untuk evaluasi strategi operasional cabang.',
        icon: Target,
        iconBg: 'bg-indigo-100 text-indigo-600',
    },
    {
        title: 'Rangkum Rapat & Notulensi',
        desc: 'Bantu rapikan poin penting dan action items dari meeting tim.',
        query: 'Bantu saya merapikan catatan rapat ini menjadi action plan dan daftar PIC yang terstruktur.',
        icon: Sparkles,
        iconBg: 'bg-rose-100 text-rose-600',
    },
    {
        title: 'Ide Peningkatan Layanan',
        desc: 'Brainstorming ide promosi dan peningkatan kepuasan customer.',
        query: 'Berikan 5 ide strategi kreatif untuk meningkatkan repeat order treatment kecantikan di klinik.',
        icon: TrendingUp,
        iconBg: 'bg-amber-100 text-amber-600',
    },
    {
        title: 'SOP & Template Rekap',
        desc: 'Susun draf format rekapitulasi kerja mingguan yang rapi.',
        query: 'Buatkan template rekapitulasi kinerja mingguan tim dalam format tabel yang rapi.',
        icon: Store,
        iconBg: 'bg-emerald-100 text-emerald-600',
    },
];

const SETTINGS_KEY = 'busana_chat_provider_settings_v1';
const SESSION_KEY = 'task_abs_session';

const DEFAULT_SETTINGS = {
    baseURL: 'https://9router.absgroup.biz.id/v1',
    apiKey: '',
    model: 'busana',
    showSystemProcess: false,
    canEdit: false,
    hasApiKey: false,
};

function isDireksiOrSuperuser(role) {
    if (!role) return false;
    const clean = String(role).toLowerCase().trim();
    if (clean === 'super user' || clean === 'superuser' || clean === 'superadmin' || clean === 'admin') return true;
    if (clean.includes('direksi') || clean.includes('director')) return true;
    return false;
}

function loadDashboardSession() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s?.memberId || !s?.email) return null;
        return s;
    } catch {
        return null;
    }
}

let cachedSessionSnapshot;

function getSessionSnapshot() {
    const next = loadDashboardSession();
    const prev = cachedSessionSnapshot;
    if (!prev && !next) return null;
    if (prev && next && prev.memberId === next.memberId && prev.email === next.email && prev.role === next.role && prev.can_access_bigquery === next.can_access_bigquery) {
        return prev;
    }
    cachedSessionSnapshot = next;
    return next;
}

function subscribeSession(callback) {
    if (typeof window === 'undefined') return () => {};
    const handleStorage = (e) => {
        if (!e.key || e.key === SESSION_KEY) callback();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
}

export default function BebieChatView({
    session: propSession,
    currentUser: propCurrentUser,
    isEmbedded = false,
    onBack,
}) {
    const storeSession = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
    const session = propSession || storeSession;

    // Identifikasi user & role
    const currentUserRole = propCurrentUser?.role || session?.role || 'Staff';
    const isStaff = currentUserRole === 'Staff';
    const isExecutive = isDireksiOrSuperuser(currentUserRole);
    const canUseBigQuery = Boolean(propCurrentUser?.can_access_bigquery || session?.can_access_bigquery || isExecutive);

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [brainOpen, setBrainOpen] = useState(false);
    const [brainTab, setBrainTab] = useState('memory');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [threads, setThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [toast, setToast] = useState('');
    const scrollRef = useRef(null);

    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3200);
    }, []);

    // Headers untuk auth & session
    const sessionMemberId = session?.memberId || '';
    const sessionEmail = session?.email || '';
    const sessionHeaders = useMemo(() => {
        if (!sessionMemberId) return {};
        return {
            'x-session-member-id': sessionMemberId,
            'x-session-email': sessionEmail,
        };
    }, [sessionMemberId, sessionEmail]);

    // Muat setting provider global dari database
    const loadSettingsFromDb = useCallback(async () => {
        if (!sessionMemberId) return;
        try {
            const res = await fetch('/api/chat/settings', {
                headers: sessionHeaders,
            });
            if (res.ok) {
                const data = await res.json();
                if (data.ok && data.settings) {
                    setSettings(prev => ({
                        ...prev,
                        baseURL: data.settings.baseURL || prev.baseURL,
                        model: data.settings.model || prev.model,
                        apiKey: data.settings.apiKey || '',
                        hasApiKey: Boolean(data.settings.hasApiKey),
                        canEdit: Boolean(data.settings.canEdit),
                    }));
                }
            }
        } catch (err) {
            console.warn('Gagal memuat setting chat provider:', err);
        }
    }, [sessionMemberId, sessionHeaders]);

    useEffect(() => {
        let isMounted = true;
        const initSettings = async () => {
            if (!sessionMemberId) return;
            try {
                const res = await fetch('/api/chat/settings', { headers: sessionHeaders });
                if (res.ok && isMounted) {
                    const data = await res.json();
                    if (data.ok && data.settings) {
                        setSettings(prev => ({
                            ...prev,
                            baseURL: data.settings.baseURL || prev.baseURL,
                            model: data.settings.model || prev.model,
                            apiKey: data.settings.apiKey || '',
                            hasApiKey: Boolean(data.settings.hasApiKey),
                            canEdit: Boolean(data.settings.canEdit),
                        }));
                    }
                }
            } catch (err) {
                console.warn('Gagal memuat setting chat provider:', err);
            }
        };
        initSettings();
        return () => { isMounted = false; };
    }, [sessionMemberId, sessionHeaders]);

    // Transport chat AI SDK
    const transport = useMemo(() => {
        return new DefaultChatTransport({
            api: '/api/chat',
            headers: () => ({
                ...sessionHeaders,
                ...(settings.apiKey ? { 'x-api-key': settings.apiKey } : {}),
                ...(settings.baseURL ? { 'x-endpoint-url': settings.baseURL } : {}),
                ...(settings.model ? { 'x-model-name': settings.model } : {}),
            }),
        });
    }, [sessionHeaders, settings.apiKey, settings.baseURL, settings.model]);

    const {
        messages,
        setMessages,
        sendMessage,
        stop,
        reload,
        status,
        error,
    } = useChat({
        transport,
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    // Auto scroll ke pesan terbaru
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Muat thread riwayat
    const loadThreads = useCallback(async () => {
        if (!sessionMemberId) return;
        try {
            const res = await fetch('/api/chat/threads', {
                headers: sessionHeaders,
            });
            if (res.ok) {
                const data = await res.json();
                if (data.ok && Array.isArray(data.threads)) {
                    setThreads(data.threads);
                }
            }
        } catch (err) {
            console.warn('Gagal memuat thread:', err);
        }
    }, [sessionMemberId, sessionHeaders]);

    useEffect(() => {
        let isMounted = true;
        const initThreads = async () => {
            if (!sessionMemberId) return;
            try {
                const res = await fetch('/api/chat/threads', { headers: sessionHeaders });
                if (res.ok && isMounted) {
                    const data = await res.json();
                    if (data.ok && Array.isArray(data.threads)) {
                        setThreads(data.threads);
                    }
                }
            } catch (err) {
                console.warn('Gagal memuat thread:', err);
            }
        };
        initThreads();
        return () => { isMounted = false; };
    }, [sessionMemberId, sessionHeaders]);

    // Simpan thread saat percakapan selesai
    const saveThreadTimerRef = useRef(null);
    useEffect(() => {
        if (isLoading || messages.length === 0 || !session?.memberId) return;

        if (saveThreadTimerRef.current) clearTimeout(saveThreadTimerRef.current);

        saveThreadTimerRef.current = setTimeout(async () => {
            try {
                const threadId = activeThreadId || `thread_${Date.now()}`;
                const firstUserMsg = messages.find(m => m.role === 'user');
                const title = firstUserMsg?.content?.slice(0, 50) || 'Percakapan Bebie';

                const res = await fetch('/api/chat/threads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...sessionHeaders,
                    },
                    body: JSON.stringify({
                        id: threadId,
                        title,
                        messages,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.ok && !activeThreadId) {
                        setActiveThreadId(threadId);
                        loadThreads();
                    }
                }
            } catch (err) {
                console.warn('Gagal menyimpan riwayat chat:', err);
            }
        }, 1500);

        return () => {
            if (saveThreadTimerRef.current) clearTimeout(saveThreadTimerRef.current);
        };
    }, [messages, isLoading, activeThreadId, session?.memberId, sessionHeaders, loadThreads]);

    const handleSelectThread = useCallback(async (threadId) => {
        try {
            const res = await fetch(`/api/chat/threads/${threadId}`, {
                headers: sessionHeaders,
            });
            if (res.ok) {
                const data = await res.json();
                if (data.ok && data.thread) {
                    setActiveThreadId(data.thread.id);
                    setMessages(data.thread.messages || []);
                    setHistoryOpen(false);
                    showToast('Riwayat percakapan dimuat.');
                }
            }
        } catch (err) {
            showToast('Gagal memuat riwayat: ' + err.message);
        }
    }, [sessionHeaders, setMessages, showToast]);

    const handleDeleteThread = useCallback(async (threadId) => {
        try {
            const res = await fetch(`/api/chat/threads/${threadId}`, {
                method: 'DELETE',
                headers: sessionHeaders,
            });
            if (res.ok) {
                setThreads(prev => prev.filter(t => t.id !== threadId));
                if (activeThreadId === threadId) {
                    setActiveThreadId(null);
                    setMessages([]);
                }
                showToast('Percakapan dihapus.');
            }
        } catch (err) {
            showToast('Gagal menghapus percakapan: ' + err.message);
        }
    }, [sessionHeaders, activeThreadId, setMessages, showToast]);

    const handleNewChat = useCallback(() => {
        setActiveThreadId(null);
        setMessages([]);
        showToast('Memulai percakapan baru.');
    }, [setMessages, showToast]);

    // JIKA USER BELUM LOGIN
    if (!session) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-white/80 p-8 max-w-md text-center shadow-xl space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center mx-auto shadow-sm">
                        <LogIn size={26} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Login Diperlukan</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Anda harus masuk menggunakan akun dashboard terlebih dahulu untuk dapat menggunakan Chat Bebie.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs shadow-md transition"
                    >
                        Ke Halaman Utama
                    </Link>
                </div>
            </div>
        );
    }

    // JIKA USER ROLE STAFF (OTORISASI KHUSUS LEADER)
    if (isStaff) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-rose-200/80 p-8 max-w-md text-center shadow-xl space-y-4 animate-fade-in">
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                        <Lock size={26} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-slate-900">Akses Terbatas: Khusus Leader</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Fitur <strong>Chat Bebie (Beauty Bestie AI)</strong> saat ini hanya diperuntukkan bagi jajaran Leader (Koordinator, SPV, Manager, dan Direksi).
                        </p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-2xl text-left text-[11px] text-amber-800 flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                        <span>Akun Anda terdaftar dengan peran <strong>Staff</strong>. Silakan hubungi atasan atau Direksi jika memerlukan akses ini.</span>
                    </div>
                    {onBack ? (
                        <button
                            onClick={onBack}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-sm transition"
                        >
                            <ArrowLeft size={14} />
                            Kembali ke Dashboard
                        </button>
                    ) : (
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-sm transition"
                        >
                            <ArrowLeft size={14} />
                            Ke Halaman Utama
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    const suggestedQueries = canUseBigQuery ? BIGQUERY_SUGGESTED_QUERIES : GENERAL_SUGGESTED_QUERIES;

    return (
        <div className={`${isEmbedded ? 'h-full' : 'h-screen'} flex flex-col bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] text-slate-900 ${isEmbedded ? 'rounded-2xl border border-white/80 shadow-xs overflow-hidden' : ''}`}>
            {/* Header Chat */}
            <header className="shrink-0 bg-white/85 backdrop-blur-md border-b border-white/80 shadow-xs z-10">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {onBack ? (
                            <button
                                type="button"
                                onClick={onBack}
                                title="Kembali ke Dashboard Utama"
                                aria-label="Kembali ke Dashboard Utama"
                                className="p-2 -ml-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                            >
                                <ArrowLeft size={16} />
                            </button>
                        ) : !isEmbedded ? (
                            <Link
                                href="/"
                                title="Kembali ke Dashboard Utama"
                                aria-label="Kembali ke Dashboard Utama"
                                className="p-2 -ml-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                            >
                                <ArrowLeft size={16} />
                            </Link>
                        ) : null}

                        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-pink-200 shadow-sm shadow-pink-500/20 bg-pink-100 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/bebie-avatar.jpg" alt="Bebie" className="w-full h-full object-cover" />
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 leading-tight truncate">
                                    Bebie - Beauty Bestie AI
                                </span>
                                {canUseBigQuery ? (
                                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0" title="Akses BigQuery Aktif">
                                        <Database size={9} /> BigQuery Aktif
                                    </span>
                                ) : (
                                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0" title="Mode Asisten Umum (Akses BigQuery diatur oleh Direksi)">
                                        <Sparkles size={9} /> Mode Umum
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-100/70 border border-slate-200/60 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setHistoryOpen(true);
                                loadThreads();
                            }}
                            title="Riwayat percakapan (retensi 30 hari)"
                            aria-label="Riwayat percakapan"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-all relative"
                        >
                            <History size={15} />
                            {threads.length > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-500 ring-2 ring-white"></span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleNewChat}
                            disabled={messages.length === 0 && !activeThreadId}
                            title="Mulai percakapan baru"
                            aria-label="Mulai percakapan baru"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-all disabled:opacity-35 disabled:hover:bg-transparent"
                        >
                            <RotateCcw size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setBrainOpen(true)}
                            title="Memori & Skill agent"
                            aria-label="Memori dan skill agent"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-all relative"
                        >
                            <Brain size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            title="Pengaturan provider AI"
                            aria-label="Pengaturan provider AI"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-all"
                        >
                            <Settings2 size={15} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Area Pesan Chat */}
            <main ref={scrollRef} className="flex-1 overflow-y-auto py-6 px-2 space-y-5 custom-scrollbar min-h-0">
                {messages.length === 0 && !isLoading && (
                    <div className="max-w-2xl mx-auto text-center pt-6 sm:pt-10 px-4">
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md shadow-pink-500/15 mx-auto mb-3 bg-gradient-to-tr from-pink-200 to-rose-100 p-0.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/bebie-avatar.jpg" alt="Bebie" className="w-full h-full object-cover rounded-[14px]" />
                            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Online"></span>
                        </div>

                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                            Halo{session?.name ? `, ${session.name.split(' ')[0]}` : ''}! Ada yang bisa Bebie bantu?
                        </h2>
                        <p className="text-xs sm:text-[13px] text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                            {canUseBigQuery
                                ? 'Bebie siap menganalisis data penjualan outlet, pencapaian target cabang, dan performa produk langsung dari Google BigQuery.'
                                : 'Bebie siap membantu menyusun format laporan, presentasi PPTX/HTML eksekutif, strategi operasional, dan merapikan catatan kerja tim.'}
                        </p>

                        {!canUseBigQuery && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                                <Sparkles size={12} className="text-amber-600" />
                                <span>Akses BigQuery diatur per-user oleh Direksi di Pengaturan Organisasi.</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mt-6 text-left">
                            {suggestedQueries.map((item) => {
                                const IconComponent = item.icon;
                                return (
                                    <button
                                        key={item.title}
                                        type="button"
                                        onClick={() => sendMessage({ text: item.query })}
                                        className="group relative flex items-start gap-3 p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/90 hover:border-pink-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${item.iconBg}`}>
                                            <IconComponent size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-semibold text-xs text-slate-800 group-hover:text-pink-600 transition-colors">
                                                    {item.title}
                                                </span>
                                                <ArrowUpRight size={13} className="text-slate-300 group-hover:text-pink-500 transition-colors shrink-0" />
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                                                {item.desc}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {messages.map((m, idx) => (
                    <ChatMessage
                        key={m.id || idx}
                        message={m}
                        showSystemProcess={settings.showSystemProcess || false}
                        isLoading={isLoading && idx === messages.length - 1}
                    />
                ))}

                {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex gap-2.5 sm:gap-3 max-w-3xl mx-auto w-full flex-row">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-xs border border-pink-200 bg-pink-100 flex items-center justify-center mt-0.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/bebie-avatar.jpg" alt="Bebie" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-0 max-w-[85%] sm:max-w-[78%] items-start">
                            <div className="flex items-center gap-1.5 px-1 mb-0.5">
                                <span className="font-bold text-xs text-slate-800">Bebie</span>
                            </div>
                            <div className="w-full max-w-md rounded-2xl border border-pink-200/90 bg-gradient-to-br from-pink-50/70 via-white to-rose-50/40 p-3.5 shadow-xs space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                                            <Settings size={15} className="animate-spin text-pink-600" />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-800 truncate">
                                            Sedang Meracik Data Biar Glowing... 🧴✨
                                        </span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700 animate-pulse shrink-0">
                                        Memproses...
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-pink-100/80 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-pink-500 via-rose-400 to-pink-600 rounded-full animate-pulse w-2/5"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="max-w-3xl mx-auto">
                        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 space-y-2">
                            <div>
                                <div className="font-semibold mb-0.5">Permintaan Gagal</div>
                                <div className="text-rose-600/90 break-all">{error.message}</div>
                            </div>
                            <div className="flex items-center gap-2 pt-0.5">
                                <button
                                    onClick={() => reload()}
                                    disabled={isLoading}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                                >
                                    <RotateCcw size={11} />
                                    Coba Lagi
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Input Composer */}
            <footer className="shrink-0 pb-4 pt-1 bg-gradient-to-t from-white/70 to-transparent">
                <ChatInput sendMessage={sendMessage} isLoading={isLoading} stop={stop} />
            </footer>

            {/* Toast Notifikasi */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-semibold shadow-lg animate-in fade-in">
                    {toast}
                </div>
            )}

            {/* History Drawer */}
            <ChatHistoryDrawer
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                threads={threads}
                activeThreadId={activeThreadId}
                onSelectThread={handleSelectThread}
                onDeleteThread={handleDeleteThread}
                onNewChat={handleNewChat}
            />

            {/* Brain Modal (Memori & Skill) */}
            {brainOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setBrainOpen(false)}></div>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="brain-modal-title"
                        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col max-h-[92vh]"
                    >
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 id="brain-modal-title" className="font-bold text-sm text-slate-900">Otak Agent Bebie</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">Memori & skill yang dipelajari dan diingat oleh Bebie.</p>
                            </div>
                            <button onClick={() => setBrainOpen(false)} aria-label="Tutup" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-5 pt-3 flex gap-1.5 shrink-0">
                            <button
                                onClick={() => setBrainTab('memory')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${brainTab === 'memory' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Brain size={12} /> Memori
                            </button>
                            <button
                                onClick={() => setBrainTab('skills')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${brainTab === 'skills' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Zap size={12} /> Skill
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto">
                            {brainTab === 'memory' ? (
                                <MemoryPanel sessionMember={session} sessionHeaders={sessionHeaders} onToast={showToast} />
                            ) : (
                                <SkillPanel sessionHeaders={sessionHeaders} onToast={showToast} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal (Provider Settings) */}
            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSettingsOpen(false)}></div>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="settings-modal-title"
                        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 flex flex-col max-h-[92vh]"
                    >
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                    <h3 id="settings-modal-title" className="font-bold text-sm text-slate-900 truncate">Pengaturan Provider AI</h3>
                                    {isExecutive ? (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-100 text-pink-700 border border-pink-200 shrink-0">
                                            Direksi (Bisa Edit)
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 shrink-0">
                                            <Lock size={10} /> Mode Baca
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    {isExecutive
                                        ? 'Konfigurasi provider berlaku global untuk seluruh karyawan di sistem.'
                                        : 'Konfigurasi provider berlaku global dan dikelola terpusat oleh Direksi.'}
                                </p>
                            </div>
                            <button onClick={() => setSettingsOpen(false)} aria-label="Tutup pengaturan" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Base URL (Endpoint)</label>
                                <input
                                    type="text"
                                    value={settings.baseURL}
                                    disabled={!isExecutive}
                                    onChange={(e) => setSettings({ ...settings, baseURL: e.target.value })}
                                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-pink-500 disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Model Name</label>
                                <input
                                    type="text"
                                    value={settings.model}
                                    disabled={!isExecutive}
                                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-pink-500 disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    API Key Provider
                                    {settings.hasApiKey && <span className="ml-1 text-emerald-600 font-semibold">(Tersimpan di Server)</span>}
                                </label>
                                <input
                                    type="password"
                                    placeholder={settings.hasApiKey ? '••••••••••••••••' : 'Masukkan API Key...'}
                                    value={settings.apiKey}
                                    disabled={!isExecutive}
                                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                    className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-pink-500 disabled:opacity-60"
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(settings.showSystemProcess)}
                                        onChange={(e) => {
                                            const updated = { ...settings, showSystemProcess: e.target.checked };
                                            setSettings(updated);
                                            localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
                                        }}
                                        className="rounded text-pink-600 focus:ring-pink-500 cursor-pointer"
                                    />
                                    <span>Tampilkan proses sistem & tool di chat</span>
                                </label>
                            </div>

                            {isExecutive && (
                                <div className="pt-3">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/chat/settings', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        ...sessionHeaders,
                                                    },
                                                    body: JSON.stringify({
                                                        baseURL: settings.baseURL,
                                                        model: settings.model,
                                                        apiKey: settings.apiKey,
                                                    }),
                                                });
                                                const d = await res.json();
                                                if (d.ok) {
                                                    showToast('Pengaturan provider berhasil disimpan ke database.');
                                                    setSettingsOpen(false);
                                                } else {
                                                    showToast('Gagal: ' + d.error);
                                                }
                                            } catch (err) {
                                                showToast('Gagal: ' + err.message);
                                            }
                                        }}
                                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 shadow-sm transition"
                                    >
                                        Simpan Pengaturan Global
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Subkomponen Panel Memori
function MemoryPanel({ sessionMember, sessionHeaders, onToast }) {
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newContent, setNewContent] = useState('');
    const [newScope, setNewScope] = useState('user');
    const isExecutive = isDireksiOrSuperuser(sessionMember?.role);

    const loadMemories = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/chat/memory', { headers: sessionHeaders });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.memories || []);
                setMemories(list);
            }
        } catch (err) {
            console.warn('Gagal load memori:', err);
        } finally {
            setLoading(false);
        }
    }, [sessionHeaders]);

    useEffect(() => {
        let isMounted = true;
        const initMemories = async () => {
            try {
                const res = await fetch('/api/chat/memory', { headers: sessionHeaders });
                if (res.ok && isMounted) {
                    const data = await res.json();
                    const list = Array.isArray(data) ? data : (data.memories || []);
                    setMemories(list);
                }
            } catch (err) {
                console.warn('Gagal load memori:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        initMemories();
        return () => { isMounted = false; };
    }, [sessionHeaders]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newContent.trim()) return;
        try {
            const res = await fetch('/api/chat/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...sessionHeaders },
                body: JSON.stringify({ content: newContent.trim(), scope: newScope }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok && (d.ok || d.memory)) {
                setNewContent('');
                loadMemories();
                onToast('Memori berhasil ditambahkan.');
            } else {
                onToast('Gagal: ' + (d.error || 'Gagal menambahkan memori'));
            }
        } catch (err) {
            onToast('Gagal: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/chat/memory/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: sessionHeaders,
            });
            if (res.ok) {
                setMemories(prev => prev.filter(m => m.id !== id));
                onToast('Memori dinonaktifkan.');
            }
        } catch (err) {
            onToast('Gagal: ' + err.message);
        }
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleCreate} className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                    type="text"
                    placeholder="Tambah fakta memori baru (mis. Target FAT BT01 adalah 500jt)..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-pink-500"
                />
                <div className="flex items-center justify-between gap-2">
                    <select
                        value={newScope}
                        onChange={(e) => setNewScope(e.target.value)}
                        className="text-xs p-1.5 rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="user">Hanya Akun Saya (User)</option>
                        {isExecutive && <option value="global">Berlaku Semua User (Global)</option>}
                    </select>
                    <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition"
                    >
                        Simpan
                    </button>
                </div>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto">
                {loading ? (
                    <div className="text-center py-4 text-xs text-slate-400">Memuat memori...</div>
                ) : memories.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">Belum ada memori tersimpan.</div>
                ) : (
                    memories.map((m) => (
                        <div key={m.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-2 text-xs">
                            <div className="min-w-0 flex-1">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mr-1.5 ${m.scope === 'global' ? 'bg-pink-100 text-pink-700' : 'bg-slate-200 text-slate-700'}`}>
                                    {m.scope.toUpperCase()}
                                </span>
                                <span className="text-slate-800">{m.content}</span>
                            </div>
                            <button
                                onClick={() => handleDelete(m.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                                title="Hapus memori"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Subkomponen Panel Skill
function SkillPanel({ sessionHeaders, onToast }) {
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadSkills = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/chat/skills', { headers: sessionHeaders });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.skills || []);
                setSkills(list);
            }
        } catch (err) {
            console.warn('Gagal load skill:', err);
        } finally {
            setLoading(false);
        }
    }, [sessionHeaders]);

    useEffect(() => {
        let isMounted = true;
        const initSkills = async () => {
            try {
                const res = await fetch('/api/chat/skills', { headers: sessionHeaders });
                if (res.ok && isMounted) {
                    const data = await res.json();
                    const list = Array.isArray(data) ? data : (data.skills || []);
                    setSkills(list);
                }
            } catch (err) {
                console.warn('Gagal load skill:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        initSkills();
        return () => { isMounted = false; };
    }, [sessionHeaders]);

    return (
        <div className="space-y-3">
            <p className="text-xs text-slate-500">
                Skill adalah playbook pedoman analisis dan keahlian yang dimiliki Bebie untuk mengeksekusi tugas operasional.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
                {loading ? (
                    <div className="text-center py-4 text-xs text-slate-400">Memuat skill...</div>
                ) : skills.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">Belum ada skill aktif.</div>
                ) : (
                    skills.map((s) => (
                        <div key={s.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex flex-col gap-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-800">
                                <span>{s.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">v{s.version || 1}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2">{s.description || s.content}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
