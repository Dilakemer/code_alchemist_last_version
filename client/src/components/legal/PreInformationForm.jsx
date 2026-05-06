import React from 'react';
import './LegalPages.css';

const PreInformationForm = () => {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <h1>ÖN BİLGİLENDİRME FORMU</h1>
        <p className="effective-date">Yürürlük Tarihi: 01.01.2024</p>

        <h2>1. Satıcı Bilgileri</h2>
        <ul>
          <li><strong>Unvan:</strong> CodeAlchemist</li>
          <li><strong>Adres:</strong> izmir</li>
          <li><strong>E-posta:</strong> info@codealchemist.com.tr</li>
        </ul>

        <h2>2. Hizmetin Temel Nitelikleri</h2>
        <p>Code Alchemist üzerinden sunulan ürün/hizmet; dijital üyelik, abonelik, API erişimi, yazılım kullanım hakkı, dijital araç kullanımı, Platform Bakiyesi yüklemesi veya diğer çevrimiçi hizmetlerden oluşabilir. Siparişe ilişkin temel bilgiler ödeme öncesinde gösterilir.</p>

        <h2>3. Toplam Bedel</h2>
        <p>Toplam ücret, vergiler dahil/dahil değil bilgisiyle sipariş ekranında açıkça belirtilir.</p>

        <h2>4. Ödeme ve İfa</h2>
        <p>Ödeme Iyzico veya belirtilen yöntemlerle alınır. Dijital hizmet ödeme onayını takiben Kullanıcı hesabına tanımlanabilir ve ifasına derhal başlanabilir.</p>

        <h2>5. Cayma Hakkı Hakkında</h2>
        <p>Mesafeli sözleşmelere ilişkin mevzuat uyarınca, elektronik ortamda anında ifa edilen dijital hizmetler veya ifasına tüketicinin onayı ile başlanan hizmetler bakımından cayma hakkı istisnası uygulanabilir. Kullanıcı, ödeme öncesinde bu konuda ayrıca bilgilendirilir.</p>

        <h2>6. İptal / İade</h2>
        <p>İptal ve iade koşulları İade ve İptal Politikası'nda düzenlenmiştir.</p>

        <h2>7. Başvuru Yolları</h2>
        <p>Tüketiciler, uyuşmazlık halinde ilgili Tüketici Hakem Heyeti veya Tüketici Mahkemesi'ne başvurabilir.</p>

        <h2>8. Onay</h2>
        <p>Kullanıcı, bu Ön Bilgilendirme Formu'nu okuyup anladığını ve elektronik ortamda onayladığını kabul eder.</p>
      </div>
    </div>
  );
};

export default PreInformationForm;
