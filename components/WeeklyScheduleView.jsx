'use strict';
import React, { useState, useMemo, useRef, useEffect } from 'react';

export const DAYS_OF_WEEK = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

// Time slots from 08:00 to 23:00 every 30 minutes
export const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'
];

export const END_TIME_SLOTS = [
    '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
    '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
    '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
    '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
    '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
];

const PRESET_COLORS = [
    { name: 'Indigo', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', bar: 'bg-indigo-500', hex: '#6366f1' },
    { name: 'Emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', bar: 'bg-emerald-500', hex: '#10b981' },
    { name: 'Sky Blue', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', bar: 'bg-sky-500', hex: '#0ea5e9' },
    { name: 'Amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', bar: 'bg-amber-500', hex: '#f59e0b' },
    { name: 'Rose', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', bar: 'bg-rose-500', hex: '#f43f5e' },
    { name: 'Purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', bar: 'bg-purple-500', hex: '#a855f7' },
    { name: 'Teal', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', bar: 'bg-teal-500', hex: '#14b8a6' },
];

export const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

// Helper to determine role hierarchy level:
// Staff: 1, Koordinator: 2, SPV: 3, Manager: 4, Direksi: 5, Super User: 99
export const getRoleLevel = (roleName, rolesList = []) => {
    if (!roleName) return 1;
    const clean = String(roleName).toLowerCase().trim();
    if (clean === 'super user' || clean === 'superadmin') return 99;
    if (clean === 'direksi') return 5;
    const found = rolesList.find(r => (r.name || '').toLowerCase().trim() === clean);
    if (found && typeof found.level === 'number') {
        return found.level;
    }
    if (clean.includes('direksi')) return 5;
    if (clean.includes('manager')) return 4;
    if (clean.includes('spv') || clean.includes('supervisor')) return 3;
    if (clean.includes('koordinator') || clean.includes('kordinator')) return 2;
    if (clean.includes('staff') || clean.includes('staf')) return 1;
    return 1;
};

export default function WeeklyScheduleView({
    type = 'meeting', // 'meeting' or 'worksheet'
    schedules = [],
    members = [],
    divisionsList = [],
    session = null,
    roles = [],
    onAddSchedule,
    onUpdateSchedule,
    onDeleteSchedule
}) {
    const isMeeting = type === 'meeting';
    const pageTitle = isMeeting ? 'Jadwal Meeting' : 'Worksheet';
    const pageSubtitle = isMeeting 
        ? 'Visualisasi jadwal rapat mingguan tetap & rutin (Senin - Minggu)'
        : 'Lembar kerja dan alokasi aktivitas operasional mingguan (Senin - Minggu)';

    // State
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMemberFilter, setSelectedMemberFilter] = useState('all');
    const [selectedDayFilter, setSelectedDayFilter] = useState('all');
    const [slotDensity, setSlotDensity] = useState('normal'); // 'compact' (46px) | 'normal' (56px) | 'spacious' (68px)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [editingItem, setEditingItem] = useState(null);
    const [isAttendeeDropdownOpen, setIsAttendeeDropdownOpen] = useState(false);
    const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');
    const attendeeDropdownRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        day: 'Senin',
        startTime: '09:00',
        endTime: '10:00',
        picId: session?.memberId || '',
        attendees: session?.memberId ? [session.memberId] : [],
        location: '',
        notes: '',
        color: '#6366f1'
    });

    // Close attendee popover on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (attendeeDropdownRef.current && !attendeeDropdownRef.current.contains(e.target)) {
                setIsAttendeeDropdownOpen(false);
            }
        };
        if (isAttendeeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAttendeeDropdownOpen]);

    // Today's day in Indonesian
    const todayDayName = useMemo(() => {
        const dayIdx = new Date().getDay(); // 0 = Minggu, 1 = Senin, ...
        const map = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return map[dayIdx];
    }, []);

    // Super user check
    const isSuperUser = Boolean(
        session?.role === 'Super User' || 
        session?.memberId === 'superadmin' || 
        session?.email === 'abskdi.markom@gmail.com'
    );

    // Current user identifiers for strict ownership & sharing validation
    const userIdentifiers = useMemo(() => {
        const matchedMember = members.find(m => 
            (session?.memberId && m.id === session.memberId) ||
            (session?.email && m.email?.toLowerCase() === session.email.toLowerCase()) ||
            (session?.name && m.name?.toLowerCase() === session.name.toLowerCase()) ||
            (isSuperUser && (m.email === 'abskdi.markom@gmail.com' || m.name?.toLowerCase() === 'superadmin'))
        );

        const ids = new Set([
            session?.memberId,
            matchedMember?.id,
            isSuperUser ? 'superadmin' : null,
            isSuperUser ? '3970ef9a-2fd4-41bf-acbf-fab57672cc57' : null
        ].filter(Boolean));

        const emails = new Set([
            session?.email,
            matchedMember?.email,
            isSuperUser ? 'abskdi.markom@gmail.com' : null
        ].filter(Boolean).map(e => e.toLowerCase().trim()));

        const names = new Set([
            session?.name,
            matchedMember?.name,
            isSuperUser ? 'superadmin' : null
        ].filter(Boolean).map(n => n.toLowerCase().trim()));

        const primaryId = matchedMember?.id || session?.memberId || '';

        return { ids, emails, names, primaryId };
    }, [session, isSuperUser, members]);

    // Current user member object
    const currentUserMember = useMemo(() => {
        return members.find(m => 
            (session?.memberId && m.id === session.memberId) ||
            (session?.email && m.email?.toLowerCase() === session.email.toLowerCase()) ||
            (session?.name && m.name?.toLowerCase() === session.name.toLowerCase()) ||
            (isSuperUser && (m.email === 'abskdi.markom@gmail.com' || m.name?.toLowerCase() === 'superadmin'))
        ) || null;
    }, [members, session, isSuperUser]);

    // Role and hierarchy level: Staff (1), Koordinator (2), SPV (3), Manager (4), Direksi (5), Super User (99)
    const userRole = session?.role || session?.position || currentUserMember?.role || currentUserMember?.position || 'Staff';
    const userLevel = isSuperUser ? 99 : getRoleLevel(userRole, roles);
    const userDivision = session?.division || currentUserMember?.division;

    // Viewable worksheet members:
    // - Staff (userLevel <= 1): CAN ONLY VIEW SELF ("staff hanya bisa melihat miliknya sendiri")
    // - Pimpinan (userLevel >= 2): Can view self + subordinates up to 2 levels below
    //   e.g. SPV (3) can view Koordinator (2) & Staff (1). Koordinator (2) can view Staff (1).
    const viewableWorksheetMembers = useMemo(() => {
        if (isMeeting) {
            return members.filter(m => m.is_active !== false);
        }
        if (isSuperUser) {
            return members.filter(m => m.is_active !== false);
        }
        if (userLevel <= 1) {
            return currentUserMember ? [currentUserMember] : [];
        }
        return members.filter(m => {
            if (m.is_active === false) return false;
            // Self is always viewable
            if (userIdentifiers.ids.has(m.id) || (m.email && userIdentifiers.emails.has(m.email.toLowerCase()))) {
                return true;
            }
            const targetLevel = getRoleLevel(m.role || m.position, roles);
            const isSubordinate = (userLevel >= 4)
                ? (targetLevel < userLevel)
                : (targetLevel < userLevel && targetLevel >= userLevel - 2);
            const divisionMatches = (userLevel >= 4) ||
                !userDivision ||
                !m.division ||
                userDivision === 'All' ||
                m.division === userDivision;

            return isSubordinate && divisionMatches;
        });
    }, [isMeeting, isSuperUser, userLevel, members, currentUserMember, userIdentifiers, roles, userDivision]);

    // Subordinate members list (excluding self) for filter dropdown
    const subordinateMembers = useMemo(() => {
        if (isMeeting || userLevel <= 1) return [];
        return viewableWorksheetMembers.filter(m => 
            !userIdentifiers.ids.has(m.id) && 
            (!m.email || !userIdentifiers.emails.has(m.email.toLowerCase()))
        );
    }, [isMeeting, userLevel, viewableWorksheetMembers, userIdentifiers]);

    // Ensure staff is locked to their own worksheet
    useEffect(() => {
        if (!isMeeting && userLevel <= 1) {
            setSelectedMemberFilter('all');
        }
    }, [isMeeting, userLevel]);

    // Check if user is owner (PIC / creator)
    const checkIsOwner = (item) => {
        if (!item) return false;
        if (isSuperUser) return true;
        const pic = item.picId || item.pic_id || item.author_id || item.authorId || item.userId;
        if (!pic) return false;
        const str = String(pic).trim();
        return userIdentifiers.ids.has(str) || userIdentifiers.emails.has(str.toLowerCase()) || userIdentifiers.names.has(str.toLowerCase());
    };

    // Check if user can edit or delete schedule (Owner, Super User, or Leader managing subordinate's worksheet)
    const checkCanManage = (item) => {
        if (!item) return false;
        if (isSuperUser) return true;
        if (checkIsOwner(item)) return true;

        if (!isMeeting && userLevel >= 2) {
            const pic = item.picId || item.pic_id || item.author_id || item.authorId || item.userId;
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

                    return isSubordinate && divisionMatches;
                }
            }
        }
        return false;
    };

    // Check if user has permission to view schedule
    const checkIsAccessible = (item) => {
        if (!item) return false;
        if (isSuperUser) return true;
        if (checkIsOwner(item)) return true;

        if (!isMeeting) {
            // Worksheet permission: Staff only sees their own worksheet
            if (userLevel <= 1) return false;

            // Pimpinan can see worksheet of subordinates up to 2 levels below
            const pic = item.picId || item.pic_id || item.author_id || item.authorId || item.userId;
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

        // Meeting permission:
        // Check attendees (Peserta Meeting)
        const attendees = Array.isArray(item.attendees) ? item.attendees : [];
        for (const att of attendees) {
            if (!att) continue;
            const str = String(att).trim();
            if (userIdentifiers.ids.has(str) || userIdentifiers.emails.has(str.toLowerCase()) || userIdentifiers.names.has(str.toLowerCase())) {
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
            if (userIdentifiers.ids.has(str) || userIdentifiers.emails.has(str.toLowerCase()) || userIdentifiers.names.has(str.toLowerCase())) {
                return true;
            }
        }

        return false;
    };

    // Filtered schedules for this specific type and accessible to current user
    const typeSchedules = useMemo(() => {
        return (schedules || []).filter(item => {
            const itemType = (item.type || '').toLowerCase();
            const matchesType = isMeeting 
                ? (itemType === 'meeting' || itemType === 'schedule_meeting')
                : (itemType === 'worksheet' || itemType === 'schedule_worksheet');
            if (!matchesType) return false;

            return checkIsAccessible(item);
        });
    }, [schedules, isMeeting, isSuperUser, userIdentifiers, userLevel, userDivision, members, roles]);

    // Filtered schedules based on user search & dropdowns
    const filteredSchedules = useMemo(() => {
        return typeSchedules.filter(item => {
            if (selectedDayFilter !== 'all' && item.day !== selectedDayFilter) return false;
            
            // Filter by member:
            // For worksheet: strictly filter by PIC (the person whose worksheet it is)
            // For meeting: match PIC OR any Attendee
            if (selectedMemberFilter !== 'all') {
                if (!isMeeting) {
                    const pic = item.picId || item.pic_id || item.author_id || item.userId;
                    if (pic !== selectedMemberFilter) return false;
                } else {
                    const isPic = item.picId === selectedMemberFilter;
                    const isAttendee = Array.isArray(item.attendees) && item.attendees.includes(selectedMemberFilter);
                    if (!isPic && !isAttendee) return false;
                }
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchTitle = item.title?.toLowerCase().includes(q);
                const matchLoc = item.location?.toLowerCase().includes(q);
                const matchNotes = item.notes?.toLowerCase().includes(q);
                const picMember = members.find(m => m.id === item.picId);
                const matchPic = picMember?.name?.toLowerCase().includes(q);

                // Check attendees' names
                const matchAttendees = Array.isArray(item.attendees) && item.attendees.some(attId => {
                    const m = members.find(mem => mem.id === attId);
                    return m?.name?.toLowerCase().includes(q);
                });

                if (!matchTitle && !matchLoc && !matchNotes && !matchPic && !matchAttendees) return false;
            }

            return true;
        });
    }, [typeSchedules, selectedDayFilter, selectedMemberFilter, searchQuery, members, isMeeting]);

    // Statistics
    const stats = useMemo(() => {
        const total = filteredSchedules.length;
        const todayCount = filteredSchedules.filter(s => s.day === todayDayName).length;

        // Find busiest day
        const dayCounts = {};
        DAYS_OF_WEEK.forEach(d => dayCounts[d] = 0);
        filteredSchedules.forEach(s => {
            if (dayCounts[s.day] !== undefined) dayCounts[s.day]++;
        });
        let busiestDay = 'Senin';
        let maxCount = 0;
        Object.entries(dayCounts).forEach(([day, count]) => {
            if (count > maxCount) {
                maxCount = count;
                busiestDay = day;
            }
        });

        // Calculate total hours
        let totalMinutes = 0;
        filteredSchedules.forEach(s => {
            const start = timeToMinutes(s.startTime || '09:00');
            const end = timeToMinutes(s.endTime || '10:00');
            if (end > start) totalMinutes += (end - start);
        });
        const totalHours = (totalMinutes / 60).toFixed(1);

        return { total, todayCount, busiestDay: maxCount > 0 ? `${busiestDay} (${maxCount})` : '-', totalHours };
    }, [filteredSchedules, todayDayName]);

    // Open create modal with optional prefill
    const handleOpenCreateModal = (day = 'Senin', startTime = '09:00') => {
        const startM = timeToMinutes(startTime);
        const endM = Math.min(startM + 60, 23 * 60 + 30);
        const endH = String(Math.floor(endM / 60)).padStart(2, '0');
        const endMin = String(endM % 60).padStart(2, '0');
        const endTime = `${endH}:${endMin}`;

        // If in worksheet, resolve default PIC:
        // Staff can only create for self. Leader can create for selected subordinate or self.
        let defaultPic = session?.memberId || '';
        if (!isMeeting) {
            if (userLevel <= 1) {
                defaultPic = currentUserMember?.id || session?.memberId || '';
            } else if (selectedMemberFilter !== 'all') {
                defaultPic = selectedMemberFilter;
            } else {
                defaultPic = currentUserMember?.id || session?.memberId || '';
            }
        } else if (currentUserMember?.id) {
            defaultPic = currentUserMember.id;
        }

        setFormData({
            title: '',
            day: DAYS_OF_WEEK.includes(day) ? day : 'Senin',
            startTime: TIME_SLOTS.includes(startTime) ? startTime : '09:00',
            endTime: END_TIME_SLOTS.includes(endTime) ? endTime : '10:00',
            picId: defaultPic,
            attendees: defaultPic ? [defaultPic] : [],
            location: isMeeting ? '' : 'Meja Kerja / On-site',
            notes: '',
            color: isMeeting ? '#6366f1' : '#0ea5e9'
        });
        setEditingItem(null);
        setModalMode('create');
        setIsAttendeeDropdownOpen(false);
        setAttendeeSearchQuery('');
        setIsModalOpen(true);
    };

    // Open edit modal
    const handleOpenEditModal = (item) => {
        setEditingItem(item);
        const existingAttendees = Array.isArray(item.attendees) ? item.attendees : [];
        // Ensure picId is included if exists
        const finalAttendees = (item.picId && !existingAttendees.includes(item.picId))
            ? [item.picId, ...existingAttendees]
            : existingAttendees;

        setFormData({
            title: item.title || '',
            day: item.day || 'Senin',
            startTime: item.startTime || '09:00',
            endTime: item.endTime || '10:00',
            picId: item.picId || '',
            attendees: finalAttendees,
            location: item.location || '',
            notes: item.notes || '',
            color: item.color || '#6366f1'
        });
        setModalMode('edit');
        setIsAttendeeDropdownOpen(false);
        setAttendeeSearchQuery('');
        setIsModalOpen(true);
    };

    // Form submit
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('Judul kegiatan / agenda harus diisi');
            return;
        }

        const startM = timeToMinutes(formData.startTime);
        const endM = timeToMinutes(formData.endTime);
        if (endM <= startM) {
            alert('Jam selesai harus lebih besar dari jam mulai');
            return;
        }

        if (modalMode === 'edit' && editingItem && !checkCanManage(editingItem)) {
            alert('Anda tidak memiliki izin untuk mengubah jadwal ini.');
            return;
        }

        const payload = {
            id: modalMode === 'edit' && editingItem ? editingItem.id : crypto.randomUUID(),
            type: isMeeting ? 'schedule_meeting' : 'schedule_worksheet',
            title: formData.title.trim(),
            day: formData.day,
            startTime: formData.startTime,
            endTime: formData.endTime,
            picId: (!isMeeting && userLevel <= 1) ? (currentUserMember?.id || session?.memberId || null) : (formData.picId || null),
            attendees: Array.isArray(formData.attendees) ? formData.attendees : [],
            location: formData.location.trim() || null,
            notes: formData.notes.trim() || null,
            color: formData.color || '#6366f1',
            updatedAt: new Date().toISOString()
        };

        if (modalMode === 'create') {
            payload.createdAt = new Date().toISOString();
            if (onAddSchedule) await onAddSchedule(payload);
        } else {
            if (onUpdateSchedule) await onUpdateSchedule(payload);
        }

        setIsModalOpen(false);
    };

    // Delete schedule
    const handleDeleteSchedule = async (id, e) => {
        if (e) e.stopPropagation();
        const target = (schedules || []).find(s => s.id === id);
        if (target && !checkCanManage(target)) {
            alert('Anda tidak memiliki izin untuk menghapus jadwal ini.');
            return;
        }
        if (window.confirm('Hapus jadwal ini?')) {
            if (onDeleteSchedule) await onDeleteSchedule(id);
            if (isModalOpen && editingItem?.id === id) {
                setIsModalOpen(false);
            }
        }
    };

    // Get color theme helper
    const getColorMeta = (colorHex) => {
        const found = PRESET_COLORS.find(c => c.hex.toLowerCase() === (colorHex || '').toLowerCase());
        if (found) return found;
        return {
            bg: 'bg-indigo-50',
            border: 'border-indigo-200',
            text: 'text-indigo-800',
            bar: 'bg-indigo-500',
            hex: colorHex || '#6366f1'
        };
    };

    // Group schedules by day for fast lookup in grid
    const schedulesByDay = useMemo(() => {
        const map = {};
        DAYS_OF_WEEK.forEach(d => { map[d] = []; });
        filteredSchedules.forEach(item => {
            if (map[item.day]) {
                map[item.day].push(item);
            }
        });
        return map;
    }, [filteredSchedules]);

    // Filtered members for attendees dropdown search
    const filteredModalMembers = useMemo(() => {
        const q = attendeeSearchQuery.toLowerCase().trim();
        const activeMembers = members.filter(m => m.is_active !== false);
        if (!q) return activeMembers;
        return activeMembers.filter(m => 
            m.name?.toLowerCase().includes(q) || 
            m.role?.toLowerCase().includes(q) || 
            m.division?.toLowerCase().includes(q)
        );
    }, [members, attendeeSearchQuery]);

    // Height of one 30-minute slot in pixels (56px default makes 1-hour meetings 108px high, very spacious)
    const SLOT_HEIGHT_PX = slotDensity === 'compact' ? 46 : (slotDensity === 'spacious' ? 68 : 56);
    const GRID_START_MINUTES = 8 * 60; // 08:00 = 480 minutes
    const TOTAL_GRID_HEIGHT = TIME_SLOTS.length * SLOT_HEIGHT_PX;

    return (
        <div className="w-full space-y-5 animate-fade-in">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold shadow-xs ${
                            isMeeting ? 'bg-indigo-600 text-white' : 'bg-sky-600 text-white'
                        }`}>
                            <i className={`fa-solid ${isMeeting ? 'fa-calendar-check' : 'fa-table-cells'}`}></i>
                        </span>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                                {pageTitle}
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                    isMeeting 
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                        : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}>
                                    Mingguan (Senin - Minggu)
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">{pageSubtitle}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* View mode toggle */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/70 text-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
                                viewMode === 'grid' 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <i className="fa-solid fa-calendar-week text-xs"></i>
                            <span>Grid Waktu</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
                                viewMode === 'list' 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <i className="fa-solid fa-list text-xs"></i>
                            <span>Daftar Hari</span>
                        </button>
                    </div>

                    {/* Density / Slot Height Toggle (Grid mode only) */}
                    {viewMode === 'grid' && (
                        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/70 text-xs" title="Tinggi Baris Kalender">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 hidden sm:inline">Tinggi:</span>
                            <button
                                type="button"
                                onClick={() => setSlotDensity('compact')}
                                className={`px-2.5 py-1.5 rounded-xl font-semibold text-[11px] transition ${
                                    slotDensity === 'compact' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Kompak (46px)"
                            >
                                Kompak
                            </button>
                            <button
                                type="button"
                                onClick={() => setSlotDensity('normal')}
                                className={`px-2.5 py-1.5 rounded-xl font-semibold text-[11px] transition ${
                                    slotDensity === 'normal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Standar (56px) - Pas untuk meeting 1 jam"
                            >
                                Standar
                            </button>
                            <button
                                type="button"
                                onClick={() => setSlotDensity('spacious')}
                                className={`px-2.5 py-1.5 rounded-xl font-semibold text-[11px] transition ${
                                    slotDensity === 'spacious' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Luas (68px) - Ekstra longgar"
                            >
                                Luas
                            </button>
                        </div>
                    )}

                    {/* Add Schedule Button */}
                    <button
                        type="button"
                        onClick={() => handleOpenCreateModal(todayDayName, '09:00')}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold text-white shadow-md transition-all hover:scale-102 cursor-pointer ${
                            isMeeting 
                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' 
                                : 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20'
                        }`}
                    >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>{isMeeting ? 'Tambah Jadwal Meeting' : 'Tambah Worksheet'}</span>
                    </button>
                </div>
            </div>

            {/* Quick stats banner (dihilangkan dari meeting sesuai permintaan) */}
            {!isMeeting && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/70 backdrop-blur rounded-2xl p-3.5 border border-slate-200/70 shadow-2xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
                            <i className="fa-solid fa-calendar-day"></i>
                        </div>
                        <div>
                            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Agenda</div>
                            <div className="text-lg font-bold text-slate-800">{stats.total} Jadwal</div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur rounded-2xl p-3.5 border border-slate-200/70 shadow-2xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base shrink-0">
                            <i className="fa-solid fa-clock"></i>
                        </div>
                        <div>
                            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Hari Ini ({todayDayName})</div>
                            <div className="text-lg font-bold text-slate-800">{stats.todayCount} Jadwal</div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur rounded-2xl p-3.5 border border-slate-200/70 shadow-2xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-base shrink-0">
                            <i className="fa-solid fa-fire text-amber-500"></i>
                        </div>
                        <div>
                            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Hari Tersibuk</div>
                            <div className="text-sm font-bold text-slate-800 truncate" title={stats.busiestDay}>{stats.busiestDay}</div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur rounded-2xl p-3.5 border border-slate-200/70 shadow-2xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base shrink-0">
                            <i className="fa-solid fa-hourglass-half"></i>
                        </div>
                        <div>
                            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Alokasi Waktu</div>
                            <div className="text-lg font-bold text-slate-800">{stats.totalHours} Jam/mgg</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/60 backdrop-blur p-3 rounded-2xl border border-slate-200/60 text-xs">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                    {/* Search box */}
                    <div className="relative flex-1 min-w-[180px] max-w-sm">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Cari agenda, lokasi, atau nama peserta..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-700 placeholder-slate-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        )}
                    </div>

                    {/* Filter PIC / Peserta (Meeting) ATAU Filter by Nama (Worksheet) */}
                    {isMeeting ? (
                        <select
                            value={selectedMemberFilter}
                            onChange={(e) => setSelectedMemberFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                            <option value="all">{isSuperUser ? 'Semua Anggota (PIC / Peserta)' : 'Semua Jadwal Saya'}</option>
                            {members.filter(m => m.is_active !== false).map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.position || m.role || 'Staff'})</option>
                            ))}
                        </select>
                    ) : (
                        /* Worksheet Filter */
                        userLevel <= 1 ? (
                            /* Staff: hanya bisa melihat miliknya sendiri (terkunci) */
                            <div 
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs select-none"
                                title="Sebagai Staff, Anda hanya dapat mengakses dan melihat worksheet milik Anda sendiri"
                            >
                                <i className="fa-solid fa-user-lock text-slate-400 text-[11px]"></i>
                                <span>Worksheet Saya ({currentUserMember?.name || session?.name || 'Staff'})</span>
                            </div>
                        ) : (
                            /* Pimpinan (SPV, Koordinator, Manager, Direksi, Super User): Filter by Nama */
                            <div className="flex items-center gap-1.5">
                                <label className="text-[11px] font-semibold text-slate-500 hidden sm:inline-flex items-center gap-1">
                                    <i className="fa-solid fa-user-group text-indigo-500"></i>
                                    Filter Nama:
                                </label>
                                <select
                                    value={selectedMemberFilter}
                                    onChange={(e) => setSelectedMemberFilter(e.target.value)}
                                    className="bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-xs hover:border-indigo-300 transition-all"
                                >
                                    <option value="all">👥 Semua Tim ({viewableWorksheetMembers.length} Anggota)</option>
                                    {currentUserMember && (
                                        <option value={currentUserMember.id}>👤 Worksheet Saya ({currentUserMember.name})</option>
                                    )}
                                    {subordinateMembers.length > 0 && (
                                        <optgroup label="Bawahan (Koordinator & Staff)">
                                            {subordinateMembers.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    📋 {m.name} — {m.position || m.role || 'Staff'} {m.department ? `(${m.department})` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        )
                    )}

                    {/* Filter Hari */}
                    <select
                        value={selectedDayFilter}
                        onChange={(e) => setSelectedDayFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                        <option value="all">Semua Hari (Senin - Minggu)</option>
                        {DAYS_OF_WEEK.map(d => (
                            <option key={d} value={d}>{d} {d === todayDayName ? '⭐ (Hari Ini)' : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="text-[11px] text-slate-400 font-medium">
                    Menampilkan <span className="font-bold text-slate-700">{filteredSchedules.length}</span> agenda
                </div>
            </div>

            {/* MAIN CONTENT: GRID VIEW OR LIST VIEW */}
            {viewMode === 'grid' ? (
                /* GRID VIEW (Mingguan: Row Header = Senin-Minggu, Kolom Pertama = Jam 08:00 - 23:00 per 30 menit) */
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col">
                    {/* Top explanation note */}
                    <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-circle-info text-indigo-500"></i>
                            <span><strong>Tips:</strong> Klik pada kotak jam kosong manapun untuk langsung menjadwalkan kegiatan baru pada hari & jam tersebut.</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Hari Ini ({todayDayName})
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Interval 30 Menit (08:00 - 23:00)
                            </span>
                        </div>
                    </div>

                    {/* Scrollable calendar table container */}
                    <div className="overflow-x-auto overflow-y-auto max-h-[75vh] custom-scrollbar relative">
                        <div className="min-w-[980px] select-none">
                            {/* Sticky Header Row: Hari (Senin s/d Minggu) */}
                            <div className="sticky top-0 z-30 flex bg-white/95 backdrop-blur-md border-b-2 border-slate-200 shadow-xs">
                                {/* First Column Top-Left Header: Jam */}
                                <div className="w-20 shrink-0 p-3 text-center border-r border-slate-200 bg-slate-100/90 font-bold text-xs text-slate-600 flex flex-col items-center justify-center">
                                    <i className="fa-regular fa-clock text-slate-400 mb-0.5"></i>
                                    <span>WAKTU</span>
                                </div>

                                {/* 7 Day Headers: Senin s/d Minggu */}
                                {DAYS_OF_WEEK.map(day => {
                                    const isToday = day === todayDayName;
                                    const dayCount = (schedulesByDay[day] || []).length;

                                    return (
                                        <div
                                            key={day}
                                            className={`flex-1 min-w-[130px] p-3 text-center border-r border-slate-200 last:border-r-0 transition-colors ${
                                                isToday ? 'bg-indigo-50/90 font-bold text-indigo-900 ring-2 ring-indigo-500/20 inset-0' : 'bg-slate-50/80 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span className="text-sm font-bold tracking-tight">{day}</span>
                                                {isToday && (
                                                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold shadow-2xs">
                                                        Hari Ini
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] font-normal text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                                                <span>{dayCount} agenda</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenCreateModal(day, '09:00')}
                                                    className="w-4 h-4 rounded-full bg-slate-200 hover:bg-indigo-600 hover:text-white text-slate-600 inline-flex items-center justify-center text-[9px] transition"
                                                    title={`Tambah jadwal hari ${day}`}
                                                >
                                                    <i className="fa-solid fa-plus"></i>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Body Rows: Kolom Pertama = Jam 08:00 - 23:00 per 30 menit */}
                            <div className="relative flex" style={{ height: `${TOTAL_GRID_HEIGHT}px` }}>
                                {/* Left Time Column */}
                                <div className="w-20 shrink-0 border-r border-slate-200 bg-slate-50/50 z-20 select-none">
                                    {TIME_SLOTS.map((slot) => {
                                        const isOclock = slot.endsWith(':00');
                                        return (
                                            <div
                                                key={slot}
                                                style={{ height: `${SLOT_HEIGHT_PX}px` }}
                                                className={`flex items-center justify-center text-[11px] font-medium border-b border-slate-100 px-1 ${
                                                    isOclock ? 'font-bold text-slate-700 bg-slate-100/50 border-b-slate-200' : 'text-slate-400'
                                                }`}
                                            >
                                                <span>{slot}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 7 Day Columns with interactive slots and positioned cards */}
                                {DAYS_OF_WEEK.map((day) => {
                                    const isToday = day === todayDayName;
                                    const dayItems = schedulesByDay[day] || [];

                                    return (
                                        <div
                                            key={day}
                                            className={`flex-1 min-w-[130px] border-r border-slate-200 last:border-r-0 relative group/col ${
                                                isToday ? 'bg-indigo-50/15' : 'bg-white'
                                            }`}
                                        >
                                            {/* Background slot grid cells (clickable for quick add) */}
                                            {TIME_SLOTS.map((slot) => {
                                                const isOclock = slot.endsWith(':00');
                                                return (
                                                    <div
                                                        key={slot}
                                                        style={{ height: `${SLOT_HEIGHT_PX}px` }}
                                                        onClick={() => handleOpenCreateModal(day, slot)}
                                                        className={`border-b group/cell relative cursor-pointer transition-colors ${
                                                            isOclock ? 'border-b-slate-200 hover:bg-indigo-50/40' : 'border-b-slate-100 hover:bg-slate-50'
                                                        }`}
                                                        title={`Klik untuk tambah jadwal ${day} pukul ${slot}`}
                                                    >
                                                        {/* Subtle hover plus button */}
                                                        <div className="opacity-0 group-hover/cell:opacity-100 absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity">
                                                            <span className="bg-indigo-600 text-white rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-sm flex items-center gap-1">
                                                                <i className="fa-solid fa-plus text-[9px]"></i> {slot}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Positioned Event Cards on top of grid */}
                                            {dayItems.map(item => {
                                                const startM = timeToMinutes(item.startTime || '09:00');
                                                const endM = timeToMinutes(item.endTime || '10:00');
                                                
                                                // Clamp into grid boundary
                                                const clampedStart = Math.max(startM, GRID_START_MINUTES);
                                                const clampedEnd = Math.min(Math.max(endM, clampedStart + 30), 23 * 60 + 30);
                                                
                                                const offsetMinutes = clampedStart - GRID_START_MINUTES;
                                                const durationMinutes = clampedEnd - clampedStart;
                                                
                                                const topPx = (offsetMinutes / 30) * SLOT_HEIGHT_PX;
                                                const heightPx = Math.max((durationMinutes / 30) * SLOT_HEIGHT_PX - 4, 38);

                                                const colorMeta = getColorMeta(item.color);
                                                const picMember = members.find(m => m.id === item.picId);
                                                const attendeesList = Array.isArray(item.attendees) ? item.attendees : [];
                                                const attendeeMembers = attendeesList
                                                    .map(id => members.find(m => m.id === id))
                                                    .filter(Boolean);
                                                if (picMember && !attendeeMembers.some(m => m.id === picMember.id)) {
                                                    attendeeMembers.unshift(picMember);
                                                }
                                                const attendeeNames = attendeeMembers
                                                    .map(m => m.id === item.picId ? `${m.name} (PIC)` : m.name)
                                                    .join(', ');
                                                const canManageItem = checkCanManage(item);

                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenEditModal(item);
                                                        }}
                                                        style={{
                                                            top: `${topPx + 2}px`,
                                                            height: `${heightPx}px`,
                                                            left: '4px',
                                                            right: '4px'
                                                        }}
                                                        className={`absolute z-10 rounded-2xl border p-2 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer overflow-hidden flex flex-col justify-between group/card ${colorMeta.bg} ${colorMeta.border}`}
                                                    >
                                                        {/* Left color bar indicator */}
                                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorMeta.bar}`}></div>

                                                        <div className="pl-1.5 overflow-hidden">
                                                            <div className="flex items-start justify-between gap-1">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white/90 shadow-2xs ${colorMeta.text} shrink-0`}>
                                                                    {item.startTime} - {item.endTime}
                                                                </span>

                                                                {/* Quick action buttons on hover */}
                                                                <div className="opacity-0 group-hover/card:opacity-100 flex items-center gap-1 transition-opacity">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenEditModal(item);
                                                                        }}
                                                                        className="w-5 h-5 rounded-md bg-white text-slate-600 hover:text-indigo-600 flex items-center justify-center text-[10px] shadow-xs"
                                                                        title={canManageItem ? "Edit" : "Lihat Rincian"}
                                                                    >
                                                                        <i className={`fa-solid ${canManageItem ? 'fa-pen' : 'fa-eye'}`}></i>
                                                                    </button>
                                                                    {canManageItem && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleDeleteSchedule(item.id, e)}
                                                                            className="w-5 h-5 rounded-md bg-white text-slate-600 hover:text-red-600 flex items-center justify-center text-[10px] shadow-xs"
                                                                            title="Hapus"
                                                                        >
                                                                            <i className="fa-solid fa-trash-can"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="text-xs font-bold text-slate-800 truncate mt-0.5 leading-snug" title={item.title}>
                                                                {item.title}
                                                            </div>

                                                            {/* Peserta Meeting (untuk Meeting) atau Info PIC & Lokasi (untuk Worksheet) */}
                                                            {isMeeting ? (
                                                                heightPx > 40 && (
                                                                    <div 
                                                                        className="text-[10.5px] text-slate-600 flex items-start gap-1.5 mt-0.5 leading-snug" 
                                                                        title={attendeeNames ? `Peserta (${attendeeMembers.length}): ${attendeeNames}` : 'Belum ada peserta'}
                                                                    >
                                                                        <i className="fa-solid fa-users text-[9.5px] text-indigo-600 shrink-0 mt-0.5"></i>
                                                                        <span className="font-medium text-slate-700 line-clamp-2 leading-tight">
                                                                            {attendeeNames || (picMember ? `${picMember.name} (PIC)` : 'Tanpa Peserta')}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            ) : (
                                                                <div className="space-y-0.5 mt-0.5">
                                                                    {picMember && (
                                                                        <div className="text-[10px] font-semibold text-slate-700 flex items-center gap-1 leading-tight" title={`PIC: ${picMember.name} (${picMember.position || picMember.role || 'Staff'})`}>
                                                                            <span 
                                                                                className="w-3.5 h-3.5 rounded-full text-white text-[7.5px] font-bold flex items-center justify-center shrink-0"
                                                                                style={{ backgroundColor: picMember.color || '#0ea5e9' }}
                                                                            >
                                                                                {picMember.name?.[0]?.toUpperCase()}
                                                                            </span>
                                                                            <span className="truncate">{picMember.name}</span>
                                                                            <span className="text-[9px] text-slate-400 font-normal shrink-0">({picMember.position || picMember.role || 'Staff'})</span>
                                                                        </div>
                                                                    )}
                                                                    {item.location && heightPx > 60 && (
                                                                        <div className="text-[10px] text-slate-500 truncate flex items-center gap-1" title={item.location}>
                                                                            <i className="fa-solid fa-location-dot text-[9px] text-slate-400"></i>
                                                                            <span>{item.location}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Footer: PIC & Peserta (hanya tampil jika ruang card cukup, disembunyikan pada meeting <= 1 jam agar tidak memotong teks peserta) */}
                                                        {(isMeeting ? heightPx >= 120 : heightPx > 60) && (
                                                            <div className="pl-1.5 mt-auto pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-black/5">
                                                                <div className="flex items-center gap-1 truncate">
                                                                    {picMember ? (
                                                                        <>
                                                                            <span
                                                                                className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center shrink-0"
                                                                                style={{ backgroundColor: picMember.color || '#6366f1' }}
                                                                                title={`PIC: ${picMember.name}`}
                                                                            >
                                                                                {picMember.name?.[0]?.toUpperCase()}
                                                                            </span>
                                                                            <span className="truncate max-w-[80px] font-medium">{picMember.name}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="italic text-slate-400">Tanpa PIC</span>
                                                                    )}
                                                                </div>

                                                                {attendeesList.length > 0 && (
                                                                    <span 
                                                                        className="text-[9px] bg-white/80 font-semibold px-1.5 py-0.2 rounded text-indigo-700 flex items-center gap-1 shadow-2xs shrink-0"
                                                                        title={`Peserta (${attendeesList.length}): ${attendeesList.map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(', ')}`}
                                                                    >
                                                                        <i className="fa-solid fa-users text-[8px]"></i>
                                                                        <span>{attendeesList.length}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* LIST VIEW: Agendas grouped by Day (Senin - Minggu) */
                <div className="space-y-4">
                    {DAYS_OF_WEEK.map(day => {
                        if (selectedDayFilter !== 'all' && selectedDayFilter !== day) return null;
                        const isToday = day === todayDayName;
                        const dayItems = (schedulesByDay[day] || []).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

                        return (
                            <div
                                key={day}
                                className={`bg-white rounded-3xl border p-5 shadow-xs transition-all ${
                                    isToday ? 'border-indigo-300 ring-2 ring-indigo-100 bg-indigo-50/20' : 'border-slate-200/80'
                                }`}
                            >
                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                            isToday ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {day.slice(0, 3)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                                {day}
                                                {isToday && (
                                                    <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                                                        Hari Ini
                                                    </span>
                                                )}
                                            </h3>
                                            <span className="text-xs text-slate-400">{dayItems.length} agenda terjadwal</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleOpenCreateModal(day, '09:00')}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                                    >
                                        <i className="fa-solid fa-plus text-[10px]"></i>
                                        <span>Tambah Jadwal {day}</span>
                                    </button>
                                </div>

                                {dayItems.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                        Belum ada jadwal untuk hari {day}.{' '}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCreateModal(day, '09:00')}
                                            className="text-indigo-600 font-bold hover:underline not-italic ml-1"
                                        >
                                            + Tambah sekarang
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {dayItems.map(item => {
                                            const colorMeta = getColorMeta(item.color);
                                            const picMember = members.find(m => m.id === item.picId);
                                            const attendeesList = Array.isArray(item.attendees) ? item.attendees : [];
                                            const attendeeMembers = attendeesList
                                                .map(id => members.find(m => m.id === id))
                                                .filter(Boolean);
                                            if (picMember && !attendeeMembers.some(m => m.id === picMember.id)) {
                                                attendeeMembers.unshift(picMember);
                                            }
                                            const attendeeNames = attendeeMembers
                                                .map(m => m.id === item.picId ? `${m.name} (PIC)` : m.name)
                                                .join(', ');

                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleOpenEditModal(item)}
                                                    className={`p-4 rounded-2xl border transition-all hover:shadow-md cursor-pointer flex flex-col justify-between group relative overflow-hidden ${colorMeta.bg} ${colorMeta.border}`}
                                                >
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorMeta.bar}`}></div>

                                                    <div className="pl-1 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/90 shadow-2xs ${colorMeta.text}`}>
                                                                <i className="fa-regular fa-clock mr-1"></i>
                                                                {item.startTime} - {item.endTime}
                                                            </span>
                                                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenEditModal(item);
                                                                    }}
                                                                    className="w-6 h-6 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white flex items-center justify-center text-xs transition"
                                                                    title={checkCanManage(item) ? "Edit" : "Lihat Rincian"}
                                                                >
                                                                    <i className={`fa-solid ${checkCanManage(item) ? 'fa-pen' : 'fa-eye'}`}></i>
                                                                </button>
                                                                {checkCanManage(item) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleDeleteSchedule(item.id, e)}
                                                                        className="w-6 h-6 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white flex items-center justify-center text-xs transition"
                                                                        title="Hapus"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <h4 className="font-bold text-sm text-slate-800 leading-snug">
                                                            {item.title}
                                                        </h4>

                                                        {isMeeting ? (
                                                            attendeeMembers.length > 0 ? (
                                                                <div className="text-xs text-slate-600 flex items-center gap-1.5" title={`Peserta (${attendeeMembers.length}): ${attendeeNames}`}>
                                                                    <i className="fa-solid fa-users text-indigo-500 text-[10px] shrink-0"></i>
                                                                    <span className="font-medium text-slate-700 truncate">{attendeeNames}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-slate-400 italic flex items-center gap-1.5">
                                                                    <i className="fa-solid fa-users text-slate-300 text-[10px] shrink-0"></i>
                                                                    <span>Tanpa Peserta</span>
                                                                </div>
                                                            )
                                                        ) : (
                                                            item.location && (
                                                                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                                                    <i className="fa-solid fa-location-dot text-slate-400 text-[10px]"></i>
                                                                    <span>{item.location}</span>
                                                                </div>
                                                            )
                                                        )}

                                                        {item.notes && (
                                                            <p className="text-xs text-slate-500 line-clamp-2 bg-white/60 p-2 rounded-xl border border-black/5">
                                                                {item.notes}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="pl-1 pt-3 mt-3 border-t border-black/5 flex items-center justify-between text-xs text-slate-500">
                                                        <div className="flex items-center gap-1.5">
                                                            {picMember ? (
                                                                <>
                                                                    <span
                                                                        className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                                                                        style={{ backgroundColor: picMember.color || '#6366f1' }}
                                                                        title={`PIC: ${picMember.name}`}
                                                                    >
                                                                        {picMember.name?.[0]?.toUpperCase()}
                                                                    </span>
                                                                    <span className="font-semibold text-slate-700">{picMember.name}</span>
                                                                </>
                                                            ) : (
                                                                <span className="italic text-slate-400 text-[11px]">Tanpa PIC</span>
                                                            )}
                                                        </div>

                                                        {attendeesList.length > 0 && (
                                                            <div 
                                                                className="flex items-center gap-1 text-[11px] bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-600 font-medium" 
                                                                title={`Peserta: ${attendeesList.map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(', ')}`}
                                                            >
                                                                <i className="fa-solid fa-users text-indigo-500 text-[10px]"></i>
                                                                <span>{attendeesList.length} Peserta</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: Tambah / Edit Jadwal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        {(() => {
                            const isEditingItemOwner = modalMode === 'create' || !editingItem || checkIsOwner(editingItem);
                            return (
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white ${
                                            isMeeting ? 'bg-indigo-600' : 'bg-sky-600'
                                        }`}>
                                            <i className={`fa-solid ${isMeeting ? 'fa-handshake' : 'fa-list-check'}`}></i>
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-base text-slate-800">
                                                {modalMode === 'create' ? `Tambah ${pageTitle}` : (isEditingItemOwner ? `Ubah ${pageTitle}` : `Rincian ${pageTitle}`)}
                                            </h3>
                                            <p className="text-[11px] text-slate-400">
                                                {isEditingItemOwner ? 'Jadwal mingguan berulang (Senin - Minggu)' : 'Mode Hanya Baca (Peserta)'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition"
                                    >
                                        <i className="fa-solid fa-xmark text-sm"></i>
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                            {/* Judul Kegiatan / Meeting */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Judul {isMeeting ? 'Meeting / Rapat' : 'Kegiatan / Worksheet'} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder={isMeeting ? 'cth. Weekly Evaluation, Review SOP, Briefing Pagi...' : 'cth. Pembuatan Konten Instagram, Stock Opname, Live Sales...'}
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full text-sm border border-slate-200 rounded-2xl px-3.5 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                                />
                            </div>

                            {/* Hari & Rentang Waktu (Jam Mulai - Jam Selesai) */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                        <i className="fa-regular fa-calendar text-indigo-500"></i> Hari
                                    </label>
                                    <select
                                        value={formData.day}
                                        onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                                    >
                                        {DAYS_OF_WEEK.map(d => (
                                            <option key={d} value={d}>{d} {d === todayDayName ? '(Hari Ini)' : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                        <i className="fa-regular fa-clock text-indigo-500"></i> Jam Mulai
                                    </label>
                                    <select
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                                    >
                                        {TIME_SLOTS.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                        <i className="fa-regular fa-clock text-indigo-500"></i> Jam Selesai
                                    </label>
                                    <select
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                                    >
                                        {END_TIME_SLOTS.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* PIC & Peserta Meeting (Menggantikan Divisi Terkait) */}
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Penanggung Jawab (PIC) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                            <i className="fa-regular fa-user text-indigo-500"></i> Penanggung Jawab (PIC)
                                        </label>
                                        {!isMeeting && userLevel <= 1 ? (
                                            <input
                                                type="text"
                                                disabled
                                                value={`${currentUserMember?.name || session?.name || 'Saya'} (Staff)`}
                                                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-100 text-slate-600 font-semibold cursor-not-allowed select-none"
                                            />
                                        ) : (
                                            <select
                                                value={formData.picId}
                                                onChange={(e) => {
                                                    const newPicId = e.target.value;
                                                    setFormData(prev => {
                                                        const nextAttendees = (newPicId && !prev.attendees.includes(newPicId))
                                                            ? [...prev.attendees, newPicId]
                                                            : prev.attendees;
                                                        return { ...prev, picId: newPicId, attendees: nextAttendees };
                                                    });
                                                }}
                                                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                                            >
                                                <option value="">-- Pilih PIC (Opsional) --</option>
                                                {(isMeeting ? members.filter(m => m.is_active !== false || m.id === formData.picId) : viewableWorksheetMembers).map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({m.position || m.role || 'Staff'}) {m.id === session?.memberId ? '(Saya)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Peserta Meeting / Kegiatan */}
                                    <div className="relative" ref={attendeeDropdownRef}>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                                            <span className="flex items-center gap-1">
                                                <i className="fa-solid fa-users text-indigo-500"></i> {isMeeting ? 'Peserta Meeting' : 'Peserta Kegiatan'}
                                            </span>
                                            <span className="text-[11px] font-normal text-slate-400">
                                                {formData.attendees.length} dipilih
                                            </span>
                                        </label>

                                        {/* Dropdown Toggle Button */}
                                        <button
                                            type="button"
                                            onClick={() => setIsAttendeeDropdownOpen(!isAttendeeDropdownOpen)}
                                            className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white text-left flex items-center justify-between hover:bg-slate-50 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                                        >
                                            <span className="truncate text-slate-700 font-medium">
                                                {formData.attendees.length === 0 
                                                    ? `-- Pilih ${isMeeting ? 'Peserta Meeting' : 'Peserta'} --`
                                                    : `${formData.attendees.length} anggota dipilih`}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${isAttendeeDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`}></i>
                                        </button>

                                        {/* Popover Checklist Peserta */}
                                        {isAttendeeDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-3 space-y-2.5 animate-fade-in max-h-60 overflow-hidden flex flex-col">
                                                {/* Header action bar */}
                                                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] shrink-0">
                                                    <span className="font-bold text-slate-700">Daftar Anggota</span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const allActiveIds = members.filter(m => m.is_active !== false).map(m => m.id);
                                                                setFormData(prev => ({ ...prev, attendees: allActiveIds }));
                                                            }}
                                                            className="text-indigo-600 hover:text-indigo-800 font-semibold"
                                                        >
                                                            Pilih Semua
                                                        </button>
                                                        <span className="text-slate-300">•</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, attendees: [] }))}
                                                            className="text-slate-400 hover:text-rose-600 font-medium"
                                                        >
                                                            Reset
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Search member */}
                                                <div className="relative shrink-0">
                                                    <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                                                    <input
                                                        type="text"
                                                        placeholder="Cari nama atau jabatan..."
                                                        value={attendeeSearchQuery}
                                                        onChange={(e) => setAttendeeSearchQuery(e.target.value)}
                                                        className="w-full pl-7 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-slate-50/50"
                                                    />
                                                </div>

                                                {/* Checklist members list */}
                                                <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
                                                    {filteredModalMembers.map(member => {
                                                        const isChecked = formData.attendees.includes(member.id);
                                                        const isCurrentPic = formData.picId === member.id;

                                                        return (
                                                            <label
                                                                key={member.id}
                                                                className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition text-xs select-none ${
                                                                    isChecked ? 'bg-indigo-50/90 font-semibold text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => {
                                                                            setFormData(prev => {
                                                                                const next = isChecked
                                                                                    ? prev.attendees.filter(id => id !== member.id)
                                                                                    : [...prev.attendees, member.id];
                                                                                return { ...prev, attendees: next };
                                                                            });
                                                                        }}
                                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
                                                                    />
                                                                    <span
                                                                        className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center shrink-0"
                                                                        style={{ backgroundColor: member.color || '#6366f1' }}
                                                                    >
                                                                        {member.name?.[0]?.toUpperCase()}
                                                                    </span>
                                                                    <span className="truncate">{member.name}</span>
                                                                    {isCurrentPic && (
                                                                        <span className="text-[9px] bg-indigo-200/70 text-indigo-800 px-1 rounded font-bold">
                                                                            PIC
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 font-normal shrink-0 ml-1">
                                                                    {member.division || member.role || 'Staff'}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}

                                                    {filteredModalMembers.length === 0 && (
                                                        <div className="text-center py-3 text-xs text-slate-400 italic">
                                                            Anggota tidak ditemukan
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Chips of Selected Attendees */}
                                {formData.attendees.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                            Daftar Peserta Terpilih ({formData.attendees.length} orang):
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/80 rounded-2xl border border-slate-200/70 max-h-24 overflow-y-auto custom-scrollbar">
                                            {formData.attendees.map(attendeeId => {
                                                const m = members.find(item => item.id === attendeeId);
                                                if (!m) return null;
                                                const isPic = formData.picId === attendeeId;

                                                return (
                                                    <span
                                                        key={attendeeId}
                                                        className={`inline-flex items-center gap-1.5 border rounded-xl px-2 py-0.8 text-xs font-medium shadow-2xs ${
                                                            isPic 
                                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold' 
                                                                : 'bg-white border-slate-200 text-slate-700'
                                                        }`}
                                                    >
                                                        <span
                                                            className="w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                                                            style={{ backgroundColor: m.color || '#6366f1' }}
                                                        >
                                                            {m.name?.[0]?.toUpperCase()}
                                                        </span>
                                                        <span className="truncate max-w-[100px]">{m.name}</span>
                                                        {isPic && (
                                                            <span className="text-[8px] bg-indigo-600 text-white px-1 rounded-sm font-bold">
                                                                PIC
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    attendees: prev.attendees.filter(id => id !== attendeeId)
                                                                }));
                                                            }}
                                                            className="text-slate-400 hover:text-rose-600 ml-0.5"
                                                            title={`Hapus ${m.name}`}
                                                        >
                                                            <i className="fa-solid fa-xmark text-[10px]"></i>
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Lokasi / Tautan Platform */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                    <i className="fa-solid fa-location-dot text-indigo-500"></i> Lokasi / Platform / Link Rapat
                                </label>
                                <input
                                    type="text"
                                    placeholder={isMeeting ? 'cth. Ruang Rapat Lt 2, Google Meet (link), Zoom...' : 'cth. Meja Kerja, Studio Foto, Gudang A...'}
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>

                            {/* Catatan / Deskripsi Agenda */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                    <i className="fa-regular fa-comment-dots text-indigo-500"></i> Catatan Agenda / Rincian
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Tuliskan poin pembahasan, rincian aktivitas, atau persiapan yang dibutuhkan..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full text-xs border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                ></textarea>
                            </div>

                            {/* Pilihan Warna / Tag Card */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Warna Label Card
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c.hex}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: c.hex })}
                                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                                                formData.color.toLowerCase() === c.hex.toLowerCase() 
                                                    ? 'scale-120 ring-2 ring-offset-2 ring-slate-400' 
                                                    : 'hover:scale-110 opacity-80'
                                            }`}
                                            style={{ backgroundColor: c.hex }}
                                            title={c.name}
                                        >
                                            {formData.color.toLowerCase() === c.hex.toLowerCase() && (
                                                <i className="fa-solid fa-check text-white text-[10px]"></i>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Modal Actions */}
                            {(() => {
                                const isEditingItemOwner = modalMode === 'create' || !editingItem || checkCanManage(editingItem);
                                return (
                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                        {modalMode === 'edit' && editingItem && isEditingItemOwner ? (
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteSchedule(editingItem.id, e)}
                                                className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-2 rounded-xl transition flex items-center gap-1 font-semibold"
                                            >
                                                <i className="fa-solid fa-trash-can"></i>
                                                <span>Hapus Jadwal</span>
                                            </button>
                                        ) : (
                                            !isEditingItemOwner && editingItem ? (
                                                <span className="text-[11px] text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
                                                    <i className="fa-solid fa-lock text-slate-400"></i>
                                                    Hanya PIC ({members.find(m => m.id === editingItem?.picId)?.name || 'PIC'}) atau Atasan yang dapat mengubah
                                                </span>
                                            ) : <div></div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsModalOpen(false)}
                                                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                            >
                                                {isEditingItemOwner ? 'Batal' : 'Tutup'}
                                            </button>
                                            {isEditingItemOwner && (
                                                <button
                                                    type="submit"
                                                    className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition hover:scale-102 cursor-pointer ${
                                                        isMeeting ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-sky-600 hover:bg-sky-700'
                                                    }`}
                                                >
                                                    {modalMode === 'create' ? 'Simpan Jadwal' : 'Perbarui Jadwal'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
