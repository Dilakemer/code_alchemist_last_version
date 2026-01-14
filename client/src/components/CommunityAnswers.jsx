import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const CommunityAnswers = ({
  historyId,
  user,
  onAuthRequired,
  apiBase,
  authHeaders,
  highlightAnswerId,
  onShowAlert,
  onUpdate
}) => {
  const [answers, setAnswers] = useState([]);
  const [body, setBody] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = React.useRef(null);

  const fetchAnswers = async () => {
    if (!historyId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/history/${historyId}/answers`);
      const json = await res.json();
      setAnswers(json.answers || []);
    } catch (err) {
      console.error("Failed to fetch answers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnswers();
  }, [historyId]);

  useEffect(() => {
    if (highlightAnswerId && answers.length > 0) {
      const el = document.getElementById(`answer-${highlightAnswerId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-fuchsia-500', 'bg-fuchsia-900/30');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-fuchsia-500', 'bg-fuchsia-900/30');
        }, 3000);
      }
    }
  }, [answers, highlightAnswerId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!historyId || !body.trim()) return;
    if (!user) {
      onAuthRequired();
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('body', body);
      formData.append('code_snippet', codeSnippet);
      if (image) {
        formData.append('image', image);
      }

      // Remove Content-Type if present in authHeaders to let browser set boundary
      const headers = { ...authHeaders };
      delete headers['Content-Type'];

      const res = await fetch(`${apiBase}/api/history/${historyId}/answers`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Unknown error'}`);
        return;
      }

      setBody('');
      setCodeSnippet('');
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchAnswers();
      if (onUpdate) onUpdate(); // Ensure onUpdate is defined or check for it
    } catch (err) {
      console.error("Failed to submit answer", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (answerId) => {
    if (!user) {
      if (onShowAlert) onShowAlert('Please log in first');
      else alert('Please log in to like.');
      return;
    }
    try {
      await fetch(`${apiBase}/api/answers/${answerId}/like`, {
        method: 'POST',
        headers: authHeaders
      });
      fetchAnswers();
    } catch (err) {
      console.error("Failed to like answer", err);
    }
  };

  const handleDelete = async (answerId) => {
    if (!confirm("Are you sure you want to delete this solution?")) return;
    try {
      await fetch(`${apiBase}/api/answers/${answerId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      fetchAnswers();
      // Safe check for onUpdate
      // if (onUpdate) onUpdate(); 
    } catch (err) {
      console.error("Failed to delete answer", err);
    }
  };

  if (!historyId) return null;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 shadow-xl mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-fuchsia-200">Community Solutions</h3>
        <span className="text-xs text-gray-400">{answers.length} solutions</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mb-5">
        {!user && (
          <div className="text-sm text-yellow-200 bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
            Please log in to share a solution.
          </div>
        )}
        <textarea
          className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-fuchsia-600"
          placeholder="Explain your solution..."
          value={body}
          onChange={e => setBody(e.target.value)}
          required
        />
        <textarea
          className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 min-h-[70px] focus:outline-none focus:ring-2 focus:ring-indigo-600"
          placeholder="Optional code share..."
          value={codeSnippet}
          onChange={e => setCodeSnippet(e.target.value)}
        />

        {/* File Upload Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => setImage(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors ${image ? 'bg-fuchsia-900/30 border-fuchsia-500 text-fuchsia-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {image ? 'Change File' : 'Add File'}
            </button>
            {image && (
              <span className="text-xs text-gray-500 truncate max-w-[150px]">{image.name}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !user}
            className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Share Solution'}
          </button>
        </div>
      </form>

      <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
        {loading && <div className="text-center text-gray-500">Loading...</div>}
        {!loading && answers.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4">No solutions yet. Be the first to add one!</div>
        )}
        {answers.map(ans => (
          <div id={`answer-${ans.id}`} key={ans.id} className="bg-black/40 border border-gray-800 rounded-xl p-4 transition-all duration-500">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span className="font-bold text-fuchsia-300">{ans.author}</span>
              <span>{ans.created_at}</span>
            </div>
            <div className="prose prose-invert max-w-none text-sm">
              <ReactMarkdown>{ans.body}</ReactMarkdown>
            </div>

            {ans.image_url && (
              <div className="mt-3 mb-3">
                {/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(ans.image_url) ? (
                  <div className="rounded-lg overflow-hidden border border-gray-800 max-h-48 bg-black/50 flex justify-center">
                    <img
                      src={ans.image_url.startsWith('http') ? ans.image_url : `${apiBase}${ans.image_url}`}
                      alt="Attachment"
                      className="max-w-full h-auto max-h-48 object-contain"
                    />
                  </div>
                ) : (
                  <a
                    href={ans.image_url.startsWith('http') ? ans.image_url : `${apiBase}${ans.image_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                  >
                    <div className="p-2 rounded bg-gray-700 text-fuchsia-400 group-hover:text-fuchsia-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-200 truncate">
                        {decodeURIComponent(ans.image_url.split('/').pop())}
                      </div>
                      <div className="text-[10px] text-gray-400">Click to view file</div>
                    </div>
                  </a>
                )}
              </div>
            )}

            {ans.code_snippet && (
              <pre className="bg-black/60 text-xs text-gray-200 mt-3 p-3 rounded-lg overflow-auto font-mono border border-gray-700">
                {ans.code_snippet}
              </pre>
            )}
            <div className="flex gap-3 mt-3 text-xs">
              <button
                className="px-3 py-1 rounded-full bg-violet-700/60 text-white hover:bg-violet-700 transition flex items-center gap-1"
                onClick={() => handleLike(ans.id)}
              >
                👍 {ans.likes}
              </button>
              {user && (user.id === ans.author_id || user.is_admin) && (
                <button
                  className="px-3 py-1 rounded-full bg-red-600/70 text-white hover:bg-red-600 transition"
                  onClick={() => handleDelete(ans.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommunityAnswers;
