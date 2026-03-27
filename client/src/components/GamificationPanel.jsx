import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

const GamificationPanel = ({ token }) => {
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const authHeader = { Authorization: `Bearer ${token}` };
      const [profileRes, leaderboardRes, meRes] = await Promise.all([
        fetch(`${API_BASE}/api/gamification/profile`, { headers: authHeader }),
        fetch(`${API_BASE}/api/gamification/leaderboard`, { headers: authHeader }),
        fetch(`${API_BASE}/api/auth/me`, { headers: authHeader })
      ]);
      
      const profileData = await profileRes.json();
      const leaderboardData = await leaderboardRes.json();
      const meData = await meRes.json();
      
      setProfile(profileData);
      setLeaderboard(leaderboardData.leaderboard);
      setAuthUser(meData?.user || null);
    } catch (error) {
      console.error('Error fetching gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (xp, level) => {
    const safeLevel = Math.max(Number(level) || 1, 1);
    const nextLevelXP = 100 * (safeLevel ** 2);
    const currentLevelBaseXP = 100 * ((safeLevel - 1) ** 2);
    const progress = ((xp - currentLevelBaseXP) / (nextLevelXP - currentLevelBaseXP)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const getRankTitleByLevel = (level) => {
    const safeLevel = Math.max(Number(level) || 1, 1);
    if (safeLevel >= 20) return 'Grand Archmage';
    if (safeLevel >= 15) return 'Master Alchemist';
    if (safeLevel >= 10) return 'Arcane Engineer';
    if (safeLevel >= 6) return 'Code Adept';
    if (safeLevel >= 3) return 'Junior Alchemist';
    return 'Novice Alchemist';
  };

  if (!token) return null;

  if (loading) {
    return (
      <div className="gamification-panel glass-panel loading">
        <div className="skeleton-line title"></div>
        <div className="skeleton-line"></div>
        <div className="skeleton-box"></div>
      </div>
    );
  }

  const parseBadgeIcon = (icon) => {
    if (!icon) return <span>🏅</span>;
    if (icon.startsWith('fa-')) {
        return <i className={`fas ${icon}`}></i>;
    }
    return <span>{icon}</span>;
  };

  const getNextLevelXP = (level) => {
    const safeLevel = Math.max(Number(level) || 1, 1);
    return 100 * (safeLevel ** 2);
  };

  const buildSafeDisplayName = (user) => {
    const name = user?.display_name?.trim();
    if (name) return name;
    return `Alchemist #${user?.user_id ?? ''}`.trim();
  };

  const buildFallbackAvatar = (name) => {
    const initial = (name?.trim()?.charAt(0) || 'A').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#c026d3"/></linearGradient></defs><rect width="72" height="72" rx="36" fill="url(#g)"/><text x="50%" y="54%" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" font-weight="700">${initial}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const getStreakLabel = (days) => {
    const safeDays = Number(days) || 0;
    return safeDays === 1 ? 'day streak' : 'days streak';
  };

  const normalizeHandle = (value, fallback = 'alchemist') => {
    const text = (value || '').toString().trim().toLowerCase();
    if (!text) return fallback;
    const normalized = text.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return normalized || fallback;
  };

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const xpDiff = (b?.total_xp || b?.xp || 0) - (a?.total_xp || a?.xp || 0);
    if (xpDiff !== 0) return xpDiff;
    return (a?.rank || Number.MAX_SAFE_INTEGER) - (b?.rank || Number.MAX_SAFE_INTEGER);
  });

  return (
    <div className="gamification-panel glass-panel">
      <div className="gamification-tabs">
        <button 
          className={activeTab === 'profile' ? 'active' : ''} 
          onClick={() => setActiveTab('profile')}
        >
          <i className="fas fa-user-astronaut"></i> Status
        </button>
        <button 
          className={activeTab === 'leaderboard' ? 'active' : ''} 
          onClick={() => setActiveTab('leaderboard')}
        >
          <i className="fas fa-trophy"></i> Leaderboard
        </button>
      </div>

      <div className="gamification-content">
        {activeTab === 'profile' && profile && (
          <div className="gamification-profile">
            {(() => {
              const effectiveLevel = Math.max(Number(profile.level) || 1, 1);
              const effectiveTotalXP = Math.max(Number(profile.total_xp_earned) || 0, Number(profile.xp) || 0);
              const progressPercent = calculateProgress(effectiveTotalXP, effectiveLevel);
              const identityName = profile.display_name || authUser?.display_name || `Alchemist #${profile.user_id || ''}`;
              const rawHandle = profile.username || authUser?.display_name;
              const handle = normalizeHandle(rawHandle, normalizeHandle(identityName, 'alchemist'));
              const currentLevelBaseXP = 100 * ((Math.max(Number(effectiveLevel) || 1, 1) - 1) ** 2);
              const nextXP = getNextLevelXP(effectiveLevel);
              const inLevelXP = Math.max(effectiveTotalXP - currentLevelBaseXP, 0);
              const levelSpanXP = Math.max(nextXP - currentLevelBaseXP, 1);
              const remainingXP = Math.max(nextXP - effectiveTotalXP, 0);
              const localRankTitle = getRankTitleByLevel(effectiveLevel);
              return (
                <>
            <div className="level-header">
              <div className="level-badge">
                <span className="level-label">LVL</span>
                <span className="level-number">{effectiveLevel}</span>
              </div>
              <div className="level-info">
                <h3>{identityName}</h3>
                <div className="identity-row">
                  <span className="identity-chip">@{handle}</span>
                  <span className="identity-chip nickname">Lakap: {localRankTitle}</span>
                </div>
                <div className="xp-text">{profile.xp} / {nextXP} XP</div>
              </div>
              <div className="streak-badge" title="Daily Streak">
                <i className="fas fa-fire streak-icon"></i>
                <div className="streak-text">
                  <span className="streak-value">{profile.streak_days}</span>
                  <span className="streak-label">{getStreakLabel(profile.streak_days)}</span>
                </div>
              </div>
            </div>

            <div className="xp-bar-container">
              <div 
                className="xp-bar-fill" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <div className="xp-summary-card" aria-label="Level progress summary">
              <div className="xp-summary-row">
                <span>Level progress</span>
                <strong>{Math.round(progressPercent)}%</strong>
              </div>
              <div className="xp-segment-track">
                <span className="xp-segment-fill" style={{ width: `${progressPercent}%` }}></span>
              </div>
              <div className="xp-dot-labels">
                <span>This level: {inLevelXP} / {levelSpanXP} XP</span>
                <span>Remaining: {remainingXP} XP</span>
              </div>
            </div>

                </>
              );
            })()}

            <div className="badges-section">
              <h4>My Badges ({profile.badges.length})</h4>
              {profile.badges.length > 0 ? (
                <div className="badges-grid">
                  {profile.badges.map(badge => (
                    <div key={badge.id} className="badge-item" title={badge.description}>
                      <div className="badge-icon">
                          {parseBadgeIcon(badge.icon)}
                      </div>
                      <div className="badge-name">{badge.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-badges">
                  <p>Complete tasks to earn badges!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="gamification-leaderboard">
            <h4>Top Alchemists</h4>
            <div className="leaderboard-list">
              {sortedLeaderboard.map((user, index) => {
                const safeDisplayName = buildSafeDisplayName(user);
                const fallbackAvatar = buildFallbackAvatar(safeDisplayName);
                const visibleRank = user?.rank || (index + 1);

                return (
                  <div key={user.user_id} className={`leaderboard-item ${index < 3 ? 'top-3' : ''}`}>
                    <div className="leaderboard-rank">#{visibleRank}</div>
                    <img
                      src={user.profile_image || fallbackAvatar}
                      alt={safeDisplayName}
                      className="leaderboard-avatar"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = fallbackAvatar;
                      }}
                    />
                    <div className="leaderboard-user-info">
                      <div className="leaderboard-name">{safeDisplayName}</div>
                      <div className="leaderboard-level">Lvl {user.level}</div>
                    </div>
                    <div className="leaderboard-xp">{user.total_xp || user.xp || 0} XP</div>
                  </div>
                );
              })}
              {sortedLeaderboard.length === 0 && (
                <div className="no-data">No data yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamificationPanel;
