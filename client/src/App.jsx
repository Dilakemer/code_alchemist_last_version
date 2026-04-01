import React, { useState, useEffect, useMemo } from 'react';
import ModelSelector from './components/ModelSelector';
import ChatInterface from './components/ChatInterface';
import HistoryList from './components/HistoryList';
import Notifications from './components/Notifications';
import UserProfileModal from './components/UserProfileModal';
import CommunityList from './components/CommunityList';
import AuthModal from './components/AuthModal';
import CommunityFeed from './components/CommunityFeed';
import CommunityPostDetail from './components/CommunityPostDetail';
import ProfileSection from './components/ProfileSection';
import SnippetManager from './components/SnippetManager';
import ModelCompare from './components/ModelCompare';
import FollowingFeed from './components/FollowingFeed';
import StatusModal from './components/StatusModal';
import ExportButton from './components/ExportButton';
import CodeHealthDashboard from './components/CodeHealthDashboard';
import FeedbackModal from './components/FeedbackModal';
import OnboardingTour, { shouldShowOnboarding } from './components/OnboardingTour';
import ProjectManager from './components/ProjectManager';
import ProjectWorkspace from './components/ProjectWorkspace';
import LandingPage from './components/LandingPage';
import ModelCostDashboard from './components/ModelCostDashboard';
import GamificationPanel from './components/GamificationPanel';
import ThemeStore from './components/ThemeStore';
import WeeklyReport from './components/WeeklyReport';
import { requestNotificationPermission, isNotificationEnabled } from './utils/notifications';
import { API_BASE } from './config';
import { useCollabSocket } from './hooks/useCollabSocket';

function App() {
  const [model, setModel] = useState('auto');
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [favoritesList, setFavoritesList] = useState([]);
  const [communityItems, setCommunityItems] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [preLinkedRepo, setPreLinkedRepo] = useState(null);
  const [preLinkedBranch, setPreLinkedBranch] = useState('main');
  const [showArchData, setShowArchData] = useState(false);
  const [showCodeHealth, setShowCodeHealth] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackHistoryId, setFeedbackHistoryId] = useState(null);
  const [showGamificationData, setShowGamificationData] = useState(false);
  const [gamificationToasts, setGamificationToasts] = useState([]);
  const [showThemeStore, setShowThemeStore] = useState(false);
  const [collabToken, setCollabToken] = useState(null);
  const [isCollabView, setIsCollabView] = useState(false);
  const [collabOwner, setCollabOwner] = useState(null);
  const [collabReview, setCollabReview] = useState({ status: 'open', updated_by: null, updated_at: null, comments: [] });
  const [collabReviewLoading, setCollabReviewLoading] = useState(false);
  const [collabReviewComment, setCollabReviewComment] = useState('');
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [weeklyReportData, setWeeklyReportData] = useState(null);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [collabShareLink, setCollabShareLink] = useState('');
  const [showCollabShareOptions, setShowCollabShareOptions] = useState(false);
  const [usageInfo, setUsageInfo] = useState(null);

  // Community State
  const [activeCommunityPost, setActiveCommunityPost] = useState(null);
  const [highlightAnswerId, setHighlightAnswerId] = useState(null);
  const [postSource, setPostSource] = useState(null); // 'community' veya 'following' - geri dönüş için

  const [chatHistory, setChatHistory] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('codebrain_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('codebrain_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [showCommunityFeed, setShowCommunityFeed] = useState(false);
  const [activeTab, setActiveTab] = useState('conversations'); // 'conversations' or 'community'

  // Status Modal State
  const [statusMessage, setStatusMessage] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const handleShowAlert = (msg) => {
    setStatusMessage(msg);
    setIsStatusModalOpen(true);
  };


  // Share State
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [shareSolution, setShareSolution] = useState('');
  const [shareImage, setShareImage] = useState(null);
  const shareFileInputRef = React.useRef(null);

  // Theme State
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('codebrain_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Snippet State
  const [showSnippets, setShowSnippets] = useState(false);

  // New Conversation Animation State
  const [isNewConversation, setIsNewConversation] = useState(false);

  // Model Compare State
  const [showModelCompare, setShowModelCompare] = useState(false);

  // Multi-Model State
  const [isMultiModel, setIsMultiModel] = useState(false);
  const [showCostDashboard, setShowCostDashboard] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(() => {
    // Show landing page for unauthenticated users every session
    return !localStorage.getItem('codebrain_user');
  });
  const [multiModels, setMultiModels] = useState(['gemini-2.5-flash', 'gpt-4o']);

  // Notification Dropdown State
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  // Mobile Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Following Feed Modal State
  const [showFollowingFeedModal, setShowFollowingFeedModal] = useState(false);

  // User Profile Modal State
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [viewingUserId, setViewingUserId] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState(null);
  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  // Projects
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [projects, setProjects] = useState([]);
    const [projectConversations, setProjectConversations] = useState({}); // { [projectId]: [convs] }
    const [expandedProjects, setExpandedProjects] = useState(new Set());

  // Request notification permission when user logs in
  // Request notification permission when user logs in
  useEffect(() => {
    if (user) {
      requestNotificationPermission().then(granted => {
        setNotificationsEnabled(granted);
      });
    }

    // Ensure DB tables exist
    fetch(`${API_BASE}/api/debug/init-db`, { method: 'POST' })
      .catch(err => console.error('DB Init Error:', err));

    // Check for collaboration token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('collab');
    if (tokenParam) {
      loadSharedSession(tokenParam);
    }
  }, [user]);

  // ---- Live Sync Collaboration (Socket.io) ----
  const collabUserName = user?.display_name || 'Guest';

  const handleCollabHistoryRefresh = () => {
    // Socket'ten stream_done sinyali gelince chat history'yi yenile
    if (collabToken) {
      fetch(`${API_BASE}/api/collaboration/session/${collabToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.history) setChatHistory(data.history);
        })
        .catch(err => console.error('Collab history refresh error:', err));
    }
  };

  const {
    connected: socketConnected,
    transportMode,
    liveStreamText,
    isStreaming: socketIsStreaming,
    streamingHistoryId,
    lastQuestion: socketLastQuestion,
    activeUsers: socketActiveUsers,
  } = useCollabSocket(
    isCollabView ? collabToken : null,
    collabUserName,
    handleCollabHistoryRefresh
  );

  // Optimistically add incoming collab questions to the chat history
  useEffect(() => {
    if (socketLastQuestion && isCollabView) {
      setChatHistory(prev => {
        // If it already exists, do nothing
        if (prev.some(h => h.id === socketLastQuestion.historyId)) return prev;
        
        // Push the new question to the UI immediately
        return [...prev, {
          id: socketLastQuestion.historyId,
          user_question: socketLastQuestion.question,
          ai_response: '',
          selected_model: 'Live Sync Session',
          timestamp: new Date(socketLastQuestion.timestamp).toISOString(),
          collab_sender: socketLastQuestion.sender
        }];
      });
    }
  }, [socketLastQuestion, isCollabView]);

  useEffect(() => {
    if (token) {
      fetchUsageLimits();
    } else {
      setUsageInfo(null);
    }
  }, [token]);

  const loadSharedSession = async (token) => {
    try {
      const resp = await fetch(`${API_BASE}/api/collaboration/session/${token}`);
      if (!resp.ok) throw new Error('Paylaşım linki geçersiz');
      const data = await resp.json();
      setChatHistory(data.history);
      setCollabToken(token);
      setIsCollabView(true);
      setCollabOwner(data.owner_display_name);
      setActiveConversationId(data.conversation_id);
      fetchCollabReview(token);
      handleShowAlert(`Paylaşılan oturuma katıldınız: ${data.owner_display_name}`);
    } catch (err) {
      handleShowAlert(err.message);
    }
  };

  const fetchUsageLimits = async () => {
    if (!token) {
      setUsageInfo(null);
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/billing/usage`, { headers: authHeaders });
      if (!resp.ok) return;
      const data = await resp.json();
      setUsageInfo(data);
    } catch (err) {
      console.error('Billing usage fetch error:', err);
    }
  };

  const switchSubscriptionPlan = async (plan) => {
    if (!token) {
      setAuthOpen(true);
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/billing/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ plan })
      });
      const data = await resp.json();
      if (!resp.ok) {
        handleShowAlert(data.error || 'Plan güncellenemedi');
        return;
      }
      setUsageInfo(data);
      handleShowAlert(data.message || `Plan ${plan} olarak güncellendi.`);
    } catch (err) {
      handleShowAlert(`Plan güncelleme hatası: ${err.message}`);
    }
  };

  const fetchCollabReview = async (tokenValue = collabToken) => {
    if (!tokenValue) return;
    setCollabReviewLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/collaboration/session/${tokenValue}/review`);
      if (!resp.ok) return;
      const data = await resp.json();
      setCollabReview(data);
    } catch (err) {
      console.error('Collab review fetch error:', err);
    } finally {
      setCollabReviewLoading(false);
    }
  };

  const submitCollabReviewComment = async () => {
    if (!collabToken || !collabReviewComment.trim()) return;
    try {
      const payload = {
        comment: collabReviewComment.trim(),
        guest_name: user?.display_name || 'Guest Reviewer'
      };
      const resp = await fetch(`${API_BASE}/api/collaboration/session/${collabToken}/review/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? authHeaders : {}) },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) {
        handleShowAlert(data.error || 'Yorum gönderilemedi');
        return;
      }
      setCollabReviewComment('');
      fetchCollabReview(collabToken);
    } catch (err) {
      handleShowAlert(`Yorum hatası: ${err.message}`);
    }
  };

  const updateCollabReviewStatus = async (status) => {
    if (!collabToken) return;
    try {
      const payload = {
        status,
        guest_name: user?.display_name || 'Guest Reviewer'
      };
      const resp = await fetch(`${API_BASE}/api/collaboration/session/${collabToken}/review/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? authHeaders : {}) },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) {
        handleShowAlert(data.error || 'Review durumu güncellenemedi');
        return;
      }
      fetchCollabReview(collabToken);
    } catch (err) {
      handleShowAlert(`Review durum hatası: ${err.message}`);
    }
  };

  const fetchWeeklyReport = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/stats/weekly`, { headers: authHeaders });
      if (resp.ok) {
        const data = await resp.json();
        setWeeklyReportData(data);
        setShowWeeklyReport(true);
      } else {
        handleShowAlert('Rapor verileri alınamadı.');
      }
    } catch (err) {
      handleShowAlert('Hata: ' + err.message);
    }
  };

  const handleShareSession = async () => {
    if (!activeConversationId) {
      handleShowAlert('Önce bir sohbet seçmelisiniz.');
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/collaboration/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ conversation_id: activeConversationId })
      });
      const data = await resp.json();
      if (data.share_token) {
        const url = `${window.location.origin}${window.location.pathname}?collab=${data.share_token}`;
        setCollabShareLink(url);
        setShowCollabShareOptions(true);
        try {
          await navigator.clipboard.writeText(url);
          handleShowAlert('Paylaşım linki hazır ve panoya kopyalandı.');
        } catch {
          handleShowAlert('Paylaşım linki hazır. Kopyala butonunu kullanabilirsiniz.');
        }
      } else {
        handleShowAlert(data.error || 'Link oluşturulamadı');
      }
    } catch (err) {
      handleShowAlert('Paylaşım hatası: ' + err.message);
    }
  };

  const handleProfileOpen = (userId) => {
    if (showUserProfile) {
      // If already open, push current user to history
      setUserHistory(prev => [...prev, viewingUserId]);
      setViewingUserId(userId);
    } else {
      // Opening fresh
      setUserHistory([]);
      setViewingUserId(userId);
      setShowUserProfile(true);
    }
  };

  const handleProfileBack = () => {
    if (userHistory.length === 0) return;
    const previousUserId = userHistory[userHistory.length - 1];
    const newHistory = userHistory.slice(0, -1);
    setUserHistory(newHistory);
    setViewingUserId(previousUserId);
  };

  const handleProfileClose = () => {
    setShowUserProfile(false);
    setViewingUserId(null);
    setUserHistory([]);
  };

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('codebrain_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Search function
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = [];

    // Search in conversations
    conversations.forEach(conv => {
      if (conv.title?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'conversation', ...conv });
      }
    });

    // Search in chat history
    chatHistory.forEach(item => {
      if (item.user_question?.toLowerCase().includes(lowerQuery) ||
        item.ai_response?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'chat', ...item });
      }
    });

    // Search in community items
    communityItems.forEach(item => {
      if (item.user_question?.toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'community', ...item });
      }
    });

    setSearchResults(results.slice(0, 10));
    setShowSearchResults(true);
  };

  // Export chat as Markdown
  const exportChatAsMarkdown = () => {
    if (chatHistory.length === 0) {
      alert('No chat to export.');
      return;
    }

    let markdown = `# Chat - ${new Date().toLocaleDateString('en-US')}\n\n`;

    chatHistory.forEach((turn, idx) => {
      markdown += `## Question ${idx + 1}\n\n`;
      markdown += `**User:** ${turn.user_question}\n\n`;
      if (turn.code_snippet) {
        markdown += `**Code:**\n\`\`\`\n${turn.code_snippet}\n\`\`\`\n\n`;
      }
      markdown += `**${turn.selected_model || 'AI'}:** ${turn.ai_response}\n\n`;
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Bu projeyi ve ona ait tüm sohbetleri silmek istediğinizden emin misiniz?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        if (activeProject?.id === projectId) setActiveProject(null);
        fetchProjects();
      }
    } catch (e) {
      console.error('Project delete error:', e);
    }
  };

  const authHeaders = useMemo(() =>
    token ? { 'Authorization': `Bearer ${token}` } : {}
    , [token]);

  useEffect(() => {
    const bootstrap = async () => {
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const json = await res.json();
            setUser(json.user);
            localStorage.setItem('codebrain_user', JSON.stringify(json.user));
          } else {
            console.warn("Token invalid, logging out");
            setToken(null);
            setUser(null);
            localStorage.removeItem('codebrain_token');
            localStorage.removeItem('codebrain_user');
          }
        } catch (e) {
          console.error("Auth check failed", e);
        }
      }
      fetchConversations();
      fetchCommunityItems();
    };
    bootstrap();
  }, []); // Run once on mount

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (token) {
      fetchConversations();
      fetchNotifications(); // Initial fetch
      fetchProjects();
    }
  }, [token]);

  const refreshUserInfo = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setUser(json.user);
        localStorage.setItem('codebrain_user', JSON.stringify(json.user));
      }
    } catch (err) {
      console.error("Failed to refresh user info", err);
    }
  };

  const fetchProjects = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error('Projects fetch error:', e);
    }
  };

    const fetchProjectConversations = async (projectId) => {
      try {
        const res = await fetch(`${API_BASE}/api/conversations?project_id=${projectId}`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setProjectConversations(prev => ({ ...prev, [projectId]: data.conversations || [] }));
        }
      } catch (e) {
        console.error('Project conversations fetch error:', e);
      }
    };

    const toggleProjectExpanded = (projectId) => {
      setExpandedProjects(prev => {
        const next = new Set(prev);
        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
          fetchProjectConversations(projectId);
        }
        return next;
      });
    };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Bildirim hatası:", err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, { headers: authHeaders });
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  const fetchArchivedConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/conversations/archived`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setArchivedConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching archived conversations:', err);
    }
  };

  const fetchFavorites = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setFavoritesList(data);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  };

  const fetchCommunityItems = async () => {
    try {
      // Sidebar listesi için hala genel history veya feed kullanılabilir
      const res = await fetch(`${API_BASE}/api/community/feed`);
      const data = await res.json();
      setCommunityItems(data.feed || []);
    } catch (err) {
      console.error("Failed to fetch community items", err);
    }
  };

  const fetchConversationDetails = async (id) => {
    if (!id) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setCurrentlySpeakingId(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${id}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data.history || []);
        setActiveConversationId(id);
        setActiveTab('conversations');
      } else {
        console.error("Fetch failed:", res.status, res.statusText);
      }
    } catch (err) {
      console.error("Failed to fetch conversation details", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCommunitySelect = (item) => {
    setActiveCommunityPost(item);
    setActiveTab('community');
  };

  const handleNewChat = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setCurrentlySpeakingId(null);
    setActiveConversationId(null);
    setChatHistory([]);
    setQuestion('');
    setCode('');
    setImage(null);
    setActiveTab('conversations');
    // Trigger new conversation animation
    setIsNewConversation(true);
    setTimeout(() => setIsNewConversation(false), 600);
  };

  const handleDeleteConversation = async (id) => {
    try {
      await fetch(`${API_BASE}/api/conversations/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      fetchConversations();
      if (activeConversationId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareTitle.trim()) return;

    // Kullanıcı giriş kontrolü
    if (!user || !token) {
      setShareOpen(false);
      handleShowAlert("Paylaşım yapmak için giriş yapınız");
      setAuthOpen(true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', shareTitle);
      formData.append('code', shareCode);
      formData.append('solution', shareSolution);
      if (shareImage) {
        formData.append('image', shareImage);
      }

      const headers = { ...authHeaders };
      delete headers['Content-Type'];

      const res = await fetch(`${API_BASE}/api/community/posts`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (res.ok) {
        setShareOpen(false);
        setShareTitle('');
        setShareCode('');
        setShareSolution('');
        setShareImage(null);
        if (shareFileInputRef.current) shareFileInputRef.current.value = '';
        fetchCommunityItems();
        handleShowAlert("Toplulukla başarıyla paylaşıldı!");
      } else {
        const data = await res.json();
        handleShowAlert(data.error || "Bir hata oluştu");
      }
    } catch (err) {
      console.error(err);
      handleShowAlert("Bir hata oluştu");
    }
  };

  const estimateAutoRoutingMetadata = (questionText = '', codeText = '') => {
    const combined = `${questionText || ''}\n${codeText || ''}`.toLowerCase();

    const pyPattern = /\b(def\s+\w+\(|import\s+\w+|from\s+\w+\s+import|elif\b|__name__\s*==\s*['"]__main__['"]|python)\b/;
    const jsTsPattern = /\b(function\s+\w+\(|const\s+\w+\s*=|let\s+\w+\s*=|=>|console\.log\(|typescript|javascript|react)\b/;
    const javaPattern = /\b(public\s+class|private\s+\w+|System\.out\.println\(|implements\b|extends\b)\b/;
    const sqlPattern = /\b(select\s+.+\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from|where\b|join\b)\b/;
    const bashPattern = /\b(echo|grep|awk|sed|chmod|bash|shell)\b/;

    let detectedLanguage = 'general';
    if (pyPattern.test(combined)) detectedLanguage = 'python';
    else if (jsTsPattern.test(combined)) detectedLanguage = 'javascript';
    else if (javaPattern.test(combined)) detectedLanguage = 'java';
    else if (sqlPattern.test(combined)) detectedLanguage = 'sql';
    else if (bashPattern.test(combined)) detectedLanguage = 'bash';

    const detectedIntent = /\b(error|traceback|hata|debug|fix|duzelt|düzelt)\b/.test(combined)
      ? 'debug'
      : /\b(explain|neden|nasil|nasıl|anlat)\b/.test(combined)
        ? 'explain'
        : /\b(architecture|mimari|design|tasarla|refactor)\b/.test(combined)
          ? 'architecture'
          : detectedLanguage !== 'general'
            ? 'code'
            : 'general';

    let selectedModel = 'gemini-2.5-flash-lite';
    if (detectedLanguage === 'python' || detectedLanguage === 'java' || detectedLanguage === 'sql') {
      selectedModel = 'gpt-4o';
    } else if (detectedLanguage === 'javascript') {
      selectedModel = detectedIntent === 'architecture' ? 'claude-opus-4-5' : 'gpt-4o';
    } else if (detectedLanguage === 'bash') {
      selectedModel = 'gemini-2.5-flash-lite';
    }

    const routingReason =
      `🔍 **Detected Language**: \`${detectedLanguage}\` | 🤖 **Responding Model**: \`${selectedModel}\`\n\n` +
      `_Fallback route produced on client because stream metadata was unavailable._`;

    return { detectedLanguage, detectedIntent, selectedModel, routingReason };
  };

  async function handleAsk(opts = {}) {
    const effectiveQuestion = opts.question !== undefined ? opts.question : question;
    const effectiveConversationId = opts.conversationId !== undefined ? opts.conversationId : activeConversationId;
    
    // Collaboration redirect — Live Socket yolu
    if (isCollabView && collabToken) {
      if (!effectiveQuestion.trim()) return;
      setLoading(true);
      try {
        const resp = await fetch(`${API_BASE}/api/collaboration/session/${collabToken}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: effectiveQuestion,
            model: model,
            sender_name: user?.display_name || 'Guest'
          })
        });
        if (resp.ok) {
          setQuestion('');
          setCode('');
          setImage(null);
          // Geçmişi YENILEME — Socket'ten stream_done sinyali gelince otomatik yenilenir
        } else {
          const derr = await resp.json().catch(() => ({}));
          handleShowAlert(derr.error || 'Mesaj gönderilemedi');
        }
      } catch (e) {
        handleShowAlert('Hata: ' + e.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!effectiveQuestion.trim() && !image) return;

    // Project can come from selected workspace OR an already-open project conversation.
    const convProjectId = effectiveConversationId
      ? conversations.find(c => c.id === effectiveConversationId)?.project_id
      : null;
    const mappedProjectId = !convProjectId && effectiveConversationId
      ? Number(Object.keys(projectConversations).find((pid) =>
        (projectConversations[pid] || []).some(c => c.id === effectiveConversationId)
      )) || null
      : null;
    const semanticProjectId = activeProject?.id || convProjectId || mappedProjectId || null;

    // 1. Optimistic UI Update
    const tempId = Date.now();
    const newHistoryItem = {
      id: tempId,
      user_question: effectiveQuestion,
      ai_response: '',
      // Store full ISO so UI can render only the date (no time)
      timestamp: new Date().toISOString(),
      image_url: image ? URL.createObjectURL(image) : null,
      code_snippet: code,
      selected_model: isMultiModel ? 'Multi-Model Blend' : model,
      semantic_context: null,
      semantic_context_loading: false
    };

    setChatHistory(prev => [...prev, newHistoryItem]);

    // Fetch semantic hits in parallel for project chats to make context selection transparent in UI.
    if (semanticProjectId && token && effectiveQuestion.trim()) {
      setChatHistory(prev => prev.map(item =>
        item.id === tempId ? { ...item, semantic_context_loading: true } : item
      ));

      fetch(`${API_BASE}/api/projects/${semanticProjectId}/semantic_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ query: effectiveQuestion, top_k: 5 })
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `Status ${res.status}`);

          const hits = Array.isArray(data?.hits) ? data.hits : [];
          return {
            enabled: true,
            query_model: data?.query_model || null,
            total_chunks: data?.total_chunks ?? null,
            hits,
            message: data?.message || null
          };
        })
        .then((semanticContext) => {
          setChatHistory(prev => prev.map(item =>
            item.id === tempId ? { ...item, semantic_context: semanticContext, semantic_context_loading: false } : item
          ));
        })
        .catch((err) => {
          console.warn('Semantic preview fetch failed:', err);
          setChatHistory(prev => prev.map(item =>
            item.id === tempId
              ? {
                ...item,
                semantic_context_loading: false,
                semantic_context: {
                  enabled: false,
                  hits: [],
                  message: 'Context hits could not be fetched for this turn.'
                }
              }
              : item
          ));
        });
    }

    const startTime = Date.now();
    let firstChunkTime = null;

    // Reset inputs immediately
    const currentQuestion = effectiveQuestion;
    const currentCode = code;
    const currentImage = image;
    const currentModel = model;
    const currentModels = multiModels;
    const isBlendMode = isMultiModel;
    const autoRoutingFallback = currentModel === 'auto'
      ? estimateAutoRoutingMetadata(currentQuestion, currentCode)
      : null;

    setQuestion('');
    setCode('');
    setImage(null);
    setLoading(true);

    try {
      let endpoint = isBlendMode ? `${API_BASE}/api/blend` : `${API_BASE}/api/ask`;
      let body;
      let headers = { ...authHeaders };

      if (currentImage && !isBlendMode) {
        const formData = new FormData();
        formData.append('question', currentQuestion);
        formData.append('code', currentCode);
        formData.append('model', currentModel);
        if (effectiveConversationId) formData.append('conversation_id', effectiveConversationId);

        // Add repo/branch if this is the first message
        if (!effectiveConversationId && preLinkedRepo) {
          formData.append('repo', preLinkedRepo);
          formData.append('branch', preLinkedBranch);
        }

        formData.append('image', currentImage);
        body = formData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          question: currentQuestion,
          code: currentCode,
          model: currentModel,
          models: currentModels, // For blend mode
          conversation_id: effectiveConversationId,
          repo: !effectiveConversationId ? preLinkedRepo : null,
          branch: !effectiveConversationId ? preLinkedBranch : 'main'
        });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: body
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const errMsg = errPayload.error || res.statusText || 'Request failed';
        if (res.status === 429 && errPayload.upgrade_required) {
          handleShowAlert(`${errMsg} Daha fazla limit için Premium plana geçebilirsin.`);
        } else {
          handleShowAlert(errMsg);
        }
        throw new Error(errMsg);
      }

      // 2. Setup Streaming Reader
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseAccumulator = "";
      let buffer = "";
      let receivedDoneEvent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n\n');

        // Keep the last part in buffer if it's not empty (incomplete event)
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);

              // Standard Stream & Blend Stream
              if (data.chunk) {
                if (!firstChunkTime) firstChunkTime = Date.now();
                aiResponseAccumulator += data.chunk;
                setChatHistory(prev => prev.map(item =>
                  item.id === tempId ? { ...item, ai_response: aiResponseAccumulator } : item
                ));
              }

              // Early routing metadata (can arrive before done)
              if (data.routing_reason || data.selected_model || data.detected_language || data.detected_intent) {
                setChatHistory(prev => prev.map(item =>
                  item.id === tempId
                    ? {
                      ...item,
                      routing_reason: data.routing_reason || item.routing_reason,
                      selected_model: data.selected_model || item.selected_model,
                      detected_language: data.detected_language || item.detected_language,
                      detected_intent: data.detected_intent || item.detected_intent,
                    }
                    : item
                ));
              }

              // Blend Status Updates
              if (data.status && isBlendMode) {
                if (data.status === 'fetching') {
                  setChatHistory(prev => prev.map(item =>
                    item.id === tempId ? { ...item, ai_response: '🔄 Querying models...' } : item
                  ));
                } else if (data.status === 'progress') {
                  setChatHistory(prev => prev.map(item =>
                    item.id === tempId ? { ...item, ai_response: `🔄 Querying models... (${data.completed}/${data.total})\n✅ ${data.model} responded.` } : item
                  ));
                } else if (data.status === 'blending') {
                  setChatHistory(prev => prev.map(item =>
                    item.id === tempId ? { ...item, ai_response: '⚗️ Blending responses...' } : item
                  ));
                  // Reset accumulator for actual content
                  aiResponseAccumulator = "";
                }
              }


              if (data.done) {
                receivedDoneEvent = true;
                if (data.conversation_id && effectiveConversationId !== data.conversation_id) {
                  setActiveConversationId(data.conversation_id);
                  setPreLinkedRepo(null); // Clear after linked to a real conv
                  fetchConversations();
                }

                // For blend mode, use blended_response if available (though it was streamed via chunks too)
                const finalResponse = data.blended_response || aiResponseAccumulator;

                // Calculate durations
                const endTime = Date.now();
                const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
                const ttf = (firstChunkTime ? ((firstChunkTime - startTime) / 1000).toFixed(2) : null);

                // Update with real DB ID and metadata
                setChatHistory(prev => prev.map(item =>
                  item.id === tempId ? {
                    ...item,
                    id: data.history_id || tempId,
                    conversation_id: data.conversation_id,
                    summary: data.summary,
                    ai_response: finalResponse,
                    routing_reason: data.routing_reason,
                    detected_language: data.detected_language || item.detected_language,
                    detected_intent: data.detected_intent || item.detected_intent,
                    persona: data.persona,
                    responseTime: totalDuration,
                    timeToFirstToken: ttf
                  } : item
                ));

                // Voice Alchemy is manually triggered now via ChatInterface
              }
            } catch (e) {
              console.error("Error parsing SSE JSON", e);
            }
          }
        }
      }

      // Stream may end without an explicit done event; finalize timing/metadata defensively.
      if (!receivedDoneEvent) {
        const endTime = Date.now();
        const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
        const ttf = (firstChunkTime ? ((firstChunkTime - startTime) / 1000).toFixed(2) : null);

        setChatHistory(prev => prev.map(item =>
          item.id === tempId
            ? {
              ...item,
              ai_response: item.ai_response || '[Warning: stream ended before completion.]',
              responseTime: item.responseTime || totalDuration,
              timeToFirstToken: item.timeToFirstToken || ttf,
              routing_reason:
                item.routing_reason
                || (autoRoutingFallback?.routingReason)
                || `🧭 **Responding Model**: \`${currentModel}\` (manual selection)`,
              selected_model: item.selected_model || autoRoutingFallback?.selectedModel || currentModel,
              detected_language: item.detected_language || autoRoutingFallback?.detectedLanguage,
              detected_intent: item.detected_intent || autoRoutingFallback?.detectedIntent,
            }
            : item
        ));
      }

      // After streaming is complete, sync gamification silently
      if (token && user) {
        fetch(`${API_BASE}/api/gamification/sync`, { headers: { ...authHeaders } })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.events && data.events.length > 0) {
              const newToasts = data.events.map(ev => ({ id: Date.now() + Math.random(), ...ev }));
              setGamificationToasts(prev => [...prev, ...newToasts]);
              setTimeout(() => {
                setGamificationToasts(prev => prev.filter(t => !newToasts.includes(t)));
              }, 5000);
            }
          })
          .catch(e => console.error("Error syncing gamification", e));

        fetchUsageLimits();
      }

    } catch (error) {
      console.error("Error:", error);
      const endTime = Date.now();
      const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
      const ttf = (firstChunkTime ? ((firstChunkTime - startTime) / 1000).toFixed(2) : null);
      setChatHistory(prev => prev.map(item =>
        item.id === tempId
          ? {
            ...item,
            ai_response: item.ai_response
              ? `${item.ai_response}\n\n[Warning: stream interrupted before final metadata.]`
              : "[An error occurred. Please try again.]",
            responseTime: item.responseTime || totalDuration,
            timeToFirstToken: item.timeToFirstToken || ttf,
            routing_reason:
              item.routing_reason
              || autoRoutingFallback?.routingReason
              || `🧭 **Responding Model**: \`${currentModel}\` (manual selection)`,
            selected_model:
              item.selected_model
              || autoRoutingFallback?.selectedModel
              || currentModel,
            detected_language:
              item.detected_language
              || autoRoutingFallback?.detectedLanguage,
            detected_intent:
              item.detected_intent
              || autoRoutingFallback?.detectedIntent,
          }
          : item
      ));
    } finally {
      setLoading(false);
      if (token) fetchUsageLimits();
    }
  };

  const speakResponse = (text, messageId) => {
    if (!('speechSynthesis' in window)) return;

    if (currentlySpeakingId === messageId) {
      // Toggle OFF if clicking the same message
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      return;
    }

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    // Clean markdown for better speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [Code Block] ') // Don't read whole code blocks
      .replace(/[*#_~`]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, ' [Link] ');

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Prevent garbage collection bug in Chrome which causes playback to stop or fail
    window.__currentUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    const isTurkish = /[çğışüöÇĞİŞÜÖ]/.test(cleanText);
    utterance.lang = isTurkish ? 'tr-TR' : 'en-US';
    const langPrefix = isTurkish ? 'tr' : 'en';

    let hasPlayed = false;

    const playSpeech = () => {
      if (hasPlayed) return;
      hasPlayed = true;

      const currentVoices = window.speechSynthesis.getVoices();
      const preferredVoice = currentVoices.find(v => v.lang.startsWith(langPrefix) && (v.name.includes('Google') || v.name.includes('Natural'))) || currentVoices.find(v => v.lang.startsWith(langPrefix)) || currentVoices[0];

      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.pitch = 1.0;
      utterance.rate = 1.05; // Slightly faster for a more modern feel

      utterance.onend = () => {
        setCurrentlySpeakingId(null);
        window.__currentUtterance = null;
      };

      utterance.onerror = (e) => {
        console.error("Speech synthesis failed.", e);
        setCurrentlySpeakingId(null);
        window.__currentUtterance = null;
      };

      setCurrentlySpeakingId(messageId);

      // Chrome requires resume if it's in a weird paused state
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    };

    if (voices.length === 0) {
      const voicesChangedHandler = () => {
        playSpeech();
        window.speechSynthesis.removeEventListener('voiceschanged', voicesChangedHandler);
      };
      window.speechSynthesis.addEventListener('voiceschanged', voicesChangedHandler);

      // Timeout fallback in case event doesn't fire
      setTimeout(playSpeech, 500);
    } else {
      // Small timeout to allow previous cancel action to propagate properly
      setTimeout(playSpeech, 50);
    }
  };

  const handleAuthSuccess = (data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('codebrain_token', data.token);
    localStorage.setItem('codebrain_user', JSON.stringify(data.user));
    setAuthOpen(false);
    // Clear previous chat and start fresh for new user
    setChatHistory([]);
    setActiveConversationId(null);
    setQuestion('');
    setCode('');
    setImage(null);
    fetchConversations();
    // Show onboarding for new registrations
    if (shouldShowOnboarding()) setShowOnboarding(true);
  };

  const handleLogout = async () => {
    try {
      // Reset theme on backend before logout
      if (token) {
        const defaultTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        await fetch(`${API_BASE}/api/themes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'set_active', theme: defaultTheme })
        }).catch(() => {}); // Ignore errors
      }
    } finally {
      // Clear frontend state
      setToken(null);
      setUser(null);
      localStorage.removeItem('codebrain_token');
      localStorage.removeItem('codebrain_user');
      localStorage.removeItem('codebrain_theme');
      // Hard reset theme
      const defaultTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      setTheme(defaultTheme);
      document.documentElement.setAttribute('data-theme', defaultTheme);
      setConversations([]);
      setShowThemeStore(false); // Close theme store modal
      handleNewChat();
    }
  };

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans selection:bg-fuchsia-500/30 overflow-hidden">

      {/* Onboarding Tour (first visit) */}
      {showOnboarding && (
        <OnboardingTour onComplete={() => setShowOnboarding(false)} />
      )}

      {/* Project Manager Modal */}
      {showProjectManager && (
        <ProjectManager
          apiBase={API_BASE}
          authHeaders={token ? { Authorization: `Bearer ${token}` } : {}}
          onSelectProject={(project) => {
            setActiveProject(project);
            fetchProjects(); // Refresh sidebar list
          }}
          activeProjectId={activeProject?.id}
          onClose={() => {
            setShowProjectManager(false);
            fetchProjects(); // Refresh if created/deleted
          }}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`bg-gray-900/50 border-r border-gray-800 flex flex-col backdrop-blur-xl mobile-sidebar transition-all duration-300 overflow-hidden ${sidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'w-0 border-none opacity-0' : 'w-80 opacity-100'}`}>
        <div className="p-5 border-b border-gray-800 relative group/sidebar">
          <div className="flex items-center gap-4 px-2">
            {/* Logo */}
            <div className="relative group/logo">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full blur opacity-25 group-hover/logo:opacity-50 transition duration-1000 group-hover/logo:duration-200"></div>
              <img
                src="/code_alchemist_logo.png"
                alt="CodeAlchemist logo"
                className="relative h-14 w-auto object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.4)] transition-transform duration-500 group-hover/logo:scale-110"
                onError={(e) => { e.currentTarget.src = '/alchemy_wave.png'; }}
              />
            </div>

            {/* Brand text */}
            <div className="flex flex-col justify-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent tracking-tight leading-none">
                CodeAlchemist
              </h1>
              <p className="text-[9px] text-gray-500 font-semibold tracking-[0.2em] uppercase mt-1 leading-none">
                AI Alchemy Engine
              </p>
            </div>
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="absolute top-1/2 -right-2 -translate-y-1/2 w-6 h-12 bg-gray-800 border border-gray-700 rounded-l-lg items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all z-20 hidden md:flex opacity-0 group-hover/sidebar:opacity-100"
            title="Collapse Sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {/* Tabs */}
          <div className="flex p-2 gap-1 bg-gray-900/80 mx-2 mt-2 rounded-lg flex-wrap">
            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'conversations'
                ? 'bg-gray-800 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              💬 Chat
            </button>
            {user && (
              <button
                onClick={() => {
                  setActiveTab('archived');
                  fetchArchivedConversations();
                }}
                className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'archived'
                  ? 'bg-gray-800 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                📦 Archive
              </button>
            )}
            {user && (
              <button
                onClick={() => {
                  setActiveTab('favorites');
                  fetchFavorites();
                }}
                className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'favorites'
                  ? 'bg-gray-800 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                ⭐ Favorites
              </button>
            )}
          </div>

          <div className="mt-4">
            {activeTab === 'conversations' ? (
              <>
                <button
                  onClick={handleNewChat}
                  className="w-full mb-4 bg-gray-800/80 hover:bg-gray-700 text-white py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-600 hover:border-gray-500 group shadow-sm"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform text-fuchsia-400">+</span>
                  <span className="font-medium text-sm">Yeni Sohbet</span>
                </button>

                {/* Projects Sidebar Section (ChatGPT Style) */}
                {user && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between px-3 py-1 mb-2 group cursor-pointer hover:bg-gray-800/50 rounded-md transition-colors">
                      <span className="text-xs font-semibold text-gray-400 transition-colors">Projeler</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 group-hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>

                    <div className="space-y-0.5">
                      <button
                        onClick={() => setShowProjectManager(true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                        <span className="font-medium">Yeni proje</span>
                      </button>

                      {projects.map(p => {
                        const isExpanded = expandedProjects.has(p.id);
                        const pConvs = projectConversations[p.id] || [];
                        const projEmoji = p.name.toLowerCase().includes('web') ? '🌐' :
                          p.name.toLowerCase().includes('api') ? '🔌' :
                          p.name.toLowerCase().includes('refactor') ? '🛠️' :
                          p.name.toLowerCase().includes('debug') ? '🐛' : '📁';
                        return (
                          <div key={p.id} className="relative group/proj">
                            <div className={`flex items-center rounded-lg text-sm transition-colors ${activeProject?.id === p.id ? 'bg-gray-800' : 'hover:bg-gray-800/60'}`}>
                              <button
                                onClick={() => toggleProjectExpanded(p.id)}
                                className="pl-2 py-2.5 pr-1 text-gray-500 hover:text-gray-300 flex-shrink-0"
                                title={isExpanded ? 'Daralt' : 'Genişlet'}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </button>
                              <button
                                onClick={() => setActiveProject(activeProject?.id === p.id ? null : p)}
                                className={`flex-1 flex items-center gap-2 py-2.5 pr-2 truncate ${activeProject?.id === p.id ? 'text-white font-medium' : 'text-gray-300 hover:text-white'}`}
                              >
                                <span className="text-base flex-shrink-0">{projEmoji}</span>
                                <span className="truncate text-sm">{p.name}</span>
                                {activeProject?.id === p.id && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] flex-shrink-0 ml-auto"></span>
                                )}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                                className="p-1.5 mr-1 rounded-md text-gray-600 hover:text-red-400 opacity-0 group-hover/proj:opacity-100 transition-all hover:bg-gray-700/50 flex-shrink-0"
                                title="Projeyi Sil"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="ml-5 border-l border-gray-800 pl-2 mt-0.5 mb-1 space-y-0.5">
                                {pConvs.length === 0 ? (
                                  <p className="text-xs text-gray-600 py-1 px-2">Henüz sohbet yok</p>
                                ) : (
                                  pConvs.slice(0, 8).map(c => (
                                    <button
                                      key={c.id}
                                      onClick={() => { fetchConversationDetails(c.id); setActiveProject(null); }}
                                      className={`w-full text-left px-2 py-1.5 rounded-md text-xs truncate transition-colors ${activeConversationId === c.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                                    >
                                      {c.title || 'Sohbet'}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Chat History Title */}
                <div className="px-3 py-1 mt-6 mb-2">
                  <span className="text-xs font-semibold text-gray-400">Sohbetlerin</span>
                </div>

                <HistoryList
                  conversations={conversations}
                  activeId={activeConversationId}
                  onSelect={fetchConversationDetails}
                  onDelete={handleDeleteConversation}
                  onRename={fetchConversations}
                  onPin={fetchConversations}
                  onArchive={fetchConversations}
                  onShare={async (conv) => {
                    // Fetch conversation details to get full content
                    try {
                      const res = await fetch(`${API_BASE}/api/conversations/${conv.id}`, { headers: authHeaders });
                      if (res.ok) {
                        const data = await res.json();
                        const history = data.history || [];

                        // Generate summary from conversation history
                        let codeSnippets = [];
                        let aiResponses = [];
                        let userQuestions = [];

                        history.forEach((turn) => {
                          if (turn.user_question) userQuestions.push(turn.user_question);
                          if (turn.code_snippet) codeSnippets.push(turn.code_snippet);
                          if (turn.ai_response) aiResponses.push(turn.ai_response);
                        });

                        // Set title from conversation title or first question
                        setShareTitle(conv.title || userQuestions[0] || '');

                        // Set code from collected code snippets
                        setShareCode(codeSnippets.join('\n\n// ---\n\n'));

                        // Set solution from last AI response (most complete answer)
                        setShareSolution(aiResponses.length > 0 ? aiResponses[aiResponses.length - 1] : '');
                      } else {
                        // Fallback to just title
                        setShareTitle(conv.title || '');
                        setShareCode('');
                        setShareSolution('');
                      }
                    } catch (err) {
                      console.error('Failed to fetch conversation for share:', err);
                      setShareTitle(conv.title || '');
                      setShareCode('');
                      setShareSolution('');
                    }
                    setShareOpen(true);
                  }}
                  apiBase={API_BASE}
                  authHeaders={authHeaders}
                  onShowAlert={handleShowAlert}
                />
              </>
            ) : activeTab === 'archived' ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400 mb-3">📦 Archived Conversations</h3>
                {archivedConversations.length === 0 ? (
                  <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700 text-xs text-gray-400 text-center">
                    No archived conversations.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {archivedConversations.map((item) => (
                      <li
                        key={item.id}
                        className="cursor-pointer p-3 rounded-xl border-2 border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-all group"
                      >
                        <div className="text-gray-300 font-medium flex justify-between items-center gap-2">
                          <span className="truncate flex-1" onClick={() => fetchConversationDetails(item.id)}>
                            {item.title || 'New Conversation'}
                          </span>
                          <button
                            onClick={async () => {
                              try {
                                await fetch(`${API_BASE}/api/conversations/${item.id}/archive`, {
                                  method: 'PUT',
                                  headers: authHeaders
                                });
                                fetchConversations();
                                fetchArchivedConversations();
                              } catch (err) {
                                console.error("Unarchive error:", err);
                              }
                            }}
                            className="text-xs bg-fuchsia-600/20 hover:bg-fuchsia-600/40 text-fuchsia-300 px-2 py-1 rounded-md transition-colors"
                            title="Unarchive"
                          >
                            Restore
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{item.created_at}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : activeTab === 'favorites' ? (
              <div className="p-2 space-y-2">
                {favoritesList.length === 0 ? (
                  <div className="text-gray-500 text-xs text-center py-4">
                    No saved responses yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {favoritesList.map((item) => (
                      <li
                        key={item.id}
                        className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 hover:bg-gray-800 transition-colors group cursor-pointer"
                        onClick={() => {
                          // Favoriye tıklandığında sohbete gitme mantığı eklenebilir
                          // Şimdilik sadece detayları gösteriyoruz veya sohbeti yüklüyoruz
                          if (item.history_id) {
                            // Basit bir detay modalı veya sohbeti yükleme yapılabilir
                            // Burada doğrudan o sohbete gidip o mesajı bulmak karmaşık olabilir, 
                            // şimdilik sadece görsel liste olarak bırakıyorum
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-200 truncate mb-1">
                              {item.user_question}
                            </div>
                            <div className="text-xs text-gray-400 line-clamp-2 font-mono bg-black/20 p-1 rounded">
                              {item.ai_response?.substring(0, 100)}...
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/30">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-900/30 text-fuchsia-300 border border-fuchsia-500/20">
                              {item.model || 'AI'}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {(new Date(item.created_at)).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fetch(`${API_BASE}/api/favorites/${item.history_id}`, {
                                method: 'DELETE',
                                headers: authHeaders
                              }).then(() => {
                                setFavoritesList(prev => prev.filter(f => f.id !== item.id));
                                // Chat interface favori state güncellemesi için bir event yayabiliriz veya context kullanabiliriz
                                // Şimdilik basitçe listeden kaldırıyoruz
                              });
                            }}
                            className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              ) : null}
            </div>
          </div>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/80">
            {user ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  handleProfileOpen(user.id);
                }}
                className="flex items-center gap-3 hover:bg-gray-800/50 rounded-lg p-2 -m-2 transition-colors flex-1"
                title="View Profile"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-fuchsia-600 to-purple-600 flex items-center justify-center text-xs font-bold overflow-hidden border border-gray-700">
                  {user.profile_image ? (
                    <img src={user.profile_image.startsWith('http') ? user.profile_image : `${API_BASE}${user.profile_image}`} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    user.display_name[0].toUpperCase()
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-gray-200">{user.display_name}</span>
                  <span className="text-xs text-gray-500">Edit Profile</span>
                </div>
              </button>
              <button
                onClick={() => handleLogout()}
                className="text-gray-400 hover:text-red-400 transition-colors p-2"
                title="Logout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="w-full bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-300 py-2 rounded-lg text-sm font-medium transition-colors border border-fuchsia-500/30"
            >
              Sign In / Sign Up
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {activeProject ? (
          <ProjectWorkspace 
            project={activeProject}
            apiBase={API_BASE}
            authHeaders={authHeaders}
            onNewChat={(conv, initialMsg) => {
              setActiveConversationId(conv.id);
              setChatHistory([]);
              setActiveTab('conversations');
              setActiveProject(null);
              if (initialMsg) {
                handleAsk({ question: initialMsg, conversationId: conv.id });
              }
            }}
            onOpenChat={(chat) => {
              fetchConversationDetails(chat.id);
              setActiveProject(null);
            }}
            onDeleteChat={(chatId) => handleDeleteConversation(chatId)}
          model={model}
          setModel={setModel}
          />
        ) : (
          <>
            {/* Header */}
            <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/30 backdrop-blur-sm z-10 mobile-header">
          <div className="flex items-center gap-4">
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mobile-menu-btn w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Toggle Menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop Sidebar Toggle (shown when collapsed) */}
            {isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden md:flex w-10 h-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all z-20 transition-colors"
                title="Expand Sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            <span className="text-gray-400 text-sm">Model:</span>
            <ModelSelector
              model={model}
              setModel={setModel}
              isMultiModel={isMultiModel}
              setIsMultiModel={setIsMultiModel}
              multiModels={multiModels}
              setMultiModels={setMultiModels}
            />
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md mx-4 mobile-search">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              placeholder="Search..."
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (result.type === 'conversation') {
                        fetchConversationDetails(result.id);
                      } else if (result.type === 'community') {
                        setActiveCommunityPost(result);
                        setShowCommunityFeed(true);
                      }
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${result.type === 'conversation' ? 'bg-blue-900/50 text-blue-300' :
                        result.type === 'community' ? 'bg-purple-900/50 text-purple-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                        {result.type === 'conversation' ? 'Chat' :
                          result.type === 'community' ? 'Community' : 'Message'}
                      </span>
                      <span className="text-sm text-white truncate">
                        {result.title || result.user_question?.slice(0, 50)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            {user && (
              <div className="relative flex items-center">
                <button
                  onClick={() => {
                    setShowNotificationDropdown(!showNotificationDropdown);
                    fetchNotifications();
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-fuchsia-400 hover:bg-gray-800/50 transition-all relative"
                  title="Notifications"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                      {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className="absolute right-0 top-10 w-80 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
                    <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Notifications</h3>
                      <button
                        onClick={() => setShowNotificationDropdown(false)}
                        className="text-gray-500 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No notifications
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        {notifications.slice(0, 10).map((n) => (
                          <div key={n.id} className="relative group">
                            <button
                              onClick={() => {
                                // Mark as read
                                if (!n.is_read) {
                                  fetch(`${API_BASE}/api/notifications/read`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                                    body: JSON.stringify({ notification_id: n.id })
                                  }).then(() => {
                                    setNotifications(prev => prev.map(notif =>
                                      notif.id === n.id ? { ...notif, is_read: true } : notif
                                    ));
                                  });
                                }
                                // Navigate to post if applicable
                                if (n.history_id) {
                                  fetch(`${API_BASE}/api/community/posts/${n.history_id}`, { headers: authHeaders })
                                    .then(res => res.ok ? res.json() : null)
                                    .then(post => {
                                      if (post) {
                                        setActiveCommunityPost(post);
                                        setShowCommunityFeed(true);
                                      }
                                    });
                                } else if (n.type === 'follow' && n.related_user_id) {
                                  setViewingUserId(n.related_user_id);
                                  setShowUserProfile(true);
                                }
                                setShowNotificationDropdown(false);
                              }}
                              className={`w-full p-3 text-left hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 ${!n.is_read ? 'bg-fuchsia-900/20' : ''}`}
                            >
                              <div className="flex items-start gap-2 pr-6">
                                <span className="text-lg">
                                  {n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'follow' ? '👥' : '🔔'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{n.message}</p>
                                  <p className="text-[10px] text-gray-500 mt-1">{n.timestamp}</p>
                                </div>
                                {!n.is_read && (
                                  <span className="w-2 h-2 bg-fuchsia-500 rounded-full mt-1.5" />
                                )}
                              </div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetch(`${API_BASE}/api/notifications/delete`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                                  body: JSON.stringify({ notification_id: n.id })
                                }).then(() => {
                                  setNotifications(prev => prev.filter(notif => notif.id !== n.id));
                                });
                              }}
                              className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-500 bg-gray-900/50 hover:bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                              title="Bildirimi Sil"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-fuchsia-400 hover:bg-gray-800/50 transition-all"
              title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* Export Button - Hidden on mobile */}
            <div className="hidden sm:block">
              <ExportButton
                chatHistory={chatHistory}
                conversationTitle={conversations.find(c => c.id === activeConversationId)?.title || 'Chat Export'}
              />
            </div>

            <div className="hidden sm:block h-6 w-px bg-gray-700 mx-2"></div>

            <button
              onClick={() => {
                setShowToolsDrawer(true);
                refreshUserInfo();
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 text-purple-300 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-purple-500/30 group"
              title="Magical Tools"
            >
              <span className="text-xs group-hover:scale-110 transition-transform">✨</span>
              <span className="hidden xs:block">Magical Tools</span>
              {isCollabView && <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></span>}
            </button>

            <button
              onClick={() => {
                setShowCommunityFeed(true);
                fetchCommunityItems();
              }}
              className="text-gray-400 hover:text-fuchsia-400 transition-colors ml-1"
              title="Community Feed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <section className="flex-1 overflow-hidden relative flex">
          <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-900/5 to-purple-900/5 pointer-events-none" />
          <div className={`flex-1 min-w-0 flex flex-col min-h-0 ${isNewConversation ? 'new-conversation-effect' : ''}`}>
            <ChatInterface
              history={chatHistory}
              loading={loading}
              onAsk={handleAsk}
              question={question}
              setQuestion={setQuestion}
              code={code}
              setCode={setCode}
              user={user}
              onAuthRequired={() => setAuthOpen(true)}
              model={model}
              apiBase={API_BASE}
              authHeaders={authHeaders}
              theme={theme}
              onUpdate={(data) => {
                if (data && Object.prototype.hasOwnProperty.call(data, 'linkedRepo')) {
                  setPreLinkedRepo(data.linkedRepo || null);
                  setPreLinkedBranch(data.linkedBranch || 'main');
                }
                if (activeConversationId) fetchConversationDetails(activeConversationId);
              }}
              image={image}
              setImage={setImage}
              isNewConversation={isNewConversation}
              activeConversationId={activeConversationId}
              currentlySpeakingId={currentlySpeakingId}
              onSpeak={speakResponse}
              onShare={() => {
                if (chatHistory.length > 0) {
                  const lastTurn = chatHistory[chatHistory.length - 1];
                  setShareTitle(lastTurn.user_question || conversations.find(c => c.id === activeConversationId)?.title || '');
                  const codeSnippets = chatHistory
                    .filter(turn => turn.code_snippet)
                    .map(turn => turn.code_snippet)
                    .join('\n\n// ---\n\n');
                  setShareCode(codeSnippets);
                  setShareSolution(lastTurn.ai_response || '');
                }
                setShareOpen(true);
              }}
              onShowCodeHealth={() => setShowCodeHealth(true)}
              activeProject={activeProject}
              onFeedbackDetail={(id) => {
                setFeedbackHistoryId(id);
                setShowFeedbackModal(true);
              }}
              socketIsStreaming={socketIsStreaming}
              liveStreamText={liveStreamText}
              streamingHistoryId={streamingHistoryId}
            />
          </div>

          {/* Right Sidebar: Snippets */}
          {showSnippets && (
            <div className="w-80 h-full flex-shrink-0 z-20 border-l border-gray-800 hidden md:block">
              <SnippetManager
                apiBase={API_BASE}
                authHeaders={authHeaders}
                user={user}
                onAuthRequired={() => setAuthOpen(true)}
                onClose={() => setShowSnippets(false)}
              />
            </div>
          )}
        </section>

        {/* Community Feed Modal */}
        {
          showCommunityFeed && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative">
                <button
                  onClick={() => setShowCommunityFeed(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="p-6 border-b border-gray-800">
                  <h2 className="text-xl font-bold text-fuchsia-400">
                    {activeCommunityPost ? 'Post Details' : 'Community Feed'}
                  </h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  {activeCommunityPost ? (
                    // PostDetail View
                    <div className="h-full bg-gray-900/50 backdrop-blur-sm absolute inset-0 z-20">
                      <CommunityPostDetail
                        post={activeCommunityPost}
                        onBack={() => {
                          setActiveCommunityPost(null);
                          setHighlightAnswerId(null);
                          // Eğer Following Feed'den geldiyse, oraya geri dön
                          if (postSource === 'following') {
                            setShowCommunityFeed(false);
                            setShowFollowingFeedModal(true);
                            setPostSource(null);
                          }
                        }}
                        apiBase={API_BASE}
                        authHeaders={authHeaders}
                        user={user}
                        onAuthRequired={() => handleShowAlert("Please login first")}
                        onShowAlert={handleShowAlert}
                        highlightAnswerId={highlightAnswerId}
                        onUserClick={(userId) => {
                          handleProfileOpen(userId);
                        }}
                      />
                    </div>
                  ) : (
                    // Community Feed
                    <CommunityFeed
                      apiBase={API_BASE}
                      authHeaders={authHeaders}
                      onSelect={handleCommunitySelect}
                      user={user}
                      onUserClick={(userId) => {
                        handleProfileOpen(userId);
                      }}
                      onShowAlert={handleShowAlert}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        }

        {/* Architecture Graph Modal */}
        {showArchData && (activeConversationId && conversations.find(c => c.id === activeConversationId)?.linked_repo || preLinkedRepo) && (
          <GitHubGraph
            repo={activeConversationId ? conversations.find(c => c.id === activeConversationId)?.linked_repo : preLinkedRepo}
            branch={activeConversationId ? conversations.find(c => c.id === activeConversationId)?.repo_branch : preLinkedBranch}
            conversationId={activeConversationId}
            onClose={() => setShowArchData(false)}
            apiBase={API_BASE}
            authHeaders={authHeaders}
          />
        )}

        {/* Code Health Dashboard Modal */}
        {showCodeHealth && (activeConversationId && conversations.find(c => c.id === activeConversationId)?.linked_repo || preLinkedRepo) && (
          <CodeHealthDashboard
            repo={activeConversationId ? conversations.find(c => c.id === activeConversationId)?.linked_repo : preLinkedRepo}
            branch={activeConversationId ? conversations.find(c => c.id === activeConversationId)?.repo_branch : preLinkedBranch}
            onClose={() => setShowCodeHealth(false)}
            apiBase={API_BASE}
            authHeaders={authHeaders}
          />
        )}
        
        {/* Gamification Modal */}
        {showGamificationData && user && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="gamification-modal-content relative">
              <button
                onClick={() => setShowGamificationData(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 text-xl"
              >
                ✕
              </button>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-6 flex items-center gap-3">
                  <i className="fas fa-crown text-yellow-500"></i> Alchemist Rank
                </h2>
                <GamificationPanel token={token} />
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {
          shareOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-lg shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 to-purple-600" />
                <h2 className="text-2xl font-bold mb-6 text-white">Share with Community</h2>

                <form onSubmit={handleShare} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Question / Title</label>
                    <input
                      type="text"
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                      placeholder="What are you curious about or want to share?"
                      value={shareTitle}
                      onChange={e => setShareTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Code (Optional)</label>
                    <textarea
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white text-xs font-mono focus:ring-2 focus:ring-fuchsia-500 outline-none h-24"
                      placeholder="Relevant code snippet..."
                      value={shareCode}
                      onChange={e => setShareCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Your Solution (Optional)</label>
                    <textarea
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none h-24"
                      placeholder="If you have a solution, you can add it here..."
                      value={shareSolution}
                      onChange={e => setShareSolution(e.target.value)}
                    />
                  </div>

                  {/* Image/File Upload */}
                  <div className="flex items-center gap-3 bg-black/30 p-2 rounded-lg border border-gray-700">
                    <input
                      type="file"
                      ref={shareFileInputRef}
                      className="hidden"
                      onChange={(e) => setShareImage(e.target.files[0])}
                    />
                    <button
                      type="button"
                      onClick={() => shareFileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors border border-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {shareImage ? 'Change File' : 'Add File'}
                    </button>
                    {shareImage && (
                      <span className="text-xs text-fuchsia-300 truncate max-w-[200px]">{shareImage.name}</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2"
                  >
                    Share
                  </button>
                </form>

                <button
                  onClick={() => setShareOpen(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        }

        {/* Collaboration Share Options */}
        {showCollabShareOptions && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-emerald-500/40 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
              <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <span>🤝</span>
                <span>Collaborate Share</span>
              </h2>

              <p className="text-sm text-gray-300 mb-3">Bu linki doğrudan paylaşabilirsin:</p>
              <div className="bg-black/40 border border-gray-700 rounded-lg p-3 text-xs text-cyan-300 break-all mb-4">
                {collabShareLink}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-200 text-sm font-semibold transition-colors"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(collabShareLink);
                      handleShowAlert('Link kopyalandı.');
                    } catch {
                      handleShowAlert('Kopyalama başarısız oldu.');
                    }
                  }}
                >
                  Copy Link
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/35 border border-cyan-500/40 text-cyan-200 text-sm font-semibold transition-colors"
                  onClick={() => window.open(collabShareLink, '_blank', 'noopener,noreferrer')}
                >
                  Open Link
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/35 border border-green-500/40 text-green-200 text-sm font-semibold transition-colors"
                  onClick={() => {
                    const text = encodeURIComponent(`CodeAlchemist ortak oturum linki: ${collabShareLink}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
                  }}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/40 text-blue-200 text-sm font-semibold transition-colors"
                  onClick={() => {
                    const subject = encodeURIComponent('CodeAlchemist Collaboration Link');
                    const body = encodeURIComponent(`Merhaba, ortak oturum linki: ${collabShareLink}`);
                    window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  }}
                >
                  E-mail
                </button>
              </div>

              <button
                onClick={() => setShowCollabShareOptions(false)}
                className="absolute top-3 right-4 text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </main>

      {/* Modals */}

      {showModelCompare && (
        <ModelCompare
          apiBase={API_BASE}
          authHeaders={authHeaders}
          activeConversationId={activeConversationId}
          onClose={() => setShowModelCompare(false)}
          onSelectResponse={async (comparisonData) => {
            const selectedResponseText = comparisonData.selectedResponse === 1 ? comparisonData.response1 : comparisonData.response2;
            const selectedModelName = comparisonData.selectedResponse === 1 ? comparisonData.model1Label : comparisonData.model2Label;

            const newItem = {
              id: Date.now(),
              user_question: comparisonData.question,
              isComparison: true,
              model1: comparisonData.model1,
              model2: comparisonData.model2,
              response1: comparisonData.response1,
              response2: comparisonData.response2,
              selectedResponse: comparisonData.selectedResponse,
              model1Label: comparisonData.model1Label,
              model2Label: comparisonData.model2Label,
              model1Color: comparisonData.model1Color,
              model2Color: comparisonData.model2Color,
              ai_response: selectedResponseText,
              selected_model: selectedModelName,
              timestamp: new Date().toLocaleString()
            };

            setChatHistory(prev => [...prev, newItem]);
            setShowModelCompare(false);

            try {
              let targetConversationId = activeConversationId;
              if (!targetConversationId) {
                const createRes = await fetch(`${API_BASE}/api/conversations`, {
                  method: 'POST',
                  headers: { ...authHeaders, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: comparisonData.question.substring(0, 50) })
                });
                if (createRes.ok) {
                  const createData = await createRes.json();
                  targetConversationId = createData.conversation.id;
                  setActiveConversationId(targetConversationId);
                  setConversations(prev => [createData.conversation, ...prev]);
                }
              }

              if (targetConversationId) {
                const historyPayload = {
                  isComparison: true,
                  model1: comparisonData.model1,
                  model2: comparisonData.model2,
                  response1: comparisonData.response1,
                  response2: comparisonData.response2,
                  selectedResponse: comparisonData.selectedResponse,
                  model1Label: comparisonData.model1Label,
                  model2Label: comparisonData.model2Label,
                  model1Color: comparisonData.model1Color,
                  model2Color: comparisonData.model2Color,
                  ai_response: selectedResponseText
                };

                await fetch(`${API_BASE}/api/conversations/${targetConversationId}/history`, {
                  method: 'POST',
                  headers: { ...authHeaders, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    user_question: comparisonData.question,
                    ai_response: JSON.stringify(historyPayload),
                    selected_model: selectedModelName
                  })
                });
              }
            } catch (error) {
              console.error("Failed to save comparison history:", error);
            }
          }}
        />
      )}

      {showFeedbackModal && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          historyId={feedbackHistoryId}
          onSubmit={async (feedbackData) => {
            const res = await fetch(`${API_BASE}/api/feedback/detail`, {
              method: 'POST',
              headers: { ...authHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify(feedbackData)
            });
            if (res.ok) {
              handleShowAlert("Geri bildiriminiz için teşekkürler!");
            }
          }}
        />
      )}

      {/* UserProfileModal Rendering */}
      {
        showUserProfile && (
          <UserProfileModal
            userId={viewingUserId}
            onClose={handleProfileClose}
            apiBase={API_BASE}
            authHeaders={authHeaders}
            currentUser={user}
            onLogout={handleLogout}
            onUserUpdate={(updatedUser) => {
              setUser(updatedUser);
              localStorage.setItem('codebrain_user', JSON.stringify(updatedUser));
            }}
            onPostClick={(post) => {
              handleProfileClose();
              setActiveCommunityPost(post);
              setShowCommunityFeed(true);
            }}
            onShowAlert={handleShowAlert}
            onUserClick={(userId) => {
              handleProfileOpen(userId);
            }}
            onBack={handleProfileBack}
            canGoBack={userHistory.length > 0}
          />
        )
      }



      {/* Following Feed Modal */}
      {
        showFollowingFeedModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-cyan-500/30 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl shadow-cyan-500/10">
              <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👥</span>
                  <div>
                    <h2 className="text-lg font-bold text-white">Following Feed</h2>
                    <p className="text-xs text-cyan-300">Posts from people you follow</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFollowingFeedModal(false)}
                  className="text-gray-400 hover:text-white transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
                <FollowingFeed
                  apiBase={API_BASE}
                  authHeaders={authHeaders}
                  user={user}
                  onAuthRequired={() => {
                    setShowFollowingFeedModal(false);
                    setAuthOpen(true);
                  }}
                  onUserClick={(author) => {
                    handleProfileOpen(author.id || author);
                    setShowFollowingFeedModal(false);
                  }}
                  onPostClick={(post) => {
                    setActiveCommunityPost(post);
                    setPostSource('following'); // Kaynağı kaydet
                    setShowCommunityFeed(true);
                    setShowFollowingFeedModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        )
      }

      <AuthModal
        open={authOpen}
        apiBase={API_BASE}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <StatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        message={statusMessage}
      />

      {showCostDashboard && (
        <ModelCostDashboard 
          onClose={() => setShowCostDashboard(false)} 
          apiBase={API_BASE}
          authHeaders={token ? { Authorization: `Bearer ${token}` } : {}}
        />
      )}

      {showLandingPage && !user && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0a0a0b]">
          <LandingPage 
            onGetStarted={() => setShowLandingPage(false)}
            onLogin={() => {
              setAuthOpen(true);
            }}
          />
        </div>
      )}

      {/* Weekly Report Modal */}
      {showWeeklyReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-8">
              <WeeklyReport 
                data={weeklyReportData} 
                onClose={() => setShowWeeklyReport(false)} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Magical Tools Drawer */}
      {showToolsDrawer && (
        <div 
          className="tools-drawer-overlay" 
          onClick={(e) => {
            if (e.target.className === 'tools-drawer-overlay') {
              setShowToolsDrawer(false);
            }
          }}
        >
          <div className="tools-drawer">
            <div className="tools-drawer-header">
              <h2>⚡ Magical Tools</h2>
              <button 
                onClick={() => setShowToolsDrawer(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="tools-grid">
              <button 
                className="tool-item"
                onClick={() => { 
                  if (!user) { setAuthOpen(true); } 
                  else { setShowThemeStore(true); } 
                  setShowToolsDrawer(false); 
                }}
              >
                <span className="text-lg">🎨</span>
                <span>Theme Store</span>
              </button>

              <button 
                className="tool-item"
                onClick={() => { 
                  if (!user) { setAuthOpen(true); } 
                  else { setShowSnippets(true); } 
                  setShowToolsDrawer(false); 
                }}
              >
                <span className="text-lg">📂</span>
                <span>Code Snippets</span>
              </button>

              <button 
                className="tool-item"
                onClick={() => { setShowModelCompare(true); setShowToolsDrawer(false); }}
              >
                <span>⚗️</span>
                <span>Model Alchemy</span>
              </button>

              <button 
                className="tool-item"
                onClick={() => { 
                  if (!user) { setAuthOpen(true); } 
                  else { setShowGamificationData(true); } 
                  setShowToolsDrawer(false); 
                }}
              >
                <span>🏆</span>
                <span>My Rank & Stats</span>
              </button>

              <button 
                className="tool-item"
                onClick={() => { setShowFollowingFeedModal(true); setShowToolsDrawer(false); }}
              >
                <span>👥</span>
                <span>Following Feed</span>
              </button>

              <button 
                className="tool-item"
                onClick={() => { 
                  if (!user) { setAuthOpen(true); } 
                  else { fetchWeeklyReport(); } 
                  setShowToolsDrawer(false); 
                }}
              >
                <span>📊</span>
                <span>Weekly Summary Report</span>
              </button>

              <button 
                className="tool-item"
                onClick={() => { 
                  if (!user) { setAuthOpen(true); } 
                  else { setShowCostDashboard(true); } 
                  setShowToolsDrawer(false); 
                }}
              >
                <span>📈</span>
                <span>Cost Dashboard</span>
              </button>

              <div className="h-px bg-gray-800 my-4"></div>

              <div className="space-y-3">
                 <button 
                   className="tool-item border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                   onClick={() => { 
                      if (!user) { setAuthOpen(true); } 
                      else { handleShareSession(); } 
                      setShowToolsDrawer(false); 
                   }}
                 >
                   <span>🤝</span>
                   <span>Collaborate (Share Session)</span>
                 </button>

                 <button 
                   className="tool-item border-fuchsia-500/20 bg-fuchsia-500/5 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/40"
                   onClick={() => {
                     if (!user) {
                        setAuthOpen(true);
                        setShowToolsDrawer(false);
                        return;
                     }
                     // Trigger standard share
                     if (chatHistory.length > 0) {
                        const lastTurn = chatHistory[chatHistory.length - 1];
                        setShareTitle(lastTurn.user_question || conversations.find(c => c.id === activeConversationId)?.title || '');
                        const codeSnippets = chatHistory.filter(turn => turn.code_snippet).map(turn => turn.code_snippet).join('\n\n// ---\n\n');
                        setShareCode(codeSnippets);
                        setShareSolution(lastTurn.ai_response || '');
                     }
                     setShareOpen(true);
                     setShowToolsDrawer(false);
                   }}
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                   </svg>
                   <span>Share with Community</span>
                 </button>
              </div>
              
              {isCollabView && (
                <div className="mt-4 rounded-xl border border-pink-500/30 bg-gradient-to-b from-pink-950/30 to-purple-950/20 overflow-hidden">
                  {/* Live Sync Header */}
                  <div className="px-3 py-2 bg-pink-600/20 border-b border-pink-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-bounce'}`}></span>
                      <span className="text-[11px] font-bold text-pink-200 uppercase tracking-widest">
                        {socketConnected ? 'Live Sync' : 'Connecting...'}
                      </span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      transportMode === 'websocket' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : transportMode === 'polling'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {transportMode === 'websocket' ? '⚡ WS' : transportMode === 'polling' ? '📡 Polling' : '···'}
                    </span>
                  </div>

                  <div className="p-3 space-y-3">
                    {/* Owner info */}
                    <div className="text-[11px] text-pink-300/80 font-medium">
                      Oturum sahibi: <span className="text-pink-200 font-bold">{collabOwner}</span>
                    </div>

                    {/* Active Users */}
                    {socketActiveUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {socketActiveUsers.map((uname, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600/30 border border-purple-500/30 text-purple-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {uname}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Live AI Streaming Indicator */}
                    {socketIsStreaming && (
                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex gap-0.5">
                            <span className="w-1 h-3 bg-cyan-400 rounded-full animate-[bounce_0.8s_ease-in-out_infinite]"></span>
                            <span className="w-1 h-3 bg-cyan-400 rounded-full animate-[bounce_0.8s_ease-in-out_0.15s_infinite]"></span>
                            <span className="w-1 h-3 bg-cyan-400 rounded-full animate-[bounce_0.8s_ease-in-out_0.3s_infinite]"></span>
                          </div>
                          <span className="text-[10px] text-cyan-300 font-semibold">AI yanıtlıyor...</span>
                        </div>
                        {socketLastQuestion && (
                          <div className="text-[10px] text-cyan-200/70 truncate">
                            <span className="text-cyan-400 font-bold">{socketLastQuestion.sender}:</span> {socketLastQuestion.question}
                          </div>
                        )}
                        <div className="mt-1.5 text-[10px] text-gray-300/80 max-h-16 overflow-y-auto leading-relaxed font-mono">
                          {liveStreamText}<span className="inline-block w-0.5 h-3 bg-cyan-400 animate-pulse ml-0.5 align-middle"></span>
                        </div>
                      </div>
                    )}

                    {/* Review sistemi */}
                    <div className="rounded-lg border border-pink-400/20 bg-black/20 p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-pink-200 mb-2">
                        <span>Review: <span className={`font-bold ${
                          collabReview?.status === 'approved' ? 'text-emerald-400' 
                          : collabReview?.status === 'revision_requested' ? 'text-amber-400' 
                          : 'text-pink-300'
                        }`}>{collabReview?.status || 'open'}</span></span>
                        {collabReviewLoading && <span className="text-pink-300 animate-pulse">sync...</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-1 mb-2">
                        <button
                          onClick={() => updateCollabReviewStatus('open')}
                          className="text-[10px] py-1 rounded bg-slate-700/60 hover:bg-slate-600 text-slate-100 transition-colors"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => updateCollabReviewStatus('revision_requested')}
                          className="text-[10px] py-1 rounded bg-amber-700/40 hover:bg-amber-700/70 text-amber-100 transition-colors"
                        >
                          Revise
                        </button>
                        <button
                          onClick={() => updateCollabReviewStatus('approved')}
                          className="text-[10px] py-1 rounded bg-emerald-700/40 hover:bg-emerald-700/70 text-emerald-100 transition-colors"
                        >
                          ✓ Approve
                        </button>
                      </div>
                      <div className="flex gap-1 mb-2">
                        <input
                          value={collabReviewComment}
                          onChange={(e) => setCollabReviewComment(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && submitCollabReviewComment()}
                          placeholder="Yorum ekle..."
                          className="flex-1 bg-black/40 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200 focus:border-pink-500/50 outline-none"
                        />
                        <button
                          onClick={submitCollabReviewComment}
                          className="px-2 py-1 text-[10px] rounded bg-cyan-700/50 hover:bg-cyan-600 text-cyan-100 transition-colors"
                        >
                          Gönder
                        </button>
                      </div>
                      <div className="max-h-20 overflow-y-auto space-y-1">
                        {(collabReview?.comments || []).slice(0, 6).map((c) => (
                          <div key={c.id} className="text-[10px] text-pink-100/90 bg-black/20 border border-pink-400/10 rounded px-2 py-1">
                            <span className="font-semibold text-pink-300">{c.author}:</span> {c.comment}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Disconnect */}
                    <button 
                      onClick={() => {
                        setIsCollabView(false);
                        setCollabToken(null);
                        window.history.pushState({}, '', window.location.pathname);
                        fetchConversations();
                        setShowToolsDrawer(false);
                      }}
                      className="w-full py-1.5 text-[10px] bg-pink-600/20 hover:bg-pink-600/40 text-pink-300 rounded-lg transition-colors border border-pink-500/30"
                    >
                      Oturumu Kapat
                    </button>
                  </div>
                </div>
              )}

            </div>

            <div className="mt-auto pt-4 border-t border-gray-800 flex flex-col gap-3">
               {usageInfo && usageInfo.usage && (
                 <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                   <div className="text-[11px] text-cyan-200 font-semibold mb-1">
                     Plan: {usageInfo.plan}
                   </div>
                   <div className="text-[10px] text-cyan-100/80">
                     Daily: {usageInfo.usage.daily_requests_used}/{usageInfo.limits?.daily_requests}
                   </div>
                   <div className="text-[10px] text-cyan-100/80 mb-2">
                     Monthly Tokens: {usageInfo.usage.monthly_tokens_used}/{usageInfo.limits?.monthly_tokens}
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                     <button
                       onClick={() => switchSubscriptionPlan('free')}
                       className="text-[10px] py-1 rounded bg-gray-700/70 hover:bg-gray-600 text-gray-100"
                     >
                       Free
                     </button>
                     <button
                       onClick={() => switchSubscriptionPlan('premium')}
                       className="text-[10px] py-1 rounded bg-fuchsia-700/70 hover:bg-fuchsia-600 text-fuchsia-100"
                     >
                       Premium
                     </button>
                   </div>
                 </div>
               )}
               <div className="text-[10px] text-gray-500 text-center uppercase tracking-widest">
                 System Version 2.5.0
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Store Modal */}
      {showThemeStore && user && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl relative">
            <div className="overflow-y-auto p-6 max-h-[85vh]">
              <ThemeStore 
                token={token}
                userCoins={user?.coins || 0}
                userXP={user?.xp || 0}
                onThemeChange={(newTheme) => {
                  setTheme(newTheme);
                  // Optionally sync the new theme to local storage or external immediately handled by App.jsx useEffect
                }}
                onClose={() => setShowThemeStore(false)}
                onRefreshCoins={(newCoins) => {
                  if (user) {
                    const u = { ...user, coins: newCoins };
                    setUser(u);
                    localStorage.setItem('codebrain_user', JSON.stringify(u));
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Gamification Toasts */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {gamificationToasts.map(toast => (
          <div key={toast.id} className={`gamification-toast backdrop-blur-md rounded-xl p-4 shadow-2xl border pointer-events-auto transform transition-all duration-500 flex items-center gap-4 min-w-[300px] 
            ${toast.type === 'level_up' 
              ? 'bg-gradient-to-r from-purple-900/90 to-indigo-900/90 border-purple-500/50 shadow-purple-500/20' 
              : 'bg-gradient-to-r from-amber-900/90 to-yellow-900/90 border-amber-500/50 shadow-amber-500/20'}`}>
            
            <div className={`text-3xl filter drop-shadow-lg ${toast.type === 'level_up' ? 'animate-bounce' : 'animate-spin-slow'}`}>
              {toast.type === 'level_up' ? '🌟' : (toast.badge?.icon?.startsWith('fa-') ? <i className={`fas ${toast.badge.icon}`}></i> : toast.badge?.icon || '🏆')}
            </div>
            
            <div className="flex-1">
              <h4 className={`text-sm font-bold uppercase tracking-wider mb-1 ${toast.type === 'level_up' ? 'text-purple-300' : 'text-amber-300'}`}>
                {toast.type === 'level_up' ? 'Level Up!' : 'New Badge Unlocked!'}
              </h4>
              <p className="text-white font-medium text-lg leading-tight">
                {toast.message}
              </p>
            </div>
            
            <button 
              onClick={() => setGamificationToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
