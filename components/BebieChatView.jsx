'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef, useCallback, startTransition, useSyncExternalStore, useMemo } from 'react';
import Link from 'next/link';
import {
    Settings2, Settings, X, Check, Loader2, Feather, ShieldCheck, Database,
    Brain, Zap, Trash2, Plus, Power, GitBranch, LogIn, ArrowLeft, RotateCcw, Lock,
    History, TrendingUp, Store, Sparkles, Target, ArrowUpRight, AlertCircle,
    CheckSquare, PlusCircle, Users, Tag, Video, Award, MessageSquare, Clock,
} from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import ChatHistoryDrawer from '@/components/ChatHistoryDrawer';
import BebieAvatar from '@/components/BebieAvatar';

const BIGQUERY_SUGGESTED_QUERIES = [
    {
        title: 'Cek Poin & Member Loyalty',
        desc: 'Cari data pelanggan, saldo poin loyalty, dan masa berlaku kartu member.',
        query: 'Bebie, bagaimana cara cek poin dan profil member pelanggan? Tolong berikan ringkasannya.',
        icon: Award,
        iconBg: 'bg-amber-100 text-amber-600',
    },
    {
        title: 'Absensi BA Hari Ini',
        desc: 'Cek rekap kehadiran & shift Beauty Advisor di seluruh cabang toko hari ini.',
        query: 'Bebie, cek rekap absensi Beauty Advisor yang hadir di outlet hari ini dan siapa saja yang masih bertugas.',
        icon: Users,
        iconBg: 'bg-pink-100 text-pink-600',
    },
    {
        title: 'Setoran Konten BA',
        desc: 'Pantau video promosi TikTok & IG yang di-upload oleh Beauty Advisor.',
        query: 'Bebie, cek setoran konten video promosi Beauty Advisor yang masuk hari ini beserta link videonya.',
        icon: Video,
        iconBg: 'bg-violet-100 text-violet-600',
    },
    {
        title: 'Audit KPI & SP Konten',
        desc: 'Lihat daftar BA yang banyak alpa setor konten dan direkomendasikan SP.',
        query: 'Bebie, tampilkan rekap kepatuhan konten BA dan siapa saja yang direkomendasikan SP3 karena alpa setor.',
        icon: AlertCircle,
        iconBg: 'bg-rose-100 text-rose-600',
    },
    {
        title: 'Promo Aktif Hari Ini',
        desc: 'Cek daftar promo diskon & hadiah yang sedang berjalan di outlet hari ini.',
        query: 'Bebie, apa saja promo dan diskon yang sedang aktif berjalan di outlet hari ini?',
        icon: Tag,
        iconBg: 'bg-rose-100 text-rose-600',
    },
    {
        title: 'Pencapaian Omset',
        desc: 'Berapa pencapaian penjualan bulan ini dibanding target per cabang?',
        query: 'Berapa pencapaian omset bulan ini dibanding target per cabang?',
        icon: TrendingUp,
        iconBg: 'bg-indigo-100 text-indigo-600',
    },
];

const GENERAL_SUGGESTED_QUERIES = [
    {
        title: 'Cek Poin & Member Loyalty',
        desc: 'Cari data pelanggan, saldo poin loyalty, dan masa berlaku kartu member.',
        query: 'Bebie, bagaimana cara cek poin dan profil member pelanggan? Tolong berikan ringkasannya.',
        icon: Award,
        iconBg: 'bg-amber-100 text-amber-600',
    },
    {
        title: 'Absensi BA Hari Ini',
        desc: 'Cek rekap kehadiran & shift Beauty Advisor di seluruh cabang toko hari ini.',
        query: 'Bebie, cek rekap absensi Beauty Advisor yang hadir di outlet hari ini dan siapa saja yang masih bertugas.',
        icon: Users,
        iconBg: 'bg-pink-100 text-pink-600',
    },
    {
        title: 'Setoran Konten BA',
        desc: 'Pantau video promosi TikTok & IG yang di-upload oleh Beauty Advisor.',
        query: 'Bebie, cek setoran konten video promosi Beauty Advisor yang masuk hari ini beserta link videonya.',
        icon: Video,
        iconBg: 'bg-violet-100 text-violet-600',
    },
    {
        title: 'Audit KPI & SP Konten',
        desc: 'Lihat daftar BA yang banyak alpa setor konten dan direkomendasikan SP.',
        query: 'Bebie, tampilkan rekap kepatuhan konten BA dan siapa saja yang direkomendasikan SP3 karena alpa setor.',
        icon: AlertCircle,
        iconBg: 'bg-amber-100 text-amber-600',
    },
    {
        title: 'Promo Aktif Hari Ini',
        desc: 'Cek daftar promo diskon & hadiah yang sedang aktif di semua cabang outlet.',
        query: 'Bebie, apa saja promo dan diskon yang sedang aktif berjalan di outlet hari ini?',
        icon: Tag,
        iconBg: 'bg-rose-100 text-rose-600',
    },
    {
        title: 'Task Saya yang Berjalan',
        desc: 'Lihat daftar tugas yang ditugaskan ke saya dan deadline terdekat.',
        query: 'Bebie, tampilkan daftar task saya yang sedang berjalan dan urutkan berdasarkan deadline terdekat.',
        icon: CheckSquare,
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

    // Layout 2-kolom: Sidebar kanan dengan tab History, Memori, Skill, Setting
    const [sidebarTab, setSidebarTab] = useState('history'); // 'history' | 'memory' | 'skill' | 'settings'
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [deletingThreadId, setDeletingThreadId] = useState(null);

    // Pengaturan mode avatar saat idle (video vs statis) & trigger state animasi
    const [avatarIdleMode, setAvatarIdleMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('bebie_avatar_idle_mode') || 'video';
        }
        return 'video';
    });
    const [learningUntil, setLearningUntil] = useState(0);
    const [clock, setClock] = useState(() => Date.now());

    const triggerLearning = useCallback((durationMs = 4500) => {
        setLearningUntil(Date.now() + durationMs);
        setClock(Date.now());
    }, []);

    useEffect(() => {
        if (learningUntil > Date.now()) {
            const remaining = learningUntil - Date.now() + 50;
            const timer = setTimeout(() => {
                setClock(Date.now());
            }, Math.max(100, remaining));
            return () => clearTimeout(timer);
        }
    }, [learningUntil]);

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

    // Deteksi apakah pesan aktif/terbaru sedang memanggil tool memori atau skill
    const latestMessage = messages[messages.length - 1];
    const isLatestMessageLearning = useMemo(() => {
        if (!latestMessage) return false;
        const parts = Array.isArray(latestMessage.parts) ? latestMessage.parts : [];
        const toolInvocations = Array.isArray(latestMessage.toolInvocations) ? latestMessage.toolInvocations : [];
        const hasLearningPart = parts.some(p => {
            const tName = p.toolName || p.toolInvocation?.toolName;
            return tName === 'remember' || tName === 'refine_skill';
        });
        const hasLearningInv = toolInvocations.some(ti => ti.toolName === 'remember' || ti.toolName === 'refine_skill');
        return hasLearningPart || hasLearningInv;
    }, [latestMessage]);

    // Status avatar global Bebie: 'learning' | 'working' | 'idle'
    const bebieState = useMemo(() => {
        const isLearning = (clock < learningUntil) || (isLoading && isLatestMessageLearning);
        if (isLearning) return 'learning';
        if (isLoading) return 'working';
        return 'idle';
    }, [clock, learningUntil, isLoading, isLatestMessageLearning]);

    const activeThread = useMemo(() => {
        return threads.find((t) => t.id === activeThreadId);
    }, [threads, activeThreadId]);

    const currentChatTitle = activeThread?.title || 'Percakapan Bebie';

    // Kelompokkan thread riwayat berdasarkan waktu (Hari Ini, Kemarin, 7 Hari, 30 Hari)
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
                // Ambil teks dari user message pertama untuk judul percakapan
                const firstUserMsg = messages.find(m => m.role === 'user');
                const userText =
                    firstUserMsg?.parts?.find(p => p.type === 'text')?.text ||
                    (typeof firstUserMsg?.content === 'string' ? firstUserMsg.content : '') ||
                    '';
                const title = userText.trim().slice(0, 60) || 'Percakapan Bebie';

                // Hanya sertakan id jika activeThreadId sudah ada (berupa UUID valid)
                const payload = {
                    title,
                    messages,
                };
                if (activeThreadId) {
                    payload.id = activeThreadId;
                }

                const res = await fetch('/api/chat/threads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...sessionHeaders,
                    },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.ok && data.thread) {
                        if (!activeThreadId && data.thread.id) {
                            setActiveThreadId(data.thread.id);
                        }
                        // Update daftar thread di history secara langsung
                        setThreads(prev => {
                            const remaining = prev.filter(t => t.id !== data.thread.id);
                            return [data.thread, ...remaining];
                        });
                    }
                }
            } catch (err) {
                console.warn('Gagal menyimpan riwayat chat:', err);
            }
        }, 500);

        return () => {
            if (saveThreadTimerRef.current) clearTimeout(saveThreadTimerRef.current);
        };
    }, [messages, isLoading, activeThreadId, session?.memberId, sessionHeaders]);

    const handleSelectThread = useCallback(async (threadId) => {
        try {
            const res = await fetch(`/api/chat/threads/${threadId}`, {
                headers: sessionHeaders,
            });
            if (res.ok) {
                const data = await res.json();
                if (data.ok && data.thread) {
                    setActiveThreadId(data.thread.id);
                    const restoredMessages = (data.thread.messages || []).map((m, idx) => ({
                        id: m.id || `msg_${idx}_${Date.now()}`,
                        role: m.role,
                        content: m.content || m.parts?.find(p => p.type === 'text')?.text || '',
                        parts: Array.isArray(m.parts) && m.parts.length > 0
                            ? m.parts
                            : [{ type: 'text', text: m.content || '' }],
                        createdAt: m.createdAt || m.created_at || new Date().toISOString(),
                    }));
                    setMessages(restoredMessages);
                    setHistoryOpen(false);
                    setIsMobileSidebarOpen(false);
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
        setHistoryOpen(false);
        setIsMobileSidebarOpen(false);
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

    // Render Konten Sidebar Kanan (Avatar, Nama, Segmented Tab, dan Konten Tab)
    const renderRightSidebarContent = () => (
        <div className="flex flex-col h-full bg-white/90 backdrop-blur-md">
            {/* Header Profil: Avatar Bebie + Nama + Role */}
            <div className="pt-5 pb-2 px-3 flex flex-col items-center text-center shrink-0 border-b border-pink-100/50">
                <BebieAvatar
                    state={bebieState}
                    size="lg"
                    useStaticIdle={avatarIdleMode === 'static'}
                />
                <h3 className="font-bold text-slate-900 text-sm mt-2 leading-tight tracking-tight">
                    Bebie
                </h3>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-pink-50 text-pink-600 border border-pink-200/70">
                    <Sparkles size={10} className="text-pink-500 shrink-0" />
                    <span>Beauty Bestie AI</span>
                </div>
            </div>

            {/* Segmented Tab Bar (History, Memori, Skill, Setting) */}
            <div className="px-2.5 py-2 shrink-0 border-b border-slate-100/80">
                <div className="grid grid-cols-4 p-1 rounded-2xl bg-slate-100/80 border border-slate-200/70 gap-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => setSidebarTab('history')}
                        title="History Percakapan"
                        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl font-semibold transition-all cursor-pointer ${
                            sidebarTab === 'history'
                                ? 'bg-white text-pink-600 shadow-xs border border-pink-200/80 font-bold'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        <MessageSquare size={13} className="shrink-0" />
                        <span className="text-[9.5px] truncate">History</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSidebarTab('memory')}
                        title="Memori Fakta AI"
                        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl font-semibold transition-all cursor-pointer ${
                            sidebarTab === 'memory'
                                ? 'bg-white text-pink-600 shadow-xs border border-pink-200/80 font-bold'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        <Brain size={13} className="shrink-0" />
                        <span className="text-[9.5px] truncate">Memori</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSidebarTab('skill')}
                        title="Skill Operasional"
                        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl font-semibold transition-all cursor-pointer ${
                            sidebarTab === 'skill'
                                ? 'bg-white text-pink-600 shadow-xs border border-pink-200/80 font-bold'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        <Zap size={13} className="shrink-0" />
                        <span className="text-[9.5px] truncate">Skill</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSidebarTab('settings')}
                        title="Pengaturan Asisten"
                        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl font-semibold transition-all cursor-pointer ${
                            sidebarTab === 'settings'
                                ? 'bg-white text-pink-600 shadow-xs border border-pink-200/80 font-bold'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        <Settings2 size={13} className="shrink-0" />
                        <span className="text-[9.5px] truncate">Setting</span>
                    </button>
                </div>
            </div>

            {/* Konten Tab Aktif (Scrollable) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2.5 min-h-0">
                {sidebarTab === 'history' && (
                    <div className="space-y-2.5">
                        <button
                            type="button"
                            onClick={handleNewChat}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                            <Plus size={14} />
                            Percakapan Baru
                        </button>

                        <div className="px-2.5 py-1.5 bg-gradient-to-r from-pink-50/80 to-purple-50/40 border border-pink-100/70 rounded-xl flex items-center justify-between text-[10px] text-pink-900">
                            <span className="flex items-center gap-1.5 font-medium">
                                <Sparkles size={11} className="text-pink-600 shrink-0" />
                                Retensi Otomatis
                            </span>
                            <span className="font-semibold text-pink-700">Maks 30 Hari</span>
                        </div>

                        {threads.length === 0 ? (
                            <div className="text-center py-10 px-2">
                                <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mx-auto mb-2">
                                    <MessageSquare size={18} />
                                </div>
                                <div className="text-xs font-semibold text-slate-700">Belum Ada Riwayat</div>
                                <p className="text-[11px] text-slate-400 mt-0.5">Percakapan otomatis tersimpan di sini.</p>
                            </div>
                        ) : (
                            groupedThreads.map((group) => (
                                <div key={group.label} className="space-y-1 pt-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                                        {group.label}
                                    </div>
                                    <div className="space-y-1">
                                        {group.items.map((thread) => {
                                            const isActive = thread.id === activeThreadId;
                                            const daysLeft = calculateDaysLeft(thread.updated_at || thread.created_at);
                                            const isDeleting = deletingThreadId === thread.id;

                                            return (
                                                <div
                                                    key={thread.id}
                                                    onClick={() => handleSelectThread(thread.id)}
                                                    className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all cursor-pointer border ${
                                                        isActive
                                                            ? 'bg-pink-50/90 border-pink-200 text-pink-900 font-semibold shadow-2xs'
                                                            : 'bg-white/60 hover:bg-white border-slate-100 hover:border-pink-200 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-pink-200 text-pink-700' : 'bg-slate-100 text-slate-500 group-hover:text-pink-600'}`}>
                                                            <MessageSquare size={12} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate font-medium text-slate-800 group-hover:text-pink-600 transition-colors">
                                                                {thread.title || 'Percakapan Tanpa Judul'}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                                                <span>{formatRelativeTime(thread.updated_at || thread.created_at)}</span>
                                                                <span>•</span>
                                                                <span title="Sisa retensi">sisa {daysLeft} hr</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isDeleting) {
                                                                handleDeleteThread(thread.id);
                                                                setDeletingThreadId(null);
                                                            } else {
                                                                setDeletingThreadId(thread.id);
                                                                setTimeout(() => setDeletingThreadId((prev) => (prev === thread.id ? null : prev)), 3000);
                                                            }
                                                        }}
                                                        title={isDeleting ? 'Konfirmasi hapus' : 'Hapus percakapan'}
                                                        className={`p-1 rounded-lg transition-colors shrink-0 ${
                                                            isDeleting
                                                                ? 'bg-rose-500 text-white opacity-100'
                                                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100'
                                                        }`}
                                                    >
                                                        {isDeleting ? <Check size={12} /> : <Trash2 size={12} />}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {sidebarTab === 'memory' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Brain size={14} className="text-pink-600" /> Memori Otak Bebie
                            </span>
                            <span className="text-[10px] text-slate-400">Konteks tersimpan</span>
                        </div>
                        <MemoryPanel
                            sessionMember={session}
                            sessionHeaders={sessionHeaders}
                            onToast={showToast}
                            onTriggerLearning={triggerLearning}
                        />
                    </div>
                )}

                {sidebarTab === 'skill' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Zap size={14} className="text-pink-600" /> Skill & Playbook
                            </span>
                            <span className="text-[10px] text-slate-400">Analisis & aturan</span>
                        </div>
                        <SkillPanel
                            sessionHeaders={sessionHeaders}
                            onToast={showToast}
                            onTriggerLearning={triggerLearning}
                        />
                    </div>
                )}

                {sidebarTab === 'settings' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Settings2 size={14} className="text-pink-600" /> Pengaturan Asisten
                            </span>
                            {isExecutive ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-pink-100 text-pink-700 border border-pink-200">
                                    Direksi
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                    <Lock size={9} /> Mode Baca
                                </span>
                            )}
                        </div>

                        {/* Pengaturan Animasi Avatar Bebie */}
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                <Video size={13} className="text-pink-600" />
                                Animasi Avatar saat Idle
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAvatarIdleMode('video');
                                        localStorage.setItem('bebie_avatar_idle_mode', 'video');
                                    }}
                                    className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                                        avatarIdleMode === 'video'
                                            ? 'border-pink-500 bg-pink-50/80 text-pink-900 font-semibold shadow-2xs'
                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <span className="flex items-center gap-1 font-bold text-[11px]">
                                        <i className="fa-solid fa-circle-play text-pink-600" /> Video Animasi
                                    </span>
                                    <span className="text-[9px] text-slate-500">Loop hidup (Muse.ai)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAvatarIdleMode('static');
                                        localStorage.setItem('bebie_avatar_idle_mode', 'static');
                                    }}
                                    className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                                        avatarIdleMode === 'static'
                                            ? 'border-pink-500 bg-pink-50/80 text-pink-900 font-semibold shadow-2xs'
                                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <span className="flex items-center gap-1 font-bold text-[11px]">
                                        <i className="fa-regular fa-image text-slate-600" /> Foto Statis
                                    </span>
                                    <span className="text-[9px] text-slate-500">Hemat baterai</span>
                                </button>
                            </div>
                        </div>

                        {/* Opsi Tampilkan Proses Sistem */}
                        <div className="pt-2 border-t border-slate-100">
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

                        {/* Status Akses BigQuery */}
                        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs space-y-1">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <Database size={13} className="text-pink-600" />
                                {canUseBigQuery ? 'Akses BigQuery Aktif' : 'Mode Asisten Umum'}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                {canUseBigQuery
                                    ? 'Akun Anda memiliki izin analisis query data cabang & absensi.'
                                    : 'Akses BigQuery diatur per-user oleh Direksi di Pengaturan Organisasi.'}
                            </p>
                        </div>

                        {/* Konfigurasi Provider AI (Khusus Direksi) */}
                        <div className="pt-2 border-t border-slate-100 space-y-2.5">
                            <div className="text-xs font-semibold text-slate-700">Provider Endpoint AI</div>
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">Base URL</label>
                                <input
                                    type="text"
                                    value={settings.baseURL}
                                    disabled={!isExecutive}
                                    onChange={(e) => setSettings({ ...settings, baseURL: e.target.value })}
                                    className="w-full text-xs font-mono p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-pink-500 disabled:opacity-60"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">Model Name</label>
                                <input
                                    type="text"
                                    value={settings.model}
                                    disabled={!isExecutive}
                                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                    className="w-full text-xs font-mono p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-pink-500 disabled:opacity-60"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">
                                    API Key Provider
                                    {settings.hasApiKey && <span className="ml-1 text-emerald-600 font-semibold">(Tersimpan)</span>}
                                </label>
                                <input
                                    type="password"
                                    placeholder={settings.hasApiKey ? '••••••••••••••••' : 'Masukkan API Key...'}
                                    value={settings.apiKey}
                                    disabled={!isExecutive}
                                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                    className="w-full text-xs font-mono p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-pink-500 disabled:opacity-60"
                                />
                            </div>

                            {isExecutive && (
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
                                            } else {
                                                showToast('Gagal: ' + d.error);
                                            }
                                        } catch (err) {
                                            showToast('Gagal: ' + err.message);
                                        }
                                    }}
                                    className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 shadow-xs transition cursor-pointer mt-1"
                                >
                                    Simpan Pengaturan Global
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`${isEmbedded ? 'h-full' : 'h-screen'} flex flex-col bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] text-slate-900 ${isEmbedded ? 'rounded-2xl border border-white/80 shadow-xs overflow-hidden' : ''}`}>
            {/* Area Utama 2 Kolom (Sisi Kiri: Pesan, Sisi Kanan: Avatar, Nama & Tabs) */}
            <div className="flex-1 flex flex-row min-h-0 overflow-hidden relative">
                {/* ========================================================= */}
                {/* SISI KIRI: FOKUS KE PESAN */}
                {/* ========================================================= */}
                <section className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-transparent">
                    {/* Tombol Toggle Sidebar Khusus Mobile (Floating) */}
                    <button
                        type="button"
                        onClick={() => setIsMobileSidebarOpen(true)}
                        title="Buka Panel Bebie"
                        className="md:hidden fixed top-3 right-3 z-30 p-2 rounded-xl text-pink-600 bg-white/90 backdrop-blur-md shadow-md border border-pink-200/80 flex items-center gap-1.5 cursor-pointer"
                    >
                        <BebieAvatar state={bebieState} size="xs" useStaticIdle={avatarIdleMode === 'static'} />
                        <span className="text-xs font-bold text-slate-800">Panel</span>
                    </button>

                    {/* Area Pesan Chat */}
                    <main ref={scrollRef} className="flex-1 overflow-y-auto py-6 px-3 sm:px-6 space-y-5 custom-scrollbar min-h-0">
                        {messages.length === 0 && !isLoading && (
                            <div className="max-w-2xl mx-auto text-center pt-8 sm:pt-12 px-4">
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                    Halo{session?.name ? `, ${session.name.split(' ')[0]}` : ''}!
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                                    {canUseBigQuery
                                        ? 'Bebie siap membantu mengelola task tim, memantau tugas berjalan, membuat task baru, serta menganalisis performa cabang dari BigQuery.'
                                        : 'Bebie siap menjadi personal assistant kamu: membaca task pribadi & tim, bantu buat tugas baru, update status, dan menyusun laporan kerja.'}
                                </p>

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
                                useStaticIdle={avatarIdleMode === 'static'}
                            />
                        ))}

                        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                            <div className="flex gap-2.5 sm:gap-3 max-w-3xl mx-auto w-full flex-row">
                                <div className="mt-0.5 shrink-0">
                                    <BebieAvatar
                                        state={bebieState === 'learning' ? 'learning' : 'working'}
                                        size="sm"
                                    />
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
                    <footer className="shrink-0 pb-4 pt-1 bg-gradient-to-t from-white/80 via-white/40 to-transparent">
                        <ChatInput sendMessage={sendMessage} isLoading={isLoading} stop={stop} />
                    </footer>
                </section>

                {/* ========================================================= */}
                {/* SISI KANAN (DESKTOP): AVATAR, NAMA, TABS (SIMETRIS DENGAN MENU KIRI) */}
                {/* ========================================================= */}
                {isRightSidebarOpen && (
                    <aside className="hidden md:flex flex-col w-72 lg:w-64 shrink-0 border-l border-white/80 bg-white/85 backdrop-blur-md h-full overflow-hidden shadow-xs">
                        {renderRightSidebarContent()}
                    </aside>
                )}

                {/* SISI KANAN (MOBILE DRAWER) */}
                {isMobileSidebarOpen && (
                    <div className="md:hidden fixed inset-0 z-50 flex">
                        <div
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                            onClick={() => setIsMobileSidebarOpen(false)}
                            aria-hidden="true"
                        />
                        <aside className="relative ml-auto w-72 max-w-[86vw] bg-white h-full shadow-2xl flex flex-col z-10 border-l border-pink-100 animate-in slide-in-from-right duration-200">
                            <div className="absolute top-3 right-3 z-20">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileSidebarOpen(false)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    aria-label="Tutup panel"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            {renderRightSidebarContent()}
                        </aside>
                    </div>
                )}
            </div>

            {/* Toast Notifikasi */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-semibold shadow-lg animate-in fade-in">
                    {toast}
                </div>
            )}
        </div>
    );
}

// Subkomponen Panel Memori
function MemoryPanel({ sessionMember, sessionHeaders, onToast, onTriggerLearning }) {
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
                onTriggerLearning?.(5000);
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
                onTriggerLearning?.(4000);
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
function SkillPanel({ sessionHeaders, onToast, onTriggerLearning }) {
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
