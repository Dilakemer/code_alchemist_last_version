import React, { useState, useRef } from 'react';

const ProfileSection = ({ user, apiBase, authHeaders, onUpdate, onLogout }) => {
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const fileInputRef = useRef(null);

    // Password visibility states
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showDeletePassword, setShowDeletePassword] = useState(false);

    const isPasswordStrong = (pwd) => /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(pwd);

    // Eye icon component for reuse
    const EyeIcon = ({ show, onClick }) => (
        <button
            type="button"
            onClick={onClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
        >
            {show ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            )}
        </button>
    );

    const handleDeleteAccount = async () => {
        if (!deletePassword) return;

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await fetch(`${apiBase}/api/auth/delete-account`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ password: deletePassword })
            });

            const data = await res.json();

            if (res.ok) {
                // Başarılı, çıkış yap
                if (onLogout) onLogout();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to delete account.' });
                setLoading(false);
            }
        } catch (err) {
            console.error('Delete account error:', err);
            setMessage({ type: 'error', text: 'Connection error.' });
            setLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Dosya boyutu kontrolü (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'File size must be less than 5MB.' });
            return;
        }

        setImageLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const formData = new FormData();
            formData.append('image', file);

            const res = await fetch(`${apiBase}/api/auth/profile/image`, {
                method: 'POST',
                headers: authHeaders,
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: 'Profile picture updated!' });
                if (onUpdate) onUpdate(data.user);
            } else {
                setMessage({ type: 'error', text: data.error || 'An error occurred.' });
            }
        } catch (err) {
            console.error('Image upload error:', err);
            setMessage({ type: 'error', text: 'Connection error.' });
        } finally {
            setImageLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        // Şifre kontrolü
        if (newPassword && !isPasswordStrong(newPassword)) {
            setMessage({ type: 'error', text: 'New password must be at least 8 characters long and contain at least one uppercase and one lowercase letter.' });
            return;
        }
        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    display_name: displayName,
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: data.message || 'Profile updated!' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                if (onUpdate) onUpdate(data.user);
            } else {
                setMessage({ type: 'error', text: data.error || 'An error occurred.' });
            }
        } catch (err) {
            console.error('Profile update error:', err);
            setMessage({ type: 'error', text: 'Connection error.' });
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="p-6 text-center text-gray-400">
                Login to view profile information.
            </div>
        );
    }

    const profileImageUrl = user.profile_image
        ? (user.profile_image.startsWith('http') ? user.profile_image : `${apiBase}${user.profile_image}`)
        : null;

    return (
        <div className="p-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-xl">
                {/* Profile Header */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
                    {/* Avatar with upload capability */}
                    <div className="relative group">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/jfif"
                            className="hidden"
                        />
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-20 h-20 rounded-full cursor-pointer overflow-hidden border-2 border-fuchsia-500/50 hover:border-fuchsia-500 transition-all"
                        >
                            {profileImageUrl ? (
                                <img
                                    src={profileImageUrl}
                                    alt={user.display_name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-tr from-fuchsia-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                                    {user.display_name[0].toUpperCase()}
                                </div>
                            )}

                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                                {imageLoading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 text-center mt-1">Click to change</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-white">Hello, {user.display_name}</h2>
                        <p className="text-sm text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-500 mt-1">Member since: {user.created_at}</p>
                    </div>
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error'
                        ? 'bg-red-900/30 border border-red-700 text-red-300'
                        : 'bg-green-900/30 border border-green-700 text-green-300'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Profile Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                            Username
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                            placeholder="Your username"
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                        <h3 className="text-sm font-medium text-gray-300 mb-3">Change Password</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                                        placeholder="••••••••"
                                    />
                                    <EyeIcon show={showCurrentPassword} onClick={() => setShowCurrentPassword(!showCurrentPassword)} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        minLength={8}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                                        placeholder="••••••••"
                                    />
                                    <EyeIcon show={showNewPassword} onClick={() => setShowNewPassword(!showNewPassword)} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                    New Password (Again)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        minLength={8}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                                        placeholder="••••••••"
                                    />
                                    <EyeIcon show={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-bold shadow-lg transition-all disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-800">
                    <h3 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h3>
                    <p className="text-xs text-gray-500 mb-4">When you delete your account, all your data (chats, shares, likes) will be permanently deleted and cannot be undone.</p>
                    <button
                        type="button"
                        onClick={() => setDeleteModalOpen(true)}
                        className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 py-2.5 rounded-lg font-bold transition-all"
                    >
                        Delete My Account
                    </button>
                </div>
            </div>

            {/* Delete Account Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-red-900/50 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <h2 className="text-xl font-bold text-white mb-2">Are you sure you want to delete your account?</h2>
                        <p className="text-sm text-gray-400 mb-6">
                            This action cannot be undone. Please enter your password to continue.
                        </p>

                        {message.type === 'error' && message.text && (
                            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                    Your Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showDeletePassword ? "text" : "password"}
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-red-500 outline-none"
                                        placeholder="••••••••"
                                    />
                                    <EyeIcon show={showDeletePassword} onClick={() => setShowDeletePassword(!showDeletePassword)} />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setDeleteModalOpen(false);
                                        setDeletePassword('');
                                        setMessage({ type: '', text: '' });
                                    }}
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={loading || !deletePassword}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Deleting...' : 'Delete Account'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileSection;
