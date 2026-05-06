import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getGamificationStats } from '../services/api';

const { width } = Dimensions.get('window');

export default function StatsView({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [token]);

  const fetchStats = async () => {
    try {
      const data = await getGamificationStats(token);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#d946ef" />
      <Text style={styles.loadingText}>Loading Alchemist Stats...</Text>
    </View>
  );

  const progress = stats?.progress_percent || 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.rankCard}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{stats?.level || 1}</Text>
        </View>
        <Text style={styles.userName}>{stats?.display_name || 'Alchemist'}</Text>
        <Text style={styles.rankTitle}>{stats?.rank_title || 'Novice Alchemist'}</Text>
        
        <View style={styles.xpBarContainer}>
          <View style={[styles.xpBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.xpText}>{stats?.xp_to_next_level || 0} XP to next level</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statVal}>{stats?.streak_days || 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>💰</Text>
          <Text style={styles.statVal}>{stats?.coins || 0}</Text>
          <Text style={styles.statLabel}>Coins</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🧪</Text>
          <Text style={styles.statVal}>{stats?.total_xp_earned || 0}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>🏅</Text>
          <Text style={styles.statVal}>{stats?.badges?.length || 0}</Text>
          <Text style={styles.statLabel}>Badges</Text>
        </View>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.cardTitle}>My Badges</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeList}>
          {stats?.badges?.length === 0 ? (
            <Text style={styles.noBadge}>No badges earned yet. Keep transmuting!</Text>
          ) : (
            stats?.badges?.map((b, idx) => (
              <View key={idx} style={styles.badgeItem}>
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <Text style={styles.badgeName}>{b.name}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  loadingText: { color: '#64748b', marginTop: 12, fontWeight: '600' },
  rankCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.2)',
    marginBottom: 20,
  },
  levelBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#d946ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  levelText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  userName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  rankTitle: { color: '#d946ef', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  xpBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    marginTop: 20,
    overflow: 'hidden',
  },
  xpBar: { height: '100%', backgroundColor: '#d946ef' },
  xpText: { color: '#64748b', fontSize: 12, marginTop: 8, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statBox: {
    width: (width - 44) / 2,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statEmoji: { fontSize: 24, marginBottom: 8 },
  statVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  historyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  badgeList: { flexDirection: 'row' },
  badgeItem: { alignItems: 'center', marginRight: 20, width: 80 },
  badgeIcon: { fontSize: 32, marginBottom: 4 },
  badgeName: { color: '#94a3b8', fontSize: 10, textAlign: 'center', fontWeight: '700' },
  noBadge: { color: '#475569', fontSize: 14, fontStyle: 'italic' },
});
