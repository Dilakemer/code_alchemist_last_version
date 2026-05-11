import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getTokenUsage } from '../services/api';

export default function TokenWalletView({ token, user }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsage = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getTokenUsage(token);
      setUsage(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsage();
  }, [token]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#d946ef" />;

  const isUnlimited = !!user?.is_admin;
  const balance = isUnlimited ? 'Unlimited' : Number(usage?.balance || user?.tokens || 0).toLocaleString();
  const totalSpent = Number(usage?.total_spent || 0).toLocaleString();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl tintColor="#d946ef" refreshing={refreshing} onRefresh={() => loadUsage(true)} />}
    >
      <View style={styles.balanceCard}>
        <Text style={styles.eyebrow}>Token Wallet</Text>
        <Text style={styles.balance}>{balance}</Text>
        <Text style={styles.balanceSub}>{isUnlimited ? 'Admin bypass active' : 'Available platform tokens'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalSpent}</Text>
          <Text style={styles.statLabel}>Spent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{usage?.transactions?.length || 0}</Text>
          <Text style={styles.statLabel}>Recent Tx</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {(usage?.transactions || []).length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Henüz token islemi yok.</Text>
        </View>
      ) : (
        usage.transactions.map((tx) => (
          <View key={tx.id} style={styles.txRow}>
            <View style={styles.txMain}>
              <Text style={styles.txDesc} numberOfLines={2}>{tx.description || tx.type}</Text>
              <Text style={styles.txDate}>{tx.created_at ? new Date(tx.created_at).toLocaleString() : ''}</Text>
            </View>
            <Text style={[styles.txAmount, Number(tx.amount) < 0 ? styles.negative : styles.positive]}>
              {Number(tx.amount) > 0 ? '+' : ''}{Number(tx.amount || 0).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  eyebrow: { color: '#38bdf8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  balance: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 8 },
  balanceSub: { color: '#94a3b8', fontSize: 13, marginTop: 4, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statValue: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  emptyCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1e293b' },
  emptyText: { color: '#64748b', textAlign: 'center', fontWeight: '700' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 8,
  },
  txMain: { flex: 1, paddingRight: 10 },
  txDesc: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  txDate: { color: '#64748b', fontSize: 11, marginTop: 4 },
  txAmount: { fontSize: 16, fontWeight: '900' },
  positive: { color: '#34d399' },
  negative: { color: '#fb7185' },
});
