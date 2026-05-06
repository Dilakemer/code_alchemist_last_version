import React, { useCallback, useEffect, useState } from 'react';

const AdminQuotaPanel = ({ isOpen, onClose, apiBase, authHeaders }) => {
  const [tab, setTab] = useState('users'); // 'users' | 'defaults' | 'stats'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected user for edit
  const [selectedUser, setSelectedUser] = useState(null);
  const [quotaForm, setQuotaForm] = useState({});
  const [grantAmount, setGrantAmount] = useState('');
  const [grantDesc, setGrantDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Global defaults
  const [defaults, setDefaults] = useState({ daily_limit: 200, weekly_limit: 1000 });
  const [defaultsForm, setDefaultsForm] = useState({ daily_limit: 200, weekly_limit: 1000 });

  const flash = (msg, isErr = false) => {
    if (isErr) setError(msg); else setSuccessMsg(msg);
    setTimeout(() => { setError(''); setSuccessMsg(''); }, 4000);
  };

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/api/admin/stats`, { headers: authHeaders });
      if (r.ok) setStats(await r.json());
    } catch { /* ignore */ }
  }, [apiBase, authHeaders]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${apiBase}/api/admin/users?page=${page}&per_page=20&search=${encodeURIComponent(search)}`,
        { headers: authHeaders }
      );
      const d = await r.json();
      setUsers(d.users || []);
      setTotalUsers(d.total || 0);
    } catch (e) { flash(e.message, true); }
    setLoading(false);
  }, [apiBase, authHeaders, page, search]);

  const fetchDefaults = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/api/admin/quota/defaults`, { headers: authHeaders });
      const d = await r.json();
      setDefaults(d);
      setDefaultsForm({ daily_limit: d.default_daily_limit, weekly_limit: d.default_weekly_limit });
    } catch { /* ignore */ }
  }, [apiBase, authHeaders]);

  useEffect(() => {
    if (!isOpen) return;
    fetchStats();
    fetchUsers();
    fetchDefaults();
  }, [isOpen, fetchStats, fetchUsers, fetchDefaults]);

  const openUser = async (u) => {
    const r = await fetch(`${apiBase}/api/admin/users/${u.id}/quota`, { headers: authHeaders });
    const d = await r.json();
    setSelectedUser(d);
    setQuotaForm({
      daily_limit: d.daily_limit,
      weekly_limit: d.weekly_limit,
      monthly_renewal_enabled: d.monthly_renewal_enabled,
      monthly_renewal_day: d.monthly_renewal_day || '',
    });
    setGrantAmount('');
    setGrantDesc('');
  };

  const saveQuota = async () => {
    setSaving(true);
    const body = {
      daily_limit: Number(quotaForm.daily_limit),
      weekly_limit: Number(quotaForm.weekly_limit),
      monthly_renewal_enabled: quotaForm.monthly_renewal_enabled,
      monthly_renewal_day: quotaForm.monthly_renewal_day ? Number(quotaForm.monthly_renewal_day) : null,
    };
    const r = await fetch(`${apiBase}/api/admin/users/${selectedUser.user_id}/quota`, {
      method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { flash('Kota güncellendi ✓'); fetchUsers(); }
    else flash(d.error || 'Hata', true);
  };

  const grantTokens = async () => {
    if (!grantAmount || isNaN(grantAmount) || Number(grantAmount) <= 0) return flash('Geçersiz miktar', true);
    setSaving(true);
    const r = await fetch(`${apiBase}/api/admin/users/${selectedUser.user_id}/grant-tokens`, {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(grantAmount), description: grantDesc }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { flash(`${grantAmount} token eklendi ✓`); setGrantAmount(''); openUser({ id: selectedUser.user_id }); fetchUsers(); }
    else flash(d.error || 'Hata', true);
  };

  const resetQuota = async () => {
    setSaving(true);
    const r = await fetch(`${apiBase}/api/admin/users/${selectedUser.user_id}/reset-quota`, {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset_daily: true, reset_weekly: true }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { flash('Kota sıfırlandı ✓'); openUser({ id: selectedUser.user_id }); }
    else flash(d.error || 'Hata', true);
  };

  const saveDefaults = async () => {
    setSaving(true);
    const r = await fetch(`${apiBase}/api/admin/quota/defaults`, {
      method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_limit: Number(defaultsForm.daily_limit), weekly_limit: Number(defaultsForm.weekly_limit) }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) flash(`${d.updated_wallets} platform bakiyesi güncellendi ✓`);
    else flash(d.error || 'Hata', true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xl"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl border border-white/10 bg-[#06080f] shadow-2xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-orange-500 flex items-center justify-center text-xl">🛡️</div>
            <div>
              <h2 className="text-xl font-bold text-white">Admin — Quota Yönetimi</h2>
              <p className="text-xs text-slate-500">Kullanıcı limitleri, token yükleme, platform istatistikleri</p>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-all">✕</button>
        </div>

        {/* Flash messages */}
        {(error || successMsg) && (
          <div className={`mx-8 mt-4 px-4 py-3 rounded-2xl text-sm font-medium border shrink-0 ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
            {error || successMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-6 px-8 pt-5 shrink-0">
          {[['users','👥 Kullanıcılar'], ['defaults','⚙️ Varsayılan Limitler'], ['stats','📊 İstatistikler']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all ${tab===id ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── USERS TAB ── */}
          {tab === 'users' && (
            <div className="flex w-full overflow-hidden">
              {/* User list */}
              <div className="w-80 border-r border-white/5 flex flex-col shrink-0">
                <div className="p-4 border-b border-white/5 shrink-0">
                  <input
                    value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Email veya isim ara..."
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex justify-center py-10"><div className="h-6 w-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
                  ) : users.map(u => (
                    <button key={u.id} onClick={() => openUser(u)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${selectedUser?.user_id === u.id ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''}`}>
                      <p className="text-sm font-medium text-white truncate">{u.display_name}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-emerald-400 font-bold">⬡ {u.token_balance?.balance ?? 0}</span>
                        {u.is_admin && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold">ADMIN</span>}
                      </div>
                    </button>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
                    <span>{totalUsers} kullanıcı</span>
                    <div className="flex gap-2">
                      <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-2 py-1 rounded bg-white/5 disabled:opacity-30">◀</button>
                      <button disabled={users.length < 20} onClick={() => setPage(p=>p+1)} className="px-2 py-1 rounded bg-white/5 disabled:opacity-30">▶</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* User detail */}
              <div className="flex-1 overflow-y-auto p-6">
                {!selectedUser ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="h-16 w-16 rounded-3xl bg-white/5 flex items-center justify-center text-3xl">👈</div>
                    <p className="text-slate-400">Bir kullanıcı seçin</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-xl">
                    {/* User info */}
                    <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
                      <p className="text-lg font-bold text-white">{selectedUser.display_name}</p>
                      <p className="text-sm text-slate-400">{selectedUser.email} · ID: {selectedUser.user_id}</p>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {[['Bakiye', selectedUser.balance, 'emerald'],['Harcanan', selectedUser.total_spent,'slate'],['Günlük Kalan', Math.max(0, selectedUser.daily_limit - selectedUser.daily_used),'indigo']].map(([label,val,color])=>(
                          <div key={label} className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                            <p className={`text-xl font-black text-${color}-400`}>{val}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quota form */}
                    <div className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">⚙️ Kota Limitleri</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="text-xs text-slate-400 mb-1 block">Günlük Limit</span>
                          <input type="number" min="0" value={quotaForm.daily_limit}
                            onChange={e => setQuotaForm(f => ({...f, daily_limit: e.target.value}))}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500" />
                          <p className="text-[10px] text-slate-500 mt-1">Kullanılan: {selectedUser.daily_used}</p>
                        </label>
                        <label className="block">
                          <span className="text-xs text-slate-400 mb-1 block">Haftalık Limit</span>
                          <input type="number" min="0" value={quotaForm.weekly_limit}
                            onChange={e => setQuotaForm(f => ({...f, weekly_limit: e.target.value}))}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500" />
                          <p className="text-[10px] text-slate-500 mt-1">Kullanılan: {selectedUser.weekly_used}</p>
                        </label>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={!!quotaForm.monthly_renewal_enabled}
                          onChange={e => setQuotaForm(f=>({...f, monthly_renewal_enabled: e.target.checked}))}
                          className="accent-indigo-500 h-4 w-4" />
                        <span className="text-sm text-slate-300">Aylık otomatik yenileme aktif</span>
                      </label>

                      {quotaForm.monthly_renewal_enabled && (
                        <label className="block">
                          <span className="text-xs text-slate-400 mb-1 block">Yenileme günü (1–28)</span>
                          <input type="number" min="1" max="28" value={quotaForm.monthly_renewal_day}
                            onChange={e => setQuotaForm(f=>({...f, monthly_renewal_day: e.target.value}))}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500" />
                        </label>
                      )}

                      <div className="flex gap-3">
                        <button onClick={saveQuota} disabled={saving}
                          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all disabled:opacity-50">
                          {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                        <button onClick={resetQuota} disabled={saving}
                          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50">
                          Sıfırla
                        </button>
                      </div>
                    </div>

                    {/* Grant tokens */}
                    <div className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">🎁 Token Yükle</h3>
                      <div className="flex gap-3">
                        <input type="number" min="1" value={grantAmount} onChange={e => setGrantAmount(e.target.value)}
                          placeholder="Miktar"
                          className="w-28 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500" />
                        <input value={grantDesc} onChange={e => setGrantDesc(e.target.value)}
                          placeholder="Açıklama (isteğe bağlı)"
                          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500" />
                      </div>
                      <button onClick={grantTokens} disabled={saving || !grantAmount}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all disabled:opacity-50">
                        Token Yükle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DEFAULTS TAB ── */}
          {tab === 'defaults' && (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-md space-y-6">
                <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-300">
                  ⚠️ Bu limitleri değiştirmek <strong>tüm mevcut kullanıcı platform bakiyelerini</strong> toplu güncelleyecektir.
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/5 space-y-5">
                  <h3 className="font-bold text-white">Global Kota Varsayılanları</h3>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Kayıt bonusu (signup grant)</p>
                    <p className="text-2xl font-black text-indigo-400">{defaults.signup_grant_tokens} token</p>
                    <p className="text-xs text-slate-500">Yeni kullanıcıya tek seferlik verilir. Kod sabitinden değiştirilir.</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Günlük Limit (tüm kullanıcılar)</label>
                    <input type="number" min="0" value={defaultsForm.daily_limit}
                      onChange={e => setDefaultsForm(f=>({...f, daily_limit: e.target.value}))}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Haftalık Limit (tüm kullanıcılar)</label>
                    <input type="number" min="0" value={defaultsForm.weekly_limit}
                      onChange={e => setDefaultsForm(f=>({...f, weekly_limit: e.target.value}))}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                  <button onClick={saveDefaults} disabled={saving}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all disabled:opacity-50">
                    {saving ? 'Güncelleniyor...' : 'Tüm Kullanıcılara Uygula'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STATS TAB ── */}
          {tab === 'stats' && (
            <div className="flex-1 overflow-y-auto p-8">
              {stats ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-2xl">
                  {[
                    ['Toplam Kullanıcı', stats.total_users, '👥', 'indigo'],
                    ['Toplam Bakiye', stats.total_tokens_balance?.toLocaleString(), '⬡', 'emerald'],
                    ['Toplam Harcanan', stats.total_tokens_spent?.toLocaleString(), '🔥', 'rose'],
                    ['Toplam Konuşma', stats.total_conversations?.toLocaleString(), '💬', 'violet'],
                    ['Tamamlanan Satın Alma', stats.total_completed_purchases, '💳', 'amber'],
                  ].map(([label, val, icon, color]) => (
                    <div key={label} className="p-5 rounded-2xl border border-white/10 bg-white/5">
                      <p className="text-2xl mb-1">{icon}</p>
                      <p className={`text-3xl font-black text-${color}-400`}>{val}</p>
                      <p className="text-xs text-slate-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center py-20"><div className="h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminQuotaPanel;
