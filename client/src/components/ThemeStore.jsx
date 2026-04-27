import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

const THEMES = [
  { id: 'dark', name: 'Alchemist Dark', cost: 0, isPremium: false, colors: ['#0f172a', '#6366f1', '#a855f7'], description: 'Modern deep space interface with vibrant indigo glow.' },
  { id: 'light', name: 'Alchemist Light', cost: 0, isPremium: false, colors: ['#f8fafc', '#4f46e5', '#ec4899'], description: 'Crisp and clean professional palette with soft pink accents.' },
  { id: 'dracula', name: 'Dracula Pro', cost: 20, isPremium: true, colors: ['#282a36', '#bd93f9', '#ff79c6'], description: 'The legendary vampire theme with electric purple and pink.' },
  { id: 'monokai', name: 'Monokai Vivid', cost: 30, isPremium: true, colors: ['#272822', '#f92672', '#a6e22e'], description: 'Warm tropical coding vibe with high-energy highlights.' },
  { id: 'nord', name: 'Nordic Frost', cost: 40, isPremium: true, colors: ['#2e3440', '#88c0d0', '#ebcb8b'], description: 'Arctic elegance with frosty blues and golden sunlight.' },
  { id: 'github-dark', name: 'GitHub Universe', cost: 50, isPremium: true, colors: ['#0d1117', '#58a6ff', '#3fb950'], description: 'Professional dark mode with deep ocean blues and forest greens.' },
  { id: 'synthwave', name: 'Synthwave Neon', cost: 75, isPremium: true, colors: ['#241b2f', '#ff7edb', '#36f9f6'], description: 'Retro 80s aesthetic with glowing neon pink and cyan.' },
  { id: 'cyberpunk', name: 'Cyberpunk Edge', cost: 100, isPremium: true, colors: ['#1a1a1a', '#fdf500', '#ff00ff'], description: 'High-tech, low-life vibes with toxic yellow and magenta.' }
];

const ThemeStore = ({ token, userXP, userCoins, onThemeChange, onClose, onRefreshCoins }) => {
  const [activeTheme, setActiveTheme] = useState('dark');
  const [unlockedThemes, setUnlockedThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const currentCoins = Number.isFinite(userCoins) ? userCoins : 0;

  useEffect(() => {
    if (token) {
      fetchThemes();
    }
  }, [token]);

  // Reset on logout
  useEffect(() => {
    if (!token) {
      setUnlockedThemes(['dark', 'light']); // Only free themes
      setActiveTheme('dark');
    }
  }, [token]);

  const fetchThemes = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/themes`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        console.warn('Theme access unauthorized. Session might be expired.');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch themes');
      const data = await res.json();
      setActiveTheme(data.active_theme);
      setUnlockedThemes(data.unlocked_themes);
    } catch (err) {
      console.error('Failed to fetch themes', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTheme = async (themeId) => {
    if (!token) {
      showMessage('You must be logged in to change themes', 'error');
      return;
    }
    
    try {
      setProcessingId(themeId);
      const res = await fetch(`${API_BASE}/api/themes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ action: 'set_active', theme: themeId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply theme');
      
      // Backend'den yeniden fetch et (state senkronizasyonu için)
      await fetchThemes();
      if (typeof onThemeChange === 'function') {
        onThemeChange(themeId);
      } else {
        document.documentElement.setAttribute('data-theme', themeId);
        localStorage.setItem('codebrain_theme', themeId);
      }
      showMessage(data.message, 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnlockTheme = async (theme) => {
    if (!token) {
      showMessage('You must be logged in to unlock themes', 'error');
      return;
    }
    
    if (currentCoins < theme.cost) {
      showMessage(`Need ${theme.cost} Coin. You have ${currentCoins} Coin.`, 'error');
      return;
    }

    try {
      setProcessingId(theme.id);
      const res = await fetch(`${API_BASE}/api/themes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ action: 'unlock', theme: theme.id, cost: theme.cost })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlock theme');
      
      setUnlockedThemes(data.unlocked_themes);
      if (onRefreshCoins) onRefreshCoins(data.remaining_coins);
      showMessage(data.message, 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading themes...</div>;
  }

  return (
    <div className="theme-store store-container-rounded p-8 bg-gray-900/5 backdrop-blur-xl border border-gray-700/20 text-gray-900 dark:text-gray-100 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-fuchsia-600/5 blur-[100px] rounded-full"></div>
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full"></div>

      {/* Guest Overlay */}
      {!token && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-6 text-center">
          <div className="w-20 h-20 bg-fuchsia-600/20 rounded-full flex items-center justify-center mb-6 border border-fuchsia-500/30">
            <i className="fas fa-user-lock text-3xl text-fuchsia-400"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Login Required</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-xs mb-8">You must be logged in to unlock and apply custom themes to your workspace.</p>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-fuchsia-900/50"
          >
            Close & Log In
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 flex items-center gap-3">
            <i className="fas fa-palette"></i> 
            Theme Store
          </h2>
          <p className="text-sm text-gray-400 mt-1">Customize your workspace. Current Balance: <strong className="text-fuchsia-400">{currentCoins} Coin</strong></p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
            ✕
          </button>
        )}
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/30' : 'bg-green-500/20 text-green-200 border border-green-500/30'}`}>
          {message.text}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {THEMES.map(theme => {
          const isUnlocked = unlockedThemes.includes(theme.id);
          const isActive = activeTheme === theme.id;
          const isProcessing = processingId === theme.id;
          const canAfford = currentCoins >= theme.cost;

          return (
            <div 
              key={theme.id} 
              className={`p-6 store-card-rounded border-2 relative overflow-hidden transition-all duration-500 group ${isActive ? 'border-fuchsia-500 shadow-xl bg-white dark:bg-gray-800/80' : 'border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-800/60'}`}
            >
              {/* Background Accent Glow */}
              {isActive && (
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-fuchsia-500/10 blur-3xl rounded-full"></div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {theme.name}
                    {!isUnlocked && <i className="fas fa-lock text-gray-400 dark:text-gray-600 text-sm"></i>}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">{theme.description}</p>
                </div>
                {isActive && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-400 text-xs font-bold border border-fuchsia-500/30">
                    <i className="fas fa-check-circle"></i> Active
                  </span>
                )}
              </div>

              {/* Color Palette Display */}
              <div className="flex items-center gap-3 mb-6">
                {theme.colors.map((color, idx) => (
                  <div 
                    key={idx}
                    className="group/swatch relative"
                  >
                    <div 
                      className="w-10 h-10 store-swatch-rounded shadow-lg border border-white/10 transform transition-transform group-hover/swatch:scale-110 group-hover/swatch:rotate-3"
                      style={{ 
                        backgroundColor: color,
                        boxShadow: `0 4px 12px ${color}44` 
                      }}
                    ></div>
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-gray-500 opacity-0 group-hover/swatch:opacity-100 transition-opacity whitespace-nowrap">
                      {color}
                    </span>
                  </div>
                ))}
                <div className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 font-mono tracking-widest uppercase">Palette</div>
              </div>

              <div className="pt-4 border-t border-gray-700/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isUnlocked ? (
                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-gray-700">Owned</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-lg font-black ${canAfford ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{theme.cost}</span>
                      <span className="text-lg">💎</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => isUnlocked ? handleApplyTheme(theme.id) : handleUnlockTheme(theme)}
                  disabled={isProcessing || (!isUnlocked && !canAfford) || isActive}
                  className={`relative px-6 py-2 rounded-xl text-sm font-bold transition-all overflow-hidden ${
                    isActive ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' :
                    isProcessing ? 'bg-fuchsia-600/50 text-white cursor-wait' :
                    isUnlocked ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg active:scale-95' :
                    canAfford ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-fuchsia-600 dark:hover:bg-yellow-400 hover:text-white shadow-lg active:scale-95' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <span className="relative z-10">
                    {isProcessing ? 'Processing...' : isActive ? 'Applied' : isUnlocked ? 'Apply Theme' : 'Unlock Now'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeStore;
