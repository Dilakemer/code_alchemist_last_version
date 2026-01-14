import React, { useState, useEffect } from 'react';
import FollowButton from './FollowButton';

const FollowingFeed = ({ apiBase, authHeaders, user, onAuthRequired, onUserClick, onPostClick }) => {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchFollowingFeed();
    }, []);

    const fetchFollowingFeed = async () => {
        if (!user) {
            setMessage('Please log in to see your following feed');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${apiBase}/api/feed/following`, {
                headers: authHeaders
            });

            if (res.ok) {
                const data = await res.json();
                setFeed(data.feed || []);
                setMessage(data.message || '');
            } else if (res.status === 401) {
                onAuthRequired && onAuthRequired();
            }
        } catch (err) {
            console.error('Following feed error:', err);
            setMessage('An error occurred while loading the feed');
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (post) => {
        if (!user) {
            onAuthRequired && onAuthRequired();
            return;
        }

        // Optimistic update
        const originalFeed = [...feed];
        const updatedFeed = feed.map(p => {
            if (p.id === post.id) {
                const isLiked = !p.is_liked;
                return {
                    ...p,
                    is_liked: isLiked,
                    likes: (parseInt(p.likes) || 0) + (isLiked ? 1 : -1)
                };
            }
            return p;
        });
        setFeed(updatedFeed);

        try {
            const res = await fetch(`${apiBase}/api/community/posts/${post.id}/like`, {
                method: 'POST',
                headers: authHeaders
            });

            if (!res.ok) {
                throw new Error('Failed to like');
            }
        } catch (err) {
            console.error('Like error:', err);
            // Revert on error
            setFeed(originalFeed);
            setMessage('Failed to update like');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">🔒</div>
                <p>To see your following feed</p>
                <button
                    onClick={onAuthRequired}
                    className="mt-2 text-fuchsia-400 hover:text-fuchsia-300"
                >
                    Login
                </button>
            </div>
        );
    }

    if (feed.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <div className="text-5xl mb-3">👥</div>
                <p className="text-lg font-medium mb-1">You are not following anyone yet</p>
                <p className="text-sm">Follow users from the community to see their posts here</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <span>👥</span>
                <span>Following ({feed.length} posts)</span>
            </h3>

            {feed.map((post) => (
                <div
                    key={post.id}
                    onClick={() => onPostClick && onPostClick(post)}
                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-fuchsia-500/30 transition-all cursor-pointer"
                >
                    {/* Author Info */}
                    <div className="flex items-center gap-3 mb-3">
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent post click
                                onUserClick && onUserClick(post.author);
                            }}
                            className="flex items-center gap-2 hover:text-fuchsia-400 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                                {post.author?.profile_image ? (
                                    <img
                                        src={`${apiBase}${post.author.profile_image}`}
                                        alt={post.author?.display_name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    post.author?.display_name?.charAt(0)?.toUpperCase() || '?'
                                )}
                            </div>
                            <span className="font-medium text-white">{post.author?.display_name || 'Anonymous'}</span>
                        </button>
                        <span className="text-xs text-gray-500">{post.timestamp}</span>
                    </div>

                    {/* Post Content */}
                    <div className="space-y-2">
                        <p className="text-gray-200 font-medium">{post.user_question}</p>
                        {post.summary && (
                            <p className="text-sm text-gray-400 line-clamp-3">{post.summary}</p>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500">
                        <button
                            className={`flex items-center gap-1 transition-colors ${post.is_liked ? 'text-red-500 hover:text-red-400' : 'hover:text-red-400'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleLike(post);
                            }}
                        >
                            <span>{post.is_liked ? '❤️' : '🤍'}</span>
                            <span>{post.likes || 0}</span>
                        </button>
                        <button
                            className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span>💬</span>
                            <span>{post.answer_count || 0}</span>
                        </button>
                        <span className="flex items-center gap-1">
                            <span>🤖</span>
                            <span>{post.selected_model || 'AI'}</span>
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FollowingFeed;
