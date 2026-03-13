import React, { useState } from 'react';

const FeedbackModal = ({ isOpen, onClose, onSubmit, conversationId, historyId }) => {
  const [category, setCategory] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    { id: 'wrong_incomplete', label: 'Wrong or incomplete' },
    { id: 'not_helpful', label: 'Not helpful' },
    { id: 'too_long', label: 'Too long' },
    { id: 'incorrect_code', label: 'Incorrect code' },
    { id: 'other', label: 'Other' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) return;
    
    setSubmitting(true);
    try {
      await onSubmit({
        category,
        comments,
        history_id: historyId
      });
      onClose();
    } catch (error) {
      console.error('Feedback submission failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-600" />
        
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-red-400">👎</span> Provide Feedback
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                What was the issue?
              </label>
              <div className="grid grid-cols-1 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                      category === cat.label
                        ? 'bg-red-600/20 border-red-500 text-red-100 shadow-lg shadow-red-900/10'
                        : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Additional comments (optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none transition-all"
                placeholder="How could the response be improved?"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!category || submitting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold shadow-lg shadow-red-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:hover:from-red-600"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
