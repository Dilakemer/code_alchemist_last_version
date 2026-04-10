import React from 'react';

const TokenWallet = ({ balance = 0, grant = 100, onClick }) => {
  const safeBalance = Number.isFinite(Number(balance)) ? Number(balance) : 0;
  const safeGrant = Number.isFinite(Number(grant)) && Number(grant) > 0 ? Number(grant) : 100;
  const isLow = safeBalance <= Math.max(5, Math.ceil(safeGrant * 0.2));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl border px-4 py-2 text-left transition-all duration-300 ${
        isLow
          ? 'border-red-500/40 bg-red-950/20 text-red-100 hover:bg-red-950/40 hover:border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
          : 'border-white/10 bg-slate-900/40 backdrop-blur-md text-slate-100 hover:bg-slate-800/60 hover:border-indigo-500/50 shadow-[0_0_20px_rgba(0,0,0,0.2)]'
      }`}
      title="Token Command Center"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-transform group-hover:scale-110 ${
        isLow ? 'bg-red-500/20 text-red-300' : 'bg-indigo-500/20 text-indigo-300'
      }`}>
        {isLow ? '⚠️' : '💎'}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-[0.25em] text-slate-500 font-bold group-hover:text-slate-400 transition-colors">Credits</span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black tracking-tight">
            {safeBalance.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500 font-bold">/ {safeGrant}</span>
        </div>
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
