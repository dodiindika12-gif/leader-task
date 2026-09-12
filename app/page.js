"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import TimelineView from '../components/TimelineView';
import MinuteOfMeeting from '../components/MinuteOfMeeting';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import WeeklyScheduleView, { getRoleLevel, isMeetingSchedule, isWorksheetSchedule } from '../components/WeeklyScheduleView';
import MainDashboard from '../components/MainDashboard';
import NotificationCenter from '../components/NotificationCenter';


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
const ROLES = ['Staff', 'Koordinator', 'SPV', 'Manager', 'Direksi'];
const INITIAL_ROLES = [
    { id: 'role-1', name: 'Staff', level: 1, description: 'Staf pelaksana teknis di departemen' },
    { id: 'role-2', name: 'Koordinator', level: 2, description: 'Atasan / Kepala Departemen (langsung di bawah SPV)' },
    { id: 'role-3', name: 'SPV', level: 3, description: 'Supervisor operasional divisi (bisa multi-SPV per divisi, cth: SPV Finance, SPV Accounting, SPV Tax)' },
    { id: 'role-4', name: 'Manager', level: 4, description: 'Manager pimpinan/pembina divisi (membawahi seluruh SPV di divisinya, cth: Manager FAT)' },
    { id: 'role-5', name: 'Direksi', level: 5, description: 'Jajaran direksi dan eksekutif tertinggi (pengawas lintas divisi)' }
];

const PERMISSION_MODULES = [
    {
        id: 'task',
        name: 'Manajemen Task & Tugas',
        icon: 'fa-list-check',
        color: 'emerald',
        items: [
            { key: 'task.create', label: 'Buat Task Baru', desc: 'Dapat membuat task/tugas baru di project yang diikuti' },
            { key: 'task.edit_own', label: 'Edit Task Sendiri', desc: 'Dapat mengubah task yang dibuat atau di-assign ke diri sendiri' },
            { key: 'task.edit_dept', label: 'Edit Task 1 Departemen', desc: 'Dapat mengedit task milik rekan kerja dalam 1 departemen' },
            { key: 'task.edit_div', label: 'Edit Task Seluruh Divisi', desc: 'Dapat mengedit task seluruh staf di departemen berbeda dalam 1 divisi' },
            { key: 'task.edit_all', label: 'Edit Semua Task Lintas Divisi', desc: 'Dapat mengedit task milik siapa saja di semua divisi perusahaan' },
            { key: 'task.delete_own', label: 'Hapus Task Sendiri', desc: 'Dapat menghapus task milik diri sendiri' },
            { key: 'task.delete_div', label: 'Hapus Task Anggota Divisi', desc: 'Dapat menghapus task anggota divisi yang dibawahi' },
            { key: 'task.delete_all', label: 'Hapus Semua Task Apapun', desc: 'Dapat menghapus task apapun secara permanen' },
            { key: 'task.view_all_div', label: 'Lihat Task Semua Divisi', desc: 'Bebas membuka filter divisi lain tanpa batasan departemen' },
        ]
    },
    {
        id: 'workspace',
        name: 'Project Workspace & Sharing',
        icon: 'fa-folder-open',
        color: 'sky',
        items: [
            { key: 'workspace.create', label: 'Buat Workspace Project', desc: 'Dapat membuat project/folder baru' },
            { key: 'workspace.edit', label: 'Ubah Nama & Warna Project', desc: 'Dapat merename project dan mengganti warna/pin' },
            { key: 'workspace.delete', label: 'Hapus Project Workspace', desc: 'Dapat menghapus project beserta task di dalamnya' },
            { key: 'workspace.share_dept', label: 'Share Workspace ke Departemen', desc: 'Dapat membagikan project ke anggota departemen' },
            { key: 'workspace.share_div', label: 'Share Workspace ke Seluruh Divisi', desc: 'Dapat membagikan project ke seluruh staf divisi' },
            { key: 'workspace.share_all', label: 'Share Workspace Publik / Semua', desc: 'Dapat membuka project untuk seluruh perusahaan' },
        ]
    },
    {
        id: 'organization',
        name: 'Struktur Divisi & Departemen',
        icon: 'fa-sitemap',
        color: 'violet',
        items: [
            { key: 'organization.view_structure', label: 'Lihat Struktur Bagan', desc: 'Dapat melihat daftar divisi, departemen, dan atasan' },
            { key: 'organization.manage_division', label: 'Kelola Divisi (Tambah/Hapus/Edit)', desc: 'Wewenang membuat divisi baru atau merubah nama divisi' },
            { key: 'organization.manage_department', label: 'Kelola Departemen', desc: 'Wewenang menambah, mengedit, atau menghapus sub-departemen' },
            { key: 'organization.assign_leaders', label: 'Tunjuk Manager & SPV Divisi', desc: 'Wewenang menentukan siapa Manager & SPV untuk suatu divisi' },
        ]
    },
    {
        id: 'users',
        name: 'Pengelolaan User & Karyawan',
        icon: 'fa-users-gear',
        color: 'teal',
        items: [
            { key: 'users.view_list', label: 'Lihat Daftar Karyawan', desc: 'Melihat direktori anggota tim' },
            { key: 'users.create_dept', label: 'Tambah Anggota Departemen', desc: 'Mendaftarkan anggota baru ke departemen sendiri' },
            { key: 'users.create_div', label: 'Tambah Anggota Seluruh Divisi', desc: 'Mendaftarkan anggota baru ke divisi manapun yang dibawahi' },
            { key: 'users.edit_div', label: 'Edit Profil Anggota Divisi', desc: 'Mengubah nama, email, jabatan, atau departemen staf' },
            { key: 'users.toggle_status', label: 'Aktifkan / Nonaktifkan Akun', desc: 'Menonaktifkan akses login anggota yang cuti atau resign' },
            { key: 'users.reset_password', label: 'Reset Password Karyawan', desc: 'Mereset password user kembali ke password123' },
        ]
    },
    {
        id: 'roles_auth',
        name: 'Master Jabatan & Otorisasi',
        icon: 'fa-shield-halved',
        color: 'amber',
        items: [
            { key: 'roles_auth.view_matrix', label: 'Lihat Matriks Hak Akses', desc: 'Melihat daftar izin dan wewenang tiap jabatan' },
            { key: 'roles_auth.edit_matrix', label: 'Ubah Hak Akses Interaktif', desc: 'Mengubah checklist izin per jabatan secara langsung' },
            { key: 'roles_auth.manage_roles', label: 'Kelola Master Jabatan', desc: 'Menambah jabatan baru atau menghapus tingkatan jabatan' },
        ]
    },
    {
        id: 'notes',
        name: 'Catatan & Notulen (MoM)',
        icon: 'fa-file-lines',
        color: 'pink',
        items: [
            { key: 'notes.create_notes', label: 'Buat Catatan Pribadi / MoM', desc: 'Dapat membuat notulen rapat dan catatan kerja' },
            { key: 'notes.share_notes', label: 'Bagikan Catatan ke Rekan / Tim', desc: 'Dapat mempublikasikan catatan rapat ke divisi/perusahaan' },
        ]
    },
    {
        id: 'reports',
        name: 'Laporan & Ekspor Data',
        icon: 'fa-chart-pie',
        color: 'rose',
        items: [
            { key: 'reports.export_excel', label: 'Ekspor Data ke Excel', desc: 'Dapat mengunduh rekap task dan matriks otorisasi' },
            { key: 'reports.view_analytics', label: 'Lihat Analytics & KPI Divisi', desc: 'Melihat rekap pencapaian task dan workload anggota' },
        ]
    }
];

const DEFAULT_ROLE_PERMISSIONS = {
    'Staff': {
        'task.create': true, 'task.edit_own': true, 'task.delete_own': true,
        'workspace.create': true, 'workspace.share_dept': true,
        'organization.view_structure': true,
        'users.view_list': true,
        'notes.create_notes': true
    },
    'Koordinator': {
        'task.create': true, 'task.edit_own': true, 'task.edit_dept': true, 'task.delete_own': true,
        'workspace.create': true, 'workspace.edit': true, 'workspace.share_dept': true, 'workspace.share_div': true,
        'organization.view_structure': true,
        'users.view_list': true, 'users.create_dept': true,
        'roles_auth.view_matrix': true,
        'notes.create_notes': true, 'notes.share_notes': true,
        'reports.export_excel': true, 'reports.view_analytics': true
    },
    'SPV': {
        'task.create': true, 'task.edit_own': true, 'task.edit_dept': true, 'task.edit_div': true, 'task.delete_own': true, 'task.delete_div': true,
        'workspace.create': true, 'workspace.edit': true, 'workspace.delete': true, 'workspace.share_dept': true, 'workspace.share_div': true,
        'organization.view_structure': true, 'organization.manage_department': true,
        'users.view_list': true, 'users.create_dept': true, 'users.create_div': true, 'users.edit_div': true, 'users.toggle_status': true, 'users.reset_password': true,
        'roles_auth.view_matrix': true,
        'notes.create_notes': true, 'notes.share_notes': true,
        'reports.export_excel': true, 'reports.view_analytics': true
    },
    'Manager': {
        'task.create': true, 'task.edit_own': true, 'task.edit_dept': true, 'task.edit_div': true, 'task.delete_own': true, 'task.delete_div': true, 'task.view_all_div': true,
        'workspace.create': true, 'workspace.edit': true, 'workspace.delete': true, 'workspace.share_dept': true, 'workspace.share_div': true, 'workspace.share_all': true,
        'organization.view_structure': true, 'organization.manage_division': true, 'organization.manage_department': true, 'organization.assign_leaders': true,
        'users.view_list': true, 'users.create_dept': true, 'users.create_div': true, 'users.edit_div': true, 'users.toggle_status': true, 'users.reset_password': true,
        'roles_auth.view_matrix': true,
        'notes.create_notes': true, 'notes.share_notes': true,
        'reports.export_excel': true, 'reports.view_analytics': true
    },
    'Direksi': {
        'task.create': true, 'task.edit_own': true, 'task.edit_dept': true, 'task.edit_div': true, 'task.edit_all': true, 'task.delete_own': true, 'task.delete_div': true, 'task.delete_all': true, 'task.view_all_div': true,
        'workspace.create': true, 'workspace.edit': true, 'workspace.delete': true, 'workspace.share_dept': true, 'workspace.share_div': true, 'workspace.share_all': true,
        'organization.view_structure': true, 'organization.manage_division': true, 'organization.manage_department': true, 'organization.assign_leaders': true,
        'users.view_list': true, 'users.create_dept': true, 'users.create_div': true, 'users.edit_div': true, 'users.toggle_status': true, 'users.reset_password': true,
        'roles_auth.view_matrix': true, 'roles_auth.edit_matrix': true, 'roles_auth.manage_roles': true,
        'notes.create_notes': true, 'notes.share_notes': true,
        'reports.export_excel': true, 'reports.view_analytics': true
    },
    'Super User': {
        // Super User has full access to all permissions
    }
};

const hasPermission = (currentUser, permissionKey, rolesList = []) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super User' || currentUser.role === 'Direksi') return true;
    
    // Check in role permissions if available
    const roleObj = Array.isArray(rolesList) ? rolesList.find(r => r.name === currentUser.role) : null;
    if (roleObj?.permissions && roleObj.permissions[permissionKey] !== undefined) {
        return Boolean(roleObj.permissions[permissionKey]);
    }
    
    // Check default role permissions
    const defaults = DEFAULT_ROLE_PERMISSIONS[currentUser.role];
    if (defaults && defaults[permissionKey] !== undefined) {
        return Boolean(defaults[permissionKey]);
    }
    
    return false;
};

const PIN_UNLOCK_KEY = 'task_abs_tools_pin_unlock_until';
const CURRENT_PIC_KEY = 'task_abs_tools_current_pic_id';
const PIN_UNLOCK_DURATION = 12 * 60 * 60 * 1000;

const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

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

const getDeadlineDiffDays = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
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
    const [showPass, setShowPass] = useState(false);
    const [showRepeatPass, setShowRepeatPass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isPasswordSaved, setIsPasswordSaved] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [activeDeviceTab, setActiveDeviceTab] = useState('android');

    useEffect(() => {
        if (!isOpen) {
            setIsPasswordSaved(false);
            setNewPass('');
            setRepeatPass('');
            setShowPass(false);
            setShowRepeatPass(false);
            return;
        }

        if (typeof window !== 'undefined') {
            const standalone = 
                window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true ||
                document.referrer.includes('android-app://');
            setIsStandalone(standalone);

            const ua = window.navigator.userAgent.toLowerCase();
            if (/iphone|ipad|ipod/.test(ua)) {
                setActiveDeviceTab('ios');
            } else if (/android/.test(ua)) {
                setActiveDeviceTab('android');
            } else {
                setActiveDeviceTab('desktop');
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleTriggerPWA = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('open-pwa-install'));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPass.length < 6) {
            alert('Password baru minimal 6 karakter!');
            return;
        }
        if (newPass !== repeatPass) {
            alert('Password Baru dan Ulangi Password tidak cocok!');
            return;
        }
        setSaving(true);
        const success = await onSave(newPass);
        setSaving(false);
        if (success) {
            if (isForced) {
                // Tampilkan konfirmasi dan kesempatan untuk membaca / menginstal PWA
                setIsPasswordSaved(true);
            } else {
                setNewPass('');
                setRepeatPass('');
                onClose();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
                onClick={!isForced ? onClose : undefined}
            ></div>

            {/* Modal Card */}
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-scale-in border border-slate-100 flex flex-col max-h-[92vh] my-auto">
                {/* Header */}
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 via-pink-500 to-rose-400 p-0.5 shadow-md shadow-pink-500/20 flex items-center justify-center shrink-0">
                            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center overflow-hidden p-1">
                                <img src="/Logo%20Beauty.png" alt="Busana" className="w-full h-full object-contain" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                                    {isPasswordSaved ? 'Password Berhasil Diubah' : (isForced ? 'Pengaturan Awal Akun' : 'Ganti Password')}
                                </h3>
                                {isForced && !isPasswordSaved && (
                                    <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-2 py-0.5 rounded-full border border-pink-200">
                                        Wajib
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                {isPasswordSaved 
                                    ? 'Langkah berikutnya: Pasang aplikasi Busana di perangkat Anda'
                                    : (isForced ? 'Ubah password default dan pasang aplikasi Busana (PWA)' : 'Perbarui kata sandi login akun Anda')
                                }
                            </p>
                        </div>
                    </div>
                    {!isForced && !isPasswordSaved && (
                        <button 
                            onClick={onClose} 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm transition"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}
                </div>

                {/* Content Body */}
                <div className="overflow-y-auto p-5 sm:px-6 py-4 space-y-4">
                    {/* View saat password berhasil diubah (Post-Save View) */}
                    {isPasswordSaved ? (
                        <div className="space-y-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto border border-emerald-100 shadow-sm animate-bounce-short">
                                <i className="fa-solid fa-circle-check"></i>
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-slate-900">Kata Sandi Berhasil Diperbarui!</h4>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                                    Akun Anda kini terlindungi dengan password baru. Sangat disarankan untuk memasang aplikasi Busana agar pekerjaan harian lebih praktis.
                                </p>
                            </div>

                            {/* PWA Instruction Box */}
                            <div className="text-left bg-gradient-to-br from-pink-50/80 via-white to-purple-50/60 rounded-2xl border border-pink-200/80 p-4 space-y-3 shadow-xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-pink-100 p-1 flex items-center justify-center shrink-0">
                                        <img src="/Logo%20Beauty.png" alt="Busana" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-pacifico text-sm text-slate-800" style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}>Busana</span>
                                            <span className="text-[9px] bg-pink-500 text-white font-bold px-1.5 py-0.2 rounded-md">PWA</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate">Beauty Task Management</p>
                                    </div>
                                </div>

                                {isStandalone ? (
                                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 font-medium">
                                        <i className="fa-solid fa-circle-check text-emerald-500 text-sm"></i>
                                        <span>Aplikasi Busana sudah terpasang di perangkat ini.</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleTriggerPWA}
                                        className="w-full bg-gradient-to-r from-[#e1007a] via-[#ec268f] to-[#a855f7] hover:opacity-95 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md shadow-pink-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <i className="fa-solid fa-download text-xs"></i>
                                        <span>Instal Aplikasi Busana Sekarang</span>
                                    </button>
                                )}

                                {/* Platform Guides */}
                                <div className="pt-2 border-t border-pink-100/80 space-y-2">
                                    <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1 rounded-xl text-[10px] font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setActiveDeviceTab('android')}
                                            className={`py-1.5 px-1 rounded-lg transition text-center cursor-pointer ${
                                                activeDeviceTab === 'android' ? 'bg-white text-pink-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <i className="fa-brands fa-android mr-1"></i>Android
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveDeviceTab('ios')}
                                            className={`py-1.5 px-1 rounded-lg transition text-center cursor-pointer ${
                                                activeDeviceTab === 'ios' ? 'bg-white text-pink-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <i className="fa-brands fa-apple mr-1"></i>iPhone/iPad
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveDeviceTab('desktop')}
                                            className={`py-1.5 px-1 rounded-lg transition text-center cursor-pointer ${
                                                activeDeviceTab === 'desktop' ? 'bg-white text-pink-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <i className="fa-solid fa-laptop mr-1"></i>Laptop/PC
                                        </button>
                                    </div>

                                    <div className="bg-white/95 rounded-xl p-3 border border-pink-100 text-[11px] text-slate-600 space-y-1.5">
                                        {activeDeviceTab === 'android' && (
                                            <>
                                                <div className="flex items-start gap-2">
                                                    <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                                                    <span>Klik tombol <strong>"Instal Aplikasi Busana"</strong> di atas atau buka menu titik tiga (<strong>⋮</strong>) Chrome.</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                                                    <span>Pilih <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</span>
                                                </div>
                                            </>
                                        )}
                                        {activeDeviceTab === 'ios' && (
                                            <>
                                                <div className="flex items-start gap-2">
                                                    <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                                                    <span>Buka di browser <strong>Safari</strong> lalu ketuk tombol <strong>Bagikan (Share <i className="fa-solid fa-arrow-up-from-bracket text-pink-600"></i>)</strong> di menu bawah.</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                                                    <span>Gulir ke bawah dan ketuk <strong>"Tambahkan ke Layar Utama" (➕)</strong> lalu klik Tambah.</span>
                                                </div>
                                            </>
                                        )}
                                        {activeDeviceTab === 'desktop' && (
                                            <>
                                                <div className="flex items-start gap-2">
                                                    <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                                                    <span>Di Google Chrome / Microsoft Edge, klik ikon instalasi (<i className="fa-solid fa-desktop text-pink-600"></i>) di ujung kanan bilah URL.</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                                                    <span>Klik <strong>"Instal"</strong> untuk memasang Busana di desktop komputer Anda.</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsPasswordSaved(false);
                                    onClose();
                                }}
                                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                                <span>Selesai & Masuk ke Dashboard Busana</span>
                                <i className="fa-solid fa-arrow-right text-xs"></i>
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Alert default password */}
                            {isForced && (
                                <div className="bg-amber-50/90 border border-amber-200/80 text-amber-900 p-3 rounded-2xl text-xs flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                                    </div>
                                    <div className="flex-1 min-w-0 leading-relaxed">
                                        <strong className="block font-semibold text-amber-950">Password Bawaan Terdeteksi</strong>
                                        Demi keamanan akun Anda, silakan buat password baru (minimal 6 karakter) sebelum melanjutkan.
                                    </div>
                                </div>
                            )}

                            {/* Form Ganti Password */}
                            <form onSubmit={handleSubmit} className="space-y-3.5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-900 mb-1">
                                        Password Baru <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type={showPass ? 'text' : 'password'} 
                                            value={newPass} 
                                            onChange={e => setNewPass(e.target.value)} 
                                            className="w-full text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition placeholder:text-slate-400" 
                                            placeholder="Masukkan password baru..." 
                                            required 
                                            minLength={6} 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPass(!showPass)} 
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-xs p-1 transition"
                                            tabIndex={-1}
                                        >
                                            <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-900 mb-1">
                                        Ulangi Password Baru <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type={showRepeatPass ? 'text' : 'password'} 
                                            value={repeatPass} 
                                            onChange={e => setRepeatPass(e.target.value)} 
                                            className="w-full text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition placeholder:text-slate-400" 
                                            placeholder="Ketik ulang password baru..." 
                                            required 
                                            minLength={6} 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowRepeatPass(!showRepeatPass)} 
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-xs p-1 transition"
                                            tabIndex={-1}
                                        >
                                            <i className={`fa-solid ${showRepeatPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                    </div>
                                    {repeatPass && (
                                        <div className="mt-1 text-[11px]">
                                            {newPass === repeatPass ? (
                                                <span className="text-emerald-600 flex items-center gap-1 font-medium">
                                                    <i className="fa-solid fa-circle-check"></i> Password cocok
                                                </span>
                                            ) : (
                                                <span className="text-rose-500 flex items-center gap-1 font-medium">
                                                    <i className="fa-solid fa-circle-xmark"></i> Password belum sama
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={saving || (newPass && repeatPass && newPass !== repeatPass)} 
                                    className="w-full bg-gradient-to-r from-[#e1007a] via-[#ec268f] to-[#a855f7] hover:opacity-95 text-white rounded-xl py-2.5 text-xs sm:text-sm font-bold shadow-md shadow-pink-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                >
                                    {saving ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                                            <span>Menyimpan Password...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-shield-halved text-xs"></i>
                                            <span>Simpan Password Baru</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Section PWA Instruction */}
                            <div className="pt-3 border-t border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
                                        <h4 className="text-xs font-bold text-slate-800">Instruksi Pasang Aplikasi (PWA)</h4>
                                    </div>
                                    <span className="text-[10px] font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
                                        Rekomendasi
                                    </span>
                                </div>

                                <div className="bg-gradient-to-br from-pink-50/70 via-white to-purple-50/50 rounded-2xl border border-pink-200/70 p-3.5 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-pink-100 p-1 flex items-center justify-center shrink-0">
                                                <img src="/Logo%20Beauty.png" alt="Busana" className="w-full h-full object-contain" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-pacifico text-sm text-slate-800" style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}>Busana</span>
                                                    <span className="text-[9px] bg-pink-500 text-white font-bold px-1.5 py-0.2 rounded-md">PWA</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 truncate">Beauty Task Management</p>
                                            </div>
                                        </div>

                                        {!isStandalone && (
                                            <button
                                                type="button"
                                                onClick={handleTriggerPWA}
                                                className="shrink-0 bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <i className="fa-solid fa-download text-[10px]"></i>
                                                <span>Instal Sekarang</span>
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Pasang aplikasi ke layar utama HP / komputer Anda untuk akses cepat tanpa bilah browser dan notifikasi tugas langsung.
                                    </p>

                                    {/* Tabs Platform Guide */}
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1 rounded-xl text-[10px] font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => setActiveDeviceTab('android')}
                                                className={`py-1.5 px-1 rounded-lg transition text-center cursor-pointer ${
                                                    activeDeviceTab === 'android' ? 'bg-white text-pink-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                <i className="fa-brands fa-android mr-1"></i>Android
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveDeviceTab('ios')}
                                                className={`py-1.5 px-1 rounded-lg transition text-center cursor-pointer ${
                                                    activeDeviceTab === 'ios' ? 'bg-white text-pink-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                <i className="fa-brands fa-apple mr-1"></i>iPhone/iPad
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveDeviceTab('desktop')}
                                                className={`py-1.5 px-1 rounded-lg transition text-center cursor-pointer ${
                                                    activeDeviceTab === 'desktop' ? 'bg-white text-pink-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                <i className="fa-solid fa-laptop mr-1"></i>Laptop/PC
                                            </button>
                                        </div>

                                        <div className="bg-white/95 rounded-xl p-2.5 border border-pink-100 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                                            {activeDeviceTab === 'android' && (
                                                <>
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="w-3.5 h-3.5 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">1</span>
                                                        <span>Klik tombol <strong>"Instal Sekarang"</strong> di atas atau menu titik tiga (<strong>⋮</strong>) di Chrome.</span>
                                                    </div>
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="w-3.5 h-3.5 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">2</span>
                                                        <span>Pilih <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</span>
                                                    </div>
                                                </>
                                            )}
                                            {activeDeviceTab === 'ios' && (
                                                <>
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="w-3.5 h-3.5 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">1</span>
                                                        <span>Buka di browser <strong>Safari</strong> lalu ketuk tombol <strong>Bagikan (Share <i className="fa-solid fa-arrow-up-from-bracket text-pink-600"></i>)</strong>.</span>
                                                    </div>
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="w-3.5 h-3.5 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">2</span>
                                                        <span>Gulir ke bawah dan ketuk <strong>"Tambahkan ke Layar Utama" (➕)</strong> lalu klik Tambah.</span>
                                                    </div>
                                                </>
                                            )}
                                            {activeDeviceTab === 'desktop' && (
                                                <>
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="w-3.5 h-3.5 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">1</span>
                                                        <span>Di browser Chrome/Edge, klik tombol <strong>"Instal Sekarang"</strong> atau ikon instal (<i className="fa-solid fa-desktop text-pink-600"></i>) di bilah URL.</span>
                                                    </div>
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="w-3.5 h-3.5 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">2</span>
                                                        <span>Klik <strong>"Instal"</strong> pada jendela konfirmasi browser.</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export const getProjectMembers = (project, allMembers = [], projectAccess = [], currentPicId = null) => {
    if (!allMembers || allMembers.length === 0) return [];
    if (!project) {
        return allMembers.filter(m => m.is_active !== false || m.id === currentPicId);
    }

    // 1. Owner of the project
    const ownerId = project.owner_id || project.ownerId;

    // 2. Members explicitly granted access in project_access
    const accessMemberIds = (projectAccess || [])
        .filter(pa => pa.project_id === project.id)
        .map(pa => pa.member_id);

    // Build the set of allowed IDs
    const allowedIds = new Set(
        [ownerId, ...accessMemberIds, currentPicId]
            .filter(Boolean)
            .map(id => String(id).trim().toLowerCase())
    );

    // Case 1: Project has an owner_id OR has entries in project_access
    if (ownerId || accessMemberIds.length > 0) {
        const filtered = allMembers.filter(m => {
            if (m.is_active === false && m.id !== currentPicId) return false;
            return (
                allowedIds.has(String(m.id).toLowerCase()) ||
                (m.email && allowedIds.has(String(m.email).toLowerCase().trim())) ||
                (m.name && allowedIds.has(String(m.name).toLowerCase().trim()))
            );
        });

        return filtered.length > 0 ? filtered : allMembers;
    }

    // Case 2: Legacy project without explicit owner or project_access.
    // If it has a specific division, only include members of that division (or current PIC).
    if (project.division && project.division !== 'All' && project.division !== 'Task ABS') {
        const divisionMembers = allMembers.filter(m => {
            if (m.is_active === false && m.id !== currentPicId) return false;
            if (currentPicId && String(m.id).toLowerCase() === String(currentPicId).toLowerCase()) return true;
            return m.division === project.division;
        });

        return divisionMembers.length > 0 ? divisionMembers : allMembers;
    }

    // Case 3: Default fallback
    return allMembers.filter(m => m.is_active !== false || m.id === currentPicId);
};

const TaskEditModal = ({ task, projects, members, foldersList = ['General'], onCreateFolder, isOpen, onClose, onSave, session = null, projectAccess = [] }) => {
    const loggedInMemberId = session?.memberId || '';
    const [editedTask, setEditedTask] = useState(task || {});
    const [todoDraft, setTodoDraft] = useState('');
    const [todoPicDraft, setTodoPicDraft] = useState(loggedInMemberId);
    const [todoDeadlineDraft, setTodoDeadlineDraft] = useState('');
    const [isAddingNewFolder, setIsAddingNewFolder] = useState(false);
    const [newFolderDraft, setNewFolderDraft] = useState('');

    const currentProject = (projects || []).find(p => p.id === (editedTask.projectId || task?.projectId));
    const projectMembers = useMemo(() => {
        return getProjectMembers(currentProject, members, projectAccess, editedTask.picId);
    }, [currentProject, members, projectAccess, editedTask.picId]);

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
                                {projectMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.position || m.role || 'Staff'}) {m.id === loggedInMemberId ? '(Saya)' : ''}
                                    </option>
                                ))}
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
                                        {getProjectMembers(currentProject, members, projectAccess, todo.picId).map(member => (
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
                                        {projectMembers.map(member => (
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

const TaskCard = ({ task, members, projects = [], onEdit, onDelete, onUpdatePriority, onUpdateStatus, onUpdateTask, isListView = false, projectAccess = [] }) => {
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
    const diffDays = getDeadlineDiffDays(task.deadline);
    const pic = members.find(m => m.id === task.picId);
    const todoProgress = getTodoProgress(task);
    const project = projects.find(p => p.id === task.projectId);
    const projectMembers = useMemo(() => {
        return getProjectMembers(project, members, projectAccess, task.picId);
    }, [project, members, projectAccess, task.picId]);
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
                                        className={`text-[11px] font-medium flex items-center hover:bg-gray-200 px-1 py-0.5 rounded -ml-1 transition-colors ${isOverdue ? 'text-rose-600 font-semibold' : isDueToday ? 'text-amber-600 font-semibold' : 'text-gray-500'}`}
                                    >
                                        <i className="fa-regular fa-calendar mr-1.5"></i>
                                        {task.deadline ? formatDeadline(task.deadline) : 'Set Deadline'}
                                        {isOverdue && (
                                            <span className="ml-2 px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[10px] shadow-2xs flex items-center gap-1 animate-pulse">
                                                <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                                                {diffDays ? `Lewat ${Math.abs(diffDays)} Hari` : 'Overdue'}
                                            </span>
                                        )}
                                        {isDueToday && (
                                            <span className="ml-2 px-2 py-0.5 rounded-lg bg-amber-500 text-white font-bold text-[10px] shadow-2xs flex items-center gap-1">
                                                <i className="fa-solid fa-clock text-[9px]"></i>
                                                Hari Ini
                                            </span>
                                        )}
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
                            {projectMembers.map(member => (
                                <option key={member.id} value={member.id}>{member.name} ({member.position || member.role || 'Staff'})</option>
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
            className={`bg-white/80 p-3.5 rounded-3xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing group mb-3 relative flex flex-col min-h-[110px] backdrop-blur ${isDone ? 'border-white/60 bg-white/45' : isOverdue ? 'border-rose-300 bg-rose-50/25 shadow-xs ring-1 ring-rose-200/50' : isDueToday ? 'border-amber-300 bg-amber-50/25 shadow-xs ring-1 ring-amber-200/50' : 'border-white/75'}`}
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
                            className={`text-[10px] font-medium flex items-center bg-gray-50 px-1.5 py-1 rounded border hover:bg-gray-100 transition-colors ${isOverdue ? 'border-rose-200 text-rose-700 bg-rose-50 font-semibold' : isDueToday ? 'border-amber-200 text-amber-700 bg-amber-50 font-semibold' : 'border-gray-200 text-gray-500'}`}
                        >
                            <i className="fa-regular fa-calendar mr-1"></i> {task.deadline ? formatDeadline(task.deadline) : 'Set Deadline'}
                            {isOverdue && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-2xs">
                                    <i className="fa-solid fa-triangle-exclamation text-[8px]"></i>
                                    {diffDays ? `Lewat ${Math.abs(diffDays)}h` : 'Overdue'}
                                </span>
                            )}
                            {isDueToday && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-2xs">
                                    <i className="fa-solid fa-clock text-[8px]"></i>
                                    Hari Ini
                                </span>
                            )}
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
                                {projectMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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

const KanbanView = ({ tasks, members, projects, onAdd, onEdit, onDelete, onUpdatePriority, onUpdateStatus, onUpdateTask, projectAccess = [] }) => {
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
                                    projectAccess={projectAccess}
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
    onDeleteFolder,
    projectAccess = []
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
                                                    projectAccess={projectAccess}
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

// ==========================================
// ENTERPRISE ORGANIZATIONAL MANAGEMENT HUB
// ==========================================

// Helper to dynamically calculate Direct Supervisor based on filled positions (Skip-Level Hierarchy)
const resolveDirectSupervisor = (member, { divisions = [], departments = [], allMembers = [] }) => {
    if (!member) return null;

    const role = (member.role || member.position || 'Staff').toLowerCase();
    const divName = member.division;
    const deptName = member.department;

    // 1. If role is Direksi or Super User
    if (role.includes('direksi') || role.includes('director') || role === 'super user') {
        return {
            name: 'Direksi / Pimpinan Tertinggi',
            role: 'Direksi',
            isBypassed: false,
            skipped: [],
            badgeColor: 'rose',
            description: 'Pimpinan Eksekutif Tertinggi'
        };
    }

    // Find relevant division info
    const divObj = divisions.find(d => (typeof d === 'string' ? d : d.name) === divName);
    const divManagerName = divObj?.manager_name || allMembers.find(m => m.division === divName && (m.role || m.position || '').toLowerCase().includes('manager'))?.name || null;

    // Find relevant department info
    const deptObj = departments.find(d => d.division_name === divName && d.name === deptName);
    const deptCoordinatorName = deptObj?.coordinator_name || allMembers.find(m => m.division === divName && m.department === deptName && (m.role || m.position || '').toLowerCase().includes('koordinator'))?.name || null;
    
    // Find SPV for this department or division
    let spvName = deptObj?.spv_name || null;
    if (!spvName) {
        const divSpvMember = allMembers.find(m => m.division === divName && ((m.role || '').toLowerCase().includes('spv') || (m.position || '').toLowerCase().includes('spv')));
        if (divSpvMember) spvName = divSpvMember.name;
    }

    // 2. If member is Manager: always reports to Direksi
    if (role.includes('manager')) {
        return {
            name: 'Direksi',
            role: 'Direksi',
            isBypassed: false,
            skipped: [],
            badgeColor: 'rose',
            description: 'Melapor langsung ke Jajaran Direksi'
        };
    }

    // 3. If member is SPV: reports to Manager, or skips to Direksi
    if (role.includes('spv') || role.includes('supervisor')) {
        if (divManagerName && divManagerName !== member.name) {
            return {
                name: divManagerName,
                role: 'Manager',
                isBypassed: false,
                skipped: [],
                badgeColor: 'indigo',
                description: `Melapor ke Manager Divisi (${divManagerName})`
            };
        }
        return {
            name: 'Direksi',
            role: 'Direksi',
            isBypassed: true,
            skipped: ['Manager'],
            badgeColor: 'rose',
            description: 'Melapor langsung ke Direksi (Manager belum terisi)'
        };
    }

    // 4. If member is Koordinator: reports to SPV -> Manager -> Direksi
    if (role.includes('koordinator') || role.includes('coordinator') || role.includes('kordinator')) {
        if (spvName && spvName !== member.name) {
            return {
                name: spvName,
                role: 'SPV',
                isBypassed: false,
                skipped: [],
                badgeColor: 'purple',
                description: `Melapor ke SPV (${spvName})`
            };
        }
        if (divManagerName && divManagerName !== member.name) {
            return {
                name: divManagerName,
                role: 'Manager',
                isBypassed: true,
                skipped: ['SPV'],
                badgeColor: 'indigo',
                description: `Melapor ke Manager (${divManagerName}) (SPV belum terisi)`
            };
        }
        return {
            name: 'Direksi',
            role: 'Direksi',
            isBypassed: true,
            skipped: ['SPV', 'Manager'],
            badgeColor: 'rose',
            description: 'Melapor langsung ke Direksi (SPV & Manager belum terisi)'
        };
    }

    // 5. If member is Staff (or default): reports to Koordinator -> SPV -> Manager -> Direksi
    const isSelfCoordinator = (deptObj && deptObj.coordinator_id === member.id) || (deptCoordinatorName && deptCoordinatorName === member.name);
    if (!isSelfCoordinator && deptCoordinatorName) {
        return {
            name: deptCoordinatorName,
            role: 'Koordinator',
            isBypassed: false,
            skipped: [],
            badgeColor: 'amber',
            description: `Melapor ke Koordinator (${deptCoordinatorName})`
        };
    }
    // If no Coordinator
    if (spvName) {
        return {
            name: spvName,
            role: 'SPV',
            isBypassed: deptName ? true : false,
            skipped: deptName ? ['Koordinator'] : [],
            badgeColor: 'purple',
            description: `Melapor ke SPV (${spvName}) ${deptName ? '(Koordinator belum ada)' : ''}`
        };
    }
    if (divManagerName) {
        return {
            name: divManagerName,
            role: 'Manager',
            isBypassed: true,
            skipped: deptName ? ['Koordinator', 'SPV'] : ['SPV'],
            badgeColor: 'indigo',
            description: `Melapor ke Manager (${divManagerName}) (Koor & SPV belum ada)`
        };
    }
    return {
        name: 'Direksi',
        role: 'Direksi',
        isBypassed: true,
        skipped: deptName ? ['Koordinator', 'SPV', 'Manager'] : ['SPV', 'Manager'],
        badgeColor: 'rose',
        description: 'Melapor langsung ke Direksi (Posisi atasan divisi belum terisi)'
    };
};


const EditMemberModal = ({ member, isOpen, onClose, onSave, rolesList, divisionsList, departments = [], isSuperAdmin, lockedDivision }) => {
    const [form, setForm] = useState({ name: '', email: '', role: 'Staff', division: 'Marcomm', department: '', is_active: true });

    useEffect(() => {
        if (member) {
            setForm({
                name: member.name || '',
                email: member.email || '',
                role: member.role || member.position || (rolesList?.[0] || 'Staff'),
                division: member.division || lockedDivision || (divisionsList?.[0] || 'Marcomm'),
                department: member.department || '',
                is_active: member.is_active !== false
            });
        }
    }, [member, lockedDivision, rolesList, divisionsList]);

    if (!isOpen || !member) return null;

    const availableDepts = departments.filter(d => !form.division || d.division_name === form.division);
    const isCoordinatorRole = form.role === 'Koordinator' || form.role === 'Kordinator';

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave(member.id, {
            name: form.name.trim(),
            email: form.email ? form.email.trim() : null,
            role: form.role,
            position: form.role,
            division: isSuperAdmin ? form.division : (lockedDivision || form.division),
            department: form.department || null,
            is_active: form.is_active
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl border border-white/80 shadow-2xl shadow-slate-900/10 w-full max-w-lg overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm shadow-xs">
                            <i className="fa-solid fa-user-pen"></i>
                        </div>
                        Edit Data Karyawan
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Email Auth</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="nama@perusahaan.com"
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Jabatan</label>
                            <select
                                value={form.role}
                                onChange={e => setForm({ ...form, role: e.target.value })}
                                className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition bg-white"
                            >
                                {rolesList?.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Divisi</label>
                            {isSuperAdmin ? (
                                <select
                                    value={form.division}
                                    onChange={e => setForm({ ...form, division: e.target.value, department: '' })}
                                    className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition bg-white"
                                >
                                    {divisionsList?.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={lockedDivision || form.division}
                                    disabled
                                    className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 bg-slate-100 text-slate-500 cursor-not-allowed"
                                />
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                            Departemen (Sub-Unit Divisi)
                        </label>
                        <select
                            value={form.department}
                            onChange={e => setForm({ ...form, department: e.target.value })}
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition bg-white"
                        >
                            <option value="">-- Tanpa Departemen (Umum) --</option>
                            {availableDepts.map(d => (
                                <option key={d.id || d.name} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Departemen berada di dalam divisi dan dipimpin oleh seorang Koordinator (di bawah SPV).
                        </p>
                    </div>

                    {isCoordinatorRole && (
                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/60 text-xs text-amber-800 flex items-center gap-2.5">
                            <i className="fa-solid fa-crown text-amber-500 text-sm"></i>
                            <div>
                                <span className="font-bold">Koordinator:</span> Karyawan ini merupakan atasan di unit departemen dan bertanggung jawab langsung ke SPV.
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Status Akun Aktif</span>
                        </label>
                    </div>
                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-md transition"
                        >
                            Simpan Perubahan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeptModal = ({ isOpen, onClose, onSave, dept, divisionName, members = [] }) => {
    const [name, setName] = useState('');
    const [spvMode, setSpvMode] = useState('select'); // 'select' | 'custom'
    const [spvId, setSpvId] = useState('');
    const [customSpvName, setCustomSpvName] = useState('');
    const [coordinatorId, setCoordinatorId] = useState('');

    useEffect(() => {
        if (dept) {
            setName(dept.name || '');
            setSpvId(dept.spv_id || '');
            setCustomSpvName(dept.spv_name || '');
            if (dept.spv_name && !dept.spv_id) {
                setSpvMode('custom');
            } else {
                setSpvMode('select');
            }
            setCoordinatorId(dept.coordinator_id || '');
        } else {
            setName('');
            setSpvId('');
            setCustomSpvName('');
            setSpvMode('select');
            setCoordinatorId('');
        }
    }, [dept, isOpen]);

    if (!isOpen) return null;

    const divMembers = members.filter(m => !divisionName || m.division === divisionName);
    const spvCandidates = divMembers.filter(m => {
        const r = (m.role || m.position || '').toLowerCase();
        return r.includes('spv') || r.includes('supervisor') || r.includes('manager');
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        let finalSpvId = null;
        let finalSpvName = null;

        if (spvMode === 'select' && spvId) {
            const selectedSpv = members.find(m => m.id === spvId);
            finalSpvId = spvId;
            finalSpvName = selectedSpv ? `${selectedSpv.name} (${selectedSpv.role || 'SPV'})` : null;
        } else if (spvMode === 'custom' && customSpvName.trim()) {
            finalSpvName = customSpvName.trim();
        }

        const selectedMember = members.find(m => m.id === coordinatorId);
        onSave({
            name: name.trim(),
            spv_id: finalSpvId,
            spv_name: finalSpvName,
            coordinator_id: coordinatorId || null,
            coordinator_name: selectedMember ? selectedMember.name : null
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl border border-white/80 shadow-2xl shadow-slate-900/10 w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm shadow-xs">
                            <i className="fa-solid fa-network-wired"></i>
                        </div>
                        <span>{dept ? 'Edit Departemen' : `Tambah Departemen di Divisi ${divisionName}`}</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Departemen</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="cth. Pajak, Akuntansi, Kasir, Social Media..."
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition font-medium text-slate-800"
                            required
                            autoFocus
                        />
                    </div>

                    {/* SPV Penanggung Jawab */}
                    <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                                <i className="fa-solid fa-clipboard-user text-purple-600"></i>
                                SPV Atasan Langsung
                            </label>
                            <div className="flex items-center gap-1 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setSpvMode('select')}
                                    className={`px-2 py-0.5 rounded-md font-semibold transition ${spvMode === 'select' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-100'}`}
                                >
                                    Pilih Member
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSpvMode('custom')}
                                    className={`px-2 py-0.5 rounded-md font-semibold transition ${spvMode === 'custom' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-100'}`}
                                >
                                    Ketik Title SPV
                                </button>
                            </div>
                        </div>

                        {spvMode === 'select' ? (
                            <select
                                value={spvId}
                                onChange={e => {
                                    setSpvId(e.target.value);
                                    const m = members.find(item => item.id === e.target.value);
                                    if (m) setCustomSpvName(m.name);
                                }}
                                className="w-full text-sm border border-purple-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition bg-white"
                            >
                                <option value="">-- Belum Ada SPV Terpilih --</option>
                                {spvCandidates.length > 0 && (
                                    <optgroup label="SPV / Pengawas di Divisi Ini">
                                        {spvCandidates.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.role || m.position || 'SPV'})
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                <optgroup label="Semua Anggota Divisi">
                                    {divMembers.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.role || 'Member'})
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={customSpvName}
                                onChange={e => setCustomSpvName(e.target.value)}
                                placeholder="cth. SPV Accounting, SPV Finance, SPV Tax..."
                                className="w-full text-sm border border-purple-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition bg-white font-medium text-slate-800"
                            />
                        )}
                        <p className="text-[11px] text-purple-700/80 leading-relaxed">
                            Departemen berada langsung di bawah SPV (contoh: di divisi FAT ada SPV Accounting, SPV Finance, SPV Tax).
                        </p>
                    </div>

                    {/* Koordinator Departemen */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                            <i className="fa-solid fa-crown text-amber-500"></i>
                            Koordinator (Kepala Departemen)
                        </label>
                        <select
                            value={coordinatorId}
                            onChange={e => setCoordinatorId(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition bg-white"
                        >
                            <option value="">-- Belum Ditugaskan --</option>
                            {divMembers.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name} ({m.role || m.position || 'Staff'})
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Koordinator mengepalai staf departemen ini dan melapor langsung ke SPV terkait.
                        </p>
                    </div>

                    <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-2">
                        <i className="fa-solid fa-sitemap text-indigo-600 mt-0.5 shrink-0"></i>
                        <div className="leading-relaxed">
                            <span className="font-bold">Eskalasi Rantai Komando:</span> Direksi ➔ Manager Divisi ➔ SPV ➔ Koordinator ➔ Staff. Jika jabatan SPV atau Manager belum terisi di divisi ini, garis komando otomatis naik 1 tingkat ke atas hingga Direksi.
                        </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-md transition"
                        >
                            Simpan Departemen
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditDivisionModal = ({ isOpen, onClose, onSave, division, members = [] }) => {
    const [name, setName] = useState('');
    const [managerId, setManagerId] = useState('');

    useEffect(() => {
        if (division) {
            setName(division.name || '');
            setManagerId(division.manager_id || '');
        } else {
            setName('');
            setManagerId('');
        }
    }, [division, isOpen]);

    if (!isOpen) return null;

    const managerCandidates = members.filter(m => {
        const r = (m.role || m.position || '').toLowerCase();
        return r.includes('manager') || m.division === division?.name;
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const selectedManager = members.find(m => m.id === managerId);
        onSave({
            name: name.trim(),
            manager_id: managerId || null,
            manager_name: selectedManager ? selectedManager.name : null
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl border border-white/80 shadow-2xl shadow-slate-900/10 w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-sm shadow-xs">
                            <i className="fa-solid fa-building-user"></i>
                        </div>
                        <span>Pengaturan Divisi & Manager</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Divisi</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="cth. FAT, IT, Marcomm..."
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition font-semibold text-slate-800"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                            <i className="fa-solid fa-user-tie text-purple-600"></i>
                            Manager Divisi (Pimpinan di atas SPV)
                        </label>
                        <select
                            value={managerId}
                            onChange={e => setManagerId(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition bg-white"
                        >
                            <option value="">-- Belum Ditugaskan / Tanpa Manager --</option>
                            {managerCandidates.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name} ({m.role || 'Member'} • {m.division || 'Divisi'})
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Manager membawahi seluruh SPV di divisi ini (contoh: Manager FAT membawahi SPV Accounting, SPV Finance, dan SPV Tax).
                        </p>
                    </div>

                    <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2.5">
                        <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
                        <span>Perubahan nama divisi akan otomatis diselaraskan pada semua departemen, anggota karyawan, dan project terkait.</span>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm hover:shadow-md transition"
                        >
                            Simpan Perubahan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditItemModal = ({ isOpen, onClose, onSave, title, label, initialValue, warningText, buttonColor = 'sky' }) => {
    const [value, setValue] = useState('');

    useEffect(() => {
        setValue(initialValue || '');
    }, [initialValue, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onSave(value.trim());
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl border border-white/80 shadow-2xl shadow-slate-900/10 w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                        <i className="fa-solid fa-pen-to-square text-sky-600"></i>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
                        <input
                            type="text"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition"
                            autoFocus
                            required
                        />
                    </div>
                    {warningText && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-800 flex items-start gap-2.5">
                            <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 shrink-0"></i>
                            <span>{warningText}</span>
                        </div>
                    )}
                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm hover:shadow-md transition"
                        >
                            Simpan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const OrgManagementView = ({
    initialTab = 'profile',
    currentUser,
    currentMember,
    onUpdateMyProfile,
    onChangePassword,
    onSaveRolePermissions,
    onLogout,
    members = [],
    allMembers = [],
    divisions = [],
    divisionsList = [],
    departments = [],
    roles = [],
    rolesList = [],
    isSuperAdmin,
    onAddMember,
    onUpdateMember,
    onDeleteMember,
    onToggleMemberStatus,
    onResetPassword,
    onAddDivision,
    onUpdateDivision,
    onDeleteDivision,
    onAddDepartment,
    onUpdateDepartment,
    onDeleteDepartment,
    onAddRole,
    onUpdateRole,
    onDeleteRole
}) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'profile'); // 'profile' | 'members' | 'divisions' | 'roles'

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // Active logged-in user profile object
    const activeMemberObj = currentMember || allMembers.find(m => m.id === currentUser?.memberId || m.email === currentUser?.email) || currentUser;

    // Profile Edit Form State
    const [profileName, setProfileName] = useState(activeMemberObj?.name || currentUser?.name || '');
    const [profileEmail, setProfileEmail] = useState(activeMemberObj?.email || currentUser?.email || '');
    const [profileColor, setProfileColor] = useState(activeMemberObj?.color || '#2563eb');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

    // Sync profile state if activeMemberObj updates
    useEffect(() => {
        if (activeMemberObj) {
            setProfileName(activeMemberObj.name || currentUser?.name || '');
            setProfileEmail(activeMemberObj.email || currentUser?.email || '');
            setProfileColor(activeMemberObj.color || '#2563eb');
        }
    }, [activeMemberObj, currentUser]);

    // Change Password Form State
    const [newPassInput, setNewPassInput] = useState('');
    const [repeatPassInput, setRepeatPassInput] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [showRepeatPass, setShowRepeatPass] = useState(false);
    const [isSavingPass, setIsSavingPass] = useState(false);
    const [passMsg, setPassMsg] = useState({ type: '', text: '' });

    // Roles & RBAC Matrix State
    const [selectedRoleName, setSelectedRoleName] = useState('Staff');
    const [rolePermsMap, setRolePermsMap] = useState(() => {
        const map = {};
        roles.forEach(r => {
            map[r.name] = {
                ...(DEFAULT_ROLE_PERMISSIONS[r.name] || {}),
                ...(r.permissions || {})
            };
        });
        return map;
    });
    const [isSavingPerms, setIsSavingPerms] = useState(false);
    const [permsFeedback, setPermsFeedback] = useState({ type: '', text: '' });
    const [matrixSearch, setMatrixSearch] = useState('');

    useEffect(() => {
        if (roles && roles.length > 0) {
            setRolePermsMap(prev => {
                const nextMap = { ...prev };
                roles.forEach(r => {
                    nextMap[r.name] = {
                        ...(DEFAULT_ROLE_PERMISSIONS[r.name] || {}),
                        ...(r.permissions || {}),
                        ...(nextMap[r.name] || {})
                    };
                });
                return nextMap;
            });
        }
    }, [roles]);

    // Handlers for Profile and Password
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!profileName.trim()) {
            setProfileMsg({ type: 'error', text: 'Nama tidak boleh kosong.' });
            return;
        }
        setIsSavingProfile(true);
        setProfileMsg({ type: '', text: '' });
        if (onUpdateMyProfile) {
            const success = await onUpdateMyProfile({
                name: profileName.trim(),
                email: profileEmail.trim(),
                color: profileColor
            });
            if (success) {
                setProfileMsg({ type: 'success', text: 'Profil Anda berhasil diperbarui!' });
            } else {
                setProfileMsg({ type: 'error', text: 'Gagal memperbarui profil.' });
            }
        }
        setIsSavingProfile(false);
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        if (!newPassInput || newPassInput.length < 6) {
            setPassMsg({ type: 'error', text: 'Password minimal 6 karakter.' });
            return;
        }
        if (newPassInput !== repeatPassInput) {
            setPassMsg({ type: 'error', text: 'Password baru dan konfirmasi tidak cocok!' });
            return;
        }
        setIsSavingPass(true);
        setPassMsg({ type: '', text: '' });
        if (onChangePassword) {
            const success = await onChangePassword(newPassInput);
            if (success) {
                setPassMsg({ type: 'success', text: 'Password berhasil diperbarui!' });
                setNewPassInput('');
                setRepeatPassInput('');
            } else {
                setPassMsg({ type: 'error', text: 'Gagal memperbarui password.' });
            }
        }
        setIsSavingPass(false);
    };

    const handleTogglePermission = (roleName, permKey) => {
        if (!isSuperAdmin && currentUser?.role !== 'Direksi') {
            alert('Hanya Super Admin atau Direksi yang memiliki wewenang mengubah hak akses.');
            return;
        }
        setRolePermsMap(prev => {
            const currentRolePerms = prev[roleName] || { ...(DEFAULT_ROLE_PERMISSIONS[roleName] || {}) };
            return {
                ...prev,
                [roleName]: {
                    ...currentRolePerms,
                    [permKey]: !currentRolePerms[permKey]
                }
            };
        });
    };

    const handleSavePermissions = async (roleName) => {
        if (!isSuperAdmin && currentUser?.role !== 'Direksi') return;
        setIsSavingPerms(true);
        setPermsFeedback({ type: '', text: '' });
        const targetRole = roles.find(r => r.name === roleName);
        const roleId = targetRole?.id || roleName;
        const permsToSave = rolePermsMap[roleName] || {};
        
        if (onSaveRolePermissions) {
            const res = await onSaveRolePermissions(roleId, permsToSave);
            setPermsFeedback({
                type: res?.persisted ? 'success' : 'warning',
                text: res?.message || 'Hak akses berhasil disimpan.'
            });
        }
        setIsSavingPerms(false);
    };

    const handleResetPermissions = (roleName) => {
        if (!isSuperAdmin && currentUser?.role !== 'Direksi') return;
        const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] || {};
        setRolePermsMap(prev => ({
            ...prev,
            [roleName]: { ...defaults }
        }));
        setPermsFeedback({ type: 'info', text: `Hak akses jabatan "${roleName}" dikembalikan ke default matriks.` });
    };

    // Search & Filters for Members tab
    const [searchMember, setSearchMember] = useState('');
    const [filterDiv, setFilterDiv] = useState('all');
    const [filterDept, setFilterDept] = useState('all');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    
    // Add Member Form State
    const [isAddingMember, setIsAddingMember] = useState(false);
    const canAddMember = isSuperAdmin || ['SPV', 'Manager', 'Direksi'].includes(currentUser?.role);
    const lockedDivision = !isSuperAdmin ? currentUser?.division : null;
    const [memberForm, setMemberForm] = useState({ name: '', email: '', role: 'Staff', division: lockedDivision || 'Marcomm', department: '' });
    
    // Add Division State
    const [isAddingDiv, setIsAddingDiv] = useState(false);
    const [newDivName, setNewDivName] = useState('');
    const [searchDiv, setSearchDiv] = useState('');

    // Add Role State
    const [isAddingRole, setIsAddingRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [searchRole, setSearchRole] = useState('');

    // Editing Modals State
    const [editingMember, setEditingMember] = useState(null);
    const [editingDivision, setEditingDivision] = useState(null);
    const [editingRole, setEditingRole] = useState(null);
    const [deptModal, setDeptModal] = useState({ isOpen: false, dept: null, divisionName: '' });

    // Calculated Stats
    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter(m => m.is_active !== false).length;
    const inactiveMembers = totalMembers - activeMembers;

    // Available Departments for selected division in filter
    const availableFilterDepts = departments.filter(d => filterDiv === 'all' || d.division_name === filterDiv);
    const availableFormDepts = departments.filter(d => d.division_name === (memberForm.division || 'Marcomm'));

    // Filtered Members
    const displayedMembers = members.filter(m => {
        const matchesSearch = !searchMember.trim() || 
            m.name.toLowerCase().includes(searchMember.toLowerCase()) || 
            (m.email && m.email.toLowerCase().includes(searchMember.toLowerCase()));
        const matchesDiv = filterDiv === 'all' || m.division === filterDiv;
        const matchesDept = filterDept === 'all' || m.department === filterDept;
        const matchesRole = filterRole === 'all' || (m.role || m.position) === filterRole;
        const matchesStatus = filterStatus === 'all' || 
            (filterStatus === 'active' && m.is_active !== false) || 
            (filterStatus === 'inactive' && m.is_active === false);
        return matchesSearch && matchesDiv && matchesDept && matchesRole && matchesStatus;
    });

    // Filtered Divisions
    const displayedDivisions = divisions.filter(d => {
        const name = typeof d === 'string' ? d : d.name;
        return !searchDiv.trim() || name.toLowerCase().includes(searchDiv.toLowerCase());
    });

    // Filtered Roles
    const displayedRoles = roles.filter(r => {
        const name = typeof r === 'string' ? r : r.name;
        return !searchRole.trim() || name.toLowerCase().includes(searchRole.toLowerCase());
    });

    const handleCreateMember = (e) => {
        e.preventDefault();
        if (!memberForm.name.trim()) return;
        onAddMember(memberForm);
        setMemberForm({ name: '', email: '', role: 'Staff', division: lockedDivision || 'Marcomm', department: '' });
        setIsAddingMember(false);
    };

    const handleCreateDivision = (e) => {
        e.preventDefault();
        if (!newDivName.trim()) return;
        onAddDivision(newDivName.trim());
        setNewDivName('');
        setIsAddingDiv(false);
    };

    const handleCreateRole = (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;
        onAddRole(newRoleName.trim());
        setNewRoleName('');
        setIsAddingRole(false);
    };

    // Supervisor calculation for personal profile
    const mySupervisor = activeMemberObj ? resolveDirectSupervisor(activeMemberObj, { divisions, departments, allMembers }) : null;

    return (
        <div className="h-full space-y-6 animate-fade-in pb-12">
            {/* Top Header & Overview */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-sm">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-lg shadow-md shadow-emerald-500/20">
                            <i className="fa-solid fa-sliders"></i>
                        </span>
                        Pusat Pengaturan & Organisasi
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Kelola profil akun, ubah password, daftar pengguna, struktur divisi & departemen, serta otorisasi hak akses terpusat.
                    </p>
                </div>

                {/* Quick KPI Badges */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                        <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-xs"
                            style={{ backgroundColor: profileColor }}
                        >
                            {getInitials(profileName || currentUser?.email)}
                        </div>
                        <div>
                            <div className="text-xs text-indigo-800 font-semibold uppercase tracking-wider">Profil Anda</div>
                            <div className="text-sm font-bold text-slate-800 truncate max-w-[130px]">{profileName || 'Pengguna'}</div>
                        </div>
                    </div>

                    <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs">
                            <i className="fa-solid fa-users"></i>
                        </div>
                        <div>
                            <div className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Karyawan</div>
                            <div className="text-sm font-bold text-slate-800">{totalMembers} <span className="text-xs font-normal text-emerald-600">({activeMembers} Aktif)</span></div>
                        </div>
                    </div>

                    <div className="bg-sky-50/80 border border-sky-100 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center text-xs shadow-xs">
                            <i className="fa-solid fa-layer-group"></i>
                        </div>
                        <div>
                            <div className="text-xs text-sky-800 font-semibold uppercase tracking-wider">Divisi & Dept</div>
                            <div className="text-sm font-bold text-slate-800">{divisions.length} <span className="text-xs font-normal text-sky-600">({departments.length} Dept)</span></div>
                        </div>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-100 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs shadow-xs">
                            <i className="fa-solid fa-shield-halved"></i>
                        </div>
                        <div>
                            <div className="text-xs text-amber-800 font-semibold uppercase tracking-wider">Jabatan</div>
                            <div className="text-sm font-bold text-slate-800">{roles.length} <span className="text-xs font-normal text-amber-600">Tingkatan</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-1 overflow-x-auto custom-scrollbar">
                <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 backdrop-blur rounded-2xl border border-slate-200/60 shadow-xs shrink-0">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'profile'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                    >
                        <i className="fa-solid fa-id-card-clip text-sm"></i>
                        <span>Profil & Keamanan</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </button>

                    <button
                        onClick={() => setActiveTab('members')}
                        className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'members'
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                    >
                        <i className="fa-solid fa-users text-sm"></i>
                        <span>Kelola Karyawan</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'members' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {members.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('divisions')}
                        className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'divisions'
                                ? 'bg-white text-sky-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                    >
                        <i className="fa-solid fa-layer-group text-sm"></i>
                        <span>Struktur Divisi & Dept</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'divisions' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>
                            {divisions.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'roles'
                                ? 'bg-white text-amber-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                    >
                        <i className="fa-solid fa-shield-halved text-sm"></i>
                        <span>Hak Akses & Otorisasi</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'roles' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                            {roles.length}
                        </span>
                    </button>
                </div>
            </div>

            {/* TAB 0: PROFIL & KEAMANAN SAYA */}
            {activeTab === 'profile' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left Column: Edit Profil Saya (7 cols) */}
                        <div className="lg:col-span-7 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-base shadow-xs">
                                        <i className="fa-solid fa-user-pen"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Profil Saya</h3>
                                        <p className="text-xs text-slate-500">Perbarui nama, email, dan tampilan visual akun Anda</p>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {activeMemberObj?.role || currentUser?.role || 'Staff'}
                                </span>
                            </div>

                            {profileMsg.text && (
                                <div className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2.5 animate-fade-in ${
                                    profileMsg.type === 'success' 
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}>
                                    <i className={`fa-solid ${profileMsg.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
                                    <span>{profileMsg.text}</span>
                                </div>
                            )}

                            <form onSubmit={handleSaveProfile} className="space-y-5">
                                {/* Live Avatar Preview & Color Choice */}
                                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                                    <div 
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0 transition-all duration-300"
                                        style={{ backgroundColor: profileColor }}
                                    >
                                        {getInitials(profileName || currentUser?.email)}
                                    </div>
                                    <div className="space-y-2 flex-1 text-center sm:text-left">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Tema Warna Avatar
                                        </label>
                                        <p className="text-xs text-slate-400">Pilih warna aksen untuk avatar inisial Anda di seluruh sistem</p>
                                        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start pt-1">
                                            {['#2563eb', '#059669', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#dc2626', '#4f46e5', '#d97706', '#0f766e'].map(c => (
                                                <button
                                                    type="button"
                                                    key={c}
                                                    onClick={() => setProfileColor(c)}
                                                    className={`w-7 h-7 rounded-xl transition-all duration-150 flex items-center justify-center shadow-2xs ${
                                                        profileColor === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-105 opacity-85 hover:opacity-100'
                                                    }`}
                                                    style={{ backgroundColor: c }}
                                                >
                                                    {profileColor === c && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Form Fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                                            Nama Lengkap
                                        </label>
                                        <div className="relative">
                                            <i className="fa-regular fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                                            <input
                                                type="text"
                                                value={profileName}
                                                onChange={e => setProfileName(e.target.value)}
                                                placeholder="Masukkan nama lengkap"
                                                className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                                            Alamat Email
                                        </label>
                                        <div className="relative">
                                            <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                                            <input
                                                type="email"
                                                value={profileEmail}
                                                onChange={e => setProfileEmail(e.target.value)}
                                                placeholder="nama@abskdi.biz.id"
                                                className="w-full text-sm pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Structural Badges Info */}
                                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Penempatan & Jabatan</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Tingkat Jabatan</div>
                                            <div className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                                                <i className="fa-solid fa-briefcase text-xs text-amber-500"></i>
                                                <span>{activeMemberObj?.role || currentUser?.role || 'Staff'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Divisi</div>
                                            <div className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                                                <i className="fa-solid fa-building text-xs text-sky-500"></i>
                                                <span>{activeMemberObj?.division || currentUser?.division || 'Semua Divisi'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Departemen</div>
                                            <div className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                                                <i className="fa-solid fa-layer-group text-xs text-indigo-500"></i>
                                                <span>{activeMemberObj?.department || '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Garis Komando Atasan Langsung */}
                                    {mySupervisor && (
                                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs flex-wrap gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-slate-500">Atasan Langsung:</span>
                                                <span className="font-bold text-slate-800">{mySupervisor.name}</span>
                                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium text-[10px] border border-amber-200">
                                                    {mySupervisor.role}
                                                </span>
                                            </div>
                                            {mySupervisor.isBypassed && (
                                                <span className="text-[10px] text-amber-600 bg-amber-100/60 px-2 py-0.5 rounded-full font-semibold">
                                                    <i className="fa-solid fa-arrow-trend-up mr-1"></i>Eskalasi Terhubung
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSavingProfile}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <i className={`fa-solid ${isSavingProfile ? 'fa-spinner fa-spin' : 'fa-check'} text-xs`}></i>
                                        <span>{isSavingProfile ? 'Menyimpan...' : 'Simpan Profil Saya'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Right Column: Ubah Password & Keamanan Akun (5 cols) */}
                        <div className="lg:col-span-5 space-y-6">
                            {/* Card Ubah Password */}
                            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-5">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center text-base shadow-xs">
                                        <i className="fa-solid fa-key"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Ubah Password</h3>
                                        <p className="text-xs text-slate-500">Perbarui kata sandi login akun Anda</p>
                                    </div>
                                </div>

                                {passMsg.text && (
                                    <div className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2.5 animate-fade-in ${
                                        passMsg.type === 'success' 
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                                    }`}>
                                        <i className={`fa-solid ${passMsg.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
                                        <span>{passMsg.text}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSavePassword} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                                            Password Baru
                                        </label>
                                        <div className="relative">
                                            <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                                            <input
                                                type={showPass ? 'text' : 'password'}
                                                value={newPassInput}
                                                onChange={e => setNewPassInput(e.target.value)}
                                                placeholder="Minimal 6 karakter..."
                                                className="w-full text-sm pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPass(!showPass)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                                tabIndex={-1}
                                            >
                                                <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                                            Ulangi Password Baru
                                        </label>
                                        <div className="relative">
                                            <i className="fa-solid fa-shield-check absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                                            <input
                                                type={showRepeatPass ? 'text' : 'password'}
                                                value={repeatPassInput}
                                                onChange={e => setRepeatPassInput(e.target.value)}
                                                placeholder="Ulangi password baru..."
                                                className="w-full text-sm pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowRepeatPass(!showRepeatPass)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                                tabIndex={-1}
                                            >
                                                <i className={`fa-solid ${showRepeatPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Match Indicator */}
                                    {newPassInput && repeatPassInput && (
                                        <div className="text-xs flex items-center gap-1.5">
                                            {newPassInput === repeatPassInput ? (
                                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                                    <i className="fa-solid fa-circle-check"></i>
                                                    Password cocok
                                                </span>
                                            ) : (
                                                <span className="text-rose-600 font-semibold flex items-center gap-1">
                                                    <i className="fa-solid fa-circle-xmark"></i>
                                                    Password belum cocok
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSavingPass || !newPassInput || newPassInput !== repeatPassInput}
                                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-amber-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <i className={`fa-solid ${isSavingPass ? 'fa-spinner fa-spin' : 'fa-key'} text-xs`}></i>
                                        <span>{isSavingPass ? 'Menyimpan...' : 'Perbarui Password'}</span>
                                    </button>
                                </form>
                            </div>

                            {/* Card Sesi & Keamanan */}
                            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-sm shadow-2xs">
                                        <i className="fa-solid fa-shield-halved"></i>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Sesi & Keamanan Akun</h4>
                                        <p className="text-[11px] text-slate-500">Status autentikasi dan kontrol sesi aktif</p>
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs text-slate-600 divide-y divide-slate-100">
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-slate-400">Email Akun:</span>
                                        <span className="font-semibold text-slate-700 truncate max-w-[180px]">{currentUser?.email}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-slate-400">Hak Akses:</span>
                                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">{currentUser?.role || 'Staff'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-slate-400">Status Akun:</span>
                                        <span className="font-semibold text-emerald-600 flex items-center gap-1"><i className="fa-solid fa-circle text-[8px]"></i> Aktif</span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={onLogout}
                                        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
                                    >
                                        <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                                        <span>Keluar dari Akun (Logout)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Card Instalasi Aplikasi PWA */}
                            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-pink-50 border border-pink-100 text-pink-600 flex items-center justify-center text-base shadow-xs">
                                            <i className="fa-solid fa-mobile-screen-button"></i>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Aplikasi Desktop & Mobile</h4>
                                            <p className="text-[11px] text-slate-500">Instal langsung ke layar utama perangkat</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-extrabold bg-pink-100 text-pink-700 px-2 py-0.5 rounded-lg border border-pink-200 uppercase tracking-wider">
                                        PWA
                                    </span>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-50/80 via-purple-50/50 to-indigo-50/60 border border-pink-100/70 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white p-1.5 shadow-sm border border-pink-200/50 shrink-0 flex items-center justify-center">
                                        <img src="/Logo%20Beauty.png" alt="Busana" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-pacifico text-[16px] text-slate-800 block leading-tight" style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}>
                                            Busana
                                        </span>
                                        <span className="font-inter text-[10px] text-slate-500 font-medium">Beauty Task Management</span>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Nikmati pengalaman aplikasi native tanpa bilah browser. Akses lebih cepat, ringan, dan mendukung instalasi di Windows, Mac, Android, maupun iPhone/iPad.
                                </p>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (typeof window !== 'undefined') {
                                            window.dispatchEvent(new CustomEvent('open-pwa-install'));
                                        }
                                    }}
                                    className="w-full bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-pink-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                >
                                    <i className="fa-solid fa-download text-xs"></i>
                                    <span>Instal Aplikasi Busana</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 1: ANGGOTA KARYAWAN */}
            {activeTab === 'members' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Action Bar: Search, Filters & Add Button */}
                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                            {/* Search Input */}
                            <div className="relative flex-1 min-w-[180px] max-w-xs">
                                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                                <input
                                    type="text"
                                    value={searchMember}
                                    onChange={e => setSearchMember(e.target.value)}
                                    placeholder="Cari nama atau email..."
                                    className="w-full text-sm pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                                />
                                {searchMember && (
                                    <button onClick={() => setSearchMember('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <i className="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                )}
                            </div>

                            {/* Filter Divisi */}
                            <select
                                value={filterDiv}
                                onChange={e => {
                                    setFilterDiv(e.target.value);
                                    setFilterDept('all');
                                }}
                                className="text-xs font-medium border border-slate-200 rounded-xl py-2 px-3 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="all">Semua Divisi</option>
                                {divisionsList?.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>

                            {/* Filter Departemen */}
                            <select
                                value={filterDept}
                                onChange={e => setFilterDept(e.target.value)}
                                className="text-xs font-medium border border-slate-200 rounded-xl py-2 px-3 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="all">Semua Departemen</option>
                                {availableFilterDepts.map(d => (
                                    <option key={d.id || d.name} value={d.name}>{d.name} ({d.division_name})</option>
                                ))}
                            </select>

                            {/* Filter Jabatan */}
                            <select
                                value={filterRole}
                                onChange={e => setFilterRole(e.target.value)}
                                className="text-xs font-medium border border-slate-200 rounded-xl py-2 px-3 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="all">Semua Jabatan</option>
                                {rolesList?.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>

                            {/* Filter Status */}
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="text-xs font-medium border border-slate-200 rounded-xl py-2 px-3 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option value="all">Semua Status</option>
                                <option value="active">Aktif Saja</option>
                                <option value="inactive">Non-aktif Saja</option>
                            </select>
                        </div>

                        {canAddMember && (
                            <button
                                onClick={() => setIsAddingMember(!isAddingMember)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center gap-2 shrink-0"
                            >
                                <i className={`fa-solid ${isAddingMember ? 'fa-minus' : 'fa-plus'} text-xs`}></i>
                                <span>{isAddingMember ? 'Tutup Form' : 'Tambah Karyawan'}</span>
                            </button>
                        )}
                    </div>

                    {/* Add Member Form (Collapsible) */}
                    {isAddingMember && canAddMember && (
                        <form onSubmit={handleCreateMember} className="p-6 bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-100 shadow-lg shadow-emerald-500/5 animate-fade-in space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-emerald-800 font-bold text-sm">
                                <i className="fa-solid fa-user-plus text-emerald-600"></i>
                                Formulir Pendaftaran Karyawan Baru
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        value={memberForm.name}
                                        onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}
                                        placeholder="cth. Budi Santoso"
                                        className="w-full text-sm border border-slate-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Email Auth (Opsional)</label>
                                    <input
                                        type="email"
                                        value={memberForm.email}
                                        onChange={e => setMemberForm({ ...memberForm, email: e.target.value })}
                                        placeholder="nama@perusahaan.com"
                                        className="w-full text-sm border border-slate-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Jabatan</label>
                                    <select
                                        value={memberForm.role}
                                        onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}
                                        className="w-full text-sm border border-slate-200 rounded-xl py-2 px-3 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    >
                                        {rolesList?.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Divisi</label>
                                    {isSuperAdmin ? (
                                        <select
                                            value={memberForm.division}
                                            onChange={e => setMemberForm({ ...memberForm, division: e.target.value, department: '' })}
                                            className="w-full text-sm border border-slate-200 rounded-xl py-2 px-3 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                        >
                                            {divisionsList?.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={lockedDivision || 'Marcomm'}
                                            disabled
                                            className="w-full text-sm border border-slate-200 rounded-xl py-2 px-3 bg-slate-100 text-slate-500 cursor-not-allowed"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Departemen</label>
                                    <select
                                        value={memberForm.department}
                                        onChange={e => setMemberForm({ ...memberForm, department: e.target.value })}
                                        className="w-full text-sm border border-slate-200 rounded-xl py-2 px-3 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    >
                                        <option value="">Tanpa Departemen</option>
                                        {availableFormDepts.map(d => (
                                            <option key={d.id || d.name} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingMember(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition"
                                >
                                    Simpan Karyawan
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Members Table */}
                    <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="p-4 w-16 text-center">Avatar</th>
                                        <th className="p-4">Nama & Email</th>
                                        <th className="p-4">Jabatan</th>
                                        <th className="p-4">Divisi & Departemen</th>
                                        <th className="p-4">Atasan Langsung</th>
                                        <th className="p-4 text-center">Status</th>
                                        {isSuperAdmin && <th className="p-4 w-36 text-right">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-white/40 divide-y divide-slate-100/80">
                                    {displayedMembers.map(member => {
                                        const isCoord = member.role === 'Koordinator' || member.role === 'Kordinator';
                                        const supervisor = resolveDirectSupervisor(member, { divisions, departments, allMembers });
                                        return (
                                            <tr key={member.id} className={`hover:bg-slate-50/80 transition-colors group ${member.is_active === false ? 'opacity-60' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <div
                                                        className="w-10 h-10 rounded-2xl text-white flex items-center justify-center text-xs font-bold mx-auto shadow-sm ring-2 ring-white"
                                                        style={{ backgroundColor: member.color || '#94a3b8' }}
                                                    >
                                                        {getInitials(member.name)}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                                        <span>{member.name}</span>
                                                        {isCoord && (
                                                            <span title="Koordinator Departemen" className="text-amber-500 text-xs">
                                                                <i className="fa-solid fa-crown"></i>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                        <i className="fa-regular fa-envelope text-[10px]"></i>
                                                        <span>{member.email || 'Tanpa email auth'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold ${
                                                        isCoord
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-300/80 font-bold'
                                                            : member.role === 'SPV'
                                                            ? 'bg-purple-50 text-purple-700 border border-purple-200/60 font-bold'
                                                            : member.role === 'Manager'
                                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-bold'
                                                            : member.role === 'Direksi'
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60 font-bold'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                                    }`}>
                                                        <i className={`fa-solid ${
                                                            member.role === 'Direksi' ? 'fa-crown' :
                                                            member.role === 'Manager' ? 'fa-user-tie' :
                                                            member.role === 'SPV' ? 'fa-clipboard-user' :
                                                            isCoord ? 'fa-crown' : 'fa-briefcase'
                                                        } text-[10px]`}></i>
                                                        {member.role || member.position || 'Staff'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
                                                            <i className="fa-solid fa-layer-group text-[10px]"></i>
                                                            {member.division || 'Umum'}
                                                        </span>
                                                        {member.department ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                                                <i className="fa-solid fa-network-wired text-[10px]"></i>
                                                                Dept: {member.department}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">Tanpa Departemen</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {supervisor ? (
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold ${
                                                                supervisor.role === 'Direksi' ? 'bg-rose-50 text-rose-700 border border-rose-200/80' :
                                                                supervisor.role === 'Manager' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80' :
                                                                supervisor.role === 'SPV' ? 'bg-purple-50 text-purple-700 border border-purple-200/80' :
                                                                'bg-amber-50 text-amber-700 border border-amber-200/80'
                                                            }`}>
                                                                <i className={`text-[10px] ${
                                                                    supervisor.role === 'Direksi' ? 'fa-solid fa-crown text-rose-500' :
                                                                    supervisor.role === 'Manager' ? 'fa-solid fa-user-tie text-indigo-500' :
                                                                    supervisor.role === 'SPV' ? 'fa-solid fa-clipboard-user text-purple-500' :
                                                                    'fa-solid fa-star text-amber-500'
                                                                }`}></i>
                                                                <span>{supervisor.name}</span>
                                                            </span>
                                                            {supervisor.isBypassed && (
                                                                <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md" title={supervisor.description}>
                                                                    <i className="fa-solid fa-arrow-turn-up text-[8px] text-amber-600"></i>
                                                                    Bypass: {supervisor.skipped.join(' & ')} kosong
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-3 py-1 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                                                        member.is_active === false
                                                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${member.is_active === false ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                                        {member.is_active === false ? 'Non-aktif' : 'Aktif'}
                                                    </span>
                                                </td>
                                                {isSuperAdmin && (
                                                    <td className="p-4 text-sm text-right space-x-1">
                                                        <button
                                                            onClick={() => setEditingMember(member)}
                                                            className="text-slate-400 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 opacity-80 group-hover:opacity-100 transition-all duration-200"
                                                            title="Edit Data Karyawan"
                                                        >
                                                            <i className="fa-solid fa-user-pen"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => onResetPassword(member.id)}
                                                            className="text-slate-400 hover:text-blue-600 p-2 rounded-xl hover:bg-blue-50 opacity-80 group-hover:opacity-100 transition-all duration-200"
                                                            title="Reset Password"
                                                        >
                                                            <i className="fa-solid fa-key"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => onToggleMemberStatus(member.id, member.is_active !== false)}
                                                            className={`text-slate-400 p-2 rounded-xl opacity-80 group-hover:opacity-100 transition-all duration-200 ${
                                                                member.is_active === false ? 'hover:text-emerald-600 hover:bg-emerald-50' : 'hover:text-amber-600 hover:bg-amber-50'
                                                            }`}
                                                            title={member.is_active === false ? 'Aktifkan Akun' : 'Non-aktifkan Akun'}
                                                        >
                                                            <i className={`fa-solid ${member.is_active === false ? 'fa-user-check' : 'fa-user-slash'}`}></i>
                                                        </button>
                                                        <button
                                                            onClick={() => onDeleteMember(member.id)}
                                                            className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 opacity-80 group-hover:opacity-100 transition-all duration-200"
                                                            title="Hapus Karyawan"
                                                        >
                                                            <i className="fa-regular fa-trash-can"></i>
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {displayedMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={isSuperAdmin ? 7 : 6} className="p-16 text-center text-slate-400 text-sm">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 text-2xl">
                                                        <i className="fa-solid fa-users-slash"></i>
                                                    </div>
                                                    <div className="font-semibold text-slate-600">Tidak ada data karyawan ditemukan</div>
                                                    <div className="text-xs text-slate-400 max-w-sm">
                                                        Coba ubah kata kunci pencarian atau reset filter di atas.
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: STRUKTUR DIVISI & DEPARTEMEN */}
            {activeTab === 'divisions' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Action Bar */}
                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input
                                type="text"
                                value={searchDiv}
                                onChange={e => setSearchDiv(e.target.value)}
                                placeholder="Cari nama divisi..."
                                className="w-full text-sm pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition"
                            />
                        </div>

                        {isSuperAdmin && (
                            <button
                                onClick={() => setIsAddingDiv(!isAddingDiv)}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <i className={`fa-solid ${isAddingDiv ? 'fa-minus' : 'fa-plus'} text-xs`}></i>
                                <span>{isAddingDiv ? 'Tutup Form' : 'Tambah Divisi Baru'}</span>
                            </button>
                        )}
                    </div>

                    {/* Add Division Form */}
                    {isAddingDiv && isSuperAdmin && (
                        <form onSubmit={handleCreateDivision} className="p-5 bg-white/90 backdrop-blur-md rounded-3xl border border-sky-100 shadow-lg shadow-sky-500/5 animate-fade-in flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[220px]">
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Divisi Baru</label>
                                <input
                                    type="text"
                                    value={newDivName}
                                    onChange={e => setNewDivName(e.target.value)}
                                    placeholder="cth. Research & Development"
                                    className="w-full text-sm border border-slate-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingDiv(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition"
                                >
                                    Simpan Divisi
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Divisions Cards Grid with Nested Departments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {displayedDivisions.map(div => {
                            const id = typeof div === 'string' ? div : div.id;
                            const name = typeof div === 'string' ? div : div.name;
                            const managerName = typeof div === 'object' ? div.manager_name : null;
                            const divMembers = allMembers.filter(m => m.division === name);
                            const count = divMembers.length;
                            const divDepts = departments.filter(dept => dept.division_name === name);

                            // Group sub-departments by SPV
                            const spvGroups = {};
                            divDepts.forEach(dept => {
                                const key = dept.spv_name || 'Umum / Belum Terikat SPV';
                                if (!spvGroups[key]) spvGroups[key] = [];
                                spvGroups[key].push(dept);
                            });

                            return (
                                <div
                                    key={id || name}
                                    className="bg-white/85 backdrop-blur-md p-5 rounded-3xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all duration-300 flex flex-col justify-between gap-4 group"
                                >
                                    <div>
                                        {/* Division Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center text-lg shadow-xs group-hover:bg-sky-600 group-hover:text-white transition-all duration-300 shrink-0 mt-0.5">
                                                    <i className="fa-solid fa-layer-group"></i>
                                                </div>
                                                <div>
                                                    <h4 className="font-extrabold text-slate-800 text-base">{name}</h4>
                                                    
                                                    {/* Manager Divisi Badge */}
                                                    <div className="mt-1">
                                                        {managerName ? (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                                                                <i className="fa-solid fa-user-tie text-purple-600 text-[10px]"></i>
                                                                <span>Manager: {managerName}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 px-2 py-0.5 rounded-lg">
                                                                <i className="fa-solid fa-user-tie text-[9px]"></i>
                                                                <span>Belum ada Manager</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5">
                                                        <span className="inline-flex items-center gap-1">
                                                            <i className="fa-solid fa-users text-[10px] text-sky-600"></i>
                                                            <span>{count} Karyawan</span>
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                                                            <i className="fa-solid fa-network-wired text-[10px]"></i>
                                                            <span>{divDepts.length} Departemen</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {isSuperAdmin && (
                                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditingDivision(typeof div === 'object' ? div : { id, name })}
                                                        className="text-slate-400 hover:text-sky-600 p-2 rounded-xl hover:bg-sky-50 transition"
                                                        title="Edit Divisi & Tunjuk Manager"
                                                    >
                                                        <i className="fa-solid fa-pen-to-square text-sm"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteDivision(id, name)}
                                                        className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition"
                                                        title="Hapus Divisi"
                                                    >
                                                        <i className="fa-regular fa-trash-can text-sm"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Alur Komando Aktif Divisi (Skip-Level Escalation Banner) */}
                                        {(() => {
                                            const hasManager = Boolean(managerName);
                                            const hasSpv = divDepts.some(d => Boolean(d.spv_name)) || allMembers.some(m => m.division === name && ((m.role || '').toLowerCase().includes('spv') || (m.position || '').toLowerCase().includes('spv')));
                                            return (
                                                <div className="mt-3.5 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/70 text-[11px] space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                                                            <i className="fa-solid fa-route text-sky-600"></i>
                                                            Garis Komando Aktif Divisi
                                                        </span>
                                                        {(!hasManager || !hasSpv) && (
                                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                                                                Eskalasi Otomatis
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-1 font-semibold text-slate-600">
                                                        <span className="text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-lg text-[10px] shadow-2xs">
                                                            👑 Direksi
                                                        </span>
                                                        <i className="fa-solid fa-chevron-right text-[8px] text-slate-400"></i>
                                                        {hasManager ? (
                                                            <span className="text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg text-[10px] shadow-2xs">
                                                                👔 Manager ({managerName})
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 bg-slate-100/80 line-through px-2 py-0.5 rounded-lg text-[10px]" title="Manager belum ada, alur melompat ke Direksi">
                                                                👔 Manager (Kosong)
                                                            </span>
                                                        )}
                                                        <i className="fa-solid fa-chevron-right text-[8px] text-slate-400"></i>
                                                        {hasSpv ? (
                                                            <span className="text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-lg text-[10px] shadow-2xs">
                                                                📋 SPV
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 bg-slate-100/80 line-through px-2 py-0.5 rounded-lg text-[10px]" title="SPV belum ada, alur eskalasi ke atas">
                                                                📋 SPV (Kosong)
                                                            </span>
                                                        )}
                                                        <i className="fa-solid fa-chevron-right text-[8px] text-slate-400"></i>
                                                        <span className="text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-lg text-[10px] shadow-2xs">
                                                            ⭐ Koordinator
                                                        </span>
                                                        <i className="fa-solid fa-chevron-right text-[8px] text-slate-400"></i>
                                                        <span className="text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-lg text-[10px] shadow-2xs">
                                                            👥 Staff
                                                        </span>
                                                    </div>

                                                    {(!hasManager && !hasSpv) && (
                                                        <div className="text-[10px] text-amber-800 bg-amber-50/90 p-2 rounded-xl border border-amber-200/80 flex items-start gap-1.5 leading-relaxed">
                                                            <i className="fa-solid fa-circle-info text-amber-600 mt-0.5 shrink-0"></i>
                                                            <span>Divisi ini tidak memiliki Manager dan SPV, sehingga Koordinator & Staff melapor <b>langsung ke Direksi</b>.</span>
                                                        </div>
                                                    )}
                                                    {(hasManager && !hasSpv) && (
                                                        <div className="text-[10px] text-indigo-800 bg-indigo-50/90 p-2 rounded-xl border border-indigo-200/80 flex items-start gap-1.5 leading-relaxed">
                                                            <i className="fa-solid fa-circle-info text-indigo-600 mt-0.5 shrink-0"></i>
                                                            <span>SPV belum terisi di divisi ini. Koordinator melapor <b>langsung ke Manager ({managerName})</b>.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Sub-departments in this Division Grouped by SPV */}
                                        <div className="mt-4 pt-3 border-t border-slate-100/90 space-y-3">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                <span className="flex items-center gap-1.5 text-indigo-700">
                                                    <i className="fa-solid fa-network-wired text-indigo-500"></i>
                                                    Departemen & SPV ({divDepts.length})
                                                </span>
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={() => setDeptModal({ isOpen: true, dept: null, divisionName: name })}
                                                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg transition"
                                                    >
                                                        <i className="fa-solid fa-plus text-[9px]"></i> Tambah Dept
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-2.5">
                                                {Object.entries(spvGroups).map(([spvGroupName, deptsInGroup]) => (
                                                    <div key={spvGroupName} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-2.5 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                                                                <i className="fa-solid fa-clipboard-user text-purple-600 text-xs"></i>
                                                                <span>SPV: {spvGroupName}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-semibold bg-white px-2 py-0.5 rounded-full border border-slate-200/60">
                                                                {deptsInGroup.length} Dept
                                                            </span>
                                                        </div>

                                                        <div className="space-y-1.5 pl-1">
                                                            {deptsInGroup.map(dept => {
                                                                const staffCount = allMembers.filter(m => m.division === name && m.department === dept.name).length;
                                                                return (
                                                                    <div
                                                                        key={dept.id || dept.name}
                                                                        className="p-2.5 rounded-xl bg-white border border-slate-200/70 flex items-center justify-between gap-2 text-xs hover:border-indigo-200 transition shadow-2xs"
                                                                    >
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                                                <i className="fa-regular fa-folder text-indigo-500 text-xs"></i>
                                                                                <span>{dept.name}</span>
                                                                            </div>
                                                                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                                                                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                                                                                    <i className="fa-solid fa-crown text-[9px] text-amber-500"></i>
                                                                                    Koor: {dept.coordinator_name || 'Belum ada'}
                                                                                </span>
                                                                                <span className="text-slate-300">•</span>
                                                                                <span className="text-slate-500 font-medium">
                                                                                    {staffCount} Staff
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        {isSuperAdmin && (
                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                <button
                                                                                    onClick={() => setDeptModal({ isOpen: true, dept, divisionName: name })}
                                                                                    className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition"
                                                                                    title="Edit Departemen"
                                                                                >
                                                                                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => onDeleteDepartment(dept.id, dept.name)}
                                                                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                                                                                    title="Hapus Departemen"
                                                                                >
                                                                                    <i className="fa-regular fa-trash-can text-xs"></i>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}

                                                {divDepts.length === 0 && (
                                                    <div className="text-[11px] text-slate-400 italic py-3 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                                        Belum ada departemen. Tambahkan departemen untuk divisi ini.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Hierarchy Info */}
                                    <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500">
                                        <button
                                            onClick={() => {
                                                setFilterDiv(name);
                                                setActiveTab('members');
                                            }}
                                            className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1.5 group/link"
                                        >
                                            <span>Semua Anggota Divisi</span>
                                            <i className="fa-solid fa-arrow-right text-[10px] group-hover/link:translate-x-0.5 transition-transform"></i>
                                        </button>
                                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                                            Manager ➔ SPV ➔ Koor
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {displayedDivisions.length === 0 && (
                        <div className="bg-white/70 rounded-3xl p-12 text-center text-slate-400">
                            Tidak ada divisi yang sesuai pencarian.
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: JABATAN & HAK AKSES */}
            {activeTab === 'roles' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Top Role Selector & Action Header */}
                    <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                                    <span className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-sm">
                                        <i className="fa-solid fa-shield-halved"></i>
                                    </span>
                                    <span>Matriks Otorisasi & Hak Akses Pengguna</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Kelola 31 butir otorisasi dalam 7 modul sistem untuk tiap tingkatan jabatan organisasi.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <a
                                    href="/Matriks_Otorisasi_Pengguna.xlsx"
                                    download="Matriks_Otorisasi_Pengguna.xlsx"
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-2xs"
                                    title="Unduh file Excel Matriks Otorisasi Pengguna"
                                >
                                    <i className="fa-solid fa-file-excel text-emerald-600 text-sm"></i>
                                    <span>Unduh Excel (.xlsx)</span>
                                </a>

                                {(isSuperAdmin || currentUser?.role === 'Direksi') && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleResetPermissions(selectedRoleName)}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                                            title="Kembalikan izin jabatan ini ke standar default matriks"
                                        >
                                            <i className="fa-solid fa-rotate-left text-xs"></i>
                                            <span>Reset Default</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSavePermissions(selectedRoleName)}
                                            disabled={isSavingPerms}
                                            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <i className={`fa-solid ${isSavingPerms ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-xs`}></i>
                                            <span>{isSavingPerms ? 'Menyimpan...' : 'Simpan Hak Akses'}</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Role Selection Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar pt-1">
                            {roles.map((r, idx) => {
                                const rName = typeof r === 'string' ? r : r.name;
                                const rLevel = typeof r === 'string' ? idx + 1 : (r.level || idx + 1);
                                const isSelected = selectedRoleName === rName;
                                const memberCount = allMembers.filter(m => (m.role === rName || m.position === rName)).length;

                                return (
                                    <button
                                        type="button"
                                        key={rName}
                                        onClick={() => {
                                            setSelectedRoleName(rName);
                                            setPermsFeedback({ type: '', text: '' });
                                        }}
                                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all shrink-0 ${
                                            isSelected
                                                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-600 ring-offset-2'
                                                : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                                        }`}
                                    >
                                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                                            isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                                        }`}>
                                            L{rLevel}
                                        </span>
                                        <span className="text-xs font-bold">{rName}</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                            isSelected ? 'bg-amber-700 text-amber-100' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {memberCount}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Feedback Alert if any */}
                    {permsFeedback.text && (
                        <div className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 animate-fade-in ${
                            permsFeedback.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : permsFeedback.type === 'warning'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <i className={`fa-solid ${
                                    permsFeedback.type === 'success' ? 'fa-circle-check text-emerald-600' :
                                    permsFeedback.type === 'warning' ? 'fa-triangle-exclamation text-amber-600' :
                                    'fa-circle-info text-blue-600'
                                } text-sm`}></i>
                                <span>{permsFeedback.text}</span>
                            </div>
                            <button onClick={() => setPermsFeedback({ type: '', text: '' })} className="text-slate-400 hover:text-slate-600">
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        </div>
                    )}

                    {/* Filter & Role Info Bar */}
                    <div className="flex items-center justify-between gap-3 flex-wrap bg-white/70 backdrop-blur p-3.5 rounded-2xl border border-white/80 shadow-2xs">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                value={matrixSearch}
                                onChange={e => setMatrixSearch(e.target.value)}
                                placeholder="Cari wewenang atau kode hak akses..."
                                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                            />
                        </div>

                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span className="font-semibold text-slate-700">Mengedit Hak Akses Jabatan:</span>
                            <span className="font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                                {selectedRoleName}
                            </span>
                            {!isSuperAdmin && currentUser?.role !== 'Direksi' && (
                                <span className="text-[10px] text-slate-400 italic">(Mode Baca / View-Only)</span>
                            )}
                        </div>
                    </div>

                    {/* Interactive RBAC Modules Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {PERMISSION_MODULES.map(module => {
                            const currentRolePerms = rolePermsMap[selectedRoleName] || {};
                            const filteredItems = module.items.filter(item => 
                                !matrixSearch.trim() || 
                                item.label.toLowerCase().includes(matrixSearch.toLowerCase()) || 
                                item.key.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                                item.desc.toLowerCase().includes(matrixSearch.toLowerCase())
                            );

                            if (filteredItems.length === 0) return null;

                            const activeCount = module.items.filter(it => Boolean(currentRolePerms[it.key])).length;

                            return (
                                <div key={module.id} className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5 flex flex-col justify-between">
                                    {/* Module Header */}
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs shadow-2xs">
                                                <i className={`fa-solid ${module.icon}`}></i>
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-sm">{module.name}</h4>
                                        </div>
                                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                            activeCount === module.items.length
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : activeCount > 0
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {activeCount} / {module.items.length} Aktif
                                        </span>
                                    </div>

                                    {/* Module Items List */}
                                    <div className="space-y-2 flex-1">
                                        {filteredItems.map(item => {
                                            const isChecked = Boolean(currentRolePerms[item.key]);
                                            const canToggle = isSuperAdmin || currentUser?.role === 'Direksi';

                                            return (
                                                <div
                                                    key={item.key}
                                                    className={`p-3 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-3 ${
                                                        isChecked
                                                            ? 'bg-emerald-50/40 border-emerald-200/70 shadow-2xs'
                                                            : 'bg-slate-50/60 border-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-xs text-slate-800">{item.label}</span>
                                                            <span className="text-[9px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200/60">
                                                                {item.key}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                                                    </div>

                                                    {/* Toggle Switch */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTogglePermission(selectedRoleName, item.key)}
                                                        disabled={!canToggle}
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                            isChecked ? 'bg-emerald-600' : 'bg-slate-300'
                                                        } ${!canToggle ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        title={canToggle ? (isChecked ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan') : 'Hanya Super Admin/Direksi'}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                                isChecked ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Master Jabatan Management Section (Add / Edit / Delete Role) */}
                    <div className="pt-6 border-t border-slate-200/80 space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <i className="fa-solid fa-briefcase text-amber-600"></i>
                                    <span>Master Daftar Tingkatan Jabatan</span>
                                </h3>
                                <p className="text-xs text-slate-500">Kelola hierarki dan penamaan jabatan resmi dalam sistem</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type="text"
                                        value={searchRole}
                                        onChange={e => setSearchRole(e.target.value)}
                                        placeholder="Cari jabatan..."
                                        className="text-xs pl-7 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                    />
                                </div>

                                {isSuperAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRole(!isAddingRole)}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                                    >
                                        <i className={`fa-solid ${isAddingRole ? 'fa-minus' : 'fa-plus'} text-xs`}></i>
                                        <span>{isAddingRole ? 'Tutup' : 'Tambah Jabatan'}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Add Role Form */}
                        {isAddingRole && isSuperAdmin && (
                            <form onSubmit={handleCreateRole} className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-amber-200 shadow-md animate-fade-in flex flex-wrap items-end gap-3">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Nama Jabatan Baru</label>
                                    <input
                                        type="text"
                                        value={newRoleName}
                                        onChange={e => setNewRoleName(e.target.value)}
                                        placeholder="cth. Vice President"
                                        className="w-full text-xs border border-slate-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRole(false)}
                                        className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
                                    >
                                        Simpan Jabatan
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Roles Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {displayedRoles.map((role, idx) => {
                                const id = typeof role === 'string' ? role : role.id;
                                const name = typeof role === 'string' ? role : role.name;
                                const level = typeof role === 'string' ? idx + 1 : (role.level || idx + 1);
                                const desc = typeof role === 'string' ? '' : (role.description || '');
                                const count = allMembers.filter(m => (m.role === name || m.position === name)).length;
                                const isCoord = name === 'Koordinator' || name === 'Kordinator';

                                return (
                                    <div
                                        key={id || name}
                                        className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-md transition flex flex-col justify-between gap-3 group"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm shadow-2xs ${
                                                    isCoord 
                                                        ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                                                        : 'bg-amber-50 border border-amber-100 text-amber-600'
                                                }`}>
                                                    <i className={`fa-solid ${isCoord ? 'fa-crown' : 'fa-briefcase'}`}></i>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                                        {name}
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                            Level {level}
                                                        </span>
                                                    </h4>
                                                    <span className="text-[11px] text-slate-400">{count} Karyawan Menjabat</span>
                                                </div>
                                            </div>

                                            {isSuperAdmin && (
                                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingRole({ id, name })}
                                                        className="text-slate-400 hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-50 transition"
                                                        title="Edit Nama Jabatan"
                                                    >
                                                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteRole(id, name)}
                                                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                                                        title="Hapus Jabatan"
                                                    >
                                                        <i className="fa-regular fa-trash-can text-xs"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                                            {desc || (
                                                isCoord 
                                                    ? 'Atasan / Kepala Departemen (berada langsung di bawah pengawasan SPV).' 
                                                    : name === 'SPV'
                                                    ? 'Supervisor operasional divisi & seluruh koordinator departemen.'
                                                    : `Tingkat jabatan resmi level ${level} dalam organisasi.`
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFilterRole(name);
                                                    setActiveTab('members');
                                                }}
                                                className="text-amber-600 hover:text-amber-800 font-semibold flex items-center gap-1 group/link text-xs"
                                            >
                                                <span>Lihat Karyawan</span>
                                                <i className="fa-solid fa-arrow-right text-[9px] group-hover/link:translate-x-0.5 transition-transform"></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRoleName(name);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="text-slate-400 hover:text-slate-700 text-[11px] font-medium"
                                            >
                                                Ubah Izin ➔
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            <EditMemberModal
                member={editingMember}
                isOpen={Boolean(editingMember)}
                onClose={() => setEditingMember(null)}
                onSave={onUpdateMember}
                rolesList={rolesList}
                divisionsList={divisionsList}
                departments={departments}
                isSuperAdmin={isSuperAdmin}
                lockedDivision={lockedDivision}
            />

            <DeptModal
                isOpen={deptModal.isOpen}
                onClose={() => setDeptModal({ isOpen: false, dept: null, divisionName: '' })}
                dept={deptModal.dept}
                divisionName={deptModal.divisionName}
                members={allMembers}
                onSave={(deptData) => {
                    if (deptModal.dept) {
                        onUpdateDepartment(deptModal.dept.id, deptModal.dept.name, deptData.name, deptData.spv_id, deptData.spv_name, deptData.coordinator_id, deptData.coordinator_name);
                    } else {
                        onAddDepartment(deptModal.divisionName, deptData.name, deptData.spv_id, deptData.spv_name, deptData.coordinator_id, deptData.coordinator_name);
                    }
                }}
            />

            <EditDivisionModal
                isOpen={Boolean(editingDivision)}
                onClose={() => setEditingDivision(null)}
                onSave={(divData) => onUpdateDivision(editingDivision?.id, editingDivision?.name, divData.name, divData.manager_id, divData.manager_name)}
                division={editingDivision}
                members={allMembers}
            />

            <EditItemModal
                isOpen={Boolean(editingRole)}
                onClose={() => setEditingRole(null)}
                onSave={(newName) => onUpdateRole(editingRole?.id, editingRole?.name, newName)}
                title="Edit Nama Jabatan"
                label="Nama Jabatan Baru"
                initialValue={editingRole?.name}
                warningText="Perubahan nama jabatan akan otomatis diselaraskan pada semua profil karyawan terkait."
                buttonColor="amber"
            />
        </div>
    );
};

// Compatibility aliases if referenced elsewhere
const DivisionsTable = (props) => null;
const RolesTable = (props) => null;
const MembersTable = (props) => null;



const LOCAL_SESSION_KEY = 'task_abs_session';

const LoginScreen = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Hardcoded Super User
            if (email === 'abskdi.markom@gmail.com' && password === 'ABSgroup#123') {
                const { data } = await supabase.from('members').select('*').eq('email', email).single();
                const superId = data?.id || '3970ef9a-2fd4-41bf-acbf-fab57672cc57';
                const sessionObj = { 
                    email, 
                    role: 'Super User',
                    memberId: superId,
                    division: data?.division || 'Direksi'
                };
                localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionObj));
                localStorage.setItem(CURRENT_PIC_KEY, superId);
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
        <div className="min-h-screen bg-gradient-to-br from-pink-50/80 via-slate-50 to-purple-50/60 flex items-center justify-center p-4">
            <div className="bg-white p-7 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-pink-100/80">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-pink-600 via-pink-500 to-rose-400 p-0.5 shadow-lg shadow-pink-500/25 mx-auto mb-3.5 flex items-center justify-center">
                        <div className="w-full h-full bg-white rounded-[22px] flex items-center justify-center p-2 shadow-inner">
                            <img src="/Logo%20Beauty.png" alt="Busana Logo" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <h1 
                        className="text-3xl text-slate-900 font-bold tracking-normal leading-tight" 
                        style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}
                    >
                        Busana
                    </h1>
                    <p 
                        className="text-xs text-slate-800 font-bold mt-1 tracking-wide"
                        style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
                    >
                        Beauty Task Management
                    </p>
                    <p className="text-xs text-slate-600 font-medium mt-1.5">
                        Masuk ke Dashboard Kerja Anda
                    </p>
                </div>
                
                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-900 mb-1.5 uppercase tracking-wider">
                            Email <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                            <input
                                type="email"
                                required
                                className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-900 font-semibold text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none transition-all placeholder:text-slate-400 shadow-xs"
                                placeholder="nama@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-900 mb-1.5 uppercase tracking-wider">
                            Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="w-full pl-10 pr-11 py-2.5 bg-white text-slate-900 font-semibold text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none transition-all placeholder:text-slate-400 shadow-xs"
                                placeholder="Masukkan password..."
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-sm p-1 transition cursor-pointer"
                                tabIndex={-1}
                                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-[#e1007a] via-[#ec268f] to-[#a855f7] hover:opacity-95 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-98"
                    >
                        {loading ? (
                            <>
                                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                                <span>Memproses...</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-right-to-bracket text-xs"></i>
                                <span>Masuk</span>
                            </>
                        )}
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

// MainDashboard component is modularly loaded from ../components/MainDashboard

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
                    <button onClick={() => handleSelectByRole(['direksi', 'director'])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors">
                        Direksi
                    </button>
                    <button onClick={() => handleSelectByRole(['manager'])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors">
                        Manager
                    </button>
                    <button onClick={() => handleSelectByRole(['spv', 'supervisor'])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 transition-colors">
                        SPV
                    </button>
                    <button onClick={() => handleSelectByRole(['koordinator', 'coordinator', 'kordinator'])} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors">
                        Koordinator
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
    const [divisions, setDivisions] = useState([]);
    const [divisionsList, setDivisionsList] = useState(DIVISIONS);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState(INITIAL_ROLES);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [settingsInitialTab, setSettingsInitialTab] = useState('profile');
    const [isNotesSubMenuOpen, setIsNotesSubMenuOpen] = useState(false);
    const [notesInitialTab, setNotesInitialTab] = useState('notes');
    const [isScheduleSubMenuOpen, setIsScheduleSubMenuOpen] = useState(false);
    const [schedules, setSchedules] = useState([]);

    const handleUpdateMyProfile = async (profileData) => {
        const memberId = session?.memberId;
        if (!memberId) return false;

        // If hardcoded superadmin
        if (memberId === 'superadmin') {
            const updatedSession = { ...session, name: profileData.name, email: profileData.email, color: profileData.color };
            setSession(updatedSession);
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updatedSession));
            return true;
        }

        const { error } = await supabase.from('members').update({
            name: profileData.name,
            email: profileData.email,
            color: profileData.color
        }).eq('id', memberId);

        if (error) {
            alert('Gagal memperbarui profil: ' + error.message);
            return false;
        }

        // Update in React state
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...profileData } : m));

        // Update session state & storage
        const updatedSession = { ...session, name: profileData.name, email: profileData.email, color: profileData.color };
        setSession(updatedSession);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updatedSession));

        return true;
    };

    const handleSaveRolePermissions = async (roleIdOrName, newPermissions) => {
        // 1. Update state immediately
        setRoles(prev => prev.map(r => (r.id === roleIdOrName || r.name === roleIdOrName) ? { ...r, permissions: newPermissions } : r));

        // 2. Persist to DB or localStorage
        const targetRole = roles.find(r => r.id === roleIdOrName || r.name === roleIdOrName);
        const roleId = targetRole?.id;

        if (roleId && !String(roleId).startsWith('role-')) {
            const { error } = await supabase.from('roles').update({ permissions: newPermissions }).eq('id', roleId);
            if (error) {
                console.warn('Gagal menyimpan izin ke database roles:', error.message);
                try {
                    const storedPerms = JSON.parse(localStorage.getItem('task_leader_custom_permissions') || '{}');
                    const roleKey = targetRole ? targetRole.name : roleIdOrName;
                    storedPerms[roleKey] = newPermissions;
                    localStorage.setItem('task_leader_custom_permissions', JSON.stringify(storedPerms));
                } catch (e) {}
                return { persisted: false, message: 'Hak akses tersimpan di sesi lokal. Untuk menyimpan ke database secara permanen, jalankan skrip sql/add_role_permissions.sql di Supabase SQL Editor.' };
            }
        } else {
            try {
                const roleKey = targetRole ? targetRole.name : roleIdOrName;
                const storedPerms = JSON.parse(localStorage.getItem('task_leader_custom_permissions') || '{}');
                storedPerms[roleKey] = newPermissions;
                localStorage.setItem('task_leader_custom_permissions', JSON.stringify(storedPerms));
            } catch (e) {}
        }

        return { persisted: true, message: 'Hak akses jabatan berhasil disimpan ke database!' };
    };

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

    const handleUpdateMember = async (id, updatedData) => {
        let { error } = await supabase.from('members').update(updatedData).eq('id', id);
        if (error && error.message && error.message.includes('department')) {
            const { department, ...fallbackData } = updatedData;
            const retry = await supabase.from('members').update(fallbackData).eq('id', id);
            error = retry.error;
        }
        if (error) {
            alert('Gagal memperbarui data karyawan: ' + error.message);
            return false;
        }
        setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updatedData } : m));
        alert('Data karyawan berhasil diperbarui!');
        return true;
    };
    
    const handleAddDivision = async (name) => {
        const cleanName = name.trim();
        if (!cleanName) return;
        const { data, error } = await supabase.from('divisions').insert([{ name: cleanName }]).select().single();
        if (error) {
            alert('Gagal menambah divisi: ' + error.message + '. Pastikan Anda sudah menjalankan SQL membuat tabel divisions.');
            return;
        }
        const newDiv = data || { id: crypto.randomUUID(), name: cleanName, created_at: new Date().toISOString() };
        setDivisions(prev => [...prev, newDiv]);
        setDivisionsList(prev => [...prev, cleanName]);
        alert(`Divisi "${cleanName}" berhasil ditambahkan.`);
    };

    const handleUpdateDivision = async (id, oldName, newName, managerId, managerName) => {
        if (!newName || !newName.trim()) return;
        const cleanNew = newName.trim();
        const payload = {
            name: cleanNew,
            manager_id: managerId || null,
            manager_name: managerName || null
        };
        
        // Attempt update with manager fields, fallback if columns not in DB yet
        let { error: divError } = await supabase.from('divisions').update(payload).eq('id', id);
        if (divError && (divError.message.includes('manager') || divError.message.includes('column'))) {
            await supabase.from('divisions').update({ name: cleanNew }).eq('id', id);
        }

        // Cascade update in members, departments & projects tables if name changed
        if (cleanNew !== oldName) {
            await supabase.from('members').update({ division: cleanNew }).eq('division', oldName);
            await supabase.from('departments').update({ division_name: cleanNew }).eq('division_name', oldName);
            await supabase.from('projects').update({ division: cleanNew }).eq('division', oldName);

            setDivisionsList(prev => prev.map(d => d === oldName ? cleanNew : d));
            setDepartments(prev => prev.map(d => d.division_name === oldName ? { ...d, division_name: cleanNew } : d));
            setMembers(prev => prev.map(m => m.division === oldName ? { ...m, division: cleanNew } : m));
            setProjects(prev => prev.map(p => p.division === oldName ? { ...p, division: cleanNew } : p));
            if (globalDivision === oldName) setGlobalDivision(cleanNew);
        }

        // If manager assigned, update that member's role to Manager
        if (managerId) {
            await supabase.from('members').update({ role: 'Manager', position: 'Manager', division: cleanNew }).eq('id', managerId);
            setMembers(prev => prev.map(m => m.id === managerId ? { ...m, role: 'Manager', position: 'Manager', division: cleanNew } : m));
        }

        setDivisions(prev => prev.map(d => (d.id === id || d.name === oldName) ? { ...d, ...payload, name: cleanNew } : d));
        alert(`Divisi "${cleanNew}" berhasil diperbarui.`);
        return true;
    };

    const handleDeleteDivision = async (id, name) => {
        const memberCount = members.filter(m => m.division === name).length;
        const projectCount = projects.filter(p => p.division === name).length;
        const deptCount = departments.filter(d => d.division_name === name).length;
        if (memberCount > 0 || projectCount > 0 || deptCount > 0) {
            alert(`Tidak dapat menghapus divisi "${name}" karena masih memiliki ${memberCount} karyawan, ${deptCount} departemen, dan ${projectCount} project terhubung. Silakan pindahkan data terlebih dahulu.`);
            return;
        }

        openDialog({
            type: 'confirm',
            message: `Yakin ingin menghapus divisi "${name}"?`,
            onConfirm: async () => {
                const { error } = await supabase.from('divisions').delete().eq('id', id);
                if (error) {
                    alert('Gagal menghapus divisi: ' + error.message);
                    return;
                }
                setDivisions(prev => prev.filter(d => d.id !== id && d.name !== name));
                setDivisionsList(prev => prev.filter(d => d !== name));
                alert(`Divisi "${name}" berhasil dihapus.`);
            }
        });
    };

    const handleAddDepartment = async (divisionName, deptName, spvId, spvName, coordinatorId, coordinatorName) => {
        const cleanName = deptName.trim();
        if (!cleanName) return;
        const payload = {
            name: cleanName,
            division_name: divisionName,
            spv_id: spvId || null,
            spv_name: spvName || null,
            coordinator_id: coordinatorId || null,
            coordinator_name: coordinatorName || null
        };
        let { data, error } = await supabase.from('departments').insert([payload]).select().single();
        if (error && (error.message.includes('spv') || error.message.includes('column'))) {
            const fallbackPayload = {
                name: cleanName,
                division_name: divisionName,
                coordinator_id: coordinatorId || null,
                coordinator_name: coordinatorName || null
            };
            const fbRes = await supabase.from('departments').insert([fallbackPayload]).select().single();
            data = fbRes.data;
        }
        const newDept = data || { id: 'dept-' + Date.now(), ...payload, created_at: new Date().toISOString() };
        setDepartments(prev => [...prev, { ...newDept, ...payload }]);

        // If coordinator is assigned, update that member's department and role
        if (coordinatorId) {
            await supabase.from('members').update({ department: cleanName, role: 'Koordinator', position: 'Koordinator' }).eq('id', coordinatorId);
            setMembers(prev => prev.map(m => m.id === coordinatorId ? { ...m, department: cleanName, role: 'Koordinator', position: 'Koordinator' } : m));
        }

        alert(`Departemen "${cleanName}" berhasil ditambahkan ke divisi ${divisionName}.`);
        return true;
    };

    const handleUpdateDepartment = async (id, oldName, newName, spvId, spvName, coordinatorId, coordinatorName) => {
        const cleanName = newName.trim();
        if (!cleanName) return;
        const payload = {
            name: cleanName,
            spv_id: spvId || null,
            spv_name: spvName || null,
            coordinator_id: coordinatorId || null,
            coordinator_name: coordinatorName || null
        };
        let { error } = await supabase.from('departments').update(payload).eq('id', id);
        if (error && (error.message.includes('spv') || error.message.includes('column'))) {
            const fallbackPayload = {
                name: cleanName,
                coordinator_id: coordinatorId || null,
                coordinator_name: coordinatorName || null
            };
            await supabase.from('departments').update(fallbackPayload).eq('id', id);
        }
        if (oldName !== cleanName) {
            await supabase.from('members').update({ department: cleanName }).eq('department', oldName);
            setMembers(prev => prev.map(m => m.department === oldName ? { ...m, department: cleanName } : m));
        }
        if (coordinatorId) {
            await supabase.from('members').update({ department: cleanName, role: 'Koordinator', position: 'Koordinator' }).eq('id', coordinatorId);
            setMembers(prev => prev.map(m => m.id === coordinatorId ? { ...m, department: cleanName, role: 'Koordinator', position: 'Koordinator' } : m));
        }
        setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...payload } : d));
        alert(`Departemen "${cleanName}" berhasil diperbarui.`);
        return true;
    };

    const handleDeleteDepartment = async (id, name) => {
        const count = members.filter(m => m.department === name).length;
        if (count > 0) {
            alert(`Tidak dapat menghapus departemen "${name}" karena masih memiliki ${count} karyawan. Silakan pindahkan anggota departemen terlebih dahulu.`);
            return;
        }

        openDialog({
            type: 'confirm',
            message: `Yakin ingin menghapus departemen "${name}"?`,
            onConfirm: async () => {
                await supabase.from('departments').delete().eq('id', id);
                setDepartments(prev => prev.filter(d => d.id !== id && d.name !== name));
                alert(`Departemen "${name}" berhasil dihapus.`);
            }
        });
    };

    const handleAddRole = async (name) => {
        const cleanName = name.trim();
        if (!cleanName) return;
        
        // Attempt DB insert if table exists
        const { data, error } = await supabase.from('roles').insert([{ name: cleanName, level: roles.length + 1 }]).select().single();
        const newRole = data || { id: 'role-' + Date.now(), name: cleanName, level: roles.length + 1 };
        
        setRoles(prev => [...prev, newRole]);
        alert(`Jabatan "${cleanName}" berhasil ditambahkan.`);
    };

    const handleUpdateRole = async (id, oldName, newName) => {
        if (!newName || !newName.trim() || newName.trim() === oldName) return;
        const cleanNew = newName.trim();

        // Try updating in DB
        await supabase.from('roles').update({ name: cleanNew }).eq('id', id);
        // Cascade update in members
        await supabase.from('members').update({ role: cleanNew, position: cleanNew }).eq('role', oldName);

        setRoles(prev => prev.map(r => (r.id === id || r.name === oldName) ? { ...r, name: cleanNew } : r));
        setMembers(prev => prev.map(m => (m.role === oldName || m.position === oldName) ? { ...m, role: cleanNew, position: cleanNew } : m));
        alert(`Nama jabatan berhasil diubah menjadi "${cleanNew}".`);
        return true;
    };

    const handleDeleteRole = async (id, name) => {
        const memberCount = members.filter(m => (m.role === name || m.position === name)).length;
        if (memberCount > 0) {
            alert(`Tidak dapat menghapus jabatan "${name}" karena masih digunakan oleh ${memberCount} karyawan. Silakan ubah jabatan karyawan terlebih dahulu.`);
            return;
        }

        openDialog({
            type: 'confirm',
            message: `Yakin ingin menghapus jabatan "${name}"?`,
            onConfirm: async () => {
                await supabase.from('roles').delete().eq('id', id);
                setRoles(prev => prev.filter(r => r.id !== id && r.name !== name));
                alert(`Jabatan "${name}" berhasil dihapus.`);
            }
        });
    };
    
    const [members, setMembers] = useState([]);
    const [currentPicId, setCurrentPicId] = useState('');
    const [tasks, setTasks] = useState([]);
    const [shortcuts, setShortcuts] = useState([]);
    const [notes, setNotes] = useState([]);
    const [globalDivision, setGlobalDivision] = useState('All');

    const safeUUID = (val, fallback = null) => {
        if (!val) return fallback;
        if (isValidUUID(val)) return val.trim();
        const strVal = String(val).trim();
        const found = members.find(m => 
            m.id === strVal || 
            (m.email && m.email.toLowerCase() === strVal.toLowerCase()) || 
            (m.name && m.name.toLowerCase() === strVal.toLowerCase())
        );
        if (found && isValidUUID(found.id)) return found.id;
        if (strVal.toLowerCase() === 'superadmin' || strVal.toLowerCase() === 'abskdi.markom@gmail.com') {
            const sa = members.find(m => m.email === 'abskdi.markom@gmail.com' || m.name?.toLowerCase() === 'superadmin');
            if (sa && isValidUUID(sa.id)) return sa.id;
            return '3970ef9a-2fd4-41bf-acbf-fab57672cc57';
        }
        return fallback;
    };

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

    // Filter notes & MoM so only owner (pemilik) or shared users (dishare ke ybs) have access
    const filteredAccessibleNotes = useMemo(() => {
        const matchedMember = members.find(m => 
            (session?.memberId && m.id === session.memberId) ||
            (currentPicId && m.id === currentPicId) ||
            (session?.email && m.email?.toLowerCase() === session.email.toLowerCase())
        );

        const myIds = new Set([
            session?.memberId,
            currentPicId,
            matchedMember?.id
        ].filter(Boolean));

        const myEmails = new Set([
            session?.email,
            matchedMember?.email
        ].filter(Boolean).map(e => e.toLowerCase().trim()));

        const myNames = new Set([
            session?.name,
            matchedMember?.name
        ].filter(Boolean).map(n => n.toLowerCase().trim()));

        return notes.filter(item => {
            // Check ownership (pemilik)
            const owner = item.picId || item.pic_id || item.author_id || item.authorId || item.owner_id;
            if (owner) {
                const str = String(owner).trim();
                if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
                    return true;
                }
            }

            // Check sharedWith / attendees (dishare ke ybs)
            const sharedList = [
                ...(Array.isArray(item.sharedWith) ? item.sharedWith : []),
                ...(Array.isArray(item.shared_with) ? item.shared_with : []),
                ...(Array.isArray(item.attendees) ? item.attendees : [])
            ];
            for (const s of sharedList) {
                if (!s) continue;
                const str = String(s).trim();
                if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
                    return true;
                }
            }

            // Check action items PIC (dishare ke ybs)
            const actionItems = Array.isArray(item.action_items || item.actionItems)
                ? (item.action_items || item.actionItems)
                : [];
            for (const act of actionItems) {
                const pic = act.picId || act.pic_id;
                if (pic) {
                    const str = String(pic).trim();
                    if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
                        return true;
                    }
                }
            }

            return false;
        });
    }, [notes, session, currentPicId, members]);

    // Filter schedules so:
    // - Super User has access to all schedules
    // - For meeting schedules: only Super User, PIC (pemilik), or Attendees (peserta meeting) have access
    // - For worksheet schedules:
    //   * Owner (PIC) can always access their own worksheet
    //   * Staff can ONLY access their own worksheet
    //   * Pimpinan can access worksheet of subordinates up to 2 levels below (SPV sees Koordinator & Staff, Koordinator sees Staff, etc.)
    const filteredAccessibleSchedules = useMemo(() => {
        if (isSuperUser) return schedules;

        const matchedMember = members.find(m => 
            (session?.memberId && m.id === session.memberId) ||
            (currentPicId && m.id === currentPicId) ||
            (session?.email && m.email?.toLowerCase() === session.email.toLowerCase()) ||
            (session?.name && m.name?.toLowerCase() === session.name.toLowerCase())
        );

        const myIds = new Set([
            session?.memberId,
            currentPicId,
            matchedMember?.id
        ].filter(Boolean));

        const myEmails = new Set([
            session?.email,
            matchedMember?.email
        ].filter(Boolean).map(e => e.toLowerCase().trim()));

        const myNames = new Set([
            session?.name,
            matchedMember?.name
        ].filter(Boolean).map(n => n.toLowerCase().trim()));

        const userRole = session?.role || session?.position || matchedMember?.role || matchedMember?.position || 'Staff';
        const userLevel = getRoleLevel(userRole, roles);
        const userDivision = session?.division || matchedMember?.division;

        return schedules.filter(item => {
            const isWorksheet = isWorksheetSchedule(item);

            // Check PIC / owner
            const pic = item.picId || item.pic_id || item.author_id || item.authorId || item.userId;
            const isOwner = pic && (myIds.has(String(pic).trim()) || myEmails.has(String(pic).toLowerCase().trim()) || myNames.has(String(pic).toLowerCase().trim()));
            if (isOwner) return true;

            if (isWorksheet) {
                // Staff only views their own worksheet
                if (userLevel <= 1) return false;

                // Pimpinan can view subordinates up to 2 levels below
                if (pic) {
                    const picStr = String(pic).trim();
                    const picMember = members.find(m => 
                        m.id === picStr || 
                        (m.email && m.email.toLowerCase() === picStr.toLowerCase()) ||
                        (m.name && m.name.toLowerCase() === picStr.toLowerCase())
                    );
                    if (picMember) {
                        const targetLevel = getRoleLevel(picMember.role || picMember.position, roles);
                        const isSubordinate = (userLevel >= 4) 
                            ? (targetLevel < userLevel) 
                            : (targetLevel < userLevel && targetLevel >= userLevel - 2);
                        
                        const divisionMatches = (userLevel >= 4) || 
                            !userDivision || 
                            !picMember.division || 
                            userDivision === 'All' || 
                            picMember.division === userDivision;

                        if (isSubordinate && divisionMatches) {
                            return true;
                        }
                    }
                }
                return false;
            }

            // For meeting schedules:
            // Check attendees (peserta meeting)
            const attendees = Array.isArray(item.attendees) ? item.attendees : [];
            for (const att of attendees) {
                if (!att) continue;
                const str = String(att).trim();
                if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
                    return true;
                }
            }

            // Check sharedWith (if any)
            const sharedList = [
                ...(Array.isArray(item.sharedWith) ? item.sharedWith : []),
                ...(Array.isArray(item.shared_with) ? item.shared_with : [])
            ];
            for (const s of sharedList) {
                if (!s) continue;
                const str = String(s).trim();
                if (myIds.has(str) || myEmails.has(str.toLowerCase()) || myNames.has(str.toLowerCase())) {
                    return true;
                }
            }

            return false;
        });
    }, [schedules, session, currentPicId, members, isSuperUser, roles]);
    // Ensure active project is accessible within filtered projects
    useEffect(() => {
        if (filteredProjects.length > 0) {
            const isAccessible = filteredProjects.some(p => p.id === activeProject);
            if (!isAccessible) {
                setActiveProject(filteredProjects[0].id);
            }
        } else if (projects.length > 0 && filteredProjects.length === 0) {
            setActiveProject('');
        }
    }, [filteredProjects, activeProject, projects.length]);


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

        // Safety fallback timer: batas maksimal loading 3.5 detik
        const fallbackTimer = setTimeout(() => {
            console.warn('[Workspace] Loading fallback triggered');
            setIsMounted(true);
        }, 3500);

        const loadData = async () => {
            try {
                const [
                    { data: projectsData, error: projectsError },
                    { data: membersData, error: membersError },
                    { data: tasksData, error: tasksError },
                    { data: shortcutsData, error: shortcutsError },
                    { data: notesData, error: notesError },
                    { data: divsData },
                    { data: accessData },
                    { data: rolesData },
                    { data: deptsData }
                ] = await Promise.all([
                    supabase.from('projects').select('*').order('created_at', { ascending: true }),
                    supabase.from('members').select('*').order('created_at', { ascending: true }),
                    supabase.from('tasks').select('*').order('created_at', { ascending: true }),
                    supabase.from('shortcuts').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
                    supabase.from('notes').select('*').order('created_at', { ascending: false }),
                    supabase.from('divisions').select('*').order('created_at', { ascending: true }),
                    supabase.from('project_access').select('*'),
                    supabase.from('roles').select('*').order('level', { ascending: true }),
                    supabase.from('departments').select('*').order('created_at', { ascending: true })
                ]);

                const firstError = projectsError || membersError || tasksError;
                if (firstError) {
                    console.error('Supabase load error:', firstError);
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
                setDivisions(divsData);
                setDivisionsList(divsData.map(d => d.name));
            } else {
                setDivisions(DIVISIONS.map((d, i) => ({ id: 'default-' + i, name: d })));
                setDivisionsList(DIVISIONS);
            }
            if (rolesData && rolesData.length > 0) {
                let storedPerms = {};
                try {
                    storedPerms = JSON.parse(localStorage.getItem('task_leader_custom_permissions') || '{}');
                } catch (e) {}
                const mergedRoles = rolesData.map(r => ({
                    ...r,
                    permissions: {
                        ...(DEFAULT_ROLE_PERMISSIONS[r.name] || {}),
                        ...(r.permissions || {}),
                        ...(storedPerms[r.name] || {})
                    }
                }));
                setRoles(mergedRoles);
            }
            if (deptsData && deptsData.length > 0) {
                setDepartments(deptsData);
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
            
            // Auto migrate existing session if memberId is 'superadmin'
            const superMember = (nextMembers || []).find(m => m.email === 'abskdi.markom@gmail.com' || m.name?.toLowerCase() === 'superadmin');
            let resolvedMemberId = session?.memberId;
            if (session && (session.memberId === 'superadmin' || session.email === 'abskdi.markom@gmail.com') && superMember) {
                if (session.memberId !== superMember.id) {
                    resolvedMemberId = superMember.id;
                    const migratedSession = { ...session, memberId: superMember.id };
                    setSession(migratedSession);
                    try {
                        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(migratedSession));
                        localStorage.setItem(CURRENT_PIC_KEY, superMember.id);
                    } catch (e) {}
                }
            }

            // Load schedules (try dedicated schedules table, fallback to notes or localStorage)
            let loadedSchedules = [];
            try {
                const { data: schedData, error: schedError } = await supabase.from('schedules').select('*').order('created_at', { ascending: true });
                if (!schedError && Array.isArray(schedData)) {
                    loadedSchedules = schedData.map(s => ({
                        id: s.id,
                        type: isMeetingSchedule(s) ? 'schedule_meeting' : 'schedule_worksheet',
                        title: s.title || '',
                        day: s.day || 'Senin',
                        startTime: s.start_time || '09:00',
                        endTime: s.end_time || '10:00',
                        picId: s.pic_id || '',
                        attendees: Array.isArray(s.attendees) ? s.attendees : [],
                        location: s.location || '',
                        notes: s.notes || '',
                        color: s.color || '#6366f1',
                        createdAt: s.created_at,
                        updatedAt: s.updated_at
                    }));
                }
            } catch (e) {}

            // Fallback from notes table if schedules table not populated yet
            if (loadedSchedules.length === 0 && Array.isArray(notesData)) {
                const schedNotes = notesData.filter(n => (n.type || '').toLowerCase().startsWith('schedule'));
                if (schedNotes.length > 0) {
                    loadedSchedules = schedNotes.map(n => {
                        let parsed = {};
                        try { parsed = JSON.parse(n.content || '{}'); } catch(e) {}
                        const rawItem = { ...parsed, type: n.type, title: n.title };
                        return {
                            id: n.id,
                            type: isMeetingSchedule(rawItem) ? 'schedule_meeting' : 'schedule_worksheet',
                            title: n.title || '',
                            day: parsed.day || 'Senin',
                            startTime: parsed.startTime || '09:00',
                            endTime: parsed.endTime || '10:00',
                            picId: n.pic_id || parsed.picId || '',
                            attendees: Array.isArray(parsed.attendees) ? parsed.attendees : (Array.isArray(n.attendees) ? n.attendees : []),
                            location: n.location || parsed.location || '',
                            notes: parsed.notes || '',
                            color: n.color || parsed.color || '#6366f1',
                            createdAt: n.created_at,
                            updatedAt: n.updated_at
                        };
                    });
                }
            }

            // Fallback from localStorage cache
            if (loadedSchedules.length === 0) {
                try {
                    const localCached = localStorage.getItem('task_leader_schedules_cache');
                    if (localCached) {
                        const parsed = JSON.parse(localCached);
                        if (Array.isArray(parsed)) {
                            loadedSchedules = parsed.map(s => ({
                                ...s,
                                type: isMeetingSchedule(s) ? 'schedule_meeting' : 'schedule_worksheet'
                            }));
                        }
                    }
                } catch(e) {}
            }

            setSchedules(loadedSchedules);

            setProjects(mappedProjects);
            setMembers(nextMembers);
            setTasks(mappedTasks);
            setShortcuts(mappedShortcuts);
            setNotes(mappedNotes);
            setProjectAccess(accessData || []);
            setActiveProject(mappedProjects[0]?.id || '');
            setCurrentPicId(prev => {
                if (resolvedMemberId) return resolvedMemberId;
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
            } catch (err) {
                console.error('[Workspace] LoadData error:', err);
            } finally {
                clearTimeout(fallbackTimer);
                setIsMounted(true);
            }
        };

        loadData();

        return () => clearTimeout(fallbackTimer);
    }, [session]);

    if (!isMounted) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-4">
                <div className="w-14 h-14 relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-2xl border-3 border-pink-500/20 border-t-pink-600 animate-spin"></div>
                    <img src="/Logo%20Beauty.png" alt="Busana" className="w-8 h-8 object-contain" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="font-pacifico text-xl text-slate-800" style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}>Busana</span>
                    <span className="font-inter text-xs text-slate-400 font-medium" style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}>Memuat Workspace...</span>
                </div>
            </div>
        );
    }

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
        const projectDivision = globalDivision === 'All' ? (session?.division || null) : globalDivision;
        const newProject = {
            id: crypto.randomUUID(),
            name: name.trim(),
            isPinned: false,
            owner_id: session?.memberId || null,
            division: projectDivision,
            color: getDefaultProjectColor(projects.length),
            folders: ['General'],
            showInCalendar: false
        };

        const { error: projectError } = await supabase.from('projects').insert({
            id: newProject.id,
            name: newProject.name,
            is_pinned: newProject.isPinned,
            color: newProject.color,
            folders: newProject.folders,
            show_in_calendar: newProject.showInCalendar,
            owner_id: newProject.owner_id,
            division: newProject.division
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
        if (view === 'members' || view === 'settings' || view === 'dashboard' || view === 'notes' || view === 'calendar' || view === 'schedule_meeting' || view === 'schedule_worksheet') setView('table');
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
        const dbProjectId = safeUUID(taskInput.projectId, null);
        const dbPicId = safeUUID(taskInput.picId || currentPicId, null);

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
            project_id: dbProjectId,
            title: newTask.title,
            status: newTask.status,
            priority: newTask.priority,
            folder: newTask.folder,
            deadline: newTask.deadline || null,
            pic_id: dbPicId,
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
        const dbProjectId = safeUUID(updatedTask.projectId, null);
        const dbPicId = safeUUID(updatedTask.picId, null);

        const payload = {
            id: updatedTask.id,
            project_id: dbProjectId,
            title: updatedTask.title.trim(),
            status: updatedTask.status || 'To Do',
            priority: updatedTask.priority || 'Medium',
            folder: updatedTask.folder || 'General',
            start_date: updatedTask.startDate || updatedTask.start_date || null,
            deadline: updatedTask.deadline || null,
            pic_id: dbPicId,
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
            project_id: safeUUID(item.projectId, null),
            title: item.title.trim(),
            status: item.status || 'To Do',
            priority: item.priority || 'Medium',
            start_date: item.startDate || null,
            deadline: item.deadline || null,
            pic_id: safeUUID(item.picId, null),
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
        const dbPicId = safeUUID(authorPicId, null);
        const dbProjectId = safeUUID(noteInput.projectId || noteInput.project_id, null);

        const locationValue = isNoteType 
            ? JSON.stringify({ color: noteColor, isPinned: noteIsPinned, sharedWith: sharedWithList })
            : (noteInput.location || null);

        const newNote = {
            id: noteInput.id || crypto.randomUUID(),
            type: noteInput.type || 'Meeting',
            title: noteInput.title || '',
            content: noteInput.content || '',
            issue: noteInput.issue || '',
            decision: noteInput.decision || '',
            picId: authorPicId || dbPicId || '',
            deadline: noteInput.deadline || '',
            isDone: noteInput.isDone || false,
            meeting_date: noteInput.meetingDate || noteInput.meeting_date || null,
            location: isNoteType ? '' : (noteInput.location || ''),
            project_id: dbProjectId,
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
            pic_id: dbPicId,
            deadline: newNote.deadline || null,
            is_done: newNote.isDone || false,
            meeting_date: newNote.meeting_date || null,
            location: locationValue,
            project_id: dbProjectId,
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
                pic_id: dbPicId,
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
        const dbPicId = safeUUID(authorPicId, null);
        const dbProjectId = safeUUID(noteInput.projectId || noteInput.project_id, null);

        const locationValue = isNoteType 
            ? JSON.stringify({ color: noteColor, isPinned: noteIsPinned, sharedWith: sharedWithList })
            : (noteInput.location || null);

        const payload = {
            type: noteInput.type,
            title: noteInput.title || null,
            content: noteInput.content || null,
            issue: noteInput.issue || null,
            decision: noteInput.decision || null,
            pic_id: dbPicId,
            deadline: noteInput.deadline || null,
            is_done: noteInput.isDone || false,
            meeting_date: noteInput.meetingDate || noteInput.meeting_date || null,
            location: locationValue,
            project_id: dbProjectId,
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
                pic_id: dbPicId,
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
            ...noteInput,
            picId: authorPicId || dbPicId || note.picId,
            project_id: dbProjectId,
            attendees: sharedWithList,
            sharedWith: sharedWithList,
            color: noteColor,
            isPinned: noteIsPinned,
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

    const handleAddSchedule = async (scheduleItem) => {
        setSchedules(prev => [...prev, scheduleItem]);
        try {
            const cached = [...schedules, scheduleItem];
            localStorage.setItem('task_leader_schedules_cache', JSON.stringify(cached));
        } catch (e) {}

        const dbPicId = safeUUID(scheduleItem.picId, null);

        // Try inserting into schedules table
        const { error: schedError } = await supabase.from('schedules').insert({
            id: scheduleItem.id,
            type: scheduleItem.type,
            title: scheduleItem.title,
            day: scheduleItem.day,
            start_time: scheduleItem.startTime,
            end_time: scheduleItem.endTime,
            pic_id: dbPicId,
            attendees: Array.isArray(scheduleItem.attendees) ? scheduleItem.attendees : [],
            location: scheduleItem.location || null,
            notes: scheduleItem.notes || null,
            color: scheduleItem.color || '#6366f1',
            created_at: scheduleItem.createdAt || new Date().toISOString(),
            updated_at: scheduleItem.updatedAt || new Date().toISOString()
        });

        // Fallback to notes table if schedules table is not available
        if (schedError) {
            console.warn('Supabase schedules insert fallback to notes:', schedError.message);
            await supabase.from('notes').insert({
                id: scheduleItem.id,
                type: scheduleItem.type,
                title: scheduleItem.title,
                content: JSON.stringify({
                    day: scheduleItem.day,
                    startTime: scheduleItem.startTime,
                    endTime: scheduleItem.endTime,
                    picId: scheduleItem.picId,
                    attendees: scheduleItem.attendees || [],
                    location: scheduleItem.location,
                    notes: scheduleItem.notes,
                    color: scheduleItem.color
                }),
                pic_id: dbPicId,
                location: scheduleItem.location || null,
                color: scheduleItem.color || '#6366f1'
            });
        }
    };

    const handleUpdateSchedule = async (updatedItem) => {
        setSchedules(prev => prev.map(s => s.id === updatedItem.id ? updatedItem : s));
        try {
            const cached = schedules.map(s => s.id === updatedItem.id ? updatedItem : s);
            localStorage.setItem('task_leader_schedules_cache', JSON.stringify(cached));
        } catch (e) {}

        const dbPicId = safeUUID(updatedItem.picId, null);

        // Try updating schedules table
        const { error: schedError } = await supabase.from('schedules').update({
            type: updatedItem.type,
            title: updatedItem.title,
            day: updatedItem.day,
            start_time: updatedItem.startTime,
            end_time: updatedItem.endTime,
            pic_id: dbPicId,
            attendees: Array.isArray(updatedItem.attendees) ? updatedItem.attendees : [],
            location: updatedItem.location || null,
            notes: updatedItem.notes || null,
            color: updatedItem.color || '#6366f1',
            updated_at: new Date().toISOString()
        }).eq('id', updatedItem.id);

        // Fallback to updating notes table
        if (schedError) {
            await supabase.from('notes').update({
                title: updatedItem.title,
                content: JSON.stringify({
                    day: updatedItem.day,
                    startTime: updatedItem.startTime,
                    endTime: updatedItem.endTime,
                    picId: updatedItem.picId,
                    attendees: updatedItem.attendees || [],
                    location: updatedItem.location,
                    notes: updatedItem.notes,
                    color: updatedItem.color
                }),
                pic_id: dbPicId,
                location: updatedItem.location || null,
                color: updatedItem.color || '#6366f1',
                updated_at: new Date().toISOString()
            }).eq('id', updatedItem.id);
        }
    };

    const handleDeleteSchedule = async (id) => {
        setSchedules(prev => prev.filter(s => s.id !== id));
        try {
            const cached = schedules.filter(s => s.id !== id);
            localStorage.setItem('task_leader_schedules_cache', JSON.stringify(cached));
        } catch (e) {}

        // Delete from schedules and notes tables
        await supabase.from('schedules').delete().eq('id', id);
        await supabase.from('notes').delete().eq('id', id);
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
        const { name, email, role, division, department } = memberData;
        if (!name || !name.trim()) return;

        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
        const newMember = {
            id: crypto.randomUUID(),
            name: name.trim(),
            email: email ? email.trim() : null,
            division: division || 'Marcomm',
            department: department || null,
            role: role || 'Staff',
            position: role || 'Staff',
            color: randomColor
        };

        const insertPayload = {
            id: newMember.id,
            name: newMember.name,
            email: newMember.email,
            position: newMember.position,
            division: newMember.division,
            role: newMember.role,
            color: newMember.color
        };
        if (newMember.department) {
            insertPayload.department = newMember.department;
        }

        let { error } = await supabase.from('members').insert(insertPayload);
        if (error && error.message && error.message.includes('department')) {
            delete insertPayload.department;
            const retry = await supabase.from('members').insert(insertPayload);
            error = retry.error;
        }

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
        if (nextView === 'notes') {
            setIsNotesSubMenuOpen(true);
        }
        if (nextView === 'schedule_meeting' || nextView === 'schedule_worksheet') {
            setIsScheduleSubMenuOpen(true);
        }
        closeMobileSidebar();
    };

    const handleSelectProject = (projectId) => {
        setActiveProject(projectId);
        if (view === 'members' || view === 'settings' || view === 'dashboard' || view === 'notes' || view === 'schedule_meeting' || view === 'schedule_worksheet') setView('table');
        closeMobileSidebar();
    };

    const currentProjectName = projects.find(p => p.id === activeProject)?.name || 'Pilih Project';
    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (a.isPinned === b.isPinned) return 0;
        return a.isPinned ? -1 : 1;
    });

    const loggedInUserObj = members.find(m => m.id === session?.memberId || m.id === currentPicId || m.email === session?.email);
    const currentUserName = loggedInUserObj?.name || session?.name || (session?.role === 'Super User' ? 'Dodi' : (session?.email ? session.email.split('@')[0] : 'Dodi'));

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
                    <div className="p-4 flex items-center justify-between font-semibold transition-colors mb-2">
                        <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                                <img
                                    src="/Logo%20Beauty.png"
                                    alt="Busana"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="flex flex-col min-w-0 justify-center">
                                <span
                                    className="font-pacifico text-[22px] text-slate-800 leading-tight font-normal"
                                    style={{ fontFamily: "var(--font-pacifico), 'Pacifico', cursive" }}
                                >
                                    Busana
                                </span>
                                <span
                                    className="font-inter text-[10px] font-medium text-slate-400 tracking-tight leading-tight"
                                    style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
                                >
                                    Beauty Task Management
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={closeMobileSidebar}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden shrink-0"
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
                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsNotesSubMenuOpen(prev => !prev);
                                    if (view !== 'notes') {
                                        navigateView('notes');
                                    }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-sm font-medium transition-all ${
                                    view === 'notes' ? 'tint-peach shadow-sm' : 'text-slate-500 hover:bg-white/55 hover:text-slate-900'
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="tint-peach-solid w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0">
                                        <i className="fa-regular fa-note-sticky"></i>
                                    </span>
                                    <span>Notes</span>
                                </div>
                                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${isNotesSubMenuOpen ? 'rotate-180 text-orange-500' : ''}`}></i>
                            </button>

                            {/* Sub Menu: Post it! & Minutes of Meeting */}
                            {isNotesSubMenuOpen && (
                                <div className="ml-4 pl-3 py-1 space-y-1 border-l-2 border-orange-300/60 animate-fade-in">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNotesInitialTab('notes');
                                            navigateView('notes');
                                        }}
                                        className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                            view === 'notes' && notesInitialTab === 'notes'
                                                ? 'bg-amber-100/90 text-amber-900 shadow-xs ring-1 ring-amber-300/60'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                                        }`}
                                    >
                                        <i className={`fa-solid fa-note-sticky text-xs ${view === 'notes' && notesInitialTab === 'notes' ? 'text-amber-600' : 'text-amber-400'}`}></i>
                                        <span>Post it!</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNotesInitialTab('mom');
                                            navigateView('notes');
                                        }}
                                        className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                            view === 'notes' && notesInitialTab === 'mom'
                                                ? 'bg-emerald-100/90 text-emerald-900 shadow-xs ring-1 ring-emerald-300/60'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                                        }`}
                                    >
                                        <i className={`fa-solid fa-clipboard-list text-xs ${view === 'notes' && notesInitialTab === 'mom' ? 'text-emerald-600' : 'text-emerald-400'}`}></i>
                                        <span>Minutes of Meeting</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Menu: Jadwal (Submenu: Jadwal Meeting & Worksheet) */}
                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsScheduleSubMenuOpen(prev => !prev);
                                    if (view !== 'schedule_meeting' && view !== 'schedule_worksheet') {
                                        navigateView('schedule_meeting');
                                    }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-sm font-medium transition-all ${
                                    view === 'schedule_meeting' || view === 'schedule_worksheet' 
                                        ? 'bg-indigo-50 text-indigo-900 shadow-sm font-semibold' 
                                        : 'text-slate-500 hover:bg-white/55 hover:text-slate-900'
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="bg-indigo-600 text-white w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-2xs">
                                        <i className="fa-solid fa-calendar-week"></i>
                                    </span>
                                    <span>Jadwal</span>
                                </div>
                                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${isScheduleSubMenuOpen ? 'rotate-180 text-indigo-600' : ''}`}></i>
                            </button>

                            {/* Sub Menu: Jadwal Meeting & Worksheet */}
                            {isScheduleSubMenuOpen && (
                                <div className="ml-4 pl-3 py-1 space-y-1 border-l-2 border-indigo-300/60 animate-fade-in">
                                    <button
                                        type="button"
                                        onClick={() => navigateView('schedule_meeting')}
                                        className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                            view === 'schedule_meeting'
                                                ? 'bg-indigo-100/90 text-indigo-900 shadow-xs ring-1 ring-indigo-300/60'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                                        }`}
                                    >
                                        <i className={`fa-solid fa-handshake text-xs ${view === 'schedule_meeting' ? 'text-indigo-600' : 'text-indigo-400'}`}></i>
                                        <span>Jadwal Meeting</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigateView('schedule_worksheet')}
                                        className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                            view === 'schedule_worksheet'
                                                ? 'bg-sky-100/90 text-sky-900 shadow-xs ring-1 ring-sky-300/60'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                                        }`}
                                    >
                                        <i className={`fa-solid fa-table-cells text-xs ${view === 'schedule_worksheet' ? 'text-sky-600' : 'text-sky-400'}`}></i>
                                        <span>Worksheet</span>
                                    </button>
                                </div>
                            )}
                        </div>

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
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/35 min-w-0">
                    <header className="relative z-40 h-16 border-b border-white/60 flex items-center justify-between gap-3 px-4 lg:px-8 bg-white/25 backdrop-blur">
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
                                        <i className={notesInitialTab === 'mom' ? 'fa-solid fa-clipboard-list text-emerald-600' : 'fa-regular fa-note-sticky text-amber-500'}></i>
                                        <span className="text-gray-400">Notes /</span>
                                        <span className="font-medium text-gray-800">{notesInitialTab === 'mom' ? 'Minutes of Meeting' : 'Post it!'}</span>
                                    </>
                                ) : view === 'schedule_meeting' ? (
                                    <>
                                        <i className="fa-solid fa-handshake text-indigo-600"></i>
                                        <span className="text-gray-400">Jadwal /</span>
                                        <span className="font-medium text-gray-800">Jadwal Meeting</span>
                                    </>
                                ) : view === 'schedule_worksheet' ? (
                                    <>
                                        <i className="fa-solid fa-table-cells text-sky-600"></i>
                                        <span className="text-gray-400">Jadwal /</span>
                                        <span className="font-medium text-gray-800">Worksheet</span>
                                    </>
                                ) : view === 'calendar' && !activeProject ? (
                                    <>
                                        <i className="fa-regular fa-calendar-days text-pink-500"></i>
                                        <span className="font-medium text-gray-800">Semua Kalender</span>
                                    </>
                                ) : (view === 'members' || view === 'settings') ? (
                                    <>
                                        <i className="fa-solid fa-sliders text-emerald-600"></i>
                                        <span className="font-medium text-gray-800">Pengaturan Terpusat & Organisasi</span>
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
                            {/* Pusat Notifikasi dengan Label Titik Merah & Dropdown Interaktif */}
                            <NotificationCenter
                                tasks={tasks}
                                schedules={schedules}
                                notes={notes}
                                members={members}
                                currentPicId={currentPicId}
                                session={session}
                                roles={roles}
                                projects={projects}
                                onOpenTask={handleEditTask}
                                onNavigate={navigateView}
                            />

                            {/* 1. Nama User paling kiri */}
                            <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/65 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
                                <i className="fa-regular fa-user text-slate-500"></i>
                                <span>{currentUserName}</span>
                            </div>

                            {/* 2. Logo logout kecil di kanannya tanpa label dengan tombol berwarna merah */}
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-500 hover:text-white hover:border-red-500 focus:outline-none"
                                title="Keluar"
                                aria-label="Logout"
                            >
                                <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                            </button>

                            {/* 3. Setting gir seperti ini di kanan logout */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsInitialTab('profile');
                                    navigateView('settings');
                                }}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition shadow-sm ${
                                    (view === 'settings' || view === 'members')
                                        ? 'border-indigo-500 bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300/70'
                                        : 'border-indigo-300/90 bg-indigo-50/70 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-100 hover:text-indigo-700'
                                }`}
                                title="Pengaturan Sistem"
                                aria-label="Pengaturan Sistem"
                            >
                                <i className="fa-solid fa-gear text-sm"></i>
                            </button>

                            {/* 4. Shortcut launcher dihilangkan dulu */}
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-8 custom-scrollbar">
                        {view === 'dashboard' && (
                            <MainDashboard
                                tasks={filteredTasks}
                                allTasks={tasks}
                                projects={projects}
                                members={filteredMembers}
                                allMembers={members}
                                shortcuts={shortcuts}
                                currentPicId={currentPicId}
                                session={session}
                                schedules={filteredAccessibleSchedules || schedules}
                                roles={roles}
                                divisions={divisions}
                                departments={departments}
                                onEdit={handleEditTask}
                                onQuickAddTask={handleQuickAddTask}
                                navigateView={navigateView}
                            />
                        )}

                        {view === 'notes' && (
                            <MinuteOfMeeting
                                notes={filteredAccessibleNotes}
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
                                initialTab={notesInitialTab}
                                onTabChange={(tab) => setNotesInitialTab(tab)}
                            />
                        )}

                        {view === 'schedule_meeting' && (
                            <WeeklyScheduleView
                                type="meeting"
                                schedules={filteredAccessibleSchedules}
                                members={filteredMembers}
                                divisionsList={divisionsList}
                                session={session}
                                roles={roles}
                                onAddSchedule={handleAddSchedule}
                                onUpdateSchedule={handleUpdateSchedule}
                                onDeleteSchedule={handleDeleteSchedule}
                            />
                        )}

                        {view === 'schedule_worksheet' && (
                            <WeeklyScheduleView
                                type="worksheet"
                                schedules={filteredAccessibleSchedules}
                                members={filteredMembers}
                                divisionsList={divisionsList}
                                session={session}
                                roles={roles}
                                onAddSchedule={handleAddSchedule}
                                onUpdateSchedule={handleUpdateSchedule}
                                onDeleteSchedule={handleDeleteSchedule}
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

                        {(view === 'members' || view === 'settings') && (
                            <OrgManagementView
                                initialTab={settingsInitialTab}
                                currentUser={session}
                                currentMember={members.find(m => m.id === session?.memberId || m.email === session?.email)}
                                onUpdateMyProfile={handleUpdateMyProfile}
                                onChangePassword={handleChangePassword}
                                onSaveRolePermissions={handleSaveRolePermissions}
                                onLogout={handleLogout}
                                members={filteredMembers}
                                allMembers={members}
                                divisions={divisions}
                                divisionsList={divisionsList}
                                departments={departments}
                                roles={roles}
                                rolesList={roles.map(r => r.name)}
                                isSuperAdmin={session?.role === 'Super User'}
                                onAddMember={handleAddMember}
                                onUpdateMember={handleUpdateMember}
                                onDeleteMember={handleDeleteMember}
                                onToggleMemberStatus={handleToggleMemberStatus}
                                onResetPassword={handleResetPassword}
                                onAddDivision={handleAddDivision}
                                onUpdateDivision={handleUpdateDivision}
                                onDeleteDivision={handleDeleteDivision}
                                onAddDepartment={handleAddDepartment}
                                onUpdateDepartment={handleUpdateDepartment}
                                onDeleteDepartment={handleDeleteDepartment}
                                onAddRole={handleAddRole}
                                onUpdateRole={handleUpdateRole}
                                onDeleteRole={handleDeleteRole}
                            />
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
                                    members={members}
                                    projects={projects}
                                    onAdd={handleAddTask}
                                    onEdit={handleEditTask}
                                    onDelete={handleDeleteTask}
                                    onUpdatePriority={handleUpdatePriority}
                                    onUpdateStatus={handleUpdateStatus}
                                    onUpdateTask={handleSaveEditedTask}
                                    projectAccess={projectAccess}
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
                                    members={members}
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
                                    projectAccess={projectAccess}
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
                members={members}
                foldersList={projectFoldersList}
                onCreateFolder={(fName) => handleCreateFolder(activeProject, fName)}
                isOpen={!!editingTask}
                onClose={() => setEditingTask(null)}
                onSave={handleSaveEditedTask}
                session={session}
                projectAccess={projectAccess}
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