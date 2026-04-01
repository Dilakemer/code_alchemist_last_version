export const API_BASE = import.meta.env.PROD 
  ? '' 
  : (import.meta.env.VITE_API_BASE || 'http://localhost:5000');

// Socket.io bağlantı URL'i
// Production'da aynı origin (Render reverse proxy WebSocket'i handle eder)
// Dev'de localhost:5000
export const SOCKET_BASE = import.meta.env.PROD
  ? window.location.origin
  : (import.meta.env.VITE_API_BASE || 'http://localhost:5000');
