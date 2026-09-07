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
    onUpdateName
}) {
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'sharing', 'danger'
    const [projectName, setProjectName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#2563eb');
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
    const [searchMember, setSearchMember] = useState('');
    const [expandedDivs, setExpandedDivs] = useState({});

    const isSuperUser = session?.role === 'Super User';
    const canShare = isSuperUser || project?.owner_id === session?.memberId;

    useEffect(() => {
        if (project && isOpen) {
            setProjectName(project.name || '');
            setSelectedColor(project.color || '#2563eb');

            const currentAccess = (projectAccess || [])
                .filter(pa => pa.project_id === project.id)
                .map(pa => pa.member_id);
            setSelectedMemberIds(new Set(currentAccess));
            setActiveTab('general');
        }
    }, [project?.id, isOpen]);

    useEffect(() => {
        if (project?.color) {
            setSelectedColor(project.color);
        }
    }, [project?.color]);

    if (!isOpen || !project) return null;

    // Filter available members (exclude current user)
    const availableMembers = members.filter(m => m.id !== session?.memberId);
    
    // Group members by division
    const groupedMembers = availableMembers.reduce((acc, m) => {
        const div = m.division || 'Tanpa Divisi';
        if (!acc[div]) acc[div] = [];
        acc[div].push(m);
        return acc;
    }, {});

    const handleToggleMember = (memberId) => {
        const next = new Set(selectedMemberIds);
        if (next.has(memberId)) next.delete(memberId);
        else next.add(memberId);
        setSelectedMemberIds(next);
    };

    const handleSelectAllDiv = (divMembers, e) => {
        if (e?.stopPropagation) e.stopPropagation();
        const next = new Set(selectedMemberIds);
        const allSelected = divMembers.every(m => next.has(m.id));
        divMembers.forEach(m => {
            if (allSelected) next.delete(m.id);
            else next.add(m.id);
        });
        setSelectedMemberIds(next);
    };

    const toggleDiv = (div) => {
        setExpandedDivs(prev => ({ ...prev, [div]: !prev[div] }));
    };

    const handleSaveSharingClick = () => {
        if (onSaveSharing) {
            onSaveSharing(project.id, Array.from(selectedMemberIds));
        }
    };

    const handleSaveNameSubmit = (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (onUpdateName && projectName.trim() && projectName.trim() !== project.name) {
            onUpdateName(project.id, projectName.trim());
        }
    };

    const handleColorClick = (color, e) => {
        if (e?.stopPropagation) e.stopPropagation();
        setSelectedColor(color);
        if (onUpdateColor) {
            onUpdateColor(project.id, color);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose}></div>
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden border border-white/80 z-10 flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center space-x-3 min-w-0">
                        <div 
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg shadow-sm shrink-0 transition-colors"
                            style={{ backgroundColor: selectedColor }}
                        >
                            <i className="fa-solid fa-folder-gear"></i>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 truncate">
                                Pengaturan Proyek
                            </h3>
                            <p className="text-xs text-slate-500 truncate font-medium">
                                {project.name}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-6 bg-white gap-2 pt-2">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                            activeTab === 'general' 
                                ? 'border-indigo-600 text-indigo-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <i className="fa-solid fa-sliders"></i>
                        <span>Umum & Warna</span>
                    </button>

                    {canShare && (
                        <button
                            onClick={() => setActiveTab('sharing')}
                            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                                activeTab === 'sharing' 
                                    ? 'border-indigo-600 text-indigo-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <i className="fa-solid fa-share-nodes"></i>
                            <span>Hak Akses Tim</span>
                            {selectedMemberIds.size > 0 && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full font-bold">
                                    {selectedMemberIds.size}
                                </span>
                            )}
                        </button>
                    )}

                    <button
                        onClick={() => setActiveTab('danger')}
                        className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                            activeTab === 'danger' 
                                ? 'border-rose-600 text-rose-600' 
                                : 'border-transparent text-slate-500 hover:text-rose-600'
                        }`}
                    >
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <span>Hapus</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    {/* TAB 1: GENERAL */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            {/* Project Name (Rename) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Nama Proyek
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Nama project..."
                                    />
                                    {onUpdateName && projectName.trim() !== project.name && (
                                        <button
                                            type="button"
                                            onClick={handleSaveNameSubmit}
                                            className="px-3.5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition"
                                        >
                                            Ubah
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                    Pilih Warna Proyek
                                </label>
                                <div className="grid grid-cols-6 gap-2.5">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => handleColorClick(c)}
                                            style={{ backgroundColor: c }}
                                            className={`h-9 rounded-xl transition-transform flex items-center justify-center text-white shadow-xs ${
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
                                <div className="mt-3 flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <input
                                        type="color"
                                        value={selectedColor}
                                        onChange={(e) => handleColorClick(e.target.value)}
                                        className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                                    />
                                    <span className="text-xs text-slate-600 font-medium">Atur Warna Kustom:</span>
                                    <span className="text-xs font-mono font-bold text-slate-800 ml-auto">{selectedColor}</span>
                                </div>
                            </div>

                            {/* Toggle Cards: Calendar & Pin */}
                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                {/* Calendar Toggle */}
                                <div 
                                    onClick={() => onToggleCalendar && onToggleCalendar(project.id, !project.showInCalendar)}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
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
                                            <p className="text-[11px] text-slate-500 mt-0.5">Task proyek ini akan muncul di jadwal kalender</p>
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
                                    onClick={() => onTogglePin && onTogglePin(project.id)}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
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
                                            <p className="text-[11px] text-slate-500 mt-0.5">Menempatkan proyek ini di posisi paling atas</p>
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

                    {/* TAB 2: SHARING */}
                    {activeTab === 'sharing' && canShare && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-800">Hak Akses Anggota</p>
                                    <p className="text-[11px] text-slate-500">Pilih siapa saja yang dapat mengakses proyek ini.</p>
                                </div>
                                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                                    {selectedMemberIds.size} dipilih
                                </span>
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="text"
                                    placeholder="Cari anggota tim..."
                                    value={searchMember}
                                    onChange={(e) => setSearchMember(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            {/* Members grouped by division */}
                            <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {Object.entries(groupedMembers).map(([division, divMembers]) => {
                                    const filtered = divMembers.filter(m => 
                                        m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
                                        (m.position || '').toLowerCase().includes(searchMember.toLowerCase())
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

                            <button
                                type="button"
                                onClick={handleSaveSharingClick}
                                className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                            >
                                Simpan Hak Akses
                            </button>
                        </div>
                    )}

                    {/* TAB 3: DANGER */}
                    {activeTab === 'danger' && (
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
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
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
