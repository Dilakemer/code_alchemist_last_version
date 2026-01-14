import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import SimilarSolutions from './SimilarSolutions';
import PromptTemplates from './PromptTemplates';
import useTypingEffect from '../hooks/useTypingEffect';


const SmartMarkdown = React.memo(({ content, isStreaming, syntaxTheme, onCopyCode, copiedCodeId, messageId }) => {
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
  theme  // Add theme prop
}) => {
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [expandedReasoning, setExpandedReasoning] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const checkType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const blob = new Blob(chunks, { type: checkType });
        const ext = checkType === 'audio/webm' ? 'webm' : 'm4a';
        const file = new File([blob], `voice_message_${Date.now()}.${ext}`, { type: checkType });

        setImage(file);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecording(true);
      setMediaRecorder(recorder);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
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
      return date.toLocaleDateString('en-US');
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
  // Optimized scroll effect - prevents jitter during message streaming
  useEffect(() => {
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    const scrollToBottom = () => {
      if (bottomRef.current) {
        // Only force scroll if we are already near the bottom or it's a new message
        // This prevents fighting the user if they scrolled up to read history
        const parent = bottomRef.current.parentElement;
        if (parent) {
          const isNearBottom = parent.scrollHeight - parent.scrollTop - parent.clientHeight < 300;
          if (isNearBottom || loading) {
            bottomRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            });
          }
        }
      }
    };

    // Use requestAnimationFrame for performance
    requestAnimationFrame(scrollToBottom);

  }, [history, loading]);

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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
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
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            return !inline && match ? (
                              <SyntaxHighlighter style={syntaxTheme} language={match[1]} PreTag="div">
                                {codeString}
                              </SyntaxHighlighter>
                            ) : (
                              <code className="bg-gray-700/50 px-1.5 py-0.5 rounded text-fuchsia-300" {...props}>{children}</code>
                            );
                          }
                        }}
                      >
                        {turn.response1}
                      </ReactMarkdown>
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
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            return !inline && match ? (
                              <SyntaxHighlighter style={syntaxTheme} language={match[1]} PreTag="div">
                                {codeString}
                              </SyntaxHighlighter>
                            ) : (
                              <code className="bg-gray-700/50 px-1.5 py-0.5 rounded text-fuchsia-300" {...props}>{children}</code>
                            );
                          }
                        }}
                      >
                        {turn.response2}
                      </ReactMarkdown>
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
          <div className="flex justify-start animate-pulse">
            <div className="bg-gray-800/50 px-4 py-3 rounded-2xl rounded-tl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
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

          <div className="flex gap-3 items-center mobile-input-container">
            <div className="flex-1 relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={recording ? "Listening..." : "Type your question here..."}
                className={`w-full bg-gray-800/50 p-4 pr-24 rounded-xl border ${recording ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-700'} focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 outline-none resize-none h-[60px] custom-scrollbar shadow-inner transition-colors`}
              />

              {/* Mic Button & Send Button Container */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Mic Button */}
                {!loading && !image && (
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`p-2 rounded-lg transition-all ${recording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                    title={recording ? "Stop Recording" : "Voice Message"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 10.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-5v-2.07z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={onAsk}
                  disabled={loading || (!question.trim() && !image)}
                  className="p-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:hover:bg-fuchsia-600 text-white rounded-lg transition-all shadow-lg shadow-fuchsia-900/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons Group */}
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/*,audio/*,.txt,.py,.js,.jsx,.ts,.tsx,.json,.md,.csv,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.bat,.ps1,.c,.cpp,.h,.java,.rb,.go,.rs,.php,.swift,.kt,.r,.m,.pdf,.doc,.docx"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />

              {/* Attachment Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-[60px] h-[60px] flex items-center justify-center rounded-xl border transition-all shadow-lg ${image
                  ? 'bg-fuchsia-900/30 border-fuchsia-500 text-fuchsia-300'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-fuchsia-400 hover:border-fuchsia-500/50'
                  }`}
                title="Attach Photo/Audio/Document"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
