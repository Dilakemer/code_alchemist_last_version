import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  deleteAdminUserKey,
  getAdminDefaults,
  getAdminStats,
  getAdminUserKeys,
  getAdminUserQuota,
  getAdminUsers,
  grantAdminUserTokens,
  resetAdminUserQuota,
  saveAdminUserKey,
  updateAdminDefaults,
  updateAdminUserQuota,
} from '../services/api';

const PROVIDERS = ['openai', 'anthropic', 'gemini'];

export default function AdminPanelView({ token }) {
  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [quotaForm, setQuotaForm] = useState({});
  const [grantAmount, setGrantAmount] = useState('');
  const [grantDesc, setGrantDesc] = useState('');
  const [userKeys, setUserKeys] = useState({});
  const [keyInputs, setKeyInputs] = useState({});
  const [defaults, setDefaults] = useState({});
  const [defaultsForm, setDefaultsForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, defaultsData] = await Promise.all([
        getAdminStats(token),
        getAdminUsers(token, { search }),
        getAdminDefaults(token),
      ]);
      setStats(statsData);
      setUsers(usersData.users || []);
      setDefaults(defaultsData);
      setDefaultsForm({
        daily_limit: String(defaultsData.default_daily_limit ?? 200),
        weekly_limit: String(defaultsData.default_weekly_limit ?? 1000),
      });
    } catch (err) {
      Alert.alert('Admin', err.message || 'Admin verileri yuklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers(token, { search });
      setUsers(data.users || []);
    } catch (err) {
      Alert.alert('Admin', err.message || 'Arama basarisiz.');
    } finally {
      setLoading(false);
    }
  };

  const openUser = async (user) => {
    setSaving(true);
    try {
      const [quota, keysData] = await Promise.all([
        getAdminUserQuota(token, user.id),
        getAdminUserKeys(token, user.id),
      ]);
      const nextKeys = {};
      (keysData.keys || []).forEach((item) => {
        nextKeys[item.provider] = item.mask;
      });
      setSelected(quota);
      setQuotaForm({
        daily_limit: String(quota.daily_limit ?? 0),
        weekly_limit: String(quota.weekly_limit ?? 0),
        monthly_renewal_enabled: !!quota.monthly_renewal_enabled,
        monthly_renewal_day: quota.monthly_renewal_day ? String(quota.monthly_renewal_day) : '',
      });
      setUserKeys(nextKeys);
      setKeyInputs({});
      setGrantAmount('');
      setGrantDesc('');
    } catch (err) {
      Alert.alert('Admin', err.message || 'Kullanici acilamadi.');
    } finally {
      setSaving(false);
    }
  };

  const saveQuota = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateAdminUserQuota(token, selected.user_id, {
        daily_limit: Number(quotaForm.daily_limit),
        weekly_limit: Number(quotaForm.weekly_limit),
        monthly_renewal_enabled: !!quotaForm.monthly_renewal_enabled,
        monthly_renewal_day: quotaForm.monthly_renewal_day ? Number(quotaForm.monthly_renewal_day) : null,
      });
      await openUser({ id: selected.user_id });
      await searchUsers();
      Alert.alert('Admin', 'Kota guncellendi.');
    } catch (err) {
      Alert.alert('Admin', err.message || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const grantTokens = async () => {
    if (!selected || Number(grantAmount) <= 0) return;
    setSaving(true);
    try {
      await grantAdminUserTokens(token, selected.user_id, { amount: Number(grantAmount), description: grantDesc });
      await openUser({ id: selected.user_id });
      await searchUsers();
      Alert.alert('Admin', 'Token yuklendi.');
    } catch (err) {
      Alert.alert('Admin', err.message || 'Token yuklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const resetQuota = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await resetAdminUserQuota(token, selected.user_id);
      await openUser({ id: selected.user_id });
      Alert.alert('Admin', 'Kota sifirlandi.');
    } catch (err) {
      Alert.alert('Admin', err.message || 'Sifirlanamadi.');
    } finally {
      setSaving(false);
    }
  };

  const saveDefaults = async () => {
    setSaving(true);
    try {
      const data = await updateAdminDefaults(token, {
        daily_limit: Number(defaultsForm.daily_limit),
        weekly_limit: Number(defaultsForm.weekly_limit),
      });
      Alert.alert('Admin', `${data.updated_wallets || 0} cuzdan guncellendi.`);
      await load();
    } catch (err) {
      Alert.alert('Admin', err.message || 'Varsayilanlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const saveKey = async (provider) => {
    if (!selected || !keyInputs[provider]) return;
    setSaving(true);
    try {
      const data = await saveAdminUserKey(token, selected.user_id, { provider, api_key: keyInputs[provider].trim() });
      setUserKeys((prev) => ({ ...prev, [provider]: data.mask }));
      setKeyInputs((prev) => ({ ...prev, [provider]: '' }));
    } catch (err) {
      Alert.alert('Admin', err.message || 'Anahtar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async (provider) => {
    if (!selected) return;
    setSaving(true);
    try {
      await deleteAdminUserKey(token, selected.user_id, provider);
      setUserKeys((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    } catch (err) {
      Alert.alert('Admin', err.message || 'Anahtar silinemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#d946ef" />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.tabs}>
        {['users', 'defaults', 'stats'].map((id) => (
          <TouchableOpacity key={id} style={[styles.tab, tab === id && styles.tabActive]} onPress={() => setTab(id)}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{id}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'stats' ? (
        <View style={styles.grid}>
          <Stat label="Users" value={stats?.total_users} />
          <Stat label="Balance" value={stats?.total_tokens_balance} />
          <Stat label="Spent" value={stats?.total_tokens_spent} />
          <Stat label="Conversations" value={stats?.total_conversations} />
        </View>
      ) : null}

      {tab === 'defaults' ? (
        <View style={styles.card}>
          <Text style={styles.title}>Global defaults</Text>
          <Text style={styles.muted}>Signup grant: {defaults.signup_grant_tokens ?? 0} token</Text>
          <LabeledInput label="Daily limit" value={defaultsForm.daily_limit} onChangeText={(v) => setDefaultsForm((p) => ({ ...p, daily_limit: v }))} />
          <LabeledInput label="Weekly limit" value={defaultsForm.weekly_limit} onChangeText={(v) => setDefaultsForm((p) => ({ ...p, weekly_limit: v }))} />
          <PrimaryButton title={saving ? 'Saving...' : 'Apply to users'} onPress={saveDefaults} disabled={saving} />
        </View>
      ) : null}

      {tab === 'users' ? (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Email veya isim ara"
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchUsers}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          {users.map((item) => (
            <TouchableOpacity key={item.id} style={styles.userRow} onPress={() => openUser(item)}>
              <View style={styles.userMain}>
                <Text style={styles.userName}>{item.display_name || item.email}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
              </View>
              <Text style={styles.userTokens}>{item.is_admin ? 'ADMIN' : getUserBalance(item)}</Text>
            </TouchableOpacity>
          ))}

          {selected ? (
            <View style={styles.card}>
              <Text style={styles.title}>{selected.display_name}</Text>
              <Text style={styles.muted}>{selected.email} - ID {selected.user_id}</Text>
              <View style={styles.grid}>
                <Stat label="Balance" value={selected.unlimited ? 'Unlimited' : selected.balance} />
                <Stat label="Spent" value={selected.total_spent} />
              </View>
              <LabeledInput label="Daily limit" value={quotaForm.daily_limit} onChangeText={(v) => setQuotaForm((p) => ({ ...p, daily_limit: v }))} />
              <LabeledInput label="Weekly limit" value={quotaForm.weekly_limit} onChangeText={(v) => setQuotaForm((p) => ({ ...p, weekly_limit: v }))} />
              <View style={styles.actions}>
                <PrimaryButton title="Save quota" onPress={saveQuota} disabled={saving} />
                <SecondaryButton title="Reset" onPress={resetQuota} disabled={saving} />
              </View>

              <Text style={styles.subTitle}>Grant tokens</Text>
              <View style={styles.inlineInputs}>
                <TextInput style={[styles.input, styles.amountInput]} placeholder="Amount" placeholderTextColor="#64748b" keyboardType="number-pad" value={grantAmount} onChangeText={setGrantAmount} />
                <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#64748b" value={grantDesc} onChangeText={setGrantDesc} />
              </View>
              <PrimaryButton title="Grant" onPress={grantTokens} disabled={saving || !grantAmount} />

              <Text style={styles.subTitle}>External keys</Text>
              {PROVIDERS.map((provider) => (
                <View key={provider} style={styles.keyBox}>
                  <Text style={styles.provider}>{provider}</Text>
                  <Text style={styles.muted}>{userKeys[provider] ? `Current: ${userKeys[provider]}` : 'No key saved'}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`${provider} API key`}
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    autoCapitalize="none"
                    value={keyInputs[provider] || ''}
                    onChangeText={(v) => setKeyInputs((p) => ({ ...p, [provider]: v }))}
                  />
                  <View style={styles.actions}>
                    <PrimaryButton title="Save" onPress={() => saveKey(provider)} disabled={saving || !keyInputs[provider]} />
                    {userKeys[provider] ? <SecondaryButton title="Delete" onPress={() => deleteKey(provider)} disabled={saving} danger /> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function getUserBalance(user) {
  if (typeof user?.token_balance === 'number') return user.token_balance.toLocaleString();
  return Number(user?.token_balance?.balance || 0).toLocaleString();
}

function Stat({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{Number.isFinite(Number(value)) ? Number(value).toLocaleString() : value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LabeledInput({ label, value, onChangeText }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={value} onChangeText={onChangeText} placeholderTextColor="#64748b" />
    </View>
  );
}

function PrimaryButton({ title, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.primaryBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ title, onPress, disabled, danger }) {
  return (
    <TouchableOpacity style={[styles.secondaryBtn, danger && styles.dangerBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.secondaryText, danger && styles.dangerText]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  tabs: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 16, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: '#1e293b' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#d946ef' },
  tabText: { color: '#94a3b8', fontWeight: '900', textTransform: 'capitalize' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginTop: 12, gap: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  subTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 8 },
  muted: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, backgroundColor: '#0f172a', borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', color: '#fff', paddingHorizontal: 14 },
  searchBtn: { backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center' },
  searchBtnText: { color: '#cbd5e1', fontWeight: '900' },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  userMain: { flex: 1 },
  userName: { color: '#f8fafc', fontSize: 15, fontWeight: '900' },
  userEmail: { color: '#64748b', fontSize: 12, marginTop: 3 },
  userTokens: { color: '#38bdf8', fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, minWidth: '45%', backgroundColor: '#020617', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1e293b' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 11, fontWeight: '900', marginTop: 4 },
  field: { gap: 6 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  input: { flex: 1, borderColor: '#334155', borderWidth: 1, borderRadius: 14, color: '#f8fafc', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#020617', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: '#d946ef', paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondaryBtn: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  secondaryText: { color: '#cbd5e1', fontWeight: '900' },
  dangerBtn: { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  dangerText: { color: '#f87171' },
  disabled: { opacity: 0.45 },
  inlineInputs: { flexDirection: 'row', gap: 8 },
  amountInput: { maxWidth: 110 },
  keyBox: { gap: 8, backgroundColor: '#020617', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#1e293b' },
  provider: { color: '#f8fafc', fontWeight: '900', textTransform: 'capitalize' },
});
