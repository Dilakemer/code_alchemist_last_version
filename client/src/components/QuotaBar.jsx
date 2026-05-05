import React, { useState, useEffect } from 'react';

const QuotaBar = ({ apiBase, authHeaders, user }) => {
  const [quotaData, setQuotaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !authHeaders.Authorization) return;

    const fetchQuota = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/quota/status`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          setQuotaData(data);
        } else {
          setError('Could not load quota');
        }
      } catch (err) {
        setError('Network error');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuota();
    // 30 saniyede bir refresh et
    const interval = setInterval(fetchQuota, 30000);
    return () => clearInterval(interval);
  }, [user, authHeaders, apiBase]);

  if (!quotaData || !user) return null;

  const weekly = quotaData.weekly || {};
  const resetDate = weekly.reset_at ? new Date(weekly.reset_at) : null;
  const resetStr = resetDate 
    ? resetDate.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const usedPct = weekly.used_pct || 0;
  let barColor = 'bg-green-500';
  if (usedPct > 75) barColor = 'bg-red-500';
  else if (usedPct > 50) barColor = 'bg-yellow-500';

  return (
    <div className="px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
      <div className="flex items-center justify-between gap-4 max-w-full">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Weekly Rate Limit
            </span>
            <span className="text-xs font-bold text-slate-400">
              {usedPct}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-300`}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1 text-[11px]">
            <span className="text-slate-400">
              Used: {weekly.used || 0} / {weekly.limit || 1000}
            </span>
            <span className="text-slate-500">
              Resets {resetStr}
            </span>
          </div>
        </div>

        {/* Learn More Link */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            // Modal açılabilir
          }}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap flex-shrink-0"
        >
          Learn More
        </a>
      </div>
    </div>
  );
};

export default QuotaBar;
