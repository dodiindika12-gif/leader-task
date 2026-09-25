import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import {
  supabase,
  updateTask,
  deleteTask,
  Task,
  TaskTodo,
  TaskProofFile,
  Member,
  Project,
  getDeadlineDiffDays,
  createWhatsAppReminderUrl,
  uploadTaskProofFile,
  createLinkProof,
  deleteTaskProofFile,
} from '../../../lib/api';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImageFile(ext?: string, mimeType?: string, url?: string): boolean {
  const cleanExt = (ext || '').toLowerCase().replace(/^\./, '');
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(cleanExt)) return true;
  if (mimeType && mimeType.startsWith('image/')) return true;
  if (url && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url)) return true;
  return false;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [pic, setPic] = useState<Member | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);

  // Form states
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('To Do');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [picId, setPicId] = useState('');
  const [memo, setMemo] = useState('');
  const [todos, setTodos] = useState<TaskTodo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [proofFiles, setProofFiles] = useState<TaskProofFile[]>([]);

  // Proof upload & preview states
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadProgressMessage, setUploadProgressMessage] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');

  useEffect(() => {
    async function loadTaskDetail() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          Alert.alert('Error', 'Tugas tidak ditemukan.');
          router.back();
          return;
        }

        const rawTodos = Array.isArray(data.todos) ? data.todos : [];
        const cleanTodos = rawTodos.filter((t: any) => t && t.id !== '__meta_task_props__' && !t.isMetaTask);

        const rawProofs = Array.isArray(data.proof_files)
          ? data.proof_files
          : Array.isArray(data.proofFiles)
          ? data.proofFiles
          : [];

        setTask(data);
        setTitle(data.title || '');
        setStatus(data.status || 'To Do');
        setPriority(data.priority || 'Medium');
        setDeadline(data.deadline || '');
        setPicId(data.pic_id || '');
        setMemo(data.memo || '');
        setTodos(cleanTodos);
        setProofFiles(rawProofs);

        // Fetch project info
        if (data.project_id) {
          const { data: pData } = await supabase
            .from('projects')
            .select('*')
            .eq('id', data.project_id)
            .single();
          if (pData) setProject(pData);
        }

        // Fetch all members for PIC selection
        const { data: mList } = await supabase
          .from('members')
          .select('*')
          .order('name', { ascending: true });
        if (mList) {
          setAllMembers(mList);
          const currentPic = mList.find((m) => m.id === data.pic_id);
          if (currentPic) setPic(currentPic);
        }
      } catch (err) {
        console.error('Error loading task detail:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTaskDetail();
  }, [id, router]);

  const handleToggleTodo = (index: number) => {
    setTodos((prev) =>
      prev.map((td, i) => (i === index ? { ...td, done: !td.done } : td))
    );
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const newTd: TaskTodo = {
      id: 'todo_' + Date.now(),
      text: newTodoText.trim(),
      done: false,
    };
    setTodos((prev) => [...prev, newTd]);
    setNewTodoText('');
  };

  const handleDeleteTodo = (index: number) => {
    setTodos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await updateTask(task.id, {
        title,
        status,
        priority,
        deadline: deadline.trim() || null,
        pic_id: picId || null,
        memo: memo.trim() || null,
        todos,
        proof_files: proofFiles,
      } as any);

      Alert.alert('Sukses', 'Perubahan berhasil disimpan!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!task) return;
    Alert.alert('Hapus Tugas', 'Apakah Anda yakin ingin menghapus tugas ini secara permanen?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task.id);
            router.back();
          } catch (err: any) {
            Alert.alert('Gagal Hapus', err.message);
          }
        },
      },
    ]);
  };

  const handleSendWhatsApp = () => {
    if (!task || !pic) return;
    const url = createWhatsAppReminderUrl(task, pic);
    Linking.openURL(url);
  };

  // ----------------------------------------------------
  // Proof of Work (Bukti Tugas) Handlers
  // ----------------------------------------------------
  const handlePickCamera = async () => {
    if (!task) return;
    try {
      const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(
          'Izin Kamera Diperlukan',
          'Harap berikan izin akses kamera di pengaturan perangkat untuk mengambil foto bukti tugas.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploadingProof(true);
        setUploadProgressMessage('Mengunggah foto bukti...');

        const newFile = await uploadTaskProofFile({
          uri: asset.uri,
          taskId: task.id,
          uploadedBy: session?.name || 'Staff',
          uploadedById: session?.memberId,
          fileName: asset.fileName || `foto_bukti_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        });

        const updated = [...proofFiles, newFile];
        setProofFiles(updated);

        // Immediate sync to database
        await updateTask(task.id, { proof_files: updated } as any);
        Alert.alert('Sukses', 'Foto bukti tugas berhasil diunggah.');
      }
    } catch (err: any) {
      console.error('Camera upload error:', err);
      Alert.alert('Gagal Mengunggah', err.message || 'Terjadi kesalahan saat memproses foto.');
    } finally {
      setUploadingProof(false);
      setUploadProgressMessage('');
    }
  };

  const handlePickGallery = async () => {
    if (!task) return;
    try {
      const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(
          'Izin Galeri Diperlukan',
          'Harap berikan izin akses galeri foto untuk memilih berkas bukti tugas.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingProof(true);
        const uploadedList: TaskProofFile[] = [];

        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          setUploadProgressMessage(`Mengunggah gambar (${i + 1}/${result.assets.length})...`);

          const newFile = await uploadTaskProofFile({
            uri: asset.uri,
            taskId: task.id,
            uploadedBy: session?.name || 'Staff',
            uploadedById: session?.memberId,
            fileName: asset.fileName || `gambar_bukti_${Date.now()}_${i + 1}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
          });

          uploadedList.push(newFile);
        }

        const updated = [...proofFiles, ...uploadedList];
        setProofFiles(updated);

        // Immediate sync to database
        await updateTask(task.id, { proof_files: updated } as any);
        Alert.alert('Sukses', `${uploadedList.length} bukti foto berhasil diunggah.`);
      }
    } catch (err: any) {
      console.error('Gallery upload error:', err);
      Alert.alert('Gagal Mengunggah', err.message || 'Terjadi kesalahan saat memproses gambar.');
    } finally {
      setUploadingProof(false);
      setUploadProgressMessage('');
    }
  };

  const handleSaveLinkProof = async () => {
    if (!task || !linkUrlInput.trim()) {
      Alert.alert('Perhatian', 'Masukkan URL tautan bukti terlebih dahulu.');
      return;
    }

    const newLinkFile = createLinkProof({
      url: linkUrlInput.trim(),
      title: linkTitleInput.trim() || undefined,
      uploadedBy: session?.name || 'Staff',
      uploadedById: session?.memberId,
    });

    const updated = [...proofFiles, newLinkFile];
    setProofFiles(updated);
    setLinkModalVisible(false);
    setLinkUrlInput('');
    setLinkTitleInput('');

    try {
      await updateTask(task.id, { proof_files: updated } as any);
      Alert.alert('Sukses', 'Tautan bukti berhasil ditambahkan.');
    } catch (err) {
      console.error('Failed to sync link proof:', err);
    }
  };

  const handleDeleteProof = (file: TaskProofFile) => {
    if (!task) return;
    Alert.alert('Hapus Bukti', `Apakah Anda yakin ingin menghapus berkas "${file.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const updated = proofFiles.filter((f) => f.id !== file.id);
          setProofFiles(updated);
          try {
            await updateTask(task.id, { proof_files: updated } as any);
            if (file.path) {
              await deleteTaskProofFile(file.path);
            }
          } catch (err) {
            console.error('Failed to delete proof file:', err);
          }
        },
      },
    ]);
  };

  const handleProofItemPress = (file: TaskProofFile) => {
    if (isImageFile(file.ext, file.mimeType, file.url)) {
      setPreviewImageUrl(file.url);
    } else if (file.url) {
      Linking.openURL(file.url);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#db2777" />
      </View>
    );
  }

  const diff = getDeadlineDiffDays(deadline);
  const isOverdue = status !== 'Done' && diff !== null && diff < 0;
  const isToday = status !== 'Done' && diff === 0;
  const isSubordinatePic = pic && session?.memberId && pic.id !== session.memberId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Project & PIC Badge Header */}
      <View style={styles.metaHeader}>
        {project && (
          <View style={[styles.projectBadge, { backgroundColor: (project.color || '#3b82f6') + '20' }]}>
            <Ionicons name="folder-outline" size={14} color={project.color || '#3b82f6'} />
            <Text style={[styles.projectBadgeText, { color: project.color || '#3b82f6' }]}>
              {project.name}
            </Text>
          </View>
        )}
        {pic && (
          <View style={[styles.picBadge, isSubordinatePic && styles.picBadgeSubordinate]}>
            <Ionicons
              name="person-outline"
              size={14}
              color={isSubordinatePic ? '#7c3aed' : '#64748b'}
            />
            <Text style={[styles.picBadgeText, isSubordinatePic && styles.picBadgeTextSubordinate]}>
              {pic.name} {pic.role ? `(${pic.role})` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* WhatsApp Reminder Follow-Up Button (Khusus jika tugas milik bawahan) */}
      {isSubordinatePic && status !== 'Done' && (
        <TouchableOpacity
          style={styles.waReminderBanner}
          onPress={handleSendWhatsApp}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#047857" />
          <View style={{ flex: 1 }}>
            <Text style={styles.waReminderTitle}>Kirim Pengingat WhatsApp ke {pic.name}</Text>
            <Text style={styles.waReminderDesc}>
              {isOverdue
                ? 'Tugas sudah melewati batas waktu'
                : isToday
                ? 'Tugas jatuh tempo hari ini'
                : 'Follow-up progres pengerjaan'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#047857" />
        </TouchableOpacity>
      )}

      {/* Task Title */}
      <Text style={styles.label}>Judul Tugas *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Judul tugas..."
      />

      {/* Status Picker */}
      <Text style={styles.label}>Status Pengerjaan</Text>
      <View style={styles.chipRow}>
        {['To Do', 'In Progress', 'Done'].map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.chip, status === st && styles.chipActive]}
            onPress={() => setStatus(st)}
          >
            <Text style={[styles.chipText, status === st && styles.chipTextActive]}>
              {st}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Priority Picker */}
      <Text style={styles.label}>Prioritas</Text>
      <View style={styles.chipRow}>
        {['Low', 'Medium', 'High', 'Urgent'].map((pr) => (
          <TouchableOpacity
            key={pr}
            style={[styles.chip, priority === pr && styles.chipActive]}
            onPress={() => setPriority(pr)}
          >
            <Text style={[styles.chipText, priority === pr && styles.chipTextActive]}>
              {pr}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* PIC Selection */}
      <Text style={styles.label}>Penanggung Jawab (PIC)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picScroll}>
        {allMembers.map((m) => {
          const isSelected = picId === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberChip, isSelected && styles.memberChipSelected]}
              onPress={() => {
                setPicId(m.id);
                setPic(m);
              }}
            >
              <View style={[styles.avatarMini, { backgroundColor: m.color || '#3b82f6' }]}>
                <Text style={styles.avatarMiniText}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.memberChipText, isSelected && styles.memberChipTextSelected]}>
                {m.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Deadline */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>Batas Waktu (Deadline)</Text>
        {isOverdue && <Text style={styles.overdueText}>Terlambat {Math.abs(diff!)} hari</Text>}
        {isToday && <Text style={styles.todayText}>Jatuh tempo hari ini</Text>}
      </View>
      <TextInput
        style={styles.input}
        value={deadline}
        onChangeText={setDeadline}
        placeholder="Contoh: 2026-07-05 (YYYY-MM-DD)"
      />

      {/* Memo / Description */}
      <Text style={styles.label}>Catatan & Instruksi (Memo)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={memo}
        onChangeText={setMemo}
        placeholder="Tambahkan rincian instruksi atau catatan pengerjaan..."
        multiline
        numberOfLines={3}
      />

      {/* Subtasks (To-Do Checklist) */}
      <Text style={styles.label}>
        Subtask & To-Do Checklist ({todos.filter((t) => t.done).length}/{todos.length})
      </Text>
      <View style={styles.todoBox}>
        {todos.map((td, index) => (
          <View key={td.id || index} style={styles.todoItem}>
            <TouchableOpacity
              style={[styles.todoCheck, td.done && styles.todoCheckDone]}
              onPress={() => handleToggleTodo(index)}
            >
              {td.done && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </TouchableOpacity>
            <Text style={[styles.todoText, td.done && styles.todoTextDone]}>
              {td.text}
            </Text>
            <TouchableOpacity onPress={() => handleDeleteTodo(index)}>
              <Ionicons name="trash-outline" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Todo Row */}
        <View style={styles.addTodoRow}>
          <TextInput
            style={styles.addTodoInput}
            value={newTodoText}
            onChangeText={setNewTodoText}
            placeholder="Tambah sub-kegiatan to-do..."
            placeholderTextColor="#94a3b8"
            onSubmitEditing={handleAddTodo}
          />
          <TouchableOpacity style={styles.addTodoBtn} onPress={handleAddTodo}>
            <Ionicons name="add" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ============================================================================== */}
      {/* BERKAS BUKTI PENYELESAIAN (PROOF OF WORK) */}
      {/* ============================================================================== */}
      <View style={styles.proofHeaderRow}>
        <Text style={styles.label}>Berkas Bukti / Lampiran ({proofFiles.length})</Text>
      </View>

      {/* Upload Action Buttons: Kamera, Galeri, Tautan */}
      <View style={styles.uploadActionsGrid}>
        <TouchableOpacity
          style={styles.uploadActionBtn}
          onPress={handlePickCamera}
          disabled={uploadingProof}
          activeOpacity={0.8}
        >
          <View style={[styles.uploadIconCircle, { backgroundColor: '#fdf2f8' }]}>
            <Ionicons name="camera" size={20} color="#db2777" />
          </View>
          <Text style={styles.uploadActionBtnText}>Foto Kamera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadActionBtn}
          onPress={handlePickGallery}
          disabled={uploadingProof}
          activeOpacity={0.8}
        >
          <View style={[styles.uploadIconCircle, { backgroundColor: '#eff6ff' }]}>
            <Ionicons name="images" size={20} color="#2563eb" />
          </View>
          <Text style={styles.uploadActionBtnText}>Pilih Galeri</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadActionBtn}
          onPress={() => setLinkModalVisible(true)}
          disabled={uploadingProof}
          activeOpacity={0.8}
        >
          <View style={[styles.uploadIconCircle, { backgroundColor: '#f0fdf4' }]}>
            <Ionicons name="link" size={20} color="#16a34a" />
          </View>
          <Text style={styles.uploadActionBtnText}>Tambah Link</Text>
        </TouchableOpacity>
      </View>

      {/* Uploading Progress Indicator */}
      {uploadingProof && (
        <View style={styles.uploadProgressBox}>
          <ActivityIndicator size="small" color="#db2777" />
          <Text style={styles.uploadProgressText}>
            {uploadProgressMessage || 'Mengunggah berkas bukti ke server...'}
          </Text>
        </View>
      )}

      {/* Proof List */}
      {proofFiles.length === 0 ? (
        <View style={styles.emptyProofBox}>
          <Ionicons name="document-attach-outline" size={28} color="#cbd5e1" />
          <Text style={styles.emptyProofText}>
            Belum ada berkas bukti yang dilampirkan pada tugas ini.
          </Text>
          <Text style={styles.emptyProofSubtext}>
            Gunakan tombol di atas untuk mengambil foto hasil kerja atau memilih dari galeri.
          </Text>
        </View>
      ) : (
        <View style={styles.proofList}>
          {proofFiles.map((f, idx) => {
            const isImg = isImageFile(f.ext, f.mimeType, f.url);
            const isLink = f.ext === 'link';
            const sizeStr = formatBytes(f.size);

            return (
              <View key={f.id || idx} style={styles.proofItemCard}>
                <TouchableOpacity
                  style={styles.proofItemBody}
                  onPress={() => handleProofItemPress(f)}
                  activeOpacity={0.7}
                >
                  {/* Thumbnail / Icon */}
                  {isImg && f.url ? (
                    <Image source={{ uri: f.url }} style={styles.proofThumbnail} resizeMode="cover" alt="Bukti foto" />
                  ) : (
                    <View
                      style={[
                        styles.proofDocIconBox,
                        isLink ? styles.proofLinkIconBox : styles.proofFileIconBox,
                      ]}
                    >
                      <Ionicons
                        name={isLink ? 'link-outline' : 'document-text-outline'}
                        size={22}
                        color={isLink ? '#4f46e5' : '#059669'}
                      />
                    </View>
                  )}

                  {/* Content Info */}
                  <View style={styles.proofInfoCol}>
                    <Text style={styles.proofName} numberOfLines={1}>
                      {f.name || 'Berkas Bukti'}
                    </Text>
                    <View style={styles.proofMetaRow}>
                      {sizeStr ? <Text style={styles.proofMetaText}>{sizeStr} • </Text> : null}
                      <Text style={styles.proofMetaText}>
                        {f.uploaded_at || f.uploadedAt
                          ? new Date(f.uploaded_at || f.uploadedAt!).toLocaleDateString('id-ID')
                          : 'Baru'}
                      </Text>
                      {f.uploaded_by || f.uploadedBy ? (
                        <Text style={styles.proofMetaText}>
                          {' '}oleh {f.uploaded_by || f.uploadedBy}
                        </Text>
                      ) : null}
                    </View>
                    {f.note ? (
                      <Text style={styles.proofNoteText} numberOfLines={2}>
                        &quot;{f.note}&quot;
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Delete button */}
                <TouchableOpacity
                  style={styles.proofDeleteBtn}
                  onPress={() => handleDeleteProof(f)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
        <Text style={styles.deleteButtonText}>Hapus Tugas Ini</Text>
      </TouchableOpacity>

      {/* ============================================================================== */}
      {/* MODAL: PRATINJAU GAMBAR (IMAGE PREVIEW) */}
      {/* ============================================================================== */}
      <Modal
        visible={Boolean(previewImageUrl)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={styles.closePreviewBtn}
            onPress={() => setPreviewImageUrl(null)}
          >
            <Ionicons name="close-circle" size={32} color="#ffffff" />
          </TouchableOpacity>

          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.fullPreviewImage}
              resizeMode="contain"
              alt="Pratinjau foto bukti"
            />
          )}

          <TouchableOpacity
            style={styles.openExternalBtn}
            onPress={() => previewImageUrl && Linking.openURL(previewImageUrl)}
          >
            <Ionicons name="open-outline" size={16} color="#ffffff" />
            <Text style={styles.openExternalBtnText}>Buka Tautan Penuh</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL: TAMBAH TAUTAN BUKTI (LINK PROOF) */}
      {/* ============================================================================== */}
      <Modal
        visible={linkModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLinkModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.linkModalCard}>
            <View style={styles.linkModalHeader}>
              <Text style={styles.linkModalTitle}>Tambah Tautan Bukti</Text>
              <TouchableOpacity onPress={() => setLinkModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Alamat Tautan (URL) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="https://drive.google.com/..."
              placeholderTextColor="#94a3b8"
              value={linkUrlInput}
              onChangeText={setLinkUrlInput}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.modalFieldLabel}>Judul Dokumen (Opsional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Contoh: Laporan Rekapitulasi Penjualan"
              placeholderTextColor="#94a3b8"
              value={linkTitleInput}
              onChangeText={setLinkTitleInput}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setLinkModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveLinkProof}
              >
                <Text style={styles.modalSubmitBtnText}>Simpan Tautan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  projectBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  picBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  picBadgeSubordinate: {
    backgroundColor: '#f3e8ff',
  },
  picBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  picBadgeTextSubordinate: {
    color: '#7c3aed',
    fontWeight: '700',
  },
  waReminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  waReminderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
  },
  waReminderDesc: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  overdueText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '700',
  },
  todayText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  picScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  memberChipSelected: {
    backgroundColor: '#db2777',
    borderColor: '#db2777',
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  memberChipTextSelected: {
    color: '#ffffff',
  },
  avatarMini: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  todoBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  todoCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoCheckDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  todoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  addTodoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  addTodoInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
  },
  addTodoBtn: {
    backgroundColor: '#db2777',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Proof Section Styles
  proofHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  uploadActionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 6,
  },
  uploadIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  uploadProgressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#fbcfe8',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  uploadProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#db2777',
  },
  emptyProofBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 20,
    gap: 6,
  },
  emptyProofText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  emptyProofSubtext: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 240,
  },
  proofList: {
    gap: 8,
  },
  proofItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  proofItemBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proofThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  proofDocIconBox: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofFileIconBox: {
    backgroundColor: '#ecfdf5',
  },
  proofLinkIconBox: {
    backgroundColor: '#e0e7ff',
  },
  proofInfoCol: {
    flex: 1,
  },
  proofName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  proofMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  proofMetaText: {
    fontSize: 10,
    color: '#64748b',
  },
  proofNoteText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 2,
  },
  proofDeleteBtn: {
    padding: 8,
  },

  // Actions
  saveButton: {
    backgroundColor: '#db2777',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Image Preview Modal
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  closePreviewBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullPreviewImage: {
    width: '100%',
    height: '75%',
  },
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  openExternalBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Link Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  linkModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  linkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  linkModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  modalCancelBtnText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#db2777',
    borderRadius: 10,
  },
  modalSubmitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
