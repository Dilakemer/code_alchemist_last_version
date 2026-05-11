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
  deleteExternalApiKey,
  getExternalApiKeys,
  saveExternalApiKey,
  validateExternalApiKey,
} from '../services/api';

const PROVIDERS = ['openai', 'anthropic', 'gemini'];

export default function ApiKeysView({ token, onChanged }) {
  const [keys, setKeys] = useState({});
  const [inputs, setInputs] = useState({});
  const [visible, setVisible] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState('');
  const [status, setStatus] = useState({});

  const loadKeys = async () => {
    setLoading(true);
    try {
      const data = await getExternalApiKeys(token);
      const next = {};
      (data.keys || []).forEach((item) => {
        next[item.provider] = item.mask;
      });
      setKeys(next);
    } catch (err) {
      Alert.alert('API Keys', err.message || 'Anahtarlar yuklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, [token]);

  const setInput = (provider, value) => {
    setInputs((prev) => ({ ...prev, [provider]: value }));
    setStatus((prev) => ({ ...prev, [provider]: null }));
  };

  const testKey = async (provider) => {
    const apiKey = inputs[provider]?.trim();
    if (!apiKey) return;
    setBusyProvider(provider);
    try {
      const data = await validateExternalApiKey(token, { provider, api_key: apiKey });
      setStatus((prev) => ({
        ...prev,
        [provider]: data.valid ? { type: 'success', text: 'Anahtar gecerli.' } : { type: 'error', text: data.error || 'Dogrulama basarisiz.' },
      }));
    } catch (err) {
      setStatus((prev) => ({ ...prev, [provider]: { type: 'error', text: err.message || 'Dogrulama hatasi.' } }));
    } finally {
      setBusyProvider('');
    }
  };

  const saveKey = async (provider) => {
    const apiKey = inputs[provider]?.trim();
    if (!apiKey) return;
    setBusyProvider(provider);
    try {
      const data = await saveExternalApiKey(token, { provider, api_key: apiKey });
      setKeys((prev) => ({ ...prev, [provider]: data.mask }));
      setInputs((prev) => ({ ...prev, [provider]: '' }));
      setStatus((prev) => ({ ...prev, [provider]: { type: 'success', text: 'Kaydedildi.' } }));
      onChanged?.();
    } catch (err) {
      setStatus((prev) => ({ ...prev, [provider]: { type: 'error', text: err.message || 'Kaydedilemedi.' } }));
    } finally {
      setBusyProvider('');
    }
  };

  const removeKey = (provider) => {
    Alert.alert('Anahtari sil', `${provider} anahtari silinsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setBusyProvider(provider);
          try {
            await deleteExternalApiKey(token, provider);
            setKeys((prev) => {
              const next = { ...prev };
              delete next[provider];
              return next;
            });
            onChanged?.();
          } catch (err) {
            Alert.alert('API Keys', err.message || 'Silinemedi.');
          } finally {
            setBusyProvider('');
          }
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#d946ef" />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>External API Keys</Text>
        <Text style={styles.title}>Kendi anahtarlarini kullan</Text>
        <Text style={styles.body}>
          Aktif harici anahtar token dusumunu atlar. Anahtarlar backend tarafinda sifreli saklanir.
        </Text>
      </View>

      {PROVIDERS.map((provider) => {
        const providerStatus = status[provider];
        const isBusy = busyProvider === provider;
        return (
          <View key={provider} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.provider}>{provider}</Text>
                <Text style={styles.mask}>{keys[provider] ? `Current: ${keys[provider]}` : 'No key saved'}</Text>
              </View>
              {keys[provider] ? (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeKey(provider)} disabled={isBusy}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={`${provider} API key`}
                placeholderTextColor="#64748b"
                secureTextEntry={!visible[provider]}
                autoCapitalize="none"
                autoCorrect={false}
                value={inputs[provider] || ''}
                onChangeText={(value) => setInput(provider, value)}
              />
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => setVisible((prev) => ({ ...prev, [provider]: !prev[provider] }))}
              >
                <Text style={styles.smallBtnText}>{visible[provider] ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {providerStatus ? (
              <Text style={[styles.status, providerStatus.type === 'error' ? styles.error : styles.success]}>
                {providerStatus.text}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.secondaryBtn, (!inputs[provider] || isBusy) && styles.disabled]}
                onPress={() => testKey(provider)}
                disabled={!inputs[provider] || isBusy}
              >
                <Text style={styles.secondaryText}>{isBusy ? 'Working...' : 'Test'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (!inputs[provider] || isBusy) && styles.disabled]}
                onPress={() => saveKey(provider)}
                disabled={!inputs[provider] || isBusy}
              >
                <Text style={styles.primaryText}>Save Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  eyebrow: { color: '#38bdf8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 6 },
  body: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 8 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  provider: { color: '#f8fafc', fontSize: 16, fontWeight: '900', textTransform: 'capitalize' },
  mask: { color: '#64748b', fontSize: 12, marginTop: 3, fontFamily: 'monospace' },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  deleteText: { color: '#f87171', fontSize: 12, fontWeight: '900' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#020617',
    fontSize: 14,
  },
  smallBtn: { backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  smallBtnText: { color: '#cbd5e1', fontWeight: '800', fontSize: 12 },
  status: { marginTop: 10, fontSize: 12, fontWeight: '700' },
  success: { color: '#34d399' },
  error: { color: '#fb7185' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: { flex: 1, backgroundColor: '#d946ef', paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondaryBtn: { width: 92, backgroundColor: '#1e293b', paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  secondaryText: { color: '#cbd5e1', fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
