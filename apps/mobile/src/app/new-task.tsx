import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  fetchInitialData,
  createTask,
  Project,
  Member,
  Role,
  canAccessPersonalProject,
  getRoleLevel,
} from '../../lib/api';

export default function NewTaskScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { picId: initialPicId, projectId: initialProjectId, deadline: initialDeadline } = useLocalSearchParams<{
    picId?: string;
    projectId?: string;
    deadline?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Form States
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [picId, setPicId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('To Do');
  const [deadline, setDeadline] = useState(initialDeadline || '');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    async function loadFormMetadata() {
      try {
        const res = await fetchInitialData(session?.memberId);
        const accessible = res.projects.filter((p) =>
          canAccessPersonalProject(p, session?.memberId)
        );
        setProjects(accessible);
        setRoles(res.roles);

        if (initialProjectId && accessible.some((p) => p.id === initialProjectId)) {
          setProjectId(initialProjectId);
        } else if (accessible.length > 0) {
          setProjectId(accessible[0].id);
        }

        setMembers(res.members);

        if (initialPicId) {
          setPicId(initialPicId);
        } else if (session?.memberId) {
          setPicId(session.memberId);
        }
      } catch (err) {
        console.error('Failed to load projects/members:', err);
      } finally {
        setLoading(false);
      }
    }

    loadFormMetadata();
  }, [session?.memberId, initialPicId, initialProjectId]);

  const handleQuickDeadline = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDeadline(d.toISOString().split('T')[0]);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Perhatian', 'Judul tugas wajib diisi.');
      return;
    }
    if (!projectId) {
      Alert.alert('Perhatian', 'Pilih project / workspace untuk tugas ini.');
      return;
    }

    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        project_id: projectId,
        pic_id: picId || undefined,
        priority,
        status,
        deadline: deadline.trim() || undefined,
        memo: memo.trim() || undefined,
        author_id: session?.memberId,
      });

      Alert.alert('Sukses', 'Tugas baru berhasil dibuat!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Gagal Membuat Tugas', err.message || 'Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  };

  // Identifikasi apakah PIC terpilih adalah bawahan
  const selectedPicObj = useMemo(() => {
    return members.find((m) => m.id === picId);
  }, [members, picId]);

  const isDelegatingToSubordinate = Boolean(
    selectedPicObj && session?.memberId && selectedPicObj.id !== session.memberId
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#db2777" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Delegating Notification Banner */}
      {isDelegatingToSubordinate && (
        <View style={styles.delegationBanner}>
          <Text style={styles.delegationBannerTitle}>
            🎯 Mendelegasikan Tugas ke {selectedPicObj?.name} ({selectedPicObj?.role || 'Bawahan'})
          </Text>
          <Text style={styles.delegationBannerDesc}>
            Tugas ini akan tercatat dalam monitoring radar tim Anda.
          </Text>
        </View>
      )}

      {/* Title */}
      <Text style={styles.label}>Judul Tugas *</Text>
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Tuliskan nama atau deskripsi ringkas tugas..."
        placeholderTextColor="#94a3b8"
        multiline
      />

      {/* Project Selector */}
      <Text style={styles.label}>Pilih Project / Workspace *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          {projects.map((p) => {
            const isSelected = projectId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  isSelected && { backgroundColor: p.color || '#3b82f6', borderColor: p.color || '#3b82f6' },
                ]}
                onPress={() => setProjectId(p.id)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Priority Selector */}
      <Text style={styles.label}>Prioritas</Text>
      <View style={styles.chipRow}>
        {['Low', 'Medium', 'High'].map((pr) => {
          const isSelected = priority === pr;
          const prColor = pr === 'High' ? '#ef4444' : pr === 'Medium' ? '#f59e0b' : '#3b82f6';
          return (
            <TouchableOpacity
              key={pr}
              style={[styles.chip, isSelected && { backgroundColor: prColor, borderColor: prColor }]}
              onPress={() => setPriority(pr)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{pr}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status Selector */}
      <Text style={styles.label}>Status Awal</Text>
      <View style={styles.chipRow}>
        {['To Do', 'In Progress'].map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.chip, status === st && styles.chipActive]}
            onPress={() => setStatus(st)}
          >
            <Text style={[styles.chipText, status === st && styles.chipTextActive]}>{st}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* PIC Selector (Diri Saya vs Anggota Tim) */}
      <Text style={styles.label}>Penanggung Jawab (PIC)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !picId && styles.chipActive]}
            onPress={() => setPicId('')}
          >
            <Text style={[styles.chipText, !picId && styles.chipTextActive]}>Tanpa PIC</Text>
          </TouchableOpacity>

          {members.map((m) => {
            const isSelected = picId === m.id;
            const isMe = session?.memberId === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.chip,
                  isSelected && styles.chipActive,
                  isMe && !isSelected && styles.chipMe,
                ]}
                onPress={() => setPicId(m.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextActive,
                    isMe && !isSelected && styles.chipTextMe,
                  ]}
                >
                  {m.name} {isMe ? '(Saya)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Deadline */}
      <Text style={styles.label}>Batas Waktu (Deadline YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={deadline}
        onChangeText={setDeadline}
        placeholder="YYYY-MM-DD (opsional)"
        placeholderTextColor="#94a3b8"
      />
      <View style={styles.quickDateRow}>
        <TouchableOpacity style={styles.quickDateBtn} onPress={() => handleQuickDeadline(0)}>
          <Text style={styles.quickDateText}>Hari Ini</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickDateBtn} onPress={() => handleQuickDeadline(1)}>
          <Text style={styles.quickDateText}>Besok</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickDateBtn} onPress={() => handleQuickDeadline(7)}>
          <Text style={styles.quickDateText}>+7 Hari</Text>
        </TouchableOpacity>
      </View>

      {/* Memo */}
      <Text style={styles.label}>Catatan Tambahan (Memo)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={memo}
        onChangeText={setMemo}
        placeholder="Rincian instruksi atau catatan tugas..."
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={3}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.createButton, submitting && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.createButtonText}>
            {isDelegatingToSubordinate ? `Tugaskan ke ${selectedPicObj?.name}` : 'Simpan Tugas Baru'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  delegationBanner: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  delegationBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6d28d9',
  },
  delegationBannerDesc: {
    fontSize: 11,
    color: '#7c3aed',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 16,
  },
  titleInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipScroll: {
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#db2777',
    borderColor: '#db2777',
  },
  chipMe: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  chipTextMe: {
    color: '#1d4ed8',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickDateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  quickDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  createButton: {
    backgroundColor: '#db2777',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
