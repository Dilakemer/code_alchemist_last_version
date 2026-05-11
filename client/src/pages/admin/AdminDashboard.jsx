import React, { useState, useEffect } from 'react';
import ApiKeyInput from '../../components/admin/ApiKeyInput';

// --- RAW SVG ICONS (Replacements for lucide-react) ---
const IconUsers = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconShield = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const IconKey = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21 2-2 2.27"/><path d="M3.83 14.17a4.83 4.83 0 0 0 6.83 6.83l.59-.58.11-.11.1-.1a6.83 6.83 0 1 0-9.54-9.54l1.91 1.91"/><path d="m14.85 5.15 2.82 2.82"/><path d="m17.68 2.32 2.82 2.82"/></svg>
);
const IconHistory = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const IconSearch = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const IconRefresh = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
);
const IconTrash = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);
const IconChevronRight = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
);
const IconAlert = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
);
const IconExternal = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
);

const AdminDashboard = ({ authHeaders, onViewProfile }) => {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userKeys, setUserKeys] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: authHeaders }),
        fetch('/api/admin/audit-logs', { headers: authHeaders })
      ]);
      const usersData = await usersRes.json();
      const logsData = await logsRes.json();
      setUsers(usersData.users || []);
      setAuditLogs(logsData.logs || []);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserKeys = async (userId) => {
    try {
      console.log(`[AdminDashboard] Fetching keys for user ${userId}`);
      const response = await fetch(`/api/admin/users/${userId}/keys`, { headers: authHeaders });
      console.log(`[AdminDashboard] Key fetch status: ${response.status}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP ${response.status}: Failed to fetch keys`);
      }
      const data = await response.json();
      console.log(`[AdminDashboard] Keys fetched:`, data.keys);
      const keysObj = {};
      (data.keys || []).forEach(k => {
        keysObj[k.provider] = k.mask;
      });
      console.log(`[AdminDashboard] Keys obj:`, keysObj);
      setUserKeys(prev => ({ ...prev, [userId]: keysObj }));
    } catch (err) {
      console.error("[AdminDashboard] Error fetching user keys:", err);
    }
  };

  const deleteKey = async (userId, provider) => {
    if (!window.confirm(`Are you sure you want to delete the ${provider} key for this user?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}/keys/${provider}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (!response.ok) throw new Error("Delete failed");
      fetchUserKeys(userId);
      fetchData(); // Refresh user counts
    } catch (err) {
      alert("Error deleting key: " + err.message);
    }
  };

  const deleteUser = async (userId, email) => {
    if (!window.confirm(`CRITICAL: Are you sure you want to PERMANENTLY DELETE user ${email}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { ...authHeaders, Accept: 'application/json' }
      });
      let data = {};
      try {
        data = await response.json();
      } catch {
        /* non-JSON body */
      }
      if (!response.ok) throw new Error(data.error || `Delete failed (${response.status})`);

      alert(data.message || "User deleted successfully.");
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      alert("Error deleting user: " + err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.display_name && u.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredAuditLogs = auditLogs.filter(log => {
    const query = auditSearch.trim().toLowerCase();
    const haystack = [
      log.user_email,
      log.target_email,
      log.action,
      log.metadata?.provider,
      log.metadata?.deleted_email,
      log.ip_address
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query);
    const matchesAction = auditAction === 'all' || log.action === auditAction;
    return matchesQuery && matchesAction;
  });

  const auditActionOptions = ['all', ...Array.from(new Set(auditLogs.map(log => log.action))).sort()];
  const deleteLogCount = auditLogs.filter(log => String(log.action).includes('delete')).length;
  const recentLogCount = auditLogs.filter(log => {
    if (!log.created_at) return false;
    const createdAt = new Date(log.created_at).getTime();
    return Number.isFinite(createdAt) && createdAt >= Date.now() - (24 * 60 * 60 * 1000);
  }).length;

  const formatAuditAction = (action) => String(action || '').replace(/_/g, ' ');

  const getAuditActionTone = (action) => {
    const value = String(action || '');
    if (value.includes('delete')) return 'bg-rose-500/15 text-rose-300 border border-rose-500/20';
    if (value.includes('add') || value.includes('grant')) return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20';
    if (value.includes('admin')) return 'bg-amber-500/15 text-amber-300 border border-amber-500/20';
    return 'bg-white/10 text-white/70 border border-white/10';
  };

  const formatUserTokenBalance = (user) => {
    if (user?.is_unlimited) return '∞';
    return Number(user?.token_balance ?? 0).toLocaleString();
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <IconRefresh className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <IconShield size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Control Panel</h1>
              <p className="text-white/50 text-sm">Manage users, API keys, and platform security</p>
            </div>
          </div>
          <button 
            onClick={fetchData}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <IconRefresh size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 p-1 bg-white/5 rounded-2xl w-fit border border-white/10">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-white/60 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <IconUsers size={16} />
              <span>Users</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-white/60 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <IconHistory size={16} />
              <span>Audit Logs</span>
            </div>
          </button>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {activeTab === 'users' ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">User Directory</h2>
                  <div className="relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64"
                    />
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-white/30 border-b border-white/10">
                        <th className="px-6 py-4 font-medium">User</th>
                        <th className="px-6 py-4 font-medium">Tokens</th>
                        <th className="px-6 py-4 font-medium">External Keys</th>
                        <th className="px-6 py-4 font-medium">Role</th>
                        <th className="px-6 py-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map(user => (
                        <tr 
                          key={user.id} 
                          className={`group hover:bg-white/5 transition-colors cursor-pointer ${selectedUser?.id === user.id ? 'bg-white/5' : ''}`}
                          onClick={() => {
                            setSelectedUser(user);
                            fetchUserKeys(user.id);
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold border border-white/20">
                                {user.email[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{user.display_name || 'No Name'}</p>
                                <p className="text-xs text-white/40">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-indigo-400">{formatUserTokenBalance(user)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1.5">
                              <IconKey size={14} className={user.external_key_count > 0 ? "text-emerald-400" : "text-white/20"} />
                              <span className="text-xs">{user.external_key_count}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {user.is_admin ? (
                              <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-md border border-amber-500/20">ADMIN</span>
                            ) : (
                              <span className="text-[10px] text-white/30">USER</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <IconChevronRight size={18} className="text-white/20 group-hover:text-white transition-all group-hover:translate-x-1" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">Total Events</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{auditLogs.length}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">Delete Actions</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-400">{deleteLogCount}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">Last 24h</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-400">{recentLogCount}</p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl">
                  <div className="p-6 border-b border-white/10 space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <h2 className="text-lg font-semibold text-rose-400 flex items-center space-x-2">
                        <IconAlert size={20} />
                        <span>Security Audit Logs</span>
                      </h2>
                      <span className="text-xs text-white/40">
                        Showing {filteredAuditLogs.length} of {auditLogs.length}
                      </span>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3">
                      <div className="relative flex-1">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                        <input
                          type="text"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                          placeholder="Search by actor, target, IP, or provider..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                      <select
                        value={auditAction}
                        onChange={(e) => setAuditAction(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      >
                        {auditActionOptions.map(action => (
                          <option key={action} value={action}>
                            {action === 'all' ? 'All actions' : formatAuditAction(action)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="divide-y divide-white/5">
                    {filteredAuditLogs.map(log => (
                      <div key={log.id} className="p-5 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-indigo-300">{log.user_email}</span>
                              <span className="text-xs text-white/30">performed</span>
                              <span className={`text-[10px] px-2 py-1 rounded-full font-mono uppercase tracking-wider ${getAuditActionTone(log.action)}`}>
                                {formatAuditAction(log.action)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Target: <span className="text-white/90">{log.target_email || 'System'}</span>
                              </span>
                              {log.metadata?.provider && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/50">
                                  Provider: <span className="text-white/80">{log.metadata.provider}</span>
                                </span>
                              )}
                              {log.ip_address && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/50">
                                  IP: <span className="text-white/80">{log.ip_address}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="text-[10px] text-white/30 whitespace-nowrap pt-1">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown time'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {filteredAuditLogs.length === 0 && (
                      <div className="p-12 text-center text-white/20">
                        No security events match the current filters.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Detail Column */}
          <div className="space-y-6">
            {selectedUser ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl sticky top-8">
                <div className="text-center space-y-4 mb-8">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold border-2 border-white/20 mx-auto shadow-2xl shadow-indigo-500/20">
                    {selectedUser.email[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{selectedUser.display_name || 'Anonymous User'}</h3>
                    <p className="text-xs text-white/40">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center space-x-2">
                        <IconKey size={14} />
                        <span>External API Keys</span>
                      </h4>
                      <span className="text-[10px] text-white/20">Encrypted in DB</span>
                    </div>
                    
                    <div className="space-y-4">
                      {['openai', 'anthropic', 'gemini'].map(provider => (
                        <div key={provider} className="space-y-2">
                          {userKeys[selectedUser.id]?.[provider] ? (
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                              <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-white/40">{provider}</p>
                                  <p className="text-xs font-mono">{userKeys[selectedUser.id][provider]}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => deleteKey(selectedUser.id, provider)}
                                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              >
                                <IconTrash size={16} />
                              </button>
                            </div>
                          ) : (
                            <ApiKeyInput 
                              provider={provider} 
                              userId={selectedUser.id}
                              authHeaders={authHeaders}
                              onSave={() => {
                                fetchUserKeys(selectedUser.id);
                                fetchData();
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10 space-y-3">
                    <button 
                      onClick={() => onViewProfile && onViewProfile(selectedUser.id)}
                      className="w-full flex items-center justify-center space-x-2 py-3 border border-white/10 hover:bg-white/5 rounded-2xl transition-all text-sm text-white/60 hover:text-white"
                    >
                      <span>View Full Profile</span>
                      <IconExternal size={14} />
                    </button>

                    <button 
                      onClick={() => deleteUser(selectedUser.id, selectedUser.email)}
                      className="w-full flex items-center justify-center space-x-2 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl transition-all text-sm border border-rose-500/20"
                    >
                      <IconTrash size={14} />
                      <span>Delete User Account</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                <div className="p-4 bg-white/5 rounded-2xl text-white/20">
                  <IconUsers size={48} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-white/60 font-medium">No User Selected</h3>
                  <p className="text-white/30 text-xs">Select a user from the directory to manage their external API keys.</p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
