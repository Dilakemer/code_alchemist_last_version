import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ConfirmationModal from './ConfirmationModal';

const HistoryList = ({ conversations, onDelete, activeId, onSelect, onRename, onPin, onArchive, onShare, apiBase, authHeaders }) => {
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, title: '' });
  const menuRef = useRef(null);

  const formatDateOnly = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US');
    }
    return String(value).split(' ')[0];
  };


  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleRename = async (id, newTitle) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${apiBase}/api/conversations/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        if (onRename) onRename();
      }
    } catch (err) {
      console.error("Rename error:", err);
    }
    setEditingId(null);
  };

  const handlePin = async (id) => {
    try {
      const res = await fetch(`${apiBase}/api/conversations/${id}/pin`, {
        method: 'PUT',
        headers: authHeaders
      });
      if (res.ok) {
        if (onPin) onPin();
      }
    } catch (err) {
      console.error("Pin error:", err);
    }
    setMenuOpen(null);
  };

  const handleArchive = async (id) => {
    try {
      const res = await fetch(`${apiBase}/api/conversations/${id}/archive`, {
        method: 'PUT',
        headers: authHeaders
      });
      if (res.ok) {
        if (onArchive) onArchive();
      }
    } catch (err) {
      console.error("Archive error:", err);
    }
    setMenuOpen(null);
  };

  if (!conversations || !conversations.length) return (
    <div className="bg-gray-900/60 rounded-lg p-4 border border-violet-800 text-xs text-gray-400 text-center drop-shadow-sm">
      No conversations yet.
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-bold mb-3 text-fuchsia-300">Conversations</h2>
      <ul className="space-y-2">
        {conversations.map((item) => {
          const isActive = activeId === item.id;
          const isEditing = editingId === item.id;

          return (
            <li
              key={item.id}
              onClick={() => !isEditing && onSelect(item.id)}
              style={{ zIndex: menuOpen === item.id ? 100 : 'auto' }}
              className={`cursor-pointer p-3 rounded-xl border-2 relative group ${isActive
                ? 'border-yellow-400 bg-black/80 scale-[1.02]'
                : item.is_pinned
                  ? 'border-fuchsia-500/50 bg-fuchsia-900/20 hover:scale-[1.02]'
                  : 'border-violet-700 bg-black/30 hover:scale-[1.02]'
                } transition-all shadow-lg`}
            >
              {/* Pin indicator */}
              {item.is_pinned && (
                <div className="absolute -top-1 -right-1 bg-fuchsia-500 rounded-full p-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182a.5.5 0 1 1-.707-.707l3.182-3.182-2.829-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.766 2.375-.72.341.024.685.08 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.109-1.023.589-1.503a.5.5 0 0 1 .353-.146z" />
                  </svg>
                </div>
              )}

              <div className="text-gray-100 font-medium flex items-center justify-between gap-2 pr-8">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRename(item.id, editTitle);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => handleRename(item.id, editTitle)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-gray-800 border border-fuchsia-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span className="truncate flex-1">
                    {item.title ? (item.title.slice(0, 40) + (item.title.length > 40 ? '...' : '')) : 'New Conversation'}
                  </span>
                )}
                <span className="text-xs text-violet-300 shrink-0">{formatDateOnly(item.created_at)}</span>
              </div>

              {/* Context Menu Trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const screenHeight = window.innerHeight;
                  const menuEstimatedHeight = 250; // Share, Rename, Pin, Archive, Divider, Delete

                  let yPos = rect.top;
                  // If menu would go off bottom, open it upwards from the bottom of the trigger
                  if (yPos + menuEstimatedHeight > screenHeight) {
                    yPos = Math.max(10, rect.bottom - menuEstimatedHeight);
                  }

                  setMenuCoords({ x: rect.right + 5, y: yPos });
                  setMenuOpen(menuOpen === item.id ? null : item.id);
                }}
                className={`absolute top-2 right-2 p-1 rounded-md transition-all focus:outline-none ${menuOpen === item.id
                  ? 'opacity-100 bg-gray-700'
                  : 'opacity-70 group-hover:opacity-100 hover:bg-gray-700'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </button>

              {/* Dropdown Menu (Portal) */}
              {menuOpen === item.id && createPortal(
                <div
                  ref={menuRef}
                  style={{ top: menuCoords.y, left: menuCoords.x }}
                  className="fixed z-[9999] w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Paylaş */}
                  <button
                    onClick={() => {
                      if (onShare) onShare(item);
                      setMenuOpen(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Share
                  </button>

                  {/* Yeniden Adlandır */}
                  <button
                    onClick={() => {
                      setEditTitle(item.title || '');
                      setEditingId(item.id);
                      setMenuOpen(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Rename
                  </button>

                  {/* Sabitle */}
                  <button
                    onClick={() => handlePin(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${item.is_pinned ? 'text-fuchsia-400' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                    </svg>
                    {item.is_pinned ? 'Unpin' : 'Pin Chat'}
                  </button>

                  {/* Arşivle */}
                  <button
                    onClick={() => handleArchive(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    {item.is_archived ? 'Unarchive' : 'Archive'}
                  </button>

                  <div className="h-px bg-gray-700 my-1"></div>

                  {/* Sil */}
                  <button
                    onClick={() => {
                      setMenuOpen(null);
                      setConfirmModal({
                        isOpen: true,
                        id: item.id,
                        title: item.title || 'This conversation'
                      });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>,
                document.body
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => onDelete && onDelete(confirmModal.id)}
        title="Delete Chat"
        message={`Are you sure you want to delete the chat "${confirmModal.title}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  );
};

export default HistoryList;
