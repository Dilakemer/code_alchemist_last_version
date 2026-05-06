import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-[#0a0a0b] py-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-purple-600 mb-4">Code Alchemist</h3>
            <p className="text-sm text-gray-400">
              Yapay zeka destekli gelişmiş yazılım geliştirme platformu. Kodunuzu daha akıllı, daha hızlı ve daha güvenli bir şekilde oluşturun.
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Yasal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/kullanim-kosullari" className="text-gray-400 hover:text-fuchsia-400 transition-colors">Üyelik ve Kullanım Koşulları</a></li>
              <li><a href="/platform-bakiyesi-kosullari" className="text-gray-400 hover:text-fuchsia-400 transition-colors">Platform Bakiyesi Koşulları</a></li>
              <li><a href="/kvkk-aydinlatma-metni" className="text-gray-400 hover:text-fuchsia-400 transition-colors">KVKK Aydınlatma Metni</a></li>
              <li><a href="/gizlilik-politikasi" className="text-gray-400 hover:text-fuchsia-400 transition-colors">Gizlilik Politikası</a></li>
            </ul>
          </div>

          {/* Sales & Policies */}
          <div>
            <h4 className="text-white font-semibold mb-4">Satış & İade</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/on-bilgilendirme-formu" className="text-gray-400 hover:text-fuchsia-400 transition-colors">Ön Bilgilendirme Formu</a></li>
              <li><a href="/mesafeli-satis-sozlesmesi" className="text-gray-400 hover:text-fuchsia-400 transition-colors">Mesafeli Satış Sözleşmesi</a></li>
              <li><a href="/iade-ve-iptal-politikasi" className="text-gray-400 hover:text-fuchsia-400 transition-colors">İade ve İptal Politikası</a></li>
              <li><a href="/cerez-politikasi" className="text-gray-400 hover:text-fuchsia-400 transition-colors">Çerez Politikası</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">İletişim</h4>
            <ul className="space-y-2 text-sm">
              <li className="text-gray-400">CodeAlchemist</li>
              <li className="text-gray-400">İzmir</li>
              <li><a href="mailto:info@codealchemist.com.tr" className="text-gray-400 hover:text-fuchsia-400 transition-colors">info@codealchemist.com.tr</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Code Alchemist. Tüm hakları saklıdır.
          </p>
          <div className="flex gap-4">
            <span className="text-sm text-gray-500">Altyapı: Iyzico Güvenli Ödeme</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
