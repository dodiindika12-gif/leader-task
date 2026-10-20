import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { NEXT_API_BASE_URL } from '../../lib/api';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: number;
}

interface ChatThread {
  id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
  preview?: string;
}

interface SuggestedQuery {
  title: string;
  desc: string;
  query: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GENERAL_QUERIES: SuggestedQuery[] = [
  {
    title: 'Cek Poin & Member Loyalty',
    desc: 'Cari data pelanggan, saldo poin loyalty, dan masa berlaku kartu member.',
    query: 'Bebie, bagaimana cara cek poin dan profil member pelanggan? Tolong berikan ringkasannya.',
    icon: 'gift-outline',
    color: '#d97706',
    bgColor: '#fffbeb',
  },
  {
    title: 'Absensi BA Hari Ini',
    desc: 'Cek rekap kehadiran & shift Beauty Advisor di seluruh cabang toko hari ini.',
    query: 'Bebie, cek rekap absensi Beauty Advisor yang hadir di outlet hari ini dan siapa saja yang masih bertugas.',
    icon: 'people-outline',
    color: '#db2777',
    bgColor: '#fdf2f8',
  },
  {
    title: 'Setoran Konten BA',
    desc: 'Pantau video promosi TikTok & IG yang di-upload oleh Beauty Advisor.',
    query: 'Bebie, cek setoran konten video promosi Beauty Advisor yang masuk hari ini beserta link videonya.',
    icon: 'videocam-outline',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
  },
  {
    title: 'Promo Aktif Hari Ini',
    desc: 'Cek daftar promo diskon & hadiah yang sedang berjalan di outlet hari ini.',
    query: 'Bebie, apa saja promo dan diskon yang sedang aktif berjalan di outlet hari ini?',
    icon: 'pricetag-outline',
    color: '#e11d48',
    bgColor: '#fff1f2',
  },
  {
    title: 'Format Presentasi Eksekutif',
    desc: 'Buatkan kerangka slide presentasi profesional.',
    query: 'Buatkan kerangka presentasi PPTX eksekutif 5 slide untuk evaluasi strategi operasional cabang.',
    icon: 'easel-outline',
    color: '#6366f1',
    bgColor: '#eef2ff',
  },
  {
    title: 'Rangkum Rapat & MoM',
    desc: 'Rapikan poin penting dan action items meeting tim.',
    query: 'Bantu saya merapikan catatan rapat ini menjadi action plan dan daftar PIC yang terstruktur.',
    icon: 'sparkles-outline',
    color: '#e11d48',
    bgColor: '#fff1f2',
  },
];

const BIGQUERY_QUERIES: SuggestedQuery[] = [
  {
    title: 'Cek Poin & Member Loyalty',
    desc: 'Cari data pelanggan, saldo poin loyalty, dan masa berlaku kartu member.',
    query: 'Bebie, bagaimana cara cek poin dan profil member pelanggan? Tolong berikan ringkasannya.',
    icon: 'gift-outline',
    color: '#d97706',
    bgColor: '#fffbeb',
  },
  {
    title: 'Absensi BA Hari Ini',
    desc: 'Cek rekap kehadiran & shift Beauty Advisor di seluruh cabang toko hari ini.',
    query: 'Bebie, cek rekap absensi Beauty Advisor yang hadir di outlet hari ini dan siapa saja yang masih bertugas.',
    icon: 'people-outline',
    color: '#db2777',
    bgColor: '#fdf2f8',
  },
  {
    title: 'Setoran Konten BA',
    desc: 'Pantau video promosi TikTok & IG yang di-upload oleh Beauty Advisor.',
    query: 'Bebie, cek setoran konten video promosi Beauty Advisor yang masuk hari ini beserta link videonya.',
    icon: 'videocam-outline',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
  },
  {
    title: 'Audit KPI & SP Konten',
    desc: 'Lihat daftar BA yang banyak alpa setor konten dan direkomendasikan SP.',
    query: 'Bebie, tampilkan rekap kepatuhan konten BA dan siapa saja yang direkomendasikan SP3 karena alpa setor.',
    icon: 'alert-circle-outline',
    color: '#e11d48',
    bgColor: '#fff1f2',
  },
  {
    title: 'Promo Aktif Hari Ini',
    desc: 'Cek daftar promo diskon & hadiah yang sedang berjalan di outlet hari ini.',
    query: 'Bebie, apa saja promo dan diskon yang sedang aktif berjalan di outlet hari ini?',
    icon: 'pricetag-outline',
    color: '#e11d48',
    bgColor: '#fff1f2',
  },
  {
    title: 'Pencapaian Omset Cabang',
    desc: 'Pencapaian penjualan bulan ini vs target per cabang.',
    query: 'Berapa pencapaian omset bulan ini dibanding target per cabang?',
    icon: 'trending-up-outline',
    color: '#4f46e5',
    bgColor: '#eef2ff',
  },
  {
    title: 'Peringkat Cabang',
    desc: 'Ranking cabang berdasarkan performa penjualan.',
    query: 'Tampilkan ranking cabang berdasarkan penjualan bulan ini.',
    icon: 'storefront-outline',
    color: '#6366f1',
    bgColor: '#eef2ff',
  },
  {
    title: 'Top Produk & Treatment',
    desc: '5 treatment dan produk terlaris bulan ini.',
    query: 'Apa 5 treatment dan produk terlaris di seluruh outlet bulan ini?',
    icon: 'sparkles-outline',
    color: '#d97706',
    bgColor: '#fffbeb',
  },
];

// ---------------------------------------------------------------------------
// SSE streaming helpers
// ---------------------------------------------------------------------------

interface SSEChunk {
  text?: string;
  error?: string;
  done?: boolean;
}

/**
 * Universal SSE Line Parser.
 * Supports:
 * 1. AI SDK UI Message Stream: data: {"type":"text-delta","delta":"..."}
 * 2. Legacy AI SDK Data Stream: 0:"..." / e:... / d:...
 */
function parseSSELine(line: string): SSEChunk | null {
  if (!line || line.startsWith(':')) return null;

  // Format 1: "data: {...}" or "data: [DONE]"
  if (line.startsWith('data:')) {
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') {
      return { done: true };
    }
    try {
      const parsed = JSON.parse(dataStr);
      if (parsed.type === 'text-delta' && typeof parsed.delta === 'string') {
        return { text: parsed.delta };
      }
      if (parsed.type === 'error') {
        return { error: parsed.error || parsed.message || 'Error dari server' };
      }
      if (parsed.type === 'finish') {
        return { done: true };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Format 2: "0:\"text chunk\""
  const colonIdx = line.indexOf(':');
  if (colonIdx > 0) {
    const type = line.substring(0, colonIdx).trim();
    const rawVal = line.substring(colonIdx + 1).trim();

    if (type === '0') {
      try {
        const text = JSON.parse(rawVal);
        return { text: typeof text === 'string' ? text : rawVal };
      } catch {
        return { text: rawVal };
      }
    }
    if (type === 'e') {
      try {
        const errObj = JSON.parse(rawVal);
        return { error: errObj.message || errObj.error || rawVal };
      } catch {
        return { error: rawVal };
      }
    }
    if (type === 'd') {
      return { done: true };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ChatScreen() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Thread history & user profile
  const [historyVisible, setHistoryVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Animated dots for streaming indicator
  const dotAnim = useRef(new Animated.Value(0)).current;

  const memberId = session?.memberId || '';
  const memberEmail = session?.email || '';
  const isStaff = session?.role === 'Staff';
  const canUseBigQuery = Boolean(
    (session as any)?.can_access_bigquery ||
    ['Super User', 'Direksi'].includes(session?.role || '')
  );

  const suggestedQueries = canUseBigQuery ? BIGQUERY_QUERIES : GENERAL_QUERIES;

  // Streaming dot animation
  useEffect(() => {
    if (!isStreaming) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isStreaming, dotAnim]);

  // Headers for auth
  const sessionHeaders = useMemo((): Record<string, string> => {
    if (!memberId) return {};
    return {
      'x-session-member-id': memberId,
      'x-session-email': memberEmail,
    };
  }, [memberId, memberEmail]);

  // -----------------------------------------------------------------------
  // Thread management
  // -----------------------------------------------------------------------
  const loadThreads = useCallback(async () => {
    if (!memberId) return;
    setLoadingThreads(true);
    try {
      const res = await fetch(`${NEXT_API_BASE_URL}/api/chat/threads`, {
        headers: sessionHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.threads)) {
          setThreads(data.threads);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat thread:', err);
    } finally {
      setLoadingThreads(false);
    }
  }, [memberId, sessionHeaders]);

  const saveThread = useCallback(async (msgs: ChatMessage[]) => {
    if (msgs.length === 0 || !memberId) return;
    try {
      const firstUser = msgs.find(m => m.role === 'user');
      const title = firstUser?.content?.slice(0, 50) || 'Percakapan Bebie';
      const payload: any = {
        title,
        messages: msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          parts: [{ type: 'text', text: m.content }],
        })),
      };
      if (activeThreadId) {
        payload.id = activeThreadId;
      }

      const res = await fetch(`${NEXT_API_BASE_URL}/api/chat/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...sessionHeaders },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.thread) {
          if (!activeThreadId && data.thread.id) {
            setActiveThreadId(data.thread.id);
          }
          loadThreads();
        }
      }
    } catch (err) {
      console.warn('Gagal menyimpan thread:', err);
    }
  }, [activeThreadId, memberId, sessionHeaders, loadThreads]);

  const selectThread = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`${NEXT_API_BASE_URL}/api/chat/threads/${threadId}`, {
        headers: sessionHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.thread) {
          setActiveThreadId(data.thread.id);
          const restored: ChatMessage[] = (data.thread.messages || []).map((m: any) => ({
            id: m.id || `msg_${Math.random().toString(36).slice(2)}`,
            role: m.role,
            content: m.content || (m.parts?.find((p: any) => p.type === 'text')?.text) || '',
            createdAt: m.createdAt,
          }));
          setMessages(restored);
          setHistoryVisible(false);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat riwayat percakapan.');
    }
  }, [sessionHeaders]);

  const deleteThread = useCallback(async (threadId: string) => {
    try {
      await fetch(`${NEXT_API_BASE_URL}/api/chat/threads/${threadId}`, {
        method: 'DELETE',
        headers: sessionHeaders,
      });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal menghapus percakapan.');
    }
  }, [sessionHeaders, activeThreadId]);

  const handleNewChat = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
  }, []);

  // -----------------------------------------------------------------------
  // Send message with SSE streaming
  // -----------------------------------------------------------------------
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !memberId) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      createdAt: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `asst_${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, assistantMsg]);
    setInputText('');
    setIsStreaming(true);

    // Build the message payload for AI SDK format
    const apiMessages = updatedMessages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      parts: [{ type: 'text', text: m.content }],
    }));

    try {
      const res = await fetch(`${NEXT_API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...sessionHeaders,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Gagal menghubungi server.' }));
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: `⚠️ ${errData.error || 'Terjadi kesalahan.'}` }
            : m
        ));
        setIsStreaming(false);
        return;
      }

      // Read SSE stream
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        reader = res.body?.getReader ? res.body.getReader() : undefined;
      } catch {}

      if (!reader) {
        // Fallback untuk runtime tanpa ReadableStream (misal Hermes tanpa polyfill stream)
        const fullRaw = await res.text();
        const rawLines = fullRaw.split('\n');
        let parsedText = '';
        for (const line of rawLines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = parseSSELine(trimmed);
          if (parsed?.text) {
            parsedText += parsed.text;
          } else if (parsed?.error) {
            parsedText += `\n⚠️ ${parsed.error}`;
          }
        }
        const captured = parsedText || '⚠️ Respon kosong dari server.';
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: captured } : m
        ));
        const finalMessages = [...updatedMessages, { ...assistantMsg, content: captured }];
        saveThread(finalMessages);
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const parsed = parseSSELine(trimmed);
          if (!parsed) continue;

          if (parsed.text) {
            fullText += parsed.text;
            const captured = fullText;
            setMessages(prev => prev.map(m =>
              m.id === assistantMsg.id ? { ...m, content: captured } : m
            ));
          } else if (parsed.error) {
            fullText += `\n⚠️ ${parsed.error}`;
            const captured = fullText;
            setMessages(prev => prev.map(m =>
              m.id === assistantMsg.id ? { ...m, content: captured } : m
            ));
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const parsed = parseSSELine(buffer.trim());
        if (parsed?.text) {
          fullText += parsed.text;
        } else if (parsed?.error) {
          fullText += `\n⚠️ ${parsed.error}`;
        }
        const captured = fullText;
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: captured } : m
        ));
      }

      // Save thread after streaming completes
      const finalMessages = [...updatedMessages, { ...assistantMsg, content: fullText }];
      setMessages(finalMessages);
      saveThread(finalMessages);
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: `⚠️ Koneksi gagal: ${err.message || 'Tidak dapat terhubung ke server.'}` }
          : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, memberId, sessionHeaders, saveThread]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // -----------------------------------------------------------------------
  // Renders
  // -----------------------------------------------------------------------

  // Staff restriction gate
  if (isStaff) {
    return (
      <View style={[styles.gateContainer, { paddingTop: insets.top + 20 }]}>
        <View style={styles.gateCard}>
          <View style={styles.gateIconWrap}>
            <Ionicons name="lock-closed" size={28} color="#e11d48" />
          </View>
          <Text style={styles.gateTitle}>Akses Terbatas: Khusus Leader</Text>
          <Text style={styles.gateDesc}>
            Fitur Chat Bebie (Beauty Bestie AI) saat ini hanya diperuntukkan bagi jajaran Leader (Koordinator, SPV, Manager, dan Direksi).
          </Text>
          <View style={styles.gateWarning}>
            <Ionicons name="alert-circle-outline" size={14} color="#d97706" />
            <Text style={styles.gateWarningText}>
              Akun Anda ({session?.email}) terdaftar sebagai Staff. Silakan masuk menggunakan akun Leader.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gateBtn}
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            <Ionicons name="log-out-outline" size={16} color="#fff" />
            <Text style={styles.gateBtnText}>Ganti Akun Lain</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isEmpty = !item.content && isStreaming && item.role === 'assistant';

    return (
      <View style={[styles.messageBubbleRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser && (
          <View style={styles.avatarCircle}>
            <Image
              source={require('../../assets/images/bebie-avatar.png')}
              style={styles.chatBubbleAvatar}
              resizeMode="contain"
            />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}>
          {isEmpty ? (
            <View style={styles.typingRow}>
              <Animated.View style={[styles.typingDot, { opacity: dotAnim }]} />
              <Animated.View style={[styles.typingDot, { opacity: dotAnim, marginLeft: 4 }]} />
              <Animated.View style={[styles.typingDot, { opacity: dotAnim, marginLeft: 4 }]} />
            </View>
          ) : (
            <MarkdownRenderer content={item.content} isUser={isUser} />
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <ScrollView
      contentContainerStyle={styles.emptyContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.emptyAvatarWrap}>
        <View style={styles.emptyAvatar}>
          <Image
            source={require('../../assets/images/bebie-avatar.png')}
            style={styles.emptyAvatarImg}
            resizeMode="contain"
          />
        </View>
        <View style={styles.onlineDot} />
      </View>

      <Text style={styles.emptyTitle}>
        Halo{session?.name ? `, ${session.name.split(' ')[0]}` : ''}!
      </Text>
      <Text style={styles.emptySubtitle}>Ada yang bisa Bebie bantu?</Text>
      <Text style={styles.emptyDesc}>
        {canUseBigQuery
          ? 'Bebie siap menganalisis data penjualan outlet, pencapaian target cabang, dan performa produk langsung dari BigQuery.'
          : 'Bebie siap membantu menyusun format laporan, presentasi, strategi operasional, dan merapikan catatan kerja tim.'}
      </Text>

      {!canUseBigQuery && (
        <View style={styles.bqBadge}>
          <Ionicons name="sparkles" size={12} color="#d97706" />
          <Text style={styles.bqBadgeText}>
            Akses BigQuery diatur per-user oleh Direksi.
          </Text>
        </View>
      )}

      <View style={styles.suggestionsGrid}>
        {suggestedQueries.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.suggestionCard}
            onPress={() => sendMessage(item.query)}
            activeOpacity={0.7}
          >
            <View style={[styles.suggestionIcon, { backgroundColor: item.bgColor }]}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
            </View>
            <View style={styles.suggestionContent}>
              <Text style={styles.suggestionTitle}>{item.title}</Text>
              <Text style={styles.suggestionDesc} numberOfLines={2}>{item.desc}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color="#cbd5e1" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // User profile modal
  const renderProfileModal = () => (
    <Modal
      visible={profileVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setProfileVisible(false)}
    >
      <View style={[styles.profileModalContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Profil Pengguna</Text>
          <TouchableOpacity
            onPress={() => setProfileVisible(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.profileModalContent}>
          {/* Avatar & Name */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatarLarge}>
              <Text style={styles.profileAvatarLargeText}>
                {session?.name ? session.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <Text style={styles.profileUserName}>{session?.name || 'Pengguna Busana'}</Text>
            <Text style={styles.profileUserEmail}>{session?.email || ''}</Text>

            <View style={styles.profileBadgeWrap}>
              <View style={styles.roleBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#db2777" />
                <Text style={styles.roleBadgeText}>{session?.role || 'Leader'}</Text>
              </View>
              {session?.division && (
                <View style={styles.divisionBadge}>
                  <Text style={styles.divisionBadgeText}>{session.division}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Capabilities */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionHeader}>Status Integrasi</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="server-outline" size={18} color="#4f46e5" />
                <Text style={styles.infoRowLabel}>Akses BigQuery</Text>
              </View>
              <Text style={[styles.infoRowValue, canUseBigQuery ? styles.statusActive : styles.statusInactive]}>
                {canUseBigQuery ? 'Aktif' : 'Nonaktif'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="globe-outline" size={18} color="#059669" />
                <Text style={styles.infoRowLabel}>Backend Server</Text>
              </View>
              <Text style={styles.infoRowValue}>task.absgroup.biz.id</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="hardware-chip-outline" size={18} color="#db2777" />
                <Text style={styles.infoRowLabel}>Aplikasi</Text>
              </View>
              <Text style={styles.infoRowValue}>Bebie AI Standalone</Text>
            </View>
          </View>

          {/* Logout Action */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert(
                'Keluar dari Bebie AI',
                'Apakah Anda yakin ingin keluar dari akun ini?',
                [
                  { text: 'Batal', style: 'cancel' },
                  {
                    text: 'Keluar',
                    style: 'destructive',
                    onPress: async () => {
                      setProfileVisible(false);
                      await logout();
                      router.replace('/login');
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.logoutBtnText}>Keluar dari Akun</Text>
          </TouchableOpacity>

          <Text style={styles.appVersionFooter}>
            Bebie AI for Android • ABS Group
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );

  // Thread history modal
  const renderHistoryModal = () => (
    <Modal
      visible={historyVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setHistoryVisible(false)}
    >
      <View style={[styles.historyContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Riwayat Percakapan</Text>
          <TouchableOpacity onPress={() => setHistoryVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        {loadingThreads ? (
          <View style={styles.historyCentered}>
            <ActivityIndicator size="large" color="#db2777" />
          </View>
        ) : threads.length === 0 ? (
          <View style={styles.historyCentered}>
            <Ionicons name="chatbubbles-outline" size={48} color="#cbd5e1" />
            <Text style={styles.historyEmptyText}>Belum ada riwayat percakapan.</Text>
          </View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.threadCard,
                  activeThreadId === item.id && styles.threadCardActive,
                ]}
                onPress={() => selectThread(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.threadInfo}>
                  <Text style={styles.threadTitle} numberOfLines={1}>
                    {item.title || 'Percakapan'}
                  </Text>
                  <Text style={styles.threadDate}>
                    {item.updated_at
                      ? new Date(item.updated_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    Alert.alert(
                      'Hapus Percakapan',
                      `Hapus "${item.title || 'Percakapan'}"?`,
                      [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Hapus', style: 'destructive', onPress: () => deleteThread(item.id) },
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header Standalone Bebie AI */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatarWrap}>
            <Image
              source={require('../../assets/images/bebie-avatar.png')}
              style={styles.headerAvatarImg}
              resizeMode="contain"
            />
            <View style={styles.headerOnlineDot} />
          </View>
          <View style={styles.headerTextWrap}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Bebie AI</Text>
              {canUseBigQuery ? (
                <View style={styles.headerBadgeBQ}>
                  <Ionicons name="server-outline" size={9} color="#4f46e5" />
                  <Text style={styles.headerBadgeBQText}>BigQuery</Text>
                </View>
              ) : (
                <View style={styles.headerBadgeGeneral}>
                  <Ionicons name="sparkles" size={9} color="#64748b" />
                  <Text style={styles.headerBadgeGeneralText}>Asisten</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {session?.name ? session.name : 'Beauty Bestie AI'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleNewChat}
            style={[styles.headerBtn, messages.length === 0 && { opacity: 0.35 }]}
            disabled={messages.length === 0}
            accessibilityLabel="Percakapan Baru"
          >
            <Ionicons name="add-circle-outline" size={22} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setHistoryVisible(true);
              loadThreads();
            }}
            style={styles.headerBtn}
            accessibilityLabel="Riwayat Percakapan"
          >
            <Ionicons name="time-outline" size={22} color="#0f172a" />
            {threads.length > 0 && <View style={styles.headerDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setProfileVisible(true)}
            style={styles.profileBtn}
            accessibilityLabel="Profil Pengguna"
          >
            <Text style={styles.profileBtnText}>
              {session?.name ? session.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat area */}
      <View style={styles.chatArea}>
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
          />
        )}
      </View>

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Tanya Bebie sesuatu..."
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={4000}
            editable={!isStreaming}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isStreaming) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isStreaming}
            activeOpacity={0.7}
          >
            {isStreaming ? (
              <ActivityIndicator size={16} color="#fff" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {renderHistoryModal()}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },

  // Gate (staff restriction)
  gateContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gateCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  gateIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff1f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  gateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  gateDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  gateWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  gateWarningText: {
    fontSize: 11,
    color: '#92400e',
    flex: 1,
    lineHeight: 16,
  },
  gateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  gateBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

  // Header
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fce7f3',
    borderWidth: 1.5,
    borderColor: '#fbcfe8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerAvatarImg: {
    width: 34,
    height: 34,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  headerBadgeBQ: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  headerBadgeBQText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4f46e5',
  },
  headerBadgeGeneral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerBadgeGeneralText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  headerDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#db2777',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fce7f3',
    borderWidth: 1.5,
    borderColor: '#fbcfe8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#db2777',
  },

  // Profile Modal
  profileModalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  profileModalContent: {
    padding: 20,
    gap: 18,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  profileAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fce7f3',
    borderWidth: 2,
    borderColor: '#fbcfe8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatarLargeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#db2777',
  },
  profileUserName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  profileUserEmail: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  profileBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff1f2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#be185d',
  },
  divisionBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  divisionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 14,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  infoRowValue: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  statusActive: {
    color: '#059669',
  },
  statusInactive: {
    color: '#94a3b8',
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  appVersionFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
  },

  // Chat area
  chatArea: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // Message bubbles
  messageBubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#fce7f3',
    overflow: 'hidden',
  },
  chatBubbleAvatar: {
    width: 26,
    height: 26,
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    maxWidth: screenWidth * 0.8,
    backgroundColor: '#0f172a',
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    maxWidth: Math.min(screenWidth - 56, 720),
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1e293b',
  },
  userMessageText: {
    color: '#fff',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#db2777',
  },

  // Empty state
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  emptyAvatarWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  emptyAvatar: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#fbcfe8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  emptyAvatarImg: {
    width: 58,
    height: 58,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2.5,
    borderColor: '#f0f4ff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 12,
  },
  bqBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 20,
  },
  bqBadgeText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
  },

  // Suggestion cards
  suggestionsGrid: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  suggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  suggestionDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },

  // Input bar
  inputBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 100,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#db2777',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  sendBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },

  // Thread history modal
  historyContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  historyEmptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  threadCardActive: {
    borderColor: '#db2777',
    backgroundColor: '#fff5f7',
  },
  threadInfo: {
    flex: 1,
    marginRight: 12,
  },
  threadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 3,
  },
  threadDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
