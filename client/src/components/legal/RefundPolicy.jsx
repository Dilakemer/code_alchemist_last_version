import React from 'react';
import './LegalPages.css';

const RefundPolicy = () => {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <h1>İADE, İPTAL VE CAYMA POLİTİKASI</h1>
        <p className="effective-date">Yürürlük Tarihi: 01.01.2024</p>

        <h2>1. Genel</h2>
        <p>Bu politika, Code Alchemist üzerinden satın alınan dijital hizmetler, abonelikler ve Platform Bakiyesi için uygulanır.</p>

        <h2>2. Dijital Hizmetler</h2>
        <p>Dijital hizmetin ifasına kullanıcının onayı ile başlanmışsa, ilgili mevzuat kapsamındaki cayma hakkı istisnaları uygulanabilir.</p>

        <h2>3. Abonelikler</h2>
        <p>3.1. Abonelikler seçilen dönem boyunca geçerlidir.</p>
        <p>3.2. Otomatik yenileme varsa ödeme öncesinde kullanıcıya açıkça bildirilir.</p>
        <p>3.3. Kullanıcı, yenilemeyi hesap ayarlarından veya destek üzerinden kapatabilir.</p>
        <p>3.4. İçinde bulunulan abonelik dönemine ilişkin ücret iadesi, hizmetin kullanılmış olması halinde yapılmayabilir.</p>

        <h2>4. Platform Bakiyesi</h2>
        <p>4.1. Kullanılmamış, promosyon dışı ve gerçek ödeme ile yüklenmiş bakiyeler için 10 gün içinde yapılan iade talepleri değerlendirilebilir.</p>
        <p>4.2. Kullanılmış bakiyeler iade edilmez.</p>
        <p>4.3. Bonus/promosyon bakiyeler iade edilmez.</p>
        <p>4.4. Chargeback, dolandırıcılık, kötüye kullanım veya şüpheli işlem halinde iade reddedilebilir.</p>

        <h2>5. Teknik Sorunlar</h2>
        <p>Şirket kaynaklı ve hizmetin hiç sunulamaması sonucunu doğuran teknik sorunlarda; yeniden tanımlama, ücretsiz süre uzatımı, kısmi iade veya tam iade seçeneklerinden uygun olanı uygulanabilir.</p>

        <h2>6. Başvuru</h2>
        <p>İade/iptal talepleri info@codealchemist.com.tr üzerinden sipariş numarası ile iletilmelidir.</p>
      </div>
    </div>
  );
};

export default RefundPolicy;
