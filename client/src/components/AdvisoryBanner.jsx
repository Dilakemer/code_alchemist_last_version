import React from 'react';

export default function AdvisoryBanner({ type, message, onNewChat, onDismiss }) {
  const isBloat = type === 'CONTEXT_BLOAT';
  
  return (
    <div className={`mx-4 mb-4 overflow-hidden rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in-50 
        ${isBloat ? 'bg-amber-500/10 border-amber-500/30' : 'bg-cyan-500/10 border-cyan-500/30'}`}>
      
      <div className="flex flex-col gap-3">
        {/* Header & Icon */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xl ${isBloat ? 'text-amber-400' : 'text-cyan-400'}`}>
              {isBloat ? '🟡' : '🔵'}
            </span>
            <h3 className={`font-semibold tracking-wide text-sm ${isBloat ? 'text-amber-300' : 'text-cyan-300'}`}>
              {isBloat ? 'Bağlam Genişliyor' : 'Konu Değişikliği'}
            </h3>
          </div>
          <button 
            onClick={onDismiss}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-300 leading-relaxed pr-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1">
          <button 
            onClick={onNewChat}
            className={`px-4 py-1.5 text-sm font-medium rounded-md shadow-sm transition-colors border
              ${isBloat 
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30 hover:border-amber-500/60' 
                : 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 hover:bg-cyan-500/30 hover:border-cyan-500/60'}`}
          >
            Yeni Sohbet Başlat
          </button>
          <button 
            onClick={onDismiss}
            className="px-4 py-1.5 text-sm font-medium rounded-md text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            Yine de Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}
