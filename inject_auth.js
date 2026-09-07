const fs = require('fs');
let code = fs.readFileSync('app/page.js', 'utf8');

// 1. Add LoginScreen component
const loginComponent = `
const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    
    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                alert('Pendaftaran berhasil! Jika pengaturan Supabase membutuhkan verifikasi, silakan cek email Anda. Jika tidak, silakan langsung Login.');
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-slate-200">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-lock text-3xl text-blue-600"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Autentikasi</h1>
                    <p className="text-slate-500 text-sm mt-1">Silakan masuk ke Dashboard Perusahaan</p>
                </div>
                
                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="admin@perusahaan.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                    >
                        {loading ? 'Memproses...' : (isSignUp ? 'Daftar' : 'Masuk')}
                    </button>
                </form>
                
                <div className="mt-6 text-center text-sm text-slate-500">
                    {isSignUp ? 'Sudah punya akun? ' : 'Belum punya akun? '}
                    <button 
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-blue-600 hover:underline font-medium"
                    >
                        {isSignUp ? 'Masuk' : 'Daftar sekarang'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function TaskManagerApp() {
`;
code = code.replace('export default function TaskManagerApp() {', loginComponent);

// 2. Auth State
const oldAuthState = "    const [isUnlocked, setIsUnlocked] = useState(false);";
const newAuthState = "    const [session, setSession] = useState(null);\n    const [userRole, setUserRole] = useState('Staff');";
code = code.replace(oldAuthState, newAuthState);

// 3. Auth UseEffect instead of Pin Unlock
const oldEffectRegex = /useEffect\(\(\) => \{[\s\S]*?const unlockUntil = Number\(localStorage\.getItem\(PIN_UNLOCK_KEY\) \|\| 0\);[\s\S]*?\}, \[\]\);/m;
const newAuthEffect = `useEffect(() => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Effect to map session user to a member in the database (or just set PIC)
    useEffect(() => {
        if (session && members.length > 0) {
            const userEmail = session.user.email;
            const matchedMember = members.find(m => m.email === userEmail);
            if (matchedMember) {
                setCurrentPicId(matchedMember.id);
                setUserRole(matchedMember.role);
            } else if (userEmail === 'abskdi.markom@gmail.com') {
                setUserRole('Super User');
            }
        }
    }, [session, members]);`;
code = code.replace(oldEffectRegex, newAuthEffect);

// 4. Update the fallback render check
const oldFallback = `    if (!isUnlocked) return (
        <PinGate
            members={members.length ? members : SEED_MEMBERS}
            selectedPicId={currentPicId}
            onPicChange={handleCurrentPicChange}
            onUnlock={(picId) => {
                handleCurrentPicChange(picId);
                setIsUnlocked(true);
            }}
        />
    );`;
const newFallback = `    if (!session) return <LoginScreen />;`;
code = code.replace(oldFallback, newFallback);

// 5. Add Logout Button to Header
const headerDiv = `<div className="w-full md:w-auto flex items-center bg-white/70 px-4 py-2 rounded-2xl shadow-sm border border-slate-200 backdrop-blur">`;
const newHeaderDiv = `<button onClick={() => supabase.auth.signOut()} className="mr-3 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100 flex items-center"><i className="fa-solid fa-right-from-bracket mr-1.5"></i>Keluar</button>\n                <div className="w-full md:w-auto flex items-center bg-white/70 px-4 py-2 rounded-2xl shadow-sm border border-slate-200 backdrop-blur">`;
code = code.replace(headerDiv, newHeaderDiv);

fs.writeFileSync('app/page.js', code);
