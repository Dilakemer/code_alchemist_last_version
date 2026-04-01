import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_BASE } from '../config';

/**
 * useCollabSocket — Live Sync Collaboration Hook
 *
 * Bir collaboration room'una bağlanır ve şu olayları yönetir:
 *  - collab_question    → Oda'ya yeni soru geldi (kim sordu)
 *  - collab_stream_chunk → AI'dan gelen her token parçası
 *  - collab_stream_done  → AI yanıtı tamamlandı
 *  - user_joined / user_left → Katılan / ayrılan kullanıcı
 *
 * @param {string|null} token - Collaboration room token
 * @param {string} userName   - Bağlanan kullanıcının adı
 * @param {Function} onHistoryRefresh - Yeni mesaj tamamlandığında çağrılacak callback
 */
export function useCollabSocket(token, userName = 'Guest', onHistoryRefresh = null) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Canlı streaming state'i
  const [liveStreamText, setLiveStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingHistoryId, setStreamingHistoryId] = useState(null);

  // Live soru bildirimi (kim ne sordu)
  const [lastQuestion, setLastQuestion] = useState(null);

  // Aktif kullanıcı listesi
  const [activeUsers, setActiveUsers] = useState([]);

  // Bağlantı modu (websocket / polling)
  const [transportMode, setTransportMode] = useState('connecting');

  const resetStream = useCallback(() => {
    setLiveStreamText('');
    setIsStreaming(false);
    setStreamingHistoryId(null);
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_BASE, {
      transports: ['websocket', 'polling'], // WebSocket önce dene, Render'da fallback polling
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 20000,
    });

    socketRef.current = socket;

    // --- Bağlantı olayları ---
    socket.on('connect', () => {
      setConnected(true);
      setTransportMode(socket.io.engine.transport.name);
      // Odaya katıl
      socket.emit('join_room', {
        token,
        user_name: userName,
      });
      console.log('[ColabSocket] Connected:', socket.id, 'via', socket.io.engine.transport.name);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      setTransportMode('disconnected');
      console.log('[ColabSocket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ColabSocket] Connection error:', err.message);
      setTransportMode('error');
    });

    // Transport upgrade bildirimi (polling → websocket)
    socket.io.on('upgrade', (transport) => {
      setTransportMode(transport.name);
    });

    // --- Collaboration olayları ---

    // Yeni soru odaya geldi
    socket.on('collab_question', (data) => {
      if (data.token !== token) return;
      setLastQuestion({
        question: data.question,
        sender: data.sender,
        historyId: data.history_id,
        timestamp: Date.now(),
      });
      setStreamingHistoryId(data.history_id);
      setIsStreaming(true);
      setLiveStreamText('');
    });

    // AI'dan gelen her chunk
    socket.on('collab_stream_chunk', (data) => {
      if (data.token !== token) return;
      setLiveStreamText(prev => prev + data.chunk);
    });

    // AI yanıtı tamamlandı
    socket.on('collab_stream_done', (data) => {
      if (data.token !== token) return;
      setIsStreaming(false);
      setLiveStreamText('');
      setStreamingHistoryId(null);
      // Parent'a bildir: chat history yenilensin
      if (typeof onHistoryRefresh === 'function') {
        onHistoryRefresh();
      }
    });

    // Kullanıcı katıldı
    socket.on('user_joined', (data) => {
      if (data.token !== token) return;
      setActiveUsers(prev => {
        const exists = prev.find(u => u === data.user_name);
        return exists ? prev : [...prev, data.user_name];
      });
    });

    // Kullanıcı ayrıldı
    socket.on('user_left', (data) => {
      if (data.token !== token) return;
      setActiveUsers(prev => prev.filter(u => u !== data.user_name));
    });

    return () => {
      socket.emit('leave_room', { token, user_name: userName });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      resetStream();
    };
  }, [token, userName]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connected,
    transportMode,
    liveStreamText,
    isStreaming,
    streamingHistoryId,
    lastQuestion,
    activeUsers,
    resetStream,
  };
}
