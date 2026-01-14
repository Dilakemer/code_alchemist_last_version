import React, { useState } from 'react';
import FollowButton from './FollowButton';

const PostCard = ({ post, onLike, onSelect, apiBase, user, authHeaders, onDelete, onEdit, onUserClick, onShowAlert }) => {
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editQuestion, setEditQuestion] = useState(post.user_question);
    const [editSummary, setEditSummary] = useState(post.summary || '');
    const [liking, setLiking] = useState(false);
    const [localLikes, setLocalLikes] = useState(post.likes || 0);
    const [hasLiked, setHasLiked] = useState(post.user_has_liked || false);

    const resolveAvatarUrl = () => {
        const candidate = post.author_image || post.author_profile_image || post.profile_image || post.profileImage || post.avatar;
        if (!candidate) return null;
        return candidate.startsWith('http') ? candidate : `${apiBase}${candidate.startsWith('/') ? '' : '/'}${candidate}`;
    };

    const authorInitial = post.author_name ? post.author_name[0].toUpperCase() : '?';
    const profileImageUrl = resolveAvatarUrl();
    const [avatarError, setAvatarError] = useState(false);
    const isOwner = user && post.author_id === user.id;

    const handleLikeClick = async () => {
        if (liking) return;

        if (!user) {
            if (onShowAlert) onShowAlert('Please log in first');
            else alert('Please log in to like.');
            return;
        }

        setLiking(true);

        // Optimistic update
        const previousLikes = localLikes;
        const previousHasLiked = hasLiked;
        setLocalLikes(hasLiked ? localLikes - 1 : localLikes + 1);
        setHasLiked(!hasLiked);

        try {
            if (onLike) {
                await onLike(post.id);
            }
        } catch (err) {
            // Revert on error
            setLocalLikes(previousLikes);
            setHasLiked(previousHasLiked);
            console.error('Like error:', err);
        } finally {
            setLiking(false);
        }
    };

    const handleProfileClick = (e) => {
        e.stopPropagation();
        if (post.author_id && onUserClick) {
            onUserClick(post.author_id);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`${apiBase}/api/posts/${post.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...authHeaders }
            });

            if (res.ok) {
                setDeleteModalOpen(false);
                if (onDelete) onDelete(post.id);
            } else {
                const data = await res.json();
                alert(data.error || 'Could not delete post.');
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Connection error.');
        } finally {
            setDeleting(false);
        }
    };

    const handleEdit = async () => {
        if (!editQuestion.trim()) {
            alert('Question cannot be empty.');
            return;
        }

        setEditing(true);
        try {
            const res = await fetch(`${apiBase}/api/posts/${post.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    user_question: editQuestion,
                    summary: editSummary
                })
            });

            const data = await res.json();

            if (res.ok) {
                setEditModalOpen(false);
                if (onEdit) onEdit(data.post);
            } else {
                alert(data.error || 'Could not update post.');
            }
        } catch (err) {
            console.error('Edit error:', err);
            alert('Connection error.');
        } finally {
            setEditing(false);
        }
    };

    return (
        <>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-fuchsia-500/30 transition-all group">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleProfileClick}
                            className="w-10 h-10 rounded-full overflow-hidden border border-gray-700 bg-gradient-to-tr from-fuchsia-600 to-purple-600 flex items-center justify-center font-bold text-white hover:ring-2 hover:ring-fuchsia-500 transition-all cursor-pointer"
                            title={post.author_name ? `View ${post.author_name}'s profile` : 'View Profile'}
                        >
                            {profileImageUrl && !avatarError ? (
                                <img
                                    src={profileImageUrl}
                                    alt={post.author_name}
                                    className="w-full h-full object-cover"
                                    onError={() => setAvatarError(true)}
                                />
                            ) : (
                                <span className="text-sm">{authorInitial}</span>
                            )}
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-fuchsia-400">
                                    {post.author_name || 'Anonymous'}
                                </span>
                                {!isOwner && post.author_id && (
                                    <div className="scale-75 origin-left">
                                        <FollowButton
                                            userId={post.author_id}
                                            initialIsFollowing={post.is_following}
                                            apiBase={apiBase}
                                            authHeaders={authHeaders}
                                            onShowAlert={onShowAlert}
                                        />
                                    </div>
                                )}
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs text-gray-500">{post.timestamp}</span>
                            </div>
                            <h3 className="font-bold text-gray-100 text-lg leading-tight group-hover:text-fuchsia-400 transition-colors cursor-pointer" onClick={() => onSelect(post)}>
                                {post.user_question}
                            </h3>
                        </div>
                    </div>

                    {/* Edit & Delete buttons for owner */}
                    {isOwner && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditModalOpen(true); }}
                                className="text-gray-500 hover:text-blue-400 transition-colors p-1"
                                title="Edit Post"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setDeleteModalOpen(true); }}
                                className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                title="Delete Post"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {post.summary && post.summary !== post.user_question && (
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {post.summary}
                    </p>
                )}

                {post.image_url && (
                    <div className="mb-4">
                        {/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(post.image_url) ? (
                            <div className="rounded-lg overflow-hidden border border-gray-800 max-h-96 bg-black/40 flex justify-center">
                                <img src={post.image_url} alt="Post attachment" className="max-w-full h-auto max-h-96 object-contain" />
                            </div>
                        ) : (
                            <a
                                href={post.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                            >
                                <div className="p-2 rounded bg-gray-700 text-fuchsia-400 group-hover:text-fuchsia-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-200 truncate">
                                        {decodeURIComponent(post.image_url.split('/').pop())}
                                    </div>
                                    <div className="text-xs text-gray-400">Click to view file</div>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-800/50">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleLikeClick(); }}
                        disabled={liking}
                        className={`flex items-center gap-2 transition-colors text-sm ${hasLiked ? 'text-fuchsia-400' : 'text-gray-400 hover:text-fuchsia-400'} ${liking ? 'opacity-50' : ''}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={hasLiked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span>{localLikes} Likes</span>
                    </button>

                    <button
                        onClick={() => onSelect(post)}
                        className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{post.answer_count} Comments</span>
                    </button>
                </div>
            </div>

            {/* Edit Modal */}
            {editModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4">Edit Post</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Question / Title</label>
                                <input
                                    type="text"
                                    value={editQuestion}
                                    onChange={(e) => setEditQuestion(e.target.value)}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                                    placeholder="Your question..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Description (Optional)</label>
                                <textarea
                                    value={editSummary}
                                    onChange={(e) => setEditSummary(e.target.value)}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none h-24 resize-none"
                                    placeholder="Additional description..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setEditModalOpen(false);
                                    setEditQuestion(post.user_question);
                                    setEditSummary(post.summary || '');
                                }}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEdit}
                                disabled={editing}
                                className="flex-1 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-bold transition-all disabled:opacity-50"
                            >
                                {editing ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-red-900/50 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Delete Post</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Bu gönderi ve tüm yorumları kalıcı olarak silinecek. Devam etmek istiyor musunuz?
                        </p>

                        <div className="bg-black/40 border border-gray-800 rounded-lg p-3 mb-6 text-left">
                            <p className="text-white font-medium text-sm line-clamp-3 mb-2">"{post.user_question}"</p>

                            {/* Image Preview in Delete Modal */}
                            {post.image_url && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(post.image_url) && (
                                <div className="rounded-md overflow-hidden border border-gray-700 bg-black/20 mt-2 max-h-32 flex justify-center">
                                    <img
                                        src={post.image_url}
                                        alt="Post preview"
                                        className="h-full w-auto object-contain max-h-32"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PostCard;
