'use strict';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_COLORS = [
    '#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', 
    '#0f766e', '#dc2626', '#4f46e5', '#0891b2', '#059669', '#d97706', '#475569'
];

export default function ProjectSettingsModal({
    project,
    members = [],
    session = null,
    projectAccess = [],
    isOpen,
    onClose,
    onUpdateColor,
    onToggleCalendar,
    onTogglePin,
    onSaveSharing,
    onDeleteProject,
    onUpdateName,
    onUpdateDescription
}) {
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'participants', 'danger'
    const [participantsView, setParticipantsView] = useState('list'); // 'list' (current participants), 'add' (add members from company)
    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [selectedColor, setSelectedColor] = useState('#2563eb');
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
    const [selectedCoOwners, setSelectedCoOwners] = useState(new Set());
    const [searchMember, setSearchMember] = useState('');
    const [expandedDivs, setExpandedDivs] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // ==========================================
    // SISTEM OTORISASI / PEMILIK WORKSPACE (WHATSAPP ADMIN STYLE)
    // ==========================================
    const currentMemberId = session?.memberId || session?.id;
    const userRole = (session?.role || session?.position || '').trim();
    const isSuperUser = userRole === 'Super User' || session?.memberId === 'superadmin' || session?.email === 'abskdi.markom@gmail.com';
    
    // 1. Pembuat / Pemilik Utama
    const isPrimaryOwner = Boolean(project?.owner_id && (project.owner_id === currentMemberId));
    
    // 2. Pemilik Tambahan (Co-Owners)
    const coOwnersList = Array.isArray(project?.co_owners) ? project.co_owners : [];
    const isCoOwner = coOwnersList.includes(currentMemberId);

    // 3. Status Otorisasi Pemilik
    const isOwner = isSuperUser || isPrimaryOwner || isCoOwner;

    // Sinkronisasi data saat modal dibuka
    useEffect(() => {
        if (project && isOpen) {
            setProjectName(project.name || '');
            setProjectDescription(project.description || '');
            setSelectedColor(project.color || '#2563eb');

            // Ambil daftar akses saat ini
            const currentAccess = (projectAccess || [])
                .filter(pa => pa.project_id === project.id)
                .map(pa => pa.member_id);

            // Pembuat proyek selalu memiliki akses
            if (project.owner_id && !currentAccess.includes(project.owner_id)) {
                currentAccess.push(project.owner_id);
            }
            setSelectedMemberIds(new Set(currentAccess));

            // Ambil daftar co-owners
            const initialCoOwners = Array.isArray(project.co_owners) ? project.co_owners : [];
            setSelectedCoOwners(new Set(initialCoOwners));

            setActiveTab('general');
            setParticipantsView('list');
            setSearchMember('');
        }
    }, [project?.id, isOpen]);

    useEffect(() => {
        if (project?.color) {
            setSelectedColor(project.color);
        }
    }, [project?.color]);

    if (!isOpen || !project) return null;

    // ==========================================
    // PESERTA & ANGGOTA PERUSAHAAN
    // ==========================================
    // Anggota yang saat ini ada di workspace
    const participantMembers = members.filter(m => 
        selectedMemberIds.has(m.id) || m.id === project.owner_id
    );

    // Filter peserta berdasarkan pencarian
    const filteredParticipants = participantMembers.filter(m =>
        m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
        (m.position || '').toLowerCase().includes(searchMember.toLowerCase()) ||
        (m.division || '').toLowerCase().includes(searchMember.toLowerCase())
    );

    // Anggota perusahaan dikelompokkan berdasarkan divisi (untuk tampilan Tambah Peserta)
    const groupedCompanyMembers = members.reduce((acc, m) => {
        const div = m.division || 'Tanpa Divisi';
        if (!acc[div]) acc[div] = [];
        acc[div].push(m);
        return acc;
    }, {});

    // ==========================================
    // HANDLERS
    // ==========================================
    // Angkat atau Cabut Hak Akses Pemilik (Co-Owner)
    const handleToggleCoOwner = (targetMemberId) => {
        if (!isOwner) return;
        if (targetMemberId === project.owner_id) {
            alert('Pembuat Proyek adalah Pemilik Utama dan status kepemilikannya tidak dapat diubah.');
            return;
        }

        const nextCoOwners = new Set(selectedCoOwners);
        const isPromoting = !nextCoOwners.has(targetMemberId);
        
        if (isPromoting) {
            nextCoOwners.add(targetMemberId);
        } else {
            nextCoOwners.delete(targetMemberId);
        }
        setSelectedCoOwners(nextCoOwners);

        // Pastikan target juga memiliki akses peserta
        const nextMembers = new Set(selectedMemberIds);
        nextMembers.add(targetMemberId);
        if (project.owner_id) nextMembers.add(project.owner_id);
        setSelectedMemberIds(nextMembers);

        if (onSaveSharing) {
            onSaveSharing(project.id, Array.from(nextMembers), Array.from(nextCoOwners));
        }
    };

    // Keluarkan Peserta dari Workspace
    const handleRemoveParticipant = (targetMemberId) => {
        if (!isOwner) return;
        if (targetMemberId === project.owner_id) {
            alert('Pembuat Proyek tidak dapat dikeluarkan dari workspace ini.');
            return;
        }

        const targetObj = members.find(m => m.id === targetMemberId);
        const targetName = targetObj?.name || 'anggota ini';

        if (window.confirm(`Keluarkan ${targetName} dari workspace "${project.name}"?`)) {
            const nextMembers = new Set(selectedMemberIds);
            nextMembers.delete(targetMemberId);
            setSelectedMemberIds(nextMembers);

            const nextCoOwners = new Set(selectedCoOwners);
            nextCoOwners.delete(targetMemberId);
            setSelectedCoOwners(nextCoOwners);

            if (onSaveSharing) {
                const toSave = new Set(nextMembers);
                if (project.owner_id) toSave.add(project.owner_id);
                onSaveSharing(project.id, Array.from(toSave), Array.from(nextCoOwners));
            }
        }
    };

    // Toggle Checklist Anggota saat Tambah Peserta
    const handleToggleMember = (memberId) => {
        if (!isOwner) return;
        const next = new Set(selectedMemberIds);
        if (next.has(memberId)) {
            if (memberId === project.owner_id) {
                alert('Pembuat Proyek tidak dapat dihapus dari workspace.');
                return;
            }
            next.delete(memberId);
            // Jika dihapus dari peserta, otomatis cabut status co-owner
            if (selectedCoOwners.has(memberId)) {
                const nextCo = new Set(selectedCoOwners);
                nextCo.delete(memberId);
                setSelectedCoOwners(nextCo);
            }
        } else {
            next.add(memberId);
        }
        setSelectedMemberIds(next);
    };

    // Pilih / Batal Semua anggota dalam divisi
    const handleSelectAllDiv = (divMembers, e) => {
        if (e?.stopPropagation) e.stopPropagation();
        if (!isOwner) return;
        const next = new Set(selectedMemberIds);
        const allSelected = divMembers.every(m => next.has(m.id));
        divMembers.forEach(m => {
            if (allSelected) {
                if (m.id !== project.owner_id) next.delete(m.id);
            } else {
                next.add(m.id);
            }
        });
        setSelectedMemberIds(next);
    };

    // Pilih Cepat berdasarkan Role Jabatan
    const handleSelectByRole = (targetRoles) => {
        if (!isOwner) return;
        const next = new Set(selectedMemberIds);
        const roleMembers = members.filter(m => {
            const r = (m.position || m.role || '').toLowerCase();
            return targetRoles.some(tr => r.includes(tr.toLowerCase()));
        });
        
        const allSelected = roleMembers.length > 0 && roleMembers.every(m => next.has(m.id));
        roleMembers.forEach(m => {
            if (allSelected) {
                if (m.id !== project.owner_id) next.delete(m.id);
            } else {
                next.add(m.id);
            }
        });
        setSelectedMemberIds(next);
    };

    const toggleDiv = (div) => {
        setExpandedDivs(prev => ({ ...prev, [div]: !prev[div] }));
    };

    // Simpan Hak Akses & Peserta (dari Tampilan Tambah Peserta)
    const handleSaveSharingClick = async () => {
        if (!isOwner || !onSaveSharing) return;
        setIsSaving(true);
        try {
            const toSave = new Set(selectedMemberIds);
            if (project.owner_id) toSave.add(project.owner_id);
            await onSaveSharing(project.id, Array.from(toSave), Array.from(selectedCoOwners));
            setParticipantsView('list');
        } finally {
            setIsSaving(false);
        }
    };

    // Simpan Nama Proyek
    const handleSaveNameSubmit = (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (!isOwner) return;
        if (onUpdateName && projectName.trim() && projectName.trim() !== project.name) {
            onUpdateName(project.id, projectName.trim());
        }
    };

    // Simpan Keterangan Proyek
    const handleSaveDescriptionSubmit = (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (!isOwner) return;
        if (onUpdateDescription && projectDescription.trim() !== (project.description || '')) {
            onUpdateDescription(project.id, projectDescription.trim());
        }
    };

    // Ubah Warna
    const handleColorClick = (color, e) => {
        if (e?.stopPropagation) e.stopPropagation();
        if (!isOwner) return;
        setSelectedColor(color);
        if (onUpdateColor) {
            onUpdateColor(project.id, color);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose}></div>
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xl overflow-hidden border border-white/80 z-10 flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center space-x-3.5 min-w-0">
                        <div 
                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-lg shadow-sm shrink-0 transition-colors"
                            style={{ backgroundColor: selectedColor }}
                        >
                            <i className={`fa-solid ${project.description === 'personal' ? 'fa-id-badge' : 'fa-folder-gear'}`}></i>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-900 truncate">
                                    {project.name}
                                </h3>
                                {project.description === 'personal' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold border border-indigo-200 shrink-0">
                                        Pribadi
                                    </span>
                                )}
                                {isPrimaryOwner ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200 shrink-0 flex items-center gap-1">
                                        <i className="fa-solid fa-crown text-amber-600 text-[9px]"></i>
                                        Pembuat
                                    </span>
                                ) : isCoOwner ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200 shrink-0 flex items-center gap-1">
                                        <i className="fa-solid fa-star text-purple-600 text-[9px]"></i>
                                        Pemilik
                                    </span>
                                ) : isSuperUser ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200 shrink-0 flex items-center gap-1">
                                        <i className="fa-solid fa-shield text-rose-600 text-[9px]"></i>
                                        Super User
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium shrink-0">
                                        Anggota
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 truncate font-medium mt-0.5">
                                {participantMembers.length} Peserta • {1 + selectedCoOwners.size} Pemilik
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200/60 transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-100 px-6 bg-white gap-2 pt-2 select-none">
                    {/* Tab 1: Umum & Informasi */}
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                            activeTab === 'general' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <i className="fa-solid fa-sliders"></i>
                        <span>Umum & Info</span>
                    </button>

                    {/* Tab 2: Peserta Workspace (Bisa dilihat oleh SEMUA anggota!) */}
                    <button
                        onClick={() => setActiveTab('participants')}
                        className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                            activeTab === 'participants' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <i className="fa-solid fa-users"></i>
                        <span>Peserta ({participantMembers.length})</span>
                    </button>

                    {/* Tab 3: Hapus Workspace (HANYA UNTUK PEMILIK, tidak berlaku untuk workspace pribadi default) */}
                    {isOwner && project.description !== 'personal' && (
                        <button
                            onClick={() => setActiveTab('danger')}
                            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ml-auto ${
                                activeTab === 'danger' 
                                    ? 'border-rose-600 text-rose-600' 
                                    : 'border-transparent text-slate-400 hover:text-rose-600'
                            }`}
                        >
                            <i className="fa-solid fa-trash-can"></i>
                            <span>Hapus</span>
                        </button>
                    )}
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    {/* ======================================================== */}
                    {/* TAB 1: UMUM & INFORMASI                                   */}
                    {/* ======================================================== */}
                    {activeTab === 'general' && (
                        <div className="space-y-5">
                            {/* Banner jika bukan Pemilik */}
                            {!isOwner && (
                                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                                    <i className="fa-solid fa-lock text-amber-600 mt-0.5"></i>
                                    <div>
                                        <p className="font-bold">Mode Hanya Lihat (Read-Only)</p>
                                        <p className="text-amber-700 text-[11px] mt-0.5">
                                            Anda tergabung sebagai anggota. Perubahan nama, keterangan, dan warna hanya dapat dilakukan oleh <strong>Pemilik Workspace</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Nama Proyek */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                                    <span>Nama Proyek</span>
                                    {!isOwner && (
                                        <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                            <i className="fa-solid fa-lock text-[9px]"></i> Terkunci
                                        </span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        disabled={!isOwner}
                                        className={`flex-1 text-xs rounded-xl px-3 py-2 border transition ${
                                            !isOwner
                                                ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed'
                                                : 'bg-white text-slate-800 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                                        }`}
                                        placeholder="Nama proyek..."
                                    />
                                    {isOwner && onUpdateName && projectName.trim() !== project.name && (
                                        <button
                                            type="button"
                                            onClick={handleSaveNameSubmit}
                                            className="px-3.5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition shrink-0"
                                        >
                                            Ubah
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Keterangan / Deskripsi Proyek */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                                    <span>Keterangan & Informasi Proyek</span>
                                    {!isOwner && (
                                        <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                            <i className="fa-solid fa-lock text-[9px]"></i> Terkunci
                                        </span>
                                    )}
                                </label>
                                <textarea
                                    value={projectDescription}
                                    onChange={(e) => setProjectDescription(e.target.value)}
                                    disabled={!isOwner}
                                    rows={3}
                                    placeholder={isOwner ? "Tuliskan keterangan, tujuan, atau ringkasan workspace ini..." : "Belum ada keterangan workspace."}
                                    className={`w-full text-xs rounded-xl px-3 py-2 border transition ${
                                        !isOwner
                                            ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed'
                                            : 'bg-white text-slate-800 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                                    }`}
                                />
                                {isOwner && onUpdateDescription && projectDescription.trim() !== (project.description || '') && (
                                    <div className="flex justify-end mt-1.5">
                                        <button
                                            type="button"
                                            onClick={handleSaveDescriptionSubmit}
                                            className="px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition"
                                        >
                                            Simpan Keterangan
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Pilihan Warna Proyek */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                                    <span>Warna Identitas Proyek</span>
                                    {!isOwner && (
                                        <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                            <i className="fa-solid fa-lock text-[9px]"></i> Terkunci
                                        </span>
                                    )}
                                </label>
                                <div className={`grid grid-cols-6 gap-2 ${!isOwner ? 'opacity-70 pointer-events-none' : ''}`}>
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={(e) => handleColorClick(c, e)}
                                            style={{ backgroundColor: c }}
                                            disabled={!isOwner}
                                            className={`h-8 rounded-xl transition-transform flex items-center justify-center text-white shadow-xs ${
                                                selectedColor.toLowerCase() === c.toLowerCase() 
                                                    ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2' 
                                                    : 'hover:scale-105'
                                            }`}
                                        >
                                            {selectedColor.toLowerCase() === c.toLowerCase() && (
                                                <i className="fa-solid fa-check text-xs"></i>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2.5 flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <input
                                        type="color"
                                        value={selectedColor}
                                        disabled={!isOwner}
                                        onChange={(e) => handleColorClick(e.target.value)}
                                        className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-xs text-slate-600 font-medium">Warna Kustom:</span>
                                    <span className="text-xs font-mono font-bold text-slate-800 ml-auto">{selectedColor}</span>
                                </div>
                            </div>

                            {/* Toggle Cards: Calendar & Pin */}
                            <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                {/* Calendar Toggle */}
                                <div 
                                    onClick={() => isOwner && onToggleCalendar && onToggleCalendar(project.id, !project.showInCalendar)}
                                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                                        !isOwner ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                                    } ${
                                        project.showInCalendar 
                                            ? 'bg-pink-50/70 border-pink-200 text-pink-900' 
                                            : 'bg-slate-50 border-slate-200/70 text-slate-700 hover:bg-slate-100/70'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-xs ${
                                            project.showInCalendar ? 'bg-pink-500 text-white' : 'bg-white text-slate-400 border border-slate-200'
                                        }`}>
                                            <i className="fa-solid fa-calendar-days"></i>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold leading-tight">Tampilkan di Semua Kalender</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Task proyek ini akan muncul di kalender tim</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                                        project.showInCalendar ? 'bg-pink-500 justify-end' : 'bg-slate-300 justify-start'
                                    }`}>
                                        <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                                    </div>
                                </div>

                                {/* Pin Toggle */}
                                <div 
                                    onClick={() => isOwner && onTogglePin && onTogglePin(project.id)}
                                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                                        !isOwner ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                                    } ${
                                        project.isPinned 
                                            ? 'bg-orange-50/70 border-orange-200 text-orange-900' 
                                            : 'bg-slate-50 border-slate-200/70 text-slate-700 hover:bg-slate-100/70'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-xs ${
                                            project.isPinned ? 'bg-orange-500 text-white' : 'bg-white text-slate-400 border border-slate-200'
                                        }`}>
                                            <i className="fa-solid fa-thumbtack"></i>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold leading-tight">Sematkan Proyek (Urgent)</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Menempatkan proyek ini di posisi teratas</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                                        project.isPinned ? 'bg-orange-500 justify-end' : 'bg-slate-300 justify-start'
                                    }`}>
                                        <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 2: PESERTA & SISTEM ADMIN (WHATSAPP STYLE)           */}
                    {/* ======================================================== */}
                    {activeTab === 'participants' && (
                        <div className="space-y-4">
                            {/* Sub-Header & Mode Switcher */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-800">
                                        {participantsView === 'list' ? 'Daftar Peserta Workspace' : 'Tambah Peserta Baru'}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        {participantsView === 'list'
                                            ? `${participantMembers.length} anggota tergabung (${1 + selectedCoOwners.size} Pemilik)`
                                            : 'Pilih anggota tim dari divisi lain untuk dimasukkan'}
                                    </p>
                                </div>

                                {isOwner && (
                                    <div>
                                        {participantsView === 'list' ? (
                                            <button
                                                type="button"
                                                onClick={() => setParticipantsView('add')}
                                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5 shadow-xs"
                                            >
                                                <i className="fa-solid fa-user-plus text-[11px]"></i>
                                                <span>Tambah Peserta</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setParticipantsView('list')}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                                            >
                                                <i className="fa-solid fa-arrow-left text-[11px]"></i>
                                                <span>Kembali ke Peserta</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Info Banner untuk Anggota Biasa */}
                            {!isOwner && (
                                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-slate-700">
                                    <i className="fa-solid fa-shield-halved text-indigo-600 mt-0.5"></i>
                                    <div>
                                        <p className="font-semibold text-slate-800">Hak Akses Anggota</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            Semua anggota dapat melihat daftar peserta. Hanya <strong>Pemilik Workspace</strong> yang dapat menambah/menghapus peserta dan membagikan status kepemilikan.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ---------------------------------------------------- */}
                            {/* SUB-VIEW 1: DAFTAR PESERTA WORKSPACE SAAT INI        */}
                            {/* ---------------------------------------------------- */}
                            {participantsView === 'list' && (
                                <div className="space-y-3">
                                    {/* Search peserta */}
                                    <div className="relative">
                                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                        <input
                                            type="text"
                                            placeholder="Cari peserta workspace..."
                                            value={searchMember}
                                            onChange={(e) => setSearchMember(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                    </div>

                                    {/* List peserta */}
                                    <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                        {filteredParticipants.length === 0 ? (
                                            <div className="p-6 text-center text-slate-400 text-xs">
                                                Tidak ada peserta yang cocok dengan pencarian.
                                            </div>
                                        ) : (
                                            filteredParticipants.map(member => {
                                                const isThisPrimary = member.id === project.owner_id;
                                                const isThisCoOwner = selectedCoOwners.has(member.id);
                                                const isThisOwner = isThisPrimary || isThisCoOwner;
                                                const isMe = member.id === currentMemberId;

                                                return (
                                                    <div
                                                        key={member.id}
                                                        className="px-3 py-2.5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2 hover:border-slate-300 transition shadow-xs"
                                                    >
                                                        {/* Avatar & Identitas */}
                                                        <div className="flex items-center space-x-2.5 min-w-0">
                                                            <div 
                                                                className="w-8 h-8 rounded-xl text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs"
                                                                style={{ backgroundColor: member.color || '#6366f1' }}
                                                            >
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-xs font-bold text-slate-900 truncate">
                                                                        {member.name}
                                                                    </span>
                                                                    {isMe && (
                                                                        <span className="text-[10px] text-indigo-600 font-bold">
                                                                            (Anda)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-400 truncate">
                                                                    {member.position || member.role || 'Staff'} • {member.division || 'Tanpa Divisi'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Status & Aksi Pemilik (WhatsApp Admin Style) */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {/* Badge Status */}
                                                            {isThisPrimary ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                                                    <i className="fa-solid fa-crown text-amber-600 text-[9px]"></i>
                                                                    Pembuat Proyek
                                                                </span>
                                                            ) : isThisCoOwner ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                                                    <i className="fa-solid fa-star text-purple-600 text-[9px]"></i>
                                                                    Pemilik (Admin)
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                                                    Anggota
                                                                </span>
                                                            )}

                                                            {/* Kontrol Aksi: Hanya untuk Pemilik Workspace */}
                                                            {isOwner && !isThisPrimary && (
                                                                <div className="flex items-center gap-1">
                                                                    {/* Tombol Jadikan / Cabut Pemilik */}
                                                                    {isThisCoOwner ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleCoOwner(member.id)}
                                                                            className="px-2 py-1 text-[10px] font-bold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                                                                            title="Turunkan menjadi Anggota biasa"
                                                                        >
                                                                            Cabut Pemilik
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleCoOwner(member.id)}
                                                                            className="px-2 py-1 text-[10px] font-bold rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center gap-1"
                                                                            title="Beri hak akses pemilik (seperti Admin Grup)"
                                                                        >
                                                                            <i className="fa-solid fa-star text-[9px]"></i>
                                                                            Jadikan Pemilik
                                                                        </button>
                                                                    )}

                                                                    {/* Tombol Keluarkan Peserta */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveParticipant(member.id)}
                                                                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-0.5"
                                                                        title="Keluarkan dari workspace"
                                                                    >
                                                                        <i className="fa-solid fa-user-xmark text-xs"></i>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ---------------------------------------------------- */}
                            {/* SUB-VIEW 2: TAMBAH PESERTA BARU DARI TIM (HANYA OWNER)*/}
                            {/* ---------------------------------------------------- */}
                            {participantsView === 'add' && isOwner && (
                                <div className="space-y-3">
                                    {/* Search & Quick Filters */}
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                            <input
                                                type="text"
                                                placeholder="Cari anggota dari seluruh tim/divisi..."
                                                value={searchMember}
                                                onChange={(e) => setSearchMember(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                            <button type="button" onClick={() => handleSelectByRole(['direksi', 'director'])} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors">
                                                + Direksi
                                            </button>
                                            <button type="button" onClick={() => handleSelectByRole(['manager'])} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors">
                                                + Manager
                                            </button>
                                            <button type="button" onClick={() => handleSelectByRole(['spv', 'supervisor'])} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 transition-colors">
                                                + SPV
                                            </button>
                                            <button type="button" onClick={() => handleSelectByRole(['koordinator', 'coordinator', 'kordinator'])} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors">
                                                + Koordinator
                                            </button>
                                            <button type="button" onClick={() => handleSelectByRole(['staf', 'staff'])} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-200 transition-colors">
                                                + Staff
                                            </button>
                                        </div>
                                    </div>

                                    {/* Divisi & Anggota */}
                                    <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                        {Object.entries(groupedCompanyMembers).map(([division, divMembers]) => {
                                            const filtered = divMembers.filter(m => 
                                                m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
                                                (m.position || '').toLowerCase().includes(searchMember.toLowerCase()) ||
                                                (m.role || '').toLowerCase().includes(searchMember.toLowerCase())
                                            );

                                            if (filtered.length === 0) return null;

                                            const allSelected = filtered.every(m => selectedMemberIds.has(m.id));
                                            const isExpanded = expandedDivs[division] !== false;

                                            return (
                                                <div key={division} className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                                                    <div 
                                                        onClick={() => toggleDiv(division)}
                                                        className="px-3 py-2 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between cursor-pointer text-xs"
                                                    >
                                                        <div className="flex items-center space-x-2 font-bold text-slate-700">
                                                            <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}></i>
                                                            <span>{division}</span>
                                                            <span className="text-[10px] text-slate-400 font-normal">({filtered.length})</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleSelectAllDiv(filtered, e)}
                                                            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            {allSelected ? 'Batal Semua' : 'Pilih Semua'}
                                                        </button>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="p-2 space-y-1">
                                                            {filtered.map(member => {
                                                                const isSelected = selectedMemberIds.has(member.id);
                                                                const isPrimary = member.id === project.owner_id;
                                                                const isCurrentUser = member.id === currentMemberId;

                                                                return (
                                                                    <div
                                                                        key={member.id}
                                                                        onClick={() => handleToggleMember(member.id)}
                                                                        className={`px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${
                                                                            isSelected ? 'bg-indigo-50/70 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center space-x-2 truncate">
                                                                            <div 
                                                                                className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                                                                                style={{ backgroundColor: member.color || '#6366f1' }}
                                                                            >
                                                                                {member.name.charAt(0)}
                                                                            </div>
                                                                            <span className="truncate">{member.name}</span>
                                                                            <span className="text-[10px] text-slate-400 font-normal">({member.position || member.role || 'Staff'})</span>
                                                                            {isPrimary && (
                                                                                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                                                                                    Pembuat
                                                                                </span>
                                                                            )}
                                                                            {isCurrentUser && (
                                                                                <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                                                                                    Anda
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => {}}
                                                                            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Tombol Simpan Peserta Baru */}
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={handleSaveSharingClick}
                                        className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        <i className="fa-solid fa-check"></i>
                                        <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan Peserta'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 3: HAPUS WORKSPACE (HANYA UNTUK PEMILIK)             */}
                    {/* ======================================================== */}
                    {activeTab === 'danger' && isOwner && (
                        <div className="space-y-4">
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                                <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5 mb-1">
                                    <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                                    Peringatan Hapus Proyek
                                </h4>
                                <p className="text-xs text-rose-700 leading-relaxed">
                                    Menghapus proyek <strong>"{project.name}"</strong> akan menghapus seluruh data tugas, jadwal, dan sub-kegiatan di dalamnya secara permanen. Tindakan ini tidak dapat dibatalkan.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (onDeleteProject) {
                                        onDeleteProject(project.id);
                                        onClose();
                                    }
                                }}
                                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-200 flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-trash-can"></i>
                                <span>Hapus Proyek Ini Secara Permanen</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[11px] text-slate-400">
                        {isOwner ? (
                            <span className="text-indigo-600 font-semibold flex items-center gap-1">
                                <i className="fa-solid fa-shield-check text-[10px]"></i>
                                Akses Pemilik Aktif
                            </span>
                        ) : (
                            <span>Akses Anggota (Hanya Lihat)</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-xs"
                    >
                        Tutup
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
