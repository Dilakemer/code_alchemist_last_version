import React from 'react';
import ReactMarkdown from 'react-markdown';
import CommunityAnswers from './CommunityAnswers';

import FollowButton from './FollowButton';

const CommunityPostDetail = ({ post, onBack, apiBase, authHeaders, user, onAuthRequired, highlightAnswerId, onUserClick, onShowAlert }) => {
    if (!post) return null;

    const resolveAvatarUrl = () => {
        const candidate = post.author_image || post.author_profile_image || post.profile_image || post.avatar;
        if (!candidate) return null;
        return candidate.startsWith('http') ? candidate : `${apiBase}${candidate.startsWith('/') ? '' : '/'}${candidate}`;
    };

    const authorInitial = post.author_name ? post.author_name[0].toUpperCase() : '?';
    const profileImageUrl = resolveAvatarUrl();
    const isOwner = user && post.author_id === user.id;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={onBack}
                    className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back
                </button>

                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-700 bg-gradient-to-tr from-fuchsia-600 to-purple-600 flex items-center justify-center font-bold text-xl text-white">
                            {profileImageUrl ? (
                                <img
                                    src={profileImageUrl}
                                    alt={post.author_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            ) : (
                                <span className="text-lg">{authorInitial}</span>
                            )}
                        </div>
                        <div>
                            <div
                                className={`flex items-center gap-2 ${onUserClick ? 'cursor-pointer hover:text-fuchsia-400 transition-colors' : ''}`}
                                onClick={() => onUserClick && onUserClick(post.author_id)}
                            >
                                <span className="text-lg font-bold text-white">
                                    {post.author_name || 'Anonymous'}
                                </span>
                                {!isOwner && post.author_id && (
                                    <div className="scale-90 origin-left">
                                        <FollowButton
                                            userId={post.author_id}
                                            initialIsFollowing={post.is_following}
                                            apiBase={apiBase}
                                            authHeaders={authHeaders}
                                            onFollowChange={(newStatus) => {
                                                // Optional: update local state if needed
                                                post.is_following = newStatus;
                                            }}
                                            onShowAlert={onShowAlert}
                                        />
                                    </div>
                                )}
                            </div>
                            <span className="text-sm text-gray-500">{post.timestamp}</span>
                        </div>
                    </div>

                    {/* Post Content (Question/Message) */}
                    {post.user_question && (
                        <div className="mb-6 text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                            <ReactMarkdown
                                components={{
                                    code: ({ node, inline, className, children, ...props }) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                            <div className="rounded-md overflow-hidden my-4 border border-gray-700">
                                                <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 font-mono border-b border-gray-700 flex justify-between">
                                                    <span>{match[1]}</span>
                                                </div>
                                                <pre className="bg-gray-900 p-4 overflow-x-auto m-0 !bg-gray-900">
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                </pre>
                                            </div>
                                        ) : (
                                            <code className={`${className} bg-gray-800 px-1.5 py-0.5 rounded text-sm text-fuchsia-300 font-mono`} {...props}>
                                                {children}
                                            </code>
                                        );
                                    }
                                }}
                            >
                                {post.user_question}
                            </ReactMarkdown>
                        </div>
                    )}

                    {post.image_url && (
                        <div className="mb-6">
                            {/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(post.image_url) ? (
                                <div className="rounded-xl overflow-hidden border border-gray-800 shadow-lg">
                                    <img src={post.image_url} alt="Post attachment" className="w-full max-h-[500px] object-contain bg-black/50" />
                                </div>
                            ) : (
                                <a
                                    href={post.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-700 bg-gray-800/40 hover:bg-gray-800 transition-colors group"
                                >
                                    <div className="p-3 rounded-lg bg-gray-700 text-fuchsia-400 group-hover:text-fuchsia-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-base font-medium text-gray-200 truncate">
                                            {decodeURIComponent(post.image_url.split('/').pop())}
                                        </div>
                                        <div className="text-sm text-gray-400">Click to view/download file</div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    )}

                    {post.code_snippet && (
                        <div className="mb-6">
                            <div className="text-xs font-mono text-gray-500 mb-2">Code Snippet:</div>
                            <pre className="bg-black/80 border border-gray-800 rounded-xl p-4 overflow-x-auto text-sm font-mono text-gray-300">
                                {post.code_snippet}
                            </pre>
                        </div>
                    )}

                    {/* If there is extra description in summary that is not the title, show it. 
              But usually summary is just a summary. 
              The 'ai_response' field in community posts is used for description/body if needed, 
              but currently it's hardcoded to "Bu bir topluluk paylaşımıdır..." 
              Maybe we should have stored the body in user_question or code_snippet?
              The current create_community_post uses title -> user_question.
          */}
                </div>

                <CommunityAnswers
                    historyId={post.id}
                    user={user}
                    onAuthRequired={onAuthRequired}
                    apiBase={apiBase}
                    authHeaders={authHeaders}
                    highlightAnswerId={highlightAnswerId}
                    onShowAlert={onShowAlert}
                />
            </div>
        </div>
    );
};

export default CommunityPostDetail;
