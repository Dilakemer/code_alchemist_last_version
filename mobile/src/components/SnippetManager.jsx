import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getSnippets, createSnippet, deleteSnippet } from '../services/api';

export default function SnippetManager({ token }) {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchSnippets();
  }, []);

  const fetchSnippets = async () => {
    try {
      const data = await getSnippets(token);
      setSnippets(data.snippets || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!title.trim() || !code.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setAdding(true);
    try {
      await createSnippet(token, { title, code, language: 'javascript' });
      setTitle('');
      setCode('');
      fetchSnippets();
    } catch (err) {
      Alert.alert('Error', 'Failed to save snippet');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Delete this snippet?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await deleteSnippet(token, id);
            setSnippets((prev) => prev.filter((s) => s.id !== id));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#d946ef" />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.addCard}>
        <Text style={styles.cardTitle}>New Snippet</Text>
        <TextInput
          style={styles.input}
          placeholder="Title (e.g. Auth Hook)"
          placeholderTextColor="#64748b"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="Paste your code..."
          placeholderTextColor="#64748b"
          multiline
          value={code}
          onChangeText={setCode}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={adding}>
          <Text style={styles.addBtnText}>{adding ? 'Saving...' : 'Save Snippet'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.listTitle}>Saved Snippets ({snippets.length})</Text>
      {snippets.map((s) => (
        <View key={s.id} style={styles.snippetCard}>
          <View style={styles.snippetHeader}>
            <Text style={styles.snippetTitle}>{s.title}</Text>
            <TouchableOpacity onPress={() => handleDelete(s.id)}>
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.snippetCode} numberOfLines={5}>
            {s.code}
          </Text>
          <Text style={styles.snippetMeta}>{s.language} • {new Date(s.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  addCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#fff',
    padding: 12,
    marginBottom: 12,
  },
  codeInput: { minHeight: 100, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 13 },
  addBtn: { backgroundColor: '#d946ef', padding: 14, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800' },
  listTitle: { color: '#94a3b8', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  snippetCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  snippetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  snippetTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  deleteIcon: { fontSize: 18 },
  snippetCode: { color: '#94a3b8', fontFamily: 'monospace', fontSize: 12, backgroundColor: '#020617', padding: 8, borderRadius: 8 },
  snippetMeta: { color: '#475569', fontSize: 11, marginTop: 8, textTransform: 'uppercase' },
});
