import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { session, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari akun ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const initial = session?.name ? session.name.charAt(0).toUpperCase() : 'U';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Profile Header Card */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: session?.color || '#db2777' }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <Text style={styles.userName}>{session?.name || 'Pengguna'}</Text>
        <Text style={styles.userEmail}>{session?.email || 'email@abskdi.biz.id'}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{session?.role || 'Staff'}</Text>
          </View>
          {session?.division && (
            <View style={styles.divBadge}>
              <Text style={styles.divBadgeText}>{session.division}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeader}>Informasi Akun</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="logo-whatsapp" size={18} color="#10b981" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Nomor WhatsApp</Text>
            <Text style={styles.infoValue}>
              {session?.whatsapp_number || 'Belum diatur'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="server-outline" size={18} color="#3b82f6" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Google BigQuery</Text>
            <Text style={styles.infoValue}>
              {session?.can_access_bigquery ? 'Diizinkan (Aktif)' : 'Tidak Tersedia'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#8b5cf6" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Database Schema</Text>
            <Text style={styles.infoValue}>task_leader (PostgreSQL)</Text>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Keluar dari Akun</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Task Leader ABS Mobile v1.0.0 (Expo SDK 57)</Text>
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
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#db2777',
  },
  divBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  divBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 24,
  },
});
