import React from 'react';
import './LegalPages.css';

const CookiePolicy = () => {
  return (
    <div className="legal-page-container">
      <div className="legal-page-content">
        <h1>ÇEREZ POLİTİKASI</h1>
        <p>Platform'da kullanıcı deneyimini geliştirmek, oturum yönetimi sağlamak, güvenliği artırmak ve analiz yapmak amacıyla çerezler kullanılabilir.</p>

        <h2>Kullanılan Çerez Türleri</h2>
        <ul>
          <li><strong>Zorunlu Çerezler:</strong> Sitenin çalışması için gereklidir.</li>
          <li><strong>İşlevsellik Çerezleri:</strong> Tercihlerinizi hatırlamaya yardımcı olur.</li>
          <li><strong>Analitik Çerezler:</strong> Trafik ve kullanım analizi sağlar.</li>
          <li><strong>Pazarlama Çerezleri:</strong> Yalnızca varsa ve gerekli onay alınmışsa kullanılır.</li>
        </ul>

        <p>Zorunlu olmayan çerezler için tercih/onay mekanizması sunulur. Kullanıcı, tarayıcı ayarlarından çerezleri yönetebilir.</p>
      </div>
    </div>
  );
};

export default CookiePolicy;
