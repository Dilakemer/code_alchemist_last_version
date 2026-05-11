import React from 'react';

const TokenWallet = ({ balance = 0, grant = 100, isUnlimited = false, onClick }) => {
  const safeBalance = Number.isFinite(Number(balance)) ? Number(balance) : 0;
  const safeGrant = Number.isFinite(Number(grant)) && Number(grant) > 0 ? Number(grant) : 100;
  const displayBalance = isUnlimited ? '∞' : safeBalance.toLocaleString();
  const displayGrant = isUnlimited ? 'Sınırsız' : `/${safeGrant}`;
  const isLow = !isUnlimited && safeBalance <= Math.max(5, Math.ceil(safeGrant * 0.2));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 store-card-rounded border px-4 py-2 text-left transition-all duration-300 ${
        isLow
          ? 'border-red-500/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-950/40 shadow-sm'
          : 'border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800/60 shadow-sm'
      }`}
      title="Token Command Center"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-transform group-hover:scale-110 ${
        isUnlimited ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300' : isLow ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
      }`}>
        {isUnlimited ? '♾️' : isLow ? '⚠️' : '💎'}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-[0.25em] text-gray-500 dark:text-slate-500 font-bold group-hover:text-indigo-600 dark:group-hover:text-slate-400 transition-colors">Credits</span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black tracking-tight text-gray-900 dark:text-white">
            {displayBalance}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-slate-500 font-bold">{displayGrant}</span>
        </div>
        {isUnlimited && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-500 dark:text-emerald-300">
            Sınırsız
          </span>
        )}
      </div>
      {isLow && (
        <div className="ml-1 relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </div>
      )}
    </button>
  );
};

export default TokenWallet;
