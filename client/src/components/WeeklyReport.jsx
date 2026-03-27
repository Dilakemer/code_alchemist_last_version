import React from 'react';

const WeeklyReport = ({ data, onClose }) => {
  if (!data) return null;

  const { current_week, previous_week_total, user_stats } = data;
  const growth = previous_week_total === 0
    ? (current_week.total_questions > 0 ? 100 : 0)
    : Number((((current_week.total_questions - previous_week_total) / previous_week_total) * 100).toFixed(1));

  const dailyBars = Array.isArray(current_week.daily_points)
    ? current_week.daily_points.map((point) => ({
        key: point.date,
        label: point.label || point.date,
        count: Number(point.count) || 0
      }))
    : Object.entries(current_week.daily_distribution || {}).map(([day, count]) => ({
        key: day,
        label: day,
        count: Number(count) || 0
      }));

  const maxDayCount = Math.max(...dailyBars.map((item) => item.count), 1);
  const hasActivity = dailyBars.some((item) => item.count > 0);

  return (
    <div className="flex flex-col gap-6 text-gray-100">
      <div className="flex justify-between items-start border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Weekly Alchemist Report
          </h2>
          <p className="text-sm text-gray-400">Son 7 günlük aktivite özetiniz</p>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 -mr-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
          title="Kapat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Ana İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-bold mb-1">Toplam Soru</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold">{current_week.total_questions}</span>
            <span className={`text-xs mb-1 ${growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%
            </span>
          </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-bold mb-1">Kazanılan XP</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-amber-400">+{current_week.xp_earned}</span>
            <span className="text-xs mb-1 text-gray-500">Bu Hafta</span>
          </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-bold mb-1">Mevcut Seviye</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-purple-400">{user_stats.level}</span>
            <span className="text-xs mb-1 text-gray-500">Sıralama: {user_stats.xp} XP</span>
          </div>
        </div>
      </div>

      {/* Günlük Aktivite Grafiği */}
      <div className="bg-gray-800/30 p-6 rounded-xl border border-gray-700/50">
        <div className="mb-6">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <i className="fas fa-chart-bar text-amber-400"></i> Günlük Aktivite
          </h3>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
          {hasActivity ? (
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-3 px-1">
                <span>Min: 0</span>
                <span>Max: {maxDayCount}</span>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${dailyBars.length || 1}, minmax(0, 1fr))` }}>
                {dailyBars.map((day) => {
                  const count = day.count;
                  const height = count > 0 ? Math.max((count / maxDayCount) * 100, 8) : 0;
                  return (
                    <div key={day.key} className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-semibold text-amber-300 h-4">{count > 0 ? count : ''}</span>
                      <div className="w-full max-w-[40px] h-32 bg-slate-800/80 border border-slate-700/80 rounded-md mx-auto flex items-end overflow-hidden">
                        <div
                          className="w-full bg-gradient-to-t from-amber-600 via-amber-500 to-amber-300 transition-all duration-500"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400 uppercase tracking-wide">{day.label.substring(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-44 rounded-lg border border-slate-700/60 bg-slate-900/40 flex flex-col items-center justify-center text-center px-4">
              <p className="text-sm text-gray-300 font-semibold">Bu hafta günlük aktivite kaydı yok</p>
              <p className="text-xs text-gray-500 mt-1">Soru sorup model kullandıkça grafik otomatik dolacak.</p>
            </div>
          )}
        </div>
      </div>

      {/* Model Dağılımı */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Model Tercihleriniz</h3>
        <div className="overflow-x-auto pb-2">
          <div className="flex flex-nowrap gap-3 min-w-min">
            {Object.entries(current_week.model_usage).map(([model, count]) => (
              <div key={model} className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700 whitespace-nowrap flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-medium">{model}</span>
                <span className="text-xs text-gray-500 font-bold">{count}</span>
              </div>
            ))}
            {Object.keys(current_week.model_usage).length === 0 && (
               <p className="text-xs text-gray-500 italic">Henüz yeterli veri yok.</p>
            )}
          </div>
        </div>
      </div>

      <div className="text-center pt-4 opacity-50 text-[10px]">
        CodeAlchemist Analytics - Verileriniz her 24 saatte bir güncellenir.
      </div>
    </div>
  );
};

export default WeeklyReport;
