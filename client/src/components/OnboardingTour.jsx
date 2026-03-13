import React, { useState, useEffect } from 'react';

const TOUR_KEY = 'codealchemist_onboarding_done';

const STEPS = [
  {
    id: 'welcome',
    title: '⚗️ CodeAlchemist\'e Hoşgeldin!',
    description: 'Yapay zeka destekli kodlama asistanın. Kod yaz, hata ayıkla, öğren — hepsi burada.',
    icon: '✨',
    highlight: null,
    position: 'center',
  },
  {
    id: 'model',
    title: '🤖 AI Modeli Seç',
    description: 'Gemini, Claude veya GPT-4o arasından istediğin modeli seçebilir, ya da "Auto" bırakarak akıllı yönlendirmeden faydalanabilirsin.',
    icon: '🧠',
    highlight: '[data-tour="model-selector"]',
    position: 'bottom',
  },
  {
    id: 'ask',
    title: '💬 Soru Sor veya Kod Paylaş',
    description: 'Sorunuzu yazın, kod block\'u ekleyin ya da bir dosya yükleyin. Ses kaydıyla da soru sorabilirsiniz!',
    icon: '🎤',
    highlight: '[data-tour="chat-input"]',
    position: 'top',
  },
  {
    id: 'community',
    title: '🌐 Topluluk & Geçmiş',
    description: 'Sol menüden geçmiş konuşmalarınıza erişin, favori yanıtları arşivleyin ve toplulukla paylaşın.',
    icon: '👥',
    highlight: '[data-tour="sidebar-tabs"]',
    position: 'right',
  },
  {
    id: 'github',
    title: '🔗 GitHub Entegrasyonu',
    description: 'GitHub reposunu bağlayarak, AI\'ın kod tabanınızı anlayarak daha akıllı yanıtlar üretmesini sağlayın.',
    icon: '🐙',
    highlight: null,
    position: 'center',
  },
];

const OnboardingTour = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Kısa delay ile fade-in
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setVisible(false);
    setTimeout(() => onComplete?.(), 400);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-400 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
    >
      {/* Card */}
      <div
        className="relative bg-gray-900 border border-fuchsia-500/40 rounded-2xl shadow-2xl shadow-fuchsia-900/30 p-8 max-w-md w-full mx-4 animate-scaleIn"
        style={{ boxShadow: '0 0 60px rgba(217, 70, 239, 0.2)' }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 h-2.5 bg-fuchsia-500'
                  : i < step
                  ? 'w-2.5 h-2.5 bg-fuchsia-700/60'
                  : 'w-2.5 h-2.5 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-purple-700 flex items-center justify-center text-3xl shadow-lg shadow-fuchsia-900/40">
            {current.icon}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-white mb-3">{current.title}</h2>
          <p className="text-gray-300 text-sm leading-relaxed">{current.description}</p>
        </div>

        {/* Step count */}
        <p className="text-center text-xs text-gray-500 mb-5">
          {step + 1} / {STEPS.length}
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          {/* Skip */}
          <button
            onClick={handleComplete}
            className="flex-none text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-2 rounded-lg hover:bg-gray-800"
          >
            Atla
          </button>

          {/* Prev */}
          {!isFirst && (
            <button
              onClick={handlePrev}
              className="flex-none px-4 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm font-medium transition-all"
            >
              ← Geri
            </button>
          )}

          {/* Next / Finish */}
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-fuchsia-900/30 active:scale-95"
          >
            {isLast ? '🚀 Başlayalım!' : 'İleri →'}
          </button>
        </div>

        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>
    </div>
  );
};

// Dışarıdan kontrol için yardımcı
export const shouldShowOnboarding = () => !localStorage.getItem(TOUR_KEY);
export const resetOnboarding = () => localStorage.removeItem(TOUR_KEY);

export default OnboardingTour;
