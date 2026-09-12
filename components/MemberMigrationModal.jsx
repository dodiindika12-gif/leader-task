'use strict';
import React, { useState, useMemo } from 'react';

export default function MemberMigrationModal({
    isOpen,
    onClose,
    sourceMember,
    members = [],
    projects = [],
    tasks = [],
    notes = [],
    schedules = [],
    divisions = [],
    departments = [],
    isDeleteMode = false,
    onExecuteMigration
}) {
    const [targetMemberId, setTargetMemberId] = useState('');
    const [actionType, setActionType] = useState('reassign'); // 'reassign' or 'unassign'
    const [migrateWorkspaces, setMigrateWorkspaces] = useState(true);
    const [migrateTasks, setMigrateTasks] = useState(true);
    const [migrateTodos, setMigrateTodos] = useState(true);
    const [migrateSchedules, setMigrateSchedules] = useState(true);
    const [migrateNotes, setMigrateNotes] = useState(true);
    const [migrateRoles, setMigrateRoles] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Available targets: other active members
    const candidateMembers = useMemo(() => {
        if (!sourceMember) return [];
        return members.filter(m => m.id !== sourceMember.id && m.is_active !== false);
    }, [members, sourceMember]);

    const filteredCandidates = useMemo(() => {
        if (!searchQuery.trim()) return candidateMembers;
        const q = searchQuery.toLowerCase();
        return candidateMembers.filter(m => 
            (m.name || '').toLowerCase().includes(q) || 
            (m.email || '').toLowerCase().includes(q) ||
            (m.division || '').toLowerCase().includes(q) ||
            (m.role || '').toLowerCase().includes(q)
        );
    }, [candidateMembers, searchQuery]);

    // Statistics owned by source member
    const stats = useMemo(() => {
        if (!sourceMember) return { workspaces: 0, tasks: 0, todos: 0, schedules: 0, notes: 0, orgRoles: [] };
        
        const ownedWorkspaces = projects.filter(p => p.owner_id === sourceMember.id);
        const picTasks = tasks.filter(t => t.picId === sourceMember.id);
        
        let todoCount = 0;
        tasks.forEach(t => {
            if (Array.isArray(t.todos)) {
                t.todos.forEach(todo => {
                    if ((todo.picId || todo.pic_id) === sourceMember.id) todoCount++;
                });
            }
        });

        const picSchedules = schedules.filter(s => s.pic_id === sourceMember.id);
        const memberNotes = notes.filter(n => (n.pic_id || n.author_id) === sourceMember.id);

        const orgRoles = [];
        divisions.forEach(d => {
            if (d.manager_id === sourceMember.id) {
                orgRoles.push(`Manajer Divisi ${d.name}`);
            }
        });
        departments.forEach(dept => {
            if (dept.spv_id === sourceMember.id) {
                orgRoles.push(`SPV Dept ${dept.name} (${dept.division_name})`);
            }
            if (dept.coordinator_id === sourceMember.id) {
                orgRoles.push(`Koordinator Dept ${dept.name} (${dept.division_name})`);
            }
        });

        return {
            workspaces: ownedWorkspaces.length,
            tasks: picTasks.length,
            todos: todoCount,
            schedules: picSchedules.length,
            notes: memberNotes.length,
            orgRoles
        };
    }, [sourceMember, projects, tasks, schedules, notes, divisions, departments]);

    if (!isOpen || !sourceMember) return null;

    const handleConfirm = async (overrideDelete = false) => {
        if (actionType === 'reassign' && !targetMemberId) {
            alert('Silakan pilih karyawan penerima pengalihan tugas & kepemilikan.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onExecuteMigration({
                sourceMemberId: sourceMember.id,
                targetMemberId: actionType === 'reassign' ? targetMemberId : null,
                isDelete: overrideDelete || isDeleteMode,
                options: {
                    migrateWorkspaces,
                    migrateTasks,
                    migrateTodos,
                    migrateSchedules,
                    migrateNotes,
                    migrateRoles
                }
            });
            onClose();
        } catch (err) {
            console.error('Migration error:', err);
            alert(`Terjadi kesalahan saat migrasi: ${err.message || err}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const targetMember = members.find(m => m.id === targetMemberId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden my-8 transition-all">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 text-lg shadow-inner">
                            <i className="fa-solid fa-arrow-right-arrow-left"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-wide">
                                {isDeleteMode ? 'Migrasi & Hapus Karyawan' : 'Migrasi Tugas & Kepemilikan'}
                            </h3>
                            <p className="text-xs text-indigo-200/80">
                                Alihkan workspace, tugas PIC, jadwal, dan wewenang organisasi ke karyawan lain.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    {/* Source Member Card */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-amber-500/20">
                                {sourceMember.name?.slice(0, 2).toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <span>{sourceMember.name}</span>
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                        Sumber
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500">{sourceMember.email}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                    {sourceMember.role || 'Karyawan'} • {sourceMember.division || 'Umum'} {sourceMember.department ? `(${sourceMember.department})` : ''}
                                </div>
                            </div>
                        </div>

                        {isDeleteMode && (
                            <div className="text-right">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200/60">
                                    <i className="fa-regular fa-trash-can"></i>
                                    Akan Dihapus
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-chart-pie text-indigo-500"></i>
                            Tanggung Jawab & Aset Yang Dimiliki Saat Ini
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                            <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-center">
                                <div className="text-lg font-bold text-indigo-700">{stats.workspaces}</div>
                                <div className="text-[11px] font-medium text-slate-600 mt-0.5">Workspace</div>
                            </div>
                            <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-100 text-center">
                                <div className="text-lg font-bold text-blue-700">{stats.tasks}</div>
                                <div className="text-[11px] font-medium text-slate-600 mt-0.5">Tugas PIC</div>
                            </div>
                            <div className="p-3 rounded-2xl bg-sky-50/50 border border-sky-100 text-center">
                                <div className="text-lg font-bold text-sky-700">{stats.todos}</div>
                                <div className="text-[11px] font-medium text-slate-600 mt-0.5">Checklist</div>
                            </div>
                            <div className="p-3 rounded-2xl bg-violet-50/50 border border-violet-100 text-center">
                                <div className="text-lg font-bold text-violet-700">{stats.schedules}</div>
                                <div className="text-[11px] font-medium text-slate-600 mt-0.5">Jadwal</div>
                            </div>
                            <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 text-center col-span-3 sm:col-span-1">
                                <div className="text-lg font-bold text-amber-700">{stats.notes}</div>
                                <div className="text-[11px] font-medium text-slate-600 mt-0.5">Notes/MoM</div>
                            </div>
                        </div>

                        {stats.orgRoles.length > 0 && (
                            <div className="mt-2.5 p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-start gap-2.5 text-xs text-emerald-800">
                                <i className="fa-solid fa-sitemap text-emerald-600 mt-0.5"></i>
                                <div>
                                    <span className="font-semibold">Jabatan Struktural: </span>
                                    <span>{stats.orgRoles.join(', ')}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Type Mode */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-route text-indigo-500"></i>
                            Pilihan Metode Migrasi
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className={`relative flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                actionType === 'reassign' 
                                    ? 'bg-indigo-50/40 border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm' 
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                                <input
                                    type="radio"
                                    name="actionType"
                                    value="reassign"
                                    checked={actionType === 'reassign'}
                                    onChange={() => setActionType('reassign')}
                                    className="accent-indigo-600"
                                />
                                <div>
                                    <div className="text-xs font-bold text-slate-800">Alihkan ke Karyawan Lain</div>
                                    <div className="text-[11px] text-slate-500">Pilih rekan kerja pengganti untuk menerima tugas & kepemilikan</div>
                                </div>
                            </label>

                            <label className={`relative flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                actionType === 'unassign' 
                                    ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-500/20 shadow-sm' 
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                                <input
                                    type="radio"
                                    name="actionType"
                                    value="unassign"
                                    checked={actionType === 'unassign'}
                                    onChange={() => setActionType('unassign')}
                                    className="accent-amber-600"
                                />
                                <div>
                                    <div className="text-xs font-bold text-slate-800">Kosongkan (Unassign)</div>
                                    <div className="text-[11px] text-slate-500">Lepaskan kepemilikan dan biarkan tugas tanpa PIC</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Target Member Selection (if reassign) */}
                    {actionType === 'reassign' && (
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700">
                                Pilih Karyawan Penerima / Pengganti <span className="text-rose-500">*</span>
                            </label>

                            {/* Search bar inside dropdown */}
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari nama, email, divisi, atau jabatan penerima..."
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                />
                            </div>

                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white shadow-inner">
                                {filteredCandidates.map(candidate => {
                                    const isSelected = targetMemberId === candidate.id;
                                    return (
                                        <div
                                            key={candidate.id}
                                            onClick={() => setTargetMemberId(candidate.id)}
                                            className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                                isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center ${
                                                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {candidate.name?.slice(0, 2).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                        <span>{candidate.name}</span>
                                                        <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                            {candidate.role || 'Member'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {candidate.email} • {candidate.division || 'Umum'}
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <i className="fa-solid fa-circle-check text-indigo-600 text-base"></i>
                                            )}
                                        </div>
                                    );
                                })}

                                {filteredCandidates.length === 0 && (
                                    <div className="p-6 text-center text-xs text-slate-400">
                                        Tidak ada karyawan yang cocok dengan pencarian.
                                    </div>
                                )}
                            </div>

                            {targetMember && (
                                <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex items-center gap-2 text-xs text-indigo-900 font-medium">
                                    <i className="fa-solid fa-circle-info text-indigo-600"></i>
                                    <span>
                                        Semua aset terpilih akan dialihkan ke <strong>{targetMember.name}</strong> ({targetMember.role} - {targetMember.division}).
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Granular Items To Migrate */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <i className="fa-solid fa-list-check text-indigo-500"></i>
                            Pilih Komponen Yang Ingin Dialihkan
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/70 hover:bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={migrateWorkspaces}
                                    onChange={e => setMigrateWorkspaces(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-semibold text-slate-700">Kepemilikan Workspace ({stats.workspaces})</div>
                                    <div className="text-[10px] text-slate-400">Memindahkan status owner proyek</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/70 hover:bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={migrateTasks}
                                    onChange={e => setMigrateTasks(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-semibold text-slate-700">Tugas Utama / PIC ({stats.tasks})</div>
                                    <div className="text-[10px] text-slate-400">Mengalihkan penanggung jawab tugas</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/70 hover:bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={migrateTodos}
                                    onChange={e => setMigrateTodos(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-semibold text-slate-700">Checklist Sub-tugas ({stats.todos})</div>
                                    <div className="text-[10px] text-slate-400">PIC pada item to-do list tugas</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/70 hover:bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={migrateSchedules}
                                    onChange={e => setMigrateSchedules(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-semibold text-slate-700">Jadwal & Meeting ({stats.schedules})</div>
                                    <div className="text-[10px] text-slate-400">Jadwal mingguan & worksheet</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/70 hover:bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={migrateNotes}
                                    onChange={e => setMigrateNotes(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-semibold text-slate-700">Catatan & MoM ({stats.notes})</div>
                                    <div className="text-[10px] text-slate-400">Notulen rapat & post-it notes</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/70 hover:bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={migrateRoles}
                                    onChange={e => setMigrateRoles(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                                />
                                <div>
                                    <div className="font-semibold text-slate-700">Jabatan Manajer/SPV ({stats.orgRoles.length})</div>
                                    <div className="text-[10px] text-slate-400">Posisi struktural organisasi</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
                    >
                        Batal
                    </button>

                    <div className="flex items-center gap-2.5">
                        {isDeleteMode && (
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => {
                                    if (confirm(`Yakin ingin menghapus ${sourceMember.name} TANPA migrasi? Semua tugas miliknya akan menjadi tanpa PIC.`)) {
                                        handleConfirm(true);
                                    }
                                }}
                                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 transition-colors"
                            >
                                Hapus Tanpa Migrasi
                            </button>
                        )}

                        <button
                            type="button"
                            disabled={isSubmitting || (actionType === 'reassign' && !targetMemberId)}
                            onClick={() => handleConfirm(false)}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                    <span>Memproses...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-arrow-right-arrow-left"></i>
                                    <span>
                                        {isDeleteMode
                                            ? actionType === 'reassign' ? 'Migrasikan & Hapus Karyawan' : 'Kosongkan & Hapus Karyawan'
                                            : actionType === 'reassign' ? 'Jalankan Migrasi Kepemilikan' : 'Kosongkan Tugas & Kepemilikan'
                                        }
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
