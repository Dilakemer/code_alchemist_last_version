import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { getWeeklyStats } from '../services/api';

const { width } = Dimensions.get('window');

export default function WeeklySummary({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeekly();
  }, [token]);

  const fetchWeekly = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getWeeklyStats(token);
      setData(res);
    } catch (err) {
      console.error('Weekly stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#d946ef" />
      <Text style={styles.loadingText}>Synthesizing your week...</Text>
    </View>
  );

  const stats = data?.current_week || {};
  const userStats = data?.user_stats || {};
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Map daily_points from backend to chart activity
  // Backend returns daily_points as a list of objects with {date, total_questions, xp_earned}
  const activityData = stats.daily_points ? stats.daily_points.map(p => p.xp_earned || 0) : [0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...activityData, 10); // Prevent divide by zero

  // Find favorite model
  const modelUsage = stats.model_usage || {};
  const favoriteModel = Object.keys(modelUsage).reduce((a, b) => modelUsage[a] > modelUsage[b] ? a : b, 'None');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.periodText}>This Week's Harvest</Text>
        <Text style={styles.totalXp}>+{stats.xp_earned || 0} XP</Text>
        <Text style={styles.subtext}>
          {stats.xp_earned > 0 
            ? "Your alchemy is getting stronger! Keep transmuting." 
            : "A quiet week in the lab. Ready to start a new experiment?"}
        </Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Daily Transmutation Power</Text>
        <View style={styles.chartContainer}>
          {activityData.map((val, idx) => (
            <View key={idx} style={styles.barWrapper}>
              <View style={[styles.bar, { height: (val / maxVal) * 120 }]} />
              <Text style={styles.dayLabel}>{days[idx] || '?'}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats.total_questions || 0}</Text>
          <Text style={styles.statLabel}>Queries</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{favoriteModel}</Text>
          <Text style={styles.statLabel}>Top Model</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.streak || 0}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{userStats.level || 1}</Text>
          <Text style={styles.statLabel}>Current Level</Text>
        </View>
      </View>

      <View style={styles.aiInsights}>
        <Text style={styles.insightTitle}>✨ Alchemist's Insight</Text>
        <Text style={styles.insightText}>
          {stats.xp_earned > 100 
            ? `You've been most active with ${favoriteModel}. Your focus on problem solving has earned you significant XP this week.` 
            : "The lab has been quiet. Try asking more complex questions to gain higher XP rewards and level up faster."}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  loadingText: { color: '#64748b', marginTop: 12, fontWeight: '600' },
  summaryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#d946ef',
    marginBottom: 20,
    alignItems: 'center',
  },
  periodText: { color: '#94a3b8', fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  totalXp: { color: '#fff', fontSize: 32, fontWeight: '900', marginVertical: 8 },
  subtext: { color: '#64748b', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  chartCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 20 },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150 },
  barWrapper: { alignItems: 'center', width: (width - 80) / 7 },
  bar: { width: 12, backgroundColor: '#d946ef', borderRadius: 6, minHeight: 4 },
  dayLabel: { color: '#475569', fontSize: 10, marginTop: 8, fontWeight: '700' },
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
  statVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  aiInsights: {
    backgroundColor: 'rgba(217, 70, 239, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.1)',
  },
  insightTitle: { color: '#d946ef', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  insightText: { color: '#94a3b8', fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
