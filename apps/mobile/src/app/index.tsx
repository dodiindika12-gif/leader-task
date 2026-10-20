import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import ChatScreen from './chat';

export default function IndexScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [session, loading, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoBadge}>
          <Image
            source={require('../../assets/images/bebie-avatar.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator size="large" color="#db2777" />
        <Text style={styles.loadingText}>Memuat Bebie AI...</Text>
      </View>
    );
  }

  if (!session) {
    return null;
  }

  return <ChatScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff5f7',
    gap: 12,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#fce7f3',
    overflow: 'hidden',
  },
  logoImg: {
    width: 48,
    height: 48,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#be185d',
    marginTop: 4,
  },
});
