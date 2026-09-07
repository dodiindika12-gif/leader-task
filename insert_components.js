const fs = require('fs');

const componentsCode = `

const TaskSummary = ({ stats }) => (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
            <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wider">To Do</p><p className="text-2xl font-bold text-slate-800">{stats.todo}</p></div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><i className="fa-solid fa-list text-slate-400"></i></div>
        </div>
        <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
            <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wider">In Progress</p><p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p></div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><i className="fa-solid fa-spinner text-blue-500"></i></div>
        </div>
        <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
            <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Done</p><p className="text-2xl font-bold text-emerald-600">{stats.done}</p></div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-check text-emerald-500"></i></div>
        </div>
        <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
            <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Tasks</p><p className="text-2xl font-bold text-slate-800">{stats.total}</p></div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><i className="fa-solid fa-layer-group text-slate-400"></i></div>
        </div>
    </div>
);

const TaskControls = ({ members, searchQuery, setSearchQuery, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, picFilter, setPicFilter, sortMode, setSortMode, onReset }) => (
    <div className="flex flex-wrap items-center gap-3 mb-6 bg-white/60 p-3 rounded-2xl shadow-sm border border-white/50 backdrop-blur-sm">
        <div className="flex-1 min-w-[200px] relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari tugas..." className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">Semua Status</option>
            {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">Semua Prioritas</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={picFilter} onChange={(e) => setPicFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]">
            <option value="All">Semua PIC</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="manual">Manual Sort</option>
            <option value="deadline">Urut Deadline</option>
            <option value="priority">Urut Prioritas</option>
        </select>
        <button onClick={onReset} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors" title="Reset Filters"><i className="fa-solid fa-rotate-right"></i></button>
    </div>
);

const AbsCalendar = ({ tasks, projects, members, currentPicId, onEdit }) => {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const displayFirstDay = firstDay === 0 ? 6 : firstDay - 1; 

    const monthName = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const days = [];
    for (let i = 0; i < displayFirstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const getTasksForDate = (date) => {
        if (!date) return [];
        const d = new Date(year, month, date);
        const dateStr = d.toISOString().split('T')[0];
        return tasks.filter(t => t.deadline === dateStr);
    };

    return (
        <div className="bg-white/80 rounded-3xl shadow-xl border border-slate-200/60 p-6 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <i className="fa-regular fa-calendar-days mr-3 text-blue-500"></i>
                    Kalender Deadline
                </h2>
                <div className="flex items-center space-x-4">
                    <button onClick={prevMonth} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <span className="font-semibold text-slate-700 text-lg min-w-[150px] text-center">{monthName}</span>
                    <button onClick={nextMonth} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden flex-1 border border-slate-200">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                    <div key={d} className="bg-slate-50 p-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
                ))}
                {days.map((d, i) => {
                    const cellTasks = getTasksForDate(d);
                    const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                    return (
                        <div key={i} className={\`bg-white p-2 min-h-[100px] flex flex-col \${isToday ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/10' : ''}\`}>
                            {d && <span className={\`text-sm font-medium mb-2 \${isToday ? 'text-blue-600' : 'text-slate-600'}\`}>{d}</span>}
                            <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
                                {cellTasks.map(task => {
                                    const proj = projects.find(p => p.id === task.projectId);
                                    if (proj && proj.showInCalendar === false) return null;
                                    const isDone = task.status === 'Done';
                                    return (
                                        <div 
                                            key={task.id} 
                                            onClick={() => onEdit(task)}
                                            className={\`text-xs p-1.5 rounded-lg truncate cursor-pointer transition-colors \${isDone ? 'bg-emerald-50 text-emerald-600 line-through opacity-70' : 'hover:brightness-95'}\`}
                                            style={!isDone ? { backgroundColor: \`\${proj?.color || '#cbd5e1'}25\`, color: proj?.color || '#475569' } : {}}
                                            title={task.title}
                                        >
                                            {task.title}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MainDashboard = ({ tasks, projects, members, shortcuts, currentPicId, onEdit, onQuickAddTask }) => {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };
    
    const currMember = members.find(m => m.id === currentPicId);
    const myTasks = tasks.filter(t => t.picId === currentPicId && t.status !== 'Done');
    const myTodos = [];
    tasks.forEach(t => {
        if (t.status === 'Done') return;
        t.todos.forEach(todo => {
            if (!todo.done && todo.picId === currentPicId) {
                myTodos.push({ ...todo, parentTaskTitle: t.title, taskId: t.id });
            }
        });
    });

    const upcomingTasks = [...myTasks].sort((a,b) => (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99')).slice(0, 5);

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden flex items-center justify-between">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">{getGreeting()}, {currMember ? currMember.name : 'Leader'}! 👋</h1>
                    <p className="text-blue-100">Anda memiliki {myTasks.length} tugas aktif dan {myTodos.length} sub-tugas (todo) tertunda.</p>
                </div>
                <div className="hidden sm:block relative z-10 text-right">
                    <div className="text-5xl font-bold opacity-90">{new Date().getDate()}</div>
                    <div className="text-xl opacity-75">{new Date().toLocaleDateString('id-ID', { month: 'long' })}</div>
                </div>
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute right-40 -bottom-20 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/80 rounded-3xl p-6 shadow-sm border border-slate-200/60">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800"><i className="fa-solid fa-thumbtack text-rose-500 mr-2"></i>Tugas Mendatang Saya</h3>
                    </div>
                    {upcomingTasks.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">Tidak ada tugas mendesak. Kerja bagus! 🎉</div>
                    ) : (
                        <div className="space-y-3">
                            {upcomingTasks.map(t => (
                                <div key={t.id} onClick={() => onEdit(t)} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors border border-slate-100">
                                    <div className="flex items-center truncate pr-4">
                                        <div className={\`w-2.5 h-2.5 rounded-full mr-3 shrink-0 \${PRIORITY_COLORS[t.priority]}\`}></div>
                                        <div className="truncate">
                                            <p className="text-sm font-semibold text-slate-700 truncate">{t.title}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { day:'numeric', month:'short' }) : 'No Deadline'}</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-xs px-2 py-1 bg-white rounded-lg border border-slate-200 font-medium text-slate-500 shadow-sm">{t.status}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white/80 rounded-3xl p-6 shadow-sm border border-slate-200/60 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-4"><i className="fa-solid fa-list-check text-emerald-500 mr-2"></i>My Sub-Tasks (To-Do)</h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[300px]">
                        {myTodos.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">Semua sub-tugas telah selesai!</div>
                        ) : (
                            myTodos.map((todo, i) => (
                                <div key={i} className="flex items-start p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                    <i className="fa-regular fa-square text-emerald-400 mt-0.5 mr-3"></i>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">{todo.title}</p>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">Dari tugas: {todo.parentTaskTitle}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const NotesPage = ({ notes, members, onAddNote, onUpdateNote, onDeleteNote, currentPicId, onCreateTaskFromMeeting }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [formData, setFormData] = useState({ type: 'Issue', title: '', content: '', issue: '', decision: '', picId: currentPicId, deadline: '' });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingNote) {
            onUpdateNote({ ...formData, id: editingNote.id });
        } else {
            onAddNote(formData);
        }
        setIsFormOpen(false);
        setEditingNote(null);
        setFormData({ type: 'Issue', title: '', content: '', issue: '', decision: '', picId: currentPicId, deadline: '' });
    };

    const openEdit = (note) => {
        setEditingNote(note);
        setFormData({ ...note });
        setIsFormOpen(true);
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <i className="fa-regular fa-clipboard mr-3 text-emerald-500"></i> Issues & Meetings
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Catat masalah, ide, atau hasil rapat.</p>
                </div>
                <button onClick={() => { setIsFormOpen(true); setEditingNote(null); setFormData({ type: 'Issue', title: '', content: '', issue: '', decision: '', picId: currentPicId, deadline: '' }); }} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm shadow-emerald-200 transition-colors">
                    <i className="fa-solid fa-plus mr-2"></i>Catatan Baru
                </button>
            </div>

            {isFormOpen && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-700">{editingNote ? 'Edit Catatan' : 'Buat Catatan Baru'}</h3>
                        <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-lg"></i></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipe</label>
                            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full text-sm rounded-xl border-slate-200 bg-slate-50 px-3 py-2">
                                <option value="Issue">Issue / Masalah</option>
                                <option value="Meeting">Meeting / Rapat</option>
                                <option value="Idea">Idea / Ide</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Judul / Topik</label>
                            <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full text-sm rounded-xl border-slate-200 bg-slate-50 px-3 py-2" placeholder="Judul..." />
                        </div>
                    </div>
                    {formData.type === 'Meeting' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Masalah / Agenda</label>
                                <textarea rows="3" value={formData.issue} onChange={(e) => setFormData({...formData, issue: e.target.value})} className="w-full text-sm rounded-xl border-slate-200 bg-slate-50 p-3" placeholder="Apa yang dibahas..."></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Keputusan / Solusi</label>
                                <textarea rows="3" value={formData.decision} onChange={(e) => setFormData({...formData, decision: e.target.value})} className="w-full text-sm rounded-xl border-slate-200 bg-slate-50 p-3" placeholder="Keputusan rapat..."></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Deadline / Follow Up</label>
                                <input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} className="w-full text-sm rounded-xl border-slate-200 bg-slate-50 px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">PIC Action</label>
                                <select value={formData.picId} onChange={(e) => setFormData({...formData, picId: e.target.value})} className="w-full text-sm rounded-xl border-slate-200 bg-slate-50 px-3 py-2">
                                    <option value="">Pilih PIC...</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Detail / Isi</label>
                            <textarea required rows="4" value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} className="w-full text-sm rounded-xl border-slate-200 bg-slate-50 p-3" placeholder="Tuliskan detail..."></textarea>
                        </div>
                    )}
                    <div className="flex justify-end space-x-2">
                        <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">{editingNote ? 'Update' : 'Simpan'}</button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pb-8 custom-scrollbar">
                {notes.map(note => {
                    const pic = members.find(m => m.id === note.picId);
                    return (
                        <div key={note.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/60 relative group flex flex-col">
                            <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                                <button onClick={() => openEdit(note)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"><i className="fa-solid fa-pen text-xs"></i></button>
                                <button onClick={() => { if(confirm('Hapus catatan?')) onDeleteNote(note.id); }} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"><i className="fa-solid fa-trash-can text-xs"></i></button>
                            </div>
                            <div className="flex items-center space-x-2 mb-3">
                                <span className={\`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider \${note.type==='Meeting' ? 'bg-purple-100 text-purple-600' : note.type==='Idea' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}\`}>{note.type}</span>
                                <span className="text-xs text-slate-400">{new Date(note.createdAt).toLocaleDateString('id-ID')}</span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg mb-2 pr-16 leading-tight">{note.title}</h4>
                            
                            {note.type === 'Meeting' ? (
                                <div className="space-y-3 flex-1">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Agenda / Masalah</p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.issue}</p>
                                    </div>
                                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                                        <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Keputusan</p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.decision}</p>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto pt-4">
                                        <div className="flex items-center">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white mr-2" style={{backgroundColor: pic?.color || '#cbd5e1'}}>{pic?.name.charAt(0) || '?'}</div>
                                            <span className="text-xs font-medium text-slate-600">{pic?.name || 'Tidak ada PIC'}</span>
                                        </div>
                                        {note.deadline && <span className="text-xs font-medium text-slate-500"><i className="fa-regular fa-clock mr-1"></i>{new Date(note.deadline).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</span>}
                                    </div>
                                    {note.decision && !note.isDone && (
                                        <button onClick={() => onCreateTaskFromMeeting(note)} className="w-full mt-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-xl border border-blue-100 transition-colors">
                                            <i className="fa-solid fa-arrow-turn-up mr-2"></i>Jadikan Task Baru
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 whitespace-pre-wrap flex-1">{note.content}</p>
                            )}
                        </div>
                    );
                })}
                {notes.length === 0 && <div className="col-span-full py-12 text-center text-slate-400 font-medium bg-white/40 rounded-3xl border border-white/50 border-dashed">Belum ada catatan.</div>}
            </div>
        </div>
    );
};

const ShortcutLauncher = ({ shortcuts, onAddShortcut, onDeleteShortcut, onToggleShortcutFavorite }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState({ title: '', url: '', icon: 'fa-link', color: '#2563eb', isFavorite: true });

    const handleSubmit = (e) => {
        e.preventDefault();
        onAddShortcut(form);
        setIsAdding(false);
        setForm({ title: '', url: '', icon: 'fa-link', color: '#2563eb', isFavorite: true });
    };

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-white/55 text-slate-500 hover:bg-white hover:text-blue-600 shadow-sm transition">
                <i className="fa-solid fa-rocket text-[11px]"></i>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 top-12 mt-1 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-fade-in">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-sm">Aplikasi Cepat</h3>
                            <button onClick={() => setIsAdding(!isAdding)} className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors">
                                {isAdding ? 'Batal' : '+ Tambah'}
                            </button>
                        </div>
                        {isAdding && (
                            <form onSubmit={handleSubmit} className="p-4 border-b border-slate-100 bg-white space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Nama Aplikasi</label>
                                    <input required type="text" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="w-full text-xs rounded-xl bg-slate-50 border-slate-200 p-2" placeholder="Cth: Notion, Canva..." />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">URL / Link</label>
                                    <input required type="url" value={form.url} onChange={e=>setForm({...form, url: e.target.value})} className="w-full text-xs rounded-xl bg-slate-50 border-slate-200 p-2" placeholder="https://..." />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Ikon (FontAwesome)</label>
                                        <input type="text" value={form.icon} onChange={e=>setForm({...form, icon: e.target.value})} className="w-full text-xs rounded-xl bg-slate-50 border-slate-200 p-2" placeholder="fa-link" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Warna</label>
                                        <input type="color" value={form.color} onChange={e=>setForm({...form, color: e.target.value})} className="w-full h-8 rounded-xl bg-slate-50 border-slate-200 p-0 cursor-pointer" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-slate-800 text-white text-xs font-bold py-2 rounded-xl">Simpan</button>
                            </form>
                        )}
                        <div className="p-2 grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {shortcuts.map(s => (
                                <div key={s.id} className="relative group p-2 flex flex-col items-center justify-center text-center rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => window.open(s.url, '_blank')}>
                                    <div className="absolute top-1 right-1 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteShortcut(s.id); }} className="w-5 h-5 rounded bg-red-100 text-red-500 text-[10px] flex items-center justify-center hover:bg-red-200"><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl mb-2 flex items-center justify-center shadow-sm text-white text-lg" style={{backgroundColor: s.color || '#cbd5e1'}}>
                                        <i className={\`fa-solid \${s.icon || 'fa-link'}\`}></i>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-600 truncate w-full px-1">{s.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

`;

const targetFile = 'app/page.js';
let content = fs.readFileSync(targetFile, 'utf8');

if (!content.includes('const MainDashboard =')) {
    content = content.replace('export default function TaskManagerApp() {', componentsCode + '\nexport default function TaskManagerApp() {');
    fs.writeFileSync(targetFile, content);
    console.log('Injected components!');
} else {
    console.log('Components already exist.');
}
