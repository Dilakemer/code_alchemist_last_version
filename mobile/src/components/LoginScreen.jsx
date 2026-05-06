import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LegalModal from './LegalModal';

const { width } = Dimensions.get('window');

export default function LoginScreen({ onLogin, onGoogleLogin, loading }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptCommercial, setAcceptCommercial] = useState(false);
  const [legalModal, setLegalModal] = useState({ visible: false, type: 'terms' });

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Hata', 'Lütfen e-posta ve şifrenizi giriniz.');
      return;
    }
    if (authMode === 'register') {
      if (!displayName.trim()) {
        Alert.alert('Hata', 'Lütfen bir ad belirtiniz.');
        return;
      }
      if (!acceptTerms) {
        Alert.alert('Onay Gerekli', 'Devam etmek için Kullanım Koşulları ve KVKK metnini kabul etmelisiniz.');
        return;
      }
    }
    onLogin({ 
      email, 
      password, 
      displayName, 
      mode: authMode,
      acceptTerms,
      acceptCommercial
    });
  };

  const openLegal = (type) => {
    setLegalModal({ visible: true, type });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
        <Text style={styles.welcomeText}>
          {authMode === 'login' ? 'Tekrar Hoş Geldiniz, Alchemist' : 'Simya Dünyasına Katılın'}
        </Text>
        <Text style={styles.subText}>
          {authMode === 'login' ? 'Transmutasyona devam etmek için giriş yapın' : 'Yolculuğunuza başlamak için bir hesap oluşturun'}
        </Text>
      </View>

      <View style={styles.formCard}>
        {authMode === 'register' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="AlchemistName"
              placeholderTextColor="#475569"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#475569"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {authMode === 'register' && (
          <View style={styles.checkboxArea}>
            <TouchableOpacity 
              style={styles.checkboxRow} 
              onPress={() => setAcceptTerms(!acceptTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptTerms && styles.checkboxActive]}>
                {acceptTerms && <Text style={styles.checkIcon}>✓</Text>}
              </View>
              <Text style={styles.checkboxText}>
                <Text style={styles.link} onPress={() => openLegal('terms')}>Üyelik ve Kullanım Koşulları</Text>'nı ve <Text style={styles.link} onPress={() => openLegal('privacy')}>KVKK Aydınlatma Metni</Text>'ni okudum, anladım ve kabul ediyorum.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.checkboxRow} 
              onPress={() => setAcceptCommercial(!acceptCommercial)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptCommercial && styles.checkboxActive]}>
                {acceptCommercial && <Text style={styles.checkIcon}>✓</Text>}
              </View>
              <Text style={styles.checkboxText}>
                Pazarlama ve kampanya duyuruları için ticari elektronik ileti almayı kabul ediyorum. (Opsiyonel)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.primaryBtn, loading && styles.disabledBtn]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {authMode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.googleBtn} onPress={onGoogleLogin}>
          <Text style={styles.googleBtnText}>Google ile Devam Et</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {authMode === 'login' ? "Henüz hesabınız yok mu? " : "Zaten hesabınız var mı? "}
        </Text>
        <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
          <Text style={styles.toggleText}>
            {authMode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
          </Text>
        </TouchableOpacity>
      </View>

      <LegalModal 
        visible={legalModal.visible} 
        type={legalModal.type} 
        onClose={() => setLegalModal({ ...legalModal, visible: false })} 
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: width * 0.7, height: 60, marginBottom: 20 },
  welcomeText: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subText: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 8 },
  formCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  inputGroup: { marginBottom: 20 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    padding: 16,
    fontSize: 15,
  },
  checkboxArea: { marginBottom: 24, gap: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#d946ef',
    borderColor: '#d946ef',
  },
  checkIcon: { color: '#fff', fontSize: 12, fontWeight: '900' },
  checkboxText: { color: '#64748b', fontSize: 12, flex: 1, lineHeight: 18 },
  link: { color: '#d946ef', fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#d946ef',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: '#1e293b' },
  dividerText: { color: '#475569', fontSize: 10, fontWeight: '800' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  googleIcon: { width: 20, height: 20 },
  googleBtnText: { color: '#1e293b', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { color: '#64748b', fontSize: 14 },
  toggleText: { color: '#d946ef', fontSize: 14, fontWeight: '800' },
});
