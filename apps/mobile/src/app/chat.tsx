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
    title: 'Format Presentasi',
    desc: 'Buatkan kerangka presentasi eksekutif yang profesional.',
    query: 'Buatkan kerangka presentasi PPTX eksekutif 5 slide untuk evaluasi strategi operasional cabang.',
    icon: 'easel-outline',
    color: '#6366f1',
    bgColor: '#eef2ff',
  },
  {
    title: 'Rangkum Rapat',
    desc: 'Rapikan poin penting dan action items meeting.',
    query: 'Bantu saya merapikan catatan rapat ini menjadi action plan dan daftar PIC yang terstruktur.',
    icon: 'sparkles-outline',
    color: '#e11d48',
    bgColor: '#fff1f2',
  },
  {
    title: 'Ide Peningkatan',
    desc: 'Brainstorming strategi dan ide peningkatan layanan.',
    query: 'Berikan 5 ide strategi kreatif untuk meningkatkan repeat order treatment kecantikan di klinik.',
    icon: 'trending-up-outline',
    color: '#d97706',
    bgColor: '#fffbeb',
  },
  {
    title: 'SOP & Template',
    desc: 'Susun format rekapitulasi kerja mingguan.',
    query: 'Buatkan template rekapitulasi kinerja mingguan tim dalam format tabel yang rapi.',
    icon: 'document-text-outline',
    color: '#059669',
    bgColor: '#ecfdf5',
  },
];

const BIGQUERY_QUERIES: SuggestedQuery[] = [
  {
    title: 'Pencapaian Omset',
    desc: 'Pencapaian penjualan bulan ini vs target per cabang.',
    query: 'Berapa pencapaian omset bulan ini dibanding target per cabang?',
    icon: 'trending-up-outline',
    color: '#e11d48',
    bgColor: '#fff1f2',
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
    title: 'Top Produk',
    desc: '5 treatment dan produk terlaris bulan ini.',
    query: 'Apa 5 treatment dan produk terlaris di seluruh outlet bulan ini?',
    icon: 'sparkles-outline',
    color: '#d97706',
    bgColor: '#fffbeb',
  },
  {
    title: 'Under-Target',
    desc: 'Outlet dengan pencapaian masih di bawah 80%.',
    query: 'Tampilkan cabang-cabang yang pencapaian targetnya masih di bawah 80%.',
    icon: 'flag-outline',
    color: '#059669',
    bgColor: '#ecfdf5',
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
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Thread history
  const [historyVisible, setHistoryVisible] = useState(false);
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
      const threadId = activeThreadId || `thread_${Date.now()}`;
      const firstUser = msgs.find(m => m.role === 'user');
      const title = firstUser?.content?.slice(0, 50) || 'Percakapan Bebie';
      const res = await fetch(`${NEXT_API_BASE_URL}/api/chat/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...sessionHeaders },
        body: JSON.stringify({
          id: threadId,
          title,
          messages: msgs.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            parts: [{ type: 'text', text: m.content }],
          })),
        }),
      });
      if (res.ok && !activeThreadId) {
        setActiveThreadId(threadId);
      }
    } catch (err) {
      console.warn('Gagal menyimpan thread:', err);
    }
  }, [activeThreadId, memberId, sessionHeaders]);

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
              Akun Anda terdaftar sebagai Staff. Hubungi atasan jika memerlukan akses.
            </Text>
          </View>
          <TouchableOpacity style={styles.gateBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color="#fff" />
            <Text style={styles.gateBtnText}>Kembali</Text>
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
            <Text style={styles.avatarEmoji}>🤖</Text>
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
          <Text style={styles.emptyAvatarEmoji}>🌸</Text>
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#64748b" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerAvatarWrap}>
            <Text style={styles.headerAvatarEmoji}>🌸</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Bebie AI</Text>
            <View style={styles.headerBadgeRow}>
              {canUseBigQuery ? (
                <View style={styles.headerBadgeBQ}>
                  <Ionicons name="server-outline" size={9} color="#4f46e5" />
                  <Text style={styles.headerBadgeBQText}>BigQuery</Text>
                </View>
              ) : (
                <View style={styles.headerBadgeGeneral}>
                  <Ionicons name="sparkles" size={9} color="#64748b" />
                  <Text style={styles.headerBadgeGeneralText}>Asisten Umum</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              setHistoryVisible(true);
              loadThreads();
            }}
            style={styles.headerBtn}
          >
            <Ionicons name="time-outline" size={20} color="#64748b" />
            {threads.length > 0 && <View style={styles.headerDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleNewChat}
            style={[styles.headerBtn, messages.length === 0 && { opacity: 0.35 }]}
            disabled={messages.length === 0}
          >
            <Ionicons name="add-circle-outline" size={20} color="#64748b" />
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
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 4,
  },
  headerAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#fce7f3',
    borderWidth: 1.5,
    borderColor: '#fbcfe8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    marginTop: 1,
  },
  headerBadgeBQ: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    gap: 2,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fce7f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  avatarEmoji: {
    fontSize: 14,
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
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fce7f3',
    borderWidth: 2.5,
    borderColor: '#fbcfe8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyAvatarEmoji: {
    fontSize: 30,
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
