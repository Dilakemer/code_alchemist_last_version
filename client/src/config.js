const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE;
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');

  if (envBase) {
    return envBase;
  }

  if (isLocal) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  return ''; // Relative path for production
};

export const API_BASE = getApiBase();
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const SOCKET_BASE = (typeof window !== 'undefined')
  ? (import.meta.env.VITE_API_BASE || window.location.origin)
  : '';
