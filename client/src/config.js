const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE;
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');

  if (envBase && !envBase.includes('localhost') && !isLocal) {
    return envBase;
  }

  if (isLocal) {
    return envBase || `http://${window.location.hostname}:5001`;
  }

  return ''; // Relative path for production
};

export const API_BASE = getApiBase();
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const SOCKET_BASE = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? window.location.origin
  : (import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:5001`);
