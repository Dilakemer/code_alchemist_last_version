import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactDiffViewer from 'react-diff-viewer-continued';
import SimilarSolutions from './SimilarSolutions';
import PromptTemplates from './PromptTemplates';
import GitHubGraph from './GitHubGraph';
import useTypingEffect from '../hooks/useTypingEffect';
import VoiceRecorder from './VoiceRecorder';


const SmartMarkdown = React.memo(({ content, isStreaming, syntaxTheme, onCopyCode, copiedCodeId, messageId, onGenerateTests, generatingTestId }) => {
  // Smooth typing effect
  const displayedText = useTypingEffect(content, isStreaming);

  return (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');
          const codeBlockId = `${messageId}-${match ? match[1] : 'code'}-${codeString.slice(0, 20)}`;

          return !inline && match ? (
            <div className="relative group my-4">
              <div className="flex items-center justify-between bg-gray-900 px-4 py-2 rounded-t-lg border-b border-gray-700">
                <span className="text-xs text-gray-400 font-mono uppercase">{match[1]}</span>
                <div className="flex items-center gap-2">
                  {onGenerateTests && (
                    <button
                      onClick={() => onGenerateTests(codeString, match[1], codeBlockId)}
                      disabled={generatingTestId === codeBlockId}
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700 disabled:opacity-50"
                      title="Generate Unit Tests (AI)"
                    >
                      {generatingTestId === codeBlockId ? (
                        <>
                          <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <span>🧪</span>
                          <span>Generate Tests</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => onCopyCode(codeString, codeBlockId)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                    title="Copy Code"
                  >
                    {copiedCodeId === codeBlockId ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Robust Diff Check: Trigger if markers present, regardless of language tag */}
              {(codeString.includes('<<<OLD>>>') && codeString.includes('<<<NEW>>>')) ? (
                (() => {
                  try {
                    const oldPart = codeString.split('<<<OLD>>>')[1].split('<<<NEW>>>')[0].trim();
                    const newPart = codeString.split('<<<NEW>>>')[1].trim();
                    return (
                      <div className="rounded-b-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] text-xs">
                        <ReactDiffViewer
                          oldValue={oldPart}
                          newValue={newPart}
                          splitView={true}
                          useDarkTheme={true}
                          styles={{
                            variables: {
                              dark: {
                                diffViewerBackground: '#1e1e1e',
                                addedBackground: '#064e3b',
                                addedColor: '#86efac',
                                removedBackground: '#7f1d1d',
                                removedColor: '#fca5a5',
                                wordAddedBackground: '#166534',
                                wordRemovedBackground: '#991b1b',
                                addedGutterBackground: '#064e3b',
                                removedGutterBackground: '#7f1d1d',
                                gutterBackground: '#1e1e1e',
                                gutterBackgroundDark: '#1e1e1e',
                                gutterColor: '#6b7280',
                                emptyLineBackground: '#1e1e1e',
                              }
                            }
                          }}
                        />
                      </div>
                    );
                  } catch (e) {
                    console.error("Diff Parsing Error:", e);
                    return (
                      <SyntaxHighlighter
                        style={syntaxTheme}
                        language={match[1] || 'text'}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderTopLeftRadius: 0,
                          borderTopRightRadius: 0,
                          borderBottomLeftRadius: '0.5rem',
                          borderBottomRightRadius: '0.5rem'
                        }}
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    );
                  }
                })()
              ) : (
                <SyntaxHighlighter
                  style={syntaxTheme}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    borderBottomLeftRadius: '0.5rem',
                    borderBottomRightRadius: '0.5rem'
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              )}
            </div>
          ) : (
            <code className={`${className || ''} bg-gray-700/50 px-1.5 py-0.5 rounded text-fuchsia-300`} {...props}>
              {children}
            </code>
          );
        },
        img({ node, ...props }) {
          return (
            <img
              {...props}
              className="max-w-full max-h-[500px] h-auto rounded-lg border border-gray-700 shadow-md my-4 object-contain"
              loading="lazy"
              alt={props.alt || "AI Generated Image"}
            />
          );
        }
      }}
    >
      {displayedText}
    </ReactMarkdown>
  );
});

const ChatInterface = ({
  history,
  loading,
  onAsk,
  question,
  setQuestion,
  code,
  setCode,
  user,
  onAuthRequired,
  apiBase,
  authHeaders,
  onUpdate,
  image,
  setImage,
  theme,
  onSpeak,
  currentlySpeakingId,
  onShare,
  activeConversationId,
  onShowCodeHealth
}) => {
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [expandedReasoning, setExpandedReasoning] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [favorites, setFavorites] = useState(new Set());

  // GitHub Repo Link State
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubRepoInput, setGithubRepoInput] = useState('');
  const [githubBranchInput, setGithubBranchInput] = useState('main');
  const [isLinkingRepo, setIsLinkingRepo] = useState(false);
  const [linkedRepo, setLinkedRepo] = useState(null);

  // Graph State
  const [showGraph, setShowGraph] = useState(false);

  // Magic Fix State
  const [isMagicFix, setIsMagicFix] = useState(false);

  // PR Modal State
  const [showPrModal, setShowPrModal] = useState(false);
  const [prFormData, setPrFormData] = useState({
    codeBlocks: [],
    currentBlockIndex: 0,
    newBranch: 'code-alchemist-fix',
    prTitle: 'AI Generated Fix',
    isSubmitting: false,
    aiResponseId: null,
  });

  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', url: null });
  const [generatingTestId, setGeneratingTestId] = useState(null);

  // Security Audit Modal State
  const [auditModal, setAuditModal] = useState({
    show: false,
    issues: [],
    onConfirm: null,
    onCancel: null
  });

  const showToast = (message, type = 'success', url = null) => {
    setToast({ show: true, message, type, url });
    if (!url) { // Keep URL toasts open longer to allow clicking
      setTimeout(() => setToast({ show: false, message: '', type: 'success', url: null }), 4000);
    }
  };

  // Check for error patterns in input
  useEffect(() => {
    const errorPattern = /(Traceback|Error|Exception|TypeError|ValueError|ReferenceError|SyntaxError|IndexError|KeyError|ModuleNotFoundError|RuntimeError|Hata|Failed|Failure)\b/i;
    setIsMagicFix(errorPattern.test(question));
  }, [question]);

  const handleCreatePRInit = (historyId, aiResponse) => {
    if (!linkedRepo) {
      showToast("Please link a repository first to create a PR.", "error");
      return;
    }

    if (!user) {
      onAuthRequired?.();
      return;
    }

    // Attempt to extract code blocks
    const extractedBlocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(aiResponse)) !== null) {
      const content = match[2];
      const matchIndex = match.index;
      const textBefore = aiResponse.substring(0, matchIndex).trim().split('\n').pop();
      let path = textBefore.replace(/[`:]/g, '').trim();

      extractedBlocks.push({
        path: path && !path.includes(' ') ? path : '',
        content
      });
    }

    if (extractedBlocks.length === 0) {
      showToast("No code blocks found in the response to create a PR.", "error");
      return;
    }

    setPrFormData({
      codeBlocks: extractedBlocks,
      currentBlockIndex: extractedBlocks.findIndex(b => !b.path), // First block without a path
      newBranch: 'code-alchemist-fix',
      prTitle: 'AI Generated Fix',
      isSubmitting: false,
      aiResponseId: historyId
    });

    setShowPrModal(true);
  };

  const submitPR = async () => {
    // Validate paths
    const missingPaths = prFormData.codeBlocks.some(b => !b.path.trim());
    if (missingPaths) {
      showToast("Please provide file paths for all code blocks.", "error");
      return;
    }

    setPrFormData(prev => ({ ...prev, isSubmitting: true }));

    try {
      const repoName = linkedRepo.split(' ')[0]; // remove the branch part (main)
      const baseBranch = githubBranchInput || 'main';

      // 1. AI Pre-flight & Security Audit
      try {
        const auditRes = await fetch(`${apiBase}/api/github/audit_pr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ file_changes: prFormData.codeBlocks })
        });
        const auditData = await auditRes.json();

        if (!auditData.passed && auditData.issues && auditData.issues.length > 0) {
          // Pause and show custom modal instead of window.confirm
          setPrFormData(prev => ({ ...prev, isSubmitting: false }));
          setAuditModal({
            show: true,
            issues: auditData.issues,
            onConfirm: () => {
              setAuditModal(prev => ({ ...prev, show: false }));
              // User chose to proceed, re-trigger submit with a flag or isolated function
              executePRSubmission();
            },
            onCancel: () => {
              setAuditModal({ show: false, issues: [], onConfirm: null, onCancel: null });
            }
          });
          return; // Stop current execution, wait for modal un-pause
        }
      } catch (err) {
        console.warn("Audit check failed; proceeding with PR", err);
      }

      await executePRSubmission();
    } catch (err) {
      console.error("Submit PR Error:", err);
      setPrFormData(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const executePRSubmission = async () => {
    setPrFormData(prev => ({ ...prev, isSubmitting: true }));
    try {
      // 2. Submit Pull Request
      const res = await fetch(`${apiBase}/api/github/pr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          repo: repoName,
          base_branch: baseBranch,
          new_branch: prFormData.newBranch,
          title: prFormData.prTitle,
          file_changes: prFormData.codeBlocks
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowPrModal(false);
        showToast("Pull request created successfully! 🚀", "success", data.pr_url);
      } else {
        showToast(data.error || "Failed to create PR.", "error");
      }
    } catch (err) {
      showToast("Error creating PR.", "error");
      console.error(err);
    } finally {
      if (showPrModal) { // only if not closed above
        setPrFormData(prev => ({ ...prev, isSubmitting: false }));
      }
    }
  };

  const handleGenerateTests = async (codeString, language, codeBlockId) => {
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setGeneratingTestId(codeBlockId);
    try {
      showToast("Generating unit tests via AI...", "success");
      const res = await fetch(`${apiBase}/api/generate_tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ code: codeString, language })
      });
      const data = await res.json();
      if (res.ok && data.tests) {
        // Prepare generated tests as a markdown codeblock
        const generatedMarkdown = `\n\n**Generated Unit Tests:**\n\`\`\`${language}\n${data.tests}\n\`\`\``;
        setQuestion(prev => `${prev}\n${generatedMarkdown}`.trim());
        showToast("Tests generated! Added to your text input below.", "success");
      } else {
        showToast(data.error || "Failed to generate tests.", "error");
      }
    } catch (err) {
      showToast("Error generating tests.", "error");
    } finally {
      setGeneratingTestId(null);
    }
  };

  const handleLinkGithub = async (e) => {
    e?.preventDefault();
    if (!user) {
      onAuthRequired?.();
      setShowGithubModal(false);
      return;
    }
    // REMOVED: conversation_id is now optional for verification
    if (!activeConversationId) {
      showToast("Please send a message first to start a conversation before linking a repository.", "error");
      setShowGithubModal(false);
      return;
    }

    if (!githubRepoInput.trim()) return;

    setIsLinkingRepo(true);
    try {
      // Sanitize the GitHub URL (remove query parameters and fragments)
      const cleanRepoUrl = githubRepoInput.split('?')[0].split('#')[0].trim();

      const res = await fetch(`${apiBase}/api/github/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          repo: cleanRepoUrl,
          branch: githubBranchInput,
          conversation_id: activeConversationId || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Use repo/branch from response or input
        const finalRepo = data.repo || cleanRepoUrl;
        const finalBranch = data.branch || githubBranchInput;
        setLinkedRepo(`${finalRepo} (${finalBranch})`);

        // If no active conversation, we need to notify the parent (App.jsx)
        // so it can include this repo in the FIRST message sent.
        if (!activeConversationId && onUpdate) {
          onUpdate({ linkedRepo: finalRepo, linkedBranch: finalBranch });
        }

        alert(data.message + ` (${data.tree_size} files indexed)`); // keep alert here or change to toast if preferred, keeping as alert as per original for linking
        showToast(data.message + ` (${data.tree_size} files indexed)`, "success");
        setShowGithubModal(false);
      } else {
        showToast(data.error || "Failed to link repo.", "error");
      }
    } catch (err) {
      showToast("Error linking repository.", "error");
      console.error(err);
    } finally {
      setIsLinkingRepo(false);
    }
  };

  // Select theme based on current theme prop
  const syntaxTheme = theme === 'light' ? prism : atomDark;

  // Favorileri yükle
  useEffect(() => {
    if (user && authHeaders) {
      fetch(`${apiBase}/api/favorites`, { headers: authHeaders })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setFavorites(new Set(data.map(f => f.history_id)));
          }
        })
        .catch(err => console.error('Error loading favorites:', err));
    }
  }, [user, authHeaders, apiBase]);


  const toggleFavorite = async (historyId) => {
    if (!user) {
      onAuthRequired?.();
      return;
    }

    const isFavorite = favorites.has(historyId);

    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFavorite) {
        next.delete(historyId);
      } else {
        next.add(historyId);
      }
      return next;
    });

    try {
      const res = await fetch(`${apiBase}/api/favorites/${historyId}`, {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: authHeaders
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Status ${res.status}`);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      // Revert optimization on error
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFavorite) {
          next.add(historyId); // Re-add if we optimistically removed
        } else {
          next.delete(historyId); // Remove if we optimistically added
        }
        return next;
      });
      alert(`Favorilere eklenirken hata: ${err.message} (ID: ${historyId})`);
    }
  };

  const formatDateOnly = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
    const fallback = Number(value);
    if (!Number.isNaN(fallback)) {
      const numericDate = new Date(fallback);
      if (!Number.isNaN(numericDate.getTime())) {
        return numericDate.toLocaleDateString('en-US');
      }
    }
    // If parsing fails, show original without time part if possible
    const asString = String(value);
    return asString.split(' ')[0];
  };

  const copyCodeToClipboard = async (code, blockId) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(blockId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch (err) {
      console.error('Code copy failed:', err);
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Optimized scroll effect - prevents jitter during message streaming
  useEffect(() => {
    if (!bottomRef.current || !loading) return;

    const parent = bottomRef.current.parentElement;
    if (!parent) return;

    // Only auto-scroll if the user is already at the bottom
    // This allows them to scroll up and stay there without being "pulled down"
    const isNearBottom = parent.scrollHeight - parent.scrollTop - parent.clientHeight < 300;

    if (isNearBottom) {
      bottomRef.current.scrollIntoView({
        behavior: 'auto', // 'auto' is much more performant than 'smooth' during streaming
        block: 'nearest'
      });
    }
  }, [history[history.length - 1]?.ai_response?.length, loading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (question.trim() || image) {
        onAsk();
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const toggleSolutions = (id) => {
    setExpandedHistoryId(expandedHistoryId === id ? null : id);
  };

  const toggleReasoning = (id) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar"
        style={{ overflowAnchor: 'auto', scrollBehavior: loading ? 'auto' : 'smooth' }}
      >
        {history.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] animate-fadeIn">
            {/* Animated Merhaba */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-pulse">
                {user ? `Hello, ${user.display_name}!` : 'Hello!'}
              </h1>
              <div className="flask-container animate-bounce">
                <svg width="80" height="90" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
                  <defs>
                    <clipPath id="flask-clip">
                      <path d="M22 2 L38 2 L38 25 L58 75 Q60 80 55 80 L5 80 Q0 80 2 75 L22 25 Z" />
                    </clipPath>
                    <linearGradient id="liquid-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>

                  {/* Glass Background */}
                  <path
                    d="M22 2 L38 2 L38 25 L58 75 Q60 80 55 80 L5 80 Q0 80 2 75 L22 25 Z"
                    fill="rgba(255, 255, 255, 0.1)"
                    stroke="rgba(255, 255, 255, 0.8)"
                    strokeWidth="3"
                  />

                  {/* Liquid & Bubbles Group (Clipped) */}
                  <g clipPath="url(#flask-clip)">
                    {/* Liquid Level */}
                    <rect x="0" y="45" width="60" height="40" fill="url(#liquid-gradient)" className="animate-[pulse_3s_ease-in-out_infinite] opacity-90" />

                    {/* Bubbles */}
                    <circle cx="30" cy="70" r="3" fill="white" fillOpacity="0.6" className="animate-[ping_2s_linear_infinite]" />
                    <circle cx="20" cy="65" r="2" fill="white" fillOpacity="0.5" className="animate-[bounce_3s_infinite]" />
                    <circle cx="40" cy="60" r="2" fill="white" fillOpacity="0.4" className="animate-[pulse_1.5s_infinite]" />

                    {/* Liquid Surface Line */}
                    <path d="M0 45 Q30 50 60 45" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none" />
                  </g>

                  {/* Flask Highlights/Reflections */}
                  <path d="M25 30 L10 70" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M35 5 L35 20" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />

                  {/* Rim */}
                  <rect x="20" y="0" width="20" height="4" rx="2" fill="rgba(255,255,255,0.9)" />
                </svg>
              </div>
            </div>
            <div className="text-center space-y-2 animate-slideUp flex flex-col items-center">
              <p className="text-xl text-gray-300">
                {user ? 'How can I help you?' : '⚗️ Login to discover all my formulas!'}
              </p>
              <p className="text-sm text-gray-500">
                {user ? 'Ask a question or share code' : 'My magic potions await you...'}
              </p>
            </div>
            {/* Decorative elements */}
            <div className="mt-8 flex justify-center gap-4">
              <div className="w-3 h-3 rounded-full bg-fuchsia-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}



        {history.map((turn, index) => (
          <div key={turn.id || index} className="space-y-4">
            {/* User Question */}
            <div className="flex justify-end">
              <div className="bg-gray-800/80 text-gray-100 p-4 rounded-2xl rounded-tr-none max-w-[85%] border border-gray-700 shadow-lg">
                {turn.image_url && (
                  <div className="mb-3">
                    {/* Check if it's an image or other file type */}
                    {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(turn.image_url) ? (
                      <img
                        src={`${apiBase}${turn.image_url}`}
                        alt="Uploaded Image"
                        className="max-w-full h-auto rounded-lg border border-gray-600"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    {/* File indicator for non-image files */}
                    {!/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(turn.image_url) && (
                      <div className="flex items-center gap-2 bg-gray-900/80 px-3 py-2 rounded-lg border border-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-300">
                          📎 {turn.image_url.split('/').pop()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="font-medium text-sm mb-1 text-fuchsia-400">You</div>
                <div className="whitespace-pre-wrap">{turn.user_question}</div>
                {turn.code_snippet && (
                  <div className="mt-3 bg-black/50 rounded-lg overflow-hidden border border-gray-700">
                    <div className="bg-gray-900/50 px-3 py-1 text-xs text-gray-400 border-b border-gray-700">Code Snippet</div>
                    <SyntaxHighlighter language="javascript" style={syntaxTheme} customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}>
                      {turn.code_snippet}
                    </SyntaxHighlighter>
                  </div>
                )}
              </div>
            </div>

            {/* AI Response - Check if it's a comparison or regular response */}
            {turn.isComparison ? (
              /* Model Comparison: Side-by-side dual responses */
              <div className="flex flex-col w-full">
                <div className="flex items-center gap-2 mb-2 text-xs text-fuchsia-300">
                  <span>⚗️ Model Alchemy Comparison</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">{turn.timestamp}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {/* Response 1 */}
                  <div
                    className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${turn.selectedResponse === 1
                      ? 'border-green-500 bg-green-900/10 ring-2 ring-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                      : 'border-gray-700 bg-gray-800/50 opacity-60'
                      }`}
                    style={{ borderTopColor: turn.model1Color }}
                  >
                    {turn.selectedResponse === 1 && (
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-lg">
                        ✓ Selected
                      </div>
                    )}
                    <p className="font-medium text-xs mb-2 flex items-center gap-2" style={{ color: turn.model1Color }}>
                      <span>🧪</span>
                      <span>{turn.model1Label}</span>
                    </p>
                    <div className="prose prose-invert prose-sm max-w-none text-sm max-h-[300px] overflow-y-auto custom-scrollbar">
                      <SmartMarkdown
                        content={turn.response1}
                        isStreaming={loading && index === history.length - 1}
                        syntaxTheme={syntaxTheme}
                        onCopyCode={copyCodeToClipboard}
                        copiedCodeId={copiedCodeId}
                        messageId={`${turn.id}-r1`}
                        onGenerateTests={handleGenerateTests}
                        generatingTestId={generatingTestId}
                      />
                    </div>
                  </div>

                  {/* Response 2 */}
                  <div
                    className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${turn.selectedResponse === 2
                      ? 'border-green-500 bg-green-900/10 ring-2 ring-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                      : 'border-gray-700 bg-gray-800/50 opacity-60'
                      }`}
                    style={{ borderTopColor: turn.model2Color }}
                  >
                    {turn.selectedResponse === 2 && (
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-lg">
                        ✓ Selected
                      </div>
                    )}
                    <p className="font-medium text-xs mb-2 flex items-center gap-2" style={{ color: turn.model2Color }}>
                      <span>🧪</span>
                      <span>{turn.model2Label}</span>
                    </p>
                    <div className="prose prose-invert prose-sm max-w-none text-sm max-h-[300px] overflow-y-auto custom-scrollbar">
                      <SmartMarkdown
                        content={turn.response2}
                        isStreaming={loading && index === history.length - 1}
                        syntaxTheme={syntaxTheme}
                        onCopyCode={copyCodeToClipboard}
                        copiedCodeId={copiedCodeId}
                        messageId={`${turn.id}-r2`}
                        onGenerateTests={handleGenerateTests}
                        generatingTestId={generatingTestId}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Regular AI Response */
              <div className="flex flex-col items-start max-w-[90%]">
                <div className="bg-gray-800/90 text-gray-100 px-5 py-4 rounded-2xl rounded-tl-none w-full shadow-lg border border-gray-700/50">
                  <p className="font-medium mb-2 text-xs text-fuchsia-300 flex items-center flex-wrap gap-2">
                    <span className="flex items-center gap-1">
                      <span>{turn.selected_model || 'AI'}</span>
                      {turn.persona && (
                        <span className="bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0.5 rounded border border-fuchsia-500/30 text-[10px] animate-pulse">
                          ✨ Personalized ({turn.persona})
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">{formatDateOnly(turn.timestamp)}</span>
                  </p>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <SmartMarkdown
                      content={turn.ai_response}
                      isStreaming={loading && index === history.length - 1}
                      syntaxTheme={syntaxTheme}
                      onCopyCode={copyCodeToClipboard}
                      copiedCodeId={copiedCodeId}
                      messageId={turn.id}
                      onGenerateTests={handleGenerateTests}
                      generatingTestId={generatingTestId}
                    />
                  </div>

                  {/* Reasoning / Explainable AI Layer */}
                  {(turn.reasoning || turn.routing_reason) && (
                    <div className="mt-4 bg-cyan-950/20 border border-cyan-500/30 rounded-xl overflow-hidden transition-all duration-300">
                      <button
                        onClick={() => toggleReasoning(turn.id)}
                        className="w-full flex items-center justify-between p-3 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-bold uppercase tracking-tighter">
                          <span className="text-xs">⚖️</span>
                          <span className="text-[10px]">AI Reasoning Layer</span>
                        </div>
                        <span className={`text-[10px] transform transition-transform duration-300 ${expandedReasoning.has(turn.id) ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>

                      {expandedReasoning.has(turn.id) && (
                        <div className="p-3 pt-0 animate-fadeIn">
                          <div className="opacity-90 leading-relaxed italic text-[10px] text-cyan-200/80 border-t border-cyan-500/20 pt-2 space-y-2">
                            {turn.routing_reason && (
                              <div className="mb-2 text-cyan-400 not-italic">
                                <strong>Routing Info:</strong> {turn.routing_reason}
                              </div>
                            )}
                            {turn.reasoning && (
                              <ReactMarkdown>{turn.reasoning}</ReactMarkdown>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Action Buttons */}
                  {(!loading || index !== history.length - 1) && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-700/50 animate-fadeIn">
                      {/* Copy Button */}
                      <button
                        onClick={() => copyToClipboard(turn.ai_response, turn.id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-fuchsia-300 transition-colors"
                        title="Copy Response"
                      >
                        {copiedId === turn.id ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Favorite Button */}
                      <button
                        onClick={() => toggleFavorite(turn.id)}
                        className={`flex items-center gap-1 text-xs transition-colors ${favorites.has(turn.id)
                          ? 'text-yellow-400'
                          : 'text-gray-400 hover:text-yellow-400'
                          }`}
                        title={favorites.has(turn.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={favorites.has(turn.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <span>{favorites.has(turn.id) ? 'Saved' : 'Save'}</span>
                      </button>

                      {/* Voice Alchemy: Listen Toggle Button */}
                      <button
                        onClick={() => onSpeak(turn.ai_response, turn.id)}
                        className={`flex items-center gap-1 text-xs transition-colors ${currentlySpeakingId === turn.id ? 'text-fuchsia-400' : 'text-gray-400 hover:text-fuchsia-400'}`}
                        title={currentlySpeakingId === turn.id ? "Stop Listening" : "Listen to Response"}
                      >
                        {currentlySpeakingId === turn.id ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        )}
                        <span>{currentlySpeakingId === turn.id ? 'Playing...' : 'Listen'}</span>
                      </button>

                      {/* Create GitHub PR Button (Visible only if repo is linked and has code) */}
                      {linkedRepo && turn.ai_response.includes('```') && (
                        <button
                          onClick={() => handleCreatePRInit(turn.id, turn.ai_response)}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors ml-2 px-2 py-1 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-500/30 rounded"
                          title="Generate a Pull Request on GitHub for these changes"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                          <span>Create PR</span>
                        </button>
                      )}

                      {/* Continue Button - Show only for last response */}
                      {index === history.length - 1 && turn.ai_response && (
                        <button
                          onClick={() => setQuestion('Please continue and provide more details on this.')}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-fuchsia-300 transition-colors"
                          title="Expand Response"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                          <span>Continue</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Community Solutions Toggle */}
                <button
                  onClick={() => toggleSolutions(turn.id)}
                  className="mt-2 text-xs text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 ml-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  {expandedHistoryId === turn.id ? 'Hide Solutions' : 'Community Solutions'}
                </button>

                {/* Similar Community Solutions Section */}
                {expandedHistoryId === turn.id && (
                  <div className="w-full mt-2 animate-fadeIn">
                    <SimilarSolutions
                      historyId={turn.id}
                      userQuestion={turn.user_question}
                      apiBase={apiBase}
                      authHeaders={authHeaders}
                      user={user}
                      onAuthRequired={onAuthRequired}
                      onSelectPost={(post) => {
                        // Kullanıcıyı topluluk sayfasına yönlendirebiliriz
                        window.open(`${apiBase}/api/community/posts/${post.id}`, '_blank');
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 animate-fadeIn">
            <div className="relative w-12 h-12 mb-2">
              <div className="absolute inset-0 bg-fuchsia-500/20 rounded-full animate-ping" />
              <div className="absolute inset-2 bg-gradient-to-tr from-purple-600 to-fuchsia-600 rounded-full animate-spin shadow-[0_0_15px_rgba(192,38,211,0.5)]">
                <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full opacity-60" />
              </div>
            </div>
            <p className="text-[10px] font-mono text-fuchsia-400 uppercase tracking-widest animate-pulse">
              ⚗️ Transmuting Knowledge...
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-900/50 border-t border-gray-800 backdrop-blur-md mobile-input-area">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Prompt Templates */}
          <PromptTemplates
            onSelect={(prompt) => setQuestion(question ? `${question}\n\n${prompt}` : prompt)}
            visible={history.length === 0 && !loading}
          />

          {/* File Preview */}
          {image && (
            <div className="relative inline-block">
              {image.type?.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(image)}
                  alt="Preview"
                  className="h-20 w-auto rounded-lg border border-fuchsia-500/50 shadow-lg"
                />
              ) : image.type?.startsWith('audio/') ? (
                <div className="flex items-center gap-3 bg-gray-800/80 px-4 py-3 rounded-lg border border-fuchsia-500/50">
                  <div className="flex items-center justify-center w-10 h-10 bg-fuchsia-600/30 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-fuchsia-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 10.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-5v-2.07z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-fuchsia-300 font-medium">🎤 Voice Message</span>
                    <span className="text-xs text-gray-500">{(image.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <audio
                    src={URL.createObjectURL(image)}
                    controls
                    className="h-8 max-w-[200px]"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-800/80 px-4 py-2 rounded-lg border border-fuchsia-500/50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-sm">
                    <div className="text-gray-200 font-medium truncate max-w-[150px]">{image.name}</div>
                    <div className="text-gray-500 text-xs">{(image.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          {/* Code Input Toggle */}
          {code && (
            <div className="relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                className="w-full bg-black/50 text-gray-300 text-sm font-mono p-3 rounded-xl border border-gray-700 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 outline-none resize-none h-32 custom-scrollbar"
              />
              <button
                onClick={() => setCode('')}
                className="absolute top-2 right-2 text-gray-500 hover:text-red-400 text-xs bg-gray-900/80 px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2 w-fit">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/20 border border-blue-500/30 rounded-lg text-xs text-blue-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>Linked to: <strong>{linkedRepo}</strong></span>
              <button
                onClick={() => setLinkedRepo(null)}
                className="ml-2 hover:text-white transition-colors"
                title="Remove Link"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGraph(true)}
                className="px-3 py-1.5 bg-pink-900/20 hover:bg-pink-900/40 border border-pink-500/30 rounded-lg text-xs text-pink-300 transition-colors flex items-center gap-1 shadow-sm"
                title="View Context Architecture Graph"
              >
                <span>🌌</span> Graph View
              </button>
              <button
                onClick={onShowCodeHealth}
                className="px-3 py-1.5 bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 transition-colors flex items-center gap-1 shadow-sm shadow-cyan-500/10"
                title="View Code Health Dashboard"
              >
                <span>🌡️</span> Health
              </button>
              {history.length > 0 && (
                <button
                  onClick={onShare}
                  className="px-3 py-1.5 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg text-xs text-purple-300 transition-colors flex items-center gap-1 shadow-sm"
                  title="Share this conversation to the community"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Share to Community</span>
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-800/80 rounded-2xl border border-gray-700/50 focus-within:border-fuchsia-500/50 focus-within:ring-1 focus-within:ring-fuchsia-500/50 shadow-inner flex flex-col transition-all backdrop-blur-sm relative">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question here..."
              className="w-full bg-transparent p-4 outline-none resize-none min-h-[60px] max-h-[200px] custom-scrollbar text-white placeholder-gray-500"
              style={{ minHeight: '60px' }}
            />

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-between px-3 pb-3">
              {/* Left Actions */}
              <div className="flex items-center gap-1">
                <input
                  type="file"
                  accept="image/*,audio/*,.pdf,.txt,.py,.js,.jsx,.ts,.tsx,.json,.md,.csv,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.bat,.ps1,.c,.cpp,.h,.java,.rb,.go,.rs,.php,.swift,.kt,.r,.m"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />

                {/* Paperclip / Attach Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-xl transition-all ${image ? 'text-fuchsia-400 bg-fuchsia-900/30' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                  title="Attach File"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                {/* Voice Recorder */}
                <VoiceRecorder
                  onRecordComplete={(blob) => {
                    const file = new File([blob], `voice_secret_${Date.now()}.webm`, { type: 'audio/webm' });
                    setImage(file);
                  }}
                />

                {/* GitHub Integration */}
                <button
                  onClick={() => setShowGithubModal(true)}
                  className={`p-2 rounded-xl transition-all ${linkedRepo ? 'text-blue-400 bg-blue-900/30' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                  title="Link GitHub Repository"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </button>
              </div>

              {/* Right Actions: Send / Fix */}
              <div className="flex items-center gap-2">
                {isMagicFix ? (
                  <button
                    onClick={(e) => onAsk(e)}
                    disabled={loading || (!question.trim() && !image)}
                    className="flex justify-center items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-400 hover:via-fuchsia-400 hover:to-pink-400 text-white font-bold rounded-full shadow-lg shadow-fuchsia-500/30 transition-all hover:scale-105 animate-pulse-slow disabled:opacity-50 disabled:hover:scale-100"
                    title="Magic Fix (Detects root cause)"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>🪄</span>
                        <span className="text-sm">Fix</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={onAsk}
                    disabled={loading || (!question.trim() && !image)}
                    className="p-2 px-3 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:hover:bg-fuchsia-600 text-white rounded-xl transition-all shadow-lg shadow-fuchsia-900/20 group"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium mr-1 hidden sm:block">Send</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 rotate-90 group-hover:translate-x-1 group-active:translate-y-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>        </div>
      </div>

      {/* GitHub Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />

            <button
              onClick={() => setShowGithubModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <h2 className="text-xl font-bold text-white">Link GitHub Repository</h2>
              </div>

              <p className="text-sm text-gray-400 mb-6">
                Connect a repository to allow the AI to understand your entire project context.
              </p>

              <form onSubmit={handleLinkGithub} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Repository URL or Format (owner/repo)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. username/repository"
                    value={githubRepoInput}
                    onChange={e => setGithubRepoInput(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Branch (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="main"
                    value={githubBranchInput}
                    onChange={e => setGithubBranchInput(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLinkingRepo || !githubRepoInput.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all mt-4"
                >
                  {isLinkingRepo ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting to GitHub...
                    </span>
                  ) : (
                    'Link Repository'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* GitHub Graph Modal */}
      {showGraph && (
        <GitHubGraph
          repo={linkedRepo ? linkedRepo.split(' (')[0] : null}
          branch={githubBranchInput || 'main'}
          conversationId={activeConversationId}
          onClose={() => setShowGraph(false)}
          apiBase={apiBase}
          authHeaders={authHeaders}
        />
      )}

      {/* Modern PR Modal */}
      {showPrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-gray-900 border border-fuchsia-500/30 rounded-2xl w-full max-w-2xl shadow-[0_0_40px_rgba(217,70,239,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold bg-gradient-to-r from-fuchsia-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
                <span>🪄</span> Create Pull Request
              </h3>
              <button
                onClick={() => setShowPrModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {/* Branch & Title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">New Branch Name</label>
                  <input
                    type="text"
                    value={prFormData.newBranch}
                    onChange={(e) => setPrFormData(prev => ({ ...prev, newBranch: e.target.value }))}
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all font-mono text-sm"
                    placeholder="feature/new-button"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Target Branch</label>
                  <input
                    type="text"
                    value={githubBranchInput || 'main'}
                    disabled
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-gray-500 cursor-not-allowed font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">PR Title</label>
                <input
                  type="text"
                  value={prFormData.prTitle}
                  onChange={(e) => setPrFormData(prev => ({ ...prev, prTitle: e.target.value }))}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all"
                  placeholder="e.g. Added login button"
                />
              </div>

              {/* Code Blocks / Files Setup */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-fuchsia-300 border-b border-gray-700 pb-2 flex justify-between items-center">
                  <span>Detected File Changes ({prFormData.codeBlocks.length})</span>
                  <span className="text-xs text-gray-400 font-normal">Please specify paths for unnamed blocks.</span>
                </h4>

                <div className="space-y-3">
                  {prFormData.codeBlocks.map((block, idx) => (
                    <div key={idx} className="bg-black/30 border border-gray-700 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1 block">File Path (Relative to root)</label>
                        <input
                          type="text"
                          value={block.path}
                          onChange={(e) => {
                            const newBlocks = [...prFormData.codeBlocks];
                            newBlocks[idx].path = e.target.value;
                            setPrFormData(prev => ({ ...prev, codeBlocks: newBlocks }));
                          }}
                          className={`w-full bg-gray-900 border ${!block.path.trim() ? 'border-red-500/50' : 'border-gray-700'} rounded text-sm px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 transition-colors font-mono`}
                          placeholder="e.g. client/src/App.jsx"
                        />
                      </div>

                      <div className="max-h-32 overflow-y-auto bg-gray-950 rounded border border-gray-800 p-2 text-xs font-mono text-gray-300 custom-scrollbar opacity-70">
                        {block.content.split('\n').slice(0, 10).join('\n')}
                        {block.content.split('\n').length > 10 && '\n...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowPrModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                disabled={prFormData.isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={submitPR}
                disabled={prFormData.isSubmitting || prFormData.codeBlocks.some(b => !b.path.trim())}
                className="px-6 py-2 bg-gradient-to-r from-fuchsia-600 to-blue-600 hover:from-fuchsia-500 hover:to-blue-500 text-white font-medium rounded-lg text-sm shadow-lg shadow-fuchsia-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                {prFormData.isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating PR...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    Submit Pull Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Security Audit Custom Modal */}
      {auditModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-gray-900 border border-red-500/50 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col shadow-red-900/20">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-red-900/50 flex justify-between items-center bg-red-950/20">
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                AI Security Audit Priority Alert
              </h3>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                The AI Pre-flight Check has detected potential vulnerabilities or issues in your code changes. Are you sure you want to proceed with this Pull Request?
              </p>

              <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-4">
                <ul className="list-disc list-inside space-y-2 text-sm text-red-200">
                  {auditModal.issues.map((issue, idx) => (
                    <li key={idx} className="leading-relaxed">{issue}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={auditModal.onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                disabled={prFormData.isSubmitting}
              >
                Cancel PR Request
              </button>
              <button
                onClick={auditModal.onConfirm}
                disabled={prFormData.isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium rounded-lg text-sm shadow-lg shadow-red-500/20 flex items-center gap-2 transition-all"
              >
                {prFormData.isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Proceeding...
                  </>
                ) : (
                  "Proceed Anyway"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[150] px-6 py-4 rounded-full shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 flex items-center gap-3 max-w-lg ${toast.type === 'error' ? 'bg-red-900/95 border border-red-500/50 text-red-100' : 'bg-gray-900/95 border border-fuchsia-500/50 text-white backdrop-blur-md'}`}>
          {toast.type === 'success' ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-fuchsia-500 to-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}

          <div className="flex-1 flex items-center gap-4">
            <p className="font-medium text-sm">{toast.message}</p>
            {toast.url && (
              <a href={toast.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
                View PR ↗
              </a>
            )}
          </div>
          <button
            onClick={() => setToast({ ...toast, show: false })}
            className="text-gray-400 hover:text-white shrink-0 ml-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
