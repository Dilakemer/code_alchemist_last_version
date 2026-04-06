import React, { useState, useEffect, useRef } from 'react';
import FollowButton from './FollowButton';
import GamificationPanel from './GamificationPanel';
import ThemeStore from './ThemeStore';

const UserProfileModal = ({ userId, onClose, apiBase, authHeaders, currentUser, onPostClick, onLogout, onUserUpdate, onShowAlert, onUserClick, onBack, canGoBack, token }) => {
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'achievements' | 'appearance' | 'account'
    
    // Account Settings States
    const [displayName, setDisplayName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [imageLoading, setImageLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const fileInputRef = useRef(null);

    // Followers/Following list states
    const [activeListTab, setActiveListTab] = useState(null);
    const [followersList, setFollowersList] = useState([]);
    const [followingList, setFollowingList] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    // API Keys States
    const [apiKeys, setApiKeys] = useState([]);
    const [keysLoading, setKeysLoading] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyToken, setNewKeyToken] = useState(null);
    const [isCreatingKey, setIsCreatingKey] = useState(false);

    const isOwnProfile = currentUser && currentUser.id === userId;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${apiBase}/api/users/${userId}/profile`, { headers: authHeaders });
                if (res.ok) {
                    const data = await res.json();
                    setProfileData(data);
                    setDisplayName(data.user.display_name || '');
                }
            } catch (err) {
                console.error("Failed to fetch profile", err);
            } finally {
                setLoading(false);
            }
        };
        if (userId) {
            setLoading(true);
            fetchProfile();
        }
    }, [userId, apiBase, authHeaders]);

    useEffect(() => {
        if (activeTab === 'developer' && isOwnProfile) {
            setKeysLoading(true);
            fetch(`${apiBase}/api/keys`, { headers: authHeaders })
                .then(res => res.json())
                .then(data => {
                    if (data.keys) setApiKeys(data.keys);
                })
                .catch(err => console.error("Error fetching keys:", err))
                .finally(() => setKeysLoading(false));
            
            // clear previously created token display
            setNewKeyToken(null);
            setNewKeyName('');
        }
    }, [activeTab, apiBase, authHeaders, isOwnProfile]);

    if (!userId) return null;

    const user = profileData?.user;
    const posts = profileData?.posts || [];

    const resolveAvatarUrl = (u) => {
        if (!u) return null;
        const candidate = u.profile_image || u.profile_image_url || u.profileImage || u.avatar || u.author_image;
        if (!candidate) return null;
        if (candidate.startsWith('http')) return candidate;
        return `${apiBase}${candidate.startsWith('/') ? '' : '/'}${candidate}`;
    };

    const avatarUrl = resolveAvatarUrl(user);
    const bio = user?.bio || '';

    const handleRemovePhoto = async () => {
        setImageLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/auth/profile/image`, { method: 'DELETE', headers: authHeaders });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Photo removed!' });
                if (onUserUpdate) onUserUpdate(data.user);
            }
        } catch { setMessage({ type: 'error', text: 'Error.' }); }
        finally { setImageLoading(false); }
    };

    const tabs = [
        { id: 'overview', label: 'Genel Bakış', icon: '👤' },
        { id: 'achievements', label: 'Başarılar', icon: '🏆', ownOnly: true },
        { id: 'appearance', label: 'Görünüm', icon: '🎨', ownOnly: true },
        { id: 'developer', label: 'Geliştirici', icon: '💻', ownOnly: true },
        { id: 'account', label: 'Hesap', icon: '⚙️', ownOnly: true },
    ];

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-white/10 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                
                {/* Header Section */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        {canGoBack && (
                            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                        )}
                        <h2 className="text-xl font-black text-white">Profil</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                        ✕
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-1 shrink-0">
                        {tabs.map(tab => {
                            if (tab.ownOnly && !isOwnProfile) return null;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                                        activeTab === tab.id 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            );
                        })}
                        
                        <div className="mt-auto pt-4">
                            {isOwnProfile && (
                                <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all">
                                    <span>🚪</span> Çıkış Yap
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : !user ? (
                            <div className="text-center text-slate-500 mt-20">Kullanıcı bulunamadı.</div>
                        ) : (
                            <>
                                {activeTab === 'overview' && (
                                    <div className="max-w-2xl mx-auto">
                                        <div className="flex items-center gap-6 mb-10">
                                            <div className="w-24 h-24 rounded-3xl bg-[var(--accent-gradient)] p-1 shrink-0">
                                                <div className="w-full h-full rounded-[20px] bg-[#0F172A] overflow-hidden flex items-center justify-center text-3xl font-black text-white">
                                                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : user.display_name?.[0]}
                                                </div>
                                            </div>
                                            <div>
                                                <h1 className="text-3xl font-black text-white mb-1">{user.display_name}</h1>
                                                <p className="text-slate-400 text-sm font-medium">@{user.username || 'alchemist'}</p>
                                                <div className="flex gap-4 mt-4">
                                                    <span className="text-xs text-slate-500"><b>{user.followers_count || 0}</b> Takipçi</span>
                                                    <span className="text-xs text-slate-500"><b>{user.following_count || 0}</b> Takip</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bio / Persona */}
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-8">
                                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">AI Persona & Bio</h3>
                                            <p className="text-slate-300 text-sm leading-relaxed mb-6">{bio || 'Henüz bir bio eklenmemiş.'}</p>
                                            
                                            {isOwnProfile && (
                                                <div className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                                                    <div>
                                                        <span className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Current Expertise</span>
                                                        <span className="text-sm font-bold text-white">{user.preferences?.expertise || 'Analiz Edilmedi'}</span>
                                                    </div>
                                                    <button 
                                                        disabled={analyzing}
                                                        onClick={async () => {
                                                            setAnalyzing(true);
                                                            try {
                                                                const res = await fetch(`${apiBase}/api/auth/profile/analyze`, { method: 'POST', headers: authHeaders });
                                                                if (res.ok) {
                                                                    const data = await res.json();
                                                                    setProfileData(prev => ({ ...prev, user: data.user }));
                                                                    if (onUserUpdate) onUserUpdate(data.user);
                                                                }
                                                            } finally { setAnalyzing(false); }
                                                        }}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold rounded-lg transition-all"
                                                    >
                                                        {analyzing ? '...' : 'Re-Analyze Persona'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Posts */}
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Gönderiler</h3>
                                        <div className="space-y-3">
                                            {posts.map(post => (
                                                <div key={post.id} onClick={() => onPostClick && onPostClick(post)} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:border-indigo-500/30 cursor-pointer transition-all">
                                                    <p className="text-sm text-slate-200 font-medium line-clamp-1">{post.user_question}</p>
                                                    <div className="flex gap-3 mt-2 text-[10px] text-slate-500 font-bold uppercase">
                                                        <span>{post.selected_model}</span>
                                                        <span>•</span>
                                                        <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {posts.length === 0 && <p className="text-sm text-slate-600 italic">Henüz gönderi yok.</p>}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'achievements' && isOwnProfile && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <GamificationPanel token={token} />
                                    </div>
                                )}

                                {activeTab === 'appearance' && isOwnProfile && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <h3 className="text-xl font-black text-white mb-6">Tema Mağazası</h3>
                                        <ThemeStore />
                                    </div>
                                )}

                                {activeTab === 'developer' && isOwnProfile && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-2xl mx-auto">
                                        <h3 className="text-xl font-black text-white mb-2">Geliştirici Ayarları</h3>
                                        <p className="text-sm text-slate-400 mb-8">
                                            CodeAlchemist'i VS Code, Terminal veya kendi araçlarınızla entegre etmek için API anahtarları oluşturun.
                                        </p>
                                        
                                        {/* Create New Key Section */}
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-8">
                                            <h4 className="text-sm font-bold text-white mb-4">Yeni Anahtar Oluştur</h4>
                                            
                                            {newKeyToken ? (
                                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
                                                    <p className="text-emerald-400 text-sm font-bold mb-2">Başarıyla oluşturuldu! Lütfen bu anahtarı güvenli bir yere kopyalayın.</p>
                                                    <p className="text-xs text-slate-400 mb-3">Güvenlik nedeniyle bu anahtarı bir daha tam olarak göremeyeceksiniz.</p>
                                                    <div className="flex items-center gap-2 bg-black/40 p-3 rounded-lg border border-white/10">
                                                        <code className="text-indigo-300 font-mono text-sm flex-1 break-all">{newKeyToken}</code>
                                                        <button 
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(newKeyToken);
                                                                if(onShowAlert) onShowAlert('Anahtar kopyalandı!', 'success');
                                                            }}
                                                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold transition-all"
                                                        >Kopyala</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3">
                                                    <input 
                                                        type="text" 
                                                        value={newKeyName} 
                                                        onChange={(e) => setNewKeyName(e.target.value)} 
                                                        placeholder="Örn: VS Code Mac" 
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                        maxLength={50}
                                                    />
                                                    <button 
                                                        disabled={isCreatingKey || !newKeyName.trim()}
                                                        onClick={async () => {
                                                            setIsCreatingKey(true);
                                                            try {
                                                                const res = await fetch(`${apiBase}/api/keys`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                                                                    body: JSON.stringify({ name: newKeyName })
                                                                });
                                                                if (res.ok) {
                                                                    const data = await res.json();
                                                                    setNewKeyToken(data.key.token);
                                                                    setApiKeys(prev => [data.key, ...prev]);
                                                                    setNewKeyName('');
                                                                    if(onShowAlert) onShowAlert('Yeni API anahtarı üretildi.', 'success');
                                                                } else {
                                                                    const data = await res.json();
                                                                    if(onShowAlert) onShowAlert(data.error || 'Hata oluştu', 'error');
                                                                }
                                                            } catch (err) {
                                                                if(onShowAlert) onShowAlert('Bağlantı hatası', 'error');
                                                            } finally {
                                                                setIsCreatingKey(false);
                                                            }
                                                        }}
                                                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                                                    >
                                                        {isCreatingKey ? '...' : 'Oluştur'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* List Keys Section */}
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-bold text-slate-300 mb-4 px-1">Mevcut Anahtarlarınız</h4>
                                            {keysLoading ? (
                                                <div className="text-center py-6 text-slate-500 text-sm">Yükleniyor...</div>
                                            ) : apiKeys.length === 0 ? (
                                                <div className="text-center py-6 text-slate-500 text-sm bg-white/[0.01] border border-white/5 rounded-xl">
                                                    Henüz API anahtarınız yok.
                                                </div>
                                            ) : (
                                                apiKeys.map(key => (
                                                    <div key={key.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl transition-colors">
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <h5 className="font-bold text-slate-200 text-sm">{key.name}</h5>
                                                                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">{key.key_preview || (key.token && key.token.replace(/^(ca-).+(.{4})$/, '$1***$2')) || '***'}</span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                                                                <span>Oluşturuldu: {new Date(key.created_at).toLocaleDateString()}</span>
                                                                {key.last_used_at && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>Son Kullanım: {new Date(key.last_used_at).toLocaleDateString()}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={async () => {
                                                                if (!window.confirm(`"${key.name}" anahtarını iptal etmek istediğinize emin misiniz?`)) return;
                                                                try {
                                                                    const res = await fetch(`${apiBase}/api/keys/${key.id}`, {
                                                                        method: 'DELETE',
                                                                        headers: authHeaders
                                                                    });
                                                                    if (res.ok) {
                                                                        setApiKeys(prev => prev.filter(k => k.id !== key.id));
                                                                        if(onShowAlert) onShowAlert('Anahtar iptal edildi.', 'success');
                                                                    }
                                                                } catch (err) {
                                                                    if(onShowAlert) onShowAlert('İptal edilemedi.', 'error');
                                                                }
                                                            }}
                                                            className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                            title="İptal Et (Revoke)"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'account' && isOwnProfile && (
                                    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-xl font-black text-white mb-6">Hesap Ayarları</h3>
                                            
                                            {message.text && (
                                                <div className={`p-4 rounded-xl text-sm mb-6 ${message.type === 'error' ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
                                                    {message.text}
                                                </div>
                                            )}

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Display Name</label>
                                                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                                                </div>

                                                <div className="space-y-3 pt-4">
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Şifre Değiştir</label>
                                                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Şu anki şifre" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" />
                                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Yeni şifre" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" />
                                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Yeni şifre (Tekrar)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" />
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        if (newPassword && newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Passwords do not match.' }); return; }
                                                        setUpdating(true);
                                                        try {
                                                            const res = await fetch(`${apiBase}/api/auth/profile`, {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json', ...authHeaders },
                                                                body: JSON.stringify({ display_name: displayName, current_password: currentPassword, new_password: newPassword })
                                                            });
                                                            const data = await res.json();
                                                            if (res.ok) {
                                                                setMessage({ type: 'success', text: 'Profile updated!' });
                                                                setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
                                                                if (onUserUpdate) onUserUpdate(data.user);
                                                            } else { setMessage({ type: 'error', text: data.error || 'Error!' }); }
                                                        } finally { setUpdating(false); }
                                                    }}
                                                    disabled={updating}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                                >
                                                    {updating ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="pt-8 border-t border-white/5">
                                            <h4 className="text-red-400 font-bold mb-4">Tehlikeli Bölge</h4>
                                            {!showDeleteConfirm ? (
                                                <button onClick={() => setShowDeleteConfirm(true)} className="text-red-400/60 hover:text-red-400 text-sm font-bold underline transition-colors">
                                                    Hesabımı Kalıcı Olarak Sil
                                                </button>
                                            ) : (
                                                <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4">
                                                    <p className="text-sm text-red-300">Bu işlem geri alınamaz. Onaylamak için şifrenizi girin:</p>
                                                    <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="w-full bg-black/20 border border-red-500/30 rounded-xl px-4 py-3 text-white outline-none" />
                                                    <div className="flex gap-3">
                                                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-white/5 text-white py-3 rounded-xl font-bold">Vazgeç</button>
                                                        <button 
                                                            onClick={async () => {
                                                                const res = await fetch(`${apiBase}/api/auth/delete-account`, {
                                                                    method: 'DELETE',
                                                                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                                                                    body: JSON.stringify({ password: deletePassword })
                                                                });
                                                                if (res.ok) { onLogout(); onClose(); }
                                                            }}
                                                            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold"
                                                        >
                                                            Hesabımı Sil
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
