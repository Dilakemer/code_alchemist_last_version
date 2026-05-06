import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  askQuestion, 
  checkBackendHealth, 
  getApiBase, 
  getMe, 
  login, 
  register,
  googleLogin,
  getConversations, 
  getConversationDetails,
  deleteConversation,
  publishToCommunity 
} from './src/services/api';

// Components
import ModelSelector from './src/components/ModelSelector';
import ComparisonScreen from './src/components/ComparisonScreen';
import Sidebar from './src/components/Sidebar';
import SnippetManager from './src/components/SnippetManager';
import StatsView from './src/components/StatsView';
import BillingView from './src/components/BillingView';
import CommunityFeed from './src/components/CommunityFeed';
import WeeklySummary from './src/components/WeeklySummary';
import CreatePostModal from './src/components/CreatePostModal';
import ProfileView from './src/components/ProfileView';
import LoginScreen from './src/components/LoginScreen';

import { clearSession, loadToken, loadUser, saveSession } from './src/services/storage';

const { width } = Dimensions.get('window');

export default function App() {
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState('');
  
  // Navigation State
  const [activeView, setActiveView] = useState('chat'); // 'chat', 'compare', 'snippets', 'stats', 'cost', 'feed', 'community', 'weekly', 'profile'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  
  // Models State
  const [availableModels] = useState([
    'auto',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gpt-4o',
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-5-20251101',
  ]);
  const [selectedModels, setSelectedModels] = useState(['auto']);
  const [comparisons, setComparisons] = useState([]);
  const [comparing, setComparing] = useState(false);
  
  // History State
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const scrollRef = useRef(null);

  const apiBase = useMemo(() => getApiBase(), []);

  const refreshUserInfo = async (authToken = token) => {
    if (!authToken) return;
    try {
      const me = await getMe(authToken);
      if (me.user) {
        setUser(me.user);
        await saveSession({ token: authToken, user: me.user });
      }
    } catch (err) {
      console.error('Failed to refresh user info', err);
    }
  };

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const data = await getConversations(token);
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const savedToken = await loadToken();
        const savedUser = await loadUser();
        if (!savedToken) {
          setBooting(false);
          return;
        }

        try {
          const me = await getMe(savedToken);
          const resolvedUser = me.user || savedUser;
          setToken(savedToken);
          setUser(resolvedUser || null);
          await saveSession({ token: savedToken, user: resolvedUser || null });
          const histData = await getConversations(savedToken);
          setConversations(histData.conversations || []);
        } catch {
          await clearSession();
        }
      } finally {
        setBooting(false);
      }
    };

    bootstrap();
  }, []);

  const handleAuthSubmit = async ({ email, password, displayName, mode }) => {
    setBusy(true);
    try {
      let data;
      if (mode === 'login') {
        data = await login({ email: email.trim(), password });
      } else {
        data = await register({ email: email.trim(), password, display_name: displayName.trim() });
        // If register succeeds, auto-login if backend returns token, or prompt to login
        if (!data.token) {
          Alert.alert('Success', 'Registration successful! Please sign in with your credentials.');
          setBusy(false);
          return;
        }
      }
      
      const nextToken = data.token;
      const nextUser = data.user || null;
      setToken(nextToken);
      setUser(nextUser);
      await saveSession({ token: nextToken, user: nextUser });
      const histData = await getConversations(nextToken);
      setConversations(histData.conversations || []);
    } catch (err) {
      Alert.alert('Auth failed', err?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLoginPress = () => {
    Alert.alert(
      'Google Login',
      'Google login is coming soon to the mobile app! For now, please use your email and password.',
      [{ text: 'OK' }]
    );
  };

  const handleLogout = async () => {
    await clearSession();
    setToken(null);
    setUser(null);
    setAnswer('');
    setConversations([]);
    setActiveConversationId(null);
    setActiveView('chat');
  };

  const handleLoadConversation = async (id) => {
    setBusy(true);
    setShowHistory(false);
    try {
      const data = await getConversationDetails(token, id);
      setActiveConversationId(id);
      const lastMsg = data.history && data.history[data.history.length - 1];
      if (lastMsg) {
        setQuestion(lastMsg.user_question || '');
        setAnswer(lastMsg.ai_response || '');
        setCode(lastMsg.code_snippet || '');
      }
      setActiveView('chat');
    } catch (err) {
      Alert.alert('Error', 'Failed to load conversation.');
    } finally {
      setBusy(false);
    }
  };

  const handleAsk = async () => {
    if (!token) return;
    if (!question.trim()) {
      Alert.alert('Question required', 'Please enter a question.');
      return;
    }

    setBusy(true);
    try {
      const data = await askQuestion({
        token,
        question: question.trim(),
        code,
        model: selectedModels[0] || 'auto',
        conversationId: activeConversationId,
      });
      setAnswer(data.answer || data.response || JSON.stringify(data, null, 2));
      if (data.conversation_id) setActiveConversationId(data.conversation_id);
      refreshUserInfo();
      fetchHistory();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert('Request failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAlchemyCompare = async (q, models) => {
    if (!token) {
      Alert.alert('Not signed in', 'Please sign in.');
      return;
    }
    setComparing(true);
    try {
      const jobs = models.map(async (m) => {
        try {
          const res = await askQuestion({ token, question: q, code: '', model: m, conversationId: activeConversationId });
          return { model: m, response: res.answer || res.response || JSON.stringify(res) };
        } catch (e) {
          return { model: m, response: `Error: ${e?.message || e}` };
        }
      });

      const results = await Promise.all(jobs);
      setComparisons(results);
      refreshUserInfo();
      fetchHistory();
    } finally {
      setComparing(false);
    }
  };

  const handleShareToCommunity = async () => {
    if (!token) {
      Alert.alert('Error', 'Please log in to share.');
      return;
    }
    setShowCreatePost(true);
  };

  const renderView = () => {
    switch (activeView) {
      case 'chat':
        return (
          <View style={styles.flex}>
            <ScrollView 
              ref={scrollRef}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {!question && !answer && (
                <View style={styles.chatWelcome}>
                  <Text style={styles.welcomeTitle}>Alchemy Engine Ready</Text>
                  <Text style={styles.welcomeSub}>Transmute your code with AI</Text>
                  <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setQuestion('Explain this code...')}>
                      <Text style={styles.quickActionText}>💡 Explain</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setQuestion('Optimize this function...')}>
                      <Text style={styles.quickActionText}>⚡ Optimize</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => setQuestion('Find bugs in...')}>
                      <Text style={styles.quickActionText}>🐛 Debug</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {question && (
                <View style={styles.userBubbleContainer}>
                  <View style={styles.userBubble}>
                    <Text style={styles.bubbleText}>{question}</Text>
                    {code ? <Text style={styles.bubbleCode} numberOfLines={3}>{code}</Text> : null}
                  </View>
                </View>
              )}

              {busy && (
                <View style={styles.aiBubbleContainer}>
                  <View style={[styles.aiBubble, styles.busyBubble]}>
                    <ActivityIndicator color="#d946ef" size="small" />
                    <Text style={styles.busyText}>Transmuting...</Text>
                  </View>
                </View>
              )}

              {answer && !busy && (
                <View style={styles.aiBubbleContainer}>
                  <View style={styles.aiBubble}>
                  <View style={styles.aiBubbleHeader}>
                    <Text style={styles.aiName}>CodeAlchemist</Text>
                    <TouchableOpacity onPress={handleShareToCommunity}>
                      <Text style={styles.shareText}>🚀 Share</Text>
                    </TouchableOpacity>
                  </View>
                    <Text style={styles.aiText}>{answer}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.chatFooter}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type your message..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={question}
                  onChangeText={setQuestion}
                />
                <TouchableOpacity 
                  style={[styles.sendBtn, !question.trim() && styles.disabledSend]} 
                  onPress={handleAsk}
                  disabled={busy || !question.trim()}
                >
                  <Text style={styles.sendIcon}>➔</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chatActions}>
                <ModelSelector 
                  models={availableModels} 
                  selected={selectedModels} 
                  onChange={setSelectedModels} 
                  compact={true}
                />
                <TouchableOpacity style={styles.codeToggle} onPress={() => Alert.prompt('Add Code', 'Paste your snippet', text => setCode(text))}>
                  <Text style={styles.codeToggleText}>{code ? '✅ Code' : '➕ Code'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      case 'compare':
        return (
          <ComparisonScreen 
            availableModels={availableModels}
            onCompare={handleAlchemyCompare}
            busy={comparing}
            results={comparisons}
          />
        );
      case 'snippets':
        return <SnippetManager token={token} />;
      case 'stats':
        return <StatsView token={token} user={user} />;
      case 'cost':
        return <BillingView token={token} />;
      case 'feed':
      case 'community':
        return (
          <CommunityFeed 
            token={token} 
            mode={activeView === 'feed' ? 'following' : 'all'}
            onSelectPost={(post) => {
              setQuestion(post.user_question || '');
              setAnswer(post.ai_response || '');
              setCode(post.code_snippet || '');
              setActiveView('chat');
            }} 
          />
        );
      case 'weekly':
        return <WeeklySummary token={token} />;
      case 'profile':
        return <ProfileView user={user} onLogout={handleLogout} />;
      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    switch (activeView) {
      case 'chat': return 'AI Chat';
      case 'compare': return 'Model Alchemy';
      case 'snippets': return 'Code Snippets';
      case 'stats': return 'My Rank & Stats';
      case 'cost': return 'Cost Dashboard';
      case 'feed': return 'Following Feed';
      case 'community': return 'Community Feed';
      case 'weekly': return 'Weekly Summary';
      case 'profile': return 'My Profile';
      default: return 'CodeAlchemist';
    }
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <Image 
          source={require('./assets/logo.png')}
          style={styles.bootLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#d946ef" style={{ marginTop: 20 }} />
        <Text style={styles.subtle}>AI ALCHEMY ENGINE • Initializing...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        user={user} 
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onSharePress={() => setShowCreatePost(true)}
      />

      <CreatePostModal 
        visible={showCreatePost} 
        onClose={() => setShowCreatePost(false)} 
        token={token} 
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {!token ? (
          <LoginScreen 
            onLogin={handleAuthSubmit} 
            onGoogleLogin={handleGoogleLoginPress}
            loading={busy}
          />
        ) : (
          <View style={styles.flex}>
            <View style={styles.mainHeader}>
              <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuButton}>
                <Text style={styles.menuButtonText}>☰</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
              {token && (
                <TouchableOpacity onPress={() => { fetchHistory(); setShowHistory(true); }}>
                  <Text style={styles.historyBtnIcon}>🕒</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.viewContainer}>
              {renderView()}
            </View>
          </View>
        )}

        {/* History Modal */}
        <Modal visible={showHistory} transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={() => setShowHistory(false)} />
          <View style={styles.historyContainer}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.historyList}>
              {conversations.length === 0 ? (
                <Text style={styles.emptyText}>Your alchemy book is empty.</Text>
              ) : (
                conversations.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.historyItem} onPress={() => handleLoadConversation(c.id)}>
                    <View style={styles.historyItemMain}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>{c.title || 'Untitled Session'}</Text>
                      <Text style={styles.historyItemDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { Alert.alert('Delete', 'Delete this session?', [{ text: 'Cancel' }, { text: 'Delete', onPress: () => deleteConversation(token, c.id).then(() => fetchHistory()) }]) }}>
                      <Text style={styles.deleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  flex: { flex: 1 },
  containerCenter: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  bootLogo: {
    width: width * 0.8,
    height: 120,
  },
  subtle: { color: '#64748b', fontSize: 12, marginTop: 12, fontWeight: '700', letterSpacing: 1 },
  
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  menuButton: { padding: 4 },
  menuButtonText: { color: '#fff', fontSize: 24 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  historyBtnIcon: { fontSize: 20 },
  
  viewContainer: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  chatWelcome: { alignItems: 'center', marginTop: 60, padding: 20 },
  welcomeTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  welcomeSub: { color: '#64748b', fontSize: 14, marginBottom: 30 },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickAction: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#1e293b' },
  quickActionText: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },

  userBubbleContainer: { alignItems: 'flex-end', marginBottom: 20 },
  userBubble: {
    backgroundColor: '#701a75',
    padding: 14,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    maxWidth: '85%',
  },
  aiBubbleContainer: { alignItems: 'flex-start', marginBottom: 20 },
  aiBubble: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  aiBubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  aiName: { color: '#d946ef', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  shareText: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  busyBubble: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  busyText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  bubbleCode: { color: '#d946ef', fontSize: 12, fontFamily: 'monospace', marginTop: 8, opacity: 0.8 },
  aiText: { color: '#cbd5e1', fontSize: 15, lineHeight: 24 },

  chatFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#020617',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
  },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  chatInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: '#d946ef',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSend: { backgroundColor: '#334155', opacity: 0.5 },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '900' },
  chatActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingHorizontal: 4 },
  codeToggle: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  codeToggleText: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },

  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 10 },
  input: {
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 16,
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#020617',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#d946ef',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  // History Modal Styles
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.95)' },
  historyContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: '#1e293b',
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  historyTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  closeText: { color: '#64748b', fontSize: 20, fontWeight: '600' },
  historyList: { padding: 12 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#020617',
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  historyItemMain: { flex: 1 },
  historyItemTitle: { color: '#f1f5f9', fontWeight: '800', fontSize: 16 },
  historyItemDate: { color: '#475569', fontSize: 12, marginTop: 4, fontWeight: '600' },
  deleteText: { fontSize: 18, marginLeft: 12 },
  emptyText: { color: '#64748b', textAlign: 'center', padding: 40, fontWeight: '600' },
});
