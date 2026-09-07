const fs = require('fs');
let code = fs.readFileSync('app/page.js', 'utf8');

// 1. MembersTable Refactor
const membersTableStart = 'const MembersTable = ({ members, onAddMember, onDeleteMember }) => {';
const membersTableEndRegex = /^\s*export default function TaskManagerApp\(\)/m;

const newMembersTable = `
const MembersTable = ({ members, onAddMember, onDeleteMember }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState({ name: '', role: 'Staff', division: 'Task ABS' });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onAddMember(form);
        setForm({ name: '', role: 'Staff', division: 'Task ABS' });
        setIsAdding(false);
    };

    return (
        <div className="bg-white/75 rounded-3xl border border-white/70 shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-in max-w-4xl backdrop-blur">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 tint-mint">
                <h3 className="font-semibold flex items-center"><i className="fa-solid fa-users mr-2"></i> Daftar Karyawan</h3>
                <button onClick={() => setIsAdding(!isAdding)} className="tint-mint-solid px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity shadow-sm flex items-center">
                    <i className="fa-solid fa-plus mr-1.5 text-xs"></i> Tambah Karyawan
                </button>
            </div>
            
            {isAdding && (
                <form onSubmit={handleSubmit} className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nama</label>
                        <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-sm border-gray-300 rounded-lg" required />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Jabatan</label>
                        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full text-sm border-gray-300 rounded-lg">
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="w-40">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Divisi</label>
                        <select value={form.division} onChange={e => setForm({...form, division: e.target.value})} className="w-full text-sm border-gray-300 rounded-lg">
                            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
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
                            <th className="p-3 font-medium w-24 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/60 divide-y divide-slate-100">
                        {members.map(member => (
                            <tr key={member.id} className="hover:bg-gray-50 transition-colors group">
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
                                <td className="p-3 text-sm text-right">
                                    <button onClick={() => onDeleteMember(member.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" title="Hapus">
                                        <i className="fa-regular fa-trash-can"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {members.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400 text-sm">Belum ada karyawan.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
`;

let startIndex = code.indexOf(membersTableStart);
let endIndex = code.indexOf('export default function TaskManagerApp()');
if (startIndex !== -1 && endIndex !== -1) {
    let oldComponent = code.substring(startIndex, endIndex);
    code = code.replace(oldComponent, newMembersTable + '\n\n');
}

// 2. Add global selectedDivision state
const appStateStart = "const [notes, setNotes] = useState([]);";
const appStateReplacement = appStateStart + "\n    const [globalDivision, setGlobalDivision] = useState('All');";
code = code.replace(appStateStart, appStateReplacement);

// 3. Update handleAddMember signature
const oldHandleAddMember = "const handleAddMember = async () => {\n        setDialog({\n            isOpen: true,\n            type: 'input',\n            message: 'Masukkan nama anggota baru:',\n            required: true,\n            placeholder: 'Nama Lengkap',\n            onConfirm: async (name) => {\n                if (!name || !name.trim()) return;\n                \n                setDialog(prev => ({ ...prev, isOpen: false, type: '', message: '' }));\n                setTimeout(async () => {\n                    setDialog({\n                        isOpen: true,\n                        type: 'input',\n                        message: `Posisi/Jabatan untuk ${name.trim()}:`,\n                        placeholder: 'Contoh: SPV, Manager, Staff',\n                        required: false,\n                        onConfirm: async (position) => {";

const newHandleAddMember = `const handleAddMember = async (memberData) => {
        const { name, role, division } = memberData;
        if (!name || !name.trim()) return;`;

// Let's just do a regex replace for handleAddMember
code = code.replace(/const handleAddMember = async \(\) => {[\s\S]*?const newMember = {/m, `const handleAddMember = async (memberData) => {
        const { name, role, division } = memberData;
        if (!name || !name.trim()) return;
        
        const newMember = {
            division: division || 'Task ABS',
            role: role || 'Staff',`);

// Remove the deeply nested closing brackets from the old handleAddMember prompt chain
code = code.replace(/setMembers\(prev => \[\.\.\.prev, newMember\]\);\n\s*};\n\s*}\);\n\s*}\);\n\s*}, 300\);\n\s*}\);\n\s*};/m, 
    "setMembers(prev => [...prev, newMember]);\n    };");


// 4. Update Header for Global Filter
const headerStart = `<header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">`;
const headerReplacement = `<header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="w-full md:w-auto flex items-center bg-white/70 px-4 py-2 rounded-2xl shadow-sm border border-slate-200 backdrop-blur">
                    <i className="fa-solid fa-building text-slate-400 mr-3"></i>
                    <select 
                        value={globalDivision}
                        onChange={(e) => setGlobalDivision(e.target.value)}
                        className="bg-transparent text-sm font-semibold text-slate-800 outline-none w-full md:w-48 appearance-none cursor-pointer"
                    >
                        <option value="All">Semua Divisi (Perusahaan)</option>
                        {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down text-slate-400 text-xs ml-2 pointer-events-none"></i>
                </div>`;
code = code.replace(headerStart, headerStart.replace('md:items-end', 'md:items-center') + '\n' + headerReplacement.substring(headerReplacement.indexOf('<div className="w-full')));


fs.writeFileSync('app/page.js', code);
