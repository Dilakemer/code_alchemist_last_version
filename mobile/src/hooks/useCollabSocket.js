import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_BASE } from '../config';

/**
 * useCollabSocket — Secure Mobile Collaboration Hook
 * 
 * @param {string|null} token - Collaboration room token
 * @param {string|null} userToken - JWT for socket authentication
 * @param {string} userName - Connecting user's display name
 * @param {Function} onHistoryRefresh - Callback for sync
 */
export function useCollabSocket(token, userToken, userName = 'Guest', onHistoryRefresh = null) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [liveStreamText, setLiveStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingHistoryId, setStreamingHistoryId] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);

  const resetStream = useCallback(() => {
    setLiveStreamText('');
    setIsStreaming(false);
    setStreamingHistoryId(null);
  }, []);

  useEffect(() => {
    if (!token || !userToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      return;
    }

    // Secure Connection with JWT Auth
    const socket = io(SOCKET_BASE, {
      auth: { token: userToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 30000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room', {
        token,
        user_name: userName,
      });
      console.log('[ColabSocket] Mobile Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[ColabSocket] Mobile Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ColabSocket] Mobile Auth/Connection Error:', err.message);
      setConnected(false);
    });

    // Event Listeners
    socket.on('collab_question', (data) => {
      if (data.token !== token) return;
      setStreamingHistoryId(data.history_id);
      setIsStreaming(true);
      setLiveStreamText('');
    });

    socket.on('collab_stream_chunk', (data) => {
      if (data.token !== token) return;
      setLiveStreamText((prev) => prev + data.chunk);
    });

    socket.on('collab_stream_done', (data) => {
      if (data.token !== token) return;
      setIsStreaming(false);
      setLiveStreamText('');
      setStreamingHistoryId(null);
      if (typeof onHistoryRefresh === 'function') {
        onHistoryRefresh();
      }
    });

    socket.on('user_joined', (data) => {
      if (data.token !== token) return;
      setActiveUsers((prev) => {
        if (prev.includes(data.user_name)) return prev;
        return [...prev, data.user_name];
      });
    });

    socket.on('user_left', (data) => {
      if (data.token !== token) return;
      setActiveUsers((prev) => prev.filter((u) => u !== data.user_name));
    });

    // Cleanup on unmount or token change
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_room', { token, user_name: userName });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      resetStream();
    };
  }, [token, userToken, userName, onHistoryRefresh, resetStream]);

  return {
    connected,
    liveStreamText,
    isStreaming,
    streamingHistoryId,
    activeUsers,
    resetStream,
  };
}
