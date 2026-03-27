import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

const THEMES = [
  { id: 'dark', name: 'Alchemist Dark (Default)', cost: 0, isPremium: false, colors: ['#0f172a', '#3fabe5', '#a855f7'], description: 'Standard sleek dark interface.' },
  { id: 'light', name: 'Alchemist Light (Default)', cost: 0, isPremium: false, colors: ['#f8fafc', '#0ea5e9', '#9333ea'], description: 'Clean and bright aesthetic.' },
  { id: 'dracula', name: 'Dracula', cost: 20, isPremium: true, colors: ['#282a36', '#ff79c6', '#bd93f9'], description: 'A dark theme for vampires.' },
  { id: 'monokai', name: 'Monokai', cost: 30, isPremium: true, colors: ['#272822', '#f92672', '#a6e22e'], description: 'Vibrant colors on a dark background.' },
  { id: 'nord', name: 'Nord', cost: 40, isPremium: true, colors: ['#2e3440', '#88c0d0', '#5e81ac'], description: 'An arctic, north-bluish color palette.' },
  { id: 'github-dark', name: 'GitHub Dark', cost: 50, isPremium: true, colors: ['#0d1117', '#58a6ff', '#238636'], description: 'Familiar GitHub dark styling.' },
  { id: 'synthwave', name: 'Synthwave 84', cost: 75, isPremium: true, colors: ['#262335', '#f92aad', '#36f9f6'], description: 'Retro-futuristic neon glow.' },
  { id: 'cyberpunk', name: 'Cyberpunk 2077', cost: 100, isPremium: true, colors: ['#fcee0a', '#00f0ff', '#ff003c'], description: 'High tech, low life. Extremely vibrant.' }
];

const ThemeStore = ({ token, userXP, userCoins, onThemeChange, onClose, onRefreshCoins }) => {
  const [activeTheme, setActiveTheme] = useState('dark');
  const [unlockedThemes, setUnlockedThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchThemes();
  }, []);

  // Reset on logout
  useEffect(() => {
    if (!token) {
      setUnlockedThemes(['dark', 'light']); // Only free themes
      setActiveTheme('dark');
    }
  }, [token]);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/themes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      onThemeChange(themeId);
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
    
    if (userCoins < theme.cost) {
      showMessage(`Need ${theme.cost} Coin. You have ${userCoins} Coin.`, 'error');
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
    <div className="theme-store">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 flex items-center gap-3">
            <i className="fas fa-palette"></i> 
            Theme Store
          </h2>
          <p className="text-sm text-gray-400 mt-1">Customize your workspace. Current Balance: <strong className="text-fuchsia-400">{userCoins ?? userXP} Coin</strong></p>
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
          const canAfford = userXP >= theme.cost;

          return (
            <div 
              key={theme.id} 
              className={`p-5 rounded-xl border relative overflow-hidden transition-all duration-300 ${isActive ? 'border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.3)] bg-gray-800/80' : 'border-gray-700 bg-gray-900/50 hover:bg-gray-800/80 hover:border-gray-600'}`}
            >
              {/* Preview Colors */}
              <div className="absolute top-0 left-0 w-full h-2 flex">
                <div style={{backgroundColor: theme.colors[0], flex: 1}}></div>
                <div style={{backgroundColor: theme.colors[1], flex: 1}}></div>
                <div style={{backgroundColor: theme.colors[2], flex: 1}}></div>
              </div>

              {isActive && (
                <div className="absolute top-4 right-4 text-fuchsia-400 text-sm font-bold flex items-center gap-1">
                  <i className="fas fa-check-circle"></i> Active
                </div>
              )}

              <div className="mt-2 text-lg font-bold text-gray-100 flex items-center gap-2">
                {theme.name}
                {!isUnlocked && <i className="fas fa-lock text-gray-500 text-sm"></i>}
              </div>
              <p className="text-xs text-gray-400 mt-1 h-8">{theme.description}</p>

              <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-sm">
                  {isUnlocked ? (
                    <span className="text-gray-500">Owned</span>
                  ) : (
                    <>
                      <span className={canAfford ? 'text-yellow-400' : 'text-red-400'}>{theme.cost}</span>
                      <span className="text-gray-500">💎</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => isUnlocked ? handleApplyTheme(theme.id) : handleUnlockTheme(theme)}
                  disabled={isProcessing || (!isUnlocked && !canAfford) || isActive}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                    isProcessing ? 'bg-fuchsia-600/50 text-white cursor-wait' :
                    isUnlocked ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/50' :
                    canAfford ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/50' :
                    'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? 'Processing...' : isActive ? 'Applied' : isUnlocked ? 'Apply Theme' : 'Unlock Now'}
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
