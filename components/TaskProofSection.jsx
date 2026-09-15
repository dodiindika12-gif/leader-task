import React, { useState, useRef } from 'react';

/**
 * Format bytes to readable string (e.g. 1.2 MB, 450 KB)
 */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Determine document badge styles and icons based on file extension
 */
function getDocumentTypeConfig(ext = '', mimeType = '') {
    const cleanExt = (ext || '').toLowerCase().replace(/^\./, '');

    if (['pdf'].includes(cleanExt)) {
        return {
            label: 'PDF',
            icon: 'fa-regular fa-file-pdf',
            bg: 'bg-rose-50',
            text: 'text-rose-600',
            border: 'border-rose-200/80',
            ring: 'ring-rose-100',
            isDoc: true,
            isPdf: true,
        };
    }
    if (['xlsx', 'xls', 'csv'].includes(cleanExt)) {
        return {
            label: 'Excel',
            icon: 'fa-regular fa-file-excel',
            bg: 'bg-emerald-50',
            text: 'text-emerald-600',
            border: 'border-emerald-200/80',
            ring: 'ring-emerald-100',
            isDoc: true,
            isSpreadsheet: true,
        };
    }
    if (['docx', 'doc', 'rtf'].includes(cleanExt)) {
        return {
            label: 'Word',
            icon: 'fa-regular fa-file-word',
            bg: 'bg-blue-50',
            text: 'text-blue-600',
            border: 'border-blue-200/80',
            ring: 'ring-blue-100',
            isDoc: true,
            isWord: true,
        };
    }
    if (['pptx', 'ppt'].includes(cleanExt)) {
        return {
            label: 'PowerPoint',
            icon: 'fa-regular fa-file-powerpoint',
            bg: 'bg-amber-50',
            text: 'text-amber-600',
            border: 'border-amber-200/80',
            ring: 'ring-amber-100',
            isDoc: true,
        };
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(cleanExt) || mimeType.startsWith('image/')) {
        return {
            label: 'Gambar',
            icon: 'fa-regular fa-file-image',
            bg: 'bg-sky-50',
            text: 'text-sky-600',
            border: 'border-sky-200/80',
            ring: 'ring-sky-100',
            isImage: true,
        };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(cleanExt)) {
        return {
            label: 'Arsip',
            icon: 'fa-regular fa-file-zipper',
            bg: 'bg-purple-50',
            text: 'text-purple-600',
            border: 'border-purple-200/80',
            ring: 'ring-purple-100',
            isArchive: true,
        };
    }
    if (cleanExt === 'link' || cleanExt === 'url') {
        return {
            label: 'Link',
            icon: 'fa-solid fa-link',
            bg: 'bg-indigo-50',
            text: 'text-indigo-600',
            border: 'border-indigo-200/80',
            ring: 'ring-indigo-100',
            isLink: true,
        };
    }
    return {
        label: cleanExt ? cleanExt.toUpperCase() : 'Dokumen',
        icon: 'fa-regular fa-file-lines',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        ring: 'ring-slate-100',
        isDoc: true,
    };
}

export default function TaskProofSection({
    taskId,
    proofFiles = [],
    onChangeProofFiles,
    currentMemberName = 'Staff',
    currentMemberId = null,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const [uploadError, setUploadError] = useState('');
    const [noteDraft, setNoteDraft] = useState('');
    const [activeTab, setActiveTab] = useState('file'); // 'file' | 'link'
    
    // External link draft state
    const [linkTitle, setLinkTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [linkNote, setLinkNote] = useState('');

    const fileInputRef = useRef(null);

    const handleFiles = async (files) => {
        if (!files || files.length === 0) return;
        setUploadError('');
        setIsUploading(true);

        const newProofs = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('taskId', taskId || 'unassigned');
                formData.append('uploadedBy', currentMemberName);
                if (currentMemberId) formData.append('uploadedById', currentMemberId);
                if (noteDraft.trim()) formData.append('note', noteDraft.trim());

                const res = await fetch('/api/tasks/upload-proof', {
                    method: 'POST',
                    body: formData,
                });

                const data = await res.json();
                if (!res.ok || !data.ok) {
                    throw new Error(data.error || 'Gagal mengunggah berkas.');
                }

                newProofs.push(data.file);
            } catch (err) {
                console.error('Upload proof error:', err);
                setUploadError(err.message || 'Gagal mengunggah beberapa berkas.');
            }
        }

        if (newProofs.length > 0) {
            onChangeProofFiles([...proofFiles, ...newProofs]);
            setNoteDraft('');
        }

        setIsUploading(false);
        setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleAddLinkProof = (e) => {
        e.preventDefault();
        if (!linkUrl.trim()) return;

        let normalizedUrl = linkUrl.trim();
        if (!/^https?:\/\//i.test(normalizedUrl)) {
            normalizedUrl = 'https://' + normalizedUrl;
        }

        const newLinkProof = {
            id: `proof_link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: linkTitle.trim() || normalizedUrl,
            url: normalizedUrl,
            ext: 'link',
            size: 0,
            uploadedBy: currentMemberName,
            uploadedById: currentMemberId,
            uploadedAt: new Date().toISOString(),
            note: linkNote.trim(),
        };

        onChangeProofFiles([...proofFiles, newLinkProof]);
        setLinkTitle('');
        setLinkUrl('');
        setLinkNote('');
        setActiveTab('file');
    };

    const handleDeleteProof = async (proofId) => {
        const item = proofFiles.find(p => p.id === proofId);
        if (!item) return;

        if (confirm(`Hapus berkas bukti "${item.name}"?`)) {
            // Optional: call delete endpoint if it has storage path
            if (item.path) {
                fetch(`/api/tasks/upload-proof?path=${encodeURIComponent(item.path)}`, { method: 'DELETE' }).catch(() => {});
            }
            onChangeProofFiles(proofFiles.filter(p => p.id !== proofId));
        }
    };

    return (
        <div className="mt-6 border-t border-slate-100 pt-5">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs border border-emerald-200/60 shadow-2xs">
                        <i className="fa-solid fa-paperclip"></i>
                    </span>
                    <div>
                        <span className="text-sm font-semibold text-slate-800">Bukti Penuntasan Tugas</span>
                        <span className="ml-2 text-[11px] text-slate-400 font-normal hidden sm:inline">
                            (PDF, Excel, Word, Link Dokumen)
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                        {proofFiles.length} berkas bukti
                    </span>
                </div>
            </div>

            {/* Tab Selector: Upload File vs Tautan Online */}
            <div className="flex items-center gap-1 mb-3 p-1 bg-slate-100/80 rounded-xl max-w-fit border border-slate-200/60 text-xs">
                <button
                    type="button"
                    onClick={() => setActiveTab('file')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'file'
                            ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <i className="fa-solid fa-cloud-arrow-up text-[11px]"></i>
                    <span>Unggah Berkas</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('link')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'link'
                            ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <i className="fa-solid fa-link text-[11px]"></i>
                    <span>Tautan / Drive</span>
                </button>
            </div>

            {/* Error Message if any */}
            {uploadError && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-rose-500"></i>
                    <span className="flex-1">{uploadError}</span>
                    <button type="button" onClick={() => setUploadError('')} className="text-rose-400 hover:text-rose-700">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}

            {/* Mode 1: Upload File (Drag & Drop Zone) */}
            {activeTab === 'file' && (
                <div className="space-y-2 mb-3.5">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
                            isDragging
                                ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                                : 'border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt,.txt,.rtf,.jpg,.jpeg,.png,.webp,.zip,.rar"
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />

                        {isUploading ? (
                            <div className="py-2 flex flex-col items-center justify-center gap-2">
                                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-xs font-semibold text-emerald-800">
                                    Mengunggah berkas... ({uploadProgress?.current}/{uploadProgress?.total})
                                </div>
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                    {uploadProgress?.fileName}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-600 mb-0.5">
                                    <i className="fa-solid fa-arrow-up-from-bracket text-emerald-600"></i>
                                </div>
                                <div className="text-xs font-semibold text-slate-800">
                                    Tarik & lepas berkas ke sini, atau <span className="text-emerald-600 hover:underline">Pilih dari Komputer</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    PDF, Excel (XLSX/CSV), Word (DOCX), PPTX, Foto atau ZIP (Maks. 25 MB/file)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Catatan Berkas Opsional Sebelum Upload */}
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Catatan berkas (opsional, misal: 'Hasil laporan final sudah acc direksi')..."
                            className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 bg-white"
                        />
                    </div>
                </div>
            )}

            {/* Mode 2: Tautan Eksternal (Google Drive / Spreadsheet) */}
            {activeTab === 'link' && (
                <form onSubmit={handleAddLinkProof} className="p-3.5 bg-indigo-50/40 rounded-2xl border border-indigo-100 mb-3.5 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <i className="fa-solid fa-link text-[10px] text-indigo-600"></i>
                        <span>Lampirkan Link Google Drive, Sheets, Docs, atau Canva</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                            type="text"
                            value={linkTitle}
                            onChange={(e) => setLinkTitle(e.target.value)}
                            placeholder="Nama Dokumen (misal: 'Spreadsheet Rekap Finansial')"
                            className="text-xs border border-slate-200 rounded-xl p-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 bg-white"
                        />
                        <input
                            type="text"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="URL Link (https://docs.google.com/...)"
                            required
                            className="text-xs border border-slate-200 rounded-xl p-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={linkNote}
                            onChange={(e) => setLinkNote(e.target.value)}
                            placeholder="Catatan tambahan tautan..."
                            className="flex-1 text-xs border border-slate-200 rounded-xl p-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 bg-white"
                        />
                        <button
                            type="submit"
                            disabled={!linkUrl.trim()}
                            className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition cursor-pointer shrink-0 shadow-xs"
                        >
                            Tambah Link
                        </button>
                    </div>
                </form>
            )}

            {/* List of Attached Proof Documents */}
            <div className="space-y-2.5">
                {proofFiles.map((proof) => {
                    const cfg = getDocumentTypeConfig(proof.ext, proof.mimeType);
                    const isExternalLink = proof.ext === 'link';
                    
                    // Office Viewer URL for online inspection without downloading MS Office
                    const isOfficeDoc = ['xlsx', 'xls', 'csv', 'docx', 'doc', 'pptx', 'ppt'].includes((proof.ext || '').toLowerCase());
                    const onlineViewerUrl = isOfficeDoc && proof.url
                        ? `https://docs.google.com/viewer?url=${encodeURIComponent(proof.url)}&embedded=false`
                        : null;

                    return (
                        <div
                            key={proof.id}
                            className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-emerald-300/80 hover:shadow-xs transition-all group"
                        >
                            <div className="flex items-start justify-between gap-3">
                                {/* Left Side: Icon + File Meta */}
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    <div
                                        className={`w-9 h-9 rounded-xl ${cfg.bg} ${cfg.text} ${cfg.border} border flex items-center justify-center shrink-0 text-base shadow-2xs mt-0.5`}
                                    >
                                        <i className={cfg.icon}></i>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                className="text-xs font-semibold text-slate-900 truncate hover:text-emerald-700"
                                                title={proof.name}
                                            >
                                                {proof.name}
                                            </span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                                {cfg.label}
                                            </span>
                                            {proof.size > 0 && (
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    • {formatBytes(proof.size)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Uploader & Timestamp */}
                                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                            <span>Oleh <strong className="text-slate-600 font-medium">{proof.uploadedBy || 'Staff'}</strong></span>
                                            {proof.uploadedAt && (
                                                <>
                                                    <span>•</span>
                                                    <span>{new Date(proof.uploadedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* File Note / Remarks */}
                                        {proof.note && (
                                            <div className="mt-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 italic">
                                                "{proof.note}"
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Actions (View, Download, Delete) */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Action 1: Online Preview for Office Files */}
                                    {onlineViewerUrl && (
                                        <a
                                            href={onlineViewerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl border border-slate-200 transition flex items-center gap-1 shadow-2xs"
                                            title="Lihat isi dokumen online tanpa perlu aplikasi Office"
                                        >
                                            <i className="fa-regular fa-eye text-[10px]"></i>
                                            <span className="hidden sm:inline">Lihat Online</span>
                                        </a>
                                    )}

                                    {/* Action 2: Open / Download File or Link */}
                                    <a
                                        href={proof.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={isExternalLink ? undefined : proof.name}
                                        className={`px-2.5 py-1 text-[11px] font-medium rounded-xl border transition flex items-center gap-1 shadow-2xs ${
                                            isExternalLink
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                                : cfg.isPdf
                                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                        }`}
                                        title={isExternalLink ? 'Buka Tautan' : cfg.isPdf ? 'Buka PDF' : 'Unduh Berkas'}
                                    >
                                        <i className={`text-[10px] ${isExternalLink ? 'fa-solid fa-arrow-up-right-from-square' : cfg.isPdf ? 'fa-regular fa-file-pdf' : 'fa-solid fa-download'}`}></i>
                                        <span>{isExternalLink ? 'Buka Link' : cfg.isPdf ? 'Buka PDF' : 'Unduh'}</span>
                                    </a>

                                    {/* Action 3: Delete proof file */}
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteProof(proof.id)}
                                        className="w-7 h-7 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer ml-0.5"
                                        title="Hapus bukti ini"
                                    >
                                        <i className="fa-regular fa-trash-can text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {proofFiles.length === 0 && (
                    <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50/50 flex flex-col items-center gap-1">
                        <i className="fa-solid fa-folder-open text-slate-300 text-base"></i>
                        <span>Belum ada berkas bukti penuntasan yang dilampirkan.</span>
                    </div>
                )}
            </div>
        </div>
    );
}
