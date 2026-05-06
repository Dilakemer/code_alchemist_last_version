import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Platform,
} from 'react-native';

const modelInfo = {
  'auto': { label: 'Auto (Smart Model)', icon: '✨', color: '#d946ef' },
  'gemini-3-flash-preview': { label: 'Gemini 3 Flash (Preview)', icon: 'G', color: '#4285F4' },
  'gemini-3.1-flash-lite-preview': { label: 'Gemini 3.1 Flash Lite', icon: 'G', color: '#4285F4' },
  'gemini-2.5-flash-lite': { label: 'Gemini 2.5 Flash Lite', icon: 'G', color: '#4285F4' },
  'gemini-2.5-flash': { label: 'Gemini 2.5 Flash', icon: 'G', color: '#4285F4' },
  'gpt-4o': { label: 'GPT-4o (OpenAI)', icon: 'O', color: '#10a37f' },
  'claude-sonnet-4-5-20250929': { label: 'Claude 4.5 Sonnet', icon: 'C', color: '#d97706' },
  'claude-opus-4-5-20251101': { label: 'Claude 4.5 Opus', icon: 'C', color: '#d97706' },
};

export default function ModelSelector({ models = [], selected = [], onChange, multiSelect = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [useMulti, setUseMulti] = useState(multiSelect);

  const isSelected = (m) => selected && selected.includes(m);

  const getInfo = (m) => modelInfo[m] || { label: m, icon: 'M', color: '#64748b' };

  const filtered = useMemo(() => {
    const term = (search || '').toLowerCase();
    if (!term) return models;
    return models.filter((m) => {
      const info = getInfo(m);
      return info.label.toLowerCase().includes(term) || m.toLowerCase().includes(term);
    });
  }, [models, search]);

  const toggleModel = (m) => {
    if (useMulti) {
      if (isSelected(m)) onChange(selected.filter((s) => s !== m));
      else onChange([...(selected || []), m]);
    } else {
      onChange([m]);
      setOpen(false);
    }
  };

  const displayLabel = useMemo(() => {
    if (useMulti) return `${(selected || []).length} Models Selected`;
    const sel = selected && selected[0];
    return getInfo(sel).label || 'Auto (Smart Model)';
  }, [selected, useMulti]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Model Selection</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <View style={[styles.triggerIcon, { backgroundColor: getInfo(selected && selected[0]).color + '20' }]}>
          <Text style={[styles.triggerIconText, { color: getInfo(selected && selected[0]).color }]}>
            {getInfo(selected && selected[0]).icon}
          </Text>
        </View>
        <Text style={styles.triggerText} numberOfLines={1}>{displayLabel}</Text>
        <Text style={styles.chev}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <View style={styles.headerTop}>
              <Text style={styles.menuTitle}>Choose Models</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Multi-Model Mode</Text>
              <TouchableOpacity
                style={[styles.switch, useMulti ? styles.switchOn : styles.switchOff]}
                onPress={() => setUseMulti((v) => !v)}
              >
                <View style={[styles.knob, useMulti ? styles.knobOn : styles.knobOff]} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <TextInput
                style={styles.search}
                placeholder="Search models..."
                placeholderTextColor="#64748b"
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filtered.length === 0 && (
              <Text style={styles.empty}>Model not found</Text>
            )}
            {filtered.map((m) => {
              const info = getInfo(m);
              const active = isSelected(m);
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.item, active ? styles.itemActive : null]}
                  onPress={() => toggleModel(m)}
                >
                  <View style={[styles.modelIcon, { backgroundColor: info.color + '20' }]}>
                    <Text style={[styles.modelIconText, { color: info.color }]}>{info.icon}</Text>
                  </View>
                  <View style={styles.itemMain}>
                    <Text style={[styles.itemText, active ? styles.itemTextActive : null]}>{info.label}</Text>
                    <Text style={styles.itemSubText}>{m}</Text>
                  </View>
                  {useMulti && (
                    <View style={[styles.checkbox, active ? styles.checkboxOn : styles.checkboxOff]}>
                      {active && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.applyButton} onPress={() => setOpen(false)}>
              <Text style={styles.applyButtonText}>Apply Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  title: { color: '#94a3b8', fontWeight: '700', marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  triggerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  triggerIconText: {
    fontSize: 14,
    fontWeight: '900',
  },
  triggerText: { color: '#f1f5f9', flex: 1, fontWeight: '600', fontSize: 15 },
  chev: { color: '#64748b', marginLeft: 8, fontSize: 18 },

  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)' },
  menuContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    maxHeight: '80%',
  },
  menuHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  closeText: { color: '#64748b', fontSize: 20, fontWeight: '600' },
  
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  toggleLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  switch: { width: 52, height: 28, borderRadius: 20, padding: 4 },
  switchOn: { backgroundColor: '#d946ef' },
  switchOff: { backgroundColor: '#334155' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  
  searchWrap: { marginTop: 0 },
  search: { backgroundColor: '#020617', color: '#f8fafc', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', fontSize: 15 },

  list: { maxHeight: 400 },
  listContent: { padding: 12 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 8 },
  itemActive: { backgroundColor: 'rgba(217, 70, 239, 0.1)', borderWidth: 1, borderColor: 'rgba(217, 70, 239, 0.3)' },
  modelIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modelIconText: { fontSize: 18, fontWeight: '900' },
  itemMain: { flex: 1 },
  itemText: { color: '#f1f5f9', fontWeight: '700', fontSize: 15 },
  itemTextActive: { color: '#d946ef' },
  itemSubText: { color: '#64748b', fontSize: 12, marginTop: 2 },
  
  checkbox: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#d946ef' },
  checkboxOff: { borderWidth: 2, borderColor: '#334155' },
  checkMark: { color: '#fff', fontWeight: '900', fontSize: 14 },

  empty: { color: '#64748b', textAlign: 'center', padding: 24, fontSize: 15 },
  footerRow: { padding: 20, borderTopWidth: 1, borderTopColor: '#1e293b', paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  applyButton: { backgroundColor: '#d946ef', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  applyButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
