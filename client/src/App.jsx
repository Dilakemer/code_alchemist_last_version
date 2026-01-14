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
import { requestNotificationPermission, isNotificationEnabled } from './utils/notifications';


const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE || 'http://localhost:5000');

function App() {
  const [model, setModel] = useState('gemini-2.0-flash');
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [favoritesList, setFavoritesList] = useState([]);
  const [communityItems, setCommunityItems] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);


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
  const [multiModels, setMultiModels] = useState(['gemini-2.5-flash', 'gpt-4o']);

  // Notification Dropdown State
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  // Mobile Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Following Feed Modal State
  const [showFollowingFeedModal, setShowFollowingFeedModal] = useState(false);

  // User Profile Modal State
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [viewingUserId, setViewingUserId] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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
  }, [user]);

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
    }
  }, [token]);

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

  async function handleAsk() {
    if (!question.trim() && !image) return;

    // 1. Optimistic UI Update
    const tempId = Date.now();
    const newHistoryItem = {
      id: tempId,
      user_question: question,
      ai_response: '',
      // Store full ISO so UI can render only the date (no time)
      timestamp: new Date().toISOString(),
      image_url: image ? URL.createObjectURL(image) : null,
      code_snippet: code,
      selected_model: isMultiModel ? 'Multi-Model Blend' : model
    };

    setChatHistory(prev => [...prev, newHistoryItem]);

    // Reset inputs immediately
    const currentQuestion = question;
    const currentCode = code;
    const currentImage = image;
    const currentModel = model;
    const currentModels = multiModels;
    const isBlendMode = isMultiModel;

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
        if (activeConversationId) formData.append('conversation_id', activeConversationId);
        formData.append('image', currentImage);
        body = formData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          question: currentQuestion,
          code: currentCode,
          model: currentModel,
          models: currentModels, // For blend mode
          conversation_id: activeConversationId
        });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: body
      });

      if (!res.ok) throw new Error(res.statusText);

      // 2. Setup Streaming Reader
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseAccumulator = "";
      let buffer = "";

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
                aiResponseAccumulator += data.chunk;
                setChatHistory(prev => prev.map(item =>
                  item.id === tempId ? { ...item, ai_response: aiResponseAccumulator } : item
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
                if (data.conversation_id && activeConversationId !== data.conversation_id) {
                  setActiveConversationId(data.conversation_id);
                  fetchConversations();
                }

                // For blend mode, use blended_response if available (though it was streamed via chunks too)
                const finalResponse = data.blended_response || aiResponseAccumulator;

                // Update with real DB ID and metadata
                setChatHistory(prev => prev.map(item =>
                  item.id === tempId ? {
                    ...item,
                    id: data.history_id || tempId,
                    conversation_id: data.conversation_id,
                    summary: data.summary,
                    ai_response: finalResponse,
                    routing_reason: data.routing_reason,
                    persona: data.persona
                  } : item
                ));
              }
            } catch (e) {
              console.error("Error parsing SSE JSON", e);
            }
          }
        }
      }

    } catch (error) {
      console.error("Error:", error);
      setChatHistory(prev => prev.map(item =>
        item.id === tempId ? { ...item, ai_response: item.ai_response + "\n\n[An error occurred. Please try again.]" } : item
      ));
    } finally {
      setLoading(false);
    }
  }

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
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('codebrain_token');
    localStorage.removeItem('codebrain_user');
    setConversations([]);
    handleNewChat();
  };

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans selection:bg-fuchsia-500/30 overflow-hidden">

      {/* Mobile Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`w-80 bg-gray-900/50 border-r border-gray-800 flex flex-col backdrop-blur-xl mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center justify-center gap-3">
            {/* Logo */}
            <img
              src="/code_alchemist_logo.png"
              alt="CodeAlchemist logo"
              className="h-20 w-auto object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]"
              onError={(e) => { e.currentTarget.src = '/alchemy_wave.png'; }}
            />

            {/* Brand text */}
            <div className="flex flex-col">
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent tracking-wide">
                CodeAlchemist
              </h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">
                AI-POWERED CODING ASSISTANT
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-1 bg-gray-900/80 mx-2 mt-2 rounded-lg flex-wrap">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'conversations'
              ? 'bg-gray-800 text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            Chat
          </button>
          {user && (
            <button
              onClick={() => {
                setActiveTab('archived');
                fetchArchivedConversations();
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'archived'
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
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${activeTab === 'favorites'
                ? 'bg-gray-800 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              ⭐ Favorites
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {activeTab === 'conversations' ? (
            <>
              <button
                onClick={handleNewChat}
                className="w-full mb-2 bg-gray-800/80 hover:bg-gray-700 text-white py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-600 hover:border-gray-500 group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform text-emerald-400">+</span>
                <span className="font-medium text-sm">New Conversation</span>
              </button>

              {/* Model Comparison Button */}
              <button
                onClick={() => {
                  setShowModelCompare(true);
                  setActiveConversationId(null);
                }}
                className="w-full mb-2 bg-gradient-to-r from-fuchsia-900/60 to-purple-900/60 hover:from-fuchsia-800/70 hover:to-purple-800/70 text-white py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-fuchsia-500/40 group"
              >
                <span className="text-lg group-hover:animate-bounce">⚗️</span>
                <span className="font-medium text-sm text-fuchsia-200">Model Alchemy</span>
              </button>



              {/* Following Feed Button */}
              <button
                onClick={() => setShowFollowingFeedModal(true)}
                className="w-full mb-4 bg-gradient-to-r from-cyan-900/60 to-blue-900/60 hover:from-cyan-800/70 hover:to-blue-800/70 text-white py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-cyan-500/40 group"
              >
                <span className="text-lg group-hover:animate-bounce">👥</span>
                <span className="font-medium text-sm text-cyan-200">Following Feed</span>
              </button>

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
                onClick={handleLogout}
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
      </aside >

      {/* Main Content */}
      < main className="flex-1 flex flex-col h-full overflow-hidden relative" >
        {/* Header */}
        < header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/30 backdrop-blur-sm z-10 mobile-header" >
          <div className="flex items-center gap-4">
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mobile-menu-btn w-10 h-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Toggle Menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

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
            {/* Snippets Button */}
            <button
              onClick={() => setShowSnippets(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-fuchsia-400 hover:bg-gray-800/50 transition-all"
              title="Code Snippets"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>

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

            {/* Export Button */}
            <ExportButton
              chatHistory={chatHistory}
              conversationTitle={conversations.find(c => c.id === activeConversationId)?.title || 'Chat Export'}
            />

            <div className="h-6 w-px bg-gray-700"></div>

            <button
              onClick={() => {
                // Populate share fields from current chat history
                if (chatHistory.length > 0) {
                  const lastTurn = chatHistory[chatHistory.length - 1];
                  setShareTitle(lastTurn.user_question || conversations.find(c => c.id === activeConversationId)?.title || '');

                  // Collect all code snippets from history
                  const codeSnippets = chatHistory
                    .filter(turn => turn.code_snippet)
                    .map(turn => turn.code_snippet)
                    .join('\n\n// ---\n\n');
                  setShareCode(codeSnippets);

                  // Use last AI response as solution
                  setShareSolution(lastTurn.ai_response || '');
                } else {
                  setShareTitle('');
                  setShareCode('');
                  setShareSolution('');
                }
                setShareOpen(true);
              }}
              className="flex items-center gap-2 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-fuchsia-500/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Share
            </button>

            <button
              onClick={() => {
                setShowCommunityFeed(true);
                fetchCommunityItems();
              }}
              className="text-gray-400 hover:text-fuchsia-400 transition-colors"
              title="Community Feed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </div>
        </header >

        {/* Content Area */}
        < section className="flex-1 overflow-hidden relative" >
          <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-900/5 to-purple-900/5 pointer-events-none" />
          <div className={`h-full w-full ${isNewConversation ? 'new-conversation-effect' : ''}`}>
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
              onUpdate={() => {
                if (activeConversationId) fetchConversationDetails(activeConversationId);
              }}
              image={image}
              setImage={setImage}
              isNewConversation={isNewConversation}
            />
          </div>

          {/* Centered Share Button */}
          {
            chatHistory.length > 0 && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
                <button
                  onClick={() => {
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
                  className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-lg shadow-fuchsia-900/40 hover:shadow-fuchsia-900/60 hover:scale-105"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share to Community
                </button>
              </div>
            )
          }
        </section >

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
      </main >

      {/* Snippet Manager Modal */}
      {
        showSnippets && (
          <SnippetManager
            apiBase={API_BASE}
            authHeaders={authHeaders}
            user={user}
            onAuthRequired={() => setAuthOpen(true)}
            onClose={() => setShowSnippets(false)}
          />
        )
      }

      {/* Model Compare Modal */}
      {
        showModelCompare && (
          <ModelCompare
            apiBase={API_BASE}
            authHeaders={authHeaders}
            activeConversationId={activeConversationId}
            onClose={() => setShowModelCompare(false)}
            onSelectResponse={async (comparisonData) => {
              // Add comparison result to chat history with both responses for side-by-side display
              const selectedResponseText = comparisonData.selectedResponse === 1 ? comparisonData.response1 : comparisonData.response2;
              const selectedModelName = comparisonData.selectedResponse === 1 ? comparisonData.model1Label : comparisonData.model2Label;

              const newItem = {
                id: Date.now(), // Temporary ID until refresh
                user_question: comparisonData.question,
                isComparison: true, // Flag for special rendering
                model1: comparisonData.model1,
                model2: comparisonData.model2,
                response1: comparisonData.response1,
                response2: comparisonData.response2,
                selectedResponse: comparisonData.selectedResponse,
                model1Label: comparisonData.model1Label,
                model2Label: comparisonData.model2Label,
                model1Color: comparisonData.model1Color,
                model2Color: comparisonData.model2Color,
                // Also set ai_response to the selected one for backward compatibility
                ai_response: selectedResponseText,
                selected_model: selectedModelName,
                timestamp: new Date().toLocaleString()
              };

              setChatHistory(prev => [...prev, newItem]);
              setShowModelCompare(false);

              // Persist to backend
              try {
                let targetConversationId = activeConversationId;

                // If no active conversation, create one first
                if (!targetConversationId) {
                  const createRes = await fetch(`${API_BASE}/api/conversations`, {
                    method: 'POST',
                    headers: {
                      ...authHeaders,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ title: comparisonData.question.substring(0, 50) })
                  });

                  if (createRes.ok) {
                    const createData = await createRes.json();
                    targetConversationId = createData.conversation.id;
                    setActiveConversationId(targetConversationId);

                    // Update conversation list
                    setConversations(prev => [createData.conversation, ...prev]);
                  }
                }

                if (targetConversationId) {
                  // Create a composite JSON object for storage
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
                    ai_response: selectedResponseText // Fallback text
                  };

                  await fetch(`${API_BASE}/api/conversations/${targetConversationId}/history`, {
                    method: 'POST',
                    headers: {
                      ...authHeaders,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      user_question: comparisonData.question,
                      ai_response: JSON.stringify(historyPayload), // Store full object as string
                      selected_model: selectedModelName
                    })
                  });
                }
              } catch (error) {
                console.error("Failed to save comparison history:", error);
              }
            }}
          />
        )
      }

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
    </div >
  );
}

export default App;
