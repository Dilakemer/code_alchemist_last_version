import React from 'react';

const TokenWallet = ({ balance = 0, grant = 100, onClick }) => {
  const safeBalance = Number.isFinite(Number(balance)) ? Number(balance) : 0;
  const safeGrant = Number.isFinite(Number(grant)) && Number(grant) > 0 ? Number(grant) : 100;
  const isLow = safeBalance <= Math.max(5, Math.ceil(safeGrant * 0.2));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200 ${
        isLow
          ? 'border-red-500/30 bg-red-950/30 text-red-200 hover:bg-red-950/45'
          : 'border-indigo-500/25 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80'
      }`}
      title="Token cüzdanı ve kullanım detayları"
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${isLow ? 'bg-red-500/15 text-red-300' : 'bg-indigo-500/15 text-indigo-300'}`}>
        🪙
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Token Wallet</span>
        <span className="text-sm font-semibold">
          {safeBalance} / {safeGrant} Token
        </span>
      </span>
      {isLow && (
        <span className="ml-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">
          Low
        </span>
      )}
    </button>
  );
};

export default TokenWallet;
