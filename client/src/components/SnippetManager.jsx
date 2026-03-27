import React, { useState, useEffect } from 'react';

const SnippetManager = ({ apiBase, authHeaders, user, onAuthRequired, onClose }) => {
    const [snippets, setSnippets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [copiedId, setCopiedId] = useState(null);

    const fetchSnippets = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/snippets`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                setSnippets(data.snippets || []);
            }
        } catch (err) {
            console.error('Snippet fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSnippets();
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            onAuthRequired && onAuthRequired();
            return;
        }
        if (!title.trim() || !code.trim()) return;

        try {
            const res = await fetch(`${apiBase}/api/snippets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ title, code, language })
            });

            if (res.ok) {
                setTitle('');
                setCode('');
                setShowForm(false);
                fetchSnippets();
            } else {
                const data = await res.json();
                alert(data.error || 'An error occurred');
            }
        } catch (err) {
            console.error('Snippet save error:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this snippet?')) return;
        try {
            await fetch(`${apiBase}/api/snippets/${id}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            fetchSnippets();
        } catch (err) {
            console.error('Snippet delete error:', err);
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

    if (!user) {
        return (
            <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800 w-full animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10">
                    <h2 className="text-md font-bold text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Snippets
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1"
                        title="Close Sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 text-center text-gray-400">
                    <i className="fas fa-lock mb-3 text-2xl block text-gray-600"></i>
                    Login to view snippets.
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800 w-full animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10">
                <h2 className="text-md font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Snippets
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-1 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-300 px-2 py-1 rounded text-xs transition-colors border border-fuchsia-500/30"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1"
                        title="Close Sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

                {/* Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="p-4 border-b border-gray-800 space-y-3">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Title"
                            className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none"
                        />
                        <div className="flex gap-2">
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none"
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="csharp">C#</option>
                                <option value="html">HTML</option>
                                <option value="css">CSS</option>
                                <option value="sql">SQL</option>
                                <option value="bash">Bash</option>
                                <option value="plaintext">Plaintext</option>
                            </select>
                            <button
                                type="submit"
                                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                            >
                                Save
                            </button>
                        </div>
                        <textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Code..."
                            rows={5}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:ring-2 focus:ring-fuchsia-500 outline-none"
                        />
                    </form>
                )}

                {/* Snippets List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="text-center text-gray-400 py-8">Loading...</div>
                    ) : snippets.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            No snippets yet. Add one with the "New" button.
                        </div>
                    ) : (
                        snippets.map(snippet => (
                            <div key={snippet.id} className="bg-black/40 border border-gray-800 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">{snippet.title}</span>
                                        <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">
                                            {snippet.language}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyToClipboard(snippet.code, snippet.id)}
                                            className="text-gray-400 hover:text-fuchsia-300 text-xs flex items-center gap-1"
                                        >
                                            {copiedId === snippet.id ? (
                                                <span className="text-green-400">Copied!</span>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(snippet.id)}
                                            className="text-gray-400 hover:text-red-400"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <pre className="text-xs font-mono text-gray-300 bg-gray-800/50 rounded-lg p-3 overflow-x-auto max-h-32">
                                    {snippet.code}
                                </pre>
                                <div className="text-[10px] text-gray-500 mt-2">{snippet.created_at}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    export default SnippetManager;
