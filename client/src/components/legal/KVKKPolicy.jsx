import React from 'react';
import './LegalPages.css';

const KVKKPolicy = () => {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <h1>KİŞİSEL VERİLERİN KORUNMASI AYDINLATMA METNİ</h1>
        <p><strong>Veri Sorumlusu:</strong> CodeAlchemist</p>
        <p className="effective-date">Yürürlük Tarihi: 01.01.2024</p>

        <h2>1. İşlenen Veriler</h2>
        <p>Platform kullanımınıza bağlı olarak şu veriler işlenebilir:</p>
        <ul>
          <li>ad-soyad</li>
          <li>e-posta, telefon</li>
          <li>hesap ve üyelik bilgileri</li>
          <li>fatura bilgileri</li>
          <li>IP, log, cihaz, tarayıcı verileri</li>
          <li>işlem güvenliği verileri</li>
          <li>destek kayıtları</li>
          <li>kullanım verileri</li>
          <li>ödeme işlemine ilişkin sınırlı bilgiler</li>
        </ul>

        <h2>2. İşleme Amaçları</h2>
        <p>Kişisel verileriniz aşağıdaki amaçlarla işlenebilir:</p>
        <ul>
          <li>üyelik ve hesap yönetimi</li>
          <li>hizmetlerin sunulması</li>
          <li>ödeme süreçleri</li>
          <li>müşteri destek hizmetleri</li>
          <li>bilgi güvenliği ve sahteciliğin önlenmesi</li>
          <li>faturalandırma ve muhasebe</li>
          <li>sözleşmesel yükümlülüklerin yerine getirilmesi</li>
          <li>hukuki yükümlülüklerin yerine getirilmesi</li>
          <li>talep ve şikayetlerin yönetimi</li>
          <li>izin varsa pazarlama faaliyetleri</li>
        </ul>

        <h2>3. Hukuki Sebepler</h2>
        <p>Verileriniz KVKK m.5 ve m.6 kapsamında; sözleşmenin kurulması/ifası, hukuki yükümlülük, meşru menfaat, bir hakkın tesisi/kullanılması/korunması, açık rıza sebeplerine dayanılarak işlenebilir.</p>

        <h2>4. Aktarım</h2>
        <p>Verileriniz; ödeme kuruluşlarına (ör. Iyzico), hosting/bulut sağlayıcılarına, e-posta ve iletişim altyapılarına, muhasebe/fatura entegrasyonlarına, hukuk/danışmanlık hizmeti alınan taraflara, yetkili kamu kurum ve kuruluşlarına mevzuata uygun şekilde aktarılabilir.</p>

        <h2>5. Toplama Yöntemi</h2>
        <p>Veriler; üyelik formları, sipariş ekranları, çerezler, log kayıtları, destek talepleri, e-posta ve otomatik sistemler aracılığıyla toplanabilir.</p>

        <h2>6. Haklarınız</h2>
        <p>KVKK m.11 uyarınca; verinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işleme amacını öğrenme, aktarılan kişileri öğrenme, düzeltme talep etme, silme/yok etme talep etme, itiraz etme, zarar halinde tazminat talep etme haklarına sahipsiniz.</p>

        <h2>7. Başvuru</h2>
        <p>Başvurularınızı info@codealchemist.com.tr veya izmir üzerinden iletebilirsiniz.</p>
      </div>
    </div>
  );
};

export default KVKKPolicy;
