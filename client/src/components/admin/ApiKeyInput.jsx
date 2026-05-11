import React, { useState } from 'react';

// --- RAW SVG ICONS ---
const IconEye = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconEyeOff = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);
const IconCheck = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const IconX = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
);
const IconLoader = ({ size = 16, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>
);

const ApiKeyInput = ({ provider, onSave, initialMask = '', userId, selfMode = false, authHeaders = {} }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null); // 'success', 'error', null
  const [errorMsg, setErrorMsg] = useState('');

  const validateKey = async () => {
    if (!apiKey) return;
    setIsValidating(true);
    setValidationStatus(null);
    setErrorMsg('');
    
    try {
      const endpoint = '/api/admin/keys/validate'; 
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ provider, api_key: apiKey })
      });
      
      const data = await response.json();
      if (response.ok && data.valid) {
        setValidationStatus('success');
      } else {
        setValidationStatus('error');
        setErrorMsg(data.error || 'Validation failed. Key might be invalid or expired.');
      }
    } catch (err) {
      setValidationStatus('error');
      setErrorMsg('Error validating key.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) return;
    try {
      const endpoint = selfMode ? '/api/user/keys' : `/api/admin/users/${userId}/keys`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ provider, api_key: apiKey })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save key');
      
      onSave(provider, data.mask);
      setApiKey('');
      setValidationStatus(null);
    } catch (err) {
      setErrorMsg(err.message || 'Error saving key.');
      setValidationStatus('error');
    }
  };

  return (
    <div className="space-y-2 p-4 border border-white/10 rounded-xl bg-white/5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-white/70 capitalize">{provider} API Key</label>
        {initialMask && (
          <span className="text-xs text-white/40 font-mono">Current: {initialMask}</span>
        )}
      </div>
      
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Enter new ${provider} key...`}
          className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 pr-24 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
        />
        <div className="absolute right-2 top-1.5 flex items-center space-x-1">
          <button
            onClick={() => setShowKey(!showKey)}
            className="p-1 hover:bg-white/10 rounded transition-colors text-white/60"
            title={showKey ? "Hide" : "Show"}
          >
            {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
          <button
            onClick={validateKey}
            disabled={isValidating || !apiKey}
            className="text-[10px] font-bold bg-white/10 hover:bg-white/20 disabled:opacity-50 px-2 py-1 rounded transition-all text-white/80"
          >
            {isValidating ? <IconLoader size={12} className="animate-spin" /> : "TEST"}
          </button>
        </div>
      </div>

      {validationStatus === 'success' && (
        <div className="flex items-center space-x-2 text-emerald-400 text-xs">
          <IconCheck size={14} />
          <span>Key is valid. Ready to save.</span>
        </div>
      )}

      {validationStatus === 'error' && (
        <div className="flex items-center space-x-2 text-rose-400 text-xs">
          <IconX size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!apiKey || isValidating}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-gray-600 rounded-lg text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/20"
      >
        Save {provider} Key
      </button>
    </div>
  );
};

export default ApiKeyInput;
