import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_PACKAGES = [
  { id: 'starter', name: 'Starter', description: 'Solo kullanım ve hafif deneme akışları için.', tokens: 500, price_usd: 5, bonus_pct: 0, highlight: false },
  { id: 'pro-pack', name: 'Pro Pack', description: 'Sürekli üretim akışı olan bireyler ve küçük ekipler için.', tokens: 2000, price_usd: 15, bonus_pct: 5, highlight: true },
  { id: 'heavy-user-bundle', name: 'Heavy User Bundle', description: 'Yoğun kullanım ve ekip içi denemeler için.', tokens: 8000, price_usd: 49, bonus_pct: 10, highlight: false },
  { id: 'studio-upgrade', name: 'Studio Upgrade', description: 'Kurumsal ekipler ve yüksek hacimli kullanım için.', tokens: 20000, price_usd: 99, bonus_pct: 15, highlight: false },
];

const formatDate = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TokenDashboardModal = ({
  isOpen,
  onClose,
  apiBase,
  authHeaders,
  user,
  onOpenPricing,
}) => {
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState(null);
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState(null);
  const [billingEnabled, setBillingEnabled] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'upgrade', 'history'

  const effectiveHeaders = useMemo(() => {
    if (authHeaders && Object.keys(authHeaders).length > 0) return authHeaders;
    const localToken = localStorage.getItem('codebrain_token');
    return localToken ? { 'Authorization': `Bearer ${localToken}` } : {};
  }, [authHeaders]);

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;

    const loadUsage = async () => {
      setLoading(true);
      setError('');
      try {
        if (!effectiveHeaders.Authorization) {
          throw new Error('Session is missing authorization. Please login again.');
        }

        const [usageResp, packagesResp, billingResp] = await Promise.all([
          fetch(`${apiBase}/api/tokens/usage?limit=15`, {
            headers: effectiveHeaders,
          }),
          fetch(`${apiBase}/api/billing/packages`),
          fetch(`${apiBase}/api/billing/config`),
        ]);

        const usageData = await usageResp.json().catch(() => ({}));
        const packageData = await packagesResp.json().catch(() => ({}));
        const billingData = await billingResp.json().catch(() => ({}));

        if (!usageResp.ok) {
          throw new Error(usageData?.error || `Status ${usageResp.status}`);
        }
        if (!packagesResp.ok) {
          throw new Error(packageData?.error || `Status ${packagesResp.status}`);
        }
        if (!billingResp.ok) {
          throw new Error(billingData?.error || `Status ${billingResp.status}`);
        }

        if (!cancelled) {
          setUsage(usageData);
          setBillingEnabled(Boolean(billingData?.enabled));
          setPackages(Array.isArray(packageData?.packages) && packageData.packages.length > 0
            ? packageData.packages
            : DEFAULT_PACKAGES);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Usage data could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadUsage();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user, apiBase, effectiveHeaders]);

  const handleCheckout = async (packageItem) => {
    if (!packageItem?.id) return;
    if (!billingEnabled) {
      setError('Payments are currently unavailable. Please contact the workspace admin to configure Stripe.');
      return;
    }
    setCheckoutLoadingId(packageItem.id);
    setError('');
    try {
      const resp = await fetch(`${apiBase}/api/billing/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...effectiveHeaders,
        },
        body: JSON.stringify({ package_id: packageItem.id }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || `Status ${resp.status}`);
      }

      const checkoutUrl = data?.checkout_url;
      if (!checkoutUrl) {
        throw new Error('Checkout URL was not returned by the server.');
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err.message || 'Checkout could not be started.');
      setCheckoutLoadingId(null);
    }
  };

  const balance = Number.isFinite(Number(usage?.balance))
    ? Number(usage.balance)
    : Number(user?.tokens || 0);
  const totalSpent = Number.isFinite(Number(usage?.total_spent)) ? Number(usage.total_spent) : 0;
  const transactionCount = Array.isArray(usage?.transactions) ? usage.transactions.length : 0;
  const isLow = balance <= 20;
  const lowWarning = balance <= 10;
  const featuredPackage = packages.find((pkg) => pkg.highlight) || packages[1] || packages[0];
  const recentTransactions = useMemo(() => usage?.transactions || [], [usage]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl transition-all duration-300 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#080b14] shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col mx-4 animate-in zoom-in-95 duration-300">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between p-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
              💎
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Token Command Center</h2>
              <p className="text-sm text-slate-400">Manage your credits, usage, and billing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-8 py-4 gap-8 border-b border-white/5 bg-white/[0.02]">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'upgrade', label: 'Top-up Packs', icon: '⚡' },
            { id: 'history', label: 'Usage History', icon: '📜' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-4 pt-2 text-sm font-medium transition-all relative ${
                activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500 animate-in slide-in-from-left duration-300" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-300 text-sm">
                <span>⚠️</span>
                {error}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-xs font-bold text-red-300 hover:underline px-3 py-1"
              >
                Retry
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Available Balance</p>
                  <div className={`text-4xl font-bold tracking-tighter ${lowWarning ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {balance.toLocaleString()}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live synchronization active
                  </div>
                </div>
                <div className="p-6 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden group">
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Lifecycle Spend</p>
                  <div className="text-4xl font-bold tracking-tighter text-white">
                    {totalSpent.toLocaleString()}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Consumed tokens since start</p>
                </div>
                <div className="p-6 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden group">
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">Requests Made</p>
                  <div className="text-4xl font-bold tracking-tighter text-white">
                    {transactionCount}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">AI model interaction events</p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-indigo-900/20 to-fuchsia-900/10 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Workspace Runway</h3>
                  <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                    {lowWarning
                      ? "Critical: Your balance is extremely low. Upcoming AI requests may be blocked until you top up."
                      : isLow
                        ? "Warning: Your token balance is dipping. Consider upgrading soon to maintain momentum."
                        : "Healthy: You have enough credits for continued collaboration and high-volume sessions."}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('upgrade')}
                    className="px-6 py-3 rounded-2xl bg-white text-slate-950 text-sm font-bold transition-all hover:bg-slate-200 active:scale-95 shadow-lg shadow-white/5"
                  >
                    Get More Tokens
                  </button>
                  <button
                    onClick={onOpenPricing}
                    className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold transition-all hover:bg-white/10 active:scale-95"
                  >
                    View Enterprise Pricing
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 rounded-[2rem] border border-white/10 bg-white/5">
                  <h4 className="text-lg font-bold text-white mb-6">Subscription Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Current Plan</span>
                      <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">Standard Free</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Monthly Allowance</span>
                      <span className="text-white">100 Tokens (Base)</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Next Reset</span>
                      <span className="text-white">Auto-renews dynamically</span>
                    </div>
                  </div>
                </div>
                <div className="p-8 rounded-[2rem] border border-white/10 bg-white/5">
                  <h4 className="text-lg font-bold text-white mb-6">Recent Activity Peek</h4>
                  <div className="space-y-4">
                    {recentTransactions.slice(0, 3).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {tx.amount > 0 ? '+' : '−'}
                          </div>
                          <span className="text-sm text-slate-300 font-medium truncate max-w-[120px]">{tx.description || tx.type}</span>
                        </div>
                        <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-slate-500 group-hover:text-rose-400 transition-colors'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                      </div>
                    ))}
                    {recentTransactions.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No recent transactions to display.</p>
                    )}
                    <button
                      onClick={() => setActiveTab('history')}
                      className="w-full mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      View all history →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'upgrade' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-10">
                <h3 className="text-3xl font-bold text-white mb-2">Scale your reach</h3>
                <p className="text-slate-400">Instant top-ups that never expire. Pay for what you need.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id ?? pkg.name}
                    className={`relative p-8 rounded-[2.5rem] border transition-all duration-300 flex flex-col group ${
                      pkg.highlight
                        ? 'border-indigo-500 bg-indigo-500/[0.03] shadow-[0_0_40px_rgba(79,70,229,0.1)] scale-[1.03] z-10'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
                    }`}
                  >
                    {pkg.highlight && (
                      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-[10px] font-black uppercase tracking-widest text-white shadow-xl">
                        Power User Choice
                      </div>
                    )}
                    
                    <h4 className="text-lg font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{pkg.name}</h4>
                    <p className="text-xs text-slate-500 mb-6 font-medium">{pkg.description}</p>
                    
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-white">{pkg.tokens.toLocaleString()}</span>
                        <span className="text-xs font-bold text-slate-500 uppercase">Tokens</span>
                      </div>
                      <div className="mt-2 text-2xl font-bold text-slate-400">
                        ${Number.isFinite(Number(pkg.price_usd)) ? Number(pkg.price_usd).toFixed(0) : pkg.price}
                      </div>
                    </div>

                    <div className="space-y-3 mb-8 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="text-emerald-400">✓</span> No expiration date
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="text-emerald-400">✓</span> Priority model access
                      </div>
                      {pkg.bonus_pct > 0 && (
                        <div className="flex items-center gap-2 text-xs text-fuchsia-400 font-bold">
                          💡 {pkg.bonus_pct}% Bonus included
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleCheckout(pkg)}
                      disabled={!billingEnabled || checkoutLoadingId === (pkg.id ?? pkg.name)}
                      className={`w-full py-4 rounded-3xl text-sm font-black transition-all border ${
                        pkg.highlight
                          ? 'bg-white text-slate-950 border-white hover:bg-slate-100'
                          : 'bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-white/20'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {checkoutLoadingId === (pkg.id ?? pkg.name) ? 'Initializing...' : 'Checkout Package'}
                    </button>
                  </div>
                ))}
              </div>
              
              {!billingEnabled && (
                <div className="mt-12 p-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 text-center">
                  <p className="text-sm text-amber-200 font-medium">
                    🛒 Stripe is not connected in this environment. Direct purchases are disabled.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Transaction Ledger</h3>
                  <p className="text-sm text-slate-400">Detailed record of all credit movements</p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400 font-bold">
                  Last updated: Just now
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">Syncing with blockchain wallet...</p>
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="h-16 w-16 rounded-3xl bg-slate-800/50 flex items-center justify-center text-3xl">🕳️</div>
                  <div>
                    <p className="text-lg font-bold text-slate-300">Wait, it's empty!</p>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">Collaborate on code or ask the AI to see your usage activity appear here in real-time.</p>
                  </div>
                  <button onClick={() => setActiveTab('upgrade')} className="text-sm font-bold text-indigo-400 hover:underline">Start with a pack</button>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Event</th>
                        <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Date & Time</th>
                        <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-right">Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentTransactions.map((tx) => {
                        const positive = Number(tx.amount) > 0;
                        return (
                          <tr key={tx.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-6">
                              <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center text-lg ${positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                                  {positive ? '🏦' : '🤖'}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white group-hover:text-fuchsia-400 transition-colors uppercase tracking-tight">
                                    {tx.description || tx.type}
                                  </p>
                                  <p className="text-[10px] text-slate-500 tracking-widest font-bold">ID: {tx.id.toString().substring(0, 8)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-sm text-slate-400 font-medium">
                              {formatDate(tx.created_at)}
                            </td>
                            <td className={`px-6 py-6 text-right font-black text-lg ${positive ? 'text-emerald-400' : 'text-slate-200'}`}>
                              {positive ? '+' : ''}{tx.amount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Secured by Stripe & Alchemy Shield</span>
            <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
            <span className="text-xs text-slate-500 font-medium cursor-help hover:text-slate-300">Terms apply</span>
          </div>
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">Crafted for engineers by CodeAlchemist</p>
        </div>
      </div>
    </div>
  );
};

export default TokenDashboardModal;
