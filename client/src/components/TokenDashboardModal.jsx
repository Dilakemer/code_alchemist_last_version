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

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;

    const loadUsage = async () => {
      setLoading(true);
      setError('');
      try {
        const [usageResp, packagesResp, billingResp] = await Promise.all([
          fetch(`${apiBase}/api/tokens/usage?limit=8`, {
            headers: authHeaders,
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
  }, [isOpen, user, apiBase, authHeaders]);

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
          ...authHeaders,
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
      className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-slate-950/70 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="my-auto w-full max-w-[min(1120px,calc(100vw-1.25rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto">
        <div className="grid gap-0 xl:grid-cols-[1.3fr_0.85fr]">
          <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 opacity-60">
              <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
              <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
            </div>
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Token Command Center</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Your usage, spend, and runway.</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  Track token consumption in real time, keep an eye on spend, and upgrade before workflows stall.
                </p>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                aria-label="Close token dashboard"
              >
                ✕
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Current Balance</p>
                <div className={`mt-2 text-3xl font-semibold ${lowWarning ? 'text-red-300' : isLow ? 'text-amber-200' : 'text-white'}`}>
                  {balance}
                </div>
                <p className="mt-1 text-xs text-slate-400">Approved signup grant: {user?.tokens ?? 100}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Total Spent</p>
                <div className="mt-2 text-3xl font-semibold text-white">{totalSpent}</div>
                <p className="mt-1 text-xs text-slate-400">Since wallet creation</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Activity</p>
                <div className="mt-2 text-3xl font-semibold text-white">{transactionCount}</div>
                <p className="mt-1 text-xs text-slate-400">Recent token events</p>
              </div>
            </div>

            <div className={`mt-6 rounded-2xl border p-4 ${lowWarning ? 'border-red-500/30 bg-red-500/10' : isLow ? 'border-amber-500/30 bg-amber-500/10' : 'border-cyan-500/20 bg-cyan-500/10'}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-300">Runway</p>
                  <p className="mt-1 text-sm text-slate-100">
                    {lowWarning
                      ? 'Low balance. Upgrade before the next model call is blocked.'
                      : isLow
                        ? 'Balance is dropping. Consider a top-up or a higher tier.'
                        : 'Runway looks healthy for ongoing work.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (featuredPackage) {
                        handleCheckout(featuredPackage);
                        return;
                      }
                      onOpenPricing?.();
                    }}
                    className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Buy Tokens
                  </button>
                  <button
                    onClick={onOpenPricing}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    View Pricing
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id ?? pkg.name}
                  className={`rounded-2xl border p-4 ${pkg.highlight ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{pkg.name}</p>
                    {pkg.highlight && (
                      <span className="rounded-full bg-indigo-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                        Best Value
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-white">{pkg.tokens}</p>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">tokens</p>
                  <p className="mt-3 text-sm text-slate-300">
                    ${Number.isFinite(Number(pkg.price_usd)) ? Number(pkg.price_usd).toFixed(2) : pkg.price}
                  </p>
                  {pkg.description && <p className="mt-2 text-xs leading-5 text-slate-400">{pkg.description}</p>}
                  <button
                    onClick={() => handleCheckout(pkg)}
                    disabled={!billingEnabled || checkoutLoadingId === (pkg.id ?? pkg.name)}
                    className="mt-4 w-full rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {!billingEnabled
                      ? 'Not available'
                      : checkoutLoadingId === (pkg.id ?? pkg.name)
                        ? 'Starting checkout...'
                        : 'Buy tokens'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col bg-slate-950/95 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recent Activity</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Usage ledger</h3>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                Live wallet
              </div>
            </div>

            <div className="mt-5 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {loading ? (
                <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-400">
                  Loading token activity...
                </div>
              ) : error ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    Retry
                  </button>
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm text-slate-300">No token activity yet.</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Your first AI request will appear here and reduce the wallet balance in real time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {recentTransactions.map((tx) => {
                    const positive = Number(tx.amount) > 0;
                    return (
                      <div key={tx.id} className="flex items-center gap-4 px-4 py-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${positive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                          {positive ? '+' : '−'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {tx.description || tx.type}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                        </div>
                        <div className={`text-sm font-semibold ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {positive ? '+' : ''}{tx.amount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-cyan-500/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">SaaS position</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Tokens are your usage currency. Plans, packages, and billing stay separate so you can price work cleanly.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (featuredPackage) {
                      handleCheckout(featuredPackage);
                      return;
                    }
                    onOpenPricing?.();
                  }}
                  className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
                  disabled={!billingEnabled}
                >
                  Buy featured pack
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Keep working
                </button>
              </div>
              {!billingEnabled && (
                <p className="mt-3 text-xs text-amber-200">
                  Stripe is not configured yet. Add STRIPE_SECRET_KEY on the server to enable purchases.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenDashboardModal;
