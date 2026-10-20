import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  fetchInitialData,
  Note,
  Member,
  Role,
  Project,
  MoMActionItem,
  POSTIT_COLORS,
  createNote,
  updateNote,
  deleteNote,
  convertMoMActionItemToTask,
  getAccessibleNotes,
  getAccessibleProjects,
} from '../../../lib/api';

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  yellow: { bg: '#fef9c3', border: '#fef08a', text: '#854d0e', dot: '#facc15' },
  peach: { bg: '#ffedd5', border: '#fed7aa', text: '#9a3412', dot: '#fb923c' },
  mint: { bg: '#dcfce7', border: '#bbf7d0', text: '#166534', dot: '#4ade80' },
  blue: { bg: '#e0f2fe', border: '#bae6fd', text: '#075985', dot: '#38bdf8' },
  purple: { bg: '#f3e8ff', border: '#e9d5ff', text: '#6b21a8', dot: '#c084fc' },
  pink: { bg: '#fce7f3', border: '#fbcfe8', text: '#9d174d', dot: '#f472b6' },
  white: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b', dot: '#94a3b8' },
};

const getTodayDateStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function NotesScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Tab: 'notes' (Post-it) vs 'mom' (Minute of Meeting)
  const [activeTab, setActiveTab] = useState<'notes' | 'mom'>('notes');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ----------------------------------------------------
  // Post-It Modal State
  // ----------------------------------------------------
  const [postItModalVisible, setPostItModalVisible] = useState(false);
  const [editingPostIt, setEditingPostIt] = useState<Note | null>(null);
  const [postItTitle, setPostItTitle] = useState('');
  const [postItContent, setPostItContent] = useState('');
  const [postItColor, setPostItColor] = useState('yellow');
  const [postItPinned, setPostItPinned] = useState(false);
  const [postItSharedWith, setPostItSharedWith] = useState<string[]>([]);
  const [postItMemberSearch, setPostItMemberSearch] = useState('');
  const [savingPostIt, setSavingPostIt] = useState(false);

  // ----------------------------------------------------
  // MoM Detail Modal State
  // ----------------------------------------------------
  const [momDetailVisible, setMomDetailVisible] = useState(false);
  const [selectedMoM, setSelectedMoM] = useState<Note | null>(null);
  const [convertingItemId, setConvertingItemId] = useState<string | null>(null);

  // ----------------------------------------------------
  // MoM Editor Modal State (Create / Edit)
  // ----------------------------------------------------
  const [momEditorVisible, setMomEditorVisible] = useState(false);
  const [editingMoM, setEditingMoM] = useState<Note | null>(null);
  const [momTitle, setMomTitle] = useState('');
  const [momDate, setMomDate] = useState(getTodayDateStr());
  const [momProjectId, setMomProjectId] = useState<string>('');
  const [momLocation, setMomLocation] = useState('');
  const [momAttendees, setMomAttendees] = useState<string[]>([]);
  const [momAgenda, setMomAgenda] = useState('');
  const [momDecision, setMomDecision] = useState('');
  const [momActionItems, setMomActionItems] = useState<MoMActionItem[]>([]);
  const [momAttendeeSearch, setMomAttendeeSearch] = useState('');
  const [savingMoM, setSavingMoM] = useState(false);

  const memberId = session?.memberId;

  const loadData = useCallback(async () => {
    try {
      const res = await fetchInitialData(memberId);
      setNotes(res.notes);
      setMembers(res.members);
      setRoles(res.roles);
      setProjects(res.projects);
    } catch (err) {
      console.error('Failed to load notes data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId]);

  useEffect(() => {
    let isMounted = true;
    fetchInitialData(memberId)
      .then((res) => {
        if (isMounted) {
          setNotes(res.notes);
          setMembers(res.members);
          setRoles(res.roles);
          setProjects(res.projects);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load notes data:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [memberId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const accessibleProjects = useMemo(() => {
    return getAccessibleProjects(projects, session, roles, []);
  }, [projects, session, roles]);

  const accessibleNotes = useMemo(() => {
    return getAccessibleNotes(notes, session, members, roles);
  }, [notes, session, members, roles]);

  const filteredNotes = useMemo(() => {
    return accessibleNotes.filter((n) => {
      const isMoM = n.type === 'mom' || n.type === 'Meeting' || Boolean(n.agenda || n.decision);
      const matchesTab = activeTab === 'mom' ? isMoM : !isMoM;
      if (!matchesTab) return false;

      const owner = n.pic_id || (n as any).author_id;
      const isMine = owner === memberId;
      if (ownershipFilter === 'mine' && !isMine) return false;
      if (ownershipFilter === 'shared' && isMine) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        const agendaMatch = (n.agenda || '').toLowerCase().includes(q);
        const decisionMatch = (n.decision || '').toLowerCase().includes(q);
        if (!titleMatch && !contentMatch && !agendaMatch && !decisionMatch) return false;
      }

      return true;
    });
  }, [accessibleNotes, activeTab, ownershipFilter, memberId, searchQuery]);

  // Sort notes: pinned first, then newest
  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      const tA = new Date(a.created_at || a.updated_at || 0).getTime();
      const tB = new Date(b.created_at || b.updated_at || 0).getTime();
      return tB - tA;
    });
  }, [filteredNotes]);

  // ==============================================================================
  // POST-IT HANDLERS
  // ==============================================================================
  const handleOpenCreatePostIt = () => {
    setEditingPostIt(null);
    setPostItTitle('');
    setPostItContent('');
    setPostItColor('yellow');
    setPostItPinned(false);
    setPostItSharedWith([]);
    setPostItMemberSearch('');
    setPostItModalVisible(true);
  };

  const handleOpenEditPostIt = (note: Note) => {
    setEditingPostIt(note);
    setPostItTitle(note.title || '');
    setPostItContent(note.content || '');
    setPostItColor(note.color || 'yellow');
    setPostItPinned(Boolean(note.is_pinned));
    setPostItSharedWith(Array.isArray(note.attendees) ? note.attendees : []);
    setPostItMemberSearch('');
    setPostItModalVisible(true);
  };

  const handleToggleShareMember = (id: string) => {
    setPostItSharedWith((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSavePostIt = async () => {
    if (!postItTitle.trim() && !postItContent.trim()) {
      Alert.alert('Perhatian', 'Isi judul atau catatan memo sebelum menyimpan.');
      return;
    }

    setSavingPostIt(true);
    try {
      if (editingPostIt) {
        await updateNote(editingPostIt.id, {
          title: postItTitle.trim(),
          content: postItContent.trim(),
          color: postItColor,
          is_pinned: postItPinned,
          attendees: postItSharedWith,
        });

        setNotes((prev) =>
          prev.map((n) =>
            n.id === editingPostIt.id
              ? {
                  ...n,
                  title: postItTitle.trim(),
                  content: postItContent.trim(),
                  color: postItColor,
                  is_pinned: postItPinned,
                  attendees: postItSharedWith,
                  updated_at: new Date().toISOString(),
                }
              : n
          )
        );
      } else {
        const created = await createNote({
          type: 'note',
          title: postItTitle.trim(),
          content: postItContent.trim(),
          color: postItColor,
          is_pinned: postItPinned,
          pic_id: memberId,
          attendees: postItSharedWith,
        });

        setNotes((prev) => [created, ...prev]);
      }

      setPostItModalVisible(false);
    } catch (err: any) {
      console.error('Error saving post-it:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSavingPostIt(false);
    }
  };

  const handleDeletePostIt = (note: Note) => {
    Alert.alert('Hapus Memo', `Apakah Anda yakin ingin menghapus memo "${note.title || 'Memo'}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(note.id);
            setNotes((prev) => prev.filter((n) => n.id !== note.id));
            setPostItModalVisible(false);
          } catch (err: any) {
            Alert.alert('Gagal Menghapus', err.message);
          }
        },
      },
    ]);
  };

  // ==============================================================================
  // MoM HANDLERS
  // ==============================================================================
  const handleOpenMoMDetail = (mom: Note) => {
    setSelectedMoM(mom);
    setMomDetailVisible(true);
  };

  const handleOpenCreateMoM = () => {
    setEditingMoM(null);
    setMomTitle('');
    setMomDate(getTodayDateStr());
    setMomProjectId(accessibleProjects[0]?.id || '');
    setMomLocation('');
    setMomAttendees(memberId ? [memberId] : []);
    setMomAgenda('');
    setMomDecision('');
    setMomActionItems([]);
    setMomAttendeeSearch('');
    setMomEditorVisible(true);
  };

  const handleOpenEditMoM = (mom: Note) => {
    setEditingMoM(mom);
    setMomTitle(mom.title || '');
    setMomDate(mom.meeting_date ? mom.meeting_date.split('T')[0] : getTodayDateStr());
    setMomProjectId(mom.project_id || accessibleProjects[0]?.id || '');
    setMomLocation(mom.location || '');
    setMomAttendees(Array.isArray(mom.attendees) ? mom.attendees : []);
    setMomAgenda(mom.agenda || '');
    setMomDecision(mom.decision || '');
    setMomActionItems(Array.isArray(mom.action_items) ? mom.action_items : []);
    setMomAttendeeSearch('');
    setMomEditorVisible(true);
  };

  const handleAddActionItemRow = () => {
    const newItem: MoMActionItem = {
      id: 'act_' + Date.now(),
      issue: '',
      decision: '',
      picId: memberId || '',
      deadline: getTodayDateStr(),
      done: false,
    };
    setMomActionItems((prev) => [...prev, newItem]);
  };

  const handleUpdateActionItemField = (index: number, field: keyof MoMActionItem, value: any) => {
    setMomActionItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveActionItemRow = (index: number) => {
    setMomActionItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveMoM = async () => {
    if (!momTitle.trim()) {
      Alert.alert('Perhatian', 'Judul rapat wajib diisi.');
      return;
    }

    setSavingMoM(true);
    try {
      // Filter out empty action items
      const validActionItems = momActionItems.filter(
        (it) => it.decision?.trim() || it.issue?.trim()
      );

      if (editingMoM) {
        await updateNote(editingMoM.id, {
          type: 'Meeting',
          title: momTitle.trim(),
          meeting_date: momDate,
          project_id: momProjectId || null,
          location: momLocation.trim() || null,
          attendees: momAttendees,
          agenda: momAgenda.trim() || null,
          decision: momDecision.trim() || null,
          action_items: validActionItems,
        });

        const updatedNote: Note = {
          ...editingMoM,
          title: momTitle.trim(),
          meeting_date: momDate,
          project_id: momProjectId || null,
          location: momLocation.trim() || '',
          attendees: momAttendees,
          agenda: momAgenda.trim() || '',
          decision: momDecision.trim() || '',
          action_items: validActionItems,
          updated_at: new Date().toISOString(),
        };

        setNotes((prev) => prev.map((n) => (n.id === editingMoM.id ? updatedNote : n)));
        if (selectedMoM && selectedMoM.id === editingMoM.id) {
          setSelectedMoM(updatedNote);
        }
      } else {
        const created = await createNote({
          type: 'Meeting',
          title: momTitle.trim(),
          meeting_date: momDate,
          project_id: momProjectId || null,
          location: momLocation.trim() || null,
          pic_id: memberId,
          attendees: momAttendees,
          agenda: momAgenda.trim() || null,
          decision: momDecision.trim() || null,
          action_items: validActionItems,
        });

        setNotes((prev) => [created, ...prev]);
      }

      setMomEditorVisible(false);
    } catch (err: any) {
      console.error('Error saving MoM:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSavingMoM(false);
    }
  };

  const handleDeleteMoM = (mom: Note) => {
    Alert.alert('Hapus Notulen', `Apakah Anda yakin ingin menghapus notulen "${mom.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(mom.id);
            setNotes((prev) => prev.filter((n) => n.id !== mom.id));
            setMomDetailVisible(false);
          } catch (err: any) {
            Alert.alert('Gagal Menghapus', err.message);
          }
        },
      },
    ]);
  };

  // Toggle action item done directly from MoM detail modal
  const handleToggleMoMDetailActionDone = async (itemId: string) => {
    if (!selectedMoM) return;
    const currentItems: MoMActionItem[] = Array.isArray(selectedMoM.action_items)
      ? [...selectedMoM.action_items]
      : [];

    const updatedItems = currentItems.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    const updatedMeeting: Note = {
      ...selectedMoM,
      action_items: updatedItems,
    };

    setSelectedMoM(updatedMeeting);
    setNotes((prev) => prev.map((n) => (n.id === selectedMoM.id ? updatedMeeting : n)));

    try {
      await updateNote(selectedMoM.id, {
        action_items: updatedItems,
      });
    } catch (err: any) {
      console.error('Failed to toggle action item status:', err);
    }
  };

  // Convert MoM Action Item to a Project Task
  const handleConvertActionItemToTask = async (item: MoMActionItem) => {
    if (!selectedMoM) return;
    if (!selectedMoM.project_id) {
      Alert.alert(
        'Workspace Belum Ditentukan',
        'Notulen rapat ini belum ditautkan ke Proyek / Workspace. Edit notulen terlebih dahulu untuk memilih workspace.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Edit Notulen',
            onPress: () => {
              setMomDetailVisible(false);
              handleOpenEditMoM(selectedMoM);
            },
          },
        ]
      );
      return;
    }

    setConvertingItemId(item.id);
    try {
      const createdTask = await convertMoMActionItemToTask({
        meeting: selectedMoM,
        actionItem: item,
        activeUserId: memberId || '',
        activeUserName: session?.name || 'User',
      });

      // Update local state
      const currentItems: MoMActionItem[] = Array.isArray(selectedMoM.action_items)
        ? [...selectedMoM.action_items]
        : [];
      const updatedItems = currentItems.map((it) =>
        it.id === item.id ? { ...it, convertedToTaskId: createdTask.id } : it
      );

      const updatedMoM: Note = {
        ...selectedMoM,
        action_items: updatedItems,
      };

      setSelectedMoM(updatedMoM);
      setNotes((prev) => prev.map((n) => (n.id === selectedMoM.id ? updatedMoM : n)));

      Alert.alert('Sukses', `Tindak lanjut berhasil dikonversi menjadi Tugas: "${createdTask.title}"!`);
    } catch (err: any) {
      console.error('Conversion error:', err);
      Alert.alert('Gagal Mengonversi', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setConvertingItemId(null);
    }
  };

  // ==============================================================================
  // RENDER CARD POST-IT
  // ==============================================================================
  const renderPostItCard = ({ item }: { item: Note }) => {
    const theme = COLOR_MAP[item.color || 'yellow'] || COLOR_MAP.yellow;
    const isMine = (item.pic_id || (item as any).author_id) === memberId;
    const author = item.pic_id ? memberMap.get(item.pic_id) : null;
    const attendees = Array.isArray(item.attendees) ? item.attendees : [];

    return (
      <TouchableOpacity
        style={[styles.postItCard, { backgroundColor: theme.bg, borderColor: theme.border }]}
        onPress={() => handleOpenEditPostIt(item)}
        activeOpacity={0.8}
      >
        <View style={styles.postItHeader}>
          <View style={styles.postItTitleRow}>
            {item.is_pinned && (
              <Ionicons name="pin" size={14} color={theme.text} style={styles.pinIcon} />
            )}
            <Text style={[styles.postItTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title || 'Memo Tanpa Judul'}
            </Text>
          </View>
          <View style={[styles.ownerBadgeMini, isMine ? styles.ownerBadgeMine : styles.ownerBadgeShared]}>
            <Text style={[styles.ownerBadgeMiniText, isMine ? styles.ownerBadgeMineText : styles.ownerBadgeSharedText]}>
              {isMine ? 'Saya' : author ? author.name : 'Dibagikan'}
            </Text>
          </View>
        </View>

        <Text style={[styles.postItContent, { color: theme.text }]} numberOfLines={5}>
          {item.content}
        </Text>

        <View style={styles.postItFooter}>
          {attendees.length > 0 ? (
            <View style={styles.attendeesMiniRow}>
              <Ionicons name="people-outline" size={12} color={theme.text + 'aa'} />
              <Text style={[styles.attendeesMiniText, { color: theme.text + 'aa' }]}>
                {attendees.length} anggota
              </Text>
            </View>
          ) : (
            <View />
          )}

          {item.created_at && (
            <Text style={[styles.dateText, { color: theme.text + '99' }]}>
              {item.created_at.split('T')[0]}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ==============================================================================
  // RENDER CARD MoM
  // ==============================================================================
  const renderMoMCard = ({ item }: { item: Note }) => {
    const pic = item.pic_id ? memberMap.get(item.pic_id) : null;
    const isPic = item.pic_id === memberId;
    const isAttendee = Array.isArray(item.attendees) && item.attendees.includes(memberId || '');
    const proj = item.project_id ? projectMap.get(item.project_id) : null;
    const actionItems: MoMActionItem[] = Array.isArray(item.action_items) ? item.action_items : [];
    const doneActionCount = actionItems.filter((it) => it.done).length;

    return (
      <TouchableOpacity
        style={styles.momCard}
        onPress={() => handleOpenMoMDetail(item)}
        activeOpacity={0.8}
      >
        <View style={styles.momHeader}>
          <View style={styles.momBadgeRow}>
            <View style={styles.momBadge}>
              <Ionicons name="clipboard-outline" size={13} color="#059669" />
              <Text style={styles.momBadgeText}>Minute of Meeting</Text>
            </View>
            <View style={[styles.ownerBadgeMini, isPic ? styles.ownerBadgeMine : styles.ownerBadgeShared]}>
              <Text style={[styles.ownerBadgeMiniText, isPic ? styles.ownerBadgeMineText : styles.ownerBadgeSharedText]}>
                {isPic ? 'PIC Notulen' : isAttendee ? 'Peserta' : 'Akses Rapat'}
              </Text>
            </View>
          </View>
          {item.meeting_date && (
            <Text style={styles.momDate}>{item.meeting_date.split('T')[0]}</Text>
          )}
        </View>

        <Text style={styles.momTitle}>{item.title || 'Rapat Tanpa Judul'}</Text>

        {proj && (
          <View style={styles.momProjectRow}>
            <Ionicons name="folder-outline" size={12} color="#64748b" />
            <Text style={styles.momProjectText}>{proj.name}</Text>
          </View>
        )}

        {item.agenda ? (
          <View style={styles.momSection}>
            <Text style={styles.momSectionLabel}>Agenda:</Text>
            <Text style={styles.momSectionText} numberOfLines={2}>
              {item.agenda}
            </Text>
          </View>
        ) : null}

        {item.decision ? (
          <View style={[styles.momSection, styles.decisionBox]}>
            <Text style={styles.decisionLabel}>Keputusan:</Text>
            <Text style={styles.decisionText} numberOfLines={2}>
              {item.decision}
            </Text>
          </View>
        ) : null}

        {/* Action Items Indicator */}
        {actionItems.length > 0 && (
          <View style={styles.momActionIndicator}>
            <Ionicons name="flash-outline" size={13} color="#0284c7" />
            <Text style={styles.momActionIndicatorText}>
              {actionItems.length} Tindak Lanjut ({doneActionCount} selesai)
            </Text>
          </View>
        )}

        {/* Attendees Row & PIC */}
        <View style={styles.momCardFooter}>
          {item.attendees && item.attendees.length > 0 ? (
            <View style={styles.attendeesRow}>
              {item.attendees.slice(0, 5).map((attId, idx) => {
                const m = memberMap.get(attId);
                const initial = m ? m.name.charAt(0).toUpperCase() : '?';
                return (
                  <View key={idx} style={[styles.avatarCircle, { backgroundColor: m?.color || '#3b82f6' }]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                );
              })}
              {item.attendees.length > 5 && (
                <Text style={styles.moreAttendeesText}>+{item.attendees.length - 5}</Text>
              )}
            </View>
          ) : (
            <View />
          )}

          {pic && <Text style={styles.picFooter}>PIC: {pic.name}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Switcher Tab */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentButton, activeTab === 'notes' && styles.segmentButtonActive]}
          onPress={() => setActiveTab('notes')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={activeTab === 'notes' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.segmentText, activeTab === 'notes' && styles.segmentTextActive]}>
            Post-it Memo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentButton, activeTab === 'mom' && styles.segmentButtonActive]}
          onPress={() => setActiveTab('mom')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="clipboard-outline"
            size={16}
            color={activeTab === 'mom' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.segmentText, activeTab === 'mom' && styles.segmentTextActive]}>
            Minute of Meeting
          </Text>
        </TouchableOpacity>
      </View>

      {/* Ownership Filter Bar: Semua vs Catatan Saya vs Dibagikan */}
      <View style={styles.ownershipBar}>
        <TouchableOpacity
          style={[styles.ownerChip, ownershipFilter === 'all' && styles.ownerChipActive]}
          onPress={() => setOwnershipFilter('all')}
          activeOpacity={0.75}
        >
          <Text style={[styles.ownerText, ownershipFilter === 'all' && styles.ownerTextActive]}>
            Semua
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ownerChip, ownershipFilter === 'mine' && styles.ownerChipActive]}
          onPress={() => setOwnershipFilter('mine')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="person"
            size={12}
            color={ownershipFilter === 'mine' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.ownerText, ownershipFilter === 'mine' && styles.ownerTextActive]}>
            Milik Saya
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ownerChip, ownershipFilter === 'shared' && styles.ownerChipActive]}
          onPress={() => setOwnershipFilter('shared')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="share-social-outline"
            size={12}
            color={ownershipFilter === 'shared' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.ownerText, ownershipFilter === 'shared' && styles.ownerTextActive]}>
            Dibagikan ke Saya
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'notes' ? 'Cari memo post-it...' : 'Cari notulen rapat atau topik agenda...'}
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Notes List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#db2777" />
        </View>
      ) : (
        <FlatList
          data={sortedNotes}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'notes' ? renderPostItCard : renderMoMCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#db2777']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'notes' ? 'document-text-outline' : 'clipboard-outline'}
                size={48}
                color="#cbd5e1"
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'notes' ? 'Belum ada memo' : 'Belum ada notulen MoM'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'notes'
                  ? 'Gunakan tombol + di bawah untuk membuat memo post-it baru.'
                  : 'Gunakan tombol + di bawah untuk membuat notulen rapat MoM baru.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={activeTab === 'notes' ? handleOpenCreatePostIt : handleOpenCreateMoM}
        activeOpacity={0.85}
      >
        <Ionicons
          name={activeTab === 'notes' ? 'add' : 'add-outline'}
          size={22}
          color="#ffffff"
        />
        <Text style={styles.fabText}>
          {activeTab === 'notes' ? 'Memo Baru' : 'Buat MoM'}
        </Text>
      </TouchableOpacity>

      {/* ============================================================================== */}
      {/* MODAL: POST-IT MEMO (CREATE / EDIT) */}
      {/* ============================================================================== */}
      <Modal
        visible={postItModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPostItModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalFlex}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPostItModalVisible(false)}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingPostIt ? 'Edit Memo' : 'Memo Post-it Baru'}
            </Text>
            <TouchableOpacity
              onPress={handleSavePostIt}
              disabled={savingPostIt}
              style={[styles.modalSaveBtn, savingPostIt && styles.btnDisabled]}
            >
              {savingPostIt ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollBody}>
            {/* Color Swatches */}
            <Text style={styles.fieldLabel}>Warna Catatan</Text>
            <View style={styles.colorPaletteRow}>
              {POSTIT_COLORS.map((col) => {
                const isSelected = postItColor === col.id;
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: col.bg, borderColor: col.border },
                      isSelected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => setPostItColor(col.id)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={col.text} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pin Toggle */}
            <TouchableOpacity
              style={[styles.pinToggleRow, postItPinned && styles.pinToggleRowActive]}
              onPress={() => setPostItPinned(!postItPinned)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={postItPinned ? 'pin' : 'pin-outline'}
                size={18}
                color={postItPinned ? '#db2777' : '#64748b'}
              />
              <Text style={[styles.pinToggleText, postItPinned && styles.pinToggleTextActive]}>
                {postItPinned ? 'Disematkan di Atas (Pinned)' : 'Sematkan Memo ke Atas'}
              </Text>
            </TouchableOpacity>

            {/* Title Input */}
            <Text style={styles.fieldLabel}>Judul Memo</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: Ide campaign, To-do cepat..."
              placeholderTextColor="#94a3b8"
              value={postItTitle}
              onChangeText={setPostItTitle}
            />

            {/* Content Input */}
            <Text style={styles.fieldLabel}>Isi Catatan</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="Tuliskan catatan atau ide di sini..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={postItContent}
              onChangeText={setPostItContent}
            />

            {/* Sharing with Members */}
            <Text style={styles.fieldLabel}>
              Bagikan ke Anggota Tim ({postItSharedWith.length} dipilih)
            </Text>
            <TextInput
              style={styles.searchMiniInput}
              placeholder="Cari anggota tim..."
              placeholderTextColor="#94a3b8"
              value={postItMemberSearch}
              onChangeText={setPostItMemberSearch}
            />
            <View style={styles.memberChipsWrap}>
              {members
                .filter((m) => m.id !== memberId)
                .filter((m) =>
                  postItMemberSearch.trim()
                    ? m.name.toLowerCase().includes(postItMemberSearch.toLowerCase())
                    : true
                )
                .slice(0, 15)
                .map((m) => {
                  const isSelected = postItSharedWith.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.memberChip, isSelected && styles.memberChipSelected]}
                      onPress={() => handleToggleShareMember(m.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.avatarTiny,
                          { backgroundColor: m.color || '#3b82f6' },
                        ]}
                      >
                        <Text style={styles.avatarTinyText}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.memberChipText, isSelected && styles.memberChipTextSelected]}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            {/* Delete button (if editing) */}
            {editingPostIt && (
              <TouchableOpacity
                style={styles.deleteNoteBtn}
                onPress={() => handleDeletePostIt(editingPostIt)}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.deleteNoteBtnText}>Hapus Memo Ini</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL: DETAIL NOTULEN RAPAT (MoM DETAIL) */}
      {/* ============================================================================== */}
      <Modal
        visible={momDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMomDetailVisible(false)}
      >
        <View style={styles.modalFlex}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMomDetailVisible(false)}>
              <Text style={styles.modalCancelText}>Tutup</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Detail Notulen MoM</Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedMoM) {
                  setMomDetailVisible(false);
                  handleOpenEditMoM(selectedMoM);
                }
              }}
            >
              <Text style={styles.modalEditText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {selectedMoM && (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollBody}>
              {/* MoM Meta Info */}
              <View style={styles.momDetailMetaBox}>
                <View style={styles.momBadge}>
                  <Ionicons name="clipboard-outline" size={14} color="#059669" />
                  <Text style={styles.momBadgeText}>Minute of Meeting</Text>
                </View>
                <Text style={styles.momDetailTitle}>{selectedMoM.title}</Text>

                <View style={styles.momMetaGrid}>
                  {selectedMoM.meeting_date && (
                    <View style={styles.momMetaItem}>
                      <Ionicons name="calendar-outline" size={14} color="#64748b" />
                      <Text style={styles.momMetaItemText}>
                        {selectedMoM.meeting_date.split('T')[0]}
                      </Text>
                    </View>
                  )}
                  {selectedMoM.location && (
                    <View style={styles.momMetaItem}>
                      <Ionicons name="location-outline" size={14} color="#64748b" />
                      <Text style={styles.momMetaItemText}>{selectedMoM.location}</Text>
                    </View>
                  )}
                  {selectedMoM.project_id && (
                    <View style={styles.momMetaItem}>
                      <Ionicons name="folder-outline" size={14} color="#64748b" />
                      <Text style={styles.momMetaItemText}>
                        {projectMap.get(selectedMoM.project_id)?.name || 'Proyek'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Attendees */}
              <View style={styles.detailSectionBox}>
                <Text style={styles.detailSectionHeading}>
                  Peserta Rapat ({Array.isArray(selectedMoM.attendees) ? selectedMoM.attendees.length : 0})
                </Text>
                <View style={styles.attendeesTagsWrap}>
                  {Array.isArray(selectedMoM.attendees) && selectedMoM.attendees.length > 0 ? (
                    selectedMoM.attendees.map((attId, idx) => {
                      const m = memberMap.get(attId);
                      return (
                        <View key={idx} style={styles.attendeeTag}>
                          <View
                            style={[
                              styles.avatarTiny,
                              { backgroundColor: m?.color || '#3b82f6' },
                            ]}
                          >
                            <Text style={styles.avatarTinyText}>
                              {m ? m.name.charAt(0).toUpperCase() : '?'}
                            </Text>
                          </View>
                          <Text style={styles.attendeeTagName}>{m ? m.name : 'Anggota'}</Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptySectionText}>Tidak ada daftar peserta</Text>
                  )}
                </View>
              </View>

              {/* Agenda */}
              {selectedMoM.agenda ? (
                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionHeading}>Agenda Pembahasan</Text>
                  <Text style={styles.detailSectionBody}>{selectedMoM.agenda}</Text>
                </View>
              ) : null}

              {/* Decision */}
              {selectedMoM.decision ? (
                <View style={[styles.detailSectionBox, styles.decisionDetailBox]}>
                  <Text style={styles.decisionDetailHeading}>Hasil & Keputusan Rapat</Text>
                  <Text style={styles.decisionDetailBody}>{selectedMoM.decision}</Text>
                </View>
              ) : null}

              {/* Action Items List */}
              <View style={styles.detailSectionBox}>
                <View style={styles.actionItemsHeaderRow}>
                  <Text style={styles.detailSectionHeading}>
                    Tindak Lanjut & Action Items ({Array.isArray(selectedMoM.action_items) ? selectedMoM.action_items.length : 0})
                  </Text>
                </View>

                {Array.isArray(selectedMoM.action_items) && selectedMoM.action_items.length > 0 ? (
                  <View style={styles.actionItemsList}>
                    {selectedMoM.action_items.map((item, idx) => {
                      const pic = item.picId ? memberMap.get(item.picId) : null;
                      const isConverting = convertingItemId === item.id;
                      const hasTask = Boolean(item.convertedToTaskId);

                      return (
                        <View
                          key={item.id || idx}
                          style={[styles.actionItemCard, item.done && styles.actionItemCardDone]}
                        >
                          <View style={styles.actionItemTop}>
                            <TouchableOpacity
                              style={[styles.actionCheckbox, item.done && styles.actionCheckboxDone]}
                              onPress={() => handleToggleMoMDetailActionDone(item.id)}
                            >
                              {item.done && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                            </TouchableOpacity>

                            <View style={styles.actionItemContent}>
                              {item.issue ? (
                                <Text style={styles.actionItemIssue}>{item.issue}</Text>
                              ) : null}
                              <Text
                                style={[
                                  styles.actionItemDecision,
                                  item.done && styles.actionItemDecisionDone,
                                ]}
                              >
                                {item.decision || item.issue || 'Tanpa deskripsi'}
                              </Text>

                              <View style={styles.actionItemMetaRow}>
                                {pic && (
                                  <View style={styles.actionItemPic}>
                                    <Ionicons name="person-outline" size={11} color="#64748b" />
                                    <Text style={styles.actionItemPicText}>{pic.name}</Text>
                                  </View>
                                )}
                                {item.deadline && (
                                  <View style={styles.actionItemDeadline}>
                                    <Ionicons name="calendar-outline" size={11} color="#64748b" />
                                    <Text style={styles.actionItemDeadlineText}>
                                      {item.deadline}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>

                          {/* Task Conversion Button / Badge */}
                          <View style={styles.actionItemBottom}>
                            {hasTask ? (
                              <View style={styles.taskCreatedBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                                <Text style={styles.taskCreatedBadgeText}>Ditautkan ke Task</Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.convertToTaskBtn}
                                onPress={() => handleConvertActionItemToTask(item)}
                                disabled={isConverting}
                                activeOpacity={0.8}
                              >
                                {isConverting ? (
                                  <ActivityIndicator size="small" color="#0284c7" />
                                ) : (
                                  <>
                                    <Ionicons name="flash" size={12} color="#0284c7" />
                                    <Text style={styles.convertToTaskBtnText}>Jadikan Task Proyek</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptySectionText}>
                    Belum ada tindak lanjut (action items) yang dicatat.
                  </Text>
                )}
              </View>

              {/* Delete MoM Button */}
              <TouchableOpacity
                style={styles.deleteNoteBtn}
                onPress={() => handleDeleteMoM(selectedMoM)}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.deleteNoteBtnText}>Hapus Notulen Rapat Ini</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL: MoM EDITOR (CREATE / EDIT) */}
      {/* ============================================================================== */}
      <Modal
        visible={momEditorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMomEditorVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalFlex}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMomEditorVisible(false)}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingMoM ? 'Edit Notulen Rapat' : 'Buat Notulen MoM'}
            </Text>
            <TouchableOpacity
              onPress={handleSaveMoM}
              disabled={savingMoM}
              style={[styles.modalSaveBtn, savingMoM && styles.btnDisabled]}
            >
              {savingMoM ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Simpan</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollBody}>
            {/* Title */}
            <Text style={styles.fieldLabel}>Judul Rapat *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Contoh: Rapat Koordinasi Mingguan, Evaluasi Project..."
              placeholderTextColor="#94a3b8"
              value={momTitle}
              onChangeText={setMomTitle}
            />

            {/* Date & Location */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>Tanggal Rapat</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={momDate}
                  onChangeText={setMomDate}
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>Ruang / Tautan</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Meeting Room / GMeet"
                  placeholderTextColor="#94a3b8"
                  value={momLocation}
                  onChangeText={setMomLocation}
                />
              </View>
            </View>

            {/* Workspace / Project Selection */}
            <Text style={styles.fieldLabel}>Workspace / Proyek Terkait</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projScroll}>
              {accessibleProjects.map((p) => {
                const isSelected = momProjectId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.projChip, isSelected && styles.projChipSelected]}
                    onPress={() => setMomProjectId(p.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.projDot, { backgroundColor: p.color || '#3b82f6' }]} />
                    <Text style={[styles.projChipText, isSelected && styles.projChipTextSelected]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Attendees Multi-select */}
            <Text style={styles.fieldLabel}>
              Peserta Hadir ({momAttendees.length} dipilih)
            </Text>
            <TextInput
              style={styles.searchMiniInput}
              placeholder="Cari peserta rapat..."
              placeholderTextColor="#94a3b8"
              value={momAttendeeSearch}
              onChangeText={setMomAttendeeSearch}
            />
            <View style={styles.memberChipsWrap}>
              {members
                .filter((m) =>
                  momAttendeeSearch.trim()
                    ? m.name.toLowerCase().includes(momAttendeeSearch.toLowerCase())
                    : true
                )
                .slice(0, 15)
                .map((m) => {
                  const isSelected = momAttendees.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.memberChip, isSelected && styles.memberChipSelected]}
                      onPress={() => {
                        setMomAttendees((prev) =>
                          prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatarTiny, { backgroundColor: m.color || '#3b82f6' }]}>
                        <Text style={styles.avatarTinyText}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.memberChipText, isSelected && styles.memberChipTextSelected]}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>

            {/* Agenda Textarea */}
            <Text style={styles.fieldLabel}>Agenda Pembahasan</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="Tuliskan pokok agenda yang dibahas pada rapat ini..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={momAgenda}
              onChangeText={setMomAgenda}
            />

            {/* Decision Textarea */}
            <Text style={styles.fieldLabel}>Hasil & Keputusan Rapat</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="Tuliskan kesimpulan dan keputusan resmi rapat..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={momDecision}
              onChangeText={setMomDecision}
            />

            {/* Action Items Dynamic Builder */}
            <View style={styles.actionItemsBuilderHeader}>
              <Text style={styles.fieldLabel}>Tindak Lanjut & Action Items ({momActionItems.length})</Text>
              <TouchableOpacity
                style={styles.addActionButton}
                onPress={handleAddActionItemRow}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={16} color="#db2777" />
                <Text style={styles.addActionButtonText}>Tambah Baris</Text>
              </TouchableOpacity>
            </View>

            {momActionItems.map((item, index) => (
              <View key={item.id || index} style={styles.actionItemEditCard}>
                <View style={styles.actionItemEditTop}>
                  <Text style={styles.actionItemNumber}>#{index + 1}</Text>
                  <TouchableOpacity onPress={() => handleRemoveActionItemRow(index)}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.actionItemInput}
                  placeholder="Topik / Isu (misal: Follow-up Vendor)..."
                  placeholderTextColor="#94a3b8"
                  value={item.issue}
                  onChangeText={(val) => handleUpdateActionItemField(index, 'issue', val)}
                />

                <TextInput
                  style={styles.actionItemInput}
                  placeholder="Keputusan / Tindakan (misal: Konfirmasi deadline kontrak)..."
                  placeholderTextColor="#94a3b8"
                  value={item.decision}
                  onChangeText={(val) => handleUpdateActionItemField(index, 'decision', val)}
                />

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.subFieldLabel}>Deadline</Text>
                    <TextInput
                      style={styles.actionItemInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                      value={item.deadline}
                      onChangeText={(val) => handleUpdateActionItemField(index, 'deadline', val)}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.subFieldLabel}>PIC Pelaksana</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {members.slice(0, 8).map((m) => {
                        const isPic = item.picId === m.id;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[styles.picMiniChip, isPic && styles.picMiniChipSelected]}
                            onPress={() => handleUpdateActionItemField(index, 'picId', m.id)}
                          >
                            <Text style={[styles.picMiniChipText, isPic && styles.picMiniChipTextSelected]}>
                              {m.name.split(' ')[0]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#db2777',
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  ownershipBar: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  ownerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ownerChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  ownerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  ownerTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    gap: 12,
  },
  postItCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  postItHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  postItTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pinIcon: {
    transform: [{ rotate: '45deg' }],
  },
  postItTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  ownerBadgeMini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadgeMine: {
    backgroundColor: '#dbeafe',
  },
  ownerBadgeShared: {
    backgroundColor: '#f1f5f9',
  },
  ownerBadgeMiniText: {
    fontSize: 9,
  },
  ownerBadgeMineText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  ownerBadgeSharedText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  postItContent: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  postItFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
  },
  attendeesMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attendeesMiniText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  momCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  momHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  momBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  momBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  momBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  momDate: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  momTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  momProjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  momProjectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  momSection: {
    marginBottom: 8,
  },
  momSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  momSectionText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  decisionBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  decisionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  decisionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 18,
  },
  momActionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
  },
  momActionIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  momCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  moreAttendeesText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 8,
  },
  picFooter: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#db2777',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },

  // Modal Styles
  modalFlex: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSaveBtn: {
    backgroundColor: '#db2777',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalEditText: {
    color: '#db2777',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalScrollBody: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: -4,
  },
  subFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textAreaInput: {
    minHeight: 90,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#0f172a',
    transform: [{ scale: 1.1 }],
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pinToggleRowActive: {
    backgroundColor: '#fdf2f8',
    borderColor: '#fbcfe8',
  },
  pinToggleText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  pinToggleTextActive: {
    color: '#db2777',
    fontWeight: '700',
  },
  searchMiniInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  memberChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  memberChipSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  memberChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  memberChipTextSelected: {
    color: '#ffffff',
  },
  avatarTiny: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTinyText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  deleteNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteNoteBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },

  // MoM Detail Styles
  momDetailMetaBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  momDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  momMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  momMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  momMetaItemText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  detailSectionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  detailSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailSectionBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  decisionDetailBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  decisionDetailHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  decisionDetailBody: {
    fontSize: 13,
    color: '#14532d',
    lineHeight: 20,
    fontWeight: '600',
  },
  attendeesTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attendeeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  attendeeTagName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  emptySectionText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  actionItemsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionItemsList: {
    gap: 8,
  },
  actionItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  actionItemCardDone: {
    backgroundColor: '#f1f5f9',
    opacity: 0.75,
  },
  actionItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  actionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  actionCheckboxDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  actionItemContent: {
    flex: 1,
    gap: 2,
  },
  actionItemIssue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  actionItemDecision: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  actionItemDecisionDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  actionItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  actionItemPic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionItemPicText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  actionItemDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionItemDeadlineText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  actionItemBottom: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  convertToTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  convertToTaskBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  taskCreatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#ecfdf5',
  },
  taskCreatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },

  // MoM Editor Styles
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  projScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  projChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  projChipSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  projDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  projChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  projChipTextSelected: {
    color: '#ffffff',
  },
  actionItemsBuilderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  addActionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#db2777',
  },
  actionItemEditCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  actionItemEditTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionItemNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  actionItemInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0f172a',
  },
  picMiniChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginRight: 4,
  },
  picMiniChipSelected: {
    backgroundColor: '#0f172a',
  },
  picMiniChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  picMiniChipTextSelected: {
    color: '#ffffff',
  },
});
