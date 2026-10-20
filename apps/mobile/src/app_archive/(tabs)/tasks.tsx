import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import {
  fetchInitialData,
  updateTask,
  Task,
  TaskTodo,
  Project,
  Member,
  Role,
  ProjectAccess,
  canAccessPersonalProject,
  isPersonalProject,
  getDeadlineDiffDays,
  getSubordinatesWithStats,
  createWhatsAppReminderUrl,
  getAccessibleProjects,
  getAccessibleTasks,
} from '../../../lib/api';

// Helper inisial nama
const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
};

export default function TasksScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projectAccess, setProjectAccess] = useState<ProjectAccess[]>([]);

  // Mode Utama: 'my_tasks' (Tugas Saya) | 'subordinates' (Monitoring Bawahan) | 'workspaces' (Semua Project)
  const [mainMode, setMainMode] = useState<'my_tasks' | 'subordinates' | 'workspaces'>('my_tasks');

  // Filter Sub-States Tugas Saya
  const [myFilter, setMyFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'in_progress' | 'todos' | 'done'>('all');

  // Filter Sub-States Monitoring Bawahan
  const [subordinateViewMode, setSubordinateViewMode] = useState<'radar' | 'list'>('radar');
  const [subordinateMemberFilter, setSubordinateMemberFilter] = useState<string>('all');
  const [subordinateStatusFilter, setSubordinateStatusFilter] = useState<'urgent' | 'active' | 'in_progress' | 'done'>('urgent');
  const [subordinateSearch, setSubordinateSearch] = useState<string>('');

  // Filter Workspace
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const memberId = session?.memberId;

  const loadData = useCallback(async () => {
    try {
      const res = await fetchInitialData(memberId);
      setProjects(res.projects);
      setTasks(res.tasks);
      setMembers(res.members);
      setRoles(res.roles);
      setProjectAccess(res.projectAccess);
    } catch (err) {
      console.error('Failed to load tasks:', err);
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
          setProjects(res.projects);
          setTasks(res.tasks);
          setMembers(res.members);
          setRoles(res.roles);
          setProjectAccess(res.projectAccess);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load tasks:', err);
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

  // Toggle status Done pada task
  const handleToggleDone = async (task: Task) => {
    const newStatus = task.status === 'Done' ? 'To Do' : 'Done';
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    try {
      await updateTask(task.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  };

  // Siklus status cepat: To Do -> In Progress -> Done
  const handleCycleStatus = async (task: Task) => {
    let nextStatus = 'In Progress';
    if (task.status === 'In Progress') nextStatus = 'Done';
    else if (task.status === 'Done') nextStatus = 'To Do';

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await updateTask(task.id, { status: nextStatus });
    } catch (err) {
      console.error('Failed to cycle status:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  };

  // Toggle subtask todo langsung dari daftar Tugas Saya
  const handleToggleSubtask = async (parentTaskId: string, todoId: string) => {
    const targetTask = tasks.find((t) => t.id === parentTaskId);
    if (!targetTask || !Array.isArray(targetTask.todos)) return;

    const updatedTodos = targetTask.todos.map((td) =>
      td.id === todoId ? { ...td, done: !td.done } : td
    );

    setTasks((prev) =>
      prev.map((t) => (t.id === parentTaskId ? { ...t, todos: updatedTodos } : t))
    );

    try {
      await updateTask(parentTaskId, { todos: updatedTodos });
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === parentTaskId ? { ...t, todos: targetTask.todos } : t))
      );
    }
  };

  // Member map helper
  const memberMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // Accessible Projects & Tasks (Permissions & Personal Workspace Isolation)
  const accessibleProjects = useMemo(() => {
    return getAccessibleProjects(projects, session, roles, projectAccess);
  }, [projects, session, roles, projectAccess]);

  const accessibleTasks = useMemo(() => {
    return getAccessibleTasks(tasks, projects, session, roles, projectAccess);
  }, [tasks, projects, session, roles, projectAccess]);

  // Project map helper
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    accessibleProjects.forEach((p) => map.set(p.id, p));
    return map;
  }, [accessibleProjects]);

  // Subordinate Data (Radar Bawahan)
  const subordinateData = useMemo(() => {
    return getSubordinatesWithStats(session, members, accessibleTasks, accessibleProjects, roles);
  }, [session, members, accessibleTasks, accessibleProjects, roles]);

  const subordinateIdSet = useMemo(() => {
    return new Set(subordinateData.subordinates.map((s) => s.id));
  }, [subordinateData.subordinates]);

  // 1. Perhitungan Statistik Tugas Saya (Selaras MainDashboard.jsx)
  const myTasks = useMemo(() => {
    return accessibleTasks.filter((t) => {
      const pic = t.pic_id || t.picId;
      return pic === memberId;
    });
  }, [accessibleTasks, memberId]);

  const myTaskStats = useMemo(() => {
    let overdueCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;
    let inProgressCount = 0;
    let doneCount = 0;
    let totalActive = 0;

    myTasks.forEach((t) => {
      if (t.status === 'Done') {
        doneCount++;
        return;
      }
      totalActive++;
      if (t.status === 'In Progress') inProgressCount++;

      const diff = getDeadlineDiffDays(t.deadline);
      if (diff !== null) {
        if (diff < 0) overdueCount++;
        else if (diff === 0) todayCount++;
        else upcomingCount++;
      } else {
        upcomingCount++;
      }
    });

    // Subtasks To-Do milik tugas saya yang belum selesai
    const todos: Array<TaskTodo & { parentTaskId: string; parentTaskTitle: string; parentTaskPriority?: string; diffDays: number | null }> = [];
    myTasks.forEach((t) => {
      if (t.status !== 'Done' && Array.isArray(t.todos)) {
        t.todos.forEach((td) => {
          if (td && !td.done && td.id !== '__meta_task_props__' && !td.isMetaTask) {
            const diffDays = getDeadlineDiffDays(td.deadline || t.deadline);
            todos.push({
              ...td,
              parentTaskId: t.id,
              parentTaskTitle: t.title,
              parentTaskPriority: t.priority,
              diffDays,
            });
          }
        });
      }
    });

    todos.sort((a, b) => (a.diffDays ?? 999) - (b.diffDays ?? 999));

    return {
      overdueCount,
      todayCount,
      upcomingCount,
      inProgressCount,
      doneCount,
      totalActive,
      todos,
    };
  }, [myTasks]);

  // 2. Filter Tasks berdasarkan Mode
  const filteredTasks = useMemo(() => {
    return accessibleTasks.filter((t) => {
      const pic = t.pic_id || t.picId;
      const project = projectMap.get(t.project_id || t.projectId || '');
      const isPersonal = isPersonalProject(project);

      // MODE 1: TUGAS SAYA
      if (mainMode === 'my_tasks') {
        if (pic !== memberId) return false;

        const diff = getDeadlineDiffDays(t.deadline);
        if (myFilter === 'overdue' && (t.status === 'Done' || diff === null || diff >= 0)) return false;
        if (myFilter === 'today' && (t.status === 'Done' || diff !== 0)) return false;
        if (myFilter === 'upcoming' && (t.status === 'Done' || (diff !== null && diff <= 0))) return false;
        if (myFilter === 'in_progress' && t.status !== 'In Progress') return false;
        if (myFilter === 'done' && t.status !== 'Done') return false;
        if (myFilter === 'all' && t.status === 'Done') return false; // Tab Semua Aktif
      }

      // MODE 2: MONITORING BAWAHAN (Daftar Tugas)
      else if (mainMode === 'subordinates') {
        if (isPersonal) return false;
        if (!pic || !subordinateIdSet.has(pic)) return false;
        if (subordinateMemberFilter !== 'all' && pic !== subordinateMemberFilter) return false;

        const diff = getDeadlineDiffDays(t.deadline);
        if (subordinateStatusFilter === 'urgent') {
          if (t.status === 'Done') return false;
          if (diff === null || diff > 0) return false; // Overdue & Today saja
        } else if (subordinateStatusFilter === 'active') {
          if (t.status === 'Done') return false;
        } else if (subordinateStatusFilter === 'in_progress') {
          if (t.status !== 'In Progress') return false;
        } else if (subordinateStatusFilter === 'done') {
          if (t.status !== 'Done') return false;
        }
      }

      // MODE 3: WORKSPACES
      else if (mainMode === 'workspaces') {
        if (!project) return false;
        if (selectedProjectId !== 'all' && (t.project_id || t.projectId) !== selectedProjectId) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(q);
        const picObj = pic ? memberMap.get(pic) : null;
        const picMatch = picObj?.name.toLowerCase().includes(q);
        if (!titleMatch && !picMatch) return false;
      }

      return true;
    });
  }, [
    accessibleTasks,
    mainMode,
    memberId,
    myFilter,
    subordinateMemberFilter,
    subordinateStatusFilter,
    selectedProjectId,
    searchQuery,
    subordinateIdSet,
    projectMap,
    memberMap,
  ]);

  // Handler kirim WhatsApp reminder
  const handleSendReminder = (task: Task) => {
    const pic = task.pic_id || task.picId;
    const m = pic ? memberMap.get(pic) : null;
    if (m) {
      const url = createWhatsAppReminderUrl(task, m);
      Linking.openURL(url);
    }
  };

  // Render Kartu Tugas
  const renderTaskItem = ({ item }: { item: Task }) => {
    const isDone = item.status === 'Done';
    const project = projectMap.get(item.project_id || item.projectId || '');
    const pic = (item.pic_id || item.picId) ? memberMap.get(item.pic_id || item.picId || '') : null;
    const diff = getDeadlineDiffDays(item.deadline);
    const isOverdue = !isDone && diff !== null && diff < 0;
    const isToday = !isDone && diff === 0;

    const priorityColor =
      item.priority === 'High' ? '#ef4444' : item.priority === 'Medium' ? '#f59e0b' : '#3b82f6';

    const isSubordinateTask = mainMode === 'subordinates' || (pic && pic.id !== memberId);

    // Hitung subtasks
    const subtasks = Array.isArray(item.todos)
      ? item.todos.filter((t) => t && t.id !== '__meta_task_props__' && !t.isMetaTask)
      : [];
    const completedSubtasks = subtasks.filter((t) => t.done).length;

    // Hitung bukti file
    const proofFiles = Array.isArray(item.proof_files) ? item.proof_files : [];

    return (
      <TouchableOpacity
        style={[
          styles.taskCard,
          isDone && styles.taskCardDone,
          isOverdue && styles.taskCardOverdue,
          isToday && styles.taskCardToday,
        ]}
        onPress={() => router.push(`/task/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          {/* Quick Checkbox */}
          <TouchableOpacity
            style={[styles.checkbox, isDone && styles.checkboxDone]}
            onPress={() => handleToggleDone(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isDone && <Ionicons name="checkmark" size={14} color="#ffffff" />}
          </TouchableOpacity>

          {/* Task Info */}
          <View style={styles.cardContent}>
            {/* Row Tag: Project & Prioritas */}
            <View style={styles.badgeRow}>
              {project && (
                <View style={[styles.projectTag, { backgroundColor: (project.color || '#3b82f6') + '15' }]}>
                  <View style={[styles.projectDot, { backgroundColor: project.color || '#3b82f6' }]} />
                  <Text style={[styles.projectTagText, { color: project.color || '#3b82f6' }]}>
                    {project.name}
                  </Text>
                </View>
              )}

              <View style={[styles.priorityPill, { backgroundColor: priorityColor + '15' }]}>
                <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                <Text style={[styles.priorityText, { color: priorityColor }]}>
                  {item.priority || 'Normal'}
                </Text>
              </View>

              {/* Ownership Pill: Tugas Saya vs Tim */}
              {(item.pic_id === memberId || item.picId === memberId) ? (
                <View style={styles.myTaskPill}>
                  <Ionicons name="person" size={9} color="#2563eb" />
                  <Text style={styles.myTaskPillText}>Tugas Saya</Text>
                </View>
              ) : (
                <View style={styles.teamTaskPill}>
                  <Text style={styles.teamTaskPillText}>Tim</Text>
                </View>
              )}

              {/* Status Chip (Bisa di-tap untuk siklus status) */}
              <TouchableOpacity
                style={[
                  styles.statusChip,
                  item.status === 'In Progress' && styles.statusChipInProgress,
                  item.status === 'Done' && styles.statusChipDone,
                ]}
                onPress={() => handleCycleStatus(item)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    item.status === 'In Progress' && styles.statusChipTextInProgress,
                    item.status === 'Done' && styles.statusChipTextDone,
                  ]}
                >
                  {item.status || 'To Do'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Task Title */}
            <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>
              {item.title}
            </Text>

            {/* Sub-info Badges: Subtask, Proof, Memo */}
            <View style={styles.metaRow}>
              {subtasks.length > 0 && (
                <View style={styles.metaBadge}>
                  <Ionicons name="checkbox-outline" size={11} color="#64748b" />
                  <Text style={styles.metaBadgeText}>
                    {completedSubtasks}/{subtasks.length} subtask
                  </Text>
                </View>
              )}

              {proofFiles.length > 0 && (
                <View style={[styles.metaBadge, styles.metaBadgeProof]}>
                  <Ionicons name="attach" size={11} color="#059669" />
                  <Text style={[styles.metaBadgeText, { color: '#059669', fontWeight: '600' }]}>
                    {proofFiles.length} bukti
                  </Text>
                </View>
              )}

              {item.memo ? (
                <View style={[styles.metaBadge, styles.metaBadgeMemo]}>
                  <Ionicons name="document-text-outline" size={11} color="#d97706" />
                  <Text style={[styles.metaBadgeText, { color: '#d97706' }]}>Memo</Text>
                </View>
              ) : null}
            </View>

            {/* Footer Row: PIC, Deadline, WhatsApp Reminder */}
            <View style={styles.footerRow}>
              {pic ? (
                <View style={[styles.picChip, isSubordinateTask && styles.picChipSubordinate]}>
                  <Ionicons
                    name="person-circle-outline"
                    size={14}
                    color={isSubordinateTask ? '#6d28d9' : '#64748b'}
                  />
                  <Text
                    style={[styles.picText, isSubordinateTask && styles.picTextSubordinate]}
                    numberOfLines={1}
                  >
                    {pic.name} {isSubordinateTask && `(${pic.role || 'Staff'})`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.unassignedText}>Tanpa PIC</Text>
              )}

              {item.deadline ? (
                <View
                  style={[
                    styles.deadlineBadge,
                    isOverdue && styles.deadlineBadgeOverdue,
                    isToday && styles.deadlineBadgeToday,
                  ]}
                >
                  <Ionicons
                    name={isOverdue ? 'alert-circle' : isToday ? 'time' : 'calendar-outline'}
                    size={11}
                    color={isOverdue ? '#ffffff' : isToday ? '#ffffff' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.deadlineBadgeText,
                      isOverdue && styles.deadlineBadgeTextUrgent,
                      isToday && styles.deadlineBadgeTextUrgent,
                    ]}
                  >
                    {isOverdue
                      ? `Lewat ${Math.abs(diff!)}h`
                      : isToday
                      ? 'Hari Ini'
                      : diff === 1
                      ? 'Besok'
                      : item.deadline}
                  </Text>
                </View>
              ) : null}

              {/* Tombol WhatsApp Reminder Khusus Tugas Bawahan */}
              {isSubordinateTask && !isDone && (
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() => handleSendReminder(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={12} color="#047857" />
                  <Text style={styles.waBtnText}>Ingatkan</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Item Subtask To-Do (Khusus tab To-Do pada Tugas Saya)
  const renderSubtaskTodoItem = (todo: any) => {
    const isOverdue = todo.diffDays !== null && todo.diffDays < 0;
    const isToday = todo.diffDays === 0;

    return (
      <View
        key={todo.id}
        style={[
          styles.todoCard,
          isOverdue && styles.todoCardOverdue,
          isToday && styles.todoCardToday,
        ]}
      >
        <TouchableOpacity
          style={[styles.checkbox, todo.done && styles.checkboxDone]}
          onPress={() => handleToggleSubtask(todo.parentTaskId, todo.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {todo.done && <Ionicons name="checkmark" size={14} color="#ffffff" />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.todoContent}
          onPress={() => router.push(`/task/${todo.parentTaskId}`)}
          activeOpacity={0.7}
        >
          <Text style={[styles.todoTitle, todo.done && styles.taskTitleDone]}>
            {todo.text}
          </Text>
          <View style={styles.todoParentRow}>
            <Ionicons name="return-down-forward" size={12} color="#94a3b8" />
            <Text style={styles.todoParentText} numberOfLines={1}>
              Tugas Induk: <Text style={styles.todoParentName}>{todo.parentTaskTitle}</Text>
            </Text>
          </View>
        </TouchableOpacity>

        {todo.diffDays !== null && (
          <View
            style={[
              styles.deadlineBadge,
              isOverdue && styles.deadlineBadgeOverdue,
              isToday && styles.deadlineBadgeToday,
            ]}
          >
            <Text
              style={[
                styles.deadlineBadgeText,
                (isOverdue || isToday) && styles.deadlineBadgeTextUrgent,
              ]}
            >
              {isOverdue ? `Lewat ${Math.abs(todo.diffDays)}h` : isToday ? 'Hari Ini' : todo.deadline}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ===================================================================== */}
      {/* 1. SEGMENT MODE UTAMA: TUGAS SAYA | RADAR BAWAHAN | WORKSPACES        */}
      {/* ===================================================================== */}
      <View style={styles.mainModeBar}>
        <TouchableOpacity
          style={[styles.mainModeBtn, mainMode === 'my_tasks' && styles.mainModeBtnActive]}
          onPress={() => setMainMode('my_tasks')}
        >
          <Ionicons
            name="person-outline"
            size={15}
            color={mainMode === 'my_tasks' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.mainModeText, mainMode === 'my_tasks' && styles.mainModeTextActive]}>
            Tugas Saya
          </Text>
          {myTaskStats.overdueCount > 0 && (
            <View style={styles.counterBadgeRed}>
              <Text style={styles.counterBadgeText}>{myTaskStats.overdueCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {subordinateData.isLeader && (
          <TouchableOpacity
            style={[styles.mainModeBtn, mainMode === 'subordinates' && styles.mainModeBtnActiveViolet]}
            onPress={() => setMainMode('subordinates')}
          >
            <Ionicons
              name="git-network-outline"
              size={15}
              color={mainMode === 'subordinates' ? '#ffffff' : '#64748b'}
            />
            <Text
              style={[styles.mainModeText, mainMode === 'subordinates' && styles.mainModeTextActive]}
              numberOfLines={1}
            >
              Radar Tim
            </Text>
            {subordinateData.totalSubordinateOverdue > 0 && (
              <View style={styles.counterBadgeRed}>
                <Text style={styles.counterBadgeText}>{subordinateData.totalSubordinateOverdue}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.mainModeBtn, mainMode === 'workspaces' && styles.mainModeBtnActive]}
          onPress={() => setMainMode('workspaces')}
        >
          <Ionicons
            name="folder-outline"
            size={15}
            color={mainMode === 'workspaces' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.mainModeText, mainMode === 'workspaces' && styles.mainModeTextActive]}>
            Semua
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===================================================================== */}
      {/* 2. SUB-FILTERS & METRICS HEADER SESUAI MODE                           */}
      {/* ===================================================================== */}
      {mainMode === 'my_tasks' ? (
        <View style={styles.myTasksHeaderBlock}>
          {/* Sub-tabs Tugas Saya */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {[
              { id: 'all', label: 'Semua Aktif', count: myTaskStats.totalActive, icon: 'layers-outline' },
              { id: 'overdue', label: 'Overdue', count: myTaskStats.overdueCount, icon: 'alert-circle-outline', alert: myTaskStats.overdueCount > 0 },
              { id: 'today', label: 'Hari Ini', count: myTaskStats.todayCount, icon: 'time-outline' },
              { id: 'upcoming', label: 'Mendatang', count: myTaskStats.upcomingCount, icon: 'calendar-outline' },
              { id: 'in_progress', label: 'Dalam Proses', count: myTaskStats.inProgressCount, icon: 'flash-outline' },
              { id: 'todos', label: 'Subtask To-Do', count: myTaskStats.todos.length, icon: 'checkbox-outline' },
              { id: 'done', label: 'Selesai', count: myTaskStats.doneCount, icon: 'checkmark-circle-outline' },
            ].map((chip) => {
              const isSelected = myFilter === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  style={[
                    styles.subChip,
                    isSelected && styles.subChipActive,
                    chip.alert && !isSelected && styles.subChipAlert,
                  ]}
                  onPress={() => setMyFilter(chip.id as any)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={chip.icon as any}
                    size={13}
                    color={isSelected ? '#ffffff' : chip.alert ? '#dc2626' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.subChipText,
                      isSelected && styles.subChipTextActive,
                      chip.alert && !isSelected && styles.subChipTextAlert,
                    ]}
                    numberOfLines={1}
                  >
                    {chip.label}
                  </Text>
                  <View
                    style={[
                      styles.subChipBubble,
                      isSelected && styles.subChipBubbleActive,
                      chip.alert && !isSelected && styles.subChipBubbleAlert,
                    ]}
                  >
                    <Text
                      style={[
                        styles.subChipBubbleText,
                        isSelected && styles.subChipBubbleTextActive,
                        chip.alert && !isSelected && styles.subChipBubbleTextAlert,
                      ]}
                    >
                      {chip.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : mainMode === 'subordinates' ? (
        <View style={styles.subordinateHeaderBlock}>
          {/* Executive Subordinate Summary Banner */}
          <View style={styles.radarBanner}>
            <View style={styles.radarBannerItem}>
              <Text style={styles.radarBannerValue}>{subordinateData.subordinates.length}</Text>
              <Text style={styles.radarBannerLabel}>Bawahan</Text>
            </View>
            <View style={styles.radarBannerDivider} />
            <View style={styles.radarBannerItem}>
              <Text
                style={[
                  styles.radarBannerValue,
                  subordinateData.totalSubordinateOverdue > 0 && styles.radarBannerValueRed,
                ]}
              >
                {subordinateData.totalSubordinateOverdue}
              </Text>
              <Text style={styles.radarBannerLabel}>Overdue</Text>
            </View>
            <View style={styles.radarBannerDivider} />
            <View style={styles.radarBannerItem}>
              <Text style={styles.radarBannerValue}>{subordinateData.totalSubordinateToday}</Text>
              <Text style={styles.radarBannerLabel}>Hari Ini</Text>
            </View>
            <View style={styles.radarBannerDivider} />
            {/* View Mode Toggle: Radar Tim vs Daftar Tugas */}
            <View style={styles.viewToggleGroup}>
              <TouchableOpacity
                style={[
                  styles.viewToggleBtn,
                  subordinateViewMode === 'radar' && styles.viewToggleBtnActive,
                ]}
                onPress={() => setSubordinateViewMode('radar')}
              >
                <Ionicons
                  name="people"
                  size={14}
                  color={subordinateViewMode === 'radar' ? '#ffffff' : '#64748b'}
                />
                <Text
                  style={[
                    styles.viewToggleText,
                    subordinateViewMode === 'radar' && styles.viewToggleTextActive,
                  ]}
                >
                  Radar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewToggleBtn,
                  subordinateViewMode === 'list' && styles.viewToggleBtnActive,
                ]}
                onPress={() => setSubordinateViewMode('list')}
              >
                <Ionicons
                  name="list"
                  size={14}
                  color={subordinateViewMode === 'list' ? '#ffffff' : '#64748b'}
                />
                <Text
                  style={[
                    styles.viewToggleText,
                    subordinateViewMode === 'list' && styles.viewToggleTextActive,
                  ]}
                >
                  Tugas
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Subordinate Mode Filters (Radar vs List) */}
          {subordinateViewMode === 'radar' ? (
            <View style={styles.radarSearchRow}>
              <Ionicons name="search-outline" size={15} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.radarSearchInput}
                value={subordinateSearch}
                onChangeText={setSubordinateSearch}
                placeholder="Cari nama bawahan atau jabatan..."
                placeholderTextColor="#94a3b8"
              />
              {subordinateSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSubordinateSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.subListFilterBlock}>
              {/* Member Selector Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
                <TouchableOpacity
                  style={[styles.subChip, subordinateMemberFilter === 'all' && styles.subChipActiveViolet]}
                  onPress={() => setSubordinateMemberFilter('all')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.subChipText, subordinateMemberFilter === 'all' && styles.subChipTextActive]}>
                    Semua Bawahan
                  </Text>
                  <View style={[styles.subChipBubble, subordinateMemberFilter === 'all' && styles.subChipBubbleActive]}>
                    <Text style={[styles.subChipBubbleText, subordinateMemberFilter === 'all' && styles.subChipBubbleTextActive]}>
                      {subordinateData.subordinates.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                {subordinateData.subordinates.map((sub) => {
                  const isSelected = subordinateMemberFilter === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.subChip, isSelected && styles.subChipActiveViolet]}
                      onPress={() => setSubordinateMemberFilter(sub.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.subChipText, isSelected && styles.subChipTextActive]}>
                        {sub.name}
                      </Text>
                      <View style={[styles.subChipBubble, isSelected && styles.subChipBubbleActive]}>
                        <Text style={[styles.subChipBubbleText, isSelected && styles.subChipBubbleTextActive]}>
                          {sub.activeTasks.length}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Status Toggle Row */}
              <View style={styles.subStatusRow}>
                {[
                  { id: 'urgent', label: 'Perlu Perhatian', icon: 'alert-circle-outline', alert: true },
                  { id: 'active', label: 'Semua Aktif', icon: 'layers-outline' },
                  { id: 'in_progress', label: 'Dalam Proses', icon: 'flash-outline' },
                  { id: 'done', label: 'Selesai', icon: 'checkmark-circle-outline' },
                ].map((st) => {
                  const isSelected = subordinateStatusFilter === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.statusToggleBtn, isSelected && styles.statusToggleBtnActive]}
                      onPress={() => setSubordinateStatusFilter(st.id as any)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={st.icon as any}
                        size={12}
                        color={isSelected ? '#ffffff' : st.alert ? '#dc2626' : '#64748b'}
                      />
                      <Text style={[styles.statusToggleText, isSelected && styles.statusToggleTextActive]}>
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      ) : (
        /* Workspace Project Filter */
        <View style={styles.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            <TouchableOpacity
              style={[styles.subChip, selectedProjectId === 'all' && styles.subChipActive]}
              onPress={() => setSelectedProjectId('all')}
            >
              <Text style={[styles.subChipText, selectedProjectId === 'all' && styles.subChipTextActive]}>
                Semua Workspace
              </Text>
            </TouchableOpacity>

            {accessibleProjects.map((p) => {
              const isSelected = selectedProjectId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.subChip, isSelected && styles.subChipActive]}
                  onPress={() => setSelectedProjectId(p.id)}
                >
                  <Text style={[styles.subChipText, isSelected && styles.subChipTextActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ===================================================================== */}
      {/* 3. KONTEN UTAMA: SUBTASK TO-DO | RADAR BAWAHAN | LIST TUGAS           */}
      {/* ===================================================================== */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#db2777" />
          <Text style={styles.loadingText}>Memuat tugas...</Text>
        </View>
      ) : mainMode === 'my_tasks' && myFilter === 'todos' ? (
        /* Seksi Khusus Subtask To-Do Tugas Saya */
        <ScrollView
          style={styles.todoListContainer}
          contentContainerStyle={styles.todoListContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#db2777']} />}
        >
          {myTaskStats.todos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={54} color="#10b981" />
              <Text style={styles.emptyTitle}>Hebat! Seluruh Subtask Tuntas</Text>
              <Text style={styles.emptyDesc}>Tidak ada to-do sub-kegiatan yang tertunda saat ini.</Text>
            </View>
          ) : (
            myTaskStats.todos.map((td) => renderSubtaskTodoItem(td))
          )}
        </ScrollView>
      ) : mainMode === 'subordinates' && subordinateViewMode === 'radar' ? (
        /* Seksi Khusus Radar Bawahan (Grouped by Member - Selaras MainDashboard.jsx) */
        <ScrollView
          style={styles.radarContainer}
          contentContainerStyle={styles.radarContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} />}
        >
          {subordinateData.subordinates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Tidak Ada Anggota Bawahan</Text>
              <Text style={styles.emptyDesc}>Tidak ada anggota tim terdaftar di bawah tingkatan hierarki ini.</Text>
            </View>
          ) : (
            subordinateData.subordinates
              .filter((sub) => {
                if (!subordinateSearch.trim()) return true;
                const q = subordinateSearch.toLowerCase();
                return (
                  sub.name.toLowerCase().includes(q) ||
                  (sub.role || '').toLowerCase().includes(q) ||
                  (sub.department || '').toLowerCase().includes(q)
                );
              })
              .map((sub) => {
                const hasOverdue = sub.overdueTasks.length > 0;
                const hasToday = sub.todayTasks.length > 0;
                const urgentTasks = [...sub.overdueTasks, ...sub.todayTasks];

                return (
                  <View
                    key={sub.id}
                    style={[
                      styles.subCard,
                      hasOverdue && styles.subCardOverdue,
                      hasToday && !hasOverdue && styles.subCardToday,
                    ]}
                  >
                    {/* Header Anggota Bawahan */}
                    <View style={styles.subCardHeader}>
                      <View style={styles.subProfileInfo}>
                        <View
                          style={[
                            styles.subAvatar,
                            { backgroundColor: sub.color || '#6366f1' },
                          ]}
                        >
                          <Text style={styles.subAvatarText}>{getInitials(sub.name)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.subNameRow}>
                            <Text style={styles.subNameText} numberOfLines={1}>
                              {sub.name}
                            </Text>
                            <View style={styles.subLevelBadge}>
                              <Text style={styles.subLevelBadgeText}>
                                Lvl {sub.level}: {sub.role || 'Staff'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.subDeptText} numberOfLines={1}>
                            {sub.department ? `${sub.department} • ` : ''}{sub.division || 'Divisi'}
                          </Text>
                        </View>
                      </View>

                      {/* Counter Badges */}
                      <View style={styles.subBadgesRow}>
                        {hasOverdue && (
                          <View style={styles.subBadgeOverdue}>
                            <Text style={styles.subBadgeOverdueText}>
                              {sub.overdueTasks.length} Overdue
                            </Text>
                          </View>
                        )}
                        {hasToday && (
                          <View style={styles.subBadgeToday}>
                            <Text style={styles.subBadgeTodayText}>
                              {sub.todayTasks.length} Hari Ini
                            </Text>
                          </View>
                        )}
                        <View style={styles.subBadgeTotal}>
                          <Text style={styles.subBadgeTotalText}>
                            {sub.totalActive} Tugas
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Seksi Tugas Butuh Perhatian Segera */}
                    {urgentTasks.length > 0 && (
                      <View style={styles.subUrgentBlock}>
                        <View style={styles.subUrgentHeader}>
                          <Text style={styles.subUrgentTitle}>TUGAS BUTUH PERHATIAN SEGERA:</Text>
                          <Text style={styles.subUrgentSubtitle}>Tindakan Follow-Up</Text>
                        </View>

                        {urgentTasks.slice(0, 3).map((ut) => {
                          const diff = getDeadlineDiffDays(ut.deadline);
                          const isUtOverdue = diff !== null && diff < 0;

                          return (
                            <View key={ut.id} style={styles.subUrgentItem}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.subUrgentTaskTitle} numberOfLines={1}>
                                  {ut.title}
                                </Text>
                                <Text
                                  style={[
                                    styles.subUrgentDeadline,
                                    isUtOverdue ? styles.deadlineTextOverdue : styles.deadlineTextToday,
                                  ]}
                                >
                                  Deadline: {isUtOverdue ? `Lewat ${Math.abs(diff!)}h` : 'Hari Ini'}
                                </Text>
                              </View>

                              {/* Tombol Follow Up WhatsApp Cepat */}
                              <TouchableOpacity
                                style={styles.waBtnMini}
                                onPress={() => handleSendReminder(ut)}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="logo-whatsapp" size={13} color="#047857" />
                                <Text style={styles.waBtnMiniText}>Ingatkan</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Action Footer: Lihat Semua Tugas & Tugaskan Baru */}
                    <View style={styles.subCardFooter}>
                      <TouchableOpacity
                        style={styles.subActionBtn}
                        onPress={() => {
                          setSubordinateMemberFilter(sub.id);
                          setSubordinateStatusFilter('active');
                          setSubordinateViewMode('list');
                        }}
                      >
                        <Ionicons name="list-outline" size={13} color="#475569" />
                        <Text style={styles.subActionBtnText}>Lihat Semua ({sub.totalActive})</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.subActionBtnPrimary}
                        onPress={() => router.push(`/new-task?picId=${sub.id}`)}
                      >
                        <Ionicons name="add-circle-outline" size={13} color="#ffffff" />
                        <Text style={styles.subActionBtnPrimaryText}>Tugaskan Task</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
          )}
        </ScrollView>
      ) : (
        /* Regular FlatList Tasks */
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTaskItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[mainMode === 'subordinates' ? '#7c3aed' : '#db2777']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={54}
                color={mainMode === 'subordinates' ? '#8b5cf6' : '#10b981'}
              />
              <Text style={styles.emptyTitle}>
                {mainMode === 'subordinates'
                  ? 'Tidak Ada Tugas Bawahan yang Tertunda'
                  : 'Semua Tugas Terkendali! 🎉'}
              </Text>
              <Text style={styles.emptyDesc}>
                {mainMode === 'subordinates'
                  ? 'Seluruh tugas anggota bawahan Anda berjalan lancar.'
                  : 'Tidak ada tugas yang memerlukan perhatian saat ini.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Add Task Button */}
      <TouchableOpacity
        style={[
          styles.fab,
          mainMode === 'subordinates' && { backgroundColor: '#7c3aed' },
        ]}
        onPress={() => router.push('/new-task')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },

  // 1. Main Mode Segment
  mainModeBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  mainModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    gap: 5,
  },
  mainModeBtnActive: {
    backgroundColor: '#db2777',
  },
  mainModeBtnActiveViolet: {
    backgroundColor: '#7c3aed',
  },
  mainModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  mainModeTextActive: {
    color: '#ffffff',
  },
  counterBadgeRed: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  counterBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  // 2. Sub-filters
  myTasksHeaderBlock: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
  },
  chipsRow: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
  },
  chipsContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  subChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  subChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  subChipActiveViolet: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  subChipAlert: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  subChipTextAlert: {
    color: '#e11d48',
    fontWeight: '700',
  },
  subChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  subChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  subChipBubble: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subChipBubbleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  subChipBubbleAlert: {
    backgroundColor: '#ffe4e6',
  },
  subChipBubbleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  subChipBubbleTextActive: {
    color: '#ffffff',
  },
  subChipBubbleTextAlert: {
    color: '#e11d48',
  },

  // Subordinate Header Block
  subordinateHeaderBlock: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f3ff',
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
  },
  radarBannerItem: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  radarBannerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5b21b6',
  },
  radarBannerValueRed: {
    color: '#dc2626',
  },
  radarBannerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 1,
  },
  radarBannerDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#ddd6fe',
    marginHorizontal: 8,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 2,
    marginLeft: 'auto',
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: '#7c3aed',
  },
  viewToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  viewToggleTextActive: {
    color: '#ffffff',
  },

  radarSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 14,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radarSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    padding: 0,
  },

  subListFilterBlock: {
    paddingVertical: 8,
    gap: 8,
  },
  subStatusRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 6,
  },
  statusToggleBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusToggleBtnActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  statusToggleTextActive: {
    color: '#ffffff',
  },

  // 3. Lists
  listContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 90,
  },
  todoListContainer: {
    flex: 1,
  },
  todoListContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 90,
  },
  radarContainer: {
    flex: 1,
  },
  radarContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 90,
  },

  // Task Cards
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  taskCardDone: {
    opacity: 0.65,
    backgroundColor: '#f8fafc',
  },
  taskCardOverdue: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafb',
  },
  taskCardToday: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffefb',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  cardContent: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  projectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  projectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  projectTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  myTaskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  myTaskPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  teamTaskPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  teamTaskPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusChipInProgress: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statusChipDone: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  statusChipTextInProgress: {
    color: '#2563eb',
  },
  statusChipTextDone: {
    color: '#059669',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 20,
    marginBottom: 6,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaBadgeProof: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  metaBadgeMemo: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  metaBadgeText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  picChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 160,
  },
  picChipSubordinate: {
    backgroundColor: '#f5f3ff',
  },
  picText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  picTextSubordinate: {
    color: '#6d28d9',
  },
  unassignedText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  deadlineBadgeOverdue: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  deadlineBadgeToday: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  deadlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  deadlineBadgeTextUrgent: {
    color: '#ffffff',
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  waBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },

  // Todo Items (Khusus tab To-Do)
  todoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  todoCardOverdue: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafb',
  },
  todoCardToday: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffefb',
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  todoParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  todoParentText: {
    fontSize: 11,
    color: '#64748b',
  },
  todoParentName: {
    fontWeight: '600',
    color: '#334155',
  },

  // Subordinate Radar Card (Mode Radar)
  subCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 10,
  },
  subCardOverdue: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafb',
  },
  subCardToday: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffefb',
  },
  subCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  subProfileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  subNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  subNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  subLevelBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  subLevelBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  subDeptText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  subBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  subBadgeOverdue: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subBadgeOverdueText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  subBadgeToday: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subBadgeTodayText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  subBadgeTotal: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subBadgeTotalText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },

  // Subordinate Urgent Block
  subUrgentBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 10,
    gap: 6,
  },
  subUrgentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subUrgentTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#64748b',
  },
  subUrgentSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6366f1',
  },
  subUrgentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subUrgentTaskTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  subUrgentDeadline: {
    fontSize: 10,
    marginTop: 1,
  },
  deadlineTextOverdue: {
    color: '#dc2626',
    fontWeight: '700',
  },
  deadlineTextToday: {
    color: '#d97706',
    fontWeight: '700',
  },
  waBtnMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  waBtnMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },

  subCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    gap: 8,
  },
  subActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  subActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  subActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
  },
  subActionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#db2777',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
