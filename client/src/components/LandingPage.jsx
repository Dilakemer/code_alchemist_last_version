import React, { useState } from 'react';

const ComparisonTable = () => (
  <div className="mt-24 max-w-5xl mx-auto overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
    <div className="p-8 border-b border-white/10 text-center">
      <h2 className="text-3xl font-black text-white mb-2">Neden CodeAlchemist?</h2>
      <p className="text-gray-400 text-sm">Geliştirici araçlarında yeni standart.</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/[0.03]">
            <th className="p-6 text-xs font-bold text-gray-500 uppercase tracking-widest">Özellik</th>
            <th className="p-6 text-xs font-bold text-gray-500 uppercase tracking-widest">GitHub Copilot</th>
            <th className="p-6 text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/5">CodeAlchemist</th>
          </tr>
        </thead>
        <tbody className="text-sm text-gray-300">
          <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="p-6 font-medium">Model Seçimi</td>
            <td className="p-6">Tek Model (GPT-4o)</td>
            <td className="p-6 bg-indigo-500/5 font-bold text-white">Hibrit (5+ Model)</td>
          </tr>
          <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="p-6 font-medium">Karşılaştırma (Compare)</td>
            <td className="p-6 text-gray-500 text-xs">Desteklenmiyor</td>
            <td className="p-6 bg-indigo-500/5 font-bold text-white">Gerçek Zamanlı Karşılaştırma</td>
          </tr>
          <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="p-6 font-medium">Fiyatlandırma</td>
            <td className="p-6">$10/ay (Sabit)</td>
            <td className="p-6 bg-indigo-500/5 font-bold text-white">Token Bazlı (Kullandığın Kadar)</td>
          </tr>
          <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="p-6 font-medium">Yerel Ödeme (TRY)</td>
            <td className="p-6 text-gray-500 text-xs">Desteklenmiyor</td>
            <td className="p-6 bg-indigo-500/5 font-bold text-white">iyzico / TL Desteği</td>
          </tr>
          <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="p-6 font-medium">Otomasyon</td>
            <td className="p-6 text-gray-500 text-xs">Yok</td>
            <td className="p-6 bg-indigo-500/5 font-bold text-white">n8n Entegrasyonu</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

const DemoModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto custom-scrollbar group/modal">
    <div className="relative w-full max-w-4xl bg-[#0F172A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl my-auto">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
      >
        ✕
      </button>
      <div className="p-6 md:p-10 text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-[var(--accent-gradient)] rounded-2xl flex items-center justify-center text-3xl md:text-4xl mx-auto mb-6 shadow-lg shadow-indigo-600/30">
          ⚗️
        </div>
        <h3 className="text-xl md:text-2xl font-black text-white mb-2">CodeAlchemist'i Aksiyonda Görün</h3>
        <p className="text-gray-400 text-xs md:text-sm mb-6 md:mb-8 max-w-lg mx-auto">
          Çoklu model analizi, gerçek zamanlı karşılaştırma ve akıllı kod yamalarını keşfedin.
        </p>
        <div className="aspect-video bg-[#020617] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-4 mb-6">
          <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">Video Yakında</p>
          <p className="text-gray-600 text-xs">Uygulamayı hemen ücretsiz deneyebilirsiniz!</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20"
          >
            Hemen Dene →
          </button>
        </div>
      </div>
    </div>
  </div>
);

const LandingPage = ({ onGetStarted, onLogin }) => {
  const [showDemo, setShowDemo] = useState(false);

  const features = [
    {
      title: "Zekayı Serbest Bırakın",
      desc: "GPT-4o, Claude 3.5 ve Gemini'yi aynı anda sorgulayın. Modeller arasındaki farkı değil, en iyi sonucu görün.",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 8L12 12L20 8L12 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 12L12 16L20 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
          <path d="M4 16L12 20L20 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
        </svg>
      )
    },
    {
      title: "Şeffaf Token Ekonomisi",
      desc: "Sabit abonelik tuzaklarından kurtulun. Sadece harcadığınız işlem gücü kadar, adil ve şeffaf ödeyin.",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
        </svg>
      )
    },
    {
      title: "Evrensel Entegrasyon",
      desc: "n8n, GitHub ve Webhook desteği ile AI yanıtlarını iş akışınızın doğal bir parçası haline getirin.",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      )
    }
  ];

  return (
    <>
      {showDemo && <DemoModal onClose={() => { setShowDemo(false); }} />}

      <div className="min-h-screen bg-[#0F172A] text-white overflow-x-hidden selection:bg-indigo-500/30">
        {/* Background Blobs & Glows */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.25),transparent_60%)]" />
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Navigation */}
        <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-[var(--accent-gradient)]">
              CodeAlchemist
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-xl"
            >
              Giriş Yap
            </button>
            <button
              onClick={onGetStarted}
              className="px-5 py-2.5 bg-white text-black rounded-full text-sm font-bold hover:bg-gray-100 transition-all shadow-xl"
            >
              Ücretsiz Başla
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 pt-16 pb-24 px-6 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-slow-pulse" />
            Token-based AI coding is here
          </div>

          <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-6 leading-[0.85]">
            <span className="block text-white">5 Model aynı anda çalışsın.</span>
            <span className="bg-clip-text text-transparent bg-[var(--accent-gradient)]">
              En iyi cevabı sen seç.
            </span>
          </h1>

          <p className="text-base md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            GPT-4o, Claude ve Gemini'yi tek soruda karşılaştır.Tek modele bağlı kalma. En iyi cevabı seç. Token bazlı fiyatlandırma ile sadece kullandığın kadar öde. Kuruş israf etme.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-10 py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-2xl text-lg font-black transition-all shadow-2xl shadow-indigo-600/30 transform hover:-translate-y-1 active:scale-95"
            >
              Start Free — 100 tokens 🧪
            </button>
            <button
              onClick={() => setShowDemo(true)}
              className="w-full sm:w-auto px-10 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-lg font-bold hover:bg-white/10 transition-all"
            >
              Demo İzle
            </button>
          </div>

          <ComparisonTable />
        </section>

        {/* Features Section - Enhanced Depth & Emotion */}
        <section className="relative z-10 py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">
              Geliştiriciler için <span className="text-indigo-400">Gerçek Özgürlük</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
              Sadece kod yazmanızı değil, en doğru kararı vermenizi sağlıyoruz.
              Sınırları ortadan kaldırın, verimliliği sanat haline getirin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="group relative p-10 rounded-[2.5rem] bg-white/[0.01] border border-white/5 hover:border-indigo-500/20 transition-all duration-500 hover:-translate-y-2 overflow-hidden"
              >
                {/* Hover Glow Effect */}
                <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Icon Container with Glassmorphism */}
                <div className="relative w-16 h-16 mb-8 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center text-3xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-xl">
                  <div className="absolute inset-0 bg-indigo-500/5 blur-xl rounded-full group-hover:bg-indigo-500/20 transition-colors" />
                  <span className="relative drop-shadow-md">{f.icon}</span>
                </div>

                <h3 className="relative text-2xl font-black mb-4 text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                  {f.title}
                </h3>

                <p className="relative text-slate-400 text-sm leading-relaxed font-medium group-hover:text-slate-200 transition-colors">
                  {f.desc}
                </p>

                {/* Bottom Accent Line */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent group-hover:w-full transition-all duration-700" />
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 py-16 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-600 font-bold tracking-[0.3em] uppercase">
            © 2026 CodeAlchemist • Engineering the Future
          </p>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
