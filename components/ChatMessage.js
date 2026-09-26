'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Download, Wrench, AlertCircle, Settings, ChevronDown, Sparkles } from 'lucide-react';

const BEAUTY_QUOTES = [
    { text: "Sedang Pakai Sunscreen... Biar Data Tetap Glowing! 🧴✨" },
    { text: "Tunggu, Bebie Gambar Alis Dulu Yah! 💄" },
    { text: "Lagi Touch Up Bedak Biar Laporan Gak Kusut... 🪞" },
    { text: "Meramu Formula Data Sambil Oles Lip Tint... 💋" },
    { text: "Menyemprotkan Setting Spray... Biar Data Tahan Seharian! 🌸" },
];

function CopyCsvButton({ csv, filename }) {
    const handleDownload = () => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'query-result.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <button onClick={handleDownload} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors cursor-pointer">
            <Download size={12} />
            Unduh {filename || 'hasil.csv'}
        </button>
    );
}

function TableCsvButton({ tableMarkdown }) {
    const parse = (md) => {
        const lines = md.split('\n').filter((l) => l.trim().startsWith('|'));
        if (lines.length < 2) return null;
        const rows = lines
            .filter((l) => !/^\|[\s|:-]+\|$/.test(l.trim()))
            .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        if (rows.length === 0) return null;
        const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
        return rows.map((r) => r.map(escape).join(',')).join('\n');
    };

    const csv = parse(tableMarkdown);
    if (!csv) return null;

    return <CopyCsvButton csv={csv} filename="hasil-query.csv" />;
}

function FilePart({ part, isUser }) {
    if (part.mediaType?.startsWith('image/')) {
        return (
            <a href={part.url} target="_blank" rel="noreferrer" className="block max-w-xs rounded-xl overflow-hidden border border-white/20 shadow-sm hover:opacity-90 transition-opacity">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={part.url} alt={part.filename || 'Lampiran gambar'} className="w-full h-auto" />
            </a>
        );
    }

    const isDataUrl = part.url?.startsWith('data:');
    return (
        <a
            href={part.url}
            download={part.filename || true}
            target={isDataUrl ? undefined : '_blank'}
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/10 hover:bg-black/20 transition-colors text-xs font-medium max-w-xs"
        >
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{part.filename || 'Lampiran file'}</span>
            {isDataUrl && <Download size={12} className="shrink-0 opacity-70" />}
        </a>
    );
}

/**
 * Beberapa model menulis tabel dalam SATU baris:
 * "| Tipe | Jumlah | |---|---| | BEAUTY | 17 |"
 * Fungsi ini merekonstruksi SEMUA kemunculannya menjadi tabel Markdown
 * multi-baris yang valid. Aman untuk teks & tabel biasa.
 */
export function normalizeInlineTables(md) {
    if (!md || !md.includes('|')) return md;

    const runMarker = /\|\s*:?-{2,}:?\s*\|\s*\|?\s*:?-{2,}:?\s*\|/;
    if (!runMarker.test(md)) return md;

    const lines = md.split('\n');
    const out = [];
    let processedAny = false;

    const SEP_CELL = /^:?-{2,}:?$/;

    for (const line of lines) {
        if (!runMarker.test(line)) {
            out.push(line);
            continue;
        }

        const prefixMatch = line.match(/^([^|]*)\|/);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        const rest = prefix ? line.slice(prefix.length) : line;

        const cells = rest
            .replace(/^\s*\|/, '')
            .replace(/\|\s*$/, '')
            .split('|')
            .map((c) => c.trim());

        let sepStart = -1;
        let sepEnd = -1;
        for (let i = 0; i < cells.length; i += 1) {
            if (SEP_CELL.test(cells[i])) {
                let j = i;
                while (j < cells.length && SEP_CELL.test(cells[j])) j += 1;
                if (j - i >= 2) {
                    sepStart = i;
                    sepEnd = j - 1;
                    break;
                }
                i = j;
            }
        }

        if (sepStart === -1) {
            out.push(line);
            continue;
        }

        const header = cells.slice(0, sepStart).filter((c) => c.length > 0);
        const width = header.length;
        if (width < 1) {
            out.push(line);
            continue;
        }

        const body = cells.slice(sepEnd + 1).filter((c) => c !== '');

        const rows = [];
        for (let i = 0; i < body.length; i += width) {
            rows.push(body.slice(i, i + width));
        }
        if (rows.length > 0 && rows[rows.length - 1].length < width) {
            const last = rows[rows.length - 1];
            while (last.length < width) last.push('');
        }

        out.push('');
        out.push(prefix + `| ${header.join(' | ')} |`);
        out.push(`| ${header.map(() => '---').join(' | ')} |`);
        rows.forEach((r) => out.push(`| ${r.join(' | ')} |`));
        out.push('');
        processedAny = true;
    }

    return processedAny ? out.join('\n') : md;
}

function autoLinkFiles(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/(?:\[([^\]]+)\]\(([^)]+)\))|(?:\*\*)?([a-zA-Z0-9_-]+\.(?:pptx|xlsx|csv|html|pdf))(?:\*\*)?/gi, (full, label, url, bareFile) => {
        if (label && url) return full;
        if (bareFile) {
            return `[Unduh ${bareFile}](/api/chat/files?name=${encodeURIComponent(bareFile)})`;
        }
        return full;
    });
}

function formatCellValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'object') {
        if ('value' in val) return String(val.value);
        try {
            return JSON.stringify(val);
        } catch {
            return '[Object]';
        }
    }
    return String(val);
}

function ToolPart({ part }) {
    const toolName = part.toolName || (part.type?.startsWith('tool-') ? part.type.replace(/^tool-/, '') : '');
    const isResult = part.state === 'output-available' || part.state === 'result' || !!part.output;
    const input = part.input || part.args || {};
    const output = part.output || part.result || {};

    // Hasil generate_file: tampilkan sebagai kartu unduhan mandiri
    if (toolName === 'generate_file' && isResult && output?.ok && (output?.downloadUrl || output?.fileName)) {
        const downloadUrl = output.downloadUrl || `/api/chat/files?name=${encodeURIComponent(output.fileName)}`;
        const formatLabel = (output.format || output.fileName?.split('.').pop() || 'FILE').toUpperCase();
        return (
            <div className="w-full max-w-sm rounded-2xl border border-pink-200/80 bg-gradient-to-b from-pink-50/50 via-white to-white p-4 shadow-sm space-y-3 my-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-pink-500 to-rose-400 flex items-center justify-center shrink-0 shadow-xs">
                        <i className="fa-solid fa-file-arrow-down text-white text-sm" aria-hidden="true"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate" title={output.title || output.fileName}>
                            {output.title || output.fileName}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-pink-600 uppercase">{formatLabel}</span>
                            {output.sizeKb ? <span>• {output.sizeKb} KB</span> : null}
                            <span className="text-emerald-600 font-medium">• Siap dibuka</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {formatLabel === 'HTML' || formatLabel === 'PDF' ? (
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 text-center py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                            <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" aria-hidden="true"></i>
                            <span>{formatLabel === 'PDF' ? 'Buka PDF' : 'Buka Laporan'}</span>
                        </a>
                    ) : null}
                    <a
                        href={downloadUrl}
                        download={output.fileName}
                        className={`${(formatLabel === 'HTML' || formatLabel === 'PDF') ? 'flex-1 bg-slate-900 hover:bg-slate-800' : 'w-full bg-slate-950 hover:bg-pink-600'} flex items-center justify-center gap-1.5 text-center py-2 px-3 rounded-xl text-white text-xs font-bold shadow-xs transition-colors cursor-pointer`}
                    >
                        <i className="fa-solid fa-download text-[11px]" aria-hidden="true"></i>
                        <span>Unduh {output.fileName}</span>
                    </a>
                </div>
            </div>
        );
    }

    return null;
}

/**
 * Komponen tunggal penyatu seluruh proses query BigQuery, memory, dan refine_skill.
 * Menampilkan ikon gear, kutipan lucu kecantikan ("Pakai Sunscreen...", "Gambar Alis..."),
 * progress bar animasi, persentase loading, dan dropdown accordion untuk melihat detail query.
 */
function SystemProcessGroup({ parts = [], isLoading = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [quoteIndex, setQuoteIndex] = useState(0);

    const totalCount = parts.length;
    const completedParts = parts.filter(
        (p) => p.state === 'output-available' || p.state === 'result' || !!p.output
    );
    const completedCount = completedParts.length;
    const allDone = totalCount > 0 && completedCount === totalCount && !isLoading;

    useEffect(() => {
        if (!allDone) {
            const timer = setInterval(() => {
                setQuoteIndex((prev) => (prev + 1) % BEAUTY_QUOTES.length);
            }, 2800);
            return () => clearInterval(timer);
        }
    }, [allDone]);

    let percentage = 100;
    if (!allDone) {
        if (totalCount === 0) {
            percentage = 40;
        } else {
            const stepPct = Math.round((completedCount / totalCount) * 80);
            percentage = Math.max(30, Math.min(95, stepPct + 15));
        }
    }

    const currentQuote = allDone
        ? "Touch Up Selesai! Data Cantik Siap Disajikan ✨💅"
        : BEAUTY_QUOTES[quoteIndex]?.text || "Sedang Pakai Sunscreen... Biar Data Tetap Glowing! 🧴✨";

    const totalRows = parts.reduce((acc, p) => {
        const out = p.output || p.result || {};
        return acc + (typeof out.rowCount === 'number' ? out.rowCount : 0);
    }, 0);

    const hasError = parts.some((p) => {
        const out = p.output || p.result || {};
        return out.ok === false || (p.state === 'error');
    });

    if (allDone) {
        return (
            <div className="w-full max-w-2xl rounded-xl border border-pink-100 bg-pink-50/60 p-2.5 my-1 transition-all">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0 shadow-2xs">
                            <Sparkles size={12} />
                        </span>
                        <div className="text-[11px] text-slate-700 truncate">
                            <span className="font-semibold text-slate-900">Data berhasil diproses</span>
                            <span className="text-slate-400 mx-1.5">•</span>
                            <span>{totalCount} proses</span>
                            {totalRows > 0 && <span className="text-slate-400"> ({totalRows} baris)</span>}
                            {hasError && <span className="text-rose-500 font-semibold ml-1">(ada kendala)</span>}
                        </div>
                    </div>
                    {totalCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-[10px] font-semibold text-pink-600 hover:text-pink-800 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-pink-100/70 transition-colors cursor-pointer"
                        >
                            <span>{isOpen ? 'Sembunyikan' : 'Lihat Detail'}</span>
                            <ChevronDown size={11} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>

                {isOpen && (
                    <div className="mt-2.5 pt-2 border-t border-pink-100/80 space-y-2">
                        {parts.map((part, pIdx) => {
                            const tName = part.toolName || (part.type?.startsWith('tool-') ? part.type.replace(/^tool-/, '') : '');
                            const isRes = part.state === 'output-available' || part.state === 'result' || !!part.output;
                            const inp = part.input || part.args || {};
                            const out = part.output || part.result || {};

                            return (
                                <div key={pIdx} className="text-[11px] rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5 shadow-2xs">
                                    <div className="flex items-center justify-between text-slate-600 font-semibold">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[9px] font-bold">
                                                {pIdx + 1}
                                            </span>
                                            <span>
                                                {tName === 'remember'
                                                    ? 'Menyimpan memori'
                                                    : tName === 'refine_skill'
                                                        ? 'Menyempurnakan skill'
                                                        : 'Query BigQuery'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isRes && typeof out.rowCount === 'number' && (
                                                <span className="font-mono text-[10px] text-slate-400">{out.rowCount} baris</span>
                                            )}
                                            {isRes && out.ok === false && (
                                                <span className="font-mono text-[10px] text-rose-500 font-bold">gagal</span>
                                            )}
                                        </div>
                                    </div>

                                    {inp.sql && (
                                        <pre className="p-2 rounded-lg bg-slate-950 text-emerald-300 font-mono text-[10px] overflow-x-auto whitespace-pre">
                                            {inp.sql}
                                        </pre>
                                    )}

                                    {tName === 'remember' && inp.content && (
                                        <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-[10px]">
                                            Fakta: &quot;{inp.content}&quot; ({inp.scope})
                                        </div>
                                    )}

                                    {tName === 'refine_skill' && inp.reason && (
                                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-[10px]">
                                            Alasan pembaruan: {inp.reason}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-xl rounded-2xl border border-pink-200/90 bg-gradient-to-br from-pink-50/70 via-white to-rose-50/40 p-3.5 shadow-xs my-1.5 transition-all">
            {/* Header: Gear icon, quote text, percentage */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-colors bg-pink-100 text-pink-600">
                        <Settings size={16} className="animate-spin" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 leading-snug truncate" title={currentQuote}>
                            {currentQuote}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="text-pink-600 font-medium">Bebie sedang memproses data</span>
                            <span>•</span>
                            <span>Langkah {Math.min(completedCount + 1, totalCount || 1)} dari {totalCount || 1}</span>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight shadow-2xs bg-pink-100 text-pink-700 border border-pink-200 animate-pulse">
                        {percentage}%
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-pink-100/80 rounded-full overflow-hidden mt-3 relative">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-pink-500 via-rose-400 to-pink-600"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Expandable Accordion for individual query details */}
            {totalCount > 0 && (
                <div className="mt-2.5 pt-2 border-t border-pink-100/80">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-full flex items-center justify-between text-[11px] font-medium text-slate-500 hover:text-pink-600 transition-colors py-0.5 cursor-pointer"
                    >
                        <span className="flex items-center gap-1.5">
                            <Wrench size={11} className="text-pink-500" />
                            <span>Detail langkah sistem ({totalCount} proses)</span>
                            {hasError && <span className="text-[10px] text-rose-500 font-semibold">(ada error)</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            {isOpen ? 'Sembunyikan' : 'Buka'}
                            <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </span>
                    </button>

                    {isOpen && (
                        <div className="mt-2 space-y-2 pt-1">
                            {parts.map((part, pIdx) => {
                                const tName = part.toolName || (part.type?.startsWith('tool-') ? part.type.replace(/^tool-/, '') : '');
                                const isRes = part.state === 'output-available' || part.state === 'result' || !!part.output;
                                const inp = part.input || part.args || {};
                                const out = part.output || part.result || {};

                                return (
                                    <div key={pIdx} className="text-[11px] rounded-xl border border-slate-200 bg-white/95 p-2.5 space-y-1.5 shadow-2xs">
                                        <div className="flex items-center justify-between text-slate-600 font-semibold">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[9px] font-bold">
                                                    {pIdx + 1}
                                                </span>
                                                <span>
                                                    {tName === 'remember'
                                                        ? 'Menyimpan memori'
                                                        : tName === 'refine_skill'
                                                            ? 'Menyempurnakan skill'
                                                            : 'Query BigQuery'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isRes && typeof out.rowCount === 'number' && (
                                                    <span className="font-mono text-[10px] text-slate-400">{out.rowCount} baris</span>
                                                )}
                                                {isRes && out.ok === false && (
                                                    <span className="font-mono text-[10px] text-rose-500 font-bold">gagal</span>
                                                )}
                                                {!isRes && (
                                                    <span className="font-mono text-[10px] text-amber-500 font-medium">sedang berjalan...</span>
                                                )}
                                            </div>
                                        </div>

                                        {inp.sql && (
                                            <pre className="p-2 rounded-lg bg-slate-950 text-emerald-300 font-mono text-[10px] overflow-x-auto whitespace-pre">
                                                {inp.sql}
                                            </pre>
                                        )}

                                        {tName === 'remember' && inp.content && (
                                            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-[10px]">
                                                <span className="font-semibold">{inp.scope === 'global' ? 'Memori global:' : 'Memori pribadi:'}</span> {inp.content}
                                            </div>
                                        )}

                                        {tName === 'refine_skill' && inp.slug && (
                                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-[10px]">
                                                <span className="font-semibold">Skill {inp.slug}:</span> {inp.reason || 'perbaikan otomatis'}
                                            </div>
                                        )}

                                        {isRes && !out.ok && out.error && (
                                            <div className="flex items-start gap-1.5 text-rose-600 font-medium text-[10px]">
                                                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                                <span className="break-all">{out.error}</span>
                                            </div>
                                        )}

                                        {isRes && Array.isArray(out.rows) && out.rows.length > 0 && (
                                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                <table className="w-full text-left text-[10px]">
                                                    <thead className="bg-slate-100">
                                                        <tr>
                                                            {Object.keys(out.rows[0]).slice(0, 6).map((k) => (
                                                                <th key={k} className="px-2 py-1 font-semibold text-slate-600">{k}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {out.rows.slice(0, 5).map((r, ri) => (
                                                            <tr key={ri} className="border-t border-slate-100">
                                                                {Object.keys(out.rows[0]).slice(0, 6).map((k) => (
                                                                    <td key={k} className="px-2 py-1 text-slate-700 font-mono">{formatCellValue(r[k])}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {out.rows.length > 5 && (
                                                    <div className="px-2 py-1 text-[9px] text-slate-400 border-t border-slate-100">
                                                        Menampilkan 5 dari {out.rowCount} baris.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ChatMessage({ message, showSystemProcess = false, isLoading = false }) {
    const isUser = message.role === 'user';
    const parts = message.parts || [];

    const hasFileToolPart = parts.some((p) => {
        const name = p.toolName || (p.type?.startsWith('tool-') ? p.type.replace(/^tool-/, '') : '');
        return name === 'generate_file' && (p.state === 'output-available' || p.state === 'result' || !!p.output);
    });

    // Kumpulkan seluruh proses sistem non-generate_file ke dalam 1 grup
    const systemParts = parts.filter((part) => {
        if (!part.type?.startsWith('tool-') && !part.toolName) return false;
        const name = part.toolName || (part.type?.startsWith('tool-') ? part.type.replace(/^tool-/, '') : '');
        return name !== 'generate_file';
    });

    let renderedSystemGroup = false;

    let lastTableMarkdown = '';
    const rendered = [];

    parts.forEach((part, idx) => {
        if (part.type === 'text') {
            // Render grup proses sistem tepat sebelum teks jika ada proses sistem yang aktif
            if (!renderedSystemGroup && systemParts.length > 0 && (showSystemProcess || isLoading)) {
                rendered.push(
                    <SystemProcessGroup key="system-process-group" parts={systemParts} isLoading={isLoading} />
                );
                renderedSystemGroup = true;
            }

            const normalizedText = isUser ? part.text : autoLinkFiles(normalizeInlineTables(part.text));
            const tableStart = normalizedText.lastIndexOf('|');
            if (tableStart !== -1 && !isUser) {
                const lines = normalizedText.split('\n');
                const tableLines = lines.filter((l) => l.trim().startsWith('|'));
                if (tableLines.length >= 3) {
                    lastTableMarkdown = tableLines.join('\n');
                }
            }
            const cleaned = normalizedText.replace(/\[FILE_CSV\]\s*\S*/g, '').trimEnd();
            if (cleaned) {
                const hasTable = !isUser && lastTableMarkdown && lastTableMarkdown.includes('\n');
                const fileMatches = !isUser ? [...cleaned.matchAll(/\/api\/chat\/files\?name=([a-zA-Z0-9._-]+)/g)] : [];
                const detectedFiles = [...new Set(fileMatches.map((m) => m[1]))];

                rendered.push(
                    <div
                        key={`t-${idx}`}
                        className={`px-4 py-3 rounded-2xl shadow-xs text-[14.5px] leading-relaxed break-words w-fit max-w-full ${
                            isUser
                                ? 'bg-gradient-to-r from-pink-600 to-rose-600 !text-white rounded-tr-xs shadow-pink-600/15'
                                : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs'
                        }`}
                        style={isUser ? { color: '#ffffff' } : undefined}
                    >
                        <div
                            className={`chat-bubble ${
                                isUser ? 'chat-bubble-own !text-white prose-invert prose-p:!text-white prose-headings:!text-white prose-strong:!text-white prose-em:!text-white ' : ''
                            }prose prose-sm max-w-none prose-p:my-1 prose-pre:my-1.5 prose-headings:my-1.5 prose-ul:my-1 prose-ol:my-1`}
                            style={isUser ? { color: '#ffffff' } : undefined}
                        >
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => (
                                        <p className={isUser ? '!text-white' : undefined} style={isUser ? { color: '#ffffff' } : undefined}>
                                            {children}
                                        </p>
                                    ),
                                    span: ({ children }) => (
                                        <span className={isUser ? '!text-white' : undefined} style={isUser ? { color: '#ffffff' } : undefined}>
                                            {children}
                                        </span>
                                    ),
                                    strong: ({ children }) => (
                                        <strong className={isUser ? '!text-white' : undefined} style={isUser ? { color: '#ffffff' } : undefined}>
                                            {children}
                                        </strong>
                                    ),
                                    em: ({ children }) => (
                                        <em className={isUser ? '!text-white' : undefined} style={isUser ? { color: '#ffffff' } : undefined}>
                                            {children}
                                        </em>
                                    ),
                                    li: ({ children }) => (
                                        <li className={isUser ? '!text-white' : undefined} style={isUser ? { color: '#ffffff' } : undefined}>
                                            {children}
                                        </li>
                                    ),
                                    table: ({ children }) => (
                                        <div className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs max-w-full">
                                            <table className="min-w-full divide-y divide-slate-200 text-left text-xs not-prose">
                                                {children}
                                            </table>
                                        </div>
                                    ),
                                    thead: ({ children }) => <thead className="bg-slate-50/90 text-slate-800 font-semibold">{children}</thead>,
                                    tbody: ({ children }) => <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>,
                                    tr: ({ children }) => <tr className="hover:bg-pink-50/40 transition-colors">{children}</tr>,
                                    th: ({ children }) => <th className="px-3 py-2 text-slate-800 font-bold whitespace-nowrap">{children}</th>,
                                    td: ({ children }) => <td className="px-3 py-2 text-slate-600 whitespace-nowrap text-xs">{children}</td>,
                                    pre: ({ children, ...props }) => (
                                        <pre className="p-3 my-2 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto border border-slate-800" {...props}>
                                            {children}
                                        </pre>
                                    ),
                                    code: ({ node, className, children, ...props }) => {
                                        const isCodeBlock = Boolean(className?.includes('language-') || (typeof children === 'string' && children.includes('\n')));
                                        if (isCodeBlock) {
                                            return (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        }
                                        return (
                                            <code
                                                className={
                                                    isUser
                                                        ? 'bg-pink-700/60 px-1.5 py-0.5 rounded text-white font-mono text-[12px]'
                                                        : 'bg-slate-100 text-pink-700 px-1.5 py-0.5 rounded border border-slate-200/80 font-mono text-[12px]'
                                                }
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    },
                                    a: ({ href, children, ...props }) => {
                                        const isFileDownload = href && (href.startsWith('/api/chat/files') || /\.(pptx|xlsx|csv|html|pdf)($|\?)/i.test(href));
                                        if (isFileDownload) {
                                            const fn = href.includes('name=')
                                                ? decodeURIComponent(href.split('name=')[1]?.split('&')[0] || '')
                                                : '';
                                            return (
                                                <a
                                                    href={href}
                                                    download={fn || true}
                                                    className="inline-flex items-center gap-2 font-semibold text-slate-900 bg-gradient-to-r from-pink-50 to-rose-50 hover:from-pink-600 hover:to-rose-500 hover:text-white px-3.5 py-1.5 rounded-xl border border-pink-200 hover:border-pink-600 transition-all no-underline shadow-2xs my-1 group cursor-pointer"
                                                    {...props}
                                                >
                                                    <i className="fa-solid fa-file-arrow-down text-pink-600 group-hover:text-white text-xs transition-colors" aria-hidden="true"></i>
                                                    <span className="text-xs">{children}</span>
                                                </a>
                                            );
                                        }
                                        return (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={isUser ? '!text-white underline font-semibold' : 'text-pink-600 hover:underline font-medium'}
                                                style={isUser ? { color: '#ffffff' } : undefined}
                                                {...props}
                                            >
                                                {children}
                                            </a>
                                        );
                                    },
                                }}
                            >
                                {cleaned}
                            </ReactMarkdown>
                        </div>
                        {!isUser && !hasFileToolPart && detectedFiles.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                                {detectedFiles.map((fn) => {
                                    const ext = fn.split('.').pop()?.toUpperCase() || 'FILE';
                                    const url = `/api/chat/files?name=${encodeURIComponent(fn)}`;
                                    return (
                                        <div key={fn} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gradient-to-r from-pink-50/70 to-rose-50/70 border border-pink-100">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                                    <i className="fa-solid fa-file-arrow-down text-xs" aria-hidden="true"></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-slate-900 truncate">{fn}</div>
                                                    <div className="text-[10px] text-pink-600 font-semibold">{ext} • Siap diunduh</div>
                                                </div>
                                            </div>
                                            <a
                                                href={url}
                                                download={fn}
                                                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-pink-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                            >
                                                Unduh
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {!isUser && hasTable && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                                <TableCsvButton tableMarkdown={lastTableMarkdown} />
                            </div>
                        )}
                    </div>
                );
            }
        } else if (part.type === 'file') {
            rendered.push(
                <div key={`f-${idx}`} className={isUser ? 'flex justify-end' : ''}>
                    <div className={`rounded-2xl p-2 shadow-sm w-fit max-w-full ${isUser ? 'bg-pink-500/20' : 'bg-white border border-slate-100'}`}>
                        <FilePart part={part} isUser={isUser} />
                    </div>
                </div>
            );
        } else if (part.type?.startsWith('tool-') || part.toolName) {
            const toolName = part.toolName || (part.type?.startsWith('tool-') ? part.type.replace(/^tool-/, '') : '');
            // Kartu unduhan file selalu ditampilkan tersendiri
            if (toolName === 'generate_file') {
                rendered.push(
                    <div key={`tool-${idx}`} className="w-full">
                        <ToolPart part={part} />
                    </div>
                );
            } else if (!renderedSystemGroup && (showSystemProcess || isLoading)) {
                // Seluruh proses BigQuery/memory/skill dimasukkan ke dalam 1 bubble tunggal
                rendered.push(
                    <SystemProcessGroup key="system-process-group" parts={systemParts} isLoading={isLoading} />
                );
                renderedSystemGroup = true;
            }
        }
    });

    // Jika ada system parts tapi belum dirender (misal tool selesai tanpa ada part teks)
    if (!renderedSystemGroup && systemParts.length > 0 && (showSystemProcess || isLoading)) {
        rendered.push(
            <SystemProcessGroup key="system-process-group" parts={systemParts} isLoading={isLoading} />
        );
        renderedSystemGroup = true;
    }

    if (rendered.length === 0) {
        if (!isUser && isLoading) {
            rendered.push(
                <SystemProcessGroup key="loading-group" parts={[]} isLoading={true} />
            );
        } else if (!isUser && !isLoading) {
            rendered.push(
                <div key="stopped" className="px-4 py-3 rounded-2xl shadow-sm text-xs leading-relaxed break-words w-fit max-w-full bg-amber-50/90 text-amber-900 border border-amber-200/80 rounded-tl-md">
                    <div className="flex items-start gap-2.5">
                        <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <div className="font-semibold text-amber-900">Query selesai tanpa ringkasan teks.</div>
                            <div className="text-[11px] text-amber-800/90 leading-relaxed">
                                Proses data telah selesai, namun balasan belum terangkum. Silakan ketik <em>&quot;Lanjutkan ringkasan laporan&quot;</em> atau kirim ulang pertanyaan.
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    return (
        <div className={`flex gap-2.5 sm:gap-3 max-w-3xl mx-auto w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {isUser ? (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-2xs text-white bg-slate-800 text-[11px] mt-0.5" title="Anda">
                    <i className="fa-solid fa-user" aria-hidden="true"></i>
                </div>
            ) : (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-xs border border-pink-200 bg-pink-100 flex items-center justify-center mt-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/bebie-avatar.jpg"
                        alt="Bebie - Beauty Bestie AI"
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            <div className={`flex flex-col gap-1.5 min-w-0 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                {!isUser && (
                    <div className="flex items-center gap-1.5 px-1 mb-0.5">
                        <span className="font-bold text-xs text-slate-800">Bebie</span>
                    </div>
                )}
                {rendered}
                {isLoading && !isUser && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1 pt-0.5">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-600"></span>
                        </span>
                        <span>Bebie sedang merapikan balasan...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

