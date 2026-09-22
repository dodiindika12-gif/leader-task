'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef, useCallback, startTransition, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
    Settings2, X, Check, Loader2, Feather, ShieldCheck, Database,
    Brain, Zap, Trash2, Plus, Power, GitBranch, LogIn,
} from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';

const SETTINGS_KEY = 'busana_chat_provider_settings_v1';
const SESSION_KEY = 'task_abs_session';

const DEFAULT_SETTINGS = {
    baseURL: 'https://hermes.absgroup.biz.id',
    apiKey: '',
    model: 'default',
};

function loadSettings() {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_SETTINGS;
    }
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

// Snapshot session dashboard via useSyncExternalStore:
// server snapshot selalu null; client membaca localStorage dan subscribe ke event storage.
// Ini menghindari hydration mismatch (React memakai server snapshot saat hydrate,
// lalu re-render otomatis dengan nilai client setelah mount).
let cachedSessionSnapshot;
const sessionStore = {
    subscribe(callback) {
        window.addEventListener('storage', callback);
        // Polling ringan untuk perubahan login di tab yang sama (login menulis localStorage)
        const interval = setInterval(() => {
            const next = loadDashboardSession();
            const prev = cachedSessionSnapshot;
            const changed = (prev?.memberId || null) !== (next?.memberId || null) ||
                (prev?.email || null) !== (next?.email || null);
            if (changed) callback();
        }, 1000);
        return () => {
            window.removeEventListener('storage', callback);
            clearInterval(interval);
        };
    },
    getSnapshot() {
        if (cachedSessionSnapshot === undefined) {
            cachedSessionSnapshot = loadDashboardSession();
        }
        return cachedSessionSnapshot;
    },
    getServerSnapshot() {
        return null;
    },
};

function useDashboardSession() {
    return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getServerSnapshot);
}

function TestResult({ result, loading, target }) {
    if (loading) {
        return (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <Loader2 size={12} className="animate-spin" />
                Menguji koneksi {target}...
            </div>
        );
    }
    if (!result) return null;
    return result.ok ? (
        <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-0.5">
            <div className="font-semibold flex items-center gap-1.5">
                <Check size={12} /> Koneksi {target} berhasil ({result.latencyMs} ms)
            </div>
            {target === 'provider' && result.sampleReply && (
                <div className="text-emerald-700/80">Balasan model: &quot;{result.sampleReply}&quot;</div>
            )}
            {target === 'BigQuery' && (
                <div className="text-emerald-700/80">
                    Proyek <span className="font-mono">{result.project}</span>, {result.datasetCount} dataset: {(result.datasets || []).join(', ') || '(kosong)'}
                </div>
            )}
        </div>
    ) : (
        <div className="mt-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            <div className="font-semibold">Koneksi {target} gagal</div>
            <div className="break-all text-rose-600/90">{result.error}</div>
        </div>
    );
}

/* ================= Panel Memori & Skill ================= */

function MemoryPanel({ sessionMember, sessionHeaders, onToast }) {
    const [memories, setMemories] = useState(null);
    const [newContent, setNewContent] = useState('');
    const [newScope, setNewScope] = useState('user');
    const [busy, setBusy] = useState(false);
    const isExec = ['Super User', 'Direksi'].includes(sessionMember?.role);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/memory', { headers: sessionHeaders() });
            const data = await res.json();
            setMemories(data.memories || []);
        } catch {
            setMemories([]);
        }
    }, [sessionHeaders]);

    useEffect(() => { startTransition(() => { load(); }); }, [load]);

    const add = async () => {
        if (!newContent.trim()) return;
        setBusy(true);
        try {
            const res = await fetch('/api/chat/memory', {
                method: 'POST',
                headers: { ...sessionHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newContent.trim(), scope: newScope }),
            });
            const data = await res.json();
            if (!res.ok) {
                onToast(data.error || 'Gagal menyimpan memori.');
            } else {
                setNewContent('');
                setNewScope('user');
                onToast('Memori tersimpan.');
                load();
            }
        } finally {
            setBusy(false);
        }
    };

    const toggle = async (m) => {
        await fetch('/api/chat/memory', {
            method: 'PATCH',
            headers: { ...sessionHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: m.id, is_active: !m.is_active }),
        });
        load();
    };

    const remove = async (m) => {
        await fetch(`/api/chat/memory?id=${m.id}`, { method: 'DELETE', headers: sessionHeaders() });
        load();
    };

    const globalMem = (memories || []).filter((m) => m.scope === 'global');
    const userMem = (memories || []).filter((m) => m.scope === 'user');

    const MemoryRow = ({ m }) => (
        <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${m.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
                <p className="leading-relaxed text-slate-700 flex-1">{m.content}</p>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => toggle(m)} title={m.is_active ? 'Nonaktifkan' : 'Aktifkan'} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                        <Power size={12} className={m.is_active ? 'text-emerald-600' : ''} />
                    </button>
                    <button onClick={() => remove(m)} title="Hapus" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className={`font-bold px-1.5 py-0.5 rounded-md border ${m.scope === 'global' ? 'bg-indigo-50 text-indigo-600 border-indigo-200/70' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {m.scope === 'global' ? 'Global' : 'Pribadi'}
                </span>
                <span>sumber: {m.source === 'manual' ? 'manual' : m.source === 'agent' ? 'dari chat' : 'otomatis'}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Fakta atau preferensi yang perlu agent ingat... (mis. Cabang default saya BT01)"
                    rows={2}
                    className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/15 focus:border-pink-400 outline-none transition resize-none bg-white"
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setNewScope('user')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${newScope === 'user' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            Pribadi
                        </button>
                        <button
                            onClick={() => isExec ? setNewScope('global') : onToast('Memori global hanya untuk Super User/Direksi.')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${newScope === 'global' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} ${!isExec ? 'opacity-60' : ''}`}
                            title={isExec ? 'Berlaku semua user' : 'Khusus Super User/Direksi'}
                        >
                            Global
                        </button>
                    </div>
                    <button onClick={add} disabled={busy || !newContent.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold disabled:opacity-40 transition-colors">
                        {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Simpan
                    </button>
                </div>
            </div>

            {memories === null ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-1"><Loader2 size={12} className="animate-spin" /> Memuat memori...</div>
            ) : (
                <div className="space-y-4">
                    {globalMem.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Global ({globalMem.length})</div>
                            {globalMem.map((m) => <MemoryRow key={m.id} m={m} />)}
                        </div>
                    )}
                    {userMem.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pribadi Anda ({userMem.length})</div>
                            {userMem.map((m) => <MemoryRow key={m.id} m={m} />)}
                        </div>
                    )}
                    {globalMem.length === 0 && userMem.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Belum ada memori. Agent juga bisa mengingat sendiri saat Anda meminta &quot;ingat ini&quot;.</p>
                    )}
                </div>
            )}
        </div>
    );
}

function SkillPanel({ sessionHeaders, onToast }) {
    const [skills, setSkills] = useState(null);
    const [expanded, setExpanded] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/skills', { headers: sessionHeaders() });
            const data = await res.json();
            setSkills(data.skills || []);
        } catch {
            setSkills([]);
        }
    }, [sessionHeaders]);

    useEffect(() => { startTransition(() => { load(); }); }, [load]);

    const toggleActive = async (s) => {
        await fetch('/api/chat/skills', {
            method: 'PATCH',
            headers: { ...sessionHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
        });
        load();
    };

    const review = async (v, action) => {
        await fetch('/api/chat/skills', {
            method: 'PATCH',
            headers: { ...sessionHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ versionId: v.id, action }),
        });
        onToast(action === 'apply' ? `Versi ${v.version} diterapkan.` : `Versi ${v.version} ditolak.`);
        load();
    };

    return (
        <div className="space-y-3">
            <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900/80 leading-relaxed">
                Skill menyempurnakan diri dengan versi terkontrol: agent boleh mengusulkan perubahan (tool <span className="font-mono">refine_skill</span>),
                lalu tersimpan sebagai versi. Skill dengan auto-refine aktif langsung ter-update; sisanya menunggu you review di sini.
            </div>

            {skills === null ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-1"><Loader2 size={12} className="animate-spin" /> Memuat skill...</div>
            ) : skills.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Belum ada skill.</p>
            ) : (
                skills.map((s) => (
                    <div key={s.id} className={`rounded-xl border ${s.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                        <div className="p-3 flex items-start justify-between gap-2">
                            <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="flex-1 text-left min-w-0">
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                    {s.name}
                                    <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">v{s.version}</span>
                                    {s.auto_refine && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">auto</span>}
                                    {(s.pending_versions || []).length > 0 && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                            {s.pending_versions.length} menunggu review
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{s.description || s.slug}</p>
                            </button>
                            <button onClick={() => toggleActive(s)} title={s.is_active ? 'Nonaktifkan skill' : 'Aktifkan skill'} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0">
                                <Power size={13} className={s.is_active ? 'text-emerald-600' : ''} />
                            </button>
                        </div>

                        {expanded === s.id && (
                            <div className="px-3 pb-3 space-y-2.5 border-t border-slate-100 pt-2.5">
                                <pre className="p-2.5 rounded-lg bg-slate-950 text-emerald-200/90 font-mono text-[10px] whitespace-pre-wrap max-h-56 overflow-y-auto">{s.content}</pre>

                                {(s.pending_versions || []).length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Menunggu review</div>
                                        {s.pending_versions.map((v) => (
                                            <div key={v.id} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                                                <div className="text-[11px] text-amber-900"><span className="font-bold">v{v.version}</span> {v.reason}</div>
                                                <pre className="p-2 rounded-md bg-white border border-amber-200 text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto text-slate-600">{v.content}</pre>
                                                <div className="flex gap-2">
                                                    <button onClick={() => review(v, 'apply')} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors">Terapkan</button>
                                                    <button onClick={() => review(v, 'reject')} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold hover:bg-slate-50 transition-colors">Tolak</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(s.history || []).length > 1 && (
                                    <details className="text-[10px] text-slate-400">
                                        <summary className="cursor-pointer select-none hover:text-slate-600 transition-colors inline-flex items-center gap-1">
                                            <GitBranch size={10} /> Riwayat ({(s.history || []).length})
                                        </summary>
                                        <div className="mt-1.5 space-y-1 pl-1">
                                            {s.history.map((h) => (
                                                <div key={h.id} className="flex items-center gap-2">
                                                    <span className={`font-mono ${h.status === 'applied' ? 'text-emerald-600' : h.status === 'pending' ? 'text-amber-600' : 'text-slate-400 line-through'}`}>v{h.version}</span>
                                                    <span className="truncate flex-1 text-slate-500">{h.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}

function LoginRequired() {
    return (
        <div className="h-screen flex items-center justify-center bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] p-6">
            <div className="max-w-sm w-full bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 shadow-sm p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                    <LogIn size={20} className="text-amber-600" />
                </div>
                <h2 className="font-bold text-slate-900">Login Dashboard Diperlukan</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                    Chat Data memakai login utama aplikasi supaya memori global dan memori pribadi Anda bisa terekam dan terhubung dengan akun.
                    Masuk lewat halaman utama dulu, lalu kembali ke sini.
                </p>
                <Link href="/" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-colors">
                    Buka Halaman Login
                </Link>
            </div>
        </div>
    );
}

export default function ChatPage() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [brainOpen, setBrainOpen] = useState(false);
    const [brainTab, setBrainTab] = useState('memory');
    const [draft, setDraft] = useState(DEFAULT_SETTINGS);
    const [testing, setTesting] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [toast, setToast] = useState('');
    const scrollRef = useRef(null);

    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2600);
    }, []);

    // Session dashboard via external store: server render = null (LoginRequired),
    // client re-render otomatis dengan session asli setelah hydration. Zero mismatch.
    const session = useDashboardSession();
    const sessionChecked = session !== undefined;

    const settingsRef = useRef(DEFAULT_SETTINGS);

    useEffect(() => {
        const saved = loadSettings();
        settingsRef.current = saved;
        startTransition(() => {
            setSettings(saved);
            setDraft(saved);
        });
    }, []);

    const sessionHeaders = useCallback(() => {
        const s = session || loadDashboardSession();
        return s ? { 'x-session-member-id': s.memberId, 'x-session-email': s.email } : {};
    }, [session]);

    // Transport dibuat sekali saat client siap; header session + provider dibaca saat request
    const sessionRef = useRef(null);
    useEffect(() => {
        sessionRef.current = session;
    }, [session]);
    const [transport, setTransport] = useState(null);
    const transportInitializedRef = useRef(false);
    useEffect(() => {
        if (transportInitializedRef.current) return;
        transportInitializedRef.current = true;
        setTransport(new DefaultChatTransport({
            api: '/api/chat',
            headers: () => {
                const s = sessionRef.current || loadDashboardSession() || {};
                const cfg = settingsRef.current || {};
                const h = {
                    'x-endpoint-url': cfg.baseURL,
                    'x-api-key': cfg.apiKey,
                    'x-model-name': cfg.model,
                };
                if (s.memberId && s.email) {
                    h['x-session-member-id'] = s.memberId;
                    h['x-session-email'] = s.email;
                }
                return h;
            },
        }));
    }, []);

    const chatState = useChat({
        transport: transport ?? undefined,
    });
    const { messages, sendMessage, status, stop, error } = chatState;
    const isLoading = status === 'submitted' || status === 'streaming';

    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, status]);

    const handleSettingsSave = useCallback(() => {
        const next = {
            baseURL: draft.baseURL.trim() || DEFAULT_SETTINGS.baseURL,
            apiKey: draft.apiKey.trim(),
            model: draft.model.trim() || 'default',
        };
        settingsRef.current = next;
        setSettings(next);
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch {}
        setSettingsOpen(false);
        setTestResult(null);
    }, [draft]);

    const runTest = async (target) => {
        setTesting(target);
        setTestResult(null);
        try {
            const res = await fetch('/api/chat/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target,
                    apiKey: draft.apiKey.trim(),
                    baseURL: draft.baseURL.trim(),
                    model: draft.model.trim(),
                }),
            });
            const data = await res.json();
            setTestResult(data);
        } catch (err) {
            setTestResult({ ok: false, error: err.message });
        } finally {
            setTesting(null);
        }
    };

    const openSettings = () => {
        setDraft(settings);
        setTestResult(null);
        setSettingsOpen(true);
    };

    // sessionChecked selalu true; dipertahankan sebagai penjelas alur. Server render = null session → LoginRequired.
    if (!session) {
        return <LoginRequired />;
    }

    return (
        <div className="h-screen flex flex-col bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] text-slate-900">
            {/* Header */}
            <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-white/80 shadow-xs">
                <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 via-pink-500 to-rose-400 flex items-center justify-center shadow-sm shadow-pink-500/20 shrink-0">
                            <span className="font-pacifico text-white text-[11px]" style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}>B</span>
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 leading-tight">Busana Data Chat</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                                <Database size={9} className="shrink-0" />
                                sesi: <span className="font-semibold text-slate-500">{session.name || session.email}</span> (memori aktif)
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => setBrainOpen(true)}
                            title="Memori & Skill agent"
                            aria-label="Memori dan skill agent"
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
                        >
                            <Brain size={16} />
                        </button>
                        <button
                            onClick={openSettings}
                            title="Pengaturan provider"
                            aria-label="Pengaturan provider"
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                            <Settings2 size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <main ref={scrollRef} className="flex-1 overflow-y-auto py-6 px-2 space-y-5">
                {messages.length === 0 && !isLoading && (
                    <div className="max-w-md mx-auto text-center pt-12 sm:pt-20 px-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mx-auto mb-4">
                            <Feather size={20} className="text-pink-600" />
                        </div>
                        <h2 className="font-bold text-slate-900">Tanya data lewat percakapan</h2>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                            Asisten mengingat preferensi Anda (memori pribadi + global), menjalankan SQL BigQuery,
                            dan menyempurnakan skill-nya sendiri dari setiap percakapan.
                        </p>
                        <div className="mt-5 space-y-2 text-left">
                            {[
                                'Ingat: cabang default saya BT01, ya.',
                                'Penjualan Agustus per cabang lengkap dengan pencapaian target.',
                                'Skill query-mu sudah bagus, catat pola basked analysis yang barusan.',
                            ].map((hint) => (
                                <button
                                    key={hint}
                                    onClick={() => sendMessage({ text: hint })}
                                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/80 border border-slate-200 hover:border-pink-300 hover:bg-white transition-colors text-xs text-slate-600"
                                >
                                    {hint}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m) => (
                    <ChatMessage key={m.id} message={m} />
                ))}

                {isLoading && messages.length > 0 && (
                    <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-slate-400 px-1">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Asisten sedang bekerja{status === 'streaming' ? ', mengalirkan balasan' : ''}...</span>
                    </div>
                )}

                {error && (
                    <div className="max-w-4xl mx-auto">
                        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700">
                            <div className="font-semibold mb-0.5">Permintaan gagal</div>
                            <div className="text-rose-600/90 break-all">{error.message}</div>
                            {String(error.message).includes('login') && (
                                <div className="mt-1.5">
                                    <Link href="/" className="font-semibold underline">Buka halaman login utama</Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Composer */}
            <footer className="shrink-0 pb-4 pt-1 bg-gradient-to-t from-white/70 to-transparent">
                <ChatInput sendMessage={sendMessage} isLoading={isLoading} stop={stop} />
            </footer>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-semibold shadow-lg animate-in fade-in">
                    {toast}
                </div>
            )}

            {/* Brain Modal: Memori & Skill */}
            {brainOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setBrainOpen(false)}></div>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Memori dan skill agent"
                        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col max-h-[92vh]"
                    >
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900">Otak Agent</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">Memori & skill yang dibaca agent setiap percakapan.</p>
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

            {/* Settings Modal */}
            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSettingsOpen(false)}></div>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Pengaturan provider AI"
                        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 flex flex-col max-h-[92vh]"
                        onKeyDown={(e) => { if (e.key === 'Escape') setSettingsOpen(false); }}
                    >
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900">Pengaturan Provider</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">Kompatibel OpenAI: isi URL layanan, token, dan model.</p>
                            </div>
                            <button onClick={() => setSettingsOpen(false)} aria-label="Tutup pengaturan" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div>
                                <label htmlFor="cfg-url" className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">URL Endpoint</label>
                                <input
                                    id="cfg-url"
                                    type="url"
                                    value={draft.baseURL}
                                    onChange={(e) => setDraft({ ...draft, baseURL: e.target.value })}
                                    placeholder="https://hermes.absgroup.biz.id"
                                    className="w-full text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/15 focus:border-pink-400 outline-none transition font-mono text-[12px]"
                                />
                            </div>

                            <div>
                                <label htmlFor="cfg-key" className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Token API</label>
                                <input
                                    id="cfg-key"
                                    type="password"
                                    value={draft.apiKey}
                                    onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                                    placeholder="sk-... atau token layanan"
                                    autoComplete="off"
                                    className="w-full text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/15 focus:border-pink-400 outline-none transition font-mono text-[12px]"
                                />
                            </div>

                            <div>
                                <label htmlFor="cfg-model" className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Model</label>
                                <input
                                    id="cfg-model"
                                    type="text"
                                    value={draft.model}
                                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                                    placeholder="default, gpt-4o-mini, qwen2.5:7b, ..."
                                    className="w-full text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/15 focus:border-pink-400 outline-none transition font-mono text-[12px]"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => runTest('provider')}
                                    disabled={testing === 'provider'}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                                >
                                    {testing === 'provider' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                    Test Provider
                                </button>
                                <button
                                    type="button"
                                    onClick={() => runTest('bigquery')}
                                    disabled={testing === 'bigquery'}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                >
                                    {testing === 'bigquery' ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                                    Test BigQuery
                                </button>
                            </div>

                            {testing && <TestResult result={testResult} loading target={testing === 'provider' ? 'provider' : 'BigQuery'} />}
                            {!testing && testResult && <TestResult result={testResult} loading={false} target={testResult.target === 'bigquery' ? 'BigQuery' : 'provider'} />}

                            <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
                                Kredensial BigQuery dibaca dari file service account di server, bukan dari halaman ini.
                                Pengaturan provider disimpan hanya di perangkat ini.
                            </p>
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                            <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">Batal</button>
                            <button onClick={handleSettingsSave} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition">Simpan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
