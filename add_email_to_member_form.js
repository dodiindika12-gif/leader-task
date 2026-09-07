const fs = require('fs');
let code = fs.readFileSync('app/page.js', 'utf8');

// 1. MembersTable Component Form Update
const oldFormState = "const [form, setForm] = useState({ name: '', role: 'Staff', division: 'Task ABS' });";
const newFormState = "const [form, setForm] = useState({ name: '', email: '', role: 'Staff', division: 'Task ABS' });";
code = code.replace(oldFormState, newFormState);

const oldHandleSubmit = `const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onAddMember(form);
        setForm({ name: '', role: 'Staff', division: 'Task ABS' });
        setIsAdding(false);
    };`;
const newHandleSubmit = `const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onAddMember(form);
        setForm({ name: '', email: '', role: 'Staff', division: 'Task ABS' });
        setIsAdding(false);
    };`;
code = code.replace(oldHandleSubmit, newHandleSubmit);

const oldNameInput = `                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nama</label>
                        <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-sm border-gray-300 rounded-lg" required />
                    </div>`;
const newInputs = `                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nama</label>
                        <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-sm border-gray-300 rounded-lg" required />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Email Auth (Opsional)</label>
                        <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full text-sm border-gray-300 rounded-lg" placeholder="email@perusahaan.com" />
                    </div>`;
code = code.replace(oldNameInput, newInputs);

// 2. handleAddMember in TaskManagerApp
const oldAddMemberArgs = "const { name, role, division } = memberData;";
const newAddMemberArgs = "const { name, email, role, division } = memberData;";
code = code.replace(oldAddMemberArgs, newAddMemberArgs);

const oldNewMember = `            name: name.trim(),
            division: division || 'Task ABS',`;
const newNewMember = `            name: name.trim(),
            email: email ? email.trim() : null,
            division: division || 'Task ABS',`;
code = code.replace(oldNewMember, newNewMember);

const oldInsert = `            id: newMember.id,
            name: newMember.name,
            position: newMember.position,`;
const newInsert = `            id: newMember.id,
            name: newMember.name,
            email: newMember.email,
            position: newMember.position,`;
code = code.replace(oldInsert, newInsert);

fs.writeFileSync('app/page.js', code);
