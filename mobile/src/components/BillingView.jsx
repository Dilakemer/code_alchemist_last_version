import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getBillingDetails } from '../services/api';

export default function BillingView({ token }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBilling();
  }, []);

  const fetchBilling = async () => {
    try {
      const data = await getBillingDetails(token);
      setBilling(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#d946ef" />;

  const usageData = [
    { label: 'GPT-4o', usage: 120, cost: '$0.12', color: '#10a37f' },
    { label: 'Gemini 2.5', usage: 450, cost: '$0.04', color: '#1a73e8' },
    { label: 'Claude 4.5', usage: 80, cost: '$0.08', color: '#d97706' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.headerLabel}>Current Month Spending</Text>
        <Text style={styles.totalCost}>$0.24</Text>
        <View style={styles.trendRow}>
          <Text style={styles.trendIcon}>📉</Text>
          <Text style={styles.trendText}>12% less than last month</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Token Usage by Model</Text>
      {usageData.map((item, idx) => (
        <View key={idx} style={styles.modelRow}>
          <View style={[styles.modelDot, { backgroundColor: item.color }]} />
          <View style={styles.modelInfo}>
            <Text style={styles.modelName}>{item.label}</Text>
            <Text style={styles.modelUsage}>{item.usage} tokens</Text>
          </View>
          <Text style={styles.modelCost}>{item.cost}</Text>
        </View>
      ))}

      <View style={styles.quotaCard}>
        <Text style={styles.quotaTitle}>Weekly Quota</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '45%' }]} />
        </View>
        <View style={styles.quotaMeta}>
          <Text style={styles.quotaText}>450 / 1000 tokens used</Text>
          <Text style={styles.quotaReset}>Resets in 3 days</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>💡 Tip: Using Gemini 2.5 Flash is 10x more cost-effective for simple tasks.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  headerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  headerLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  totalCost: { color: '#fff', fontSize: 36, fontWeight: '900', marginVertical: 8 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendIcon: { fontSize: 14 },
  trendText: { color: '#10b981', fontSize: 13, fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  modelInfo: { flex: 1 },
  modelName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modelUsage: { color: '#64748b', fontSize: 12 },
  modelCost: { color: '#e2e8f0', fontWeight: '800', fontSize: 15 },
  quotaCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quotaTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 12 },
  progressBar: { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0ea5e9' },
  quotaMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  quotaText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  quotaReset: { color: '#475569', fontSize: 12 },
  infoBox: {
    marginTop: 24,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  infoText: { color: '#7dd3fc', fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
