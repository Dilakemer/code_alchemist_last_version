import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { publishToCommunity } from '../services/api';

export default function CreatePostModal({ visible, onClose, token }) {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [solution, setSolution] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    if (!title.trim() || !solution.trim()) {
      Alert.alert('Required Fields', 'Title and Solution are required.');
      return;
    }

    setLoading(true);
    try {
      await publishToCommunity(token, {
        title: title.trim(),
        code: code.trim(),
        solution: solution.trim(),
      });
      Alert.alert('Success', 'Your post has been shared with the community! 🚀');
      setTitle('');
      setCode('');
      setSolution('');
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to publish post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Community Post</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <Text style={styles.label}>Post Title / Question *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. How to use reanimated in Expo?"
              placeholderTextColor="#64748b"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Code Snippet (Optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline, styles.code]}
              placeholder="Paste your code here..."
              placeholderTextColor="#64748b"
              multiline
              value={code}
              onChangeText={setCode}
            />

            <Text style={styles.label}>The Solution / Content *</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Share the answer or your thoughts..."
              placeholderTextColor="#64748b"
              multiline
              value={solution}
              onChangeText={setSolution}
            />

            <TouchableOpacity 
              style={[styles.publishBtn, loading && styles.disabledBtn]} 
              onPress={handlePublish}
              disabled={loading}
            >
              <Text style={styles.publishBtnText}>{loading ? 'Sharing...' : 'Share with Community'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  closeText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  form: { flex: 1, padding: 20 },
  label: { color: '#d946ef', fontSize: 13, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
    fontSize: 15,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
  publishBtn: {
    backgroundColor: '#d946ef',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  disabledBtn: { opacity: 0.6 },
  publishBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
