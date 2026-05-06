import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';

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
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptCommercial, setAcceptCommercial] = useState(false);
  const googleButtonRef = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  const apiBaseRef = useRef(apiBase);

  const isPasswordStrong = (pwd) => /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(pwd);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    apiBaseRef.current = apiBase;
  }, [apiBase]);

  useEffect(() => {
    if (!open || authMode !== 'login' || !GOOGLE_CLIENT_ID || typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    const handleGoogleCredential = async (response) => {
      if (!response?.credential) {
        return;
      }

      setLoading(true);
      setError('');
      setSuccessMessage('');

      try {
        const res = await fetch(`${apiBaseRef.current}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();

        if (res.ok) {
          onSuccessRef.current(data);
        } else {
          setError(data.error || 'Google sign-in failed.');
        }
      } catch (err) {
        console.error(err);
        setError('A connection error occurred');
      } finally {
        setLoading(false);
      }
    };

    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) {
        return;
      }

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320,
        logo_alignment: 'left'
      });
    };

    const existingScript = document.querySelector('script[data-google-gis="true"]');

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const script = existingScript || document.createElement('script');
    const onLoad = () => renderGoogleButton();

    if (!existingScript) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleGis = 'true';
      script.addEventListener('load', onLoad);
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', onLoad);
    }

    return () => {
      cancelled = true;
      script.removeEventListener('load', onLoad);
    };
  }, [open, authMode]);

  if (!open) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (authMode === 'register') {
      if (!acceptTerms) {
        setError('Üyelik ve Kullanım Koşulları ile KVKK Aydınlatma Metni\'ni onaylamanız gerekmektedir.');
        return;
      }
      if (!isPasswordStrong(password)) {
        setError('Password must be at least 8 characters long and contain at least one uppercase and one lowercase letter.');
        return;
      }
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
          // Log consents asynchronously
          fetch(`${apiBase}/api/legal/consent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consent_type: 'register_terms_kvkk', version: '1.0', is_accepted: acceptTerms, email: email })
          }).catch(e => console.error("Consent log error:", e));

          if (acceptCommercial) {
            fetch(`${apiBase}/api/legal/consent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ consent_type: 'commercial_communication', version: '1.0', is_accepted: true, email: email })
            }).catch(e => console.error("Consent log error:", e));
          }

          setAuthMode('login');
          setSuccessMessage('Registration successful! Please login.');
          setPassword('');
          setAcceptTerms(false);
          setAcceptCommercial(false);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl relative max-h-full overflow-y-auto">
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

            {authMode === 'register' && (
              <div className="space-y-3 mt-4">
                <label className="flex items-start gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input
                      type="checkbox"
                      className="peer appearance-none w-4 h-4 border border-gray-600 rounded bg-black/50 checked:bg-fuchsia-500 checked:border-fuchsia-500 cursor-pointer transition-all"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                    />
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors leading-tight select-none">
                    <a href="/kullanim-kosullari" target="_blank" rel="noopener noreferrer" className="text-fuchsia-400 hover:text-fuchsia-300 underline" onClick={e => e.stopPropagation()}>Üyelik ve Kullanım Koşulları</a>'nı ve <a href="/kvkk-aydinlatma-metni" target="_blank" rel="noopener noreferrer" className="text-fuchsia-400 hover:text-fuchsia-300 underline" onClick={e => e.stopPropagation()}>KVKK Aydınlatma Metni</a>'ni okudum, anladım ve kabul ediyorum.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input
                      type="checkbox"
                      className="peer appearance-none w-4 h-4 border border-gray-600 rounded bg-black/50 checked:bg-fuchsia-500 checked:border-fuchsia-500 cursor-pointer transition-all"
                      checked={acceptCommercial}
                      onChange={(e) => setAcceptCommercial(e.target.checked)}
                    />
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors leading-tight select-none">
                    Kampanyalardan ve yeniliklerden haberdar olmak için tarafıma elektronik ileti gönderilmesini kabul ediyorum.
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white py-2.5 rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2"
            >
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>

            {authMode === 'login' && GOOGLE_CLIENT_ID && (
              <>
                <div className="flex items-center gap-3 py-1.5">
                  <div className="h-px flex-1 bg-gray-800" />
                  <span className="text-[10px] uppercase tracking-[0.24em] text-gray-500">or</span>
                  <div className="h-px flex-1 bg-gray-800" />
                </div>
                <div className="rounded-xl border border-gray-800 bg-black/25 p-2 flex justify-center">
                  <div ref={googleButtonRef} className="min-h-[44px] flex items-center justify-center" />
                </div>
              </>
            )}
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
                Don't have an account? <button onClick={() => { setError(''); setSuccessMessage(''); setAuthMode('register'); setEmail(''); setPassword(''); setDisplayName(''); setAcceptTerms(false); setAcceptCommercial(false); }} className="text-fuchsia-400 hover:text-fuchsia-300 font-medium">Register</button>
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
