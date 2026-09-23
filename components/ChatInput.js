'use client';

import { Send, Paperclip, ImagePlus, X, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeType(file) {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeMap = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        csv: 'text/csv',
        txt: 'text/plain',
        json: 'application/json',
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
    };
    return mimeMap[ext] || 'application/octet-stream';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function ChatInput({ sendMessage, isLoading, stop }) {
    const [input, setInput] = useState('');
    const [files, setFiles] = useState([]);
    const [fileError, setFileError] = useState('');
    const [isConverting, setIsConverting] = useState(false);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const textareaRef = useRef(null);

    const acceptFiles = (fileList, kind) => {
        const incoming = Array.from(fileList || []);
        const valid = [];
        for (const f of incoming) {
            if (f.size > MAX_FILE_BYTES) {
                setFileError(`"${f.name}" melebihi batas 8 MB dan tidak dilampirkan.`);
                continue;
            }
            valid.push(f);
        }
        if (valid.length > 0) {
            setFileError('');
            setFiles((prev) => [...prev, ...valid].slice(0, 6));
        }
        // izinkan memilih nama file yang sama lagi
        if (kind === 'image' && imageInputRef.current) imageInputRef.current.value = '';
        if (kind === 'file' && fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (isLoading || isConverting) return;
        if (!input.trim() && files.length === 0) return;

        setIsConverting(true);
        try {
            const currentText = input.trim();
            const currentFiles = [...files];

            setInput('');
            setFiles([]);
            setFileError('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';

            let fileParts = [];
            if (currentFiles.length > 0) {
                fileParts = await Promise.all(
                    currentFiles.map(async (file) => ({
                        type: 'file',
                        filename: file.name,
                        mediaType: getMimeType(file),
                        url: await readFileAsDataUrl(file),
                    }))
                );
            }

            sendMessage({
                text: currentText || (fileParts.length > 0 ? 'Tolong periksa lampiran ini.' : ''),
                files: fileParts.length > 0 ? fileParts : undefined,
            });
        } catch (err) {
            setFileError(`Gagal membaca lampiran: ${err.message || err}`);
        } finally {
            setIsConverting(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit(e);
        }
    };

    const autoResize = (el) => {
        setInput(el.value);
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };

    const previews = files.map((f, i) => {
        const isImage = f.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name);
        const url = URL.createObjectURL(f);
        return (
            <div key={`${f.name}-${i}`} className="relative group shrink-0">
                {isImage ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={f.name} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center gap-1 px-1">
                        <FileTextIcon />
                        <span className="text-[9px] text-slate-500 truncate max-w-full px-1">{f.name}</span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => removeFile(i)}
                    title={`Hapus lampiran ${f.name}`}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center opacity-90 hover:opacity-100"
                >
                    <X size={10} />
                </button>
                <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-slate-400 truncate">{formatBytes(f.size)}</div>
            </div>
        );
    });

    const hasContent = input.trim().length > 0 || files.length > 0;

    return (
        <div className="max-w-3xl mx-auto w-full px-2 sm:px-4">
            {files.length > 0 && (
                <div className="flex gap-3 mb-5 px-1 flex-wrap">{previews}</div>
            )}

            {fileError && (
                <div className="mb-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                    <i className="fa-solid fa-circle-exclamation mt-0.5" aria-hidden="true"></i>
                    <span>{fileError}</span>
                </div>
            )}

            <form onSubmit={submit} className="relative flex items-end gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:ring-2 focus-within:ring-pink-500/15 focus-within:border-pink-300 transition-all">
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => acceptFiles(e.target.files, 'file')}
                    aria-label="Lampirkan file"
                />
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => acceptFiles(e.target.files, 'image')}
                    aria-label="Lampirkan gambar"
                />

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    title="Lampirkan file (maks 8 MB)"
                    className="p-3 text-slate-400 hover:text-pink-600 transition-colors rounded-xl hover:bg-pink-50 shrink-0 disabled:opacity-40"
                >
                    <Paperclip size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isLoading}
                    title="Lampirkan gambar"
                    className="p-3 text-slate-400 hover:text-pink-600 transition-colors rounded-xl hover:bg-pink-50 shrink-0 disabled:opacity-40"
                >
                    <ImagePlus size={18} />
                </button>

                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => autoResize(e.target)}
                    onKeyDown={onKeyDown}
                    placeholder="Tanya data BigQuery, atau lampirkan file dan gambar..."
                    rows={1}
                    className="flex-1 max-h-40 min-h-[44px] py-2.5 px-1 resize-none bg-transparent focus:outline-none text-slate-700 placeholder-slate-400 text-sm"
                />

                {isLoading ? (
                    <button
                        type="button"
                        onClick={() => stop?.()}
                        title="Hentikan balasan"
                        className="p-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors shrink-0"
                    >
                        <Loader2 size={16} className="animate-spin" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!hasContent}
                        title="Kirim pesan"
                        className="p-3 bg-slate-950 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <Send size={16} />
                    </button>
                )}
            </form>
            <div className="text-center text-[11px] text-slate-400 mt-2.5">
                Ujicoba: asisten bisa menjalankan query BigQuery. Periksa hasil penting sebelum dipakai.
            </div>
        </div>
    );
}

function FileTextIcon() {
    return <FileSvg />;
}

function FileSvg() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <path d="M14 2v6h6" />
        </svg>
    );
}
