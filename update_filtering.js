const fs = require('fs');
let code = fs.readFileSync('app/page.js', 'utf8');

// 1. Update HandleAddProject
const addProjectStart = 'const handleAddProject = async () => {';
const addProjectReplacement = `const handleAddProject = async () => {
        openDialog({
            type: 'prompt',
            message: 'Nama Project Baru:',
            placeholder: 'Contoh: Event Q3, Design System...',
            required: true,
            onConfirm: async (name) => {
                const targetDivision = globalDivision === 'All' ? 'Task ABS' : globalDivision;
                const newProject = {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    isPinned: false,
                    color: getDefaultProjectColor(projects.length),
                    showInCalendar: false,
                    division: targetDivision
                };

                const { error } = await supabase.from('projects').insert({
                    id: newProject.id,
                    name: newProject.name,
                    is_pinned: newProject.isPinned,
                    color: newProject.color,
                    show_in_calendar: newProject.showInCalendar,
                    division: newProject.division
                });

                if (error) {
                    console.error('Error adding project:', error);
                    alert('Gagal menambah project: ' + error.message);
                    return;
                }
                setProjects(prev => [...prev, newProject]);
                setActiveProject(newProject.id);
            }
        });
    };`;
code = code.replace(/const handleAddProject = async \(\) => {[\s\S]*?setActiveProject\(newProject\.id\);\n\s*}\n\s*}\);\n\s*};/m, addProjectReplacement);


// 2. Add derived filtered state
// Find the search/filter states and inject derived filtered lists below them.
const stateFilterEnd = "const [isSidebarOpen, setIsSidebarOpen] = useState(false);";
const stateFilterReplacement = stateFilterEnd + `
    // Filtered global lists based on Division
    const filteredMembers = members.filter(m => globalDivision === 'All' || m.division === globalDivision);
    const filteredProjects = projects.filter(p => globalDivision === 'All' || p.division === globalDivision);
    const filteredTasks = tasks.filter(t => {
        if (globalDivision === 'All') return true;
        const project = projects.find(p => p.id === t.projectId);
        return project && project.division === globalDivision;
    });
    // Ensure active project belongs to the current division if division is changed
    useEffect(() => {
        if (globalDivision !== 'All' && activeProject) {
            const currentProj = projects.find(p => p.id === activeProject);
            if (currentProj && currentProj.division !== globalDivision) {
                const firstProjInDiv = filteredProjects[0];
                setActiveProject(firstProjInDiv ? firstProjInDiv.id : '');
            }
        }
    }, [globalDivision, activeProject, projects, filteredProjects]);
`;
code = code.replace(stateFilterEnd, stateFilterReplacement);

// 3. Update all render usages of members, projects, tasks to their filtered counterparts
// (A bit dangerous globally, so I will target specific component props)
// e.g. <MembersTable members={members} -> <MembersTable members={filteredMembers}
code = code.replace(/<MembersTable members=\{members\}/g, '<MembersTable members={filteredMembers}');
code = code.replace(/members={members}/g, 'members={filteredMembers}');
// Replace project mapping in sidebar
code = code.replace(/projects\.map\(\(project\)/g, 'filteredProjects.map((project)');
code = code.replace(/projects\.map\(project/g, 'filteredProjects.map(project');
// Replace task calculation
code = code.replace(/const projectTasks = tasks\.filter\(/g, 'const projectTasks = filteredTasks.filter(');
code = code.replace(/const upcomingTasks = tasks\.filter\(/g, 'const upcomingTasks = filteredTasks.filter(');

fs.writeFileSync('app/page.js', code);
