import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const modelOptions = [
    // Google Gemini & Gemma
    { value: 'gemini-3-flash', label: 'Gemini 3.0 Flash', color: '#4285f4', element: '💎' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', color: '#34a853', element: '🔮' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', color: '#8ab4f8', element: '⚡' },
    { value: 'gemma-3-27b', label: 'Gemma 3 27B', color: '#ea4335', element: '🔥' },

    // OpenAI
    { value: 'gpt-4o', label: 'GPT-4o', color: '#10a37f', element: '🌿' },

    // Claude
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet', color: '#cc785c', element: '🌙' },
    { value: 'claude-opus-4-5-20251101', label: 'Claude 4.5 Opus', color: '#9f5a3c', element: '🌑' },
];

// Alchemist-themed loading messages
const alchemyMessages = [
    "Formüller karıştırılıyor... 🧪",
    "Elementler birleştiriliyor... ⚗️",
    "Simya taşı oluşturuluyor... 💎",
    "Bilgelik damıtılıyor... 🔮",
    "Süper yanıt hazırlanıyor... ✨",
];

const ModelBlend = ({ apiBase, authHeaders, onClose, onSelectResponse }) => {
    const [selectedModels, setSelectedModels] = useState(['gemini-2.5-flash', 'gpt-4o']);
    const [question, setQuestion] = useState('');
    const [blendedResponse, setBlendedResponse] = useState('');
    const [individualResponses, setIndividualResponses] = useState({});
    const [reasoning, setReasoning] = useState('');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 0 });
    const [statusMessage, setStatusMessage] = useState('');
    const [showReasoning, setShowReasoning] = useState(false);
    const [showIndividual, setShowIndividual] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const messageIntervalRef = useRef(null);
    const mountedRef = useRef(true);

    // Cleanup on unmount to prevent state updates after component is removed
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
            }
        };
    }, []);

    const toggleModel = (modelValue) => {
        setSelectedModels(prev => {
            if (prev.includes(modelValue)) {
                return prev.filter(m => m !== modelValue);
            }
            if (prev.length >= 4) {
                return prev; // Max 4 models
            }
            return [...prev, modelValue];
        });
    };

    const startBlend = async () => {
        if (selectedModels.length < 2 || !question.trim()) return;

        setLoading(true);
        setBlendedResponse('');
        setIndividualResponses({});
        setReasoning('');
        setProgress({ completed: 0, total: selectedModels.length });
        setStatusMessage('Modellere bağlanılıyor...');

        // Start rotating messages
        let msgIndex = 0;
        messageIntervalRef.current = setInterval(() => {
            if (mountedRef.current) {
                setLoadingMessage(alchemyMessages[msgIndex % alchemyMessages.length]);
            }
            msgIndex++;
        }, 2000);

        try {
            const res = await fetch(`${apiBase}/api/blend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    question: question,
                    code: '',
                    models: selectedModels
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (!mountedRef.current) return;

                            if (data.status === 'fetching') {
                                setStatusMessage(data.message);
                            } else if (data.status === 'progress') {
                                setProgress({ completed: data.completed, total: data.total });
                                setStatusMessage(`${data.model} yanıt verdi...`);
                            } else if (data.status === 'blending') {
                                setStatusMessage(data.message);
                            } else if (data.status === 'streaming') {
                                setBlendedResponse(prev => prev + data.chunk);
                            } else if (data.status === 'refereeing') {
                                setStatusMessage(data.message);
                            } else if (data.status === 'referee_done') {
                                setReasoning(data.reasoning || '');
                                setStatusMessage('Değerlendirme tamamlandı!');
                                setShowReasoning(true); // Auto-show when it arrives
                            } else if (data.done) {
                                setIndividualResponses(data.individual_responses || {});
                                clearInterval(messageIntervalRef.current);
                                setLoading(false);

                                // Store metadata for UI
                                if (data.persona) {
                                    setBlendedResponse(prev => prev); // Trigger re-render if needed
                                    // We'll store it in a local ref or state if we need persistent badge
                                    window.lastPersistedPersona = data.persona;
                                }

                                // Notify parent about conversation_id if exists
                                if (data.conversation_id && window.onBlendComplete) {
                                    window.onBlendComplete(data.conversation_id);
                                }
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Blend error:', err);
            if (mountedRef.current) {
                setStatusMessage('Harmanlama hatası oluştu');
            }
        } finally {
            clearInterval(messageIntervalRef.current);
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-fuchsia-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl shadow-fuchsia-500/10 relative">
                {/* Header */}
                <div className="bg-gradient-to-r from-fuchsia-900/50 to-purple-900/50 px-6 py-4 border-b border-fuchsia-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">⚗️</span>
                            <div>
                                <h2 className="text-xl font-bold text-white">Çoklu Model Harmanlama</h2>
                                <p className="text-xs text-fuchsia-300">Birden fazla AI'ın bilgeliğini birleştir</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors text-2xl"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                    {/* Model Selection */}
                    <div>
                        <label className="block text-sm font-medium text-fuchsia-300 mb-3">
                            🧪 Model Seçimi (2-4 model seçin)
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {modelOptions.map(model => {
                                const isSelected = selectedModels.includes(model.value);
                                const isDisabled = !isSelected && selectedModels.length >= 4;

                                return (
                                    <button
                                        key={model.value}
                                        onClick={() => toggleModel(model.value)}
                                        disabled={isDisabled}
                                        className={`p-3 rounded-xl border-2 transition-all text-left ${isSelected
                                            ? 'border-fuchsia-500 bg-fuchsia-500/20 shadow-lg shadow-fuchsia-500/20'
                                            : isDisabled
                                                ? 'border-gray-700 bg-gray-800/30 opacity-50 cursor-not-allowed'
                                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{model.element}</span>
                                            <span className="text-sm font-medium text-white truncate">{model.label}</span>
                                        </div>
                                        {isSelected && (
                                            <div className="text-xs text-fuchsia-400 mt-1">✓ Seçildi</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Seçili: {selectedModels.length}/4 model
                        </p>
                    </div>

                    {/* Question Input */}
                    <div>
                        <label className="block text-sm font-medium text-fuchsia-300 mb-2">
                            📝 Sorunuz
                        </label>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Tüm modellere sormak istediğiniz soruyu yazın..."
                            className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Blend Button */}
                    <button
                        onClick={startBlend}
                        disabled={loading || selectedModels.length < 2 || !question.trim()}
                        className="w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-fuchsia-600 via-purple-600 to-pink-600 hover:from-fuchsia-500 hover:via-purple-500 hover:to-pink-500 text-white shadow-lg shadow-fuchsia-500/30"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-3">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>{loadingMessage || 'Harmanlanıyor...'}</span>
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <span>⚗️</span>
                                <span>Yanıtları Harmanlа ({selectedModels.length} Model)</span>
                            </span>
                        )}
                    </button>

                    {/* Progress */}
                    {loading && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">{statusMessage}</span>
                                <span className="text-fuchsia-400">{progress.completed}/{progress.total}</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 transition-all duration-500"
                                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Blended Response */}
                    {blendedResponse && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span>✨</span>
                                    <span>Harmanlanmış Yanıt</span>
                                    {window.lastPersistedPersona && (
                                        <span className="bg-fuchsia-500/20 text-fuchsia-400 px-2 py-0.5 rounded border border-fuchsia-500/30 text-[10px] animate-pulse">
                                            Kişiselleştirilmiş ({window.lastPersistedPersona})
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {Object.keys(individualResponses).length > 0 && (
                                        <button
                                            onClick={() => setShowIndividual(!showIndividual)}
                                            className="text-xs px-3 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
                                        >
                                            {showIndividual ? 'Gizle' : 'Bireysel Yanıtları Göster'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-fuchsia-900/20 to-purple-900/20 border border-fuchsia-500/30 rounded-xl p-4">
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {Object.keys(individualResponses).map(model => {
                                        const modelInfo = modelOptions.find(m => m.value === model);
                                        return (
                                            <span
                                                key={model}
                                                className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300"
                                                style={{ borderColor: modelInfo?.color, borderWidth: 1 }}
                                            >
                                                {modelInfo?.element} {modelInfo?.label || model}
                                            </span>
                                        );
                                    })}
                                </div>

                                <div className="prose prose-invert prose-sm max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            code({ node, inline, className, children, ...props }) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return !inline && match ? (
                                                    <SyntaxHighlighter
                                                        style={atomDark}
                                                        language={match[1]}
                                                        PreTag="div"
                                                        {...props}
                                                    >
                                                        {String(children).replace(/\n$/, '')}
                                                    </SyntaxHighlighter>
                                                ) : (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            }
                                        }}
                                    >
                                        {blendedResponse}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Individual Responses */}
                            {showIndividual && Object.keys(individualResponses).length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-gray-400">Bireysel Yanıtlar</h4>
                                    {Object.entries(individualResponses).map(([model, response]) => {
                                        const modelInfo = modelOptions.find(m => m.value === model);
                                        return (
                                            <div
                                                key={model}
                                                className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span>{modelInfo?.element}</span>
                                                    <span className="text-sm font-medium text-white">{modelInfo?.label || model}</span>
                                                </div>
                                                <div className="text-sm text-gray-300 max-h-40 overflow-y-auto">
                                                    <ReactMarkdown>{response}</ReactMarkdown>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Reasoning (Referee) Section */}
                            {reasoning && (
                                <div className="mt-6 bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-2 border-cyan-500/50 rounded-xl overflow-hidden shadow-lg shadow-cyan-900/20 transition-all duration-300">
                                    <button
                                        onClick={() => setShowReasoning(!showReasoning)}
                                        className="w-full flex items-center justify-between p-4 text-cyan-200 hover:bg-cyan-500/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">⚖️</span>
                                            <h4 className="font-bold text-sm tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-blue-300">
                                                AI Hakem Değerlendirmesi
                                            </h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] items-center gap-1 font-mono text-cyan-400 flex">
                                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                                AI REASONING LAYER
                                            </span>
                                            <span className={`transform transition-transform duration-300 ${showReasoning ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </div>
                                    </button>

                                    {showReasoning && (
                                        <div className="p-5 pt-0 animate-fadeIn">
                                            <div className="prose prose-invert prose-sm max-w-none text-cyan-50/90 leading-relaxed border-t border-cyan-500/20 pt-4 font-light tracking-wide">
                                                <ReactMarkdown>{reasoning}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Use Response Button */}
                            <button
                                onClick={() => {
                                    if (onSelectResponse) {
                                        onSelectResponse({
                                            question: question,
                                            blendedResponse: blendedResponse,
                                            sourceModels: Object.keys(individualResponses),
                                            isBlended: true
                                        });
                                    }
                                    onClose();
                                }}
                                className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/30 transition-all"
                            >
                                ✓ Bu Yanıtı Kullan
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModelBlend;
