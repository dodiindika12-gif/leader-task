'use strict';
import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Authentic Post-It / Google Keep Pastel Colors
export const POSTIT_COLORS = [
    { id: 'yellow', name: 'Kuning', bg: 'bg-amber-100', hoverBg: 'hover:bg-amber-200/80', border: 'border-amber-300', text: 'text-amber-950', dot: 'bg-amber-400', shadow: 'shadow-amber-200/50', ring: 'focus:ring-amber-300' },
    { id: 'peach', name: 'Peach', bg: 'bg-orange-100', hoverBg: 'hover:bg-orange-200/80', border: 'border-orange-300', text: 'text-orange-950', dot: 'bg-orange-400', shadow: 'shadow-orange-200/50', ring: 'focus:ring-orange-300' },
    { id: 'mint', name: 'Mint', bg: 'bg-emerald-100', hoverBg: 'hover:bg-emerald-200/80', border: 'border-emerald-300', text: 'text-emerald-950', dot: 'bg-emerald-400', shadow: 'shadow-emerald-200/50', ring: 'focus:ring-emerald-300' },
    { id: 'blue', name: 'Biru Langit', bg: 'bg-sky-100', hoverBg: 'hover:bg-sky-200/80', border: 'border-sky-300', text: 'text-sky-950', dot: 'bg-sky-400', shadow: 'shadow-sky-200/50', ring: 'focus:ring-sky-300' },
    { id: 'purple', name: 'Lavender', bg: 'bg-purple-100', hoverBg: 'hover:bg-purple-200/80', border: 'border-purple-300', text: 'text-purple-950', dot: 'bg-purple-400', shadow: 'shadow-purple-200/50', ring: 'focus:ring-purple-300' },
    { id: 'pink', name: 'Pink', bg: 'bg-rose-100', hoverBg: 'hover:bg-rose-200/80', border: 'border-rose-300', text: 'text-rose-950', dot: 'bg-rose-400', shadow: 'shadow-rose-200/50', ring: 'focus:ring-rose-300' },
    { id: 'white', name: 'Putih / Abu', bg: 'bg-white', hoverBg: 'hover:bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', dot: 'bg-slate-300', shadow: 'shadow-slate-200/50', ring: 'focus:ring-slate-300' }
];

export default function MinuteOfMeeting({
    notes = [],
    members = [],
    projects = [],
    divisions = [],
    currentPicId = '',
    session = null,
    onAddNote,
    onUpdateNote,
    onDeleteNote,
    onCreateTaskFromActionItem,
    onBatchCreateTasks,
    initialTab = 'notes',
    onTabChange = null
}) {
    // Top Tab: 'notes' (Catatan Post-It) OR 'mom' (Notulen Rapat MoM)
    const [activeTab, setActiveTab] = useState(initialTab || 'notes');

    React.useEffect(() => {
        if (initialTab && (initialTab === 'notes' || initialTab === 'mom')) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const isSuperUser = Boolean(session?.role === 'Super User' || session?.memberId === 'superadmin' || session?.email === 'abskdi.markom@gmail.com');

    // Current user identifiers for strict ownership & sharing validation
    const userIdentifiers = useMemo(() => {
        const isSuperAdminUser = isSuperUser;
        const matchedMember = members.find(m => 
            (session?.memberId && m.id === session.memberId) ||
            (currentPicId && m.id === currentPicId) ||
            (session?.email && m.email?.toLowerCase() === session.email.toLowerCase()) ||
            (isSuperAdminUser && (m.email === 'abskdi.markom@gmail.com' || m.name?.toLowerCase() === 'superadmin'))
        );

        const ids = new Set([
            session?.memberId,
            currentPicId,
            matchedMember?.id,
            isSuperAdminUser ? 'superadmin' : null,
            isSuperAdminUser ? '3970ef9a-2fd4-41bf-acbf-fab57672cc57' : null
        ].filter(Boolean));

        const emails = new Set([
            session?.email,
            matchedMember?.email,
            isSuperAdminUser ? 'abskdi.markom@gmail.com' : null
        ].filter(Boolean).map(e => e.toLowerCase().trim()));

        const names = new Set([
            session?.name,
            matchedMember?.name,
            isSuperAdminUser ? 'superadmin' : null
        ].filter(Boolean).map(n => n.toLowerCase().trim()));

        const primaryId = matchedMember?.id || (isSuperAdminUser ? '3970ef9a-2fd4-41bf-acbf-fab57672cc57' : '') || session?.memberId || currentPicId || '';

        return { ids, emails, names, primaryId };
    }, [session, currentPicId, members]);

    const activeUserId = userIdentifiers.primaryId;

    // Helper: Check if user is the Owner (pemilik)
    const checkIsOwner = (item) => {
        if (!item) return false;
        const ownerId = item.picId || item.pic_id || item.author_id || item.authorId || item.owner_id;
        if (!ownerId) return false;

        const str = String(ownerId).trim();
        if (userIdentifiers.ids.has(str)) return true;
        if (userIdentifiers.emails.has(str.toLowerCase())) return true;
        if (userIdentifiers.names.has(str.toLowerCase())) return true;
        return false;
    };

    // Helper: Check if item is Shared to the user (dishare ke ybs)
    const checkIsShared = (item) => {
        if (!item) return false;

        // Shared list check (sharedWith / shared_with / attendees)
        const sharedList = [
            ...(Array.isArray(item.sharedWith) ? item.sharedWith : []),
            ...(Array.isArray(item.shared_with) ? item.shared_with : []),
            ...(Array.isArray(item.attendees) ? item.attendees : [])
        ];

        for (const s of sharedList) {
            if (!s) continue;
            const str = String(s).trim();
            if (userIdentifiers.ids.has(str)) return true;
            if (userIdentifiers.emails.has(str.toLowerCase())) return true;
            if (userIdentifiers.names.has(str.toLowerCase())) return true;
        }

        // Action items assigned PIC check (for MoM)
        const actionItems = Array.isArray(item.action_items || item.actionItems)
            ? (item.action_items || item.actionItems)
            : [];
        for (const act of actionItems) {
            const pic = act.picId || act.pic_id;
            if (pic) {
                const str = String(pic).trim();
                if (userIdentifiers.ids.has(str)) return true;
                if (userIdentifiers.emails.has(str.toLowerCase())) return true;
                if (userIdentifiers.names.has(str.toLowerCase())) return true;
            }
        }

        return false;
    };

    // ----------------------------------------------------
    // STATE: POST-IT (KEEP NOTES)
    // ----------------------------------------------------
    const [notesSearch, setNotesSearch] = useState('');
    const [notesFilterScope, setNotesFilterScope] = useState('all'); // 'all', 'my', 'shared'
    const [notesColorFilter, setNotesColorFilter] = useState('all');
    const [isCreatingNote, setIsCreatingNote] = useState(false);
    const [newNoteDraft, setNewNoteDraft] = useState({
        title: '',
        content: '',
        color: 'yellow',
        isPinned: false,
        sharedWith: []
    });
    const [editingNoteModal, setEditingNoteModal] = useState(null);

    // ----------------------------------------------------
    // STATE: MOM (MINUTE OF MEETING)
    // ----------------------------------------------------
    const [momSearch, setMomSearch] = useState('');
    const [momFilterProject, setMomFilterProject] = useState('all');
    const [momFilterDivision, setMomFilterDivision] = useState('all');
    const [momFilterScope, setMomFilterScope] = useState('all'); // 'all', 'my', 'shared'
    const [isEditingMeeting, setIsEditingMeeting] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null); // When clicked -> detail view with table
    const [meetingFormData, setMeetingFormData] = useState({
        id: '',
        title: '',
        meetingDate: new Date().toISOString().slice(0, 16),
        location: '',
        projectId: '',
        division: '',
        attendees: [],
        agenda: '',
        content: '',
        actionItems: [
            { id: 'act-1', issue: '', decision: '', text: '', picId: '', deadline: '', done: false, isConverted: false }
        ]
    });

    const [attendeeSearch, setAttendeeSearch] = useState('');

    const filteredMembersForMeeting = useMemo(() => {
        const q = attendeeSearch.toLowerCase().trim();
        if (!q) return members;
        return members.filter(m => 
            (m.name || '').toLowerCase().includes(q) ||
            (m.division || '').toLowerCase().includes(q) ||
            (m.role || '').toLowerCase().includes(q) ||
            (m.email || '').toLowerCase().includes(q)
        );
    }, [members, attendeeSearch]);

    const selectedAttendeesList = useMemo(() => {
        return (meetingFormData.attendees || []).map(id => {
            const found = members.find(m => m.id === id);
            return found || { id, name: id, division: '' };
        });
    }, [meetingFormData.attendees, members]);

    const handleSelectAllAttendees = () => {
        setMeetingFormData(prev => ({
            ...prev,
            attendees: members.map(m => m.id)
        }));
    };

    const handleClearAllAttendees = () => {
        setMeetingFormData(prev => ({
            ...prev,
            attendees: []
        }));
    };

    // Auto clear selected meeting if access is revoked or not accessible
    React.useEffect(() => {
        if (selectedMeeting) {
            const isOwner = checkIsOwner(selectedMeeting);
            const isShared = checkIsShared(selectedMeeting);
            if (!isOwner && !isShared) {
                setSelectedMeeting(null);
            }
        }
    }, [selectedMeeting, userIdentifiers]);

    // ----------------------------------------------------
    // STATE: SHARE MODAL (For both Notes and MOM)
    // ----------------------------------------------------
    const [sharingTarget, setSharingTarget] = useState(null); // { item, type: 'note' | 'mom' }
    const [sharingSelectedIds, setSharingSelectedIds] = useState([]);
    const [copiedId, setCopiedId] = useState(null);

    // ----------------------------------------------------
    // FILTERED LISTS
    // ----------------------------------------------------
    // Raw notes categorized by type, strictly accessible to current user (owner or shared with)
    const { rawNotesList, rawMomList } = useMemo(() => {
        const nList = [];
        const mList = [];

        notes.forEach(item => {
            const isOwner = checkIsOwner(item);
            const isShared = checkIsShared(item);

            // JANGAN TAMPILKAN JIKA BUKAN PEMILIK DAN TIDAK DISHARE KE YBS
            if (!isOwner && !isShared) {
                return;
            }

            const t = (item.type || '').toLowerCase();
            if (t === 'meeting' || t === 'mom') {
                mList.push(item);
            } else if (t.startsWith('schedule')) {
                // Ignore weekly schedules (managed separately in Jadwal menu)
                return;
            } else {
                nList.push(item);
            }
        });

        return { rawNotesList: nList, rawMomList: mList };
    }, [notes, userIdentifiers]);

    // Filter Post-It Notes
    const filteredNotes = useMemo(() => {
        const query = notesSearch.toLowerCase().trim();

        return rawNotesList.filter(note => {
            const isOwner = checkIsOwner(note);
            const isShared = checkIsShared(note);

            // Filter Scope: 'all', 'my', 'shared'
            if (notesFilterScope === 'my' && !isOwner) return false;
            if (notesFilterScope === 'shared' && (!isShared || isOwner)) return false;

            // Color Filter
            if (notesColorFilter !== 'all' && (note.color || 'yellow') !== notesColorFilter) {
                return false;
            }

            // Search query
            if (query) {
                const matchTitle = (note.title || '').toLowerCase().includes(query);
                const matchContent = (note.content || '').toLowerCase().includes(query);
                if (!matchTitle && !matchContent) return false;
            }

            return true;
        });
    }, [rawNotesList, notesSearch, notesFilterScope, notesColorFilter, userIdentifiers]);

    // Separate Pinned and Others for Notes
    const { pinnedNotes, otherNotes } = useMemo(() => {
        const pinned = [];
        const other = [];
        filteredNotes.forEach(n => {
            if (n.isPinned) pinned.push(n);
            else other.push(n);
        });
        return { pinnedNotes: pinned, otherNotes: other };
    }, [filteredNotes]);

    // Filter MOM (Meetings)
    const filteredMOM = useMemo(() => {
        const query = momSearch.toLowerCase().trim();

        return rawMomList.filter(mom => {
            const isOwner = checkIsOwner(mom);
            const isShared = checkIsShared(mom);

            // Filter Scope: 'all', 'my', 'shared'
            if (momFilterScope === 'my' && !isOwner) return false;
            if (momFilterScope === 'shared' && (!isShared || isOwner)) return false;

            // Project filter
            if (momFilterProject !== 'all' && (mom.project_id || mom.projectId) !== momFilterProject) {
                return false;
            }

            // Division filter
            if (momFilterDivision !== 'all' && (mom.division || '') !== momFilterDivision) {
                return false;
            }

            // Search query
            if (query) {
                const matchTitle = (mom.title || '').toLowerCase().includes(query);
                const matchAgenda = (mom.agenda || '').toLowerCase().includes(query);
                const matchContent = (mom.content || '').toLowerCase().includes(query);
                const matchLocation = (mom.location || '').toLowerCase().includes(query);
                if (!matchTitle && !matchAgenda && !matchContent && !matchLocation) return false;
            }

            return true;
        });
    }, [rawMomList, momSearch, momFilterProject, momFilterDivision, momFilterScope, userIdentifiers]);

    // ----------------------------------------------------
    // POST-IT (KEEP NOTES) HANDLERS
    // ----------------------------------------------------
    const handleQuickSaveNote = async () => {
        if (!newNoteDraft.title.trim() && !newNoteDraft.content.trim()) {
            setIsCreatingNote(false);
            return;
        }

        const payload = {
            type: 'Note',
            title: newNoteDraft.title.trim() || 'Catatan Tanpa Judul',
            content: newNoteDraft.content.trim(),
            color: newNoteDraft.color || 'yellow',
            isPinned: Boolean(newNoteDraft.isPinned),
            picId: activeUserId,
            sharedWith: newNoteDraft.sharedWith || [],
            attendees: newNoteDraft.sharedWith || []
        };

        await onAddNote(payload);

        setNewNoteDraft({
            title: '',
            content: '',
            color: 'yellow',
            isPinned: false,
            sharedWith: []
        });
        setIsCreatingNote(false);
    };

    const handleTogglePinNote = async (note, e) => {
        if (e) e.stopPropagation();
        await onUpdateNote(note.id, {
            ...note,
            isPinned: !note.isPinned
        });
    };

    const handleChangeNoteColor = async (note, colorId, e) => {
        if (e) e.stopPropagation();
        await onUpdateNote(note.id, {
            ...note,
            color: colorId
        });
    };

    const handleSaveEditingNoteModal = async (e) => {
        e.preventDefault();
        if (!editingNoteModal) return;

        await onUpdateNote(editingNoteModal.id, {
            ...editingNoteModal,
            title: editingNoteModal.title.trim() || 'Catatan Tanpa Judul',
            content: editingNoteModal.content.trim()
        });

        setEditingNoteModal(null);
    };

    // ----------------------------------------------------
    // MOM FORM & ACTION ITEMS TABLE HANDLERS
    // ----------------------------------------------------
    const handleOpenMeetingForm = (doc = null) => {
        if (doc) {
            let parsedAttendees = [];
            try {
                parsedAttendees = Array.isArray(doc.attendees)
                    ? doc.attendees
                    : (typeof doc.attendees === 'string' ? JSON.parse(doc.attendees) : []);
            } catch (e) {
                parsedAttendees = [];
            }

            let parsedActionItems = [];
            try {
                parsedActionItems = Array.isArray(doc.action_items || doc.actionItems)
                    ? (doc.action_items || doc.actionItems)
                    : (typeof doc.action_items === 'string' ? JSON.parse(doc.action_items) : []);
            } catch (e) {
                parsedActionItems = [];
            }

            if (parsedActionItems.length === 0 && (doc.decision || doc.issue)) {
                parsedActionItems = [{
                    id: 'act-1',
                    issue: doc.issue || doc.agenda || '',
                    decision: doc.decision || '',
                    text: doc.decision || doc.issue || '',
                    picId: doc.pic_id || doc.picId || activeUserId,
                    deadline: doc.deadline || '',
                    done: !!doc.is_done,
                    isConverted: false
                }];
            } else {
                parsedActionItems = parsedActionItems.map((item, idx) => ({
                    id: item.id || `act-${idx + 1}`,
                    issue: item.issue || item.agenda || '',
                    decision: item.decision || item.text || '',
                    text: item.text || item.decision || item.issue || '',
                    picId: item.picId || item.pic_id || activeUserId,
                    deadline: item.deadline || '',
                    done: Boolean(item.done),
                    isConverted: Boolean(item.isConverted)
                }));
            }

            setMeetingFormData({
                id: doc.id,
                title: doc.title || '',
                meetingDate: doc.meeting_date ? new Date(doc.meeting_date).toISOString().slice(0, 16) : new Date(doc.created_at || Date.now()).toISOString().slice(0, 16),
                location: doc.location || '',
                projectId: doc.project_id || doc.projectId || projects[0]?.id || '',
                division: doc.division || '',
                attendees: parsedAttendees,
                agenda: doc.agenda || '',
                content: doc.content || '',
                actionItems: parsedActionItems.length > 0 ? parsedActionItems : [
                    { id: 'act-1', issue: '', decision: '', text: '', picId: activeUserId, deadline: '', done: false, isConverted: false }
                ]
            });
        } else {
            setMeetingFormData({
                id: '',
                title: '',
                meetingDate: new Date().toISOString().slice(0, 16),
                location: '',
                projectId: projects[0]?.id || '',
                division: '',
                attendees: activeUserId ? [activeUserId] : [],
                agenda: '',
                content: '',
                actionItems: [
                    { id: 'act-1', issue: '', decision: '', text: '', picId: activeUserId, deadline: '', done: false, isConverted: false }
                ]
            });
        }
        setAttendeeSearch('');
        setIsEditingMeeting(true);
    };

    const handleSaveMeetingForm = async (e) => {
        e.preventDefault();
        if (!meetingFormData.title.trim()) {
            alert('Judul atau Topik rapat wajib diisi.');
            return;
        }

        const newId = meetingFormData.id || crypto.randomUUID();
        const validActionItems = Array.isArray(meetingFormData.actionItems)
            ? meetingFormData.actionItems
                .filter(i => (i.issue || '').trim() || (i.decision || '').trim() || (i.text || '').trim())
                .map((item, idx) => ({
                    id: item.id || `act-${idx + 1}`,
                    issue: (item.issue || '').trim(),
                    decision: (item.decision || item.text || '').trim(),
                    text: (item.decision || item.issue || item.text || '').trim(),
                    picId: item.picId || activeUserId,
                    deadline: item.deadline || '',
                    done: Boolean(item.done),
                    isConverted: Boolean(item.isConverted)
                }))
            : [];

        const payload = {
            id: newId,
            type: 'Meeting',
            title: meetingFormData.title.trim(),
            meetingDate: meetingFormData.meetingDate,
            location: (meetingFormData.location || '').trim(),
            projectId: meetingFormData.projectId || null,
            division: meetingFormData.division || null,
            attendees: meetingFormData.attendees || [],
            sharedWith: meetingFormData.attendees || [],
            agenda: (meetingFormData.agenda || '').trim(),
            content: (meetingFormData.content || '').trim(),
            actionItems: validActionItems,
            issue: validActionItems[0]?.issue || (meetingFormData.agenda || '').trim() || meetingFormData.title.trim(),
            decision: validActionItems.map(a => a.decision || a.text).filter(Boolean).join('; ') || '',
            picId: activeUserId,
            deadline: validActionItems[0]?.deadline || null
        };

        if (meetingFormData.id) {
            const success = await onUpdateNote(meetingFormData.id, payload);
            if (success !== false) {
                if (selectedMeeting && selectedMeeting.id === meetingFormData.id) {
                    setSelectedMeeting(prev => ({ ...prev, ...payload, id: meetingFormData.id, action_items: validActionItems }));
                }
                setIsEditingMeeting(false);
            }
        } else {
            const success = await onAddNote(payload);
            if (success !== false) {
                // Langsung buka notulen rapat di detail view agar pengguna bisa mengisi poin-poinnya
                setSelectedMeeting({
                    ...payload,
                    id: newId,
                    action_items: validActionItems,
                    created_at: new Date().toISOString()
                });
                setIsEditingMeeting(false);
            }
        }
    };

    // Attendees toggle in meeting form
    const toggleMeetingAttendee = (memberId) => {
        setMeetingFormData(prev => {
            const exists = prev.attendees.includes(memberId);
            return {
                ...prev,
                attendees: exists ? prev.attendees.filter(id => id !== memberId) : [...prev.attendees, memberId]
            };
        });
    };

    // Action Items handlers in meeting form
    const addActionItemRow = () => {
        setMeetingFormData(prev => ({
            ...prev,
            actionItems: [
                ...prev.actionItems,
                { id: `act-${Date.now()}`, issue: '', decision: '', text: '', picId: prev.attendees[0] || activeUserId, deadline: '', done: false, isConverted: false }
            ]
        }));
    };

    const updateActionItemField = (id, field, value) => {
        setMeetingFormData(prev => ({
            ...prev,
            actionItems: prev.actionItems.map(item => item.id === id ? { ...item, [field]: value } : item)
        }));
    };

    const removeActionItemRow = (id) => {
        setMeetingFormData(prev => ({
            ...prev,
            actionItems: prev.actionItems.filter(item => item.id !== id)
        }));
    };

    // ----------------------------------------------------
    // MEETING DETAIL VIEW & LIVE TABLE ACTIONS
    // ----------------------------------------------------
    const handleToggleActionItemDone = async (meeting, itemId) => {
        const items = Array.isArray(meeting.action_items || meeting.actionItems)
            ? [...(meeting.action_items || meeting.actionItems)]
            : [];

        const updatedItems = items.map(it => {
            if (it.id === itemId) return { ...it, done: !it.done };
            return it;
        });

        const updatedMeeting = {
            ...meeting,
            action_items: updatedItems,
            actionItems: updatedItems
        };

        await onUpdateNote(meeting.id, updatedMeeting);
        setSelectedMeeting(updatedMeeting);
    };

    // Convert SINGLE Action Item row to a Real Project Task
    const handleConvertSingleItemToTask = async (meeting, item) => {
        const targetProjectId = meeting.project_id || meeting.projectId || projects[0]?.id;
        if (!targetProjectId) {
            alert('Pilih proyek terlebih dahulu untuk notulen ini.');
            return;
        }

        const taskTitle = (item.decision || item.issue || item.text || '').trim();
        if (!taskTitle) {
            alert('Baris ini tidak memiliki keputusan atau pembahasan untuk dijadikan task.');
            return;
        }

        const taskToCreate = {
            projectId: targetProjectId,
            title: item.issue ? `[MoM] ${item.issue}: ${taskTitle}` : `[MoM] ${taskTitle}`,
            deadline: item.deadline || '',
            picId: item.picId || activeUserId,
            status: 'To Do',
            priority: 'Medium',
            folder: 'General',
            todos: [
                {
                    id: crypto.randomUUID(),
                    title: `Eksekusi: ${taskTitle}`,
                    done: false,
                    picId: item.picId || activeUserId,
                    deadline: item.deadline || ''
                }
            ]
        };

        let success = false;
        if (onBatchCreateTasks) {
            success = await onBatchCreateTasks([taskToCreate]);
        } else if (onCreateTaskFromActionItem) {
            await onCreateTaskFromActionItem(taskToCreate);
            success = true;
        }

        if (success) {
            const items = Array.isArray(meeting.action_items || meeting.actionItems)
                ? [...(meeting.action_items || meeting.actionItems)]
                : [];

            const updatedItems = items.map(it => {
                if (it.id === item.id) return { ...it, isConverted: true };
                return it;
            });

            const updatedMeeting = {
                ...meeting,
                action_items: updatedItems,
                actionItems: updatedItems
            };

            await onUpdateNote(meeting.id, updatedMeeting);
            setSelectedMeeting(updatedMeeting);
            alert(`✅ Berhasil membuat task "${taskTitle}" di project!`);
        }
    };

    // Convert ALL Action Items to Real Project Tasks
    const handleConvertAllItemsToTasks = async (meeting) => {
        const items = Array.isArray(meeting.action_items || meeting.actionItems)
            ? [...(meeting.action_items || meeting.actionItems)]
            : [];

        const pendingItems = items.filter(i => !i.isConverted && ((i.decision || '').trim() || (i.issue || '').trim() || (i.text || '').trim()));

        if (pendingItems.length === 0) {
            alert('Semua action items sudah dikonversi atau belum ada isi.');
            return;
        }

        const targetProjectId = meeting.project_id || meeting.projectId || projects[0]?.id;
        if (!targetProjectId) {
            alert('Pilih proyek tujuan terlebih dahulu pada notulen ini.');
            return;
        }

        const tasksToCreate = pendingItems.map(item => {
            const taskTitle = (item.decision || item.issue || item.text || '').trim();
            return {
                projectId: targetProjectId,
                title: item.issue ? `[MoM] ${item.issue}: ${taskTitle}` : `[MoM] ${taskTitle}`,
                deadline: item.deadline || '',
                picId: item.picId || activeUserId,
                status: 'To Do',
                priority: 'Medium',
                folder: 'General',
                todos: [
                    {
                        id: crypto.randomUUID(),
                        title: `Eksekusi: ${taskTitle}`,
                        done: false,
                        picId: item.picId || activeUserId,
                        deadline: item.deadline || ''
                    }
                ]
            };
        });

        let success = false;
        if (onBatchCreateTasks) {
            success = await onBatchCreateTasks(tasksToCreate);
        } else if (onCreateTaskFromActionItem) {
            for (const t of tasksToCreate) {
                await onCreateTaskFromActionItem(t);
            }
            success = true;
        }

        if (success) {
            const updatedItems = items.map(it => ({ ...it, isConverted: true }));
            const updatedMeeting = {
                ...meeting,
                action_items: updatedItems,
                actionItems: updatedItems
            };

            await onUpdateNote(meeting.id, updatedMeeting);
            setSelectedMeeting(updatedMeeting);
            alert(`✅ Berhasil membuat ${tasksToCreate.length} task ke proyek! Cek Kanban atau Timeline.`);
        }
    };

    // Filter PIC options for meeting action items: only participants (attendees / sharedWith), meeting creator, or current row PIC
    const getAvailablePicsForMeeting = (meeting, currentRowPicId) => {
        if (!meeting) return members;

        const attendeesArr = Array.isArray(meeting.attendees)
            ? meeting.attendees
            : (typeof meeting.attendees === 'string' ? JSON.parse(meeting.attendees || '[]') : []);

        const sharedWithArr = Array.isArray(meeting.sharedWith)
            ? meeting.sharedWith
            : (Array.isArray(meeting.shared_with)
                ? meeting.shared_with
                : (typeof meeting.shared_with === 'string' ? JSON.parse(meeting.shared_with || '[]') : []));

        const ownerId = meeting.pic_id || meeting.picId || meeting.author_id || meeting.authorId || meeting.owner_id;

        const allowedSet = new Set(
            [...attendeesArr, ...sharedWithArr, ownerId, currentRowPicId]
                .filter(Boolean)
                .map(id => String(id).trim().toLowerCase())
        );

        if (allowedSet.size === 0) {
            return members;
        }

        const filtered = members.filter(m => {
            if (allowedSet.has(String(m.id).toLowerCase())) return true;
            if (m.email && allowedSet.has(String(m.email).toLowerCase().trim())) return true;
            if (m.name && allowedSet.has(String(m.name).toLowerCase().trim())) return true;
            return false;
        });

        return filtered.length > 0 ? filtered : members;
    };

    // Add empty row directly inside Detail View table
    const handleAddRowInDetailView = async (meeting) => {
        const items = Array.isArray(meeting.action_items || meeting.actionItems)
            ? [...(meeting.action_items || meeting.actionItems)]
            : [];

        const defaultPicId = (Array.isArray(meeting.attendees) && meeting.attendees.length > 0)
            ? meeting.attendees[0]
            : (meeting.pic_id || meeting.picId || activeUserId || '');

        const newRow = {
            id: `act-${Date.now()}`,
            issue: '',
            decision: '',
            text: '',
            picId: defaultPicId,
            deadline: '',
            done: false,
            isConverted: false
        };

        const updatedItems = [...items, newRow];
        const updatedMeeting = {
            ...meeting,
            action_items: updatedItems,
            actionItems: updatedItems
        };

        await onUpdateNote(meeting.id, updatedMeeting);
        setSelectedMeeting(updatedMeeting);
    };

    // Inline update of cell in Detail View table
    const handleUpdateRowCellInDetailView = async (meeting, itemId, field, value) => {
        const items = Array.isArray(meeting.action_items || meeting.actionItems)
            ? [...(meeting.action_items || meeting.actionItems)]
            : [];

        const updatedItems = items.map(it => {
            if (it.id === itemId) return { ...it, [field]: value };
            return it;
        });

        const updatedMeeting = {
            ...meeting,
            action_items: updatedItems,
            actionItems: updatedItems
        };

        await onUpdateNote(meeting.id, updatedMeeting);
        setSelectedMeeting(updatedMeeting);
    };

    // Delete row directly in Detail View table
    const handleDeleteRowInDetailView = async (meeting, itemId) => {
        const items = Array.isArray(meeting.action_items || meeting.actionItems)
            ? [...(meeting.action_items || meeting.actionItems)]
            : [];

        if (items.length <= 1) {
            const resetItem = { id: `act-${Date.now()}`, issue: '', decision: '', text: '', picId: activeUserId, deadline: '', done: false, isConverted: false };
            const updatedMeeting = {
                ...meeting,
                action_items: [resetItem],
                actionItems: [resetItem]
            };
            await onUpdateNote(meeting.id, updatedMeeting);
            setSelectedMeeting(updatedMeeting);
            return;
        }

        const updatedItems = items.filter(it => it.id !== itemId);
        const updatedMeeting = {
            ...meeting,
            action_items: updatedItems,
            actionItems: updatedItems
        };

        await onUpdateNote(meeting.id, updatedMeeting);
        setSelectedMeeting(updatedMeeting);
    };

    // Delete entire meeting directly from Detail View
    const handleDeleteSelectedMeeting = () => {
        if (!selectedMeeting) return;
        if (confirm(`Yakin ingin menghapus notulen "${selectedMeeting.title || 'Rapat'}" secara permanen?`)) {
            const idToDelete = selectedMeeting.id;
            setSelectedMeeting(null);
            onDeleteNote(idToDelete);
        }
    };

    // ----------------------------------------------------
    // SHARING MODAL HANDLERS
    // ----------------------------------------------------
    const handleOpenShareModal = (item, type = 'note', e) => {
        if (e) e.stopPropagation();
        const existingShared = Array.isArray(item.sharedWith)
            ? item.sharedWith
            : (Array.isArray(item.attendees) ? item.attendees : []);

        setSharingTarget({ item, type });
        setSharingSelectedIds(existingShared);
    };

    const handleToggleShareMember = (memberId) => {
        setSharingSelectedIds(prev => {
            if (prev.includes(memberId)) {
                return prev.filter(id => id !== memberId);
            } else {
                return [...prev, memberId];
            }
        });
    };

    const handleSelectAllShare = () => {
        setSharingSelectedIds(members.map(m => m.id));
    };

    const handleClearAllShare = () => {
        setSharingSelectedIds([]);
    };

    const handleSaveSharing = async () => {
        if (!sharingTarget) return;
        const { item, type } = sharingTarget;

        const updatedItem = {
            ...item,
            sharedWith: sharingSelectedIds,
            attendees: sharingSelectedIds
        };

        await onUpdateNote(item.id, updatedItem);

        if (selectedMeeting && selectedMeeting.id === item.id) {
            setSelectedMeeting(updatedItem);
        }

        setSharingTarget(null);
    };

    // ----------------------------------------------------
    // COPY WA SUMMARY
    // ----------------------------------------------------
    const handleCopyWhatsAppFormat = (doc, e) => {
        if (e) e.stopPropagation();

        let attendeesList = [];
        try {
            const attIds = Array.isArray(doc.attendees) ? doc.attendees : (typeof doc.attendees === 'string' ? JSON.parse(doc.attendees) : []);
            attendeesList = attIds.map(id => members.find(m => m.id === id)?.name || id).filter(Boolean);
        } catch (err) {
            attendeesList = [];
        }

        let items = [];
        try {
            items = Array.isArray(doc.action_items || doc.actionItems)
                ? (doc.action_items || doc.actionItems)
                : (typeof doc.action_items === 'string' ? JSON.parse(doc.action_items) : []);
        } catch (err) {
            items = [];
        }

        const proj = projects.find(p => p.id === (doc.project_id || doc.projectId));
        const meetingDate = doc.meeting_date
            ? new Date(doc.meeting_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '-';

        const lines = [
            `📋 *MINUTE OF MEETING (MoM) — BUSANA (BEAUTY ASANA)*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📌 *Topik:* ${doc.title || doc.issue || 'Tanpa Judul'}`,
            `🗓 *Waktu:* ${meetingDate}`,
            doc.location ? `📍 *Lokasi/Link:* ${doc.location}` : null,
            proj ? `📁 *Proyek:* ${proj.name}` : null,
            attendeesList.length > 0 ? `👥 *Peserta:* ${attendeesList.join(', ')}` : null,
            ``,
            doc.agenda ? `📝 *Agenda Pembahasan:*\n${doc.agenda}\n` : null,
            doc.content ? `💡 *Rangkuman Notulensi:*\n${doc.content}\n` : null,
            items.length > 0 ? `⚡ *HASIL KEPUTUSAN & ACTION ITEMS:*` : null,
            ...items.map((it, idx) => {
                const picMember = members.find(m => m.id === it.picId);
                const picText = picMember ? ` [PIC: ${picMember.name}]` : '';
                const deadlineText = it.deadline ? ` (Deadline: ${it.deadline})` : '';
                const statusText = it.done ? ' ✅ [Selesai]' : '';
                const issuePrefix = it.issue ? `*${it.issue}*: ` : '';
                return `${idx + 1}. ${issuePrefix}${it.decision || it.text}${picText}${deadlineText}${statusText}`;
            }),
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `_Dicatat otomatis via Busana (Beauty Asana)_`
        ].filter(line => line !== null);

        const textToCopy = lines.join('\n');
        navigator.clipboard.writeText(textToCopy);
        setCopiedId(doc.id);
        setTimeout(() => setCopiedId(null), 2500);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto h-full flex flex-col">
            {!selectedMeeting ? (
                <>
                    {/* Top Navigation & Segmented Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/70">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
                        <i className="fa-solid fa-note-sticky text-amber-500"></i>
                        <span>Catatan & Notulen Rapat</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Dokumentasikan catatan pribadi / tim (Post-It Keep) serta kelola hasil notulen rapat tim (MoM).
                    </p>
                </div>

                {/* Segmented Control */}
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 shadow-xs self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('notes');
                            setIsEditingMeeting(false);
                            if (onTabChange) onTabChange('notes');
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'notes'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 scale-[1.02]'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <i className="fa-solid fa-note-sticky text-amber-500 text-sm"></i>
                        <span>Post it!</span>
                        <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold">
                            {rawNotesList.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('mom');
                            setIsCreatingNote(false);
                            if (onTabChange) onTabChange('mom');
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'mom'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 scale-[1.02]'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <i className="fa-solid fa-clipboard-list text-emerald-600 text-sm"></i>
                        <span>Minutes of Meeting</span>
                        <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
                            {rawMomList.length}
                        </span>
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: GOOGLE KEEP / POST-IT ONLINE CATATAN                                */}
            {/* ========================================================================= */}
            {activeTab === 'notes' && (
                <div className="space-y-6 flex-1 flex flex-col">
                    {/* Notes Filters & Scope Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-slate-200/80 backdrop-blur-sm shadow-xs">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                placeholder="Cari dalam catatan Post-It..."
                                value={notesSearch}
                                onChange={(e) => setNotesSearch(e.target.value)}
                                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-400 focus:bg-white transition"
                            />
                            {notesSearch && (
                                <button onClick={() => setNotesSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <i className="fa-solid fa-xmark text-xs"></i>
                                </button>
                            )}
                        </div>

                        {/* Scope Pills: Semua / Catatan Saya / Dibagikan */}
                        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setNotesFilterScope('all')}
                                className={`px-3 py-1.5 rounded-lg transition ${
                                    notesFilterScope === 'all'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Semua Catatan
                            </button>
                            <button
                                type="button"
                                onClick={() => setNotesFilterScope('my')}
                                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                                    notesFilterScope === 'my'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <i className="fa-regular fa-user text-[11px] text-amber-600"></i>
                                <span>Catatan Saya</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setNotesFilterScope('shared')}
                                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                                    notesFilterScope === 'shared'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <i className="fa-solid fa-users text-[11px] text-indigo-600"></i>
                                <span>Dibagikan ke Saya</span>
                            </button>
                        </div>

                        {/* Color Filter Dots */}
                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                            <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">Warna:</span>
                            <button
                                type="button"
                                onClick={() => setNotesColorFilter('all')}
                                className={`w-6 h-6 rounded-full text-[10px] font-bold border transition ${
                                    notesColorFilter === 'all'
                                        ? 'border-slate-800 bg-slate-800 text-white'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Semua Warna"
                            >
                                All
                            </button>
                            {POSTIT_COLORS.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setNotesColorFilter(notesColorFilter === c.id ? 'all' : c.id)}
                                    className={`w-6 h-6 rounded-full ${c.dot} border transition transform hover:scale-110 ${
                                        notesColorFilter === c.id ? 'ring-2 ring-slate-800 scale-110' : 'border-black/10'
                                    }`}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Google Keep Expandable Input Box */}
                    <div className="max-w-2xl mx-auto w-full">
                        {!isCreatingNote ? (
                            <div
                                onClick={() => setIsCreatingNote(true)}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-3.5 flex items-center justify-between cursor-text text-slate-400 text-sm group"
                            >
                                <div className="flex items-center gap-2.5">
                                    <i className="fa-regular fa-pen-to-square text-amber-500 text-base"></i>
                                    <span className="font-medium text-slate-500 group-hover:text-slate-700">Tulis catatan baru (Post-It)...</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 text-xs">
                                    <span className="hidden sm:inline bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-200 text-[11px] font-semibold">
                                        + Buat Cepat
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`rounded-3xl border ${
                                    POSTIT_COLORS.find(c => c.id === newNoteDraft.color)?.border || 'border-amber-300'
                                } ${
                                    POSTIT_COLORS.find(c => c.id === newNoteDraft.color)?.bg || 'bg-amber-100'
                                } p-5 shadow-lg transition-colors`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <input
                                        type="text"
                                        placeholder="Judul catatan..."
                                        value={newNoteDraft.title}
                                        onChange={(e) => setNewNoteDraft({ ...newNoteDraft, title: e.target.value })}
                                        className="w-full text-base font-bold text-slate-900 bg-transparent placeholder-slate-400 focus:outline-none"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setNewNoteDraft({ ...newNoteDraft, isPinned: !newNoteDraft.isPinned })}
                                        className={`p-2 rounded-xl text-xs transition ${
                                            newNoteDraft.isPinned
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
                                        }`}
                                        title={newNoteDraft.isPinned ? "Lepas pin" : "Sematkan ke atas (Pin)"}
                                    >
                                        <i className="fa-solid fa-thumbtack"></i>
                                    </button>
                                </div>

                                <textarea
                                    rows={4}
                                    placeholder="Tulis catatan, ide, pengingat, atau daftar tugas..."
                                    value={newNoteDraft.content}
                                    onChange={(e) => setNewNoteDraft({ ...newNoteDraft, content: e.target.value })}
                                    className="w-full text-xs text-slate-800 bg-transparent placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
                                />

                                {/* Shared with preview in draft */}
                                {newNoteDraft.sharedWith.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2 py-1.5 px-2.5 bg-white/60 rounded-xl text-[11px] text-slate-600 border border-black/5">
                                        <i className="fa-solid fa-users text-indigo-600"></i>
                                        <span>Dibagikan ke {newNoteDraft.sharedWith.length} anggota tim</span>
                                    </div>
                                )}

                                {/* Bottom Toolbar */}
                                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-black/10">
                                    <div className="flex items-center gap-1.5">
                                        {/* Color Picker Palette */}
                                        <div className="flex items-center gap-1 bg-white/70 p-1 rounded-xl border border-black/5">
                                            {POSTIT_COLORS.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setNewNoteDraft({ ...newNoteDraft, color: c.id })}
                                                    className={`w-5 h-5 rounded-full ${c.dot} border transition transform hover:scale-110 ${
                                                        newNoteDraft.color === c.id ? 'ring-2 ring-slate-800 scale-110' : 'border-black/10'
                                                    }`}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>

                                        {/* Share Button in Draft */}
                                        <button
                                            type="button"
                                            onClick={() => setSharingTarget({ item: { ...newNoteDraft, id: 'draft' }, type: 'draft_note' })}
                                            className="px-2.5 py-1.5 rounded-xl text-xs bg-white/70 hover:bg-white text-slate-700 font-medium border border-black/5 transition flex items-center gap-1"
                                            title="Bagikan catatan ini ke anggota tim"
                                        >
                                            <i className="fa-solid fa-user-plus text-indigo-600 text-[11px]"></i>
                                            <span className="hidden sm:inline">Bagikan</span>
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingNote(false)}
                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-black/5 transition"
                                        >
                                            Tutup
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleQuickSaveNote}
                                            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm active:scale-95"
                                        >
                                            Simpan Catatan
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Post-It Notes Display Grid */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                        {filteredNotes.length === 0 ? (
                            <div className="py-16 text-center text-slate-400">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-3xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm border border-amber-200">
                                    <i className="fa-solid fa-note-sticky text-3xl"></i>
                                </div>
                                <h3 className="text-base font-bold text-slate-700">Belum Ada Catatan Post-It</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                    Gunakan kotak di atas untuk membuat catatan cepat, ide kreatif, atau daftar to-do yang bisa Anda bagikan ke tim.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* PINNED SECTION */}
                                {pinnedNotes.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <i className="fa-solid fa-thumbtack text-amber-500"></i>
                                            <span>Disematkan ({pinnedNotes.length})</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {pinnedNotes.map(note => (
                                                <PostItCard
                                                    key={note.id}
                                                    note={note}
                                                    members={members}
                                                    activeUserId={activeUserId}
                                                    isSuperUser={isSuperUser}
                                                    onTogglePin={(e) => handleTogglePinNote(note, e)}
                                                    onChangeColor={(colorId, e) => handleChangeNoteColor(note, colorId, e)}
                                                    onOpenShare={(e) => handleOpenShareModal(note, 'note', e)}
                                                    onOpenEdit={() => setEditingNoteModal(note)}
                                                    onDelete={() => {
                                                        if (confirm('Hapus catatan ini?')) onDeleteNote(note.id);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* OTHERS SECTION */}
                                {otherNotes.length > 0 && (
                                    <div className="space-y-3">
                                        {pinnedNotes.length > 0 && (
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">
                                                <span>Catatan Lainnya ({otherNotes.length})</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {otherNotes.map(note => (
                                                <PostItCard
                                                    key={note.id}
                                                    note={note}
                                                    members={members}
                                                    activeUserId={activeUserId}
                                                    isSuperUser={isSuperUser}
                                                    onTogglePin={(e) => handleTogglePinNote(note, e)}
                                                    onChangeColor={(colorId, e) => handleChangeNoteColor(note, colorId, e)}
                                                    onOpenShare={(e) => handleOpenShareModal(note, 'note', e)}
                                                    onOpenEdit={() => setEditingNoteModal(note)}
                                                    onDelete={() => {
                                                        if (confirm('Hapus catatan ini?')) onDeleteNote(note.id);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: MINUTE OF MEETING (MOM) LIST & DETAIL                               */}
            {/* ========================================================================= */}
            {activeTab === 'mom' && (
                <div className="space-y-6 flex-1 flex flex-col">
                    {/* Top Action & Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-slate-200/80 backdrop-blur-sm shadow-xs">
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[180px] max-w-sm">
                                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="text"
                                    placeholder="Cari notulen rapat, agenda, topik..."
                                    value={momSearch}
                                    onChange={(e) => setMomSearch(e.target.value)}
                                    className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                                />
                            </div>

                            {/* Project Filter */}
                            <select
                                value={momFilterProject}
                                onChange={(e) => setMomFilterProject(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="all">Semua Proyek</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>

                            {/* Division Filter */}
                            <select
                                value={momFilterDivision}
                                onChange={(e) => setMomFilterDivision(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="all">Semua Divisi</option>
                                {divisions.map((d, i) => (
                                    <option key={i} value={typeof d === 'string' ? d : d.name}>
                                        {typeof d === 'string' ? d : d.name}
                                    </option>
                                ))}
                            </select>

                            {/* Access Scope Filter */}
                            <select
                                value={momFilterScope}
                                onChange={(e) => setMomFilterScope(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="all">Semua Akses Rapat</option>
                                <option value="my">Rapat Saya</option>
                                <option value="shared">Dibagikan ke Saya</option>
                            </select>
                        </div>

                        {/* Create Meeting Button */}
                        <button
                            type="button"
                            onClick={() => handleOpenMeetingForm()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shadow-emerald-200 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                            <i className="fa-solid fa-plus text-xs"></i>
                            <span>Buat Notulen MoM</span>
                        </button>
                    </div>

                    {/* MOM Meetings List */}
                    <div className="flex-1 overflow-y-auto pr-1">
                        {filteredMOM.length === 0 ? (
                            <div className="py-16 text-center text-slate-400">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200">
                                    <i className="fa-solid fa-clipboard-list text-3xl"></i>
                                </div>
                                <h3 className="text-base font-bold text-slate-700">Belum Ada Notulen Rapat (MoM)</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                    Klik tombol <span className="font-bold text-emerald-600">+ Buat Notulen MoM</span> di atas untuk mendokumentasikan rapat, pembahasan issue, keputusan, dan penugasan task.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredMOM.map(doc => {
                                    const proj = projects.find(p => p.id === (doc.project_id || doc.projectId));
                                    let attendeesList = [];
                                    try {
                                        const attIds = Array.isArray(doc.attendees) ? doc.attendees : (typeof doc.attendees === 'string' ? JSON.parse(doc.attendees) : []);
                                        attendeesList = attIds.map(id => members.find(m => m.id === id)).filter(Boolean);
                                    } catch (e) {
                                        attendeesList = [];
                                    }

                                    let items = [];
                                    try {
                                        items = Array.isArray(doc.action_items || doc.actionItems)
                                            ? (doc.action_items || doc.actionItems)
                                            : (typeof doc.action_items === 'string' ? JSON.parse(doc.action_items) : []);
                                    } catch (e) {
                                        items = [];
                                    }

                                    if (items.length === 0 && (doc.decision || doc.issue)) {
                                        items = [{
                                            id: 'act-1',
                                            issue: doc.issue || doc.agenda || '',
                                            decision: doc.decision || '',
                                            text: doc.decision || doc.issue || '',
                                            picId: doc.pic_id || doc.picId || activeUserId,
                                            deadline: doc.deadline || '',
                                            done: !!doc.is_done,
                                            isConverted: false
                                        }];
                                    }

                                    const doneCount = items.filter(i => i.done).length;
                                    const convertedCount = items.filter(i => i.isConverted).length;
                                    const dateFormatted = doc.meeting_date
                                        ? new Date(doc.meeting_date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : (doc.created_at ? new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-');

                                    const authorMember = members.find(m => m.id === (doc.pic_id || doc.picId));

                                    return (
                                        <motion.div
                                            key={doc.id}
                                            layout
                                            onClick={() => setSelectedMeeting(doc)}
                                            className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all p-5 flex flex-col justify-between cursor-pointer group"
                                        >
                                            <div>
                                                {/* Header row */}
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                                        MoM Meeting
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-medium">
                                                        {dateFormatted}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition line-clamp-2">
                                                    {doc.title || doc.issue || 'Tanpa Judul Rapat'}
                                                </h3>

                                                {/* Project & Location meta */}
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px]">
                                                    {proj && (
                                                        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg font-medium flex items-center gap-1 border border-slate-200/60">
                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.color || '#10b981' }}></span>
                                                            <span className="truncate max-w-[120px]">{proj.name}</span>
                                                        </span>
                                                    )}
                                                    {doc.location && (
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-slate-200/60">
                                                            <i className="fa-solid fa-location-dot text-rose-500 text-[10px]"></i>
                                                            <span className="truncate max-w-[110px]">{doc.location}</span>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Attendees */}
                                                {attendeesList.length > 0 && (
                                                    <div className="flex items-center gap-1.5 mt-3">
                                                        <span className="text-[10px] text-slate-400">Peserta:</span>
                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                            {attendeesList.slice(0, 4).map((m, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    title={`${m.name} (${m.division || ''})`}
                                                                    className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white shadow-xs"
                                                                >
                                                                    {m.name.charAt(0)}
                                                                </div>
                                                            ))}
                                                            {attendeesList.length > 4 && (
                                                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center border-2 border-white">
                                                                    +{attendeesList.length - 4}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Action Items count pill */}
                                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1 text-slate-600 font-semibold">
                                                        <i className="fa-solid fa-table-list text-emerald-600"></i>
                                                        <span>{items.length} Pembahasan & Aksi</span>
                                                    </div>
                                                    {items.length > 0 && (
                                                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                                            {doneCount}/{items.length} Selesai
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Footer Actions */}
                                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedMeeting(doc); }}
                                                    className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 border border-emerald-200/60"
                                                >
                                                    <i className="fa-regular fa-eye"></i>
                                                    <span>Lihat Detail Tabel</span>
                                                </button>

                                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                    {/* Share Access */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleOpenShareModal(doc, 'mom', e)}
                                                        className="p-1.5 rounded-xl text-xs bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                                                        title="Bagikan akses notulen rapat ini"
                                                    >
                                                        <i className="fa-solid fa-user-plus text-indigo-600"></i>
                                                    </button>

                                                    {/* Copy WA */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCopyWhatsAppFormat(doc, e)}
                                                        className={`p-1.5 rounded-xl text-xs transition border ${
                                                            copiedId === doc.id
                                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}
                                                        title="Salin format ringkasan WhatsApp"
                                                    >
                                                        <i className={copiedId === doc.id ? "fa-solid fa-check" : "fa-brands fa-whatsapp text-emerald-600"}></i>
                                                    </button>

                                                    {/* Edit Form */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleOpenMeetingForm(doc); }}
                                                        className="p-1.5 rounded-xl text-xs bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                                                        title="Edit Notulen"
                                                    >
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>

                                                    {/* Delete */}
                                                    {(isSuperUser || (doc.pic_id || doc.picId) === activeUserId) && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('Hapus notulen rapat ini?')) onDeleteNote(doc.id);
                                                            }}
                                                            className="p-1.5 rounded-xl text-xs bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                                                            title="Hapus"
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
            </>
            ) : (
                /* ========================================================================= */
                /* DEDICATED FULL-PAGE VIEW: MEETING DETAIL & ACTION ITEMS TABLE             */
                /* ========================================================================= */
                <div className="space-y-6 animate-fade-in pb-12">
                    {/* Top Navigation & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedMeeting(null)}
                                className="group inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition"
                            >
                                <i className="fa-solid fa-arrow-left text-slate-400 group-hover:-translate-x-0.5 transition-transform"></i>
                                <span>Kembali ke Daftar Notulen</span>
                            </button>
                            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
                            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                                <span className="hover:text-slate-800 cursor-pointer" onClick={() => setSelectedMeeting(null)}>
                                    Notulen Rapat
                                </span>
                                <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
                                <span className="font-bold text-slate-800 max-w-sm truncate">
                                    {selectedMeeting.title || selectedMeeting.issue || 'Detail Notulen'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={(e) => handleCopyWhatsAppFormat(selectedMeeting, e)}
                                className="px-3.5 py-2 rounded-xl text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition flex items-center gap-1.5 shadow-xs"
                                title="Salin format ringkasan WhatsApp"
                            >
                                <i className="fa-brands fa-whatsapp text-sm"></i>
                                <span>{copiedId === selectedMeeting.id ? 'Tersalin!' : 'Salin WA'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleOpenShareModal(selectedMeeting, 'mom')}
                                className="px-3.5 py-2 rounded-xl text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold transition flex items-center gap-1.5 shadow-xs"
                                title="Kelola siapa saja yang bisa akses notulen ini"
                            >
                                <i className="fa-solid fa-user-plus text-xs"></i>
                                <span>Bagikan</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleOpenMeetingForm(selectedMeeting)}
                                className="px-3.5 py-2 rounded-xl text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold transition flex items-center gap-1.5 shadow-xs"
                            >
                                <i className="fa-solid fa-pen text-xs text-slate-500"></i>
                                <span>Edit Info</span>
                            </button>

                            {(isSuperUser || (selectedMeeting.pic_id || selectedMeeting.picId) === activeUserId) && (
                                <button
                                    type="button"
                                    onClick={handleDeleteSelectedMeeting}
                                    className="px-3.5 py-2 rounded-xl text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold transition flex items-center gap-1.5 shadow-xs"
                                    title="Hapus Notulen Rapat"
                                >
                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                    <span>Hapus</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Meeting Overview Card */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-7 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                Notulen Rapat (MoM)
                            </span>
                            {selectedMeeting.meeting_date && (
                                <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60">
                                    <i className="fa-regular fa-calendar text-emerald-600 text-[11px]"></i>
                                    {new Date(selectedMeeting.meeting_date).toLocaleDateString('id-ID', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            )}
                            {selectedMeeting.project_id && (
                                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200/60 flex items-center gap-1.5 text-xs font-semibold">
                                    <i className="fa-regular fa-folder text-emerald-600"></i>
                                    <span>{projects.find(p => p.id === selectedMeeting.project_id)?.name || 'Proyek'}</span>
                                </span>
                            )}
                            {selectedMeeting.division && (
                                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200/60 flex items-center gap-1.5 text-xs font-semibold">
                                    <i className="fa-solid fa-layer-group text-blue-500 text-[10px]"></i>
                                    <span>{selectedMeeting.division}</span>
                                </span>
                            )}
                            {selectedMeeting.location && (
                                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200/60 flex items-center gap-1.5 text-xs font-medium">
                                    <i className="fa-solid fa-location-dot text-rose-500"></i>
                                    <span>{selectedMeeting.location}</span>
                                </span>
                            )}
                        </div>

                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                                {selectedMeeting.title || selectedMeeting.issue || 'Tanpa Judul Rapat'}
                            </h1>
                        </div>

                        {/* Peserta Rapat (Attendees) Chips */}
                        {(() => {
                            const attendeesArr = Array.isArray(selectedMeeting.attendees) ? selectedMeeting.attendees : [];
                            const attendeeItems = attendeesArr.map(att => {
                                const found = members.find(m => m.id === att || m.name === att);
                                return {
                                    id: att,
                                    name: found?.name || att,
                                    role: found?.role
                                };
                            });

                            return (
                                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                                        <i className="fa-solid fa-users text-emerald-600"></i>
                                        Peserta Rapat ({attendeeItems.length}):
                                    </span>
                                    {attendeeItems.length === 0 ? (
                                        <span className="text-xs text-slate-400 italic">Belum ada peserta yang ditandai</span>
                                    ) : (
                                        attendeeItems.map((att, idx) => (
                                            <span
                                                key={att.id || idx}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                                            >
                                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black uppercase">
                                                    {att.name ? att.name.charAt(0) : 'U'}
                                                </span>
                                                <span>{att.name}</span>
                                            </span>
                                        ))
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Agenda & Rangkuman Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                <i className="fa-solid fa-list-check text-emerald-600"></i>
                                <span>Agenda Rapat</span>
                            </h4>
                            {selectedMeeting.agenda ? (
                                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed pt-1 font-normal">
                                    {selectedMeeting.agenda}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-400 italic pt-1">
                                    Belum ada rincian agenda rapat tertulis.
                                </p>
                            )}
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                                <i className="fa-regular fa-file-lines text-indigo-600"></i>
                                <span>Rangkuman Notulensi Diskusi</span>
                            </h4>
                            {selectedMeeting.content ? (
                                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed pt-1 font-normal">
                                    {selectedMeeting.content}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-400 italic pt-1">
                                    Belum ada rangkuman notulensi tertulis.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Tabel Pembahasan, Keputusan & Action Items */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <i className="fa-solid fa-table-list text-emerald-600"></i>
                                    <span>Tabel Pembahasan, Keputusan & Action Items</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Tiap baris issue dan keputusan dapat ditentukan PIC, deadline, checklist selesai, dan dikonversi langsung menjadi task proyek.
                                </p>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleAddRowInDetailView(selectedMeeting)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <i className="fa-solid fa-plus text-xs"></i>
                                    <span>Tambah Baris</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleConvertAllItemsToTasks(selectedMeeting)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center gap-2 cursor-pointer"
                                    title="Konversi semua item yang belum dibuat task ke proyek"
                                >
                                    <i className="fa-solid fa-bolt text-xs"></i>
                                    <span>Jadikan Semua Task</span>
                                </button>
                            </div>
                        </div>

                        {/* The Table */}
                        {(() => {
                            let items = Array.isArray(selectedMeeting.action_items || selectedMeeting.actionItems)
                                ? (selectedMeeting.action_items || selectedMeeting.actionItems)
                                : [];

                            if (items.length === 0 && (selectedMeeting.decision || selectedMeeting.issue)) {
                                items = [{
                                    id: 'act-1',
                                    issue: selectedMeeting.issue || selectedMeeting.agenda || '',
                                    decision: selectedMeeting.decision || '',
                                    text: selectedMeeting.decision || selectedMeeting.issue || '',
                                    picId: selectedMeeting.pic_id || selectedMeeting.picId || activeUserId,
                                    deadline: selectedMeeting.deadline || '',
                                    done: !!selectedMeeting.is_done,
                                    isConverted: false
                                }];
                            }

                            return (
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold">
                                                <th className="p-3.5 w-12 text-center">#</th>
                                                <th className="p-3.5 min-w-[240px]">Issue / Pembahasan</th>
                                                <th className="p-3.5 min-w-[260px]">Keputusan / Solusi</th>
                                                <th className="p-3.5 min-w-[170px]">PIC (Penanggung Jawab)</th>
                                                <th className="p-3.5 min-w-[140px]">Tenggat (Deadline)</th>
                                                <th className="p-3.5 w-24 text-center">Selesai</th>
                                                <th className="p-3.5 w-36 text-center">Aksi Task</th>
                                                <th className="p-3.5 w-12 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {items.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="p-8 text-center text-slate-400">
                                                        Belum ada baris pembahasan / keputusan. Klik tombol <span className="font-bold text-slate-700">+ Tambah Baris</span> di atas untuk mulai mencatat.
                                                    </td>
                                                </tr>
                                            ) : (
                                                items.map((item, idx) => {
                                                    return (
                                                        <tr key={item.id || idx} className={`group hover:bg-slate-50/80 transition-colors ${item.done ? 'bg-slate-50/50' : ''}`}>
                                                            <td className="p-3.5 text-center font-bold text-slate-400">
                                                                {idx + 1}
                                                            </td>
                                                            {/* Issue */}
                                                            <td className="p-3.5">
                                                                <textarea
                                                                    rows={2}
                                                                    value={item.issue || ''}
                                                                    placeholder="Tulis masalah / topik..."
                                                                    onChange={(e) => handleUpdateRowCellInDetailView(selectedMeeting, item.id, 'issue', e.target.value)}
                                                                    className={`w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 p-2 rounded-xl outline-none transition text-xs resize-none ${
                                                                        item.done ? 'line-through text-slate-400 bg-slate-100/50' : 'text-slate-800 font-semibold'
                                                                    }`}
                                                                />
                                                            </td>
                                                            {/* Keputusan */}
                                                            <td className="p-3.5">
                                                                <textarea
                                                                    rows={2}
                                                                    value={item.decision || item.text || ''}
                                                                    placeholder="Tulis keputusan / tindak lanjut..."
                                                                    onChange={(e) => {
                                                                        handleUpdateRowCellInDetailView(selectedMeeting, item.id, 'decision', e.target.value);
                                                                        handleUpdateRowCellInDetailView(selectedMeeting, item.id, 'text', e.target.value);
                                                                    }}
                                                                    className={`w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 p-2 rounded-xl outline-none transition text-xs resize-none ${
                                                                        item.done ? 'line-through text-slate-400 bg-slate-100/50' : 'text-slate-700'
                                                                    }`}
                                                                />
                                                            </td>
                                                            {/* PIC */}
                                                            <td className="p-3.5">
                                                                <select
                                                                    value={item.picId || ''}
                                                                    onChange={(e) => handleUpdateRowCellInDetailView(selectedMeeting, item.id, 'picId', e.target.value)}
                                                                    className="w-full text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl p-2 text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
                                                                >
                                                                    <option value="">Pilih PIC...</option>
                                                                    {getAvailablePicsForMeeting(selectedMeeting, item.picId).map(m => (
                                                                        <option key={m.id} value={m.id}>
                                                                            {m.name} {m.id === activeUserId ? '(Saya)' : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            {/* Tenggat */}
                                                            <td className="p-3.5">
                                                                <input
                                                                    type="date"
                                                                    value={item.deadline ? item.deadline.split('T')[0] : ''}
                                                                    onChange={(e) => handleUpdateRowCellInDetailView(selectedMeeting, item.id, 'deadline', e.target.value)}
                                                                    className="w-full text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl p-2 text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
                                                                />
                                                            </td>
                                                            {/* Selesai Checklist */}
                                                            <td className="p-3.5 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!item.done}
                                                                    onChange={(e) => handleUpdateRowCellInDetailView(selectedMeeting, item.id, 'done', e.target.checked)}
                                                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition cursor-pointer"
                                                                    title="Tandai selesai"
                                                                />
                                                            </td>
                                                            {/* Aksi Task */}
                                                            <td className="p-3.5 text-center">
                                                                {item.isConverted ? (
                                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl">
                                                                        <i className="fa-solid fa-check text-xs"></i>
                                                                        <span>Jadi Task</span>
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleConvertSingleItemToTask(selectedMeeting, item)}
                                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                                                                        title="Jadikan baris ini sebagai task di proyek"
                                                                    >
                                                                        <i className="fa-solid fa-bolt text-indigo-600"></i>
                                                                        <span>Buat Task</span>
                                                                    </button>
                                                                )}
                                                            </td>
                                                            {/* Hapus Baris */}
                                                            <td className="p-3.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteRowInDetailView(selectedMeeting, item.id)}
                                                                    className="opacity-40 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                                                    title="Hapus baris ini"
                                                                >
                                                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}

                        {/* Table Footer */}
                        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                <i className="fa-solid fa-circle-info text-slate-400"></i>
                                <span>
                                    {selectedMeeting.project_id
                                        ? `Semua task baru akan otomatis terhubung ke proyek: ${projects.find(p => p.id === selectedMeeting.project_id)?.name || 'Proyek'}`
                                        : 'Catatan: Pastikan proyek sudah dipilih agar task dapat terhubung.'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedMeeting(null)}
                                className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition shadow-xs flex items-center gap-2 self-end sm:self-auto cursor-pointer"
                            >
                                <i className="fa-solid fa-arrow-left text-xs"></i>
                                <span>Kembali ke Daftar Notulen</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ========================================================================= */}
            {/* MODAL 2: MEETING FORM EDITOR (FOR CREATE / EDIT MOM)                       */}
            {/* ========================================================================= */}
            {isEditingMeeting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 lg:p-7 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                <h3 className="font-black text-slate-900 text-lg">
                                    {meetingFormData.id ? 'Edit Notulen Rapat (MoM)' : 'Buat Notulen Rapat Baru (MoM)'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditingMeeting(false)}
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
                            >
                                <i className="fa-solid fa-xmark text-base"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveMeetingForm} className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                            {/* 1. Judul Rapat */}
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-heading text-emerald-600"></i>
                                    <span>Judul / Topik Rapat <span className="text-rose-500">*</span></span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Rapat Koordinasi Mingguan Proyek Promo & IT..."
                                    value={meetingFormData.title}
                                    onChange={(e) => setMeetingFormData({ ...meetingFormData, title: e.target.value })}
                                    className="w-full text-base font-bold text-slate-900 border border-slate-200 rounded-2xl p-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-white"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* 2. Peserta Rapat (Pencarian Ceklis & Hasil Ceklis) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <i className="fa-solid fa-users text-emerald-600"></i>
                                        <span>Peserta Rapat <span className="text-slate-400 font-normal">(Pencarian & Ceklis Peserta)</span></span>
                                    </label>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllAttendees}
                                            className="text-emerald-700 font-bold hover:underline cursor-pointer"
                                        >
                                            Pilih Semua
                                        </button>
                                        <span className="text-slate-300">•</span>
                                        <button
                                            type="button"
                                            onClick={handleClearAllAttendees}
                                            className="text-slate-500 font-medium hover:underline cursor-pointer"
                                        >
                                            Bersihkan
                                        </button>
                                    </div>
                                </div>

                                {/* HASIL PESERTA YANG DI CEKLIS (Chips) */}
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                            Hasil Peserta Terpilih ({selectedAttendeesList.length} orang):
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 min-h-[36px] items-center">
                                        {selectedAttendeesList.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic">
                                                Belum ada peserta yang diceklis. Silakan cari dan beri tanda centang (✓) pada daftar di bawah.
                                            </span>
                                        ) : (
                                            selectedAttendeesList.map(m => (
                                                <span
                                                    key={m.id}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-xs animate-fade-in"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                    <span>{m.name}</span>
                                                    {m.division && <span className="text-[10px] text-emerald-600 font-normal">({m.division})</span>}
                                                    {m.id === activeUserId && <span className="text-[10px] text-emerald-700 font-bold">(Saya)</span>}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleMeetingAttendee(m.id)}
                                                        className="text-emerald-500 hover:text-emerald-800 ml-1 rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-emerald-200/60 transition cursor-pointer"
                                                        title="Hapus peserta"
                                                    >
                                                        <i className="fa-solid fa-xmark text-[10px]"></i>
                                                    </button>
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* PENCARIAN CEKLIS PESERTA */}
                                <div className="space-y-1.5">
                                    <div className="relative">
                                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                        <input
                                            type="text"
                                            placeholder="Ketik untuk mencari nama peserta, divisi, atau role..."
                                            value={attendeeSearch}
                                            onChange={(e) => setAttendeeSearch(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                        />
                                        {attendeeSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setAttendeeSearch('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                <i className="fa-solid fa-xmark text-xs"></i>
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-44 overflow-y-auto space-y-1 p-2 bg-slate-50/60 rounded-2xl border border-slate-200/80 custom-scrollbar">
                                        {filteredMembersForMeeting.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-4">
                                                Tidak ada anggota yang cocok dengan &quot;{attendeeSearch}&quot;
                                            </p>
                                        ) : (
                                            filteredMembersForMeeting.map(m => {
                                                const isChecked = meetingFormData.attendees.includes(m.id);
                                                return (
                                                    <label
                                                        key={m.id}
                                                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition border ${
                                                            isChecked
                                                                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-semibold shadow-xs'
                                                                : 'bg-white border-slate-200/60 hover:bg-slate-100/70 text-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs"
                                                                style={{ backgroundColor: m.color || '#10b981' }}
                                                            >
                                                                {m.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs leading-tight">
                                                                    {m.name} {m.id === activeUserId && <span className="text-[10px] text-emerald-600 font-bold">(Saya)</span>}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 font-normal">
                                                                    {m.division || 'Divisi'} • {m.role || 'Staff'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleMeetingAttendee(m.id)}
                                                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 3. Pembahasan */}
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-list-check text-emerald-600"></i>
                                    <span>Pembahasan / Agenda Rapat <span className="text-rose-500">*</span></span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Tuliskan pokok agenda atau pembahasan rapat (contoh: 1. Evaluasi penjualan, 2. Rencana kampanye baru)..."
                                    value={meetingFormData.agenda}
                                    onChange={(e) => setMeetingFormData({ ...meetingFormData, agenda: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 leading-relaxed"
                                    required
                                />
                            </div>

                            {/* 4. Waktu Pelaksanaan & Info Pendukung */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                                <div>
                                    <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                                        <i className="fa-regular fa-clock text-emerald-600"></i>
                                        <span>Waktu Pelaksanaan <span className="text-rose-500">*</span></span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={meetingFormData.meetingDate}
                                        onChange={(e) => setMeetingFormData({ ...meetingFormData, meetingDate: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 font-medium focus:outline-none focus:border-emerald-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1.5 flex items-center gap-1.5">
                                        <i className="fa-solid fa-location-dot text-rose-500"></i>
                                        <span>Lokasi / Link Meeting</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ruang Rapat 2 / Google Meet"
                                        value={meetingFormData.location}
                                        onChange={(e) => setMeetingFormData({ ...meetingFormData, location: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-600 font-semibold mb-1.5 flex items-center gap-1.5">
                                        <i className="fa-regular fa-folder text-indigo-500"></i>
                                        <span>Terkait Proyek</span>
                                    </label>
                                    <select
                                        value={meetingFormData.projectId}
                                        onChange={(e) => setMeetingFormData({ ...meetingFormData, projectId: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                                    >
                                        <option value="">-- Tanpa Proyek Khusus --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* 5. Poin-poin diisi setelahnya banner */}
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 flex items-start gap-3 text-xs text-emerald-950">
                                <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                    <i className="fa-solid fa-table-list text-sm"></i>
                                </span>
                                <div className="flex-1">
                                    <p className="font-bold text-emerald-900">Poin-poin & Keputusan Rapat Diisi Setelahnya</p>
                                    <p className="text-emerald-700/90 text-[11px] mt-0.5">
                                        Setelah notulen disimpan, lembar tabel interaktif rapat akan langsung terbuka untuk mencatat butir bahasan, keputusan, PIC penanggung jawab, dan batas waktu pelaksanaan.
                                    </p>
                                </div>
                            </div>

                            {/* Submit and Cancel */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingMeeting(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200 transition active:scale-95 flex items-center gap-2"
                                >
                                    <span>{meetingFormData.id ? 'Simpan Perubahan' : 'Simpan Notulen MoM'}</span>
                                    <i className="fa-solid fa-arrow-right text-[11px]"></i>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: EDIT NOTE MODAL (POST-IT DETAIL EDIT)                            */}
            {/* ========================================================================= */}
            {editingNoteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`rounded-3xl border ${
                        POSTIT_COLORS.find(c => c.id === editingNoteModal.color)?.border || 'border-amber-300'
                    } ${
                        POSTIT_COLORS.find(c => c.id === editingNoteModal.color)?.bg || 'bg-amber-100'
                    } p-6 max-w-lg w-full shadow-2xl flex flex-col`}>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/10 uppercase">
                                Edit Catatan Post-It
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setEditingNoteModal({ ...editingNoteModal, isPinned: !editingNoteModal.isPinned })}
                                    className={`p-1.5 rounded-xl text-xs transition ${
                                        editingNoteModal.isPinned ? 'bg-amber-500 text-white' : 'text-slate-500 hover:bg-black/5'
                                    }`}
                                    title={editingNoteModal.isPinned ? "Lepas pin" : "Sematkan pin"}
                                >
                                    <i className="fa-solid fa-thumbtack"></i>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditingNoteModal(null)}
                                    className="w-7 h-7 rounded-full text-slate-500 hover:bg-black/5 flex items-center justify-center"
                                >
                                    <i className="fa-solid fa-xmark text-sm"></i>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSaveEditingNoteModal} className="space-y-4">
                            <input
                                type="text"
                                placeholder="Judul catatan..."
                                value={editingNoteModal.title || ''}
                                onChange={(e) => setEditingNoteModal({ ...editingNoteModal, title: e.target.value })}
                                className="w-full text-lg font-bold text-slate-900 bg-transparent placeholder-slate-400 focus:outline-none"
                            />

                            <textarea
                                rows={6}
                                placeholder="Tulis isi catatan..."
                                value={editingNoteModal.content || ''}
                                onChange={(e) => setEditingNoteModal({ ...editingNoteModal, content: e.target.value })}
                                className="w-full text-xs text-slate-800 bg-transparent placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
                            />

                            {/* Color Picker Palette */}
                            <div className="flex items-center justify-between pt-3 border-t border-black/10">
                                <div className="flex items-center gap-1 bg-white/60 p-1 rounded-xl border border-black/5">
                                    {POSTIT_COLORS.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setEditingNoteModal({ ...editingNoteModal, color: c.id })}
                                            className={`w-5 h-5 rounded-full ${c.dot} border transition transform hover:scale-110 ${
                                                editingNoteModal.color === c.id ? 'ring-2 ring-slate-800 scale-110' : 'border-black/10'
                                            }`}
                                            title={c.name}
                                        />
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingNoteModal(null)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-black/5 transition"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs"
                                    >
                                        Simpan
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 4: SHARE MODAL (BAGIKAN AKSES POST-IT ATAU MOM)                     */}
            {/* ========================================================================= */}
            {sharingTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-md w-full flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <i className="fa-solid fa-users text-indigo-600"></i>
                                    <span>{sharingTarget.type === 'mom' ? 'Bagikan Notulen Rapat' : 'Bagikan Catatan Post-It'}</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Pilih anggota tim yang diizinkan melihat dan berkolaborasi.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSharingTarget(null)}
                                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Quick Selection Buttons */}
                        <div className="flex items-center justify-between mb-3 text-xs">
                            <span className="font-semibold text-slate-600">
                                {sharingSelectedIds.length} dari {members.length} anggota dipilih
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAllShare}
                                    className="text-indigo-600 font-bold hover:underline"
                                >
                                    Pilih Semua
                                </button>
                                <span className="text-slate-300">•</span>
                                <button
                                    type="button"
                                    onClick={handleClearAllShare}
                                    className="text-slate-500 font-medium hover:underline"
                                >
                                    Hapus Semua
                                </button>
                            </div>
                        </div>

                        {/* Members Checklist */}
                        <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200/80 custom-scrollbar">
                            {members.map(member => {
                                const isChecked = sharingSelectedIds.includes(member.id);
                                const isSelf = member.id === activeUserId;
                                return (
                                    <label
                                        key={member.id}
                                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition border ${
                                            isChecked
                                                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 font-semibold'
                                                : 'bg-white border-slate-200/60 hover:bg-slate-100/70 text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                                {member.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-xs leading-tight">
                                                    {member.name} {isSelf && <span className="text-[10px] text-indigo-600 font-bold">(Saya)</span>}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-normal">
                                                    {member.division || 'Divisi'} • {member.position || member.role || 'Staff'}
                                                </p>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleShareMember(member.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </label>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setSharingTarget(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (sharingTarget.type === 'draft_note') {
                                        setNewNoteDraft({ ...newNoteDraft, sharedWith: sharingSelectedIds });
                                        setSharingTarget(null);
                                    } else {
                                        handleSaveSharing();
                                    }
                                }}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95"
                            >
                                Simpan Pembagian
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------
// SUBCOMPONENT: POST-IT STICKY NOTE CARD
// ----------------------------------------------------
function PostItCard({
    note,
    members,
    activeUserId,
    isSuperUser,
    onTogglePin,
    onChangeColor,
    onOpenShare,
    onOpenEdit,
    onDelete
}) {
    const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
    const colorTheme = POSTIT_COLORS.find(c => c.id === note.color) || POSTIT_COLORS[0];

    const isOwner = (note.picId || note.pic_id) === activeUserId;
    const authorMember = members.find(m => m.id === (note.picId || note.pic_id));
    const sharedList = Array.isArray(note.sharedWith)
        ? note.sharedWith
        : (Array.isArray(note.attendees) ? note.attendees : []);

    const dateDisplay = note.created_at || note.createdAt
        ? new Date(note.created_at || note.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
        : '';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`rounded-3xl border ${colorTheme.border} ${colorTheme.bg} ${colorTheme.shadow} p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative`}
        >
            {/* Card Header */}
            <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h4
                        onClick={onOpenEdit}
                        className="text-sm font-bold text-slate-900 leading-snug cursor-pointer hover:opacity-80 transition line-clamp-2"
                    >
                        {note.title || 'Catatan'}
                    </h4>
                    <button
                        type="button"
                        onClick={onTogglePin}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition ${
                            note.isPinned
                                ? 'text-amber-700 bg-amber-200/70'
                                : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 hover:bg-black/5'
                        }`}
                        title={note.isPinned ? "Lepas pin" : "Sematkan pin"}
                    >
                        <i className="fa-solid fa-thumbtack"></i>
                    </button>
                </div>

                {/* Body Content */}
                <p
                    onClick={onOpenEdit}
                    className="text-xs text-slate-800 whitespace-pre-line leading-relaxed cursor-pointer line-clamp-6"
                >
                    {note.content || '(Catatan kosong)'}
                </p>
            </div>

            {/* Card Footer */}
            <div className="mt-4 pt-3 border-t border-black/10">
                {/* Author & Shared indicator */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                    <span className="flex items-center gap-1 font-medium truncate max-w-[120px]" title={authorMember?.name || 'User'}>
                        <i className="fa-regular fa-user text-[9px]"></i>
                        <span>{authorMember ? (authorMember.id === activeUserId ? 'Saya' : authorMember.name) : 'User'}</span>
                    </span>
                    {sharedList.length > 0 && (
                        <span className="flex items-center gap-1 font-bold text-indigo-700 bg-white/70 px-1.5 py-0.5 rounded-md border border-black/5" title={`Dibagikan ke ${sharedList.length} orang`}>
                            <i className="fa-solid fa-users text-[9px]"></i>
                            <span>{sharedList.length}</span>
                        </span>
                    )}
                </div>

                {/* Action buttons toolbar */}
                <div className="flex items-center justify-between gap-1 pt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                        {/* Change Color Button */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsColorMenuOpen(!isColorMenuOpen); }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-slate-600 hover:bg-black/10 transition"
                            title="Ubah warna Post-It"
                        >
                            <i className="fa-solid fa-palette text-[11px]"></i>
                        </button>

                        {/* Palette Popover */}
                        {isColorMenuOpen && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute bottom-8 left-0 z-30 bg-white rounded-2xl p-1.5 shadow-xl border border-slate-200 flex items-center gap-1 animate-scale-in"
                            >
                                {POSTIT_COLORS.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={(e) => {
                                            onChangeColor(c.id, e);
                                            setIsColorMenuOpen(false);
                                        }}
                                        className={`w-5 h-5 rounded-full ${c.dot} border transition transform hover:scale-110 ${
                                            note.color === c.id ? 'ring-2 ring-slate-800 scale-110' : 'border-black/10'
                                        }`}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Share Button */}
                        <button
                            type="button"
                            onClick={onOpenShare}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-slate-600 hover:bg-black/10 transition"
                            title="Bagikan catatan ini"
                        >
                            <i className="fa-solid fa-user-plus text-[11px]"></i>
                        </button>

                        {/* Edit Button */}
                        <button
                            type="button"
                            onClick={onOpenEdit}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-slate-600 hover:bg-black/10 transition"
                            title="Edit catatan"
                        >
                            <i className="fa-solid fa-pen text-[11px]"></i>
                        </button>

                        {/* Delete Button (Owner or Super User) */}
                        {(isSuperUser || isOwner) && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Hapus catatan"
                            >
                                <i className="fa-regular fa-trash-can text-[11px]"></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
