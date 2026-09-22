'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

    // Proses per baris: satu baris fisik bisa memuat beberapa tabel inline.
    for (const line of lines) {
        // Baris tabel normal (dimulai & diakhiri pipe, tanpa sambungan "| |---|") diteruskan apa adanya
        if (!runMarker.test(line)) {
            out.push(line);
            continue;
        }

        // Potong prefix teks sebelum pipe pertama
        const prefixMatch = line.match(/^([^|]*)\|/);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        const rest = prefix ? line.slice(prefix.length) : line;

        // Split sel: buang pipe tepi
        const cells = rest
            .replace(/^\s*\|/, '')
            .replace(/\|\s*$/, '')
            .split('|')
            .map((c) => c.trim());

        // Cari run pemisah: >=2 sel "---" berurutan
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

        // Tidak ada run pemisah valid → perbarui hanya jika ada pipe ganda "| |" (indikasi tabel rusak)
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

        // Sisa sel setelah run pemisah. Sel kosong interior berasal dari sambungan
        // "| |" antar baris yang dirapatkan model, bukan data; buang semua agar
        // perataan baris (chunking) tidak bergeser.
        const body = cells.slice(sepEnd + 1).filter((c) => c !== '');

        const rows = [];
        for (let i = 0; i < body.length; i += width) {
            rows.push(body.slice(i, i + width));
        }
        // Baris terakhir boleh pendek (tabel terpotong); isi dengan '' agar rapi
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
    return text.replace(/(?:\[([^\]]+)\]\(([^)]+)\))|(?:\*\*)?([a-zA-Z0-9_-]+\.(?:pptx|xlsx|csv))(?:\*\*)?/gi, (full, label, url, bareFile) => {
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

    // Hasil generate_file: tampilkan sebagai kartu unduhan, bukan detail tool
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
                            <span className="text-emerald-600 font-medium">• Siap diunduh</span>
                        </div>
                    </div>
                </div>
                <a
                    href={downloadUrl}
                    download={output.fileName}
                    className="flex items-center justify-center gap-2 w-full text-center py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-pink-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-download text-xs" aria-hidden="true"></i>
                    <span>Unduh {output.fileName}</span>
                </a>
            </div>
        );
    }

    return (
        <details className="w-full text-[11px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden group">
            <summary className="px-3 py-2 cursor-pointer select-none flex items-center gap-2 text-slate-600 hover:bg-slate-100 transition-colors list-none">
                <Wrench size={12} className={isResult ? 'text-emerald-600' : 'animate-spin text-amber-500'} />
                <span className="font-semibold">
                    {toolName === 'generate_file'
                        ? 'Membuat file'
                        : toolName === 'remember'
                            ? 'Menyimpan memori'
                            : toolName === 'refine_skill'
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
                {toolName === 'remember' && input.content && (
                    <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-[11px]">
                        <span className="font-semibold">{input.scope === 'global' ? 'Memori global:' : 'Memori pribadi:'}</span> {input.content}
                    </div>
                )}
                {toolName === 'refine_skill' && input.slug && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-[11px]">
                        <span className="font-semibold">Skill {input.slug}:</span> {input.reason || 'perbaikan otomatis'}
                    </div>
                )}
                {toolName === 'generate_file' && input.format && (
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
                {isResult && toolName !== 'generate_file' && output.note && (
                    <div className="text-slate-500 text-[11px] leading-relaxed">{output.note}</div>
                )}
                {isResult && Array.isArray(output.rows) && output.rows.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-100">
                                <tr>
                                    {Object.keys(output.rows[0]).slice(0, 8).map((k) => (
                                        <th key={k} className="px-2 py-1 font-semibold text-slate-600">{k}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {output.rows.slice(0, 10).map((r, ri) => (
                                    <tr key={ri} className="border-t border-slate-100">
                                        {Object.keys(output.rows[0]).slice(0, 8).map((k) => (
                                            <td key={k} className="px-2 py-1 text-slate-700 font-mono">{formatCellValue(r[k])}</td>
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

export default function ChatMessage({ message, showSystemProcess = false, isLoading = false }) {
    const isUser = message.role === 'user';
    const parts = message.parts || [];

    const hasFileToolPart = parts.some((p) => {
        const name = p.toolName || (p.type?.startsWith('tool-') ? p.type.replace(/^tool-/, '') : '');
        return name === 'generate_file' && (p.state === 'output-available' || p.state === 'result' || !!p.output);
    });

    // Marker CSV dari sistem diterjemahkan jadi tombol unduh
    let lastTableMarkdown = '';
    const rendered = [];

    parts.forEach((part, idx) => {
        if (part.type === 'text') {
            const normalizedText = isUser ? part.text : autoLinkFiles(normalizeInlineTables(part.text));
            const tableStart = normalizedText.lastIndexOf('|');
            if (tableStart !== -1 && !isUser) {
                // Simpan blok tabel markdown terakhir untuk tombol CSV
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
                    <div key={`t-${idx}`} className={`px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed break-words w-fit max-w-full
                        ${isUser
                            ? 'bg-pink-600 text-white rounded-tr-md'
                            : 'bg-white text-slate-800 border border-slate-100 rounded-tl-md'
                        }`}
                    >
                        <div className={`chat-bubble ${isUser ? 'chat-bubble-own ' : ''}prose prose-sm max-w-none prose-p:my-1 prose-pre:my-1.5 prose-headings:my-1.5 prose-ul:my-1 prose-ol:my-1`}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    a: ({ href, children, ...props }) => {
                                        const isFileDownload = href && (href.startsWith('/api/chat/files') || /\.(pptx|xlsx|csv)($|\?)/i.test(href));
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
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline font-medium" {...props}>
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
        } else if (part.type?.startsWith('tool-')) {
            const toolName = part.toolName || (part.type?.startsWith('tool-') ? part.type.replace(/^tool-/, '') : '');
            // Kartu unduhan file selalu ditampilkan
            if (toolName === 'generate_file') {
                rendered.push(
                    <div key={`tool-${idx}`} className="w-full">
                        <ToolPart part={part} />
                    </div>
                );
            } else if (showSystemProcess) {
                // Detail proses query BigQuery, memory, refine_skill hanya tampil bila diizinkan
                rendered.push(
                    <div key={`tool-${idx}`} className="w-full">
                        <ToolPart part={part} />
                    </div>
                );
            }
        }
    });

    if (rendered.length === 0) {
        if (!isUser && isLoading) {
            rendered.push(
                <div key="loading" className="px-4 py-3 rounded-2xl shadow-sm text-xs leading-relaxed break-words w-fit max-w-full bg-white text-slate-800 border border-slate-100 rounded-tl-md">
                    <div className="flex items-center gap-2.5 py-0.5 text-slate-600">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-600"></span>
                        </span>
                        <span className="font-medium text-xs">Sedang mengambil data & menyusun laporan...</span>
                    </div>
                </div>
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
                {isLoading && !isUser && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1 pt-0.5">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-600"></span>
                        </span>
                        <span>Sedang mengalirkan balasan...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
