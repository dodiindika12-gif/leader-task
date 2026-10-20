import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import {
  fetchInitialData,
  InitialDataResponse,
  Task,
  Shortcut,
  getDeadlineDiffDays,
  getSubordinatesWithStats,
  createWhatsAppReminderUrl,
  getAccessibleProjects,
  getAccessibleTasks,
} from '../../../lib/api';

export default function DashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<InitialDataResponse | null>(null);

  // Tab filter di seksi Tugas Saya: 'all' | 'overdue' | 'today' | 'upcoming' | 'todos'
  const [myTasksTab, setMyTasksTab] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'todos'>('all');

  const memberId = session?.memberId;

  const loadDashboardData = useCallback(async () => {
    try {
      const res = await fetchInitialData(memberId);
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [memberId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const tasks = useMemo(() => data?.tasks || [], [data?.tasks]);
  const projects = useMemo(() => data?.projects || [], [data?.projects]);
  const members = useMemo(() => data?.members || [], [data?.members]);
  const roles = useMemo(() => data?.roles || [], [data?.roles]);
  const shortcuts = useMemo(() => data?.shortcuts || [], [data?.shortcuts]);
  const projectAccess = useMemo(() => data?.projectAccess || [], [data?.projectAccess]);

  const accessibleProjects = useMemo(() => {
    return getAccessibleProjects(projects, session, roles, projectAccess);
  }, [projects, session, roles, projectAccess]);

  const accessibleTasks = useMemo(() => {
    return getAccessibleTasks(tasks, projects, session, roles, projectAccess);
  }, [tasks, projects, session, roles, projectAccess]);

  // Project map
  const projectMap = useMemo(() => {
    const map = new Map();
    accessibleProjects.forEach((p) => map.set(p.id, p));
    return map;
  }, [accessibleProjects]);

  // 1. TUGAS SAYA (My Tasks)
  const myTasks = useMemo(() => {
    if (!memberId) return [];
    return accessibleTasks.filter((t) => t.pic_id === memberId || t.picId === memberId);
  }, [accessibleTasks, memberId]);

  const myActiveTasks = useMemo(() => {
    return myTasks.filter((t) => t.status !== 'Done');
  }, [myTasks]);

  const myOverdueTasks = useMemo(() => {
    return myActiveTasks.filter((t) => {
      const diff = getDeadlineDiffDays(t.deadline);
      return diff !== null && diff < 0;
    });
  }, [myActiveTasks]);

  const myTodayTasks = useMemo(() => {
    return myActiveTasks.filter((t) => {
      const diff = getDeadlineDiffDays(t.deadline);
      return diff === 0;
    });
  }, [myActiveTasks]);

  const myUpcomingTasks = useMemo(() => {
    return myActiveTasks
      .filter((t) => {
        const diff = getDeadlineDiffDays(t.deadline);
        return diff === null || diff > 0;
      })
      .sort((a, b) => {
        const diffA = getDeadlineDiffDays(a.deadline) ?? 999;
        const diffB = getDeadlineDiffDays(b.deadline) ?? 999;
        return diffA - diffB;
      });
  }, [myActiveTasks]);

  const myDoneTasks = useMemo(() => {
    return myTasks.filter((t) => t.status === 'Done');
  }, [myTasks]);

  const myInProgressTasks = useMemo(() => {
    return myActiveTasks.filter((t) => t.status === 'In Progress');
  }, [myActiveTasks]);

  // Subtask (To-Do) Milik User Sendiri
  const myTodos = useMemo(() => {
    const list: Array<{
      id: string;
      text: string;
      done: boolean;
      deadline?: string;
      parentTitle: string;
      parentId: string;
      diffDays: number | null;
    }> = [];

    tasks.forEach((t) => {
      if (t.status === 'Done') return;
      (t.todos || []).forEach((td, idx) => {
        if (!td.done && (td.picId === memberId || (!td.picId && (t.pic_id === memberId || t.picId === memberId)))) {
          const diff = getDeadlineDiffDays(td.deadline || t.deadline);
          list.push({
            id: td.id || `todo_${t.id}_${idx}`,
            text: td.text,
            done: td.done,
            deadline: td.deadline || t.deadline,
            parentTitle: t.title,
            parentId: t.id,
            diffDays: diff,
          });
        }
      });
    });

    return list.sort((a, b) => (a.diffDays ?? 999) - (b.diffDays ?? 999));
  }, [tasks, memberId]);

  // List tugas saya yang tampil berdasarkan tab filter
  const displayedMyTasks = useMemo(() => {
    if (myTasksTab === 'overdue') return myOverdueTasks;
    if (myTasksTab === 'today') return myTodayTasks;
    if (myTasksTab === 'upcoming') return myUpcomingTasks;
    return myActiveTasks;
  }, [myTasksTab, myOverdueTasks, myTodayTasks, myUpcomingTasks, myActiveTasks]);

  // 2. RADAR BAWAHAN (Monitoring Tim)
  const subordinateData = useMemo(() => {
    return getSubordinatesWithStats(session, members, accessibleTasks, accessibleProjects, roles);
  }, [session, members, accessibleTasks, accessibleProjects, roles]);

  const handleSendReminder = (task: Task, sub: any) => {
    const url = createWhatsAppReminderUrl(task, sub);
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#db2777" />
        <Text style={styles.loadingText}>Memuat pusat kontrol tugas...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#db2777']} />}
    >
      {/* Header Pengguna */}
      <View style={styles.userBanner}>
        <View style={styles.userInfo}>
          <Text style={styles.greeting}>Halo, {session?.name || 'Leader'} 👋</Text>
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{session?.role || 'Staff'}</Text>
            </View>
            {Boolean(session?.division) && (
              <View style={styles.divisionBadge}>
                <Text style={styles.divisionBadgeText}>{session?.division}</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.createTaskButton}
          onPress={() => router.push('/new-task')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.createTaskText}>Tugas</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Stats Cards - FOKUS KE TUGAS SAYA (OVERDUE, HARI INI, MENDATANG) */}
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={[
            styles.statCard,
            styles.statCardOverdue,
            myTasksTab === 'overdue' && styles.statCardActiveOverdue,
          ]}
          onPress={() => setMyTasksTab('overdue')}
          activeOpacity={0.75}
        >
          <View style={styles.statCardTopRow}>
            <Text style={styles.statLabel} numberOfLines={1}>Overdue</Text>
            <Ionicons name="alert-circle" size={14} color="#ef4444" />
          </View>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {myOverdueTasks.length}
          </Text>
          <Text style={styles.statHintText} numberOfLines={1}>Lewat deadline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statCard,
            styles.statCardToday,
            myTasksTab === 'today' && styles.statCardActiveToday,
          ]}
          onPress={() => setMyTasksTab('today')}
          activeOpacity={0.75}
        >
          <View style={styles.statCardTopRow}>
            <Text style={styles.statLabel} numberOfLines={1}>Hari Ini</Text>
            <Ionicons name="time" size={14} color="#f59e0b" />
          </View>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
            {myTodayTasks.length}
          </Text>
          <Text style={styles.statHintText} numberOfLines={1}>Jatuh tempo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statCard,
            styles.statCardUpcoming,
            myTasksTab === 'upcoming' && styles.statCardActiveUpcoming,
          ]}
          onPress={() => setMyTasksTab('upcoming')}
          activeOpacity={0.75}
        >
          <View style={styles.statCardTopRow}>
            <Text style={styles.statLabel} numberOfLines={1}>Mendatang</Text>
            <Ionicons name="calendar" size={14} color="#6366f1" />
          </View>
          <Text style={[styles.statNumber, { color: '#6366f1' }]}>
            {myUpcomingTasks.length}
          </Text>
          <Text style={styles.statHintText} numberOfLines={1}>Jadwal aktif</Text>
        </TouchableOpacity>
      </View>

      {/* ===================================================================== */}
      {/* 1. SEKSI UTAMA: TUGAS & DEADLINE SAYA                                  */}
      {/* ===================================================================== */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconBoxAmber}>
                <Ionicons name="checkbox-outline" size={16} color="#d97706" />
              </View>
              <Text style={styles.sectionTitle} numberOfLines={1}>Tugas & Deadline Saya</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>Tugas yang ditugaskan ke Anda</Text>
        </View>

        {/* Filter Pills Khusus Tugas Saya (Horizontal Scrollable, Never Wrapped) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
          style={styles.filterPillsWrapper}
        >
          {[
            {
              id: 'all',
              label: 'Aktif',
              count: myActiveTasks.length,
              icon: 'layers-outline',
              activeBg: '#0f172a',
            },
            {
              id: 'overdue',
              label: 'Overdue',
              count: myOverdueTasks.length,
              icon: 'alert-circle-outline',
              activeBg: '#f43f5e',
              alertCount: myOverdueTasks.length > 0,
            },
            {
              id: 'today',
              label: 'Hari Ini',
              count: myTodayTasks.length,
              icon: 'time-outline',
              activeBg: '#f59e0b',
            },
            {
              id: 'upcoming',
              label: 'Mendatang',
              count: myUpcomingTasks.length,
              icon: 'calendar-outline',
              activeBg: '#6366f1',
            },
            {
              id: 'todos',
              label: 'Subtask',
              count: myTodos.length,
              icon: 'checkbox-outline',
              activeBg: '#8b5cf6',
            },
          ].map((item) => {
            const isSelected = myTasksTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.filterPillModern,
                  isSelected && { backgroundColor: item.activeBg, borderColor: item.activeBg },
                  !isSelected && item.alertCount && styles.filterPillModernAlert,
                ]}
                onPress={() => setMyTasksTab(item.id as any)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={isSelected ? '#ffffff' : item.alertCount ? '#e11d48' : '#64748b'}
                />
                <Text
                  style={[
                    styles.filterPillModernText,
                    isSelected && styles.filterPillModernTextActive,
                    !isSelected && item.alertCount && styles.filterPillModernTextAlert,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.filterPillCountBubble,
                    isSelected && styles.filterPillCountBubbleActive,
                    !isSelected && item.alertCount && styles.filterPillCountBubbleAlert,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillCountNum,
                      isSelected && styles.filterPillCountNumActive,
                      !isSelected && item.alertCount && styles.filterPillCountNumAlert,
                    ]}
                  >
                    {item.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content List Tugas Saya */}
        {myTasksTab === 'todos' ? (
          myTodos.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle-outline" size={36} color="#10b981" />
              <Text style={styles.emptyCardText}>Semua subtask to-do Anda sudah selesai! 🎉</Text>
            </View>
          ) : (
            myTodos.map((todo) => {
              const isOverdue = (todo.diffDays ?? 0) < 0;
              const isToday = todo.diffDays === 0;

              return (
                <TouchableOpacity
                  key={todo.id}
                  style={[styles.todoItemCard, isOverdue && styles.todoItemOverdue, isToday && styles.todoItemToday]}
                  onPress={() => router.push(`/task/${todo.parentId}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.todoItemHeader}>
                    <Ionicons
                      name="radio-button-off"
                      size={16}
                      color={isOverdue ? '#ef4444' : isToday ? '#f59e0b' : '#3b82f6'}
                    />
                    <Text style={styles.todoItemText} numberOfLines={2}>
                      {todo.text}
                    </Text>
                  </View>
                  <View style={styles.todoItemFooter}>
                    <Text style={styles.todoParentText} numberOfLines={1}>
                      Tugas: {todo.parentTitle}
                    </Text>
                    {Boolean(todo.deadline) && (
                      <Text style={[styles.todoDeadlineText, isOverdue && styles.textRed]}>
                        {isOverdue ? `Lewat ${Math.abs(todo.diffDays!)} Hari` : isToday ? 'Hari Ini' : todo.deadline}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : displayedMyTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={36} color="#10b981" />
            <Text style={styles.emptyCardText}>
              {myTasksTab === 'overdue'
                ? 'Tidak ada tugas yang terlambat. Kerja bagus!'
                : myTasksTab === 'today'
                ? 'Tidak ada deadline hari ini.'
                : myTasksTab === 'upcoming'
                ? 'Tidak ada tugas mendatang saat ini.'
                : 'Semua tugas Anda selesai! 🎉'}
            </Text>
          </View>
        ) : (
          displayedMyTasks.map((task) => {
            const project = projectMap.get(task.project_id || task.projectId || '');
            const diff = getDeadlineDiffDays(task.deadline);
            const isOverdue = diff !== null && diff < 0;
            const isToday = diff === 0;
            const priorityColor =
              task.priority === 'High' ? '#ef4444' : task.priority === 'Medium' ? '#f59e0b' : '#3b82f6';

            return (
              <TouchableOpacity
                key={task.id}
                style={[
                  styles.taskCard,
                  isOverdue && styles.taskCardOverdue,
                  isToday && styles.taskCardToday,
                ]}
                onPress={() => router.push(`/task/${task.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.taskHeader}>
                  <View style={[styles.priorityPill, { backgroundColor: priorityColor + '20' }]}>
                    <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                    <Text style={[styles.priorityText, { color: priorityColor }]}>
                      {task.priority || 'Normal'}
                    </Text>
                  </View>
                  {Boolean(task.deadline) && (
                    <Text style={[styles.deadlineText, isOverdue && styles.deadlineOverdue]}>
                      <Ionicons name="time-outline" size={13} />{' '}
                      {isOverdue ? `Lewat ${Math.abs(diff!)} hari` : isToday ? 'Hari Ini' : task.deadline}
                    </Text>
                  )}
                </View>

                <Text style={styles.taskTitle} numberOfLines={2}>
                  {task.title}
                </Text>

                <View style={styles.taskFooter}>
                  {project && (
                    <View style={[styles.projectTag, { backgroundColor: (project.color || '#3b82f6') + '15' }]}>
                      <Text style={[styles.projectTagText, { color: project.color || '#3b82f6' }]}>
                        {project.name}
                      </Text>
                    </View>
                  )}
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{task.status}</Text>
                  </View>
                  {task.todos && task.todos.length > 0 && (
                    <View style={styles.todoCountBadge}>
                      <Ionicons name="checkbox-outline" size={13} color="#64748b" />
                      <Text style={styles.todoCountText}>
                        {task.todos.filter((t) => t.done).length}/{task.todos.length}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* ===================================================================== */}
      {/* 2. SEKSI UTAMA: RADAR MONITORING BAWAHAN (Khusus Leader / Pimpinan)   */}
      {/* ===================================================================== */}
      {subordinateData.isLeader && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBoxViolet}>
                  <Ionicons name="git-network-outline" size={16} color="#7c3aed" />
                </View>
                <Text style={styles.sectionTitle} numberOfLines={1}>Radar Bawahan</Text>
              </View>

              {subordinateData.totalSubordinateOverdue > 0 && (
                <View style={styles.overdueAlertBadge}>
                  <Ionicons name="alert-circle" size={12} color="#be123c" />
                  <Text style={styles.overdueAlertText}>
                    {subordinateData.totalSubordinateOverdue} Overdue
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.sectionSubtitle}>
              Memantau tim di bawah tingkatan Anda ({session?.division || 'Divisi'})
            </Text>
          </View>

          {subordinateData.subordinates.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color="#94a3b8" />
              <Text style={styles.emptyCardText}>Belum ada anggota tim terdaftar di bawah tingkatan ini.</Text>
            </View>
          ) : (
            subordinateData.subordinates.map((sub) => {
              const hasOverdue = sub.overdueTasks.length > 0;
              const hasToday = sub.todayTasks.length > 0;
              const urgentTasks = [...sub.overdueTasks, ...sub.todayTasks].slice(0, 2);

              return (
                <View
                  key={sub.id}
                  style={[
                    styles.subordinateCard,
                    hasOverdue ? styles.subCardOverdue : hasToday ? styles.subCardToday : null,
                  ]}
                >
                  {/* Info Header Bawahan */}
                  <View style={styles.subHeader}>
                    <View style={styles.subProfileRow}>
                      <View style={[styles.subAvatar, { backgroundColor: sub.color || '#4f46e5' }]}>
                        <Text style={styles.subAvatarText}>
                          {sub.name ? sub.name.charAt(0).toUpperCase() : '?'}
                        </Text>
                      </View>
                      <View style={styles.subInfo}>
                        <View style={styles.subNameRow}>
                          <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                          <View style={styles.subLevelBadge}>
                            <Text style={styles.subLevelText}>Lvl {sub.level}: {sub.role || 'Staff'}</Text>
                          </View>
                        </View>
                        <Text style={styles.subDeptText} numberOfLines={1}>
                          {sub.department ? `${sub.department} • ` : ''}
                          {sub.division || ''}
                        </Text>
                      </View>
                    </View>

                    {/* Stats Pill Bawahan */}
                    <View style={styles.subStatsRow}>
                      {hasOverdue && (
                        <View style={styles.badgeRose}>
                          <Text style={styles.badgeRoseText}>{sub.overdueTasks.length} Overdue</Text>
                        </View>
                      )}
                      {hasToday && (
                        <View style={styles.badgeAmber}>
                          <Text style={styles.badgeAmberText}>{sub.todayTasks.length} Hari Ini</Text>
                        </View>
                      )}
                      {!hasOverdue && !hasToday && (
                        <View style={styles.badgeSlate}>
                          <Text style={styles.badgeSlateText}>{sub.totalActive} Tugas</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Tugas Mendesak Bawahan yang Butuh Perhatian */}
                  {urgentTasks.length > 0 && (
                    <View style={styles.urgentTasksSection}>
                      <Text style={styles.urgentSectionTitle}>Tugas Butuh Perhatian Segera:</Text>
                      {urgentTasks.map((t) => {
                        const diff = getDeadlineDiffDays(t.deadline);
                        const isTaskOverdue = diff !== null && diff < 0;

                        return (
                          <View key={t.id} style={styles.urgentTaskRow}>
                            <View style={styles.urgentTaskContent}>
                              <Text style={styles.urgentTaskTitle} numberOfLines={1}>
                                {t.title}
                              </Text>
                              <Text
                                style={[
                                  styles.urgentTaskDeadline,
                                  isTaskOverdue ? styles.textRed : styles.textAmber,
                                ]}
                              >
                                Deadline:{' '}
                                {isTaskOverdue
                                  ? `Lewat ${Math.abs(diff!)} Hari`
                                  : 'Hari Ini'}
                              </Text>
                            </View>

                            {/* Tombol Follow Up WhatsApp Cepat */}
                            <TouchableOpacity
                              style={styles.waReminderBtn}
                              onPress={() => handleSendReminder(t, sub)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="logo-whatsapp" size={14} color="#047857" />
                              <Text style={styles.waReminderText}>Ingatkan</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ===================================================================== */}
      {/* 3. PINTASAN CEPAT (SHORTCUTS)                                         */}
      {/* ===================================================================== */}
      {shortcuts.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBoxSky}>
                  <Ionicons name="globe-outline" size={16} color="#0284c7" />
                </View>
                <Text style={styles.sectionTitle} numberOfLines={1}>Pintasan Portal & Sistem</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>Akses cepat portal kerja & dokumen</Text>
          </View>
          <View style={styles.shortcutGrid}>
            {shortcuts.slice(0, 6).map((sc: Shortcut) => (
              <TouchableOpacity
                key={sc.id}
                style={styles.shortcutCard}
                onPress={() => sc.url && Linking.openURL(sc.url)}
                activeOpacity={0.7}
              >
                <View style={[styles.shortcutIconBox, { backgroundColor: (sc.color || '#3b82f6') + '20' }]}>
                  <Text style={[styles.shortcutIconText, { color: sc.color || '#3b82f6' }]}>
                    {sc.icon || sc.title.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.shortcutTitle} numberOfLines={1}>
                  {sc.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {/* Bebie Chat FAB — hanya untuk role Leader ke atas */}
      {session?.role && session.role !== 'Staff' && (
        <TouchableOpacity
          style={styles.chatFab}
          onPress={() => router.push('/chat')}
          activeOpacity={0.85}
        >
          <Text style={styles.chatFabEmoji}>🌸</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  userBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#db2777',
  },
  divisionBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  divisionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  createTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#db2777',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  createTaskText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardOverdue: {
    backgroundColor: '#ffffff',
    borderColor: '#fecdd3',
    borderLeftWidth: 3.5,
    borderLeftColor: '#ef4444',
  },
  statCardActiveOverdue: {
    backgroundColor: '#fff1f2',
    borderColor: '#f43f5e',
    shadowColor: '#f43f5e',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardToday: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderLeftWidth: 3.5,
    borderLeftColor: '#f59e0b',
  },
  statCardActiveToday: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardUpcoming: {
    backgroundColor: '#ffffff',
    borderColor: '#c7d2fe',
    borderLeftWidth: 3.5,
    borderLeftColor: '#6366f1',
  },
  statCardActiveUpcoming: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  statHintText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionIconBoxAmber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sectionIconBoxViolet: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f5f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sectionIconBoxSky: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    paddingLeft: 40,
  },
  filterPillsWrapper: {
    marginBottom: 14,
    marginHorizontal: -4,
  },
  filterPillsScroll: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPillModern: {
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
  filterPillModernAlert: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  filterPillModernText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillModernTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  filterPillModernTextAlert: {
    color: '#e11d48',
  },
  filterPillCountBubble: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillCountBubbleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterPillCountBubbleAlert: {
    backgroundColor: '#ffe4e6',
  },
  filterPillCountNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillCountNumActive: {
    color: '#ffffff',
  },
  filterPillCountNumAlert: {
    color: '#e11d48',
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 3.5,
    borderLeftColor: '#cbd5e1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  taskCardOverdue: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderLeftColor: '#ef4444',
  },
  taskCardToday: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderLeftColor: '#f59e0b',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 4,
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
  deadlineText: {
    fontSize: 11,
    color: '#64748b',
  },
  deadlineOverdue: {
    color: '#ef4444',
    fontWeight: '700',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 19,
    marginBottom: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  projectTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  projectTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  todoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  todoCountText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  todoItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  todoItemOverdue: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  todoItemToday: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  todoItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  todoItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  todoItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 24,
  },
  todoParentText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  todoDeadlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  textRed: {
    color: '#e11d48',
  },
  textAmber: {
    color: '#d97706',
  },
  overdueAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#fecdd3',
    flexShrink: 0,
  },
  overdueAlertText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#be123c',
  },
  subordinateCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subCardOverdue: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  subCardToday: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  subProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  subAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  subAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  subInfo: {
    flex: 1,
  },
  subNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flexShrink: 1,
  },
  subLevelBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  subLevelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  subDeptText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  subStatsRow: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
    alignItems: 'center',
  },
  badgeRose: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeRoseText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeAmber: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeAmberText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeSlate: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badgeSlateText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '700',
  },
  urgentTasksSection: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 4,
    gap: 6,
  },
  urgentSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  urgentTaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  urgentTaskContent: {
    flex: 1,
  },
  urgentTaskTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  urgentTaskDeadline: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  waReminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  waReminderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyCardText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shortcutCard: {
    width: '31%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  shortcutIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutIconText: {
    fontSize: 12,
    fontWeight: '800',
  },
  shortcutTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  chatFab: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#db2777',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  chatFabEmoji: {
    fontSize: 24,
  },
});
