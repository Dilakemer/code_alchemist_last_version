import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function Sidebar({ isOpen, onClose, onNavigate, onSharePress, onCollabPress, user, activeView }) {
  if (!isOpen) return null;

  const menuItems = [
    { id: 'chat', label: 'AI Chat', icon: '💬' },
    { id: 'compare', label: 'Model Alchemy', icon: '⚗️' },
    { id: 'snippets', label: 'Code Snippets', icon: '📁' },
    { id: 'stats', label: 'My Rank & Stats', icon: '🏆' },
    { id: 'feed', label: 'Following Feed', icon: '👥' },
    { id: 'community', label: 'Community Feed', icon: '🌍' },
    { id: 'weekly', label: 'Weekly Summary', icon: '📊' },
    { id: 'cost', label: 'Cost Dashboard', icon: '📈' },
    { id: 'profile', label: 'My Profile', icon: '👤' },
  ];

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.drawer} edges={['left', 'top', 'bottom']}>
        <View style={styles.header}>
          <Image 
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <ScrollView style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, activeView === item.id ? styles.menuItemActive : null]}
              onPress={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, activeView === item.id ? styles.menuLabelActive : null]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.collabButton}
            onPress={() => {
              onCollabPress();
              onClose();
            }}
          >
            <Text style={styles.collabIcon}>🤝</Text>
            <View>
              <Text style={styles.collabTitle}>Collaborate</Text>
              <Text style={styles.collabSub}>Share Session</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.communityButton}
            onPress={() => {
              onSharePress();
              onClose();
            }}
          >
            <Text style={styles.communityIcon}>+</Text>
            <Text style={styles.communityText}>Share with Community</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.tokenCard}>
            <Text style={styles.tokenTitle}>Balance: {user?.tokens || 0} Tokens</Text>
            <Text style={styles.tokenSub}>Level {user?.level || 1} Alchemist</Text>
            <View style={styles.tokenActions}>
              <TouchableOpacity style={styles.tokenBtn}>
                <Text style={styles.tokenBtnText}>Store</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tokenBtn, styles.proBtn]}>
                <Text style={styles.tokenBtnText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 1000,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  drawer: {
    width: width * 0.75,
    backgroundColor: '#020617',
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: 40,
  },
  workspaceTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  menuList: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(217, 70, 239, 0.1)',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  menuLabel: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  menuLabelActive: {
    color: '#d946ef',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 16,
  },
  collabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
    marginBottom: 12,
  },
  collabIcon: { fontSize: 24, marginRight: 12 },
  collabTitle: { color: '#10b981', fontWeight: '700', fontSize: 15 },
  collabSub: { color: '#64748b', fontSize: 12 },
  communityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 70, 239, 0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.1)',
  },
  communityIcon: { color: '#d946ef', fontSize: 20, marginRight: 8, fontWeight: '700' },
  communityText: { color: '#d946ef', fontWeight: '700', fontSize: 15 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
  },
  tokenCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tokenTitle: { color: '#38bdf8', fontWeight: '800', fontSize: 14, marginBottom: 8 },
  tokenSub: { color: '#64748b', fontSize: 11, marginBottom: 2 },
  tokenActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tokenBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  proBtn: {
    backgroundColor: '#701a75',
  },
  tokenBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
