'use strict';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    DAYS_ID,
    DAYS_SHORT_ID,
    DAYS_OF_WEEK,
    DAYS_OF_WEEK_SHORT,
    MONTHS_ID,
    MONTHS_SHORT_ID,
    formatDateYMD,
    parseDateYMD,
    getDayNameID,
    getDayShortID,
    isSameDay,
    isTodayDate,
    getWeekDays,
    getMonthGrid,
    parseScheduleRecurrence,
    formatRecurrenceLabel,
    isScheduleActiveOnDate,
    timeToMinutes,
    minutesToTime,
    getLocalTimezoneLabel
} from '../lib/calendar-utils';

// Time slots from 07:00 to 23:00 every 30 minutes for comprehensive day coverage
export const TIME_SLOTS = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'
];

export const END_TIME_SLOTS = [
    '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
    '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00',
    '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00',
    '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
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

export { timeToMinutes };

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

// Helper to determine whether a schedule item is a Meeting
export const isMeetingSchedule = (item) => {
    if (!item) return false;
    const t = String(item.type || '').toLowerCase().trim();
    if (t === 'meeting' || t === 'schedule_meeting' || t.includes('meeting') || t.includes('rapat') || t.includes('briefing')) {
        return true;
    }
    if (t === 'worksheet' || t === 'schedule_worksheet' || t.includes('worksheet')) {
        return false;
    }
    const title = String(item.title || '').toLowerCase().trim();
    if (title.includes('worksheet') || title.includes('lembar kerja')) {
        return false;
    }
    if (title.includes('meeting') || title.includes('rapat') || title.includes('briefing') || title.includes('evaluasi') || title.includes('koordinasi') || title.includes('sync')) {
        return true;
    }
    if (Array.isArray(item.attendees) && item.attendees.length > 1) {
        return true;
    }
    const loc = String(item.location || '').toLowerCase();
    if (loc.includes('zoom') || loc.includes('meet') || loc.includes('ruang rapat') || loc.includes('meeting room')) {
        return true;
    }
    return false;
};

// Helper to determine whether a schedule item is a Worksheet
export const isWorksheetSchedule = (item) => {
    if (!item) return false;
    const t = String(item.type || '').toLowerCase().trim();
    if (t === 'worksheet' || t === 'schedule_worksheet' || t.includes('worksheet') || t.includes('kerja') || t.includes('operasional')) {
        return true;
    }
    if (t === 'meeting' || t === 'schedule_meeting' || t.includes('meeting') || t.includes('rapat') || t.includes('briefing')) {
        return false;
    }
    const title = String(item.title || '').toLowerCase().trim();
    if (title.includes('worksheet') || title.includes('lembar kerja') || title.includes('kerja') || title.includes('inspeksi') || title.includes('sop') || title.includes('tugas') || title.includes('gudang')) {
        return true;
    }
    return !isMeetingSchedule(item);
};

export { DAYS_OF_WEEK };

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
        ? 'Kalender jadwal rapat harian, mingguan & bulanan terintegrasi'
        : 'Lembar kerja dan alokasi aktivitas operasional mingguan (Senin - Minggu)';

    // Navigation & View Mode State
    // View modes: 'week' (Gambar 2 Google Calendar) | 'day' (Daily Grid) | 'month' (Bulanan) | 'list' (Agenda)
    const [viewMode, setViewMode] = useState('week');
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMemberFilter, setSelectedMemberFilter] = useState(() => {
        if (type === 'worksheet') {
            return session?.memberId || 'me';
        }
        return 'all';
    });
    const [selectedRecurrenceFilter, setSelectedRecurrenceFilter] = useState('all'); // 'all' | 'weekly' | 'monthly' | 'once' | 'daily'
    const [slotDensity, setSlotDensity] = useState('normal'); // 'compact' (46px) | 'normal' (56px) | 'spacious' (68px)

    // Current live time for red indicator line in Google Calendar
    const [currentLiveTime, setCurrentLiveTime] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentLiveTime(new Date());
        }, 30000); // Update every 30s
        return () => clearInterval(timer);
    }, []);

    // Grid scroll container reference for auto-scroll to current hour
    const gridContainerRef = useRef(null);
    const hasAutoScrolledRef = useRef(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [editingItem, setEditingItem] = useState(null);
    const [isAttendeeDropdownOpen, setIsAttendeeDropdownOpen] = useState(false);
    const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');
    const attendeeDropdownRef = useRef(null);

    // Form state with rich recurrence options
    const [formData, setFormData] = useState({
        title: '',
        recurrenceType: 'weekly', // 'once' | 'weekly' | 'monthly' | 'daily'
        specificDate: formatDateYMD(new Date()),
        weeklyDays: ['Senin'], // e.g. ['Senin', 'Rabu']
        monthlyType: 'date', // 'date' (tgl X) or 'day_of_week' (hari ke-N)
        monthlyDate: new Date().getDate(),
        monthlyWeekNumber: 1, // 1..4 or 'last'
        monthlyDayOfWeek: 'Senin',
        dailyType: 'all', // 'all' (Senin-Minggu) or 'weekdays' (Senin-Jumat)
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

    // Local timezone label (e.g. GMT+08)
    const localTimezone = useMemo(() => getLocalTimezoneLabel(), []);

    // Today's day name in Indonesian
    const todayDayName = useMemo(() => getDayNameID(new Date()), []);

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

    // Viewable worksheet members
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

    // Current user's member ID
    const myMemberId = useMemo(() => {
        return currentUserMember?.id || userIdentifiers.primaryId || session?.memberId || '';
    }, [currentUserMember, userIdentifiers.primaryId, session?.memberId]);

    // Check if current view is user's own worksheet
    const isViewingSelf = useMemo(() => {
        if (isMeeting) return false;
        if (!selectedMemberFilter || selectedMemberFilter === 'all' || selectedMemberFilter === 'me') return true;
        if (myMemberId && selectedMemberFilter === myMemberId) return true;
        if (userIdentifiers.ids.has(selectedMemberFilter)) return true;
        return false;
    }, [isMeeting, selectedMemberFilter, myMemberId, userIdentifiers]);

    // Currently selected member object
    const selectedMemberObj = useMemo(() => {
        if (!selectedMemberFilter || isViewingSelf) return currentUserMember;
        return members.find(m => m.id === selectedMemberFilter) || null;
    }, [selectedMemberFilter, isViewingSelf, currentUserMember, members]);

    // Ensure Worksheet always defaults to current user's worksheet
    useEffect(() => {
        if (!isMeeting) {
            if (userLevel <= 1) {
                if (selectedMemberFilter !== (myMemberId || 'me')) {
                    setSelectedMemberFilter(myMemberId || 'me');
                }
            } else if (!selectedMemberFilter || selectedMemberFilter === 'all') {
                setSelectedMemberFilter(myMemberId || 'me');
            }
        } else {
            if (!selectedMemberFilter) {
                setSelectedMemberFilter('all');
            }
        }
    }, [isMeeting, userLevel, myMemberId, selectedMemberFilter]);

    // Check if user is owner (PIC / creator)
    const checkIsOwner = (item) => {
        if (!item) return false;
        if (isSuperUser) return true;
        const pic = item.picId || item.pic_id || item.author_id || item.authorId || item.userId;
        if (!pic) return false;
        const str = String(pic).trim();
        return userIdentifiers.ids.has(str) || userIdentifiers.emails.has(str.toLowerCase()) || userIdentifiers.names.has(str.toLowerCase());
    };

    // Check if user can edit or delete schedule
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
            if (userLevel <= 1) return false;

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

        // Meeting permission: Check attendees
        const attendees = Array.isArray(item.attendees) ? item.attendees : [];
        for (const att of attendees) {
            if (!att) continue;
            const str = String(att).trim();
            if (userIdentifiers.ids.has(str) || userIdentifiers.emails.has(str.toLowerCase()) || userIdentifiers.names.has(str.toLowerCase())) {
                return true;
            }
        }

        // Check sharedWith
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
            const matchesType = isMeeting 
                ? isMeetingSchedule(item)
                : isWorksheetSchedule(item);
            if (!matchesType) return false;

            return checkIsAccessible(item);
        });
    }, [schedules, isMeeting, isSuperUser, userIdentifiers, userLevel, userDivision, members, roles]);

    // Filtered schedules based on search, member filter, and recurrence filter
    const filteredSchedules = useMemo(() => {
        return typeSchedules.filter(item => {
            const rec = parseScheduleRecurrence(item);

            // Filter recurrence type
            if (selectedRecurrenceFilter !== 'all') {
                if (selectedRecurrenceFilter === 'weekly' && rec.type !== 'weekly') return false;
                if (selectedRecurrenceFilter === 'monthly' && rec.type !== 'monthly') return false;
                if (selectedRecurrenceFilter === 'once' && rec.type !== 'once') return false;
                if (selectedRecurrenceFilter === 'daily' && rec.type !== 'daily') return false;
            }

            // Filter by member
            if (!isMeeting) {
                const pic = item.picId || item.pic_id || item.author_id || item.authorId || item.userId;
                if (!pic) return false;
                const picStr = String(pic).trim();

                if (isViewingSelf) {
                    const matchSelf = userIdentifiers.ids.has(picStr) || 
                                      userIdentifiers.emails.has(picStr.toLowerCase()) || 
                                      userIdentifiers.names.has(picStr.toLowerCase());
                    if (!matchSelf) return false;
                } else {
                    if (picStr === selectedMemberFilter) {
                        // direct match
                    } else if (selectedMemberObj) {
                        const matchEmail = selectedMemberObj.email && picStr.toLowerCase() === selectedMemberObj.email.toLowerCase();
                        const matchName = selectedMemberObj.name && picStr.toLowerCase() === selectedMemberObj.name.toLowerCase();
                        if (!matchEmail && !matchName) return false;
                    } else {
                        return false;
                    }
                }
            } else {
                if (selectedMemberFilter !== 'all') {
                    const isPic = item.picId === selectedMemberFilter;
                    const isAttendee = Array.isArray(item.attendees) && item.attendees.includes(selectedMemberFilter);
                    if (!isPic && !isAttendee) return false;
                }
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchTitle = item.title?.toLowerCase().includes(q);
                const matchLoc = item.location?.toLowerCase().includes(q);
                const matchNotes = item.notes?.toLowerCase().includes(q);
                const picMember = members.find(m => m.id === item.picId);
                const matchPic = picMember?.name?.toLowerCase().includes(q);
                const matchAttendees = Array.isArray(item.attendees) && item.attendees.some(attId => {
                    const m = members.find(mem => mem.id === attId);
                    return m?.name?.toLowerCase().includes(q);
                });

                if (!matchTitle && !matchLoc && !matchNotes && !matchPic && !matchAttendees) return false;
            }

            return true;
        });
    }, [typeSchedules, selectedRecurrenceFilter, selectedMemberFilter, searchQuery, members, isMeeting, isViewingSelf, selectedMemberObj, userIdentifiers]);

    // Navigation functions (prev, next, today)
    const handleNavigateToday = () => {
        setCurrentDate(new Date());
    };

    const handleNavigatePrev = () => {
        const next = new Date(currentDate);
        if (viewMode === 'day') {
            next.setDate(currentDate.getDate() - 1);
        } else if (viewMode === 'week') {
            next.setDate(currentDate.getDate() - 7);
        } else if (viewMode === 'month') {
            next.setMonth(currentDate.getMonth() - 1);
        } else {
            next.setDate(currentDate.getDate() - 7);
        }
        setCurrentDate(next);
    };

    const handleNavigateNext = () => {
        const next = new Date(currentDate);
        if (viewMode === 'day') {
            next.setDate(currentDate.getDate() + 1);
        } else if (viewMode === 'week') {
            next.setDate(currentDate.getDate() + 7);
        } else if (viewMode === 'month') {
            next.setMonth(currentDate.getMonth() + 1);
        } else {
            next.setDate(currentDate.getDate() + 7);
        }
        setCurrentDate(next);
    };

    // Calculate Week Days for Weekly View (Gambar 2: SEN 28, SEL 29, ..., SAB 3, MIN 4)
    const currentWeekDays = useMemo(() => {
        return getWeekDays(currentDate);
    }, [currentDate]);

    // Calculate Month Grid for Monthly View
    const currentMonthGrid = useMemo(() => {
        return getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
    }, [currentDate]);

    // Formatted header period title (e.g. "Oktober 2026", "28 Sep - 4 Okt 2026", "Sabtu, 3 Oktober 2026")
    const formattedPeriodTitle = useMemo(() => {
        if (viewMode === 'day') {
            const dayName = getDayNameID(currentDate);
            const dateNum = currentDate.getDate();
            const monthName = MONTHS_ID[currentDate.getMonth()];
            const yearNum = currentDate.getFullYear();
            return `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
        }
        if (viewMode === 'week') {
            const first = currentWeekDays[0].date;
            const last = currentWeekDays[6].date;
            const m1 = MONTHS_SHORT_ID[first.getMonth()];
            const m2 = MONTHS_SHORT_ID[last.getMonth()];
            const y1 = first.getFullYear();
            const y2 = last.getFullYear();

            if (m1 === m2 && y1 === y2) {
                return `${first.getDate()} - ${last.getDate()} ${MONTHS_ID[first.getMonth()]} ${y1}`;
            }
            if (y1 === y2) {
                return `${first.getDate()} ${m1} - ${last.getDate()} ${m2} ${y1}`;
            }
            return `${first.getDate()} ${m1} ${y1} - ${last.getDate()} ${m2} ${y2}`;
        }
        if (viewMode === 'month') {
            return `${MONTHS_ID[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        return `${MONTHS_ID[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }, [viewMode, currentDate, currentWeekDays]);

    // Height of one 30-minute slot in pixels
    const SLOT_HEIGHT_PX = slotDensity === 'compact' ? 46 : (slotDensity === 'spacious' ? 68 : 56);
    const GRID_START_MINUTES = 7 * 60; // 07:00 = 420 minutes
    const GRID_END_MINUTES = 23 * 60 + 30; // 23:30 = 1410 minutes
    const TOTAL_GRID_HEIGHT = TIME_SLOTS.length * SLOT_HEIGHT_PX;

    // Calculate current live red line position
    const currentLiveMinutes = currentLiveTime.getHours() * 60 + currentLiveTime.getMinutes();
    const isCurrentTimeInGrid = currentLiveMinutes >= GRID_START_MINUTES && currentLiveMinutes <= GRID_END_MINUTES;
    const currentLiveTopPx = isCurrentTimeInGrid
        ? ((currentLiveMinutes - GRID_START_MINUTES) / 30) * SLOT_HEIGHT_PX
        : -1;

    // Auto-scroll to current hour when grid opens
    useEffect(() => {
        if (!hasAutoScrolledRef.current && gridContainerRef.current && (viewMode === 'week' || viewMode === 'day')) {
            const scrollTarget = isCurrentTimeInGrid ? Math.max(0, currentLiveTopPx - 140) : 100;
            gridContainerRef.current.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            hasAutoScrolledRef.current = true;
        }
    }, [viewMode, isCurrentTimeInGrid, currentLiveTopPx]);

    // Open create modal with prefilled date/day & startTime
    const handleOpenCreateModal = (targetDateOrDay = new Date(), startTime = '09:00') => {
        let chosenDate = new Date();
        let chosenDay = 'Senin';

        if (targetDateOrDay instanceof Date) {
            chosenDate = targetDateOrDay;
            chosenDay = getDayNameID(chosenDate);
        } else if (typeof targetDateOrDay === 'string') {
            if (targetDateOrDay.includes('-')) {
                chosenDate = parseDateYMD(targetDateOrDay);
                chosenDay = getDayNameID(chosenDate);
            } else if (DAYS_OF_WEEK.includes(targetDateOrDay)) {
                chosenDay = targetDateOrDay;
                // find date in current week matching this day
                const matchedInWeek = currentWeekDays.find(d => d.dayName === chosenDay);
                if (matchedInWeek) chosenDate = matchedInWeek.date;
            }
        }

        const startM = timeToMinutes(startTime);
        const endM = Math.min(startM + 60, 23 * 60 + 30);
        const endTime = minutesToTime(endM);

        let defaultPic = session?.memberId || '';
        if (!isMeeting) {
            if (userLevel <= 1 || isViewingSelf) {
                defaultPic = myMemberId || session?.memberId || '';
            } else if (selectedMemberFilter && selectedMemberFilter !== 'all' && selectedMemberFilter !== 'me') {
                defaultPic = selectedMemberFilter;
            } else {
                defaultPic = myMemberId || session?.memberId || '';
            }
        } else if (currentUserMember?.id) {
            defaultPic = currentUserMember.id;
        }

        setFormData({
            title: '',
            recurrenceType: 'weekly', // Default weekly as requested: "di jadwal meeting misa di klik mingguan setiap hari XXX, bulanan Setiap apa"
            specificDate: formatDateYMD(chosenDate),
            weeklyDays: [chosenDay],
            monthlyType: 'date',
            monthlyDate: chosenDate.getDate(),
            monthlyWeekNumber: Math.ceil(chosenDate.getDate() / 7),
            monthlyDayOfWeek: chosenDay,
            dailyType: 'all',
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
        const rec = parseScheduleRecurrence(item);
        const existingAttendees = Array.isArray(item.attendees) ? item.attendees : [];
        const finalAttendees = (item.picId && !existingAttendees.includes(item.picId))
            ? [item.picId, ...existingAttendees]
            : existingAttendees;

        const itemDate = rec.date ? parseDateYMD(rec.date) : new Date();

        setFormData({
            title: item.title || '',
            recurrenceType: rec.type || 'weekly',
            specificDate: rec.date || formatDateYMD(new Date()),
            weeklyDays: Array.isArray(rec.days) && rec.days.length > 0 ? rec.days : [item.day || 'Senin'],
            monthlyType: rec.monthlyType || 'date',
            monthlyDate: Number(rec.dayOfMonth) || itemDate.getDate(),
            monthlyWeekNumber: rec.weekNumber || Math.ceil(itemDate.getDate() / 7),
            monthlyDayOfWeek: rec.dayOfWeek || item.day || 'Senin',
            dailyType: rec.weekdaysOnly ? 'weekdays' : 'all',
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
            alert('Judul kegiatan / rapat harus diisi');
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

        // Build clean recurrence object and primary day string
        let recurrenceObj = { type: formData.recurrenceType };
        let primaryDay = formData.weeklyDays[0] || 'Senin';

        if (formData.recurrenceType === 'once') {
            const parsed = parseDateYMD(formData.specificDate);
            primaryDay = getDayNameID(parsed);
            recurrenceObj = {
                type: 'once',
                date: formData.specificDate,
                days: [primaryDay]
            };
        } else if (formData.recurrenceType === 'weekly') {
            const chosenDays = formData.weeklyDays.length > 0 ? formData.weeklyDays : ['Senin'];
            primaryDay = chosenDays[0];
            recurrenceObj = {
                type: 'weekly',
                days: chosenDays
            };
        } else if (formData.recurrenceType === 'monthly') {
            if (formData.monthlyType === 'day_of_week') {
                primaryDay = formData.monthlyDayOfWeek;
                recurrenceObj = {
                    type: 'monthly',
                    monthlyType: 'day_of_week',
                    dayOfWeek: formData.monthlyDayOfWeek,
                    weekNumber: formData.monthlyWeekNumber
                };
            } else {
                recurrenceObj = {
                    type: 'monthly',
                    monthlyType: 'date',
                    dayOfMonth: Number(formData.monthlyDate)
                };
            }
        } else if (formData.recurrenceType === 'daily') {
            recurrenceObj = {
                type: 'daily',
                weekdaysOnly: formData.dailyType === 'weekdays'
            };
            primaryDay = todayDayName;
        }

        const payload = {
            id: modalMode === 'edit' && editingItem ? editingItem.id : crypto.randomUUID(),
            type: isMeeting ? 'schedule_meeting' : 'schedule_worksheet',
            title: formData.title.trim(),
            day: primaryDay,
            startTime: formData.startTime,
            endTime: formData.endTime,
            picId: (!isMeeting && userLevel <= 1) ? (currentUserMember?.id || session?.memberId || null) : (formData.picId || null),
            attendees: Array.isArray(formData.attendees) ? formData.attendees : [],
            location: formData.location.trim() || null,
            notes: formData.notes.trim() || null,
            recurrence: recurrenceObj,
            date: formData.recurrenceType === 'once' ? formData.specificDate : null,
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

    // Preset color metadata helper
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

    // Statistics
    const stats = useMemo(() => {
        const total = filteredSchedules.length;
        const todayCount = filteredSchedules.filter(s => isScheduleActiveOnDate(s, new Date())).length;
        const totalMinutes = filteredSchedules.reduce((acc, s) => {
            const start = timeToMinutes(s.startTime || '09:00');
            const end = timeToMinutes(s.endTime || '10:00');
            return acc + (end > start ? end - start : 0);
        }, 0);
        const totalHours = (totalMinutes / 60).toFixed(1);
        return { total, todayCount, totalHours };
    }, [filteredSchedules]);

    return (
        <div className="w-full space-y-4 animate-fade-in font-sans">
            {/* Top Bar: Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                {/* Title & Navigation */}
                <div className="flex flex-wrap items-center gap-3.5">
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base font-bold shadow-xs ${
                        isMeeting ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-sky-600 text-white shadow-sky-600/20'
                    }`}>
                        <i className={`fa-solid ${isMeeting ? 'fa-calendar-days' : 'fa-table-cells'}`}></i>
                    </span>

                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                                {pageTitle}
                            </h2>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                {localTimezone}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{pageSubtitle}</p>
                    </div>

                    {/* Date Navigation Controls (Hari Ini, <, >, Period Label) */}
                    <div className="flex items-center gap-1.5 ml-0 sm:ml-4 bg-slate-50 p-1 rounded-2xl border border-slate-200">
                        <button
                            type="button"
                            onClick={handleNavigateToday}
                            className="px-3 py-1 rounded-xl text-xs font-bold text-slate-700 hover:bg-white hover:shadow-xs transition"
                            title="Kembali ke Hari Ini"
                        >
                            Hari Ini
                        </button>
                        <button
                            type="button"
                            onClick={handleNavigatePrev}
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition"
                            title="Sebelumnya"
                        >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <button
                            type="button"
                            onClick={handleNavigateNext}
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition"
                            title="Berikutnya"
                        >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                        <div className="px-2.5 py-1 text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap">
                            {formattedPeriodTitle}
                        </div>
                    </div>
                </div>

                {/* Right controls: View modes & Add Schedule button */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* View mode switcher: Harian (Day) | Mingguan (Week) | Bulanan (Month) | Daftar (List) */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/70 text-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('day')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
                                viewMode === 'day' 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Tampilan Harian (Daily View detail jam)"
                        >
                            <i className="fa-solid fa-calendar-day text-xs"></i>
                            <span>Harian</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('week')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
                                viewMode === 'week' 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Tampilan Mingguan (Week Grid seperti Google Calendar)"
                        >
                            <i className="fa-solid fa-calendar-week text-xs"></i>
                            <span>Mingguan</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('month')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
                                viewMode === 'month' 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Tampilan Kalender Bulanan"
                        >
                            <i className="fa-solid fa-calendar text-xs"></i>
                            <span>Bulanan</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition ${
                                viewMode === 'list' 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Daftar Agenda Rapat"
                        >
                            <i className="fa-solid fa-list-ul text-xs"></i>
                            <span>Daftar</span>
                        </button>
                    </div>

                    {/* Density Toggle (for week and day grid views) */}
                    {(viewMode === 'week' || viewMode === 'day') && (
                        <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/70 text-xs">
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
                                title="Standar (56px)"
                            >
                                Standar
                            </button>
                        </div>
                    )}

                    {/* Add Schedule Button */}
                    <button
                        type="button"
                        onClick={() => handleOpenCreateModal(currentDate, '09:00')}
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

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/70 backdrop-blur p-3 rounded-2xl border border-slate-200/70 text-xs">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                    {/* Search box */}
                    <div className="relative flex-1 min-w-[180px] max-w-sm">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Cari judul rapat, lokasi, atau peserta..."
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

                    {/* Filter Pengulangan Jadwal (Semua / Mingguan / Bulanan / Sekali Saja / Harian) */}
                    <select
                        value={selectedRecurrenceFilter}
                        onChange={(e) => setSelectedRecurrenceFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-medium"
                    >
                        <option value="all">Semua Tipe Pengulangan</option>
                        <option value="weekly">🔁 Mingguan (Setiap Hari XXX)</option>
                        <option value="monthly">📅 Bulanan (Setiap Tanggal/Pola)</option>
                        <option value="once">📌 Sekali Saja (Tanggal Tertentu)</option>
                        <option value="daily">☀️ Harian (Setiap Hari)</option>
                    </select>

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
                        userLevel <= 1 ? (
                            <div 
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs select-none"
                                title="Sebagai Staff, Anda hanya dapat mengakses dan melihat worksheet milik Anda sendiri"
                            >
                                <i className="fa-solid fa-user-lock text-slate-400 text-[11px]"></i>
                                <span>Worksheet Saya ({currentUserMember?.name || session?.name || 'Staff'})</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <label className="text-[11px] font-semibold text-slate-500 hidden sm:inline-flex items-center gap-1">
                                    <i className="fa-solid fa-calendar-check text-sky-500"></i>
                                    Worksheet:
                                </label>
                                <select
                                    value={isViewingSelf ? (myMemberId || 'me') : selectedMemberFilter}
                                    onChange={(e) => setSelectedMemberFilter(e.target.value)}
                                    className="bg-white border border-sky-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer shadow-xs hover:border-sky-300 transition-all"
                                >
                                    <option value={myMemberId || 'me'}>
                                        👤 Worksheet Saya ({currentUserMember?.name || session?.name || 'Saya'})
                                    </option>
                                    {subordinateMembers.length > 0 && (
                                        <optgroup label="Worksheet Tim">
                                            {subordinateMembers.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    📋 {m.name} ({m.position || m.role || 'Staff'})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        )
                    )}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>Total: <strong className="text-slate-800">{filteredSchedules.length}</strong> agenda</span>
                    <span className="text-slate-300">•</span>
                    <span>Hari ini: <strong className="text-indigo-600">{stats.todayCount}</strong></span>
                </div>
            </div>

            {/* MAIN CALENDAR DISPLAY: WEEK VIEW (Gambar 2), DAY VIEW, MONTH VIEW, OR LIST VIEW */}
            {viewMode === 'week' && (
                /* GOOGLE CALENDAR WEEKLY VIEW (7 Kolom Tanggal: SEN 28, SEL 29, ..., SAB 3, MIN 4) */
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden flex flex-col">
                    {/* Header bar notes */}
                    <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-circle-info text-indigo-500"></i>
                            <span>Klik pada slot jam manapun untuk langsung menjadwalkan rapat pada hari & jam tersebut.</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Hari Ini ({todayDayName})
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Waktu Sekarang
                            </span>
                        </div>
                    </div>

                    {/* Scrollable calendar table container */}
                    <div ref={gridContainerRef} className="overflow-x-auto overflow-y-auto max-h-[75vh] custom-scrollbar relative">
                        <div className="min-w-[980px] select-none">
                            {/* Sticky Day Column Headers (SEN 28, SEL 29, ..., SAB 3 as in Gambar 2) */}
                            <div className="sticky top-0 z-30 flex bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
                                {/* Timezone Header Box */}
                                <div className="w-20 shrink-0 p-3 text-center border-r border-slate-200 bg-slate-50/90 flex flex-col items-center justify-center">
                                    <span className="text-[11px] font-bold text-slate-500 tracking-wider">
                                        {localTimezone}
                                    </span>
                                </div>

                                {/* 7 Day Column Headers */}
                                {currentWeekDays.map((colDay) => {
                                    const daySchedules = filteredSchedules.filter(item => isScheduleActiveOnDate(item, colDay.date));
                                    const isToday = colDay.isToday;

                                    return (
                                        <div
                                            key={colDay.dateStr}
                                            onClick={() => {
                                                setCurrentDate(colDay.date);
                                                setViewMode('day');
                                            }}
                                            className={`flex-1 min-w-[130px] p-2.5 text-center border-r border-slate-200 last:border-r-0 transition-colors cursor-pointer group hover:bg-slate-50 ${
                                                isToday ? 'bg-indigo-50/40' : 'bg-white'
                                            }`}
                                            title={`Klik untuk melihat tampilan harian ${colDay.dayName} (${colDay.dayNumber})`}
                                        >
                                            {/* Abbreviated Day Name (SEN, SEL, RAB... as in Gambar 2) */}
                                            <div className={`text-[11px] font-bold tracking-wider uppercase ${
                                                isToday ? 'text-indigo-600' : 'text-slate-500'
                                            }`}>
                                                {colDay.dayShort}
                                            </div>

                                            {/* Date Number (Large font, circular badge for today as in Gambar 2) */}
                                            <div className="flex items-center justify-center mt-1">
                                                {isToday ? (
                                                    <span className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-600/30">
                                                        {colDay.dayNumber}
                                                    </span>
                                                ) : (
                                                    <span className="w-10 h-10 rounded-full text-slate-700 font-bold text-xl flex items-center justify-center group-hover:bg-slate-100 transition">
                                                        {colDay.dayNumber}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Agenda count */}
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {daySchedules.length} agenda
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Body Rows with Time Column and 7 Day Columns */}
                            <div className="relative flex" style={{ height: `${TOTAL_GRID_HEIGHT}px` }}>
                                {/* Left Time Column */}
                                <div className="w-20 shrink-0 border-r border-slate-200 bg-slate-50/60 z-20 select-none">
                                    {TIME_SLOTS.map((slot) => {
                                        const isOclock = slot.endsWith(':00');
                                        return (
                                            <div
                                                key={slot}
                                                style={{ height: `${SLOT_HEIGHT_PX}px` }}
                                                className={`flex items-start justify-end pr-2 pt-1 border-b border-slate-100 ${
                                                    isOclock ? 'font-bold text-slate-700 text-xs border-b-slate-200' : 'text-slate-400 text-[10px]'
                                                }`}
                                            >
                                                <span>{slot}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 7 Day Columns */}
                                {currentWeekDays.map((colDay) => {
                                    const isToday = colDay.isToday;
                                    const daySchedules = filteredSchedules.filter(item => isScheduleActiveOnDate(item, colDay.date));

                                    return (
                                        <div
                                            key={colDay.dateStr}
                                            className={`flex-1 min-w-[130px] border-r border-slate-200 last:border-r-0 relative group/col ${
                                                isToday ? 'bg-indigo-50/10' : 'bg-white'
                                            }`}
                                        >
                                            {/* Interactive Slot Grid Cells (Click to add meeting) */}
                                            {TIME_SLOTS.map((slot) => {
                                                const isOclock = slot.endsWith(':00');
                                                return (
                                                    <div
                                                        key={slot}
                                                        style={{ height: `${SLOT_HEIGHT_PX}px` }}
                                                        onClick={() => handleOpenCreateModal(colDay.date, slot)}
                                                        className={`border-b group/cell relative cursor-pointer transition-colors ${
                                                            isOclock ? 'border-b-slate-200/80 hover:bg-indigo-50/30' : 'border-b-slate-100 hover:bg-slate-50'
                                                        }`}
                                                        title={`Klik untuk tambah jadwal pada ${colDay.dayName}, ${colDay.dayNumber} ${MONTHS_SHORT_ID[colDay.date.getMonth()]} pukul ${slot}`}
                                                    >
                                                        {/* Hover Quick Add Indicator */}
                                                        <div className="opacity-0 group-hover/cell:opacity-100 absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity">
                                                            <span className="bg-indigo-600 text-white rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-xs flex items-center gap-1">
                                                                <i className="fa-solid fa-plus text-[9px]"></i> {slot}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Google Calendar Current Time Red Line Indicator (Only for Today) */}
                                            {isToday && isCurrentTimeInGrid && (
                                                <div 
                                                    style={{ top: `${currentLiveTopPx}px` }}
                                                    className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                                                >
                                                    {/* Red Circle Dot on left border as in Gambar 2 */}
                                                    <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm -ml-1.5 shrink-0 animate-pulse"></div>
                                                    {/* Red horizontal line extending across the column */}
                                                    <div className="flex-1 h-[2px] bg-rose-500 shadow-xs"></div>
                                                </div>
                                            )}

                                            {/* Event Cards Positioned on Top of Grid */}
                                            {daySchedules.map((item) => {
                                                const startM = timeToMinutes(item.startTime || '09:00');
                                                const endM = timeToMinutes(item.endTime || '10:00');
                                                
                                                const clampedStart = Math.max(startM, GRID_START_MINUTES);
                                                const clampedEnd = Math.min(Math.max(endM, clampedStart + 30), GRID_END_MINUTES);
                                                
                                                const offsetMinutes = clampedStart - GRID_START_MINUTES;
                                                const durationMinutes = clampedEnd - clampedStart;
                                                
                                                const topPx = (offsetMinutes / 30) * SLOT_HEIGHT_PX;
                                                const heightPx = Math.max((durationMinutes / 30) * SLOT_HEIGHT_PX - 3, 38);

                                                const colorMeta = getColorMeta(item.color);
                                                const rec = parseScheduleRecurrence(item);
                                                const recLabel = formatRecurrenceLabel(item);
                                                const picMember = members.find(m => m.id === item.picId);
                                                const attendeesList = Array.isArray(item.attendees) ? item.attendees : [];
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
                                                        className={`absolute z-10 rounded-xl border p-2 shadow-xs hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer overflow-hidden flex flex-col justify-between group/card ${colorMeta.bg} ${colorMeta.border}`}
                                                    >
                                                        {/* Left accent color bar */}
                                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorMeta.bar}`}></div>

                                                        <div className="pl-1.5 overflow-hidden">
                                                            <div className="flex items-start justify-between gap-1">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white/90 shadow-2xs ${colorMeta.text} shrink-0`}>
                                                                    {item.startTime} - {item.endTime}
                                                                </span>

                                                                {/* Recurrence icon badge */}
                                                                <span 
                                                                    className="text-[9px] font-semibold text-slate-500 bg-white/70 px-1 rounded truncate max-w-[80px]" 
                                                                    title={recLabel}
                                                                >
                                                                    {rec.type === 'weekly' && '🔁 Mingguan'}
                                                                    {rec.type === 'monthly' && '📅 Bulanan'}
                                                                    {rec.type === 'once' && '📌 1x'}
                                                                    {rec.type === 'daily' && '☀️ Tiap hari'}
                                                                </span>
                                                            </div>

                                                            <div className="font-bold text-xs text-slate-900 truncate mt-1 group-hover/card:text-indigo-600 transition-colors" title={item.title}>
                                                                {item.title}
                                                            </div>

                                                            {item.location && heightPx > 55 && (
                                                                <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5" title={item.location}>
                                                                    <i className="fa-solid fa-location-dot text-[9px] text-slate-400"></i>
                                                                    <span>{item.location}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Card Footer: PIC & Attendees (if height allows) */}
                                                        {heightPx > 70 && (
                                                            <div className="pl-1.5 pt-1 border-t border-black/5 flex items-center justify-between text-[10px] text-slate-500">
                                                                <div className="flex items-center gap-1 truncate">
                                                                    {picMember ? (
                                                                        <>
                                                                            <span
                                                                                className="w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center shrink-0"
                                                                                style={{ backgroundColor: picMember.color || '#6366f1' }}
                                                                                title={`PIC: ${picMember.name}`}
                                                                            >
                                                                                {picMember.name?.[0]?.toUpperCase()}
                                                                            </span>
                                                                            <span className="truncate max-w-[70px] font-medium">{picMember.name}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="italic text-slate-400">Tanpa PIC</span>
                                                                    )}
                                                                </div>

                                                                {attendeesList.length > 0 && (
                                                                    <span className="text-[9px] font-semibold text-slate-500 flex items-center gap-0.5">
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
            )}

            {/* DAILY VIEW (Tampilan Harian dengan Detail Jam Per Jam) */}
            {viewMode === 'day' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden flex flex-col">
                    {/* Day Banner Header */}
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
                                {currentDate.getDate()}
                            </span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-slate-900">
                                        {getDayNameID(currentDate)}, {currentDate.getDate()} {MONTHS_ID[currentDate.getMonth()]} {currentDate.getFullYear()}
                                    </h3>
                                    {isTodayDate(currentDate) && (
                                        <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold shadow-2xs">
                                            Hari Ini
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {filteredSchedules.filter(item => isScheduleActiveOnDate(item, currentDate)).length} agenda rapat dijadwalkan pada hari ini
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleOpenCreateModal(currentDate, '09:00')}
                                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <i className="fa-solid fa-plus text-xs"></i>
                                <span>Tambah Rapat Hari Ini</span>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Day Timeline */}
                    <div ref={gridContainerRef} className="overflow-y-auto max-h-[75vh] custom-scrollbar relative">
                        <div className="relative flex min-w-[600px]" style={{ height: `${TOTAL_GRID_HEIGHT}px` }}>
                            {/* Left Time Axis */}
                            <div className="w-24 shrink-0 border-r border-slate-200 bg-slate-50/60 z-20 select-none">
                                {TIME_SLOTS.map((slot) => {
                                    const isOclock = slot.endsWith(':00');
                                    return (
                                        <div
                                            key={slot}
                                            style={{ height: `${SLOT_HEIGHT_PX}px` }}
                                            className={`flex items-start justify-end pr-3 pt-1 border-b border-slate-100 ${
                                                isOclock ? 'font-bold text-slate-700 text-xs border-b-slate-200' : 'text-slate-400 text-[10px]'
                                            }`}
                                        >
                                            <span>{slot}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Main Day Column with Full-Width Event Rows */}
                            <div className="flex-1 relative bg-white">
                                {/* Interactive Slot Lines */}
                                {TIME_SLOTS.map((slot) => {
                                    const isOclock = slot.endsWith(':00');
                                    return (
                                        <div
                                            key={slot}
                                            style={{ height: `${SLOT_HEIGHT_PX}px` }}
                                            onClick={() => handleOpenCreateModal(currentDate, slot)}
                                            className={`border-b group/cell relative cursor-pointer transition-colors ${
                                                isOclock ? 'border-b-slate-200 hover:bg-indigo-50/30' : 'border-b-slate-100 hover:bg-slate-50'
                                            }`}
                                            title={`Klik untuk tambah jadwal pada ${slot}`}
                                        >
                                            <div className="opacity-0 group-hover/cell:opacity-100 absolute inset-0 flex items-center justify-start pl-4 pointer-events-none transition-opacity">
                                                <span className="bg-indigo-600 text-white rounded-lg px-2.5 py-1 text-xs font-bold shadow-xs flex items-center gap-1.5">
                                                    <i className="fa-solid fa-plus text-[10px]"></i> Tambah Rapat Pukul {slot}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Current Time Indicator Line (If viewing Today) */}
                                {isTodayDate(currentDate) && isCurrentTimeInGrid && (
                                    <div 
                                        style={{ top: `${currentLiveTopPx}px` }}
                                        className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                                    >
                                        <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm -ml-1.5 shrink-0 animate-pulse"></div>
                                        <div className="flex-1 h-[2px] bg-rose-500 shadow-xs"></div>
                                        <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full mr-3 shadow-2xs">
                                            {minutesToTime(currentLiveMinutes)}
                                        </span>
                                    </div>
                                )}

                                {/* Day Event Cards */}
                                {filteredSchedules
                                    .filter(item => isScheduleActiveOnDate(item, currentDate))
                                    .map(item => {
                                        const startM = timeToMinutes(item.startTime || '09:00');
                                        const endM = timeToMinutes(item.endTime || '10:00');
                                        
                                        const clampedStart = Math.max(startM, GRID_START_MINUTES);
                                        const clampedEnd = Math.min(Math.max(endM, clampedStart + 30), GRID_END_MINUTES);
                                        
                                        const offsetMinutes = clampedStart - GRID_START_MINUTES;
                                        const durationMinutes = clampedEnd - clampedStart;
                                        
                                        const topPx = (offsetMinutes / 30) * SLOT_HEIGHT_PX;
                                        const heightPx = Math.max((durationMinutes / 30) * SLOT_HEIGHT_PX - 4, 46);

                                        const colorMeta = getColorMeta(item.color);
                                        const recLabel = formatRecurrenceLabel(item);
                                        const picMember = members.find(m => m.id === item.picId);
                                        const attendeesList = Array.isArray(item.attendees) ? item.attendees : [];
                                        const attendeeMembers = attendeesList
                                            .map(id => members.find(m => m.id === id))
                                            .filter(Boolean);

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
                                                    left: '12px',
                                                    right: '12px'
                                                }}
                                                className={`absolute z-10 rounded-2xl border p-3 shadow-xs hover:shadow-lg transition-all cursor-pointer overflow-hidden flex flex-col justify-between group/card ${colorMeta.bg} ${colorMeta.border}`}
                                            >
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colorMeta.bar}`}></div>

                                                <div className="pl-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg bg-white shadow-2xs ${colorMeta.text}`}>
                                                                {item.startTime} - {item.endTime}
                                                            </span>
                                                            <span className="text-[11px] font-semibold text-slate-600 bg-white/80 px-2 py-0.5 rounded-lg border border-black/5">
                                                                {recLabel}
                                                            </span>
                                                        </div>

                                                        <div className="opacity-0 group-hover/card:opacity-100 flex items-center gap-1 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenEditModal(item);
                                                                }}
                                                                className="px-2 py-1 rounded-lg bg-white text-slate-700 hover:text-indigo-600 text-xs font-semibold shadow-xs"
                                                            >
                                                                Ubah
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <h4 className="font-bold text-sm sm:text-base text-slate-900 mt-1.5 group-hover/card:text-indigo-600 transition-colors">
                                                        {item.title}
                                                    </h4>

                                                    {/* Location / Meeting link */}
                                                    {item.location && (
                                                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                                                            <i className="fa-solid fa-location-dot text-indigo-500"></i>
                                                            {item.location.startsWith('http') ? (
                                                                <a 
                                                                    href={item.location} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="text-indigo-600 hover:underline font-semibold"
                                                                >
                                                                    {item.location}
                                                                </a>
                                                            ) : (
                                                                <span>{item.location}</span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Notes */}
                                                    {item.notes && heightPx > 90 && (
                                                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 bg-white/50 p-1.5 rounded-xl border border-black/5">
                                                            {item.notes}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Attendees and PIC footer */}
                                                <div className="pl-2 pt-2 mt-2 border-t border-black/5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        {picMember && (
                                                            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl shadow-2xs">
                                                                <span
                                                                    className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                                                                    style={{ backgroundColor: picMember.color || '#6366f1' }}
                                                                >
                                                                    {picMember.name?.[0]?.toUpperCase()}
                                                                </span>
                                                                <span className="font-semibold text-slate-800 text-[11px]">{picMember.name} (PIC)</span>
                                                            </div>
                                                        )}

                                                        {attendeeMembers.length > 0 && (
                                                            <div className="flex items-center -space-x-1.5 overflow-hidden">
                                                                {attendeeMembers.slice(0, 5).map(m => (
                                                                    <span
                                                                        key={m.id}
                                                                        className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs"
                                                                        style={{ backgroundColor: m.color || '#6366f1' }}
                                                                        title={m.name}
                                                                    >
                                                                        {m.name?.[0]?.toUpperCase()}
                                                                    </span>
                                                                ))}
                                                                {attendeeMembers.length > 5 && (
                                                                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                                                                        +{attendeeMembers.length - 5}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <span className="text-[11px] text-slate-400 font-medium">
                                                        Durasi: {Math.round(durationMinutes / 60 * 10) / 10} jam
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MONTHLY VIEW (Tampilan Kalender Bulanan) */}
            {viewMode === 'month' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden flex flex-col">
                    {/* Month Day Headers (SEN s/d MIN) */}
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center font-bold text-xs text-slate-600">
                        {DAYS_OF_WEEK_SHORT.map((dayName, idx) => (
                            <div key={dayName} className="p-3 border-r border-slate-200 last:border-r-0">
                                <span>{DAYS_OF_WEEK[idx]}</span>
                            </div>
                        ))}
                    </div>

                    {/* Month Days Grid */}
                    <div className="grid grid-cols-7 border-collapse">
                        {currentMonthGrid.map((cell) => {
                            const cellSchedules = filteredSchedules.filter(item => isScheduleActiveOnDate(item, cell.date));
                            const isToday = cell.isToday;

                            return (
                                <div
                                    key={cell.dateStr}
                                    onClick={() => {
                                        setCurrentDate(cell.date);
                                        setViewMode('day');
                                    }}
                                    className={`min-h-[110px] p-2 border-r border-b border-slate-200/80 transition-colors cursor-pointer group flex flex-col justify-between ${
                                        cell.isCurrentMonth ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-50/40 text-slate-400'
                                    } ${isToday ? 'bg-indigo-50/30' : ''}`}
                                >
                                    {/* Top Day Number Row */}
                                    <div className="flex items-center justify-between mb-1.5">
                                        {isToday ? (
                                            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                                {cell.dayNumber}
                                            </span>
                                        ) : (
                                            <span className={`text-xs font-bold ${cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                                                {cell.dayNumber}
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenCreateModal(cell.date, '09:00');
                                            }}
                                            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 inline-flex items-center justify-center text-[10px] transition"
                                            title="Tambah rapat pada tanggal ini"
                                        >
                                            <i className="fa-solid fa-plus"></i>
                                        </button>
                                    </div>

                                    {/* Scheduled Meetings Pill List */}
                                    <div className="space-y-1 overflow-hidden flex-1">
                                        {cellSchedules.slice(0, 3).map(item => {
                                            const colorMeta = getColorMeta(item.color);
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenEditModal(item);
                                                    }}
                                                    className={`px-1.5 py-0.5 rounded-lg text-[10px] font-semibold truncate border shadow-2xs hover:scale-101 transition flex items-center gap-1 ${colorMeta.bg} ${colorMeta.border} ${colorMeta.text}`}
                                                    title={`${item.startTime} - ${item.title}`}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color || '#6366f1' }}></span>
                                                    <span className="font-bold shrink-0">{item.startTime}</span>
                                                    <span className="truncate">{item.title}</span>
                                                </div>
                                            );
                                        })}

                                        {cellSchedules.length > 3 && (
                                            <div className="text-[9px] font-bold text-indigo-600 hover:underline pl-1">
                                                +{cellSchedules.length - 3} lainnya
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* LIST / AGENDA VIEW */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                            <i className="fa-solid fa-list-check text-indigo-600"></i>
                            Daftar Agenda Rapat Terjadwal ({filteredSchedules.length})
                        </h3>
                    </div>

                    {filteredSchedules.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <i className="fa-regular fa-calendar-xmark text-4xl mb-2 text-slate-300"></i>
                            <p className="text-sm font-semibold text-slate-600">Tidak ada agenda rapat ditemukan</p>
                            <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau buat jadwal rapat baru.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {filteredSchedules.map(item => {
                                const colorMeta = getColorMeta(item.color);
                                const recLabel = formatRecurrenceLabel(item);
                                const picMember = members.find(m => m.id === item.picId);
                                const attendeesList = Array.isArray(item.attendees) ? item.attendees : [];

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleOpenEditModal(item)}
                                        className={`rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group ${colorMeta.bg} ${colorMeta.border}`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg bg-white shadow-2xs ${colorMeta.text}`}>
                                                    {item.startTime} - {item.endTime}
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-black/5">
                                                    {recLabel}
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {item.title}
                                            </h4>

                                            {item.location && (
                                                <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 truncate">
                                                    <i className="fa-solid fa-location-dot text-slate-400 text-[10px]"></i>
                                                    <span>{item.location}</span>
                                                </div>
                                            )}

                                            {item.notes && (
                                                <p className="text-xs text-slate-600 mt-2 line-clamp-2 bg-white/60 p-2 rounded-xl border border-black/5">
                                                    {item.notes}
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-3 mt-3 border-t border-black/5 flex items-center justify-between text-xs text-slate-600">
                                            <div className="flex items-center gap-1.5 truncate">
                                                {picMember ? (
                                                    <>
                                                        <span
                                                            className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center shrink-0"
                                                            style={{ backgroundColor: picMember.color || '#6366f1' }}
                                                        >
                                                            {picMember.name?.[0]?.toUpperCase()}
                                                        </span>
                                                        <span className="font-semibold text-slate-800 truncate text-[11px]">{picMember.name}</span>
                                                    </>
                                                ) : (
                                                    <span className="italic text-slate-400 text-[11px]">Tanpa PIC</span>
                                                )}
                                            </div>

                                            {attendeesList.length > 0 && (
                                                <span className="text-[10px] bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-semibold text-slate-600">
                                                    {attendeesList.length} Peserta
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: Tambah / Ubah Jadwal Meeting dengan Pengulangan Fleksibel (Mingguan, Bulanan, Sekali Saja) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        {(() => {
                            const isEditingItemOwner = modalMode === 'create' || !editingItem || checkCanManage(editingItem);
                            return (
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white ${
                                            isMeeting ? 'bg-indigo-600' : 'bg-sky-600'
                                        }`}>
                                            <i className={`fa-solid ${isMeeting ? 'fa-calendar-check' : 'fa-list-check'}`}></i>
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-base text-slate-900">
                                                {modalMode === 'create' ? `Tambah ${pageTitle}` : (isEditingItemOwner ? `Ubah ${pageTitle}` : `Rincian ${pageTitle}`)}
                                            </h3>
                                            <p className="text-[11px] text-slate-500">
                                                {isEditingItemOwner ? 'Atur jadwal, jam pertemuan, dan frekuensi pengulangan' : 'Mode Hanya Baca (Peserta)'}
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

                        {/* Modal Form */}
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

                            {/* PENGULANGAN JADWAL (RECURRENCE): Sekali Saja, Mingguan (Setiap hari XXX), Bulanan (Setiap apa), Harian */}
                            <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                                        <i className="fa-solid fa-rotate text-indigo-600"></i>
                                        <span>Pengulangan Jadwal (Frekuensi)</span>
                                    </label>

                                    {/* Recurrence Type Selector Pills */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, recurrenceType: 'weekly' })}
                                            className={`py-1.5 px-2 rounded-lg transition text-center ${
                                                formData.recurrenceType === 'weekly' 
                                                    ? 'bg-white text-indigo-700 shadow-xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Mingguan
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, recurrenceType: 'monthly' })}
                                            className={`py-1.5 px-2 rounded-lg transition text-center ${
                                                formData.recurrenceType === 'monthly' 
                                                    ? 'bg-white text-indigo-700 shadow-xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Bulanan
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, recurrenceType: 'once' })}
                                            className={`py-1.5 px-2 rounded-lg transition text-center ${
                                                formData.recurrenceType === 'once' 
                                                    ? 'bg-white text-indigo-700 shadow-xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Sekali Saja
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, recurrenceType: 'daily' })}
                                            className={`py-1.5 px-2 rounded-lg transition text-center ${
                                                formData.recurrenceType === 'daily' 
                                                    ? 'bg-white text-indigo-700 shadow-xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Harian
                                        </button>
                                    </div>
                                </div>

                                {/* Dynamic Sub-form based on Recurrence */}
                                {formData.recurrenceType === 'weekly' && (
                                    /* Mingguan: Setiap hari XXX */
                                    <div className="space-y-1.5 animate-fade-in">
                                        <label className="block text-[11px] font-semibold text-slate-600">
                                            Pilih Hari Pertemuan (Setiap Hari XXX):
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {DAYS_OF_WEEK.map(d => {
                                                const isChecked = formData.weeklyDays.includes(d);
                                                return (
                                                    <button
                                                        key={d}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData(prev => {
                                                                const exists = prev.weeklyDays.includes(d);
                                                                const nextDays = exists 
                                                                    ? prev.weeklyDays.filter(day => day !== d)
                                                                    : [...prev.weeklyDays, d];
                                                                return {
                                                                    ...prev,
                                                                    weeklyDays: nextDays.length > 0 ? nextDays : [d]
                                                                };
                                                            });
                                                        }}
                                                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                                                            isChecked 
                                                                ? 'bg-indigo-600 text-white shadow-xs' 
                                                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {d}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic mt-1">
                                            Rapat akan berulang setiap minggu pada: <strong>{formData.weeklyDays.join(', ')}</strong>
                                        </p>
                                    </div>
                                )}

                                {formData.recurrenceType === 'monthly' && (
                                    /* Bulanan: Setiap apa (Setiap tanggal X atau Setiap hari N ke-X) */
                                    <div className="space-y-2.5 animate-fade-in">
                                        <label className="block text-[11px] font-semibold text-slate-600">
                                            Pola Pengulangan Bulanan (Setiap Apa):
                                        </label>
                                        
                                        <div className="space-y-2">
                                            {/* Opsi 1: Setiap Tanggal X setiap bulan */}
                                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="monthlyType"
                                                    checked={formData.monthlyType === 'date'}
                                                    onChange={() => setFormData({ ...formData, monthlyType: 'date' })}
                                                    className="text-indigo-600 accent-indigo-600"
                                                />
                                                <span>Setiap tanggal</span>
                                                <select
                                                    disabled={formData.monthlyType !== 'date'}
                                                    value={formData.monthlyDate}
                                                    onChange={(e) => setFormData({ ...formData, monthlyDate: Number(e.target.value) })}
                                                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-800 disabled:opacity-50"
                                                >
                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(num => (
                                                        <option key={num} value={num}>{num}</option>
                                                    ))}
                                                </select>
                                                <span>setiap bulan</span>
                                            </label>

                                            {/* Opsi 2: Setiap [Hari] minggu ke-[N] setiap bulan */}
                                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer flex-wrap">
                                                <input
                                                    type="radio"
                                                    name="monthlyType"
                                                    checked={formData.monthlyType === 'day_of_week'}
                                                    onChange={() => setFormData({ ...formData, monthlyType: 'day_of_week' })}
                                                    className="text-indigo-600 accent-indigo-600"
                                                />
                                                <span>Setiap</span>
                                                <select
                                                    disabled={formData.monthlyType !== 'day_of_week'}
                                                    value={formData.monthlyDayOfWeek}
                                                    onChange={(e) => setFormData({ ...formData, monthlyDayOfWeek: e.target.value })}
                                                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-800 disabled:opacity-50"
                                                >
                                                    {DAYS_OF_WEEK.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    disabled={formData.monthlyType !== 'day_of_week'}
                                                    value={formData.monthlyWeekNumber}
                                                    onChange={(e) => setFormData({ ...formData, monthlyWeekNumber: e.target.value === 'last' ? 'last' : Number(e.target.value) })}
                                                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-800 disabled:opacity-50"
                                                >
                                                    <option value={1}>Minggu ke-1 (Pertama)</option>
                                                    <option value={2}>Minggu ke-2 (Kedua)</option>
                                                    <option value={3}>Minggu ke-3 (Ketiga)</option>
                                                    <option value={4}>Minggu ke-4 (Keempat)</option>
                                                    <option value="last">Minggu Terakhir</option>
                                                </select>
                                                <span>setiap bulan</span>
                                            </label>
                                        </div>

                                        <p className="text-[10px] text-slate-500 italic">
                                            {formData.monthlyType === 'date' 
                                                ? `Rapat akan berulang setiap tanggal ${formData.monthlyDate} setiap bulan.` 
                                                : `Rapat akan berulang setiap hari ${formData.monthlyDayOfWeek} pada minggu ${formData.monthlyWeekNumber === 'last' ? 'terakhir' : `ke-${formData.monthlyWeekNumber}`} setiap bulan.`}
                                        </p>
                                    </div>
                                )}

                                {formData.recurrenceType === 'once' && (
                                    /* Sekali Saja: Pilih tanggal spesifik */
                                    <div className="space-y-1.5 animate-fade-in">
                                        <label className="block text-[11px] font-semibold text-slate-600">
                                            Pilih Tanggal Rapat:
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.specificDate}
                                            onChange={(e) => setFormData({ ...formData, specificDate: e.target.value })}
                                            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-[10px] text-slate-500 italic">
                                            Rapat ini hanya akan berlangsung satu kali pada tanggal tersebut.
                                        </p>
                                    </div>
                                )}

                                {formData.recurrenceType === 'daily' && (
                                    /* Harian: Setiap hari atau Hari kerja saja */
                                    <div className="space-y-2 animate-fade-in">
                                        <label className="block text-[11px] font-semibold text-slate-600">
                                            Jangkauan Hari:
                                        </label>
                                        <div className="flex items-center gap-4 text-xs">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="dailyType"
                                                    checked={formData.dailyType === 'all'}
                                                    onChange={() => setFormData({ ...formData, dailyType: 'all' })}
                                                    className="accent-indigo-600"
                                                />
                                                <span>Setiap Hari (Senin - Minggu)</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="dailyType"
                                                    checked={formData.dailyType === 'weekdays'}
                                                    onChange={() => setFormData({ ...formData, dailyType: 'weekdays' })}
                                                    className="accent-indigo-600"
                                                />
                                                <span>Hari Kerja Saja (Senin - Jumat)</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Jam Mulai & Jam Selesai */}
                            <div className="grid grid-cols-2 gap-3">
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

                            {/* PIC & Peserta Meeting */}
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
                                    <i className="fa-solid fa-location-dot text-indigo-500"></i> Lokasi / Link Google Meet / Ruang Rapat
                                </label>
                                <input
                                    type="text"
                                    placeholder={isMeeting ? 'cth. Google Meet (meet.google.com/abc-xyz), Ruang Rapat Lt 2...' : 'cth. Meja Kerja, Studio Foto, Gudang A...'}
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>

                            {/* Catatan / Deskripsi Agenda */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                    <i className="fa-regular fa-comment-dots text-indigo-500"></i> Catatan Agenda / Rincian Pembahasan
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Tuliskan poin pembahasan, rincian aktivitas, atau persiapan rapat..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full text-xs border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                ></textarea>
                            </div>

                            {/* Pilihan Warna / Tag Card */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Warna Label Kalender
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
