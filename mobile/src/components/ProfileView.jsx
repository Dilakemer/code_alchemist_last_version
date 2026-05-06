import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ProfileView({ user, onLogout, onDeleteAccount }) {
  const handleFeatureUnderDev = (feature) => {
    Alert.alert('Coming Soon', `${feature} is currently under construction for mobile. Stay tuned! 🧪`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.display_name?.[0]?.toUpperCase() || 'A'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.editBadge} 
            onPress={() => handleFeatureUnderDev('Avatar Upload')}
          >
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{user?.display_name || 'Alchemist'}</Text>
        <Text style={styles.email}>{user?.email || 'No email'}</Text>
        <View style={styles.levelRow}>
          <Text style={styles.levelTag}>LEVEL {user?.level || 1}</Text>
          <Text style={styles.rankText}>{user?.rank_title || 'Novice Alchemist'}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{user?.tokens || 0}</Text>
          <Text style={styles.statLabel}>Tokens</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{user?.xp || 0}</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{user?.coins || 0}</Text>
          <Text style={styles.statLabel}>Coins</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => handleFeatureUnderDev('Edit Profile')}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuText}>Edit Profile</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => handleFeatureUnderDev('Security')}>
          <Text style={styles.menuIcon}>🔒</Text>
          <Text style={styles.menuText}>Security & Privacy</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => handleFeatureUnderDev('Notifications')}>
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={styles.menuText}>Notifications</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>🌓</Text>
          <Text style={styles.menuText}>Dark Mode</Text>
          <Text style={styles.activeText}>Always On</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => handleFeatureUnderDev('Language Selection')}>
          <Text style={styles.menuIcon}>🌐</Text>
          <Text style={styles.menuText}>Language</Text>
          <Text style={styles.activeText}>English</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.deleteBtn} 
        onPress={onDeleteAccount}
      >
        <Text style={styles.deleteText}>Delete Account</Text>
      </TouchableOpacity>

      <Text style={styles.version}>CodeAlchemist v2.5.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d946ef',
  },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: '900' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#d946ef',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#020617',
  },
  editIcon: { fontSize: 14 },
  name: { color: '#fff', fontSize: 24, fontWeight: '900' },
  email: { color: '#64748b', fontSize: 14, marginTop: 4 },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  levelTag: {
    backgroundColor: '#d946ef',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: '900',
  },
  rankText: { color: '#d946ef', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuText: { color: '#f1f5f9', fontSize: 15, fontWeight: '600', flex: 1 },
  arrow: { color: '#475569', fontSize: 20 },
  activeText: { color: '#d946ef', fontSize: 13, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 16 },
  deleteBtn: {
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
  },
  deleteText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  version: { color: '#334155', textAlign: 'center', marginTop: 30, fontSize: 12, fontWeight: '600' },
});
