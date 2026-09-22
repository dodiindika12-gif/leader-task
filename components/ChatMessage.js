'use client';

import ReactMarkdown from 'react-markdown';
import { FileText, Download, Wrench, AlertCircle } from 'lucide-react';

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
        <button onClick={handleDownload} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors">
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

function ToolPart({ part }) {
    const isResult = part.state === 'output-available';
    const input = part.input || {};
    const output = part.output || {};

    // Hasil generate_file: tampilkan sebagai kartu unduhan, bukan detail tool
    if (part.toolName === 'generate_file' && isResult && output?.ok && output?.downloadUrl) {
        return (
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-pink-500 to-rose-400 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-file-arrow-down text-white text-sm" aria-hidden="true"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{output.title || output.fileName}</div>
                        <div className="text-[10px] text-slate-400">
                            {(output.format || '').toUpperCase()}
                            {output.sizeKb ? ` • ${output.sizeKb} KB` : ''} • siap diunduh
                        </div>
                    </div>
                </div>
                <a
                    href={output.downloadUrl}
                    download={output.fileName}
                    className="block w-full text-center py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                >
                    Unduh {output.fileName}
                </a>
            </div>
        );
    }

    return (
        <details className="w-full text-[11px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden group">
            <summary className="px-3 py-2 cursor-pointer select-none flex items-center gap-2 text-slate-600 hover:bg-slate-100 transition-colors list-none">
                <Wrench size={12} className={isResult ? 'text-emerald-600' : 'animate-spin text-amber-500'} />
                <span className="font-semibold">
                    {part.toolName === 'generate_file'
                        ? 'Membuat file'
                        : part.toolName === 'remember'
                            ? 'Menyimpan memori'
                            : part.toolName === 'refine_skill'
                                ? 'Menyempurnakan skill'
                                : 'BigQuery'}{' '}
                    {isResult ? 'selesai' : 'sedang berjalan'}
                </span>
                {isResult && typeof output.rowCount === 'number' && (
                    <span className="ml-auto font-mono text-[10px] text-slate-400">{output.rowCount} baris</span>
                )}
                {isResult && output.ok === false && (
                    <span className="ml-auto font-mono text-[10px] text-rose-500">gagal</span>
                )}
            </summary>
            <div className="px-3 py-2 border-t border-slate-200 space-y-2">
                {input.sql && (
                    <pre className="p-2 rounded-lg bg-slate-950 text-emerald-200/90 font-mono text-[10px] overflow-x-auto whitespace-pre">{input.sql}</pre>
                )}
                {part.toolName === 'remember' && input.content && (
                    <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-[11px]">
                        <span className="font-semibold">{input.scope === 'global' ? 'Memori global:' : 'Memori pribadi:'}</span> {input.content}
                    </div>
                )}
                {part.toolName === 'refine_skill' && input.slug && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-[11px]">
                        <span className="font-semibold">Skill {input.slug}:</span> {input.reason || 'perbaikan otomatis'}
                    </div>
                )}
                {part.toolName === 'generate_file' && input.format && (
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 text-[11px]">
                        Format <span className="font-mono font-bold">{input.format}</span>
                        {input.title ? `: ${input.title}` : ''}
                    </div>
                )}
                {isResult && !output.ok && output.error && (
                    <div className="flex items-start gap-1.5 text-rose-600 font-medium">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span className="break-all">{output.error}</span>
                    </div>
                )}
                {isResult && part.toolName !== 'generate_file' && output.note && (
                    <div className="text-slate-500 text-[11px] leading-relaxed">{output.note}</div>
                )}
                {isResult && Array.isArray(output.rows) && output.rows.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-100">
                                <tr>
                                    {Object.keys(output.rows[0]).slice(0, 8).map((k) => (
                                        <th key={k} className="px-2 py-1.5 font-semibold text-slate-500 whitespace-nowrap">{k}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {output.rows.slice(0, 10).map((row, i) => (
                                    <tr key={i}>
                                        {Object.keys(output.rows[0]).slice(0, 8).map((k) => (
                                            <td key={k} className="px-2 py-1.5 font-mono text-slate-700 whitespace-nowrap max-w-[180px] truncate">
                                                {row[k] === null || row[k] === undefined ? 'NULL' : String(row[k])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {output.rows.length > 10 && (
                            <div className="px-2 py-1 text-[10px] text-slate-400 border-t border-slate-100">Menampilkan 10 dari {output.rowCount} baris.</div>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}

export default function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    const parts = message.parts || [];

    // Marker CSV dari sistem diterjemahkan jadi tombol unduh
    let lastTableMarkdown = '';
    const rendered = [];

    parts.forEach((part, idx) => {
        if (part.type === 'text') {
            const tableStart = part.text.lastIndexOf('|');
            if (tableStart !== -1 && !isUser) {
                // Simpan blok tabel markdown terakhir untuk tombol CSV
                const lines = part.text.split('\n');
                const tableLines = lines.filter((l) => l.trim().startsWith('|'));
                if (tableLines.length >= 3) {
                    lastTableMarkdown = tableLines.join('\n');
                }
            }
            const cleaned = part.text.replace(/\[FILE_CSV\]\s*\S*/g, '').trimEnd();
            if (cleaned) {
                const hasTable = !isUser && lastTableMarkdown && lastTableMarkdown.includes('\n');
                rendered.push(
                    <div key={`t-${idx}`} className={`px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed break-words w-fit max-w-full
                        ${isUser
                            ? 'bg-pink-600 text-white rounded-tr-md'
                            : 'bg-white text-slate-800 border border-slate-100 rounded-tl-md'
                        }`}
                    >
                        <div className={`chat-bubble ${isUser ? 'chat-bubble-own ' : ''}prose prose-sm max-w-none prose-p:my-1 prose-pre:my-1.5 prose-headings:my-1.5 prose-ul:my-1 prose-ol:my-1`}>
                            <ReactMarkdown>{cleaned}</ReactMarkdown>
                        </div>
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
        } else if (part.type?.startsWith('tool-')) {
            rendered.push(
                <div key={`tool-${idx}`} className="w-full">
                    <ToolPart part={part} />
                </div>
            );
        }
    });

    if (rendered.length === 0) return null;

    return (
        <div className={`flex gap-3 max-w-4xl mx-auto w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs text-white
                ${isUser ? 'bg-indigo-600' : 'bg-gradient-to-tr from-pink-600 via-pink-500 to-rose-400'}`}
            >
                {isUser ? <i className="fa-solid fa-user text-xs" aria-hidden="true"></i> : <i className="fa-brands fa-whatsapp text-xs" aria-hidden="true"></i>}
            </div>

            <div className={`flex flex-col gap-2 min-w-0 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="text-[11px] text-slate-400 font-medium px-1">
                    {isUser ? 'Anda' : 'AI Data Assistant'}
                </div>
                {rendered}
            </div>
        </div>
    );
}
