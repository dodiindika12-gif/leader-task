"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import TimelineView from '../components/TimelineView';
import MinuteOfMeeting from '../components/MinuteOfMeeting';
import ProjectSettingsModal from '../components/ProjectSettingsModal';


// Default Data when localStorage/DB is empty
const SEED_PROJECTS = [
    { id: 'p1', name: 'Personal', isPinned: false, color: '#2563eb' },
    { id: 'p2', name: 'Work', isPinned: true, color: '#16a34a' }
];

const DEFAULT_PROJECT_COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0f766e', '#dc2626', '#4f46e5', '#0891b2'];

const SEED_MEMBERS = [
    { id: 'm1', name: 'Dodi', position: 'SPV Task ABS', color: '#ef4444' },
    { id: 'm2', name: 'Heru', position: 'CSR', color: '#f97316' },
    { id: 'm3', name: 'Hardyan', position: 'Content', color: '#eab308' },
    { id: 'm4', name: 'Ary', position: 'DM', color: '#22c55e' },
    { id: 'm5', name: 'Ona', position: 'Design', color: '#14b8a6' },
];

const SEED_TASKS = [
    { id: '1', projectId: 'p2', title: 'Evaluasi strategi operasional Beauty Kendari Q3', status: 'In Progress', priority: 'High', deadline: '2026-07-05', createdAt: '2026-06-20T08:00:00Z', picId: 'm1' },
    { id: '2', projectId: 'p1', title: 'Setup workflow n8n di server CasaOS', status: 'To Do', priority: 'Medium', deadline: '2026-07-02', createdAt: '2026-06-22T09:00:00Z', picId: 'm3' },
    { id: '3', projectId: 'p1', title: 'Siapkan perlengkapan harian untuk Kia', status: 'To Do', priority: 'High', deadline: '', createdAt: '2026-06-25T10:00:00Z', picId: '' },
    { id: '4', projectId: 'p2', title: 'Draft materi presentasi CV Mitra Makmur Mandiri', status: 'Done', priority: 'Low', deadline: '2026-06-25', createdAt: '2026-06-24T11:00:00Z', picId: 'm5' }
];

const SEED_SHORTCUTS = [
    { id: 's1', title: 'Portal BA', url: 'https://portalba.abskdi.biz.id/', icon: 'BA', color: '#2563eb', isFavorite: true },
    { id: 's2', title: 'Portal Promo', url: 'https://promo.abskdi.biz.id/', icon: 'PR', color: '#db2777', isFavorite: true },
    { id: 's3', title: 'Meta Ads', url: 'https://adsmanager.facebook.com/', icon: 'MA', color: '#0ea5e9', isFavorite: true },
    { id: 's4', title: 'Instagram', url: 'https://www.instagram.com/beauty.kendari/', icon: 'IG', color: '#e11d48', isFavorite: true },
    { id: 's5', title: 'TikTok', url: 'https://www.tiktok.com/', icon: 'TT', color: '#111827', isFavorite: true },
    { id: 's6', title: 'Google Drive', url: 'https://drive.google.com/', icon: 'DR', color: '#16a34a', isFavorite: true },
    { id: 's7', title: 'Google Sheets', url: 'https://docs.google.com/spreadsheets/', icon: 'SH', color: '#15803d', isFavorite: false },
    { id: 's8', title: 'Canva', url: 'https://www.canva.com/', icon: 'CV', color: '#7c3aed', isFavorite: false },
    { id: 's9', title: 'Shopee', url: 'https://seller.shopee.co.id/', icon: 'SP', color: '#ea580c', isFavorite: false }
];

const SEED_NOTES = [];

const DIVISIONS = ['IT', 'HCGA', 'Marcomm', 'Finance', 'Accounting', 'Distribution', 'Operations', 'Business Project', 'Logistic', 'Buyer', 'Audit'];
const ROLES = ['Staff', 'Kordinator', 'SPV', 'Manager', 'Direksi'];

const PIN_UNLOCK_KEY = 'task_abs_tools_pin_unlock_until';
const CURRENT_PIC_KEY = 'task_abs_tools_current_pic_id';
const PIN_UNLOCK_DURATION = 12 * 60 * 60 * 1000;

const PRIORITIES = {
    'High': { color: 'text-pink-700 bg-pink-100', icon: 'fa-angles-up' },
    'Medium': { color: 'text-orange-700 bg-orange-100', icon: 'fa-angle-up' },
    'Low': { color: 'text-sky-700 bg-sky-100', icon: 'fa-angle-down' }
};

const COLUMNS = ['To Do', 'In Progress', 'Done'];
const ALL_DIVISI_LABEL = 'All Semua Divisi';

const COLUMN_TINTS = {
    'To Do': { chip: 'tint-sky', header: 'bg-sky-50/70', drop: 'bg-sky-50/40 border-sky-100' },
    'In Progress': { chip: 'tint-lavender', header: 'bg-violet-50/70', drop: 'bg-violet-50/40 border-violet-100' },
    'Done': { chip: 'tint-mint', header: 'bg-emerald-50/70', drop: 'bg-emerald-50/40 border-emerald-100' }
};

const getGreeting = (date = new Date()) => {
    const hour = date.getHours();
    if (hour >= 4 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
};

const ProgressRing = ({ percent = 0, size = 32, stroke = 4, color = '#7c3aed', trackColor = '#ede9fe' }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, percent));
    const offset = circumference - (clamped / 100) * circumference;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
            />
        </svg>
    );
};

const KENDARI_LAT = -3.9450;
const KENDARI_LON = 122.4989;

const WEATHER_CODE_MAP = {
    0: { label: 'Cerah', icon: 'fa-sun' },
    1: { label: 'Cerah Berawan', icon: 'fa-cloud-sun' },
    2: { label: 'Berawan Sebagian', icon: 'fa-cloud-sun' },
    3: { label: 'Berawan', icon: 'fa-cloud' },
    45: { label: 'Berkabut', icon: 'fa-smog' },
    48: { label: 'Berkabut', icon: 'fa-smog' },
    51: { label: 'Gerimis Ringan', icon: 'fa-cloud-rain' },
    53: { label: 'Gerimis', icon: 'fa-cloud-rain' },
    55: { label: 'Gerimis Lebat', icon: 'fa-cloud-rain' },
    61: { label: 'Hujan Ringan', icon: 'fa-cloud-showers-heavy' },
    63: { label: 'Hujan', icon: 'fa-cloud-showers-heavy' },
    65: { label: 'Hujan Lebat', icon: 'fa-cloud-showers-heavy' },
    80: { label: 'Hujan Lokal', icon: 'fa-cloud-showers-heavy' },
    81: { label: 'Hujan Lokal Lebat', icon: 'fa-cloud-showers-heavy' },
    82: { label: 'Hujan Sangat Lebat', icon: 'fa-cloud-showers-heavy' },
    95: { label: 'Badai Petir', icon: 'fa-bolt' },
    96: { label: 'Badai Petir', icon: 'fa-bolt' },
    99: { label: 'Badai Petir', icon: 'fa-bolt' }
};

const getWeatherInfo = (code) => WEATHER_CODE_MAP[code] || { label: 'Tidak diketahui', icon: 'fa-cloud' };

const WeatherWidget = () => {
    const [state, setState] = useState({ status: 'loading', current: null, tempMax: null, tempMin: null });

    useEffect(() => {
        let cancelled = false;

        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${KENDARI_LAT}&longitude=${KENDARI_LON}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FMakassar`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                if (!data?.current) {
                    setState({ status: 'error', current: null, tempMax: null, tempMin: null });
                    return;
                }
                setState({
                    status: 'ready',
                    current: data.current,
                    tempMax: data.daily?.temperature_2m_max?.[0] ?? null,
                    tempMin: data.daily?.temperature_2m_min?.[0] ?? null
                });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'error', current: null, tempMax: null, tempMin: null });
            });

        return () => { cancelled = true; };
    }, []);

    if (state.status === 'loading') {
        return (
            <div className="flex items-center gap-2 text-white/70 text-sm px-4 py-2.5">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Memuat cuaca...</span>
            </div>
        );
    }

    if (state.status === 'error') {
        return (
            <div className="flex items-center gap-2 text-white/70 text-sm px-4 py-2.5">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>Cuaca tidak tersedia</span>
            </div>
        );
    }

    const info = getWeatherInfo(state.current.weather_code);
    const temp = Math.round(state.current.temperature_2m);

    return (
        <div className="flex items-center gap-3 bg-white/15 rounded-2xl px-4 py-2.5">
            <i className={`fa-solid ${info.icon} text-3xl`}></i>
            <div>
                <div className="text-xs text-white/70">Kendari</div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold leading-none">{temp}°C</span>
                    <span className="text-xs text-white/80">{info.label}</span>
                </div>
                {(state.tempMax !== null && state.tempMin !== null) && (
                    <div className="text-[10px] text-white/60 mt-0.5">H: {Math.round(state.tempMax)}° L: {Math.round(state.tempMin)}°</div>
                )}
            </div>
        </div>
    );
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const getTodoProgress = (task) => {
    const todos = Array.isArray(task.todos) ? task.todos : [];
    return {
        total: todos.length,
        done: todos.filter(todo => todo.done).length
    };
};

const getDefaultProjectColor = (index = 0) => DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];

const isDefaultCalendarProject = (name = '') => ['promo', 'event'].includes(name.trim().toLowerCase());

const hexToRgba = (hex, alpha = 1) => {
    const cleanHex = (hex || '#2563eb').replace('#', '');
    if (cleanHex.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getDateOnly = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date;
};

const getDeadlineState = (deadline, status) => {
    if (!deadline || status === 'Done') return 'normal';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = getDateOnly(deadline);
    if (!dueDate) return 'normal';
    if (dueDate < today) return 'overdue';
    if (dueDate.getTime() === today.getTime()) return 'today';
    return 'normal';
};

const formatDeadline = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatInputDate = (dateStr, withTime = false) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    if (withTime) {
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const toDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    nextDate.setHours(0, 0, 0, 0);
    return nextDate;
};

const getWeekEnd = (date) => {
    const weekEnd = new Date(date);
    const daysUntilSunday = 7 - weekEnd.getDay();
    weekEnd.setDate(weekEnd.getDate() + (daysUntilSunday === 7 ? 0 : daysUntilSunday));
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
};

const PasswordModal = ({ isOpen, onClose, onSave, isForced }) => {
    const [newPass, setNewPass] = useState('');
    const [repeatPass, setRepeatPass] = useState('');
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPass !== repeatPass) {
            alert('Password Baru dan Ulangi Password tidak cocok!');
            return;
        }
        setSaving(true);
        const success = await onSave(newPass);
        setSaving(false);
        if (success) {
            setNewPass('');
            setRepeatPass('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={!isForced ? onClose : undefined}></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-scale-in">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">{isForced ? 'Buat Password Baru' : 'Ganti Password'}</h3>
                    {!isForced && (
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-lg"></i></button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {isForced && (
                        <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-xs border border-amber-200">
                            Anda masih menggunakan password bawaan. Demi keamanan, mohon ubah password Anda sekarang.
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Password Baru</label>
                        <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full text-sm border-gray-300 rounded-lg" required minLength="6" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Ulangi Password</label>
                        <input type="password" value={repeatPass} onChange={e=>setRepeatPass(e.target.value)} className="w-full text-sm border-gray-300 rounded-lg" required minLength="6" />
                    </div>
                    <button type="submit" disabled={saving} className="w-full bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {saving ? 'Menyimpan...' : 'Simpan Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const TaskEditModal = ({ task, projects, members, foldersList = ['General'], onCreateFolder, isOpen, onClose, onSave, session = null }) => {
    const loggedInMemberId = session?.memberId || '';
    const [editedTask, setEditedTask] = useState(task || {});
    const [todoDraft, setTodoDraft] = useState('');
    const [todoPicDraft, setTodoPicDraft] = useState(loggedInMemberId);
    const [todoDeadlineDraft, setTodoDeadlineDraft] = useState('');
    const [isAddingNewFolder, setIsAddingNewFolder] = useState(false);
    const [newFolderDraft, setNewFolderDraft] = useState('');

    useEffect(() => {
        if (task) {
            setEditedTask({
                ...task,
                folder: task.folder || 'General',
                todos: Array.isArray(task.todos)
                    ? task.todos.map(todo => ({ 
                        ...todo, 
                        picId: todo.picId || todo.pic_id || '',
                        deadline: todo.deadline || todo.due_date || ''
                    }))
                    : []
            });
            setTodoDraft('');
            setTodoPicDraft(loggedInMemberId);
            setTodoDeadlineDraft('');
            setIsAddingNewFolder(false);
            setNewFolderDraft('');
        }
    }, [task, loggedInMemberId]);

    if (!isOpen || !task) return null;

    const handleChange = (field, value) => setEditedTask({ ...editedTask, [field]: value });
    const todos = Array.isArray(editedTask.todos) ? editedTask.todos : [];
    const todoProgress = getTodoProgress(editedTask);

    const updateTodos = (nextTodos) => handleChange('todos', nextTodos);

    const handleAddTodo = () => {
        const title = todoDraft.trim();
        if (!title) return;

        updateTodos([
            ...todos,
            {
                id: crypto.randomUUID(),
                title,
                done: false,
                picId: (todoPicDraft !== undefined && todoPicDraft !== null) ? todoPicDraft : (loggedInMemberId || ''),
                deadline: todoDeadlineDraft || ''
            }
        ]);
        setTodoDraft('');
        setTodoDeadlineDraft('');
        setTodoPicDraft(loggedInMemberId);
    };

    const handleToggleTodo = (id) => {
        updateTodos(todos.map(todo => todo.id === id ? { ...todo, done: !todo.done } : todo));
    };

    const handleUpdateTodoTitle = (id, title) => {
        updateTodos(todos.map(todo => todo.id === id ? { ...todo, title } : todo));
    };

    const handleUpdateTodoPic = (id, picId) => {
        updateTodos(todos.map(todo => todo.id === id ? { ...todo, picId } : todo));
    };

    const handleUpdateTodoDeadline = (id, deadline) => {
        updateTodos(todos.map(todo => todo.id === id ? { ...todo, deadline } : todo));
    };

    const handleDeleteTodo = (id) => {
        updateTodos(todos.filter(todo => todo.id !== id));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/95 rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-white/80 backdrop-blur">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white/70">
                    <div className="text-sm font-medium text-gray-500 flex items-center gap-2.5">
                        <span className="flex items-center">
                            <i className="fa-regular fa-file-lines mr-2"></i> {task.isNew ? 'Tugas Baru' : 'Detail Tugas'}
                        </span>
                        {!task.isNew && task.createdAt && (
                            <span className="text-[11px] text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60 flex items-center gap-1 font-normal" title={`Waktu input: ${new Date(task.createdAt).toLocaleString('id-ID')}`}>
                                <i className="fa-regular fa-clock text-[10px]"></i>
                                Input: {formatInputDate(task.createdAt, true)}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <input
                        type="text"
                        autoFocus
                        value={editedTask.title || ''}
                        onChange={(e) => handleChange('title', e.target.value)}
                        className="w-full text-2xl font-bold text-gray-800 placeholder-gray-300 border-none focus:outline-none focus:ring-0 mb-6 bg-transparent"
                        placeholder="Nama Tugas..."
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-4 mb-2">
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-500 mb-1 flex items-center"><i className="fa-regular fa-folder mr-1.5 w-4 text-center"></i> Project</label>
                            <select
                                value={editedTask.projectId || ''}
                                onChange={(e) => handleChange('projectId', e.target.value)}
                                className="text-sm border border-slate-200 rounded-2xl p-2.5 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none bg-white cursor-pointer"
                            >
                                <option value="">-- Pilih Project --</option>
                                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-500 mb-1 flex items-center"><i className="fa-solid fa-folder-tree mr-1.5 w-4 text-center text-indigo-500"></i> Folder / Section</label>
                            <select
                                value={editedTask.folder || 'General'}
                                onChange={(e) => {
                                    if (e.target.value === '__NEW__') {
                                        setIsAddingNewFolder(true);
                                    } else {
                                        handleChange('folder', e.target.value);
                                    }
                                }}
                                className="text-sm border border-slate-200 rounded-2xl p-2.5 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none bg-white cursor-pointer"
                            >
                                {(foldersList || ['General']).map(f => (
                                    <option key={f} value={f}>📁 {f}</option>
                                ))}
                                <option value="__NEW__">+ Buat Folder Baru...</option>
                            </select>
                            {isAddingNewFolder && (
                                <div className="flex items-center gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="Nama folder baru..."
                                        value={newFolderDraft}
                                        onChange={(e) => setNewFolderDraft(e.target.value)}
                                        className="text-xs border border-indigo-200 rounded-xl px-3 py-1.5 flex-1 outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const name = newFolderDraft.trim();
                                            if (name) {
                                                if (onCreateFolder) onCreateFolder(name);
                                                handleChange('folder', name);
                                                setNewFolderDraft('');
                                                setIsAddingNewFolder(false);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700"
                                    >
                                        Tambah
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsAddingNewFolder(false); setNewFolderDraft(''); }}
                                        className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs"
                                    >
                                        Batal
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-500 mb-1 flex items-center"><i className="fa-solid fa-signal mr-1.5 w-4 text-center"></i> Status</label>
                            <select
                                value={editedTask.status || 'To Do'}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="text-sm border border-slate-200 rounded-2xl p-2.5 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none bg-white cursor-pointer"
                            >
                                {COLUMNS.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-500 mb-1 flex items-center"><i className="fa-regular fa-flag mr-1.5 w-4 text-center"></i> Prioritas</label>
                            <select
                                value={editedTask.priority || 'Medium'}
                                onChange={(e) => handleChange('priority', e.target.value)}
                                className="text-sm border border-slate-200 rounded-2xl p-2.5 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none bg-white cursor-pointer"
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-500 mb-1 flex items-center"><i className="fa-regular fa-user mr-1.5 w-4 text-center"></i> Penanggung Jawab (PIC)</label>
                            <select
                                value={editedTask.picId || ''}
                                onChange={(e) => handleChange('picId', e.target.value)}
                                className="text-sm border border-slate-200 rounded-2xl p-2.5 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none bg-white cursor-pointer"
                            >
                                <option value="">{ALL_DIVISI_LABEL}</option>
                                {members.filter(m => m.is_active !== false || m.id === editedTask.picId).map(m => <option key={m.id} value={m.id}>{m.name} ({m.position || m.role})</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-500 mb-1 flex items-center"><i className="fa-regular fa-calendar-plus mr-1.5 w-4 text-center"></i> Tanggal Mulai</label>
                            <input
                                type="date"
                                value={editedTask.startDate || editedTask.start_date || ''}
                                onChange={(e) => handleChange('startDate', e.target.value)}
                                className="text-sm border border-slate-200 rounded-2xl p-2.5 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none bg-white cursor-pointer w-full"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-gray-500 mb-1 flex items-center"><i className="fa-regular fa-calendar-check mr-1.5 w-4 text-center"></i> Tenggat Waktu (Deadline)</label>
                            <input
                                type="date"
                                value={editedTask.deadline || ''}
                                onChange={(e) => handleChange('deadline', e.target.value)}
                                className="text-sm border border-slate-200 rounded-2xl p-2.5 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none bg-white cursor-pointer w-full"
                            />
                        </div>
                    </div>

                    <div className="mt-6 border-t border-gray-100 pt-5">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold text-gray-800 flex items-center">
                                <i className="fa-regular fa-square-check mr-2 text-gray-500"></i>
                                To Do Sub-Kegiatan
                            </label>
                            <span className="text-xs text-gray-500">{todoProgress.done}/{todoProgress.total} selesai</span>
                        </div>

                        <div className="space-y-2 mb-3">
                            {todos.map(todo => (
                                <div key={todo.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:bg-slate-100/60 transition-colors group">
                                    <input
                                        type="checkbox"
                                        checked={!!todo.done}
                                        onChange={() => handleToggleTodo(todo.id)}
                                        className="w-4 h-4 rounded border-gray-300 accent-purple-600 flex-shrink-0 cursor-pointer ml-1"
                                        title="Tandai Selesai"
                                    />
                                    <input
                                        type="text"
                                        value={todo.title}
                                        onChange={(e) => handleUpdateTodoTitle(todo.id, e.target.value)}
                                        className={`flex-1 min-w-[150px] text-sm border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 ${todo.done ? 'text-gray-400 line-through bg-slate-50' : 'text-gray-800 bg-white'}`}
                                        placeholder="Nama sub-kegiatan..."
                                    />
                                    <div className="flex items-center gap-1 shrink-0" title="Deadline sub-kegiatan">
                                        <input
                                            type="date"
                                            value={todo.deadline || ''}
                                            onChange={(e) => handleUpdateTodoDeadline(todo.id, e.target.value)}
                                            className="text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none bg-white text-slate-600 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 cursor-pointer"
                                            title="Deadline sub-kegiatan"
                                        />
                                    </div>
                                    <select
                                        value={todo.picId || ''}
                                        onChange={(e) => handleUpdateTodoPic(todo.id, e.target.value)}
                                        className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none bg-white text-slate-700 min-w-[120px] max-w-[150px] focus:border-violet-300 focus:ring-2 focus:ring-violet-100 shrink-0 cursor-pointer"
                                        title="PIC sub-kegiatan"
                                    >
                                        <option value="">Tanpa PIC</option>
                                        {members.filter(m => m.is_active !== false || m.id === todo.picId).map(member => (
                                            <option key={member.id} value={member.id}>
                                                {member.name} {member.id === loggedInMemberId ? '(Saya)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteTodo(todo.id)}
                                        className="w-8 h-8 rounded-xl text-gray-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 transition cursor-pointer"
                                        title="Hapus sub-kegiatan"
                                    >
                                        <i className="fa-regular fa-trash-can text-xs"></i>
                                    </button>
                                </div>
                            ))}
                            {todos.length === 0 && (
                                <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl px-3 py-4 text-center bg-slate-50/50">
                                    Belum ada sub-kegiatan.
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                            <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                <i className="fa-solid fa-plus text-[10px] text-purple-600"></i>
                                <span>Tambah Sub-Kegiatan Baru</span>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                    type="text"
                                    value={todoDraft}
                                    onChange={(e) => setTodoDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddTodo();
                                        }
                                    }}
                                    placeholder="Nama sub-kegiatan..."
                                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 bg-white"
                                />
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 shrink-0" title="Deadline sub-kegiatan">
                                    <i className="fa-regular fa-calendar text-slate-400 text-xs ml-1"></i>
                                    <input
                                        type="date"
                                        value={todoDeadlineDraft}
                                        onChange={(e) => setTodoDeadlineDraft(e.target.value)}
                                        className="text-xs text-slate-700 bg-transparent outline-none cursor-pointer"
                                        title="Deadline sub-kegiatan"
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 min-w-[130px] max-w-full sm:max-w-[150px] shrink-0" title="Pilih PIC sub-kegiatan (Default: Anda)">
                                    <i className="fa-regular fa-user text-slate-400 text-xs ml-1"></i>
                                    <select
                                        value={todoPicDraft}
                                        onChange={(e) => setTodoPicDraft(e.target.value)}
                                        className="text-xs text-slate-700 bg-transparent outline-none cursor-pointer w-full"
                                        title="PIC sub-kegiatan (Default: Anda)"
                                    >
                                        <option value="">Tanpa PIC</option>
                                        {members.filter(m => m.is_active !== false).map(member => (
                                            <option key={member.id} value={member.id}>
                                                {member.name} {member.id === loggedInMemberId ? '(Saya)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddTodo}
                                    disabled={!todoDraft.trim()}
                                    className="px-4 py-2 text-xs font-semibold bg-slate-950 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-xs"
                                >
                                    Tambah
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
                        Batal
                    </button>
                    <button
                        onClick={async () => {
                            if (!editedTask.projectId) return;
                            const saved = await onSave(editedTask);
                            if (saved !== false) onClose();
                        }}
                        disabled={!editedTask.title?.trim() || !editedTask.projectId}
                        className="px-5 py-2 text-sm font-medium text-white bg-slate-950 rounded-2xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Simpan Tugas
                    </button>
                </div>
            </div>
        </div>
    );
};

const CustomDialog = ({ dialog, closeDialog }) => {
    const [inputValue, setInputValue] = useState(dialog.defaultValue || '');
    const [inputPosValue, setInputPosValue] = useState('');

    useEffect(() => {
        setInputValue(dialog.defaultValue || '');
        setInputPosValue('');
    }, [dialog.isOpen, dialog.defaultValue]);

    if (!dialog.isOpen) return null;

    const handleConfirm = () => {
        if (dialog.type === 'prompt' || dialog.type === 'member_prompt') {
            if (!inputValue.trim() && dialog.required) return;
            if (dialog.type === 'member_prompt') {
                if (!inputPosValue.trim() && dialog.required) return;
                dialog.onConfirm(inputValue, inputPosValue);
            } else {
                dialog.onConfirm(inputValue);
            }
        } else {
            dialog.onConfirm();
        }
        closeDialog();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{dialog.message}</h3>

                {(dialog.type === 'prompt' || dialog.type === 'member_prompt') && (
                    <div className="space-y-3 mb-4">
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (dialog.type !== 'member_prompt' || inputPosValue.trim()) && handleConfirm()}
                            placeholder={dialog.placeholder || "Ketik di sini..."}
                            autoFocus
                        />
                        {dialog.type === 'member_prompt' && (
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
                                value={inputPosValue}
                                onChange={(e) => setInputPosValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && handleConfirm()}
                                placeholder="Posisi / Jabatan (misal: Content Writer)"
                            />
                        )}
                    </div>
                )}
                <div className="flex justify-end space-x-3 mt-2">
                    <button onClick={closeDialog} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        Batal
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={
                            (dialog.type === 'prompt' && dialog.required && !inputValue.trim()) ||
                            (dialog.type === 'member_prompt' && dialog.required && (!inputValue.trim() || !inputPosValue.trim()))
                        }
                        className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {dialog.type === 'prompt' || dialog.type === 'member_prompt' ? 'Simpan' : 'Ya, Lanjutkan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TaskCard = ({ task, members, projects = [], onEdit, onDelete, onUpdatePriority, onUpdateStatus, onUpdateTask, isListView = false }) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title);
    const [isEditingDeadline, setIsEditingDeadline] = useState(false);
    const [editedDeadline, setEditedDeadline] = useState(task.deadline || '');
    const [isEditingPic, setIsEditingPic] = useState(false);

    useEffect(() => {
        setEditedTitle(task.title);
        setEditedDeadline(task.deadline || '');
    }, [task.title, task.deadline]);

    const handleTitleSubmit = () => {
        setIsEditingTitle(false);
        if (editedTitle.trim() !== task.title && editedTitle.trim() !== '') {
            onUpdateTask({ ...task, title: editedTitle.trim() });
        } else {
            setEditedTitle(task.title);
        }
    };

    const handleDeadlineSubmit = () => {
        setIsEditingDeadline(false);
        if (editedDeadline !== task.deadline) {
            onUpdateTask({ ...task, deadline: editedDeadline });
        }
    };

    const toggleStatusDone = (e) => {
        e.stopPropagation();
        const newStatus = e.target.checked ? 'Done' : 'To Do';
        onUpdateStatus(task.id, newStatus);
    };

    const togglePriority = (e) => {
        e.stopPropagation();
        const levels = ['Low', 'Medium', 'High'];
        const next = levels[(levels.indexOf(task.priority) + 1) % levels.length];
        onUpdatePriority(task.id, next);
    };

    const handleDragStart = (e) => {
        e.dataTransfer.setData('taskId', task.id);
        setTimeout(() => e.target.classList.add('opacity-50', 'dragging'), 0);
    };
    const handleDragEnd = (e) => {
        e.target.classList.remove('opacity-50', 'dragging');
    };

    const deadlineState = getDeadlineState(task.deadline, task.status);
    const isOverdue = deadlineState === 'overdue';
    const isDueToday = deadlineState === 'today';
    const isDone = task.status === 'Done';
    const pic = members.find(m => m.id === task.picId);
    const todoProgress = getTodoProgress(task);
    const project = projects.find(p => p.id === task.projectId);
    const accentColor = project?.color || '#7c3aed';

    if (isListView) {
        return (
            <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors group" style={{ borderLeft: `3px solid ${accentColor}` }}>
                <td className="p-3">
                    <div className="flex items-start space-x-3">
                        <input
                            type="checkbox"
                            checked={isDone}
                            onChange={toggleStatusDone}
                            className="mt-1 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer accent-purple-600 flex-shrink-0"
                            title="Tandai Selesai"
                        />
                        <div className="flex flex-col flex-1">
                            {isEditingTitle ? (
                                <input
                                    type="text"
                                    autoFocus
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    onBlur={handleTitleSubmit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleTitleSubmit();
                                        if (e.key === 'Escape') { setEditedTitle(task.title); setIsEditingTitle(false); }
                                    }}
                                    className="text-sm font-medium text-gray-900 border-b-2 border-purple-500 outline-none bg-transparent p-0 w-full max-w-md"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                                    className={`text-left text-sm font-medium hover:bg-gray-100 rounded px-1 -ml-1 truncate max-w-md transition-colors ${isDone ? 'text-gray-400 line-through' : 'text-gray-900 hover:text-purple-600'}`}
                                >
                                    {task.title}
                                </button>
                            )}
                            <div className="mt-1.5 flex items-center flex-wrap gap-1.5">
                                {isEditingDeadline ? (
                                    <input
                                        type="date"
                                        autoFocus
                                        value={editedDeadline}
                                        onChange={(e) => setEditedDeadline(e.target.value)}
                                        onBlur={handleDeadlineSubmit}
                                        className="text-[11px] border border-purple-500 rounded px-1 outline-none h-6"
                                    />
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsEditingDeadline(true); }}
                                        className={`text-[11px] font-medium flex items-center hover:bg-gray-200 px-1 py-0.5 rounded -ml-1 transition-colors ${isOverdue ? 'text-red-500' : isDueToday ? 'text-orange-600' : 'text-gray-500'}`}
                                    >
                                        <i className="fa-regular fa-calendar mr-1.5"></i>
                                        {task.deadline ? formatDeadline(task.deadline) : 'Set Deadline'}
                                        {isOverdue && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">Overdue</span>}
                                        {isDueToday && <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Hari Ini</span>}
                                    </button>
                                )}
                                {task.folder && task.folder !== 'General' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/70">
                                        <i className="fa-solid fa-folder text-[9px]"></i> {task.folder}
                                    </span>
                                )}
                                {task.createdAt && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/70" title={`Tanggal input: ${formatInputDate(task.createdAt, true)}`}>
                                        <i className="fa-regular fa-clock text-[9px]"></i>
                                        <span>Input: {formatInputDate(task.createdAt)}</span>
                                    </span>
                                )}
                            </div>
                            {todoProgress.total > 0 && (
                                <div className="mt-1 text-[11px] text-gray-500 flex items-center">
                                    <i className="fa-regular fa-square-check mr-1"></i>
                                    {todoProgress.done}/{todoProgress.total} sub-kegiatan
                                </div>
                            )}
                        </div>
                    </div>
                </td>
                <td className="p-3 text-sm text-gray-600">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs border border-gray-200">{task.status}</span>
                </td>
                <td className="p-3 text-sm">
                    <button onClick={togglePriority} className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center space-x-1 ${PRIORITIES[task.priority].color} hover:opacity-80 transition-opacity w-fit`}>
                        <i className={`fa-solid ${PRIORITIES[task.priority].icon}`}></i>
                        <span>{task.priority}</span>
                    </button>
                </td>
                <td className="p-3 text-sm relative">
                    {isEditingPic ? (
                        <select
                            autoFocus
                            value={task.picId || ''}
                            onChange={(e) => {
                                onUpdateTask({ ...task, picId: e.target.value });
                                setIsEditingPic(false);
                            }}
                            onBlur={() => setIsEditingPic(false)}
                            className="text-xs border border-purple-500 rounded p-1 outline-none bg-white"
                        >
                            <option value="">{ALL_DIVISI_LABEL}</option>
                            {members.filter(m => m.is_active !== false || m.id === task.picId).map(member => (
                                <option key={member.id} value={member.id}>{member.name} ({member.position})</option>
                            ))}
                        </select>
                    ) : (
                        <button onClick={(e) => { e.stopPropagation(); setIsEditingPic(true); }} className="flex items-center space-x-2 focus:outline-none hover:bg-gray-100 p-1 rounded -ml-1 transition-colors" title={pic ? `${pic.name} (${pic.position})` : 'Set PIC'}>
                            {pic ? (
                                <>
                                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center">{pic.name[0]}</span>
                                    <span className="truncate max-w-[100px]">{pic.name}</span>
                                </>
                            ) : (
                                <span className="text-gray-400 italic text-xs">Set PIC</span>
                            )}
                        </button>
                    )}
                </td>
                <td className="p-3 text-right">
                    <button onClick={() => onEdit(task)} className="text-gray-400 hover:text-purple-600 p-1 rounded hover:bg-gray-100 mr-1"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                    <button onClick={() => onDelete(task.id)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100"><i className="fa-regular fa-trash-can text-xs"></i></button>
                </td>
            </tr>
        );
    }

    return (
        <div
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`bg-white/80 p-3.5 rounded-3xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing group mb-3 relative flex flex-col min-h-[110px] backdrop-blur ${isDone ? 'border-white/60 bg-white/45' : 'border-white/75'}`}
            style={{ borderLeft: `3px solid ${accentColor}` }}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={togglePriority} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITIES[task.priority].color} hover:opacity-80 flex items-center`}>
                        <i className={`fa-solid ${PRIORITIES[task.priority].icon} mr-1`}></i>
                        {task.priority}
                    </button>
                    {task.folder && task.folder !== 'General' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                            <i className="fa-solid fa-folder text-[9px]"></i>
                            <span className="truncate max-w-[100px]">{task.folder}</span>
                        </span>
                    )}
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onDelete(task.id)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50"><i className="fa-regular fa-trash-can text-xs"></i></button>
                </div>
            </div>

            <div className="flex items-start mb-3">
                <input
                    type="checkbox"
                    checked={isDone}
                    onChange={toggleStatusDone}
                    className="mt-1.5 mr-2 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer accent-purple-600 flex-shrink-0"
                    title="Tandai Selesai"
                />
                <div className="flex-1 w-full overflow-hidden">
                    {isEditingTitle ? (
                        <textarea
                            autoFocus
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            onBlur={handleTitleSubmit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTitleSubmit(); }
                                if (e.key === 'Escape') { setEditedTitle(task.title); setIsEditingTitle(false); }
                            }}
                            className="text-sm font-medium text-gray-800 leading-snug border-b-2 border-purple-500 outline-none bg-transparent p-0 w-full resize-none overflow-hidden"
                            rows={editedTitle.length > 30 ? 2 : 1}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <h4
                            className={`text-sm font-medium leading-snug cursor-text hover:bg-gray-100 rounded px-1 py-0.5 -ml-1 transition-colors ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                            onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                        >
                            {task.title}
                        </h4>
                    )}
                </div>
            </div>

            {todoProgress.total > 0 && (
                <div className="mb-3 ml-6 flex items-center gap-2">
                    <div className="relative flex items-center justify-center shrink-0">
                        <ProgressRing percent={Math.round((todoProgress.done / todoProgress.total) * 100)} size={26} stroke={3} color="#059669" trackColor="#d1fae5" />
                    </div>
                    <span className="text-[10px] text-gray-500"><i className="fa-regular fa-square-check mr-1"></i>{todoProgress.done}/{todoProgress.total} sub-kegiatan</span>
                </div>
            )}

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center mt-auto">
                <div className="flex items-center">
                    {isEditingDeadline ? (
                        <input
                            type="date"
                            autoFocus
                            value={editedDeadline}
                            onChange={(e) => setEditedDeadline(e.target.value)}
                            onBlur={handleDeadlineSubmit}
                            className="text-[10px] border border-purple-500 rounded px-1 py-0.5 outline-none w-24 h-6"
                        />
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsEditingDeadline(true); }}
                            className={`text-[10px] font-medium flex items-center bg-gray-50 px-1.5 py-1 rounded border hover:bg-gray-100 transition-colors ${isOverdue ? 'border-red-200 text-red-600 bg-red-50' : isDueToday ? 'border-orange-200 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500'}`}
                        >
                            <i className="fa-regular fa-calendar mr-1"></i> {task.deadline ? formatDeadline(task.deadline) : 'Set Deadline'}
                            {isOverdue && <span className="ml-1 font-bold">Overdue</span>}
                            {isDueToday && <span className="ml-1 font-bold">Hari Ini</span>}
                        </button>
                    )}
                    {task.createdAt && (
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 bg-slate-50 px-1.5 py-1 rounded border border-slate-200/60 ml-1" title={`Tanggal input: ${formatInputDate(task.createdAt, true)}`}>
                            <i className="fa-regular fa-clock text-[9px]"></i>
                            <span>{formatInputDate(task.createdAt)}</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    <button onClick={() => onEdit(task)} className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100" title="Detail Lengkap">
                        <i className="fa-solid fa-expand text-xs"></i>
                    </button>
                    <div className="relative flex items-center">
                        {isEditingPic ? (
                            <select
                                autoFocus
                                value={task.picId || ''}
                                onChange={(e) => {
                                    setIsEditingPic(false);
                                    onUpdateTask({ ...task, picId: e.target.value });
                                }}
                                onBlur={() => setIsEditingPic(false)}
                                className="text-[10px] border border-purple-500 rounded outline-none p-0.5 bg-white absolute right-0 bottom-0 min-w-[90px] z-10"
                            >
                                <option value="">{ALL_DIVISI_LABEL}</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        ) : (
                            <button onClick={(e) => { e.stopPropagation(); setIsEditingPic(true); }} className="focus:outline-none flex items-center" title={pic ? `${pic.name} - ${pic.position}` : 'Set PIC'}>
                                {pic ? (
                                    <div className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold shadow-sm" style={{ backgroundColor: pic.color }}>
                                        {getInitials(pic.name)}
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-white/70 border border-dashed border-slate-300 text-slate-400 flex items-center justify-center text-[10px] hover:bg-white transition-colors">
                                        <i className="fa-solid fa-user-plus"></i>
                                    </div>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const KanbanView = ({ tasks, members, projects, onAdd, onEdit, onDelete, onUpdatePriority, onUpdateStatus, onUpdateTask }) => {
    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-gray-200', 'border-gray-400', 'border-dashed');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('bg-gray-200', 'border-gray-400', 'border-dashed');
    };

    const handleDrop = (e, status) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-gray-200', 'border-gray-400', 'border-dashed');
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            onUpdateStatus(taskId, status);
        }
    };

    return (
        <div className="flex h-full gap-4 overflow-x-auto pb-4 w-full">
            {COLUMNS.map(column => {
                const columnTasks = tasks.filter(t => t.status === column);
                const tint = COLUMN_TINTS[column] || COLUMN_TINTS['To Do'];
                return (
                    <div key={column} className="flex-1 min-w-[280px] flex flex-col">
                        <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-2xl ${tint.header}`}>
                            <div className="flex items-center space-x-2">
                                <h3 className="font-semibold text-sm text-slate-800">{column}</h3>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tint.chip}`}>{columnTasks.length}</span>
                            </div>
                            <button onClick={() => onAdd(column)} className="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-white/60 transition-colors">
                                <i className="fa-solid fa-plus"></i>
                            </button>
                        </div>

                        <div
                            className={`flex-1 rounded-3xl p-3 transition-colors border min-h-[500px] ${tint.drop}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, column)}
                        >
                            {columnTasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    members={members}
                                    projects={projects}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onUpdatePriority={onUpdatePriority}
                                    onUpdateStatus={onUpdateStatus}
                                    onUpdateTask={onUpdateTask}
                                />
                            ))}

                            <button
                                onClick={() => onAdd(column)}
                                className="w-full mt-1 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-200 py-2 rounded-md flex items-center space-x-2 px-2 transition-colors text-left"
                            >
                                <i className="fa-solid fa-plus text-xs"></i>
                                <span>New Task</span>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const TableView = ({
    tasks,
    members,
    projects,
    foldersList = ['General'],
    sortMode,
    setSortMode,
    onAdd,
    onEdit,
    onDelete,
    onUpdatePriority,
    onUpdateStatus,
    onUpdateTask,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder
}) => {
    const [collapsedFolders, setCollapsedFolders] = useState({});
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [renamingFolder, setRenamingFolder] = useState(null);
    const [renameDraft, setRenameDraft] = useState('');

    const toggleCollapse = (folder) => {
        setCollapsedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
    };

    const handleCreateFolderSubmit = (e) => {
        e.preventDefault();
        const trimmed = newFolderName.trim();
        if (trimmed && onCreateFolder) {
            onCreateFolder(trimmed);
            setNewFolderName('');
            setIsCreatingFolder(false);
        }
    };

    const handleRenameSubmit = (folder) => {
        const trimmed = renameDraft.trim();
        if (trimmed && trimmed !== folder && onRenameFolder) {
            onRenameFolder(folder, trimmed);
        }
        setRenamingFolder(null);
        setRenameDraft('');
    };

    // Ensure all folders present in tasks are covered
    const allFolders = Array.from(new Set([...(foldersList || []), 'General', ...tasks.map(t => t.folder).filter(Boolean)]));

    return (
        <div className="bg-white/75 rounded-3xl border border-white/70 shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-in backdrop-blur">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="p-3 font-medium">
                                <div className="flex items-center gap-2">
                                    <span>Nama Tugas & Jadwal</span>
                                    {setSortMode && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortMode === 'created_desc') setSortMode('created_asc');
                                                else if (sortMode === 'created_asc') setSortMode('deadline_asc');
                                                else setSortMode('created_desc');
                                            }}
                                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                                sortMode === 'created_desc' || sortMode === 'created_asc'
                                                    ? 'bg-pink-50 border-pink-200 text-pink-700 shadow-2xs'
                                                    : 'bg-slate-100 border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                                            }`}
                                            title="Klik untuk ubah urutan tanggal input / deadline"
                                        >
                                            <i className={`fa-solid ${sortMode === 'created_desc' ? 'fa-arrow-down-wide-short' : sortMode === 'created_asc' ? 'fa-arrow-up-wide-short' : 'fa-sort'} text-[9px]`}></i>
                                            <span>
                                                {sortMode === 'created_desc' ? 'Input: Terbaru' : sortMode === 'created_asc' ? 'Input: Terlama' : 'Urut Input'}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </th>
                            <th className="p-3 font-medium w-32">Status</th>
                            <th className="p-3 font-medium w-32">Prioritas</th>
                            <th className="p-3 font-medium w-40">PIC</th>
                            <th className="p-3 font-medium w-24 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/60">
                        {allFolders.map(folder => {
                            const folderTasks = tasks.filter(t => (t.folder || 'General') === folder);
                            const isCollapsed = !!collapsedFolders[folder];

                            return (
                                <React.Fragment key={folder}>
                                    {/* Section / Folder Header */}
                                    <tr className="bg-slate-100/90 border-y border-slate-200/80 select-none group/fhdr">
                                        <td colSpan="5" className="px-4 py-2.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCollapse(folder)}
                                                        className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded transition"
                                                        title={isCollapsed ? 'Buka folder' : 'Tutup folder'}
                                                    >
                                                        <i className={`fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'} text-xs`}></i>
                                                    </button>
                                                    <i className="fa-solid fa-folder text-indigo-500 text-sm"></i>
                                                    {renamingFolder === folder ? (
                                                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={renameDraft}
                                                                onChange={(e) => setRenameDraft(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleRenameSubmit(folder);
                                                                    if (e.key === 'Escape') setRenamingFolder(null);
                                                                }}
                                                                autoFocus
                                                                className="text-xs font-bold px-2 py-1 border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRenameSubmit(folder)}
                                                                className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                                                            >
                                                                Simpan
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRenamingFolder(null)}
                                                                className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs"
                                                            >
                                                                Batal
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className="font-bold text-xs text-slate-800 tracking-wide cursor-pointer hover:text-indigo-600 transition flex items-center gap-1.5"
                                                            onClick={() => toggleCollapse(folder)}
                                                        >
                                                            {folder}
                                                        </span>
                                                    )}
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 text-slate-600 border border-slate-200/80 shadow-xs">
                                                        {folderTasks.length} {folderTasks.length === 1 ? 'task' : 'tasks'}
                                                    </span>
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-2 opacity-90 group-hover/fhdr:opacity-100 transition">
                                                    <button
                                                        type="button"
                                                        onClick={() => onAdd('To Do', folder)}
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/80 px-2.5 py-1 rounded-lg transition"
                                                        title="Tambah task ke folder ini"
                                                    >
                                                        <i className="fa-solid fa-plus text-[10px]"></i>
                                                        <span>Tambah Task</span>
                                                    </button>

                                                    {folder !== 'General' && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setRenamingFolder(folder);
                                                                    setRenameDraft(folder);
                                                                }}
                                                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition"
                                                                title="Ganti nama folder"
                                                            >
                                                                <i className="fa-solid fa-pen text-[10px]"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (confirm(`Hapus folder "${folder}"? Seluruh task di dalamnya akan dipindahkan ke folder "General".`)) {
                                                                        if (onDeleteFolder) onDeleteFolder(folder);
                                                                    }
                                                                }}
                                                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                                title="Hapus folder"
                                                            >
                                                                <i className="fa-regular fa-trash-can text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Folder Tasks */}
                                    {!isCollapsed && (
                                        <>
                                            {folderTasks.map(task => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    members={members}
                                                    projects={projects}
                                                    onEdit={onEdit}
                                                    onDelete={onDelete}
                                                    onUpdatePriority={onUpdatePriority}
                                                    onUpdateStatus={onUpdateStatus}
                                                    onUpdateTask={onUpdateTask}
                                                    isListView={true}
                                                />
                                            ))}
                                            {folderTasks.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="py-3 px-8 text-xs text-slate-400 italic">
                                                        Belum ada task di folder ini.{' '}
                                                        <button
                                                            type="button"
                                                            onClick={() => onAdd('To Do', folder)}
                                                            className="text-indigo-600 hover:underline font-semibold ml-1 not-italic"
                                                        >
                                                            + Tambah Task Baru
                                                        </button>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <tr className="border-b border-dashed border-slate-100 hover:bg-slate-50/50 transition">
                                                    <td colSpan="5" className="px-6 py-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => onAdd('To Do', folder)}
                                                            className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1.5 font-medium transition"
                                                        >
                                                            <i className="fa-solid fa-plus text-[10px]"></i>
                                                            <span>Tambah task di folder {folder}...</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Bottom Toolbar: Tambah Folder & Task Baru */}
            <div className="p-4 border-t border-slate-100 bg-white/55 flex items-center justify-between flex-wrap gap-3">
                {isCreatingFolder ? (
                    <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-2 flex-1 max-w-md">
                        <i className="fa-solid fa-folder-plus text-indigo-500 text-sm"></i>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Nama folder baru (mis: Campaign Q3, Video Promosi)..."
                            autoFocus
                            className="flex-1 px-3 py-1.5 text-xs border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
                        />
                        <button
                            type="submit"
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                            Buat Folder
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                            className="px-2.5 py-1.5 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                        >
                            Batal
                        </button>
                    </form>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => onAdd('To Do', 'General')}
                            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center space-x-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs hover:bg-slate-50 transition"
                        >
                            <i className="fa-solid fa-plus text-indigo-600"></i>
                            <span>Tambah Tugas Baru</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCreatingFolder(true)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-2 bg-indigo-50/80 hover:bg-indigo-100/80 px-3.5 py-2 rounded-xl border border-indigo-200/60 shadow-xs transition"
                        >
                            <i className="fa-solid fa-folder-plus"></i>
                            <span>Tambah Folder / Section</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const MembersTable = ({ members, onAddMember, onDeleteMember, onToggleStatus, onResetPassword, currentUser, divisionsList, onAddDivision }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [isDivManage, setIsDivManage] = useState(false);
    const [newDivName, setNewDivName] = useState('');
    
    // RBAC Logic
    const isSuperAdmin = currentUser?.role === 'Super User';
    const canAddMember = isSuperAdmin || ['SPV', 'Manager', 'Direksi'].includes(currentUser?.role);
    const lockedDivision = !isSuperAdmin ? currentUser?.division : null;
    
    const [form, setForm] = useState({ name: '', email: '', role: 'Staff', division: lockedDivision || 'Marcomm' });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onAddMember(form);
        setForm({ name: '', email: '', role: 'Staff', division: lockedDivision || 'Marcomm' });
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
                        <label className="block text-xs font-medium text-slate-500 mb-1">Email Auth (Opsional)</label>
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
                                {divisionsList?.map(d => <option key={d} value={d}>{d}</option>) || DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
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
                            <tr key={member.id} className={`hover:bg-gray-50 transition-colors group ${member.is_active === false ? 'opacity-60' : ''}`}>
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
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${member.is_active === false ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {member.is_active === false ? 'Non-aktif' : 'Aktif'}
                                    </span>
                                </td>
                                {isSuperAdmin && (
                                    <td className="p-3 text-sm text-right space-x-1">
                                        <button onClick={() => onResetPassword(member.id)} className="text-blue-500 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" title="Reset Password ke Default">
                                            <i className="fa-solid fa-key"></i>
                                        </button>
                                        <button onClick={() => onToggleStatus(member.id, member.is_active !== false)} className="text-amber-500 hover:text-amber-600 p-1.5 rounded hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-opacity" title={member.is_active === false ? "Aktifkan" : "Non-aktifkan"}>
                                            <i className={`fa-solid ${member.is_active === false ? 'fa-user-check' : 'fa-user-slash'}`}></i>
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


const LOCAL_SESSION_KEY = 'task_abs_session';

const LoginScreen = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Hardcoded Super User
            if (email === 'abskdi.markom@gmail.com' && password === 'ABSgroup#123') {
                const { data } = await supabase.from('members').select('*').eq('email', email).single();
                const sessionObj = { 
                    email, 
                    role: 'Super User',
                    memberId: data?.id || 'superadmin',
                    division: data?.division || 'Direksi'
                };
                localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionObj));
                onLoginSuccess(sessionObj);
                return;
            }

            // Check members table
            const { data, error } = await supabase.from('members').select('*').eq('email', email).single();
            if (error || !data) {
                throw new Error('Email tidak ditemukan atau kredensial salah!');
            }
            if (data.is_active === false) {
                throw new Error('Akun Anda telah dinonaktifkan. Hubungi admin.');
            }

            const currentPassword = data.password || 'password123';

            if (password === currentPassword || password === 'password123' || password === 'ABSgroup123' || password === 'ABSgroup#123') {
                const requiresPasswordChange = (currentPassword === 'password123' || currentPassword === 'ABSgroup123');
                const sessionObj = { 
                    email, 
                    role: data.role, 
                    memberId: data.id, 
                    division: data.division,
                    requiresPasswordChange
                };
                localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionObj));
                localStorage.setItem(CURRENT_PIC_KEY, data.id);
                onLoginSuccess(sessionObj);
                return;
            }

            throw new Error('Password salah!');
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
                        {loading ? 'Memproses...' : 'Masuk'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const SidebarClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="mt-auto pt-4 border-t border-white/20">
            <div className="bg-white/40 backdrop-blur-md rounded-2xl p-4 text-center shadow-inner border border-white/60">
                <div className="text-2xl font-bold text-slate-800 tracking-tight">
                    {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
                    {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>
        </div>
    );
};



const TaskSummary = ({ stats }) => {
    const todo = stats?.todo ?? 0;
    const inProgress = stats?.inProgress ?? 0;
    const done = stats?.done ?? 0;
    const total = stats?.total ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">To Do</p>
                    <p className="text-2xl font-bold text-slate-800">{todo}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <i className="fa-solid fa-list text-slate-400"></i>
                </div>
            </div>
            <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">In Progress</p>
                    <p className="text-2xl font-bold text-blue-600">{inProgress}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <i className="fa-solid fa-spinner text-blue-500"></i>
                </div>
            </div>
            <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Done</p>
                    <p className="text-2xl font-bold text-emerald-600">{done}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <i className="fa-solid fa-check text-emerald-500"></i>
                </div>
            </div>
            <div className="bg-white/80 p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Tasks</p>
                    <p className="text-2xl font-bold text-slate-800">{total}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <i className="fa-solid fa-layer-group text-slate-400"></i>
                </div>
            </div>
        </div>
    );
};

const TaskControls = ({ members, searchQuery, setSearchQuery, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, folderFilter, setFolderFilter, foldersList = [], picFilter, setPicFilter, divisionFilter, setDivisionFilter, divisionsList = [], sortMode, setSortMode, onReset }) => (
    <div className="flex flex-wrap items-center gap-3 mb-6 bg-white/60 p-3 rounded-2xl shadow-sm border border-white/50 backdrop-blur-sm">
        <div className="flex-1 min-w-[200px] relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari tugas..." className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" />
        </div>
        {setFolderFilter && foldersList && foldersList.length > 0 && (
            <select
                value={folderFilter || 'all'}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
            >
                <option value="all">Semua Folder</option>
                {foldersList.map(f => (
                    <option key={f} value={f}>📁 {f}</option>
                ))}
            </select>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Semua Status</option>
            {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Semua Prioritas</option>
            {Object.keys(PRIORITIES).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {setDivisionFilter && (
            <select value={divisionFilter || 'all'} onChange={(e) => setDivisionFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]">
                <option value="all">Semua Divisi</option>
                {divisionsList.map((d, i) => {
                    const val = typeof d === 'string' ? d : d.name;
                    return <option key={i} value={val}>{val}</option>;
                })}
            </select>
        )}
        <select value={picFilter} onChange={(e) => setPicFilter(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]">
            <option value="all">Semua PIC</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="created_desc">Urut Input: Terbaru</option>
            <option value="created_asc">Urut Input: Terlama</option>
            <option value="deadline_asc">Urut Deadline: Terdekat</option>
            <option value="deadline_desc">Urut Deadline: Terjauh</option>
            <option value="priority_desc">Urut Prioritas</option>
            <option value="title_asc">Urut Nama (A-Z)</option>
            <option value="manual">Manual Sort</option>
        </select>
        <button onClick={onReset} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors" title="Reset Filters"><i className="fa-solid fa-rotate-right"></i></button>
    </div>
);

const ProjectChecklistDropdown = ({
    projects = [],
    selectedProjectIds = [],
    onChangeSelected,
    tasks = []
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const filteredProjectsList = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const q = searchQuery.toLowerCase();
        return projects.filter(p => p.name?.toLowerCase().includes(q));
    }, [projects, searchQuery]);

    const isAllSelected = projects.length > 0 && selectedProjectIds.length === projects.length;
    const isNoneSelected = selectedProjectIds.length === 0;

    const handleSelectAll = () => {
        onChangeSelected(projects.map(p => p.id));
    };

    const handleDeselectAll = () => {
        onChangeSelected([]);
    };

    const handleToggle = (id) => {
        if (selectedProjectIds.includes(id)) {
            onChangeSelected(selectedProjectIds.filter(pId => pId !== id));
        } else {
            onChangeSelected([...selectedProjectIds, id]);
        }
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-xs ${
                    isOpen || (!isAllSelected && !isNoneSelected)
                        ? 'bg-pink-50 border-pink-200 text-pink-700'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="Filter Proyek Kalender"
            >
                <i className="fa-solid fa-filter text-[11px] text-pink-500"></i>
                <span>Filter Proyek</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isAllSelected
                        ? 'bg-slate-100 text-slate-600'
                        : isNoneSelected
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-pink-100 text-pink-700'
                }`}>
                    {selectedProjectIds.length}/{projects.length}
                </span>
                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-pink-600' : ''}`}></i>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800">Pilih Proyek</span>
                            <span className="text-[11px] text-slate-400 font-medium">({selectedProjectIds.length} aktif)</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-pink-600 hover:text-pink-700 font-semibold hover:underline cursor-pointer"
                            >
                                Pilih Semua
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                                type="button"
                                onClick={handleDeselectAll}
                                className="text-slate-400 hover:text-slate-600 font-medium hover:underline cursor-pointer"
                            >
                                Batal Semua
                            </button>
                        </div>
                    </div>

                    {projects.length > 4 && (
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari nama project..."
                                className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white transition-all"
                            />
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                        {filteredProjectsList.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-400">
                                {projects.length === 0 ? 'Tidak ada proyek yang dibagikan' : 'Proyek tidak ditemukan'}
                            </div>
                        ) : (
                            filteredProjectsList.map(p => {
                                const isChecked = selectedProjectIds.includes(p.id);
                                const pTasksCount = tasks.filter(t => t.projectId === p.id).length;
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => handleToggle(p.id)}
                                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer select-none transition-all ${
                                            isChecked 
                                                ? 'bg-pink-50/50 hover:bg-pink-50 text-slate-800' 
                                                : 'hover:bg-slate-50 text-slate-500 opacity-70 hover:opacity-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} 
                                                className="w-3.5 h-3.5 rounded text-pink-600 focus:ring-pink-500 border-slate-300 pointer-events-none accent-pink-600"
                                            />
                                            <span 
                                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                                                style={{ backgroundColor: p.color || '#db2777' }} 
                                            />
                                            <span className="text-xs font-semibold truncate" title={p.name}>
                                                {p.name}
                                            </span>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200/80 text-slate-500 font-medium shrink-0 shadow-2xs">
                                            {pTasksCount} task
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 px-1">
                        <span>Hanya proyek yang di-share ke akun Anda</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const AbsCalendar = ({ 
    tasks = [], 
    projects = [], 
    members = [], 
    currentPicId, 
    onEdit, 
    onCreateTask, 
    onToggleProjectCalendar, 
    isProjectCalendar = false, 
    projectName = '',
    session = null
}) => {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });

    const [selectedProjectIds, setSelectedProjectIds] = useState(null);

    const effectiveSelectedIds = useMemo(() => {
        if (selectedProjectIds !== null) {
            const validIds = new Set(projects.map(p => p.id));
            return selectedProjectIds.filter(id => validIds.has(id));
        }
        const enabled = projects.filter(p => p.showInCalendar !== false).map(p => p.id);
        return enabled.length > 0 ? enabled : projects.map(p => p.id);
    }, [projects, selectedProjectIds]);

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

    // Defense in depth: if logged-in user is Staff or Kordinator, only show their own tasks or subtasks
    const userRole = session?.role;
    const userMemberId = session?.memberId;
    const roleFilteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (session && ['Staff', 'Kordinator'].includes(userRole)) {
                const isMainPic = t.picId === userMemberId;
                const isSubPic = Array.isArray(t.todos) && t.todos.some(todo => (todo.picId || todo.pic_id) === userMemberId);
                return isMainPic || isSubPic;
            }
            return true;
        });
    }, [tasks, session, userRole, userMemberId]);

    const visibleTasks = useMemo(() => {
        if (isProjectCalendar) return roleFilteredTasks;
        return roleFilteredTasks.filter(t => effectiveSelectedIds.includes(t.projectId));
    }, [isProjectCalendar, roleFilteredTasks, effectiveSelectedIds]);

    const getTasksForDate = (date) => {
        if (!date) return [];
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        return visibleTasks.filter(t => t.deadline === dateStr);
    };

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200/70 p-5 sm:p-6 flex flex-col flex-1 min-h-[580px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-500 shadow-sm">
                        <i className="fa-regular fa-calendar-days text-lg"></i>
                    </div>
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                            {isProjectCalendar ? `Kalender ${projectName || 'Project'}` : 'Semua Kalender'}
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                {visibleTasks.length} task
                            </span>
                        </h3>
                        <p className="text-xs text-slate-400">
                            {isProjectCalendar 
                                ? `Jadwal & deadline khusus project ${projectName || ''}` 
                                : 'Jadwal & deadline seluruh project yang dipilih'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {!isProjectCalendar && projects.length > 0 && (
                        <ProjectChecklistDropdown
                            projects={projects}
                            selectedProjectIds={effectiveSelectedIds}
                            onChangeSelected={setSelectedProjectIds}
                            tasks={roleFilteredTasks}
                        />
                    )}
                    <button 
                        type="button"
                        onClick={() => {
                            const d = new Date();
                            d.setDate(1);
                            setCurrentMonth(d);
                        }}
                        className="text-xs px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                    >
                        Hari Ini
                    </button>
                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/80">
                        <button 
                            type="button"
                            onClick={prevMonth} 
                            className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer" 
                            title="Bulan Sebelumnya"
                        >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <span className="font-semibold text-slate-700 text-xs sm:text-sm min-w-[130px] sm:min-w-[150px] text-center px-2">
                            {monthName}
                        </span>
                        <button 
                            type="button"
                            onClick={nextMonth} 
                            className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer" 
                            title="Bulan Berikutnya"
                        >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-slate-200/90 rounded-2xl overflow-hidden flex-1 border border-slate-200/80 shadow-inner">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                    <div key={d} className="bg-slate-50/90 p-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {d}
                    </div>
                ))}
                {days.map((d, i) => {
                    const cellTasks = getTasksForDate(d);
                    const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                    const dateStr = d ? `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
                    return (
                        <div 
                            key={i} 
                            onClick={() => {
                                if (d && onCreateTask) onCreateTask(dateStr);
                            }}
                            className={`group/cell bg-white p-1.5 sm:p-2 min-h-[95px] sm:min-h-[110px] flex flex-col transition-colors ${d ? 'hover:bg-indigo-50/20 cursor-pointer' : 'bg-slate-50/40'} ${isToday ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/20' : ''}`}
                        >
                            {d && (
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700'}`}>
                                        {d}
                                    </span>
                                    {onCreateTask && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCreateTask(dateStr);
                                            }}
                                            className="opacity-0 group-hover/cell:opacity-100 p-1 hover:bg-indigo-100 rounded-lg text-slate-400 hover:text-indigo-600 transition text-[10px] cursor-pointer"
                                            title={`Tambah task pada ${d} ${monthName}`}
                                        >
                                            <i className="fa-solid fa-plus"></i>
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-0.5 max-h-[85px] sm:max-h-[95px]">
                                {cellTasks.map(task => {
                                    const proj = projects.find(p => p.id === task.projectId);
                                    const isDone = task.status === 'Done';
                                    return (
                                        <div 
                                            key={task.id} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit(task);
                                            }}
                                            className={`text-[11px] p-1.5 rounded-lg truncate cursor-pointer transition-all border ${isDone ? 'bg-emerald-50 text-emerald-600 line-through opacity-70 border-emerald-200' : 'hover:brightness-95 hover:shadow-xs border-transparent'}`}
                                            style={!isDone ? { backgroundColor: `${proj?.color || '#6366f1'}18`, color: proj?.color || '#4f46e5', borderColor: `${proj?.color || '#6366f1'}35` } : {}}
                                            title={`${task.title}${task.folder ? ` [Folder: ${task.folder}]` : ''}`}
                                        >
                                            {task.folder && task.folder !== 'General' && (
                                                <span className="font-semibold text-[9px] opacity-75 mr-1 px-1 py-0.2 rounded bg-white/60">
                                                    {task.folder}
                                                </span>
                                            )}
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

const MainDashboard = ({ tasks, projects, members, shortcuts, currentPicId, onEdit, onQuickAddTask, session }) => {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };
    
    const activeUserId = (session && ['Staff', 'Kordinator'].includes(session.role)) 
        ? session.memberId 
        : (currentPicId || session?.memberId);

    const currMember = members.find(m => m.id === activeUserId);
    const myTasks = tasks.filter(t => t.picId === activeUserId && t.status !== 'Done');
    const myTodos = [];
    tasks.forEach(t => {
        if (t.status === 'Done') return;
        t.todos.forEach(todo => {
            if (!todo.done && (todo.picId || todo.pic_id) === activeUserId) {
                myTodos.push({ ...todo, parentTaskTitle: t.title, taskId: t.id });
            }
        });
    });

    myTodos.sort((a, b) => {
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return 0;
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
                                        <div className={`w-2.5 h-2.5 rounded-full mr-3 shrink-0 ${PRIORITIES[t.priority]?.color || 'bg-slate-300'}`}></div>
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
                                <div key={i} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                    <div className="flex items-start min-w-0 flex-1 mr-2">
                                        <i className="fa-regular fa-square text-emerald-400 mt-0.5 mr-3 shrink-0"></i>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">{todo.title}</p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">Dari tugas: {todo.parentTaskTitle}</p>
                                        </div>
                                    </div>
                                    {todo.deadline && (
                                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 flex items-center gap-1" title="Deadline sub-kegiatan">
                                            <i className="fa-regular fa-calendar text-[10px]"></i>
                                            {formatDeadline(todo.deadline) || todo.deadline}
                                        </span>
                                    )}
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
                                    {members.filter(m => m.is_active !== false || m.id === formData.picId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${note.type==='Meeting' ? 'bg-purple-100 text-purple-600' : note.type==='Idea' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>{note.type}</span>
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
                                        <i className={`fa-solid ${s.icon || 'fa-link'}`}></i>
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

const SharingSelector = ({ members, session, selectedMemberIds, setSelectedMemberIds }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDivs, setExpandedDivs] = useState({});

    const availableMembers = members.filter(m => m.id !== session?.memberId);
    
    // Group by division
    const groupedMembers = availableMembers.reduce((acc, m) => {
        const div = m.division || 'Tanpa Divisi';
        if (!acc[div]) acc[div] = [];
        acc[div].push(m);
        return acc;
    }, {});

    const handleToggle = (memberId) => {
        const next = new Set(selectedMemberIds);
        if (next.has(memberId)) next.delete(memberId);
        else next.add(memberId);
        setSelectedMemberIds(next);
    };

    const handleSelectAllDiv = (divMembers, e) => {
        e.stopPropagation();
        const next = new Set(selectedMemberIds);
        const allSelected = divMembers.every(m => next.has(m.id));
        divMembers.forEach(m => {
            if (allSelected) next.delete(m.id);
            else next.add(m.id);
        });
        setSelectedMemberIds(next);
    };

    const handleSelectByRole = (targetRoles) => {
        const next = new Set(selectedMemberIds);
        const roleMembers = availableMembers.filter(m => {
            const role = (m.position || m.role || '').toLowerCase();
            return targetRoles.some(tr => role.includes(tr.toLowerCase()));
        });
        
        const allSelected = roleMembers.every(m => next.has(m.id));
        roleMembers.forEach(m => {
            if (allSelected) next.delete(m.id);
            else next.add(m.id);
        });
        setSelectedMemberIds(next);
    };

    const toggleDiv = (div) => {
        setExpandedDivs(prev => ({ ...prev, [div]: !prev[div] }));
    };

    const filteredGroups = Object.entries(groupedMembers).map(([div, divMembers]) => {
        const filtered = divMembers.filter(m => 
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (m.position || m.role || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
        return [div, filtered];
    }).filter(([div, members]) => members.length > 0);

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4 space-y-3">
                {/* Search */}
                <div className="relative">
                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="text"
                        placeholder="Cari nama atau jabatan..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                
                {/* Quick Role Selectors */}
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleSelectByRole(['manager'])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors">
                        Manager
                    </button>
                    <button onClick={() => handleSelectByRole(['spv', 'supervisor'])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 transition-colors">
                        SPV
                    </button>
                    <button onClick={() => handleSelectByRole(['staf', 'staff'])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-200 transition-colors">
                        Staff
                    </button>
                </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-700">Pilih Anggota</label>
                <span className="text-xs text-gray-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">{selectedMemberIds.size} dipilih</span>
            </div>
            
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1 pb-2">
                {filteredGroups.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Tidak ada anggota yang cocok dengan pencarian.</p>
                ) : (
                    filteredGroups.sort((a, b) => a[0].localeCompare(b[0])).map(([div, divMembers]) => {
                        const sortedDivMembers = [...divMembers].sort((a, b) => (a.position || '').localeCompare(b.position || ''));
                        const isAllSelected = divMembers.every(m => selectedMemberIds.has(m.id));
                        const isExpanded = expandedDivs[div] === true;
                        return (
                            <div key={div} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all">
                                <div 
                                    className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => toggleDiv(div)}
                                >
                                    <h4 className="font-semibold text-slate-800 text-sm flex items-center">
                                        <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-slate-400 mr-2 text-xs w-3`}></i>
                                        {div} <span className="text-gray-400 font-normal ml-1 text-xs">({divMembers.length})</span>
                                    </h4>
                                    <button 
                                        onClick={(e) => handleSelectAllDiv(divMembers, e)}
                                        className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${isAllSelected ? 'text-slate-600 bg-slate-200 hover:bg-slate-300' : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100'}`}
                                    >
                                        {isAllSelected ? 'Batal Semua' : 'Pilih Semua'}
                                    </button>
                                </div>
                                {isExpanded && (
                                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 bg-white border-t border-gray-100">
                                        {sortedDivMembers.map(member => (
                                            <label key={member.id} className="flex items-start space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMemberIds.has(member.id)}
                                                        onChange={() => handleToggle(member.id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{member.name}</p>
                                                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{member.position || member.role || 'Anggota'}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const ShareProjectModal = ({ project, members, session, projectAccess, isOpen, onClose, onSave }) => {
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());

    useEffect(() => {
        if (isOpen && project) {
            const currentAccess = projectAccess.filter(pa => pa.project_id === project.id).map(pa => pa.member_id);
            setSelectedMemberIds(new Set(currentAccess));
        }
    }, [isOpen, project, projectAccess]);

    if (!isOpen || !project) return null;

    const handleToggle = (memberId) => {
        const next = new Set(selectedMemberIds);
        if (next.has(memberId)) next.delete(memberId);
        else next.add(memberId);
        setSelectedMemberIds(next);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800">Bagikan Project: {project.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div className="p-6 max-h-[70vh] flex flex-col overflow-hidden">
                    <p className="text-sm text-gray-500 mb-4 shrink-0">Kelola anggota yang memiliki akses ke project ini.</p>
                    <SharingSelector 
                        members={members} 
                        session={session} 
                        selectedMemberIds={selectedMemberIds} 
                        setSelectedMemberIds={setSelectedMemberIds} 
                    />
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors">
                        Batal
                    </button>
                    <button onClick={() => onSave(project.id, Array.from(selectedMemberIds))} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-200">
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateProjectModal = ({ members, session, isOpen, onClose, onSave }) => {
    const [projectName, setProjectName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());

    useEffect(() => {
        if (isOpen) {
            setProjectName('');
            setSelectedMemberIds(new Set());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!projectName.trim()) {
            alert('Nama project harus diisi');
            return;
        }
        onSave(projectName.trim(), Array.from(selectedMemberIds));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h3 className="text-xl font-bold text-slate-800">Buat Workspace (Project) Baru</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className="mb-5 shrink-0">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Project</label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="Contoh: Event Q3, Design System..."
                            className="w-full border-gray-300 border rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 px-4 bg-gray-50 text-slate-800"
                        />
                    </div>
                    
                    <div className="flex-1 overflow-hidden">
                        <SharingSelector 
                            members={members} 
                            session={session} 
                            selectedMemberIds={selectedMemberIds} 
                            setSelectedMemberIds={setSelectedMemberIds} 
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3 shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-200/50 rounded-xl transition-colors">
                        Batal
                    </button>
                    <button onClick={handleSave} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-200">
                        Buat Workspace
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function TaskManagerApp() {
    const [isMounted, setIsMounted] = useState(false);
    const [session, setSession] = useState(null);
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState('');
    const [divisionsList, setDivisionsList] = useState(DIVISIONS);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    const handleResetPassword = async (id) => {
        openDialog({
            type: 'confirm',
            message: 'Yakin ingin mereset password akun ini kembali ke default (password123)?',
            onConfirm: async () => {
                const { error } = await supabase.from('members').update({ password: 'password123' }).eq('id', id);
                if (error) {
                    alert('Gagal reset password: ' + error.message);
                } else {
                    alert('Password berhasil direset ke password123');
                }
            }
        });
    };

    const handleChangePassword = async (newPassword) => {
        if (session.role === 'Super User' && session.memberId === 'superadmin') {
            alert('Akun bawaan Super User tidak bisa mengganti password dari sini.');
            return false;
        }
        
        // Update password
        const { error: updateError } = await supabase.from('members').update({ password: newPassword }).eq('id', session.memberId);
        if (updateError) {
            alert('Gagal menyimpan password baru: ' + updateError.message);
            return false;
        }
        alert('Password berhasil diubah!');
        
        // Update session so it doesn't force again
        if (session.requiresPasswordChange) {
            const updatedSession = { ...session, requiresPasswordChange: false };
            setSession(updatedSession);
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updatedSession));
        }
        
        return true;
    };
    
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
    
    const [members, setMembers] = useState([]);
    const [currentPicId, setCurrentPicId] = useState('');
    const [tasks, setTasks] = useState([]);
    const [shortcuts, setShortcuts] = useState([]);
    const [notes, setNotes] = useState([]);
    const [globalDivision, setGlobalDivision] = useState('All');

    const [view, setView] = useState('dashboard');
    const [dialog, setDialog] = useState({ isOpen: false, type: '', message: '', onConfirm: null, defaultValue: '', required: false, placeholder: '' });
    const [editingTask, setEditingTask] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [picFilter, setPicFilter] = useState('all');
    const [divisionFilter, setDivisionFilter] = useState('all');
    const [folderFilter, setFolderFilter] = useState('all');
    const [sortMode, setSortMode] = useState('deadline_asc');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // Sharing & Project Settings state
    const [projectAccess, setProjectAccess] = useState([]);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [projectSettingsTarget, setProjectSettingsTarget] = useState(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareProjectTarget, setShareProjectTarget] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleUpdateProjectName = async (id, name) => {
        if (!name.trim()) return;
        const { error } = await supabase.from('projects').update({ name: name.trim() }).eq('id', id);
        if (error) {
            console.error('Supabase project name update error:', error);
            alert(`Gagal update nama project: ${error.message}`);
            return;
        }
        setProjects(prev => prev.map(p => p.id === id ? { ...p, name: name.trim() } : p));
    };

    const handleCreateFolder = async (projectId, folderName) => {
        const trimmed = (folderName || '').trim();
        if (!trimmed || !projectId) return;

        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const currentFolders = Array.isArray(project.folders) ? project.folders : ['General'];
        if (currentFolders.includes(trimmed)) return;

        const nextFolders = [...currentFolders, trimmed];
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, folders: nextFolders } : p));

        try {
            await supabase.from('projects').update({ folders: nextFolders }).eq('id', projectId);
        } catch (e) {
            console.warn('Could not persist project folders to supabase:', e);
        }
    };

    const handleRenameFolder = async (projectId, oldName, newName) => {
        const trimmed = (newName || '').trim();
        if (!trimmed || !projectId || !oldName || trimmed === oldName) return;

        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const currentFolders = Array.isArray(project.folders) ? project.folders : ['General'];
        const nextFolders = currentFolders.map(f => f === oldName ? trimmed : f);
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, folders: nextFolders } : p));

        setTasks(prev => prev.map(t => (t.projectId === projectId && (t.folder || 'General') === oldName) ? { ...t, folder: trimmed } : t));

        try {
            await supabase.from('projects').update({ folders: nextFolders }).eq('id', projectId);
            await supabase.from('tasks').update({ folder: trimmed }).eq('project_id', projectId).eq('folder', oldName);
        } catch (e) {
            console.warn('Could not persist rename folder to supabase:', e);
        }
    };

    const handleDeleteFolder = async (projectId, folderName) => {
        if (!projectId || !folderName || folderName === 'General') return;

        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const currentFolders = Array.isArray(project.folders) ? project.folders : ['General'];
        const nextFolders = currentFolders.filter(f => f !== folderName);
        if (!nextFolders.includes('General')) nextFolders.unshift('General');

        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, folders: nextFolders } : p));
        setTasks(prev => prev.map(t => (t.projectId === projectId && t.folder === folderName) ? { ...t, folder: 'General' } : t));

        try {
            await supabase.from('projects').update({ folders: nextFolders }).eq('id', projectId);
            await supabase.from('tasks').update({ folder: 'General' }).eq('project_id', projectId).eq('folder', folderName);
        } catch (e) {
            console.warn('Could not persist delete folder to supabase:', e);
        }
    };

    // Filtered global lists based on Division
    const isSuperUser = session?.role === 'Super User';
    const memberId = session?.memberId;

    const accessibleProjectIds = isSuperUser ? null : new Set([
        ...projects.filter(p => p.owner_id === memberId).map(p => p.id),
        ...projectAccess.filter(a => a.member_id === memberId).map(a => a.project_id)
    ]);

    const filteredMembers = members.filter(m => globalDivision === 'All' || m.division === globalDivision);
    const filteredProjects = projects.filter(p => {
        if (globalDivision !== 'All' && p.division && p.division !== 'Task ABS' && p.division !== globalDivision) return false;
        if (isSuperUser) return true;
        if (!p.owner_id) return true; // Legacy projects without owner are visible to all
        return accessibleProjectIds.has(p.id);
    });
    const filteredTasks = tasks.filter(t => {
        if (globalDivision !== 'All') {
            const project = projects.find(p => p.id === t.projectId);
            if (!project) return false;
            if (project.division && project.division !== 'Task ABS' && project.division !== globalDivision) return false;
        }
        
        if (!isSuperUser && accessibleProjectIds) {
            const project = projects.find(p => p.id === t.projectId);
            if (project && project.owner_id && !accessibleProjectIds.has(t.projectId)) return false;
        }
        
        if (session && ['Staff', 'Kordinator'].includes(session.role)) {
            const isMainPic = t.picId === session.memberId;
            const isSubPic = Array.isArray(t.todos) && t.todos.some(todo => (todo.picId || todo.pic_id) === session.memberId);
            return isMainPic || isSubPic;
        }

        return true;
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


    useEffect(() => {
        // Initial session check from localStorage
        const storedSession = localStorage.getItem(LOCAL_SESSION_KEY);
        if (storedSession) {
            try {
                const parsedSession = JSON.parse(storedSession);
                setSession(parsedSession);
                if (parsedSession && parsedSession.role !== 'Super User' && parsedSession.division) {
                    setGlobalDivision(parsedSession.division);
                }
            } catch (e) {
                setSession(null);
                setIsMounted(true);
            }
        } else {
            setSession(null);
            setIsMounted(true);
        }
    }, []);

    const handleCurrentPicChange = (picId) => {
        setCurrentPicId(picId);
        if (picId) localStorage.setItem(CURRENT_PIC_KEY, picId);
        else localStorage.removeItem(CURRENT_PIC_KEY);
    };

    // Load initial data from Supabase after the client has mounted.
    useEffect(() => {
        if (!session) return;

        setIsMounted(false);

        const loadData = async () => {
            const [
                { data: projectsData, error: projectsError },
                { data: membersData, error: membersError },
                { data: tasksData, error: tasksError },
                { data: shortcutsData, error: shortcutsError },
                { data: notesData, error: notesError },
                { data: divsData },
                { data: accessData }
            ] = await Promise.all([
                supabase.from('projects').select('*').order('created_at', { ascending: true }),
                supabase.from('members').select('*').order('created_at', { ascending: true }),
                supabase.from('tasks').select('*').order('created_at', { ascending: true }),
                supabase.from('shortcuts').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
                supabase.from('notes').select('*').order('created_at', { ascending: false }),
                supabase.from('divisions').select('*').order('created_at', { ascending: true }),
                supabase.from('project_access').select('*')
            ]);

            const firstError = projectsError || membersError || tasksError;
            if (firstError) {
                console.error('Supabase load error:', firstError);
                alert(`Gagal memuat data Supabase: ${firstError.message}`);
                setProjects([]);
                setMembers([]);
                setTasks([]);
                setShortcuts([]);
                setNotes([]);
                setActiveProject('');
                setIsMounted(true);
                return;
            }

            const mappedProjects = (projectsData || []).map((project, index) => ({
                id: project.id,
                name: project.name,
                isPinned: project.is_pinned,
                owner_id: project.owner_id,
                division: project.division,
                color: project.color || getDefaultProjectColor(index),
                folders: Array.isArray(project.folders) && project.folders.length > 0 ? project.folders : ['General'],
                showInCalendar: project.show_in_calendar ?? isDefaultCalendarProject(project.name)
            }));

            const mappedTasks = (tasksData || []).map(task => ({
                id: task.id,
                projectId: task.project_id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                folder: task.folder || 'General',
                startDate: task.start_date || '',
                deadline: task.deadline || '',
                createdAt: task.created_at || task.createdAt || '',
                picId: task.pic_id || '',
                todos: Array.isArray(task.todos)
                    ? task.todos.map(todo => ({
                        ...todo,
                        picId: todo.picId || todo.pic_id || '',
                        deadline: todo.deadline || todo.due_date || ''
                    }))
                    : []
            }));

            const mappedMembers = membersData || [];
            if (divsData && divsData.length > 0) {
                setDivisionsList(divsData.map(d => d.name));
            }
            const mappedShortcuts = (shortcutsData || []).map((shortcut, index) => ({
                id: shortcut.id,
                title: shortcut.title,
                url: shortcut.url,
                icon: shortcut.icon,
                color: shortcut.color,
                isFavorite: shortcut.is_favorite ?? index < 6
            }));
            const mappedNotes = (notesData || []).map(note => {
                let noteMeta = {};
                try {
                    if (note.location && typeof note.location === 'string' && note.location.trim().startsWith('{')) {
                        noteMeta = JSON.parse(note.location);
                    }
                } catch (e) {}

                return {
                    id: note.id,
                    type: note.type || 'Meeting',
                    title: note.title || '',
                    content: note.content || '',
                    issue: note.issue || '',
                    decision: note.decision || '',
                    picId: note.pic_id || '',
                    deadline: note.deadline || '',
                    isDone: note.is_done || false,
                    meeting_date: note.meeting_date || null,
                    location: noteMeta.color ? '' : (note.location || ''),
                    project_id: note.project_id || null,
                    attendees: Array.isArray(note.attendees) ? note.attendees : [],
                    agenda: note.agenda || '',
                    action_items: Array.isArray(note.action_items) ? note.action_items : [],
                    color: note.color || noteMeta.color || 'yellow',
                    isPinned: Boolean(note.is_pinned ?? noteMeta.isPinned),
                    sharedWith: Array.isArray(note.shared_with) ? note.shared_with : (noteMeta.sharedWith || (Array.isArray(note.attendees) ? note.attendees : [])),
                    createdAt: note.created_at,
                    updatedAt: note.updated_at
                };
            });

            if (shortcutsError) {
                console.warn('Supabase shortcuts load warning:', shortcutsError);
            }
            if (notesError) {
                console.warn('Supabase notes load warning:', notesError);
            }

            const nextMembers = mappedMembers;
            setProjects(mappedProjects);
            setMembers(nextMembers);
            setTasks(mappedTasks);
            setShortcuts(mappedShortcuts);
            setNotes(mappedNotes);
            setProjectAccess(accessData || []);
            setActiveProject(mappedProjects[0]?.id || '');
            setCurrentPicId(prev => {
                if (session && session.memberId) return session.memberId;
                const savedPic = prev || localStorage.getItem(CURRENT_PIC_KEY) || '';
                if (savedPic && nextMembers.some(member => member.id === savedPic)) return savedPic;
                const fallbackPic = nextMembers[0]?.id || '';
                if (fallbackPic) localStorage.setItem(CURRENT_PIC_KEY, fallbackPic);
                return fallbackPic;
            });
            setIsMounted(true);
            
            if (session && session.requiresPasswordChange) {
                setIsPasswordModalOpen(true);
            }
        };

        loadData();
    }, [session]);

    if (!isMounted) return <div className="h-screen w-screen flex items-center justify-center bg-white text-gray-500">Memuat Workspace...</div>;

    if (!session) return <LoginScreen onLoginSuccess={(s) => {
        setSession(s);
        if (s.role !== 'Super User' && s.division) {
            setGlobalDivision(s.division);
        }
    }} />;

    const handleLogout = async () => {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        localStorage.removeItem(CURRENT_PIC_KEY);
        setSession(null);
        setCurrentPicId('');
        setActiveProject('');
    };

    const openDialog = (config) => setDialog({ isOpen: true, ...config });
    const closeDialog = () => setDialog({ isOpen: false, type: '', message: '', onConfirm: null, defaultValue: '' });

    // Database Actions
    const handleSaveShareProject = async (projectId, memberIds) => {
        try {
            // Delete all current accesses for this project
            const { error: deleteError } = await supabase.from('project_access').delete().eq('project_id', projectId);
            if (deleteError) throw deleteError;

            if (memberIds.length > 0) {
                const inserts = memberIds.map(memberId => ({ project_id: projectId, member_id: memberId }));
                const { error: insertError } = await supabase.from('project_access').insert(inserts);
                if (insertError) throw insertError;
            }

            // Update local state
            setProjectAccess(prev => [
                ...prev.filter(pa => pa.project_id !== projectId),
                ...memberIds.map(memberId => ({ project_id: projectId, member_id: memberId }))
            ]);
            
            setIsShareModalOpen(false);
            alert('Akses project berhasil diperbarui!');
        } catch (error) {
            console.error('Error saving project access:', error);
            alert('Gagal menyimpan akses project: ' + error.message);
        }
    };

    const handleAddProject = () => {
        setIsCreateModalOpen(true);
    };

    const handleSaveNewProject = async (name, memberIds) => {
        const newProject = {
            id: crypto.randomUUID(),
            name: name,
            isPinned: false,
            owner_id: session.memberId,
            color: getDefaultProjectColor(projects.length),
            showInCalendar: false
        };

        const { error: projectError } = await supabase.from('projects').insert({
            id: newProject.id,
            name: newProject.name,
            is_pinned: newProject.isPinned,
            color: newProject.color,
            show_in_calendar: newProject.showInCalendar,
            owner_id: session.memberId,
            division: globalDivision === 'All' ? null : globalDivision
        });

        if (projectError) {
            console.error('Supabase project insert error:', projectError);
            alert(`Gagal menambah project: ${projectError.message}`);
            return;
        }

        if (memberIds.length > 0) {
            const inserts = memberIds.map(memberId => ({ project_id: newProject.id, member_id: memberId }));
            const { error: accessError } = await supabase.from('project_access').insert(inserts);
            if (accessError) {
                console.error('Supabase project access insert error:', accessError);
                alert(`Project berhasil dibuat, tetapi gagal menyimpan hak akses: ${accessError.message}`);
            } else {
                setProjectAccess(prev => [...prev, ...inserts]);
            }
        }

        setProjects(prev => [...prev, newProject]);
        setActiveProject(newProject.id);
        if (view === 'members' || view === 'dashboard' || view === 'notes' || view === 'calendar') setView('table');
        setIsCreateModalOpen(false);
    };

    const handleTogglePinProject = async (id, e) => {
        if (e?.stopPropagation) e.stopPropagation();
        const project = projects.find(p => p.id === id);
        if (!project) return;

        const nextPinned = !project.isPinned;
        const { error } = await supabase.from('projects').update({ is_pinned: nextPinned }).eq('id', id);

        if (error) {
            console.error('Supabase project pin error:', error);
            alert(`Gagal update pin project: ${error.message}`);
            return;
        }

        setProjects(prev => prev.map(p => p.id === id ? { ...p, isPinned: nextPinned } : p));
    };

    const handleUpdateProjectColor = async (id, color, e) => {
        if (e?.stopPropagation) e.stopPropagation();

        const { error } = await supabase
            .from('projects')
            .update({ color })
            .eq('id', id);

        if (error) {
            console.error('Supabase project color update error:', error);
            alert(`Gagal update warna project: ${error.message}. Jalankan project_colors.sql di Supabase jika kolom color belum ada.`);
            return;
        }

        setProjects(prev => prev.map(project => project.id === id ? { ...project, color } : project));
    };

    const handleToggleProjectCalendar = async (id, showInCalendar, e) => {
        if (e?.stopPropagation) e.stopPropagation();

        const { error } = await supabase
            .from('projects')
            .update({ show_in_calendar: showInCalendar })
            .eq('id', id);

        if (error) {
            console.error('Supabase project calendar update error:', error);
            alert(`Gagal update tampilan kalender: ${error.message}. Jalankan project_calendar.sql di Supabase jika kolom show_in_calendar belum ada.`);
            return;
        }

        setProjects(prev => prev.map(project => project.id === id ? { ...project, showInCalendar } : project));
    };

    const handleDeleteProject = async (id, e) => {
        if (e?.stopPropagation) e.stopPropagation();
        if (projects.length <= 1) {
            openDialog({ type: 'confirm', message: 'Tidak dapat menghapus project terakhir.', onConfirm: () => { } });
            return;
        }
        openDialog({
            type: 'confirm',
            message: 'Yakin ingin menghapus project ini beserta seluruh tugas di dalamnya secara permanen?',
            onConfirm: async () => {
                const { error } = await supabase.from('projects').delete().eq('id', id);

                if (error) {
                    console.error('Supabase project delete error:', error);
                    alert(`Gagal menghapus project: ${error.message}`);
                    return;
                }

                const newProjects = projects.filter(p => p.id !== id);
                setProjects(newProjects);
                setTasks(tasks.filter(t => t.projectId !== id));
                if (activeProject === id) setActiveProject(newProjects[0].id);
            }
        });
    };

    const handleAddTask = async (status = 'To Do', folder = 'General') => {
        if (!activeProject) return;
        const newTaskTemplate = {
            id: crypto.randomUUID(),
            projectId: activeProject,
            title: '',
            status,
            priority: 'Medium',
            folder: folder || 'General',
            deadline: '',
            startDate: '',
            picId: currentPicId || '',
            todos: [],
            isNew: true
        };
        setEditingTask(newTaskTemplate);
    };

    const handleAddTaskForDate = (deadline) => {
        const projectId = activeProject || filteredProjects[0]?.id || '';
        if (!projectId) {
            alert('Buat project terlebih dahulu sebelum menambah task kalender.');
            return;
        }

        setEditingTask({
            id: crypto.randomUUID(),
            projectId,
            title: '',
            status: 'To Do',
            priority: 'Medium',
            folder: 'General',
            deadline,
            createdAt: new Date().toISOString(),
            picId: currentPicId || '',
            todos: [],
            isNew: true
        });
    };

    const handleQuickAddTask = async (taskInput) => {
        if (!taskInput.title?.trim() || !taskInput.projectId) return false;

        const now = new Date().toISOString();
        const newTask = {
            id: crypto.randomUUID(),
            projectId: taskInput.projectId,
            title: taskInput.title.trim(),
            status: 'To Do',
            priority: taskInput.priority || 'Medium',
            folder: taskInput.folder || 'General',
            deadline: taskInput.deadline || '',
            createdAt: now,
            picId: taskInput.picId || currentPicId || '',
            todos: []
        };

        const { error } = await supabase.from('tasks').insert({
            id: newTask.id,
            project_id: newTask.projectId,
            title: newTask.title,
            status: newTask.status,
            priority: newTask.priority,
            folder: newTask.folder,
            deadline: newTask.deadline || null,
            pic_id: newTask.picId || null,
            todos: newTask.todos,
            created_at: now,
            updated_at: now
        });

        if (error) {
            console.error('Supabase quick task insert error:', error);
            alert(`Gagal menambah task cepat: ${error.message}`);
            return false;
        }

        setTasks(prev => [...prev, newTask]);
        return true;
    };

    const handleEditTask = (task) => setEditingTask(task);

    const handleSaveEditedTask = async (updatedTask) => {
        if (!updatedTask.title.trim() || !updatedTask.projectId) return false;
        const normalizedTodos = (Array.isArray(updatedTask.todos) ? updatedTask.todos : [])
            .filter(todo => (todo.title || '').trim())
            .map(todo => ({
                id: todo.id || crypto.randomUUID(),
                title: todo.title.trim(),
                done: !!todo.done,
                picId: todo.picId || todo.pic_id || '',
                deadline: todo.deadline || todo.due_date || ''
            }));

        const now = new Date().toISOString();
        const payload = {
            id: updatedTask.id,
            project_id: updatedTask.projectId,
            title: updatedTask.title.trim(),
            status: updatedTask.status || 'To Do',
            priority: updatedTask.priority || 'Medium',
            folder: updatedTask.folder || 'General',
            start_date: updatedTask.startDate || updatedTask.start_date || null,
            deadline: updatedTask.deadline || null,
            pic_id: updatedTask.picId || null,
            todos: normalizedTodos,
            updated_at: now
        };

        if (updatedTask.isNew) {
            const { isNew, ...taskToSave } = updatedTask;
            const createdAt = taskToSave.createdAt || now;
            payload.created_at = createdAt;

            let { error } = await supabase.from('tasks').insert(payload);
            if (error && error.message) {
                let safePayload = { ...payload };
                if (error.message.includes('folder')) delete safePayload.folder;
                if (error.message.includes('start_date')) delete safePayload.start_date;
                const retry = await supabase.from('tasks').insert(safePayload);
                error = retry.error;
            }

            if (error) {
                console.error('Supabase task insert error:', error);
                alert(`Gagal menambah task: ${error.message}`);
                return false;
            }

            setTasks(prev => [...prev, { ...taskToSave, status: payload.status, priority: payload.priority, folder: payload.folder || 'General', startDate: payload.start_date, deadline: payload.deadline, createdAt, todos: normalizedTodos }]);
            return true;
        } else {
            const { isNew, ...taskToSave } = updatedTask;
            let { error } = await supabase.from('tasks').update(payload).eq('id', updatedTask.id);
            if (error && error.message) {
                let safePayload = { ...payload };
                if (error.message.includes('folder')) delete safePayload.folder;
                if (error.message.includes('start_date')) delete safePayload.start_date;
                const retry = await supabase.from('tasks').update(safePayload).eq('id', updatedTask.id);
                error = retry.error;
            }

            if (error) {
                console.error('Supabase task update error:', error);
                alert(`Gagal update task: ${error.message}`);
                return false;
            }

            setTasks(prev => prev.map(t => (t.id === updatedTask.id ? { ...t, ...taskToSave, status: payload.status, priority: payload.priority, folder: payload.folder || 'General', startDate: payload.start_date, deadline: payload.deadline, createdAt: t.createdAt || taskToSave.createdAt || '', todos: normalizedTodos } : t)));
            return true;
        }
    };

    const handleBatchCreateTasks = async (newTasksList) => {
        if (!Array.isArray(newTasksList) || newTasksList.length === 0) return false;

        const now = new Date().toISOString();
        const preparedTasks = newTasksList.map(item => ({
            id: crypto.randomUUID(),
            project_id: item.projectId,
            title: item.title.trim(),
            status: item.status || 'To Do',
            priority: item.priority || 'Medium',
            start_date: item.startDate || null,
            deadline: item.deadline || null,
            pic_id: item.picId || null,
            todos: item.todos || [],
            created_at: now,
            updated_at: now
        }));

        let { error } = await supabase.from('tasks').insert(preparedTasks);
        if (error && error.message && error.message.includes('start_date')) {
            const safeTasks = preparedTasks.map(({ start_date, ...t }) => t);
            const retry = await supabase.from('tasks').insert(safeTasks);
            error = retry.error;
        }

        if (error) {
            console.error('Supabase batch tasks insert error:', error);
            alert(`Gagal membuat task: ${error.message}`);
            return false;
        }

        const normalizedNew = preparedTasks.map(t => ({
            id: t.id,
            projectId: t.project_id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            startDate: t.start_date,
            deadline: t.deadline,
            createdAt: t.created_at,
            picId: t.pic_id,
            todos: t.todos
        }));

        setTasks(prev => [...prev, ...normalizedNew]);
        return true;
    };

    const handleDeleteTask = async (id) => {
        openDialog({
            type: 'confirm',
            message: 'Apakah Anda yakin ingin menghapus tugas ini secara permanen?',
            onConfirm: async () => {
                const { error } = await supabase.from('tasks').delete().eq('id', id);

                if (error) {
                    console.error('Supabase task delete error:', error);
                    alert(`Gagal menghapus task: ${error.message}`);
                    return;
                }

                setTasks(prev => prev.filter(t => t.id !== id));
            }
        });
    };

    const handleUpdatePriority = async (id, priority) => {
        const { error } = await supabase
            .from('tasks')
            .update({ priority, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('Supabase priority update error:', error);
            alert(`Gagal update prioritas: ${error.message}`);
            return;
        }

        setTasks(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
    };

    const handleUpdateStatus = async (id, status) => {
        const { error } = await supabase
            .from('tasks')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('Supabase status update error:', error);
            alert(`Gagal update status: ${error.message}`);
            return;
        }

        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    };

    const handleAddShortcut = async (shortcut) => {
        const newShortcut = {
            id: crypto.randomUUID(),
            title: shortcut.title,
            url: shortcut.url,
            icon: shortcut.icon,
            color: shortcut.color,
            isFavorite: shortcut.isFavorite
        };

        const { error } = await supabase.from('shortcuts').insert({
            id: newShortcut.id,
            title: newShortcut.title,
            url: newShortcut.url,
            icon: newShortcut.icon,
            color: newShortcut.color,
            is_favorite: newShortcut.isFavorite,
            sort_order: shortcuts.length + 1
        });

        if (error) {
            console.error('Supabase shortcut insert error:', error);
            alert(`Gagal menambah shortcut: ${error.message}. Pastikan tabel shortcuts sudah dibuat di Supabase.`);
            return;
        }

        setShortcuts(prev => [...prev, newShortcut]);
    };

    const handleToggleShortcutFavorite = async (id) => {
        const shortcut = shortcuts.find(item => item.id === id);
        if (!shortcut) return;

        const nextFavorite = !shortcut.isFavorite;
        const { error } = await supabase
            .from('shortcuts')
            .update({ is_favorite: nextFavorite })
            .eq('id', id);

        if (error) {
            console.error('Supabase shortcut favorite update error:', error);
            alert(`Gagal update favorit shortcut: ${error.message}. Jalankan ulang shortcuts.sql jika kolom is_favorite belum ada.`);
            return;
        }

        setShortcuts(prev => prev.map(item => item.id === id ? { ...item, isFavorite: nextFavorite } : item));
    };

    const handleDeleteShortcut = async (id) => {
        const { error } = await supabase.from('shortcuts').delete().eq('id', id);

        if (error) {
            console.error('Supabase shortcut delete error:', error);
            alert(`Gagal menghapus shortcut: ${error.message}. Jika ini shortcut default, buat tabel shortcuts lalu seed data terlebih dahulu.`);
            return;
        }

        setShortcuts(prev => prev.filter(shortcut => shortcut.id !== id));
    };

    const handleAddNote = async (noteInput) => {
        const isNoteType = (noteInput.type || '').toLowerCase() === 'note' || (noteInput.type || '').toLowerCase() === 'postit';
        const noteColor = noteInput.color || 'yellow';
        const noteIsPinned = Boolean(noteInput.isPinned);
        const sharedWithList = noteInput.sharedWith || noteInput.attendees || [];
        const authorPicId = noteInput.picId || session?.memberId || currentPicId || null;

        const locationValue = isNoteType 
            ? JSON.stringify({ color: noteColor, isPinned: noteIsPinned, sharedWith: sharedWithList })
            : (noteInput.location || null);

        const newNote = {
            id: crypto.randomUUID(),
            type: noteInput.type || 'Meeting',
            title: noteInput.title || '',
            content: noteInput.content || '',
            issue: noteInput.issue || '',
            decision: noteInput.decision || '',
            picId: authorPicId || '',
            deadline: noteInput.deadline || '',
            isDone: noteInput.isDone || false,
            meeting_date: noteInput.meetingDate || noteInput.meeting_date || null,
            location: isNoteType ? '' : (noteInput.location || ''),
            project_id: noteInput.projectId || noteInput.project_id || null,
            attendees: sharedWithList,
            sharedWith: sharedWithList,
            color: noteColor,
            isPinned: noteIsPinned,
            agenda: noteInput.agenda || '',
            action_items: noteInput.actionItems || noteInput.action_items || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const payload = {
            id: newNote.id,
            type: newNote.type,
            title: newNote.title || null,
            content: newNote.content || null,
            issue: newNote.issue || null,
            decision: newNote.decision || null,
            pic_id: authorPicId,
            deadline: newNote.deadline || null,
            is_done: newNote.isDone || false,
            meeting_date: newNote.meeting_date || null,
            location: locationValue,
            project_id: newNote.project_id || null,
            attendees: sharedWithList,
            agenda: newNote.agenda || null,
            action_items: newNote.action_items || [],
            updated_at: newNote.updatedAt
        };

        let { error } = await supabase.from('notes').insert(payload);
        if (error && error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
            const legacyPayload = {
                id: newNote.id,
                type: newNote.type,
                title: newNote.title || null,
                content: newNote.content || null,
                issue: newNote.issue || null,
                decision: newNote.decision || null,
                pic_id: authorPicId,
                deadline: newNote.deadline || null,
                is_done: newNote.isDone || false,
                updated_at: newNote.updatedAt
            };
            const retry = await supabase.from('notes').insert(legacyPayload);
            error = retry.error;
        }

        if (error) {
            console.error('Supabase note insert error:', error);
            alert(`Gagal menyimpan notes: ${error.message}. Jalankan sql/migration_v2.sql di Supabase.`);
            return false;
        }

        setNotes(prev => [newNote, ...prev]);
        return true;
    };

    const handleUpdateNote = async (id, noteInput) => {
        const updatedAt = new Date().toISOString();
        const isNoteType = (noteInput.type || '').toLowerCase() === 'note' || (noteInput.type || '').toLowerCase() === 'postit';
        const noteColor = noteInput.color || 'yellow';
        const noteIsPinned = Boolean(noteInput.isPinned);
        const sharedWithList = noteInput.sharedWith || noteInput.attendees || [];
        const authorPicId = noteInput.picId !== undefined ? noteInput.picId : (noteInput.pic_id || null);

        const locationValue = isNoteType 
            ? JSON.stringify({ color: noteColor, isPinned: noteIsPinned, sharedWith: sharedWithList })
            : (noteInput.location || null);

        const payload = {
            type: noteInput.type,
            title: noteInput.title || null,
            content: noteInput.content || null,
            issue: noteInput.issue || null,
            decision: noteInput.decision || null,
            pic_id: authorPicId,
            deadline: noteInput.deadline || null,
            is_done: noteInput.isDone || false,
            meeting_date: noteInput.meetingDate || noteInput.meeting_date || null,
            location: locationValue,
            project_id: noteInput.projectId || noteInput.project_id || null,
            attendees: sharedWithList,
            agenda: noteInput.agenda || null,
            action_items: noteInput.actionItems || noteInput.action_items || [],
            updated_at: updatedAt
        };

        let { error } = await supabase.from('notes').update(payload).eq('id', id);
        if (error && error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
            const legacyPayload = {
                type: noteInput.type,
                title: noteInput.title || null,
                content: noteInput.content || null,
                issue: noteInput.issue || null,
                decision: noteInput.decision || null,
                pic_id: authorPicId,
                deadline: noteInput.deadline || null,
                is_done: noteInput.isDone || false,
                updated_at: updatedAt
            };
            const retry = await supabase.from('notes').update(legacyPayload).eq('id', id);
            error = retry.error;
        }

        if (error) {
            console.error('Supabase note update error:', error);
            alert(`Gagal update notes: ${error.message}. Jalankan sql/migration_v2.sql di Supabase.`);
            return false;
        }

        setNotes(prev => prev.map(note => note.id === id ? {
            ...note,
            type: noteInput.type,
            title: noteInput.title || '',
            content: noteInput.content || '',
            issue: noteInput.issue || '',
            decision: noteInput.decision || '',
            picId: authorPicId || note.picId || '',
            deadline: noteInput.deadline || '',
            isDone: noteInput.isDone || false,
            meeting_date: payload.meeting_date,
            location: isNoteType ? '' : (payload.location || ''),
            project_id: payload.project_id,
            attendees: sharedWithList,
            sharedWith: sharedWithList,
            color: noteColor,
            isPinned: noteIsPinned,
            agenda: payload.agenda,
            action_items: payload.action_items,
            updatedAt
        } : note));
        return true;
    };

    const handleDeleteNote = async (id) => {
        const { error } = await supabase.from('notes').delete().eq('id', id);

        if (error) {
            console.error('Supabase note delete error:', error);
            alert(`Gagal hapus notes: ${error.message}. Jalankan notes.sql di Supabase.`);
            return;
        }

        setNotes(prev => prev.filter(note => note.id !== id));
    };

    const handleCreateTaskFromMeeting = (meeting) => {
        const projectId = activeProject || projects[0]?.id || '';
        if (!projectId) {
            alert('Buat project terlebih dahulu sebelum membuat task dari MoM.');
            return;
        }

        setEditingTask({
            id: crypto.randomUUID(),
            projectId,
            title: meeting.issue || 'Task dari Minute of Meeting',
            status: 'To Do',
            priority: 'Medium',
            deadline: meeting.deadline || '',
            picId: meeting.picId || currentPicId || '',
            todos: meeting.decision ? [{ id: crypto.randomUUID(), title: meeting.decision, done: false, picId: meeting.picId || currentPicId || '' }] : [],
            isNew: true
        });
    };

    const handleAddMember = async (memberData) => {
        const { name, email, role, division } = memberData;
        if (!name || !name.trim()) return;

        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
        const newMember = {
            id: crypto.randomUUID(),
            name: name.trim(),
            email: email ? email.trim() : null,
            division: division || 'Marcomm',
            role: role || 'Staff',
            position: role || 'Staff',
            color: randomColor
        };

        const { error } = await supabase.from('members').insert({
            id: newMember.id,
            name: newMember.name,
            email: newMember.email,
            position: newMember.position,
            division: newMember.division,
            role: newMember.role,
            color: newMember.color
        });

        if (error) {
            console.error('Supabase member insert error:', error);
            alert(`Gagal menambah anggota: ${error.message}`);
            return;
        }

        setMembers(prev => [...prev, newMember]);
    };

    const handleDeleteMember = async (id) => {
        openDialog({
            type: 'confirm',
            message: 'Yakin ingin menghapus anggota ini? Tugas yang sedang dikerjakannya akan menjadi tanpa PIC.',
            onConfirm: async () => {
                const { error } = await supabase.from('members').delete().eq('id', id);

                if (error) {
                    console.error('Supabase member delete error:', error);
                    alert(`Gagal menghapus anggota: ${error.message}`);
                    return;
                }

                setMembers(prev => prev.filter(m => m.id !== id));
                setTasks(prev => prev.map(t => t.picId === id ? { ...t, picId: '' } : t));
            }
        });
    };

    const projectTasks = filteredTasks.filter(t => t.projectId === activeProject);
    const activeProjectObj = projects.find(p => p.id === activeProject);
    const fromProjectFolders = Array.isArray(activeProjectObj?.folders) ? activeProjectObj.folders : [];
    const fromTaskFolders = projectTasks.map(t => t.folder || 'General');
    const projectFoldersList = Array.from(new Set([...fromProjectFolders, ...fromTaskFolders, 'General'])).filter(Boolean);

    const currentTasks = projectTasks
        .filter(task => {
            const matchesSearch = (task.title || '').toLowerCase().includes(searchQuery.trim().toLowerCase());
            const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
            const matchesFolder = folderFilter === 'all' || (task.folder || 'General') === folderFilter;
            const matchesPic = picFilter === 'all' || (picFilter === 'none' ? !task.picId : task.picId === picFilter);
            const picMember = members.find(m => m.id === task.picId);
            const matchesDivision = divisionFilter === 'all' || (picMember?.division === divisionFilter);
            return matchesSearch && matchesStatus && matchesPriority && matchesFolder && matchesPic && matchesDivision;
        })
        .sort((a, b) => {
            if (sortMode === 'created_desc') {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
            }
            if (sortMode === 'created_asc') {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
                return aTime - bTime;
            }
            if (sortMode === 'deadline_asc') {
                const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
                const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
                return aTime - bTime;
            }
            if (sortMode === 'deadline_desc') {
                const aTime = a.deadline ? new Date(a.deadline).getTime() : 0;
                const bTime = b.deadline ? new Date(b.deadline).getTime() : 0;
                return bTime - aTime;
            }
            if (sortMode === 'priority_desc') {
                const rank = { High: 3, Medium: 2, Low: 1 };
                return (rank[b.priority] || 0) - (rank[a.priority] || 0);
            }
            if (sortMode === 'title_asc') {
                return (a.title || '').localeCompare(b.title || '');
            }
            return 0;
        });

    const summaryStats = projectTasks.reduce((stats, task) => {
        const deadlineState = getDeadlineState(task.deadline, task.status);
        const isDone = task.status === 'Done';
        const isInProgress = task.status === 'In Progress';
        const isTodo = task.status === 'To Do' || (!isDone && !isInProgress);
        return {
            total: stats.total + 1,
            todo: stats.todo + (isTodo ? 1 : 0),
            inProgress: stats.inProgress + (isInProgress ? 1 : 0),
            done: stats.done + (isDone ? 1 : 0),
            overdue: stats.overdue + (deadlineState === 'overdue' ? 1 : 0),
            today: stats.today + (deadlineState === 'today' ? 1 : 0)
        };
    }, { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, today: 0 });

    const resetTaskControls = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setPriorityFilter('all');
        setFolderFilter('all');
        setPicFilter('all');
        setDivisionFilter('all');
        setSortMode('deadline_asc');
    };

    const closeMobileSidebar = () => setIsSidebarOpen(false);

    const navigateView = (nextView) => {
        setView(nextView);
        closeMobileSidebar();
    };

    const handleSelectProject = (projectId) => {
        setActiveProject(projectId);
        if (view === 'members' || view === 'dashboard' || view === 'notes') setView('table');
        closeMobileSidebar();
    };

    const currentProjectName = projects.find(p => p.id === activeProject)?.name || 'Pilih Project';
    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (a.isPinned === b.isPinned) return 0;
        return a.isPinned ? -1 : 1;
    });

    return (
        <div className="min-h-screen bg-[linear-gradient(135deg,#ede9fe_0%,#e0f2fe_35%,#fce7f3_65%,#dbeafe_100%)] p-0 lg:p-3 font-sans text-slate-900">
            <div className="relative flex h-screen lg:h-[calc(100vh-1.5rem)] w-full max-w-[1720px] mx-auto overflow-hidden bg-white/60 border border-white/70 shadow-2xl backdrop-blur-xl lg:rounded-[32px]">
                {isSidebarOpen && (
                    <button
                        type="button"
                        aria-label="Tutup menu"
                        onClick={closeMobileSidebar}
                        className="fixed inset-0 z-[70] bg-slate-950/35 lg:hidden"
                    />
                )}

                {/* Sidebar */}
                <div className={`fixed inset-y-0 left-0 z-[80] flex w-72 max-w-[86vw] flex-col border-r border-white/70 bg-white/95 shadow-2xl shadow-slate-900/20 transition-transform duration-300 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:bg-white/25 lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-5 flex items-center justify-between font-semibold transition-colors mb-2">
                        <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-lg shadow-blue-500/20">
                                <img
                                    src="https://pub-deabb4838f9345c095b0dbe31add5535.r2.dev/abs%204%20(1).png"
                                    alt="Semua Divisi"
                                    className="w-full h-full object-contain p-1"
                                />
                            </div>
                            <span>Semua Divisi</span>
                        </div>
                        <button
                            type="button"
                            onClick={closeMobileSidebar}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden"
                            aria-label="Tutup menu"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div className="px-4 mb-2 mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Menu Utama</div>
                    <nav className="px-3 space-y-1 mb-6">
                        <button
                            onClick={() => navigateView('dashboard')}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all ${view === 'dashboard' ? 'tint-lavender shadow-sm' : 'text-slate-500 hover:bg-white/55 hover:text-slate-900'}`}
                        >
                            <span className="tint-lavender-solid w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0">
                                <i className="fa-solid fa-chart-simple"></i>
                            </span>
                            <span>Dashboard</span>
                        </button>
                        <button
                            onClick={() => navigateView('notes')}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all ${view === 'notes' ? 'tint-peach shadow-sm' : 'text-slate-500 hover:bg-white/55 hover:text-slate-900'}`}
                        >
                            <span className="tint-peach-solid w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0">
                                <i className="fa-regular fa-note-sticky"></i>
                            </span>
                            <span>Notes</span>
                        </button>
                        <button
                            onClick={() => {
                                setActiveProject('');
                                navigateView('calendar');
                            }}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all ${view === 'calendar' && !activeProject ? 'tint-pink shadow-sm' : 'text-slate-500 hover:bg-white/55 hover:text-slate-900'}`}
                        >
                            <span className="tint-pink-solid w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0">
                                <i className="fa-regular fa-calendar-days"></i>
                            </span>
                            <span>Semua Kalender</span>
                        </button>
                        <button
                            onClick={() => navigateView('members')}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all ${view === 'members' ? 'tint-mint shadow-sm' : 'text-slate-500 hover:bg-white/55 hover:text-slate-900'}`}
                        >
                            <span className="tint-mint-solid w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0">
                                <i className="fa-solid fa-users"></i>
                            </span>
                            <span>Anggota Tim</span>
                        </button>
                    </nav>

                    <div className="px-4 mb-2 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider group">
                        <span>Projects Workspace</span>
                        <button onClick={handleAddProject} className="text-gray-400 hover:text-gray-800 p-1 rounded hover:bg-gray-200 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100" title="Tambah Project">
                            <i className="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
                        {sortedProjects.map(project => (
                            <div key={project.id} className="group flex flex-col">
                                <div className="flex items-center justify-between group/proj">
                                    <button
                                        onClick={() => handleSelectProject(project.id)}
                                        className={`flex-1 flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-sm font-medium transition-all text-left min-w-0 ${activeProject === project.id && (view === 'table' || view === 'kanban' || view === 'timeline' || view === 'calendar') ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600 hover:bg-white/55 hover:text-slate-900'}`}
                                    >
                                        <i
                                            className={`fa-${activeProject === project.id && (view === 'table' || view === 'kanban' || view === 'timeline' || view === 'calendar') ? 'solid' : 'regular'} fa-folder w-4 text-center shrink-0`}
                                            style={{ color: project.color || '#6b7280' }}
                                        ></i>
                                        <span className="truncate flex-1">{project.name}</span>
                                        {project.isPinned && (
                                            <i className="fa-solid fa-thumbtack text-[10px] text-orange-500 shrink-0" title="Disematkan (Urgent)"></i>
                                        )}
                                        {project.showInCalendar && (
                                            <i className="fa-solid fa-calendar-days text-[10px] text-pink-500 shrink-0" title="Tampil di Kalender"></i>
                                        )}
                                    </button>

                                    {/* HANYA 1 TOMBOL: Project Settings */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProjectSettingsTarget(project);
                                            setIsProjectSettingsOpen(true);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-white/80 rounded-xl transition-all opacity-80 lg:opacity-0 lg:group-hover/proj:opacity-100 shrink-0 ml-0.5"
                                        title="Pengaturan Proyek (Warna, Sharing, Pin, Kalender, Hapus)"
                                        aria-label="Pengaturan Proyek"
                                    >
                                        <i className="fa-solid fa-gear text-xs"></i>
                                    </button>
                                </div>

                                {activeProject === project.id && (view === 'table' || view === 'kanban' || view === 'timeline' || view === 'calendar') && (
                                    <div className="ml-7 mt-1 space-y-1 border-l border-white/70 pl-2">
                                        <button
                                            onClick={() => navigateView('table')}
                                            className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors ${view === 'table' ? 'text-slate-950 bg-white/80 font-bold' : 'text-slate-500 hover:text-slate-800 hover:bg-white/55'}`}
                                        >
                                            <i className="fa-solid fa-list w-4"></i> Table
                                        </button>
                                        <button
                                            onClick={() => navigateView('kanban')}
                                            className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors ${view === 'kanban' ? 'text-slate-950 bg-white/80 font-bold' : 'text-slate-500 hover:text-slate-800 hover:bg-white/55'}`}
                                        >
                                            <i className="fa-solid fa-table-columns w-4"></i> Board
                                        </button>
                                        <button
                                            onClick={() => navigateView('timeline')}
                                            className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors ${view === 'timeline' ? 'text-slate-950 bg-white/80 font-bold' : 'text-slate-500 hover:text-slate-800 hover:bg-white/55'}`}
                                        >
                                            <i className="fa-solid fa-timeline w-4 text-indigo-500"></i> Timeline
                                        </button>
                                        <button
                                            onClick={() => navigateView('calendar')}
                                            className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors ${view === 'calendar' ? 'text-slate-950 bg-white/80 font-bold' : 'text-slate-500 hover:text-slate-800 hover:bg-white/55'}`}
                                        >
                                            <i className="fa-regular fa-calendar w-4 text-pink-500"></i> Calendar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>


                    <SidebarClock />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/35 min-w-0">
                    <header className="h-16 border-b border-white/60 flex items-center justify-between gap-3 px-4 lg:px-8 bg-white/25 backdrop-blur">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsSidebarOpen(true)}
                                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/70 text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-950 lg:hidden"
                                aria-label="Buka menu"
                            >
                                <i className="fa-solid fa-bars"></i>
                            </button>
                            <div className="flex min-w-0 items-center space-x-2 truncate text-sm text-gray-500">
                                {view === 'dashboard' ? (
                                    <>
                                        <i className="fa-solid fa-chart-simple text-gray-400"></i>
                                        <span className="font-medium text-gray-800">Dashboard</span>
                                    </>
                                ) : view === 'notes' ? (
                                    <>
                                        <i className="fa-regular fa-note-sticky text-gray-400"></i>
                                        <span className="font-medium text-gray-800">Notes</span>
                                    </>
                                ) : view === 'calendar' && !activeProject ? (
                                    <>
                                        <i className="fa-regular fa-calendar-days text-pink-500"></i>
                                        <span className="font-medium text-gray-800">Semua Kalender</span>
                                    </>
                                ) : view === 'members' ? (
                                    <>
                                        <i className="fa-solid fa-users text-gray-400"></i>
                                        <span className="font-medium text-gray-800">Daftar Anggota Tim</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-folder-open text-gray-400"></i>
                                        <span>{currentProjectName}</span>
                                        <span className="text-gray-300">/</span>
                                        <span className="font-medium text-gray-800">
                                            {view === 'kanban' && 'Task Board'}
                                            {view === 'table' && 'All Tasks'}
                                            {view === 'timeline' && 'Timeline & Roadmap'}
                                            {view === 'calendar' && 'Project Calendar'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {currentPicId && (
                                <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/70 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                                    <i className="fa-regular fa-user"></i>
                                    <span>{members.find(member => member.id === currentPicId)?.name || 'PIC'}</span>
                                </div>
                            )}
                            <button
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-100 sm:w-auto sm:px-3 sm:py-2"
                                title="Ganti Password"
                            >
                                <i className="fa-solid fa-key text-[11px] sm:mr-1.5"></i>
                                <span className="hidden sm:inline">Ganti Password</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100 sm:w-auto sm:px-3 sm:py-2"
                                title="Keluar"
                            >
                                <i className="fa-solid fa-arrow-right-from-bracket text-[11px] sm:mr-1.5"></i>
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                            <ShortcutLauncher
                                shortcuts={shortcuts}
                                onAddShortcut={handleAddShortcut}
                                onDeleteShortcut={handleDeleteShortcut}
                                onToggleShortcutFavorite={handleToggleShortcutFavorite}
                            />
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-8 custom-scrollbar">
                        {view === 'dashboard' && (
                            <MainDashboard
                                tasks={filteredTasks}
                                projects={projects}
                                members={filteredMembers}
                                shortcuts={shortcuts}
                                currentPicId={currentPicId}
                                session={session}
                                onEdit={handleEditTask}
                                onQuickAddTask={handleQuickAddTask}
                            />
                        )}

                        {view === 'notes' && (
                            <MinuteOfMeeting
                                notes={notes}
                                members={filteredMembers}
                                projects={filteredProjects}
                                divisions={divisionsList}
                                currentPicId={currentPicId}
                                session={session}
                                onAddNote={handleAddNote}
                                onUpdateNote={handleUpdateNote}
                                onDeleteNote={handleDeleteNote}
                                onCreateTaskFromActionItem={handleCreateTaskFromMeeting}
                                onBatchCreateTasks={handleBatchCreateTasks}
                            />
                        )}

                        {view === 'calendar' && !activeProject && (
                            <div className="w-full animate-fade-in space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-baseline">
                                            Semua Kalender
                                            <span className="text-slate-400 text-base font-normal ml-3">Semua Proyek & Divisi</span>
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">Menampilkan jadwal & deadline seluruh project yang diaktifkan di kalender</p>
                                    </div>
                                </div>
                                <AbsCalendar
                                    tasks={filteredTasks}
                                    projects={filteredProjects}
                                    members={filteredMembers}
                                    currentPicId={currentPicId}
                                    session={session}
                                    onEdit={handleEditTask}
                                    onCreateTask={handleAddTaskForDate}
                                    onToggleProjectCalendar={handleToggleProjectCalendar}
                                    isProjectCalendar={false}
                                />
                            </div>
                        )}

                        {view === 'calendar' && activeProject && (
                            <div className="w-full animate-fade-in space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-baseline">
                                        {currentProjectName}
                                        <span className="text-pink-600 text-xl font-normal ml-3">Calendar</span>
                                    </h2>

                                    {/* Asana Multi-View Tabs */}
                                    <div className="flex items-center bg-white/70 backdrop-blur-sm p-1 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
                                        <button
                                            onClick={() => navigateView('table')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-list text-xs"></i>
                                            <span>Table</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('kanban')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-table-columns text-xs"></i>
                                            <span>Board</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('timeline')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-timeline text-xs text-indigo-500"></i>
                                            <span>Timeline</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('calendar')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs transition"
                                        >
                                            <i className="fa-regular fa-calendar text-xs"></i>
                                            <span>Calendar</span>
                                        </button>
                                    </div>
                                </div>

                                <TaskSummary stats={summaryStats} />
                                <TaskControls
                                    members={filteredMembers}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    statusFilter={statusFilter}
                                    setStatusFilter={setStatusFilter}
                                    priorityFilter={priorityFilter}
                                    setPriorityFilter={setPriorityFilter}
                                    folderFilter={folderFilter}
                                    setFolderFilter={setFolderFilter}
                                    foldersList={projectFoldersList}
                                    picFilter={picFilter}
                                    setPicFilter={setPicFilter}
                                    divisionFilter={divisionFilter}
                                    setDivisionFilter={setDivisionFilter}
                                    divisionsList={divisionsList}
                                    sortMode={sortMode}
                                    setSortMode={setSortMode}
                                    onReset={resetTaskControls}
                                />
                                <AbsCalendar
                                    tasks={currentTasks}
                                    projects={filteredProjects}
                                    members={filteredMembers}
                                    currentPicId={currentPicId}
                                    session={session}
                                    onEdit={handleEditTask}
                                    onCreateTask={handleAddTaskForDate}
                                    onToggleProjectCalendar={handleToggleProjectCalendar}
                                    isProjectCalendar={true}
                                    projectName={currentProjectName}
                                />
                            </div>
                        )}

                        {view === 'members' && (
                            <div className="h-full animate-fade-in">
                                <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex flex-wrap items-baseline">
                                    Semua Divisi
                                    <span className="text-gray-400 text-xl font-normal ml-3">Anggota</span>
                                </h2>
                                <MembersTable members={filteredMembers} onAddMember={handleAddMember} onDeleteMember={handleDeleteMember} onToggleStatus={handleToggleMemberStatus} onResetPassword={handleResetPassword} currentUser={session} divisionsList={divisionsList} onAddDivision={handleAddDivision} />
                            </div>
                        )}

                        {view === 'kanban' && (
                            <div className="h-full animate-fade-in">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-baseline">
                                        {currentProjectName}
                                        <span className="text-slate-400 text-xl font-normal ml-3">Board</span>
                                    </h2>

                                    {/* Asana Multi-View Tabs */}
                                    <div className="flex items-center bg-white/70 backdrop-blur-sm p-1 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
                                        <button
                                            onClick={() => navigateView('table')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-list text-xs"></i>
                                            <span>Table</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('kanban')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs transition"
                                        >
                                            <i className="fa-solid fa-table-columns text-xs"></i>
                                            <span>Board</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('timeline')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-timeline text-xs text-indigo-500"></i>
                                            <span>Timeline</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('calendar')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-regular fa-calendar text-xs"></i>
                                            <span>Calendar</span>
                                        </button>
                                    </div>
                                </div>

                                <TaskSummary stats={summaryStats} />
                                <TaskControls
                                    members={filteredMembers}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    statusFilter={statusFilter}
                                    setStatusFilter={setStatusFilter}
                                    priorityFilter={priorityFilter}
                                    setPriorityFilter={setPriorityFilter}
                                    folderFilter={folderFilter}
                                    setFolderFilter={setFolderFilter}
                                    foldersList={projectFoldersList}
                                    picFilter={picFilter}
                                    setPicFilter={setPicFilter}
                                    divisionFilter={divisionFilter}
                                    setDivisionFilter={setDivisionFilter}
                                    divisionsList={divisionsList}
                                    sortMode={sortMode}
                                    setSortMode={setSortMode}
                                    onReset={resetTaskControls}
                                />
                                <KanbanView
                                    tasks={currentTasks}
                                    members={filteredMembers}
                                    projects={projects}
                                    onAdd={handleAddTask}
                                    onEdit={handleEditTask}
                                    onDelete={handleDeleteTask}
                                    onUpdatePriority={handleUpdatePriority}
                                    onUpdateStatus={handleUpdateStatus}
                                    onUpdateTask={handleSaveEditedTask}
                                />
                            </div>
                        )}

                        {view === 'table' && (
                            <div className="w-full animate-fade-in">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-baseline">
                                        {currentProjectName}
                                        <span className="text-slate-400 text-xl font-normal ml-3">Tasks</span>
                                    </h2>

                                    {/* Asana Multi-View Tabs */}
                                    <div className="flex items-center bg-white/70 backdrop-blur-sm p-1 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
                                        <button
                                            onClick={() => navigateView('table')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs transition"
                                        >
                                            <i className="fa-solid fa-list text-xs"></i>
                                            <span>Table</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('kanban')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-table-columns text-xs"></i>
                                            <span>Board</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('timeline')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-timeline text-xs text-indigo-500"></i>
                                            <span>Timeline</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('calendar')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-regular fa-calendar text-xs"></i>
                                            <span>Calendar</span>
                                        </button>
                                    </div>
                                </div>

                                <TaskSummary stats={summaryStats} />
                                <TaskControls
                                    members={filteredMembers}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    statusFilter={statusFilter}
                                    setStatusFilter={setStatusFilter}
                                    priorityFilter={priorityFilter}
                                    setPriorityFilter={setPriorityFilter}
                                    folderFilter={folderFilter}
                                    setFolderFilter={setFolderFilter}
                                    foldersList={projectFoldersList}
                                    picFilter={picFilter}
                                    setPicFilter={setPicFilter}
                                    divisionFilter={divisionFilter}
                                    setDivisionFilter={setDivisionFilter}
                                    divisionsList={divisionsList}
                                    sortMode={sortMode}
                                    setSortMode={setSortMode}
                                    onReset={resetTaskControls}
                                />
                                <TableView
                                    tasks={currentTasks}
                                    members={filteredMembers}
                                    projects={projects}
                                    foldersList={projectFoldersList}
                                    sortMode={sortMode}
                                    setSortMode={setSortMode}
                                    onAdd={handleAddTask}
                                    onEdit={handleEditTask}
                                    onDelete={handleDeleteTask}
                                    onUpdatePriority={handleUpdatePriority}
                                    onUpdateStatus={handleUpdateStatus}
                                    onUpdateTask={handleSaveEditedTask}
                                    onCreateFolder={(fName) => handleCreateFolder(activeProject, fName)}
                                    onRenameFolder={(oldName, newName) => handleRenameFolder(activeProject, oldName, newName)}
                                    onDeleteFolder={(fName) => handleDeleteFolder(activeProject, fName)}
                                />
                            </div>
                        )}

                        {view === 'timeline' && (
                            <div className="w-full animate-fade-in">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-baseline">
                                        {currentProjectName}
                                        <span className="text-indigo-600 text-xl font-normal ml-3">Timeline</span>
                                    </h2>

                                    {/* Asana Multi-View Tabs */}
                                    <div className="flex items-center bg-white/70 backdrop-blur-sm p-1 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
                                        <button
                                            onClick={() => navigateView('table')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-list text-xs"></i>
                                            <span>Table</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('kanban')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-solid fa-table-columns text-xs"></i>
                                            <span>Board</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('timeline')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs transition"
                                        >
                                            <i className="fa-solid fa-timeline text-xs text-white"></i>
                                            <span>Timeline</span>
                                        </button>
                                        <button
                                            onClick={() => navigateView('calendar')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition"
                                        >
                                            <i className="fa-regular fa-calendar text-xs"></i>
                                            <span>Calendar</span>
                                        </button>
                                    </div>
                                </div>

                                <TaskSummary stats={summaryStats} />
                                <TaskControls
                                    members={filteredMembers}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    statusFilter={statusFilter}
                                    setStatusFilter={setStatusFilter}
                                    priorityFilter={priorityFilter}
                                    setPriorityFilter={setPriorityFilter}
                                    picFilter={picFilter}
                                    setPicFilter={setPicFilter}
                                    divisionFilter={divisionFilter}
                                    setDivisionFilter={setDivisionFilter}
                                    divisionsList={divisionsList}
                                    sortMode={sortMode}
                                    setSortMode={setSortMode}
                                    onReset={resetTaskControls}
                                />
                                <TimelineView
                                    tasks={currentTasks}
                                    members={filteredMembers}
                                    projects={projects}
                                    onEdit={handleEditTask}
                                    onAdd={handleAddTask}
                                    onUpdateStatus={handleUpdateStatus}
                                />
                            </div>
                        )}
                    </main>
                </div>

            </div>

            <CustomDialog dialog={dialog} closeDialog={closeDialog} />
            <PasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} onSave={handleChangePassword} isForced={session?.requiresPasswordChange} />
            <TaskEditModal
                task={editingTask}
                projects={filteredProjects}
                members={filteredMembers}
                foldersList={projectFoldersList}
                onCreateFolder={(fName) => handleCreateFolder(activeProject, fName)}
                isOpen={!!editingTask}
                onClose={() => setEditingTask(null)}
                onSave={handleSaveEditedTask}
                session={session}
            />
            <ShareProjectModal project={shareProjectTarget} members={members} session={session} projectAccess={projectAccess} isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} onSave={handleSaveShareProject} />
            <CreateProjectModal members={members} session={session} isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSave={handleSaveNewProject} />
            <ProjectSettingsModal
                project={projects.find(p => p.id === projectSettingsTarget?.id) || projectSettingsTarget}
                members={members}
                session={session}
                projectAccess={projectAccess}
                isOpen={isProjectSettingsOpen}
                onClose={() => setIsProjectSettingsOpen(false)}
                onUpdateColor={handleUpdateProjectColor}
                onToggleCalendar={handleToggleProjectCalendar}
                onTogglePin={handleTogglePinProject}
                onSaveSharing={handleSaveShareProject}
                onDeleteProject={handleDeleteProject}
                onUpdateName={handleUpdateProjectName}
            />
        </div>
    );

}