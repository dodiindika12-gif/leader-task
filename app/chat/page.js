'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { Settings2, X, Check, Loader2, Feather, ShieldCheck, Database } from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';

const SETTINGS_KEY = 'busana_chat_provider_settings_v1';

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

export default function ChatPage() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [draft, setDraft] = useState(DEFAULT_SETTINGS);
    const [testing, setTesting] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const scrollRef = useRef(null);

    // Ref di sini hanya untuk dibaca oleh transport saat request berjalan (bukan saat render UI),
    // sehingga perubahan settings tidak perlu membuat ulang transport.
    const settingsRef = useRef(DEFAULT_SETTINGS);

    // Muat pengaturan tersimpan dari localStorage setelah mount.
    // Effect sinkron dengan sistem eksternal (localStorage), pola resmi React.
    useEffect(() => {
        const saved = loadSettings();
        settingsRef.current = saved;
        startTransition(() => {
            setSettings(saved);
            setDraft(saved);
        });
    }, []);

    // Transport dibuat sekali; header dibaca saat request lewat settingsRef (bukan saat render).
    const [transport, setTransport] = useState(null);
    const transportInitializedRef = useRef(false);
    useEffect(() => {
        if (transportInitializedRef.current) return;
        transportInitializedRef.current = true;
        setTransport(new DefaultChatTransport({
            api: '/api/chat',
            headers: () => ({
                'x-endpoint-url': settingsRef.current.baseURL,
                'x-api-key': settingsRef.current.apiKey,
                'x-model-name': settingsRef.current.model,
            }),
        }));
    }, []);

    const chatState = useChat({
        transport: transport ?? undefined,
    });
    const { messages, sendMessage, status, stop, error } = chatState;
    const isLoading = status === 'submitted' || status === 'streaming';

    // Auto scroll ke bawah
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
                                Ujicoba, terhubung ke BigQuery. Belum terikat dengan aplikasi.
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            settings.apiKey
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                            {settings.apiKey ? `Model: ${settings.model}` : 'Provider belum diatur'}
                        </span>
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
                    <div className="max-w-md mx-auto text-center pt-16 sm:pt-24 px-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center mx-auto mb-4">
                            <Feather size={20} className="text-pink-600" />
                        </div>
                        <h2 className="font-bold text-slate-900">Tanya data lewat percakapan</h2>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                            Asisten menjalankan SQL ke BigQuery dan merangkum hasilnya.
                            Lampirkan gambar atau file bila relevan, lalu minta hasil sebagai tabel untuk diunduh sebagai CSV.
                        </p>
                        <div className="mt-5 space-y-2 text-left">
                            {[
                                'Dataset apa saja yang ada di proyek ini?',
                                'Tampilkan 10 baris terakhir dari tabel penjualan.',
                                'Ringkas tabel di bawah dan siapkan file CSV-nya.',
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
                            <div className="mt-1.5 text-rose-500/80">Periksa pengaturan provider (URL, token, model) lalu ulangi.</div>
                        </div>
                    </div>
                )}
            </main>

            {/* Composer */}
            <footer className="shrink-0 pb-4 pt-1 bg-gradient-to-t from-white/70 to-transparent">
                <ChatInput sendMessage={sendMessage} isLoading={isLoading} stop={stop} />
            </footer>

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
