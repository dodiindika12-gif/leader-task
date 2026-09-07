const fs = require('fs');
const targetFile = 'app/page.js';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Update loadData in TaskManagerApp
content = content.replace(
    /const loadData = async \(\) => \{\s+const \[\s+\{ data: projectsData, error: projectsError \},\s+\{ data: membersData, error: membersError \},\s+\{ data: tasksData, error: tasksError \},\s+\{ data: shortcutsData, error: shortcutsError \},\s+\{ data: notesData, error: notesError \}\s+\] = await Promise\.all\(\[/,
    `const loadData = async () => {
            const [
                { data: projectsData, error: projectsError },
                { data: membersData, error: membersError },
                { data: tasksData, error: tasksError },
                { data: shortcutsData, error: shortcutsError },
                { data: notesData, error: notesError },
                { data: divsData }
            ] = await Promise.all([`
);

content = content.replace(
    /supabase\.from\('notes'\)\.select\('\*'\)\.order\('created_at', \{ ascending: false \}\)\s+\]\);/,
    `supabase.from('notes').select('*').order('created_at', { ascending: false }),
                supabase.from('divisions').select('*').order('created_at', { ascending: true })
            ]);`
);

content = content.replace(
    /const mappedMembers = membersData \|\| \[\];/,
    `const mappedMembers = membersData || [];
            if (divsData && divsData.length > 0) {
                setDivisionsList(divsData.map(d => d.name));
            }`
);

// 2. Add state divisionsList and handlers in TaskManagerApp
content = content.replace(
    /const \[activeProject, setActiveProject\] = useState\(''\);/,
    `const [activeProject, setActiveProject] = useState('');
    const [divisionsList, setDivisionsList] = useState(DIVISIONS);
    
    const handleToggleMemberStatus = async (id, currentStatus) => {
        const { error } = await supabase.from('members').update({ is_active: !currentStatus }).eq('id', id);
        if (error) {
            alert('Gagal update status: ' + error.message);
            return;
        }
        setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));
    };
    
    const handleAddDivision = async (name) => {
        const { error } = await supabase.from('divisions').insert([{ name }]);
        if (error) {
            alert('Gagal menambah divisi: ' + error.message + '. Pastikan Anda sudah menjalankan SQL membuat tabel divisions.');
            return;
        }
        setDivisionsList(prev => [...prev, name]);
    };
    `
);

// 3. Update the MembersTable component signature and render
const oldMembersTableRender = `<MembersTable members={filteredMembers} onAddMember={handleAddMember} onDeleteMember={handleDeleteMember} />`;
const newMembersTableRender = `<MembersTable members={filteredMembers} onAddMember={handleAddMember} onDeleteMember={handleDeleteMember} onToggleStatus={handleToggleMemberStatus} currentUser={session} divisionsList={divisionsList} onAddDivision={handleAddDivision} />`;
content = content.replace(oldMembersTableRender, newMembersTableRender);

// Also update it in the other places it might be rendered (like if view === 'members')
content = content.replace(
    /<MembersTable\s+members=\{filteredMembers\}\s+onAddMember=\{handleAddMember\}\s+onDeleteMember=\{handleDeleteMember\}\s*\/>/g,
    newMembersTableRender
);

// 4. Update the MembersTable component definition
const membersTableRegex = /const MembersTable = \(\{[^\}]+\}\) => \{[\s\S]+?return \([\s\S]+?\}\);\n\};\n\n/m;
const newMembersTable = `const MembersTable = ({ members, onAddMember, onDeleteMember, onToggleStatus, currentUser, divisionsList, onAddDivision }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [isDivManage, setIsDivManage] = useState(false);
    const [newDivName, setNewDivName] = useState('');
    
    // RBAC Logic
    const isSuperAdmin = currentUser?.role === 'Super User';
    const canAddMember = isSuperAdmin || ['SPV', 'Manager', 'Direksi'].includes(currentUser?.role);
    const lockedDivision = !isSuperAdmin ? currentUser?.division : null;
    
    const [form, setForm] = useState({ name: '', email: '', role: 'Staff', division: lockedDivision || 'Task ABS' });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onAddMember(form);
        setForm({ name: '', email: '', role: 'Staff', division: lockedDivision || 'Task ABS' });
        setIsAdding(false);
    };

    const handleAddDivSubmit = (e) => {
        e.preventDefault();
        if (!newDivName.trim()) return;
        onAddDivision(newDivName.trim());
        setNewDivName('');
        setIsDivManage(false);
    }

    return (
        <div className="bg-white/75 rounded-3xl border border-white/70 shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-in max-w-4xl backdrop-blur">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 tint-mint">
                <h3 className="font-semibold flex items-center"><i className="fa-solid fa-users mr-2"></i> Daftar Karyawan</h3>
                <div className="flex space-x-2">
                    {isSuperAdmin && (
                        <button onClick={() => {setIsDivManage(!isDivManage); setIsAdding(false);}} className="bg-white/80 text-emerald-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-white transition-colors shadow-sm flex items-center">
                            <i className="fa-solid fa-layer-group mr-1.5 text-xs"></i> Divisi
                        </button>
                    )}
                    {canAddMember && (
                        <button onClick={() => {setIsAdding(!isAdding); setIsDivManage(false);}} className="tint-mint-solid px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity shadow-sm flex items-center">
                            <i className="fa-solid fa-plus mr-1.5 text-xs"></i> Tambah
                        </button>
                    )}
                </div>
            </div>
            
            {isDivManage && isSuperAdmin && (
                <form onSubmit={handleAddDivSubmit} className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-end gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nama Divisi Baru</label>
                        <input type="text" value={newDivName} onChange={e => setNewDivName(e.target.value)} className="w-full text-sm border-gray-300 rounded-lg" required placeholder="Cth: Marketing" />
                    </div>
                    <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 h-[38px]">
                        Tambah Divisi
                    </button>
                </form>
            )}

            {isAdding && canAddMember && (
                <form onSubmit={handleSubmit} className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nama</label>
                        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full text-sm border-gray-300 rounded-lg" required />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Email Auth</label>
                        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full text-sm border-gray-300 rounded-lg" placeholder="email@perusahaan.com" />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Jabatan</label>
                        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full text-sm border-gray-300 rounded-lg">
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="w-40">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Divisi</label>
                        {isSuperAdmin ? (
                            <select value={form.division} onChange={e => setForm({ ...form, division: e.target.value })} className="w-full text-sm border-gray-300 rounded-lg">
                                {divisionsList.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        ) : (
                            <input type="text" value={lockedDivision} disabled className="w-full text-sm border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                        )}
                    </div>
                    <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 h-[38px]">
                        Simpan
                    </button>
                </form>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/60 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="p-3 font-medium w-16 text-center">Avatar</th>
                            <th className="p-3 font-medium">Nama Karyawan</th>
                            <th className="p-3 font-medium">Jabatan</th>
                            <th className="p-3 font-medium">Divisi</th>
                            <th className="p-3 font-medium text-center">Status</th>
                            {isSuperAdmin && <th className="p-3 font-medium w-24 text-right">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white/60 divide-y divide-slate-100">
                        {members.map(member => (
                            <tr key={member.id} className={\`hover:bg-gray-50 transition-colors group \${member.is_active === false ? 'opacity-60' : ''}\`}>
                                <td className="p-3 text-center">
                                    <div className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold mx-auto shadow-sm" style={{ backgroundColor: member.color || '#94a3b8' }}>
                                        {getInitials(member.name)}
                                    </div>
                                </td>
                                <td className="p-3 text-sm font-medium text-gray-900">{member.name}</td>
                                <td className="p-3 text-sm text-gray-600">{member.role || member.position}</td>
                                <td className="p-3 text-sm text-gray-600">
                                    <span className="bg-slate-100 px-2 py-1 rounded text-xs">{member.division || 'Umum'}</span>
                                </td>
                                <td className="p-3 text-sm text-center">
                                    <span className={\`px-2 py-1 rounded text-xs font-medium \${member.is_active === false ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}\`}>
                                        {member.is_active === false ? 'Non-aktif' : 'Aktif'}
                                    </span>
                                </td>
                                {isSuperAdmin && (
                                    <td className="p-3 text-sm text-right space-x-1">
                                        <button onClick={() => onToggleStatus(member.id, member.is_active !== false)} className="text-amber-500 hover:text-amber-600 p-1.5 rounded hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-opacity" title={member.is_active === false ? "Aktifkan" : "Non-aktifkan"}>
                                            <i className={\`fa-solid \${member.is_active === false ? 'fa-user-check' : 'fa-user-slash'}\`}></i>
                                        </button>
                                        <button onClick={() => onDeleteMember(member.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" title="Hapus Permanen">
                                            <i className="fa-regular fa-trash-can"></i>
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {members.length === 0 && (
                            <tr><td colSpan="6" className="p-8 text-center text-slate-400 text-sm">Belum ada karyawan.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

`;

content = content.replace(membersTableRegex, newMembersTable);

fs.writeFileSync(targetFile, content);
console.log('Update complete!');
