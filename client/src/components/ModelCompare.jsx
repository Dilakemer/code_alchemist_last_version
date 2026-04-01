import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const modelOptions = [
    // Google Gemini (Active Models)
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)', color: '#5f9cf9', element: '🧊' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', color: '#8ab4f8', element: '⚡' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', color: '#34a853', element: '🔮' },
    { value: 'gemini-3-flash', label: 'Gemini 3.0 Flash', color: '#ea4335', element: '🔥' },

    // OpenAI
    { value: 'gpt-4o', label: 'GPT-4o', color: '#10a37f', element: '🌿' },

    // Claude
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet', color: '#cc785c', element: '🌙' },
    { value: 'claude-opus-4-5-20251101', label: 'Claude 4.5 Opus', color: '#9f5a3c', element: '🌑' },
];

// Alchemist-themed loading messages
const alchemyMessages = [
    "Distilling quantum tokens... 🧪",
    "Consulting ancient scrolls... 📜",
    "Brewing wisdom potion... ⚗️",
    "Mixing neural alchemy formulas... 🔮",
    "Summoning AI spirits... 👻",
    "Generating digital gold... ✨",
    "Growing code crystals... 💎",
    "Purifying logic stone... 🪨",
    "Boiling knowledge potion... 🫧",
    "Processing magic algorithms... ⚡",
    "Transmutation in progress... 🌀",
    "Performing mystic calculations... 🌌",
];

const ModelCompare = ({
    apiBase,
    authHeaders,
    onClose,
    activeConversationId,
    onSelectResponse
}) => {
    const [model1, setModel1] = useState('gemini-2.5-flash-lite');
    const [model2, setModel2] = useState('gpt-4o');
    const [question, setQuestion] = useState('');
    const [response1, setResponse1] = useState('');
    const [response2, setResponse2] = useState('');
    const [loading1, setLoading1] = useState(false);
    const [loading2, setLoading2] = useState(false);
    const [selectedResponse, setSelectedResponse] = useState(null);
    const [pourAnimation, setPourAnimation] = useState(false);
    const [loadingMessage1, setLoadingMessage1] = useState('');
    const [loadingMessage2, setLoadingMessage2] = useState('');
    const [showSparkle, setShowSparkle] = useState(false);

    // Rotate loading messages
    useEffect(() => {
        let interval1, interval2;
        if (loading1) {
            setLoadingMessage1(alchemyMessages[Math.floor(Math.random() * alchemyMessages.length)]);
            interval1 = setInterval(() => {
                setLoadingMessage1(alchemyMessages[Math.floor(Math.random() * alchemyMessages.length)]);
            }, 2500);
        }
        if (loading2) {
            setLoadingMessage2(alchemyMessages[Math.floor(Math.random() * alchemyMessages.length)]);
            interval2 = setInterval(() => {
                setLoadingMessage2(alchemyMessages[Math.floor(Math.random() * alchemyMessages.length)]);
            }, 2500);
        }
        return () => {
            if (interval1) clearInterval(interval1);
            if (interval2) clearInterval(interval2);
        };
    }, [loading1, loading2]);

    const handleCompare = async () => {
        if (!question.trim()) return;

        setResponse1('');
        setResponse2('');
        setLoading1(true);
        setLoading2(true);
        setSelectedResponse(null);
        setPourAnimation(true);

        // Model 1 request
        fetchModelResponse(model1, setResponse1, setLoading1);
        // Model 2 request
        fetchModelResponse(model2, setResponse2, setLoading2);
    };

    const fetchModelResponse = async (model, setResponse, setLoading) => {
        try {
            const body = JSON.stringify({
                question: question,
                code: '',
                model: model,
                conversation_id: null,
                no_save: true // Don't save to database during comparison
            });

            const res = await fetch(`${apiBase}/api/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: body
            });

            if (!res.ok) throw new Error(res.statusText);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.chunk) {
                                accumulated += data.chunk;
                                setResponse(accumulated);
                            }
                        } catch (e) {
                            console.error("Parse error", e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error:", error);
            setResponse(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectResponse = (responseNum) => {
        setSelectedResponse(responseNum);
        // Note: We no longer call onSelectResponse here immediately
        // The user must click "Yanıtı Kullan" button to confirm
    };

    const getModelColor = (modelValue) => {
        const model = modelOptions.find(m => m.value === modelValue);
        return model ? model.color : '#a855f7';
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-fuchsia-500/30 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
                {/* Alchemy header with magical effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-500 animate-pulse" />

                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="text-3xl">⚗️</div>
                        <div>
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
                                Model Alchemy
                            </h2>
                            <p className="text-xs text-gray-400">Compare two models, choose the best response</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden p-6">
                    {/* Model Selectors */}
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">🧪 Test Tube 1</label>
                            <select
                                value={model1}
                                onChange={(e) => setModel1(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500"
                                style={{ borderColor: getModelColor(model1) }}
                            >
                                {modelOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end pb-2">
                            <span className="text-2xl">⚔️</span>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">🧪 Test Tube 2</label>
                            <select
                                value={model2}
                                onChange={(e) => setModel2(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500"
                                style={{ borderColor: getModelColor(model2) }}
                            >
                                {modelOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Question Input */}
                    <div className="mb-4">
                        <div className="relative">
                            <textarea
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Enter alchemy formula... (type your question)"
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none resize-none h-20"
                            />
                            <button
                                onClick={handleCompare}
                                disabled={loading1 || loading2 || !question.trim()}
                                className="absolute right-3 bottom-3 bg-gradient-to-r from-fuchsia-600 to-amber-600 hover:from-fuchsia-500 hover:to-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
                            >
                                {(loading1 || loading2) ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Performing Alchemy...
                                    </>
                                ) : (
                                    <>
                                        <span>⚗️</span>
                                        Compare
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Test Tubes Response Area */}
                    <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
                        {/* Test Tube 1 */}
                        <div className={`relative flex flex-col rounded-2xl overflow-hidden border-2 transition-all ${selectedResponse === 1 ? 'border-green-500 ring-2 ring-green-500/30' : 'border-gray-700'
                            }`} style={{ borderTopColor: getModelColor(model1) }}>
                            {/* Tube Header */}
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{ background: `linear-gradient(to right, ${getModelColor(model1)}20, transparent)` }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🧪</span>
                                    <span className="font-medium text-white">{modelOptions.find(m => m.value === model1)?.label}</span>
                                </div>
                                {response1 && !loading1 && (
                                    <button
                                        onClick={() => handleSelectResponse(1)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedResponse === 1
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-fuchsia-600 hover:text-white'
                                            }`}
                                    >
                                        {selectedResponse === 1 ? '✓ Selected' : 'Select This Response'}
                                    </button>
                                )}
                            </div>

                            {/* Enhanced Pouring Animation with Bubbles */}
                            {loading1 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
                                    {/* Bubbling Cauldron Effect */}
                                    <div className="relative mb-4">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-b from-fuchsia-500/30 to-purple-600/50 animate-boil flex items-center justify-center"
                                            style={{ color: getModelColor(model1) }}>
                                            <span className="text-3xl animate-float">{modelOptions.find(m => m.value === model1)?.element || '🧪'}</span>
                                        </div>
                                        {/* Steam particles */}
                                        <div className="absolute -top-2 left-1/4 w-2 h-2 bg-white/30 rounded-full animate-steam" />
                                        <div className="absolute -top-4 left-1/2 w-1.5 h-1.5 bg-white/20 rounded-full animate-steam" style={{ animationDelay: '0.5s' }} />
                                        <div className="absolute -top-3 right-1/4 w-2 h-2 bg-white/25 rounded-full animate-steam" style={{ animationDelay: '1s' }} />
                                        {/* Floating bubbles */}
                                        <div className="absolute bottom-0 left-1/4 w-1 h-1 bg-fuchsia-400 rounded-full animate-bubble" style={{ animationDelay: '0s' }} />
                                        <div className="absolute bottom-2 left-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full animate-bubble" style={{ animationDelay: '0.3s' }} />
                                        <div className="absolute bottom-1 right-1/4 w-1 h-1 bg-fuchsia-300 rounded-full animate-bubble" style={{ animationDelay: '0.7s' }} />
                                    </div>
                                    {/* Witty Loading Message */}
                                    <p className="text-sm text-center text-fuchsia-300 animate-pulse max-w-[200px]">
                                        {loadingMessage1}
                                    </p>
                                    {/* Progress sparkles */}
                                    <div className="flex gap-2 mt-3">
                                        <div className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}

                            {/* Response Content */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-800/50 custom-scrollbar">
                                {!response1 && !loading1 && (
                                    <div className="text-center text-gray-500 mt-10">
                                        <div className="text-5xl mb-3 animate-float">{modelOptions.find(m => m.value === model1)?.element || '🧪'}</div>
                                        <p className="font-medium text-gray-400">Test tube ready</p>
                                        <p className="text-xs mt-1">Enter formula and start alchemy</p>
                                        <div className="flex justify-center gap-1 mt-4">
                                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-pulse" />
                                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                                        </div>
                                    </div>
                                )}
                                {response1 && (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown
                                            components={{
                                                code({ node, inline, className, children, ...props }) {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const codeString = String(children).replace(/\n$/, '');
                                                    return !inline && match ? (
                                                        <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div">
                                                            {codeString}
                                                        </SyntaxHighlighter>
                                                    ) : (
                                                        <code className="bg-gray-700/50 px-1.5 py-0.5 rounded text-fuchsia-300" {...props}>{children}</code>
                                                    );
                                                }
                                            }}
                                        >
                                            {response1}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Test Tube 2 */}
                        <div className={`relative flex flex-col rounded-2xl overflow-hidden border-2 transition-all ${selectedResponse === 2 ? 'border-green-500 ring-2 ring-green-500/30' : 'border-gray-700'
                            }`} style={{ borderTopColor: getModelColor(model2) }}>
                            {/* Tube Header */}
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{ background: `linear-gradient(to right, ${getModelColor(model2)}20, transparent)` }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🧪</span>
                                    <span className="font-medium text-white">{modelOptions.find(m => m.value === model2)?.label}</span>
                                </div>
                                {response2 && !loading2 && (
                                    <button
                                        onClick={() => handleSelectResponse(2)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedResponse === 2
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-fuchsia-600 hover:text-white'
                                            }`}
                                    >
                                        {selectedResponse === 2 ? '✓ Selected' : 'Select This Response'}
                                    </button>
                                )}
                            </div>

                            {/* Enhanced Pouring Animation with Bubbles */}
                            {loading2 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
                                    {/* Bubbling Cauldron Effect */}
                                    <div className="relative mb-4">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-500/30 to-orange-600/50 animate-boil flex items-center justify-center"
                                            style={{ color: getModelColor(model2) }}>
                                            <span className="text-3xl animate-float">{modelOptions.find(m => m.value === model2)?.element || '🧪'}</span>
                                        </div>
                                        {/* Steam particles */}
                                        <div className="absolute -top-2 left-1/4 w-2 h-2 bg-white/30 rounded-full animate-steam" />
                                        <div className="absolute -top-4 left-1/2 w-1.5 h-1.5 bg-white/20 rounded-full animate-steam" style={{ animationDelay: '0.5s' }} />
                                        <div className="absolute -top-3 right-1/4 w-2 h-2 bg-white/25 rounded-full animate-steam" style={{ animationDelay: '1s' }} />
                                        {/* Floating bubbles */}
                                        <div className="absolute bottom-0 left-1/4 w-1 h-1 bg-amber-400 rounded-full animate-bubble" style={{ animationDelay: '0s' }} />
                                        <div className="absolute bottom-2 left-1/2 w-1.5 h-1.5 bg-orange-400 rounded-full animate-bubble" style={{ animationDelay: '0.3s' }} />
                                        <div className="absolute bottom-1 right-1/4 w-1 h-1 bg-amber-300 rounded-full animate-bubble" style={{ animationDelay: '0.7s' }} />
                                    </div>
                                    {/* Witty Loading Message */}
                                    <p className="text-sm text-center text-amber-300 animate-pulse max-w-[200px]">
                                        {loadingMessage2}
                                    </p>
                                    {/* Progress sparkles */}
                                    <div className="flex gap-2 mt-3">
                                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}

                            {/* Response Content */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-800/50 custom-scrollbar">
                                {!response2 && !loading2 && (
                                    <div className="text-center text-gray-500 mt-10">
                                        <div className="text-5xl mb-3 animate-float">{modelOptions.find(m => m.value === model2)?.element || '🧪'}</div>
                                        <p className="font-medium text-gray-400">Test tube ready</p>
                                        <p className="text-xs mt-1">Enter formula and start alchemy</p>
                                        <div className="flex justify-center gap-1 mt-4">
                                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-pulse" />
                                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                            <div className="w-1 h-1 bg-gray-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                                        </div>
                                    </div>
                                )}
                                {response2 && (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown
                                            components={{
                                                code({ node, inline, className, children, ...props }) {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const codeString = String(children).replace(/\n$/, '');
                                                    return !inline && match ? (
                                                        <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div">
                                                            {codeString}
                                                        </SyntaxHighlighter>
                                                    ) : (
                                                        <code className="bg-gray-700/50 px-1.5 py-0.5 rounded text-fuchsia-300" {...props}>{children}</code>
                                                    );
                                                }
                                            }}
                                        >
                                            {response2}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Selected Response Actions */}
                    {selectedResponse && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl flex items-center justify-between animate-fadeIn">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">✨</span>
                                <div>
                                    <p className="text-green-300 font-medium">
                                        {selectedResponse === 1 ? modelOptions.find(m => m.value === model1)?.label : modelOptions.find(m => m.value === model2)?.label} response selected!
                                    </p>
                                    <p className="text-xs text-gray-400">You can add this response to the conversation</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (onSelectResponse) {
                                        // Pass full comparison data for side-by-side display
                                        onSelectResponse({
                                            question: question,
                                            model1: model1,
                                            model2: model2,
                                            response1: response1,
                                            response2: response2,
                                            selectedResponse: selectedResponse,
                                            model1Label: modelOptions.find(m => m.value === model1)?.label,
                                            model2Label: modelOptions.find(m => m.value === model2)?.label,
                                            model1Color: getModelColor(model1),
                                            model2Color: getModelColor(model2),
                                        });
                                    }
                                    onClose();
                                }}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-all"
                            >
                                Use Response
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
        @keyframes pour {
          0% { transform: scaleY(0); opacity: 0; }
          50% { transform: scaleY(1); opacity: 1; }
          100% { transform: scaleY(0); opacity: 0; }
        }
        .animate-pour {
          transform-origin: top;
        }
      `}</style>
        </div>
    );
};

export default ModelCompare;
