import React, { useState } from 'react';

const AuthModal = ({ open, apiBase, onClose, onSuccess }) => {
  const [authMode, setAuthMode] = useState('login'); // login, register, forgot, reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const isPasswordStrong = (pwd) => /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(pwd);

  if (!open) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (authMode === 'register' && !isPasswordStrong(password)) {
      setError('Password must be at least 8 characters long and contain at least one uppercase and one lowercase letter.');
      return;
    }
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName })
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === 'register') {
          setAuthMode('login');
          setSuccessMessage('Registration successful! Please login.');
          setPassword('');
        } else {
          onSuccess(data);
        }
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      console.error(err);
      setError('A connection error occurred');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(data.message);
        setAuthMode('reset');
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      console.error(err);
      setError('A connection error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    if (!isPasswordStrong(newPassword)) {
      setError('Password must be at least 8 characters long and contain at least one uppercase and one lowercase letter.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: resetCode, new_password: newPassword })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(data.message);
        setAuthMode('login');
        setResetCode('');
        setNewPassword('');
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      console.error(err);
      setError('A connection error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case 'login': return 'Welcome Back';
      case 'register': return 'Create Account';
      case 'forgot': return 'Forgot Password';
      case 'reset': return 'Set New Password';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 to-purple-600" />
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          {getTitle()}
        </h2>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-200 text-sm text-center">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Login / Register Form */}
        {(authMode === 'login' || authMode === 'register') && (
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
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
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2"
            >
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {authMode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Enter your registered email address. We will send you a password reset code.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        )}

        {/* Reset Password Form */}
        {authMode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Enter the 6-digit code sent to your email and your new password.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Verification Code</label>
              <input
                type="text"
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none text-center text-2xl tracking-[0.5em] font-bold"
                value={resetCode}
                onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                placeholder="••••••"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showNewPassword ? (
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
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* Footer Links */}
        <div className="mt-6 text-center text-sm text-gray-400 space-y-2">
          {authMode === 'login' && (
            <>
              <p>
                <button onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('forgot'); }} className="text-fuchsia-400 hover:text-fuchsia-300 font-medium">
                  Forgot Password
                </button>
              </p>
              <p>
                Don't have an account? <button onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('register'); setEmail(''); setPassword(''); setDisplayName(''); }} className="text-fuchsia-400 hover:text-fuchsia-300 font-medium">Register</button>
              </p>
            </>
          )}
          {authMode === 'register' && (
            <p>Already have an account? <button onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('login'); setEmail(''); setPassword(''); setDisplayName(''); }} className="text-fuchsia-400 hover:text-fuchsia-300 font-medium">Login</button></p>
          )}
          {(authMode === 'forgot' || authMode === 'reset') && (
            <p>
              <button onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('login'); }} className="text-fuchsia-400 hover:text-fuchsia-300 font-medium">
                ← Back to Login
              </button>
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
