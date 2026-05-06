import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function ComparisonScreen({ 
  availableModels = [], 
  onCompare, 
  busy = false,
  results = []
}) {
  const [model1, setModel1] = useState(availableModels[1] || 'gemini-2.5-flash');
  const [model2, setModel2] = useState(availableModels[5] || 'gpt-4o');
  const [question, setQuestion] = useState('');
  const [selectingFor, setSelectingFor] = useState(null); // 1 or 2

  const handleStartCompare = () => {
    if (!question.trim()) return;
    onCompare(question, [model1, model2]);
  };

  const renderModelItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.modalItem} 
      onPress={() => {
        if (selectingFor === 1) setModel1(item);
        else setModel2(item);
        setSelectingFor(null);
      }}
    >
      <Text style={styles.modalItemText}>{item}</Text>
      {(selectingFor === 1 ? model1 : model2) === item && (
        <Text style={styles.checkIcon}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.icon}>⚗️</Text>
            <View>
              <Text style={styles.title}>Model Alchemy</Text>
              <Text style={styles.subtitle}>Compare two models, choose the best response</Text>
            </View>
          </View>
        </View>

        <View style={styles.selectorsRow}>
          <TouchableOpacity 
            style={styles.tubeContainer} 
            onPress={() => setSelectingFor(1)}
          >
            <Text style={styles.tubeLabel}>🧪 Test Tube 1</Text>
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerText} numberOfLines={1}>{model1}</Text>
              <Text style={styles.downArrow}>▼</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.vsIcon}>⚔️</Text>

          <TouchableOpacity 
            style={styles.tubeContainer} 
            onPress={() => setSelectingFor(2)}
          >
            <Text style={styles.tubeLabel}>🧪 Test Tube 2</Text>
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerText} numberOfLines={1}>{model2}</Text>
              <Text style={styles.downArrow}>▼</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Enter alchemy formula... (type your question)"
            placeholderTextColor="#64748b"
            multiline
            value={question}
            onChangeText={setQuestion}
          />
          <TouchableOpacity 
            style={[styles.compareBtn, (busy || !question.trim()) && styles.disabledBtn]} 
            onPress={handleStartCompare}
            disabled={busy || !question.trim()}
          >
            <Text style={styles.compareBtnText}>{busy ? 'Transmuting...' : '⚗️ Start Alchemy'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsGrid}>
          <View style={styles.resultCol}>
            <View style={styles.colHeader}>
              <Text style={styles.colHeaderIcon}>🧪</Text>
              <Text style={styles.colHeaderText} numberOfLines={1}>{model1}</Text>
            </View>
            <View style={styles.resultCard}>
              {busy ? (
                <ActivityIndicator color="#d946ef" />
              ) : results.find(r => r.model === model1) ? (
                <ScrollView nestedScrollEnabled style={styles.resultScroll}>
                  <Text style={styles.resultText}>{results.find(r => r.model === model1).response}</Text>
                </ScrollView>
              ) : (
                <View style={styles.readyBox}>
                  <Text style={styles.readyIcon}>⚡</Text>
                  <Text style={styles.readyTitle}>Test tube ready</Text>
                  <Text style={styles.readySub}>Enter formula and start alchemy</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.resultCol}>
            <View style={styles.colHeader}>
              <Text style={styles.colHeaderIcon}>🧪</Text>
              <Text style={styles.colHeaderText} numberOfLines={1}>{model2}</Text>
            </View>
            <View style={styles.resultCard}>
              {busy ? (
                <ActivityIndicator color="#d946ef" />
              ) : results.find(r => r.model === model2) ? (
                <ScrollView nestedScrollEnabled style={styles.resultScroll}>
                  <Text style={styles.resultText}>{results.find(r => r.model === model2).response}</Text>
                </ScrollView>
              ) : (
                <View style={styles.readyBox}>
                  <Text style={styles.readyIcon}>🌿</Text>
                  <Text style={styles.readyTitle}>Test tube ready</Text>
                  <Text style={styles.readySub}>Enter formula and start alchemy</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Model Selection Modal */}
      <Modal visible={selectingFor !== null} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setSelectingFor(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Model for Tube {selectingFor}</Text>
            <FlatList
              data={availableModels.filter(m => m !== 'auto')}
              renderItem={renderModelItem}
              keyExtractor={item => item}
              style={styles.modalList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  container: { padding: 16, paddingBottom: 60 },
  header: { marginBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 32 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#64748b', fontSize: 13, fontWeight: '600', marginTop: 2 },
  selectorsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 20 },
  tubeContainer: { flex: 1 },
  tubeLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  pickerWrapper: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  pickerText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  downArrow: { color: '#d946ef', fontSize: 10, marginLeft: 4 },
  vsIcon: { fontSize: 20, marginBottom: 14, color: '#475569' },
  inputCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.1)',
    marginBottom: 24,
  },
  input: {
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    lineHeight: 24,
  },
  compareBtn: {
    backgroundColor: '#701a75',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d946ef',
  },
  disabledBtn: { opacity: 0.5, borderColor: '#1e293b' },
  compareBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  resultsGrid: { flexDirection: 'row', gap: 12 },
  resultCol: { flex: 1 },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    padding: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#1e293b',
  },
  colHeaderIcon: { fontSize: 16 },
  colHeaderText: { color: '#fff', fontSize: 12, fontWeight: '800', flex: 1 },
  resultCard: {
    backgroundColor: '#020617',
    height: 320,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  readyBox: { alignItems: 'center' },
  readyIcon: { fontSize: 36, marginBottom: 16 },
  readyTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  readySub: { color: '#475569', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  resultScroll: { width: '100%' },
  resultText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    width: '100%',
    maxHeight: '70%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  modalList: { flexGrow: 0 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalItemText: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  checkIcon: { color: '#d946ef', fontSize: 18, fontWeight: '900' },
});
