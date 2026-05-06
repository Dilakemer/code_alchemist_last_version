import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LegalModal({ visible, onClose, type = 'terms' }) {
  const content = {
    terms: {
      title: 'Üyelik ve Kullanım Koşulları',
      text: `CodeAlchemist'e Hoş Geldiniz!
      
1. Hizmet Şartları
CodeAlchemist, yazılımcılar için yapay zeka destekli bir simya laboratuvarıdır. Bu hizmeti kullanarak aşağıdaki şartları kabul etmiş sayılırsınız.

2. Fikri Mülkiyet
Ürettiğiniz kodlar ve transmutasyonlar size aittir. Ancak sistemin gelişimi için anonimleştirilmiş verilerin kullanılmasını kabul edersiniz.

3. Kullanım Sınırları
Yasalara aykırı, kötü niyetli veya sistemi aksatacak kullanımlar yasaktır.

4. Token ve Ödemeler
Platform bakiyesi geri iade edilemez ve sadece platform içi hizmetlerde kullanılabilir.`,
    },
    privacy: {
      title: 'KVKK Aydınlatma Metni',
      text: `Veri Güvenliğiniz Bizim İçin Önemli!
      
1. Veri Sorumlusu
CodeAlchemist olarak kişisel verilerinizin güvenliğini ciddiye alıyoruz.

2. İşlenen Veriler
E-posta adresiniz, kullanıcı adınız ve sistem içindeki tercihleriniz hizmet sunumu amacıyla işlenmektedir.

3. Saklama Süresi
Verileriniz, hesabınız aktif olduğu sürece ve yasal süreler dahilinde saklanır.

4. Haklarınız
KVKK kapsamında verilerinize erişme, silme veya düzeltme talep etme hakkınız saklıdır.`,
    },
  };

  const active = content[type] || content.terms;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{active.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.content}>{active.text}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.bottomBtn} onPress={onClose}>
            <Text style={styles.bottomBtnText}>Okudum, Anladım</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.98)' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '900' },
  closeBtn: { padding: 4 },
  closeText: { color: '#64748b', fontSize: 20 },
  scroll: { padding: 24 },
  content: { color: '#cbd5e1', fontSize: 15, lineHeight: 26 },
  bottomBtn: {
    backgroundColor: '#d946ef',
    margin: 24,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  bottomBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
