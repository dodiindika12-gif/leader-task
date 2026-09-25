import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  fetchInitialData,
  updateTask,
  Schedule,
  Member,
  Project,
  Task,
  Role,
  ProjectAccess,
  getRoleLevel,
  getAccessibleProjects,
  getAccessibleTasks,
  getAccessibleSchedules,
  isMeetingSchedule,
  isWorksheetSchedule,
} from '../../../lib/api';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DAYS = ['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const padZero = (n: number) => String(n).padStart(2, '0');

const formatDateStr = (y: number, m: number, d: number) => {
  return `${y}-${padZero(m + 1)}-${padZero(d)}`;
};

const formatIndonesianDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export default function SchedulesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const memberId = session?.memberId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projectAccess, setProjectAccess] = useState<ProjectAccess[]>([]);

  // Main Mode: 'calendar' (Kalender Tugas - AbsCalendar) | 'meeting' (Jadwal Rapat) | 'worksheet' (Lembar Kerja)
  const [mainMode, setMainMode] = useState<'calendar' | 'meeting' | 'worksheet'>('calendar');

  // Calendar Ownership Filter: 'my_tasks' (Tugas Saya - default) | 'subordinates' (Bawahan) | 'all' (Semua Tim)
  const [calendarOwnership, setCalendarOwnership] = useState<'my_tasks' | 'subordinates' | 'all'>('my_tasks');

  // Schedule Ownership Filters
  const [meetingOwnership, setMeetingOwnership] = useState<'all' | 'pic' | 'attendee'>('all');
  const [worksheetOwnership, setWorksheetOwnership] = useState<'all' | 'mine' | 'subordinates'>('all');

  // Calendar States
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(
    () => formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()),
    [today]
  );

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Schedule (Meeting & Worksheet) State
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string>('Semua');

  // Structural Hierarchy & Subordinates
  const userLevel = useMemo(() => getRoleLevel(session?.role, roles), [session?.role, roles]);
  const isLeader = userLevel >= 2;

  const subordinateIds = useMemo(() => {
    if (!session || userLevel < 2) return new Set<string>();
    const div = (session.division || '').trim().toLowerCase();
    const subs = members.filter((m) => {
      if (m.id === session.memberId) return false;
      const mLevel = getRoleLevel(m.role || m.position, roles);
      if (userLevel >= 5) return mLevel < 5;
      if (userLevel === 4) {
        return (!div || (m.division || '').trim().toLowerCase() === div) && mLevel < 4;
      }
      if (userLevel === 3) {
        return (!div || (m.division || '').trim().toLowerCase() === div) && mLevel < 3;
      }
      if (userLevel === 2) {
        return (!div || (m.division || '').trim().toLowerCase() === div) && mLevel === 1;
      }
      return false;
    });
    return new Set(subs.map((s) => s.id));
  }, [session, userLevel, roles, members]);

  // Load Initial Data
  const loadData = useCallback(async () => {
    try {
      const res = await fetchInitialData(memberId);
      setTasks(res.tasks);
      setProjects(res.projects);
      setMembers(res.members);
      setSchedules(res.schedules);
      setRoles(res.roles);
      setProjectAccess(res.projectAccess);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
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
          setTasks(res.tasks);
          setProjects(res.projects);
          setMembers(res.members);
          setSchedules(res.schedules);
          setRoles(res.roles);
          setProjectAccess(res.projectAccess);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load calendar data:', err);
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

  // Mappings
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

  // Accessible Datasets (Permissions & Personal Workspace Isolation)
  const accessibleProjects = useMemo(() => {
    return getAccessibleProjects(projects, session, roles, projectAccess);
  }, [projects, session, roles, projectAccess]);

  const accessibleTasks = useMemo(() => {
    return getAccessibleTasks(tasks, projects, session, roles, projectAccess);
  }, [tasks, projects, session, roles, projectAccess]);

  const accessibleSchedules = useMemo(() => {
    return getAccessibleSchedules(schedules, session, members, roles);
  }, [schedules, session, members, roles]);

  // Calendar Logic: Month & Days Calculation (Monday to Sunday)
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const displayFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // 0 = Senin, 6 = Minggu

  const monthName = useMemo(() => {
    return currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const d = new Date();
    d.setDate(1);
    setCurrentMonth(d);
    setSelectedDate(todayStr);
  };

  // Filter Tasks for Calendar with Ownership & Show-in-Calendar Rules
  const visibleTasks = useMemo(() => {
    return accessibleTasks.filter((t) => {
      const pId = t.project_id || t.projectId;
      const proj = projectMap.get(pId || '');

      // 1. Project filter
      if (selectedProjectId !== 'all') {
        if (pId !== selectedProjectId) return false;
      } else {
        // By default on calendar, only show projects where showInCalendar !== false (persis webapp AbsCalendar)
        if (proj && proj.showInCalendar === false) return false;
      }

      // 2. Ownership filter
      const pic = t.pic_id || t.picId;
      if (calendarOwnership === 'my_tasks') {
        if (pic !== memberId) return false;
      } else if (calendarOwnership === 'subordinates') {
        if (!pic || !subordinateIds.has(pic)) return false;
      }

      return true;
    });
  }, [accessibleTasks, selectedProjectId, calendarOwnership, memberId, subordinateIds, projectMap]);

  // Group Tasks by Deadline Date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    visibleTasks.forEach((t) => {
      if (t.deadline) {
        const list = map.get(t.deadline) || [];
        list.push(t);
        map.set(t.deadline, list);
      }
    });
    return map;
  }, [visibleTasks]);

  // Tasks in Current Month
  const currentMonthTaskCount = useMemo(() => {
    const monthPrefix = `${year}-${padZero(month + 1)}`;
    return visibleTasks.filter((t) => t.deadline && t.deadline.startsWith(monthPrefix)).length;
  }, [visibleTasks, year, month]);

  // Calendar Grid Cells
  const calendarCells = useMemo(() => {
    const cells: Array<{
      day: number;
      isCurrentMonth: boolean;
      dateStr: string;
    }> = [];

    // Previous month trailing days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = displayFirstDay - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      cells.push({
        day: d,
        isCurrentMonth: false,
        dateStr: formatDateStr(prevY, prevM, d),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        isCurrentMonth: true,
        dateStr: formatDateStr(year, month, d),
      });
    }

    // Next month trailing days to complete grid rows
    const totalSlots = Math.ceil(cells.length / 7) * 7;
    const remaining = totalSlots - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      cells.push({
        day: d,
        isCurrentMonth: false,
        dateStr: formatDateStr(nextY, nextM, d),
      });
    }

    return cells;
  }, [year, month, displayFirstDay, daysInMonth]);

  // Tasks for the currently selected date
  const selectedDateTasks = useMemo(() => {
    return tasksByDate.get(selectedDate) || [];
  }, [tasksByDate, selectedDate]);

  // Toggle Task Completion
  const handleToggleDone = async (task: Task) => {
    const isDone = task.status === 'Done';
    const nextStatus = isDone ? 'To Do' : 'Done';

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await updateTask(task.id, { status: nextStatus });
    } catch (err) {
      console.error('Failed to toggle task in calendar:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  };

  // Schedule filtering (Meetings / Worksheets) with ownership
  const filteredSchedules = useMemo(() => {
    return accessibleSchedules.filter((s) => {
      const isMeeting = isMeetingSchedule(s);
      const targetMatch = mainMode === 'meeting' ? isMeeting : !isMeeting;
      if (!targetMatch) return false;

      if (selectedScheduleDay !== 'Semua' && s.day !== selectedScheduleDay) return false;

      const pic = s.pic_id || s.picId;
      const isOwner = pic === memberId;
      const isAttendee = Array.isArray(s.attendees) && s.attendees.includes(memberId || '');
      const isSubordinate = Boolean(pic && subordinateIds.has(pic));

      if (mainMode === 'meeting') {
        if (meetingOwnership === 'pic' && !isOwner) return false;
        if (meetingOwnership === 'attendee' && !isAttendee) return false;
      } else if (mainMode === 'worksheet') {
        if (worksheetOwnership === 'mine' && !isOwner) return false;
        if (worksheetOwnership === 'subordinates' && !isSubordinate) return false;
      }

      return true;
    });
  }, [accessibleSchedules, mainMode, selectedScheduleDay, memberId, meetingOwnership, worksheetOwnership, subordinateIds]);

  // Render Schedule Card (for Meeting / Worksheet)
  const renderScheduleCard = ({ item }: { item: Schedule }) => {
    const pic = item.pic_id || item.picId ? memberMap.get(item.pic_id || item.picId || '') : null;
    const accentColor = item.color || (mainMode === 'meeting' ? '#6366f1' : '#0284c7');
    const isOwner = (item.pic_id || item.picId) === memberId;
    const isAttendee = Array.isArray(item.attendees) && item.attendees.includes(memberId || '');
    const isSubordinate = Boolean(pic && subordinateIds.has(pic.id));

    return (
      <View style={styles.scheduleCard}>
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.headerBadgesRow}>
              <View style={[styles.dayBadge, { backgroundColor: accentColor + '15' }]}>
                <Text style={[styles.dayBadgeText, { color: accentColor }]}>
                  {item.day || 'Senin'}
                </Text>
              </View>
              {mainMode === 'meeting' ? (
                isOwner ? (
                  <View style={styles.myOwnershipBadge}>
                    <Text style={styles.myOwnershipBadgeText}>PIC Saya</Text>
                  </View>
                ) : isAttendee ? (
                  <View style={styles.attendeeOwnershipBadge}>
                    <Text style={styles.attendeeOwnershipBadgeText}>Peserta</Text>
                  </View>
                ) : null
              ) : (
                isOwner ? (
                  <View style={styles.myOwnershipBadge}>
                    <Text style={styles.myOwnershipBadgeText}>Milik Saya</Text>
                  </View>
                ) : isSubordinate ? (
                  <View style={styles.subordinateOwnershipBadge}>
                    <Text style={styles.subordinateOwnershipBadgeText}>Bawahan</Text>
                  </View>
                ) : null
              )}
            </View>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={13} color="#64748b" />
              <Text style={styles.timeText}>
                {item.startTime || item.start_time || '09:00'} - {item.endTime || item.end_time || 'Selesai'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{item.title}</Text>

          {Boolean(item.location) && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          )}

          {pic && (
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={14} color="#64748b" />
              <Text style={styles.metaText}>PIC: {pic.name}</Text>
            </View>
          )}

          {Boolean(item.notes) && (
            <Text style={styles.notesText} numberOfLines={2}>
              {item.notes}
            </Text>
          )}

          {Array.isArray(item.attendees) && item.attendees.length > 0 && (
            <View style={styles.attendeesContainer}>
              <Text style={styles.attendeesLabel}>Peserta:</Text>
              <View style={styles.attendeesRow}>
                {item.attendees.slice(0, 4).map((attId, idx) => {
                  const m = memberMap.get(attId);
                  const initial = m ? m.name.charAt(0).toUpperCase() : '?';
                  return (
                    <View
                      key={idx}
                      style={[styles.avatarCircle, { backgroundColor: m?.color || '#3b82f6' }]}
                    >
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                  );
                })}
                {item.attendees.length > 4 && (
                  <Text style={styles.moreAttendeesText}>+{item.attendees.length - 4}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ===================================================================== */}
      {/* 1. MAIN MODE SEGMENTATION BAR                                         */}
      {/* ===================================================================== */}
      <View style={styles.mainModeBar}>
        <TouchableOpacity
          style={[styles.mainModeBtn, mainMode === 'calendar' && styles.mainModeBtnActivePink]}
          onPress={() => setMainMode('calendar')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="calendar"
            size={14}
            color={mainMode === 'calendar' ? '#ffffff' : '#64748b'}
          />
          <Text
            style={[styles.mainModeText, mainMode === 'calendar' && styles.mainModeTextActive]}
            numberOfLines={1}
          >
            Kalender Tugas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainModeBtn, mainMode === 'meeting' && styles.mainModeBtnActiveIndigo]}
          onPress={() => setMainMode('meeting')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="people-outline"
            size={14}
            color={mainMode === 'meeting' ? '#ffffff' : '#64748b'}
          />
          <Text
            style={[styles.mainModeText, mainMode === 'meeting' && styles.mainModeTextActive]}
            numberOfLines={1}
          >
            Jadwal Rapat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainModeBtn, mainMode === 'worksheet' && styles.mainModeBtnActiveSky]}
          onPress={() => setMainMode('worksheet')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="layers-outline"
            size={14}
            color={mainMode === 'worksheet' ? '#ffffff' : '#64748b'}
          />
          <Text
            style={[styles.mainModeText, mainMode === 'worksheet' && styles.mainModeTextActive]}
            numberOfLines={1}
          >
            Lembar Kerja
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===================================================================== */}
      {/* 2. MAIN CONTENT AREA                                                  */}
      {/* ===================================================================== */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#db2777" />
          <Text style={styles.loadingText}>Memuat kalender & jadwal...</Text>
        </View>
      ) : mainMode === 'calendar' ? (
        <ScrollView
          style={styles.calendarScrollView}
          contentContainerStyle={styles.calendarScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#db2777']} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* 2A. CALENDAR OWNERSHIP FILTER (Tugas Saya vs Bawahan vs Semua Tim) */}
          <View style={styles.calendarOwnershipBar}>
            <TouchableOpacity
              style={[
                styles.calOwnerChip,
                calendarOwnership === 'my_tasks' && styles.calOwnerChipActive,
              ]}
              onPress={() => setCalendarOwnership('my_tasks')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="person"
                size={13}
                color={calendarOwnership === 'my_tasks' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.calOwnerText,
                  calendarOwnership === 'my_tasks' && styles.calOwnerTextActive,
                ]}
              >
                Tugas Saya
              </Text>
            </TouchableOpacity>

            {isLeader && (
              <TouchableOpacity
                style={[
                  styles.calOwnerChip,
                  calendarOwnership === 'subordinates' && styles.calOwnerChipActive,
                ]}
                onPress={() => setCalendarOwnership('subordinates')}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="people"
                  size={13}
                  color={calendarOwnership === 'subordinates' ? '#ffffff' : '#64748b'}
                />
                <Text
                  style={[
                    styles.calOwnerText,
                    calendarOwnership === 'subordinates' && styles.calOwnerTextActive,
                  ]}
                >
                  Bawahan ({subordinateIds.size})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.calOwnerChip,
                calendarOwnership === 'all' && styles.calOwnerChipActive,
              ]}
              onPress={() => setCalendarOwnership('all')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="grid-outline"
                size={13}
                color={calendarOwnership === 'all' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.calOwnerText,
                  calendarOwnership === 'all' && styles.calOwnerTextActive,
                ]}
              >
                Semua Tim
              </Text>
            </TouchableOpacity>
          </View>

          {/* Project Filter Chips Bar */}
          <View style={styles.projectFilterWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.projectChipsContainer}
            >
              <TouchableOpacity
                style={[
                  styles.projectChip,
                  selectedProjectId === 'all' && styles.projectChipActive,
                ]}
                onPress={() => setSelectedProjectId('all')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.projectChipText,
                    selectedProjectId === 'all' && styles.projectChipTextActive,
                  ]}
                >
                  Semua Workspace
                </Text>
                <View
                  style={[
                    styles.chipCountBubble,
                    selectedProjectId === 'all' && styles.chipCountBubbleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      selectedProjectId === 'all' && styles.chipCountTextActive,
                    ]}
                  >
                    {visibleTasks.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {accessibleProjects.map((proj) => {
                const isSelected = selectedProjectId === proj.id;
                const projColor = proj.color || '#3b82f6';
                const count = accessibleTasks.filter((t) => (t.project_id || t.projectId) === proj.id).length;

                return (
                  <TouchableOpacity
                    key={proj.id}
                    style={[
                      styles.projectChip,
                      isSelected && { backgroundColor: projColor, borderColor: projColor },
                    ]}
                    onPress={() => setSelectedProjectId(proj.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.projectChipDot, { backgroundColor: projColor }]} />
                    <Text
                      style={[
                        styles.projectChipText,
                        isSelected && styles.projectChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {proj.name}
                    </Text>
                    {proj.showInCalendar === false && (
                      <Ionicons
                        name="eye-off-outline"
                        size={11}
                        color={isSelected ? '#ffffff' : '#94a3b8'}
                        style={{ marginLeft: 3 }}
                      />
                    )}
                    <View
                      style={[
                        styles.chipCountBubble,
                        isSelected && styles.chipCountBubbleActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipCountText,
                          isSelected && styles.chipCountTextActive,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Month Header & Navigator Card */}
          <View style={styles.monthNavCard}>
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={prevMonth}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={18} color="#0f172a" />
              </TouchableOpacity>

              <View style={styles.monthTitleWrapper}>
                <Text style={styles.monthTitleText}>{monthName}</Text>
                <View style={styles.monthTaskBadge}>
                  <Text style={styles.monthTaskBadgeText}>{currentMonthTaskCount} task</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={nextMonth}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={18} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.75}>
              <Ionicons name="today-outline" size={13} color="#db2777" />
              <Text style={styles.todayBtnText}>Hari Ini</Text>
            </TouchableOpacity>
          </View>

          {/* Monthly 7-Column Calendar Grid */}
          <View style={styles.calendarGridCard}>
            {/* Weekday Row Header */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((wd, idx) => (
                <View key={wd} style={styles.weekdayCell}>
                  <Text
                    style={[
                      styles.weekdayText,
                      (idx === 5 || idx === 6) && styles.weekdayTextWeekend,
                    ]}
                  >
                    {wd}
                  </Text>
                </View>
              ))}
            </View>

            {/* Day Grid Cells */}
            <View style={styles.daysGrid}>
              {calendarCells.map((cell, idx) => {
                const isSelected = selectedDate === cell.dateStr;
                const isCurrentToday = cell.dateStr === todayStr;
                const dateTasks = tasksByDate.get(cell.dateStr) || [];
                const hasTasks = dateTasks.length > 0;
                const hasOverdue = dateTasks.some((t) => t.status !== 'Done' && cell.dateStr < todayStr);

                return (
                  <TouchableOpacity
                    key={`${cell.dateStr}-${idx}`}
                    style={[
                      styles.dayCell,
                      !cell.isCurrentMonth && styles.dayCellOutsideMonth,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedDate(cell.dateStr)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dayNumberCircle,
                        isCurrentToday && styles.dayNumberCircleToday,
                        isSelected && !isCurrentToday && styles.dayNumberCircleSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumberText,
                          !cell.isCurrentMonth && styles.dayNumberTextMuted,
                          isCurrentToday && styles.dayNumberTextToday,
                          isSelected && !isCurrentToday && styles.dayNumberTextSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>

                    {/* Task Indicators */}
                    <View style={styles.indicatorsRow}>
                      {hasTasks && (
                        dateTasks.slice(0, 3).map((t, tIdx) => {
                          const proj = projectMap.get(t.project_id || t.projectId || '');
                          const dotColor =
                            t.status === 'Done'
                              ? '#10b981'
                              : hasOverdue
                              ? '#ef4444'
                              : proj?.color || '#3b82f6';
                          return (
                            <View
                              key={tIdx}
                              style={[styles.taskDot, { backgroundColor: dotColor }]}
                            />
                          );
                        })
                      )}
                      {dateTasks.length > 3 && (
                        <View style={styles.moreDot}>
                          <Text style={styles.moreDotText}>+{dateTasks.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ================================================================= */}
          {/* 3. SELECTED DATE AGENDA / TASK LIST SECTION                       */}
          {/* ================================================================= */}
          <View style={styles.agendaCard}>
            <View style={styles.agendaHeaderRow}>
              <View style={styles.agendaTitleBlock}>
                <View style={styles.agendaDateRow}>
                  <Ionicons name="calendar-outline" size={15} color="#db2777" />
                  <Text style={styles.agendaDateTitle} numberOfLines={1}>
                    {formatIndonesianDate(selectedDate)}
                  </Text>
                </View>
                <Text style={styles.agendaSubtitle}>
                  {selectedDate === todayStr ? 'Hari ini' : selectedDate} •{' '}
                  <Text style={styles.agendaTaskCount}>{selectedDateTasks.length} Tugas</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addTaskBtn}
                onPress={() => router.push(`/new-task?deadline=${selectedDate}`)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={15} color="#ffffff" />
                <Text style={styles.addTaskBtnText}>Tugas</Text>
              </TouchableOpacity>
            </View>

            {/* List of Tasks for Selected Date */}
            {selectedDateTasks.length === 0 ? (
              <View style={styles.emptyDateBox}>
                <Ionicons name="checkmark-circle-outline" size={36} color="#cbd5e1" />
                <Text style={styles.emptyDateTitle}>Tidak ada tenggat waktu</Text>
                <Text style={styles.emptyDateSubtitle}>
                  Belum ada tugas yang dijadwalkan selesai pada tanggal ini.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => router.push(`/new-task?deadline=${selectedDate}`)}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#db2777" />
                  <Text style={styles.emptyAddBtnText}>Buat Tugas untuk Tanggal Ini</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.agendaTasksList}>
                {selectedDateTasks.map((t) => {
                  const isDone = t.status === 'Done';
                  const proj = projectMap.get(t.project_id || t.projectId || '');
                  const pic = (t.pic_id || t.picId) ? memberMap.get(t.pic_id || t.picId || '') : null;
                  const priorityColor =
                    t.priority === 'High' ? '#ef4444' : t.priority === 'Medium' ? '#f59e0b' : '#3b82f6';

                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.agendaTaskItem,
                        isDone && styles.agendaTaskItemDone,
                      ]}
                      onPress={() => router.push(`/task/${t.id}`)}
                      activeOpacity={0.7}
                    >
                      {/* Checkbox */}
                      <TouchableOpacity
                        style={[styles.checkbox, isDone && styles.checkboxDone]}
                        onPress={() => handleToggleDone(t)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isDone && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                      </TouchableOpacity>

                      {/* Content */}
                      <View style={styles.taskContentBox}>
                        <View style={styles.taskBadgeRow}>
                          {proj && (
                            <View
                              style={[
                                styles.projBadge,
                                { backgroundColor: (proj.color || '#3b82f6') + '15' },
                              ]}
                            >
                              <View
                                style={[
                                  styles.projDot,
                                  { backgroundColor: proj.color || '#3b82f6' },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.projBadgeText,
                                  { color: proj.color || '#3b82f6' },
                                ]}
                                numberOfLines={1}
                              >
                                {proj.name}
                              </Text>
                            </View>
                          )}

                          {Boolean(t.folder) && t.folder !== 'General' && (
                            <View style={styles.folderBadge}>
                              <Ionicons name="folder-open-outline" size={10} color="#64748b" />
                              <Text style={styles.folderBadgeText}>{t.folder}</Text>
                            </View>
                          )}

                          <View
                            style={[
                              styles.priorityBadge,
                              { backgroundColor: priorityColor + '15' },
                            ]}
                          >
                            <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>
                              {t.priority || 'Normal'}
                            </Text>
                          </View>

                          {/* Ownership Tag: Tugas Saya vs Tim */}
                          {(t.pic_id === memberId || t.picId === memberId) ? (
                            <View style={styles.myTaskTag}>
                              <Ionicons name="person" size={9} color="#2563eb" />
                              <Text style={styles.myTaskTagText}>Tugas Saya</Text>
                            </View>
                          ) : (
                            <View style={styles.teamTaskTag}>
                              <Text style={styles.teamTaskTagText}>Tim</Text>
                            </View>
                          )}
                        </View>

                        <Text
                          style={[styles.taskItemTitle, isDone && styles.taskItemTitleDone]}
                          numberOfLines={2}
                        >
                          {t.title}
                        </Text>

                        {pic && (
                          <View style={styles.taskFooterRow}>
                            <View style={styles.picRow}>
                              <View
                                style={[
                                  styles.picAvatarMini,
                                  { backgroundColor: pic.color || '#6366f1' },
                                ]}
                              >
                                <Text style={styles.picAvatarText}>
                                  {pic.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.picNameText}>
                                {pic.name}
                                {subordinateIds.has(pic.id) ? ' (Bawahan)' : ''}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>

                      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        /* =================================================================== */
        /* 4. JADWAL RAPAT & LEMBAR KERJA MODE                                  */
        /* =================================================================== */
        <View style={{ flex: 1 }}>
          {/* Schedule Ownership Segmented Bar */}
          {mainMode === 'meeting' && (
            <View style={styles.scheduleOwnershipBar}>
              <TouchableOpacity
                style={[
                  styles.schOwnerChip,
                  meetingOwnership === 'all' && styles.schOwnerChipActiveIndigo,
                ]}
                onPress={() => setMeetingOwnership('all')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.schOwnerText,
                    meetingOwnership === 'all' && styles.schOwnerTextActive,
                  ]}
                >
                  Semua Rapat
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.schOwnerChip,
                  meetingOwnership === 'pic' && styles.schOwnerChipActiveIndigo,
                ]}
                onPress={() => setMeetingOwnership('pic')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.schOwnerText,
                    meetingOwnership === 'pic' && styles.schOwnerTextActive,
                  ]}
                >
                  PIC Rapat Saya
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.schOwnerChip,
                  meetingOwnership === 'attendee' && styles.schOwnerChipActiveIndigo,
                ]}
                onPress={() => setMeetingOwnership('attendee')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.schOwnerText,
                    meetingOwnership === 'attendee' && styles.schOwnerTextActive,
                  ]}
                >
                  Sebagai Peserta
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mainMode === 'worksheet' && (
            <View style={styles.scheduleOwnershipBar}>
              <TouchableOpacity
                style={[
                  styles.schOwnerChip,
                  worksheetOwnership === 'all' && styles.schOwnerChipActiveSky,
                ]}
                onPress={() => setWorksheetOwnership('all')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.schOwnerText,
                    worksheetOwnership === 'all' && styles.schOwnerTextActive,
                  ]}
                >
                  Semua Lembar Kerja
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.schOwnerChip,
                  worksheetOwnership === 'mine' && styles.schOwnerChipActiveSky,
                ]}
                onPress={() => setWorksheetOwnership('mine')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.schOwnerText,
                    worksheetOwnership === 'mine' && styles.schOwnerTextActive,
                  ]}
                >
                  Milik Saya
                </Text>
              </TouchableOpacity>
              {isLeader && (
                <TouchableOpacity
                  style={[
                    styles.schOwnerChip,
                    worksheetOwnership === 'subordinates' && styles.schOwnerChipActiveSky,
                  ]}
                  onPress={() => setWorksheetOwnership('subordinates')}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.schOwnerText,
                      worksheetOwnership === 'subordinates' && styles.schOwnerTextActive,
                    ]}
                  >
                    Bawahan ({subordinateIds.size})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Day Filter Horizontal Scroll */}
          <View style={styles.dayScrollWrapper}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={DAYS}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.dayList}
              renderItem={({ item }) => {
                const isSelected = selectedScheduleDay === item;
                return (
                  <TouchableOpacity
                    style={[styles.dayChip, isSelected && styles.dayChipActive]}
                    onPress={() => setSelectedScheduleDay(item)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        isSelected && styles.dayChipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Schedule List */}
          <FlatList
            data={filteredSchedules}
            keyExtractor={(item) => item.id}
            renderItem={renderScheduleCard}
            contentContainerStyle={styles.scheduleListContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#db2777']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>Tidak ada jadwal</Text>
                <Text style={styles.emptySubtitle}>
                  Belum ada agenda {mainMode === 'meeting' ? 'rapat' : 'lembar kerja'} untuk hari ini.
                </Text>
              </View>
            }
          />
        </View>
      )}
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
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    gap: 5,
  },
  mainModeBtnActivePink: {
    backgroundColor: '#db2777',
  },
  mainModeBtnActiveIndigo: {
    backgroundColor: '#6366f1',
  },
  mainModeBtnActiveSky: {
    backgroundColor: '#0284c7',
  },
  mainModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  mainModeTextActive: {
    color: '#ffffff',
  },

  // 2. Calendar Scroll
  calendarScrollView: {
    flex: 1,
  },
  calendarScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 40,
  },

  // Project Filter Chips
  projectFilterWrapper: {
    marginBottom: 12,
    marginHorizontal: -14,
  },
  projectChipsContainer: {
    paddingHorizontal: 14,
    gap: 8,
  },
  projectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  projectChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  projectChipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  projectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  projectChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  chipCountBubble: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  chipCountBubbleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  chipCountTextActive: {
    color: '#ffffff',
  },

  // Month Navigator Card
  monthNavCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  monthTaskBadge: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  monthTaskBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#db2777',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#db2777',
  },

  // Calendar Grid Card
  calendarGridCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  weekdaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  weekdayTextWeekend: {
    color: '#ef4444',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: 10,
  },
  dayCellOutsideMonth: {
    opacity: 0.35,
  },
  dayCellSelected: {
    backgroundColor: '#fdf2f8',
    borderWidth: 1.5,
    borderColor: '#db2777',
  },
  dayNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberCircleToday: {
    backgroundColor: '#db2777',
  },
  dayNumberCircleSelected: {
    backgroundColor: 'transparent',
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  dayNumberTextMuted: {
    color: '#94a3b8',
  },
  dayNumberTextToday: {
    color: '#ffffff',
    fontWeight: '800',
  },
  dayNumberTextSelected: {
    color: '#db2777',
    fontWeight: '800',
  },
  indicatorsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    height: 5,
    alignItems: 'center',
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  moreDot: {
    marginLeft: 1,
  },
  moreDotText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#64748b',
    lineHeight: 7,
  },

  // Selected Date Agenda
  agendaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  agendaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 10,
    gap: 8,
  },
  agendaTitleBlock: {
    flex: 1,
  },
  agendaDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agendaDateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  agendaSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  agendaTaskCount: {
    fontWeight: '700',
    color: '#db2777',
  },
  addTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#db2777',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  addTaskBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyDateBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyDateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  emptyDateSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 240,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  emptyAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#db2777',
  },
  agendaTasksList: {
    gap: 8,
  },
  agendaTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  agendaTaskItemDone: {
    backgroundColor: '#f1f5f9',
    opacity: 0.75,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  taskContentBox: {
    flex: 1,
  },
  taskBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  projBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  projDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  projBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  folderBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  priorityBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  taskItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  taskItemTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  taskFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  picRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  picAvatarMini: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picAvatarText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  picNameText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },

  // Schedules (Meeting / Worksheet) styles
  dayScrollWrapper: {
    marginBottom: 10,
    marginTop: 8,
  },
  dayList: {
    paddingHorizontal: 14,
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  dayChipTextActive: {
    color: '#ffffff',
  },
  scheduleListContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
    gap: 10,
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  accentBar: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  notesText: {
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  attendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  attendeesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
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
    fontSize: 9,
    fontWeight: '800',
  },
  moreAttendeesText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },

  // Calendar Ownership Bar
  calendarOwnershipBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  calOwnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calOwnerChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  calOwnerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  calOwnerTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Task Ownership Tags on Agenda Card
  myTaskTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myTaskTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  teamTaskTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  teamTaskTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
  },

  // Schedule Ownership Segmented Bar
  scheduleOwnershipBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
  },
  schOwnerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  schOwnerChipActiveIndigo: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  schOwnerChipActiveSky: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  schOwnerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  schOwnerTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Card Header Badges
  headerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  myOwnershipBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myOwnershipBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  attendeeOwnershipBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attendeeOwnershipBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7e22ce',
  },
  subordinateOwnershipBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subordinateOwnershipBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369a1',
  },
});
