import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useError } from '../contexts/ErrorContext';

interface WebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  reconnectDelayMax?: number;
  timeout?: number;
}

interface WebSocketState {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  lastError?: string;
}

const useWebSocket = (options: WebSocketOptions = {}) => {
  const {
    url = 'http://localhost:5000',
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    reconnectDelayMax = 30000,
    timeout = 20000
  } = options;

  const { addError } = useError();
  const [state, setState] = useState<WebSocketState>({
    socket: null,
    isConnected: false,
    isReconnecting: false,
    reconnectAttempt: 0
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const shouldReconnectRef = useRef(true);

  const calculateReconnectDelay = useCallback((attempt: number): number => {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      reconnectDelay * Math.pow(1.5, attempt),
      reconnectDelayMax
    );
    
    // Add random jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    return Math.max(1000, exponentialDelay + jitter);
  }, [reconnectDelay, reconnectDelayMax]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
  }, []);

  const startHeartbeat = useCallback((socket: Socket) => {
    // Clear any existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, 30000);
  }, []);

  const connect = useCallback(() => {
    if (state.socket?.connected) {
      return state.socket;
    }

    console.log(`🔌 Connecting to WebSocket: ${url}`);

    const newSocket = io(url, {
      timeout,
      transports: ['websocket', 'polling'],
      upgrade: true,
      autoConnect: false,
      reconnection: false // We handle reconnection manually
    });

    // Connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (!newSocket.connected) {
        console.error('❌ WebSocket connection timeout');
        newSocket.disconnect();
        setState(prev => ({
          ...prev,
          lastError: 'Connection timeout'
        }));
      }
    }, timeout);

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

      setState(prev => ({
        ...prev,
        socket: newSocket,
        isConnected: true,
        isReconnecting: false,
        reconnectAttempt: 0,
        lastError: undefined
      }));

      startHeartbeat(newSocket);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`🔌 WebSocket disconnected: ${reason}`);
      
      setState(prev => ({
        ...prev,
        isConnected: false,
        lastError: reason
      }));

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Attempt reconnection for client-side disconnections
      if (shouldReconnectRef.current && reason !== 'io client disconnect') {
        attemptReconnect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      
      setState(prev => ({
        ...prev,
        lastError: error.message
      }));

      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

      // Add error to global error context
      addError('WebSocket connection failed. Real-time updates may be unavailable.', 'error');

      if (shouldReconnectRef.current) {
        attemptReconnect();
      }
    });

    newSocket.on('heartbeat_response', () => {
      // Server responded to heartbeat - connection is healthy
    });

    // Handle custom error events from server
    newSocket.on('error', (data) => {
      console.error('❌ WebSocket server error:', data);
      addError(data.message || 'WebSocket server error', 'error');
    });

    newSocket.connect();
    return newSocket;
  }, [url, timeout, state.socket, addError, startHeartbeat]);

  const attemptReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) {
      return;
    }

    setState(prev => {
      const newAttempt = prev.reconnectAttempt + 1;
      
      if (newAttempt > reconnectAttempts) {
        console.error(`❌ Max reconnection attempts (${reconnectAttempts}) reached`);
        addError('Unable to establish real-time connection. Please refresh the page.', 'error');
        return {
          ...prev,
          isReconnecting: false,
          lastError: 'Max reconnection attempts reached'
        };
      }

      const delay = calculateReconnectDelay(newAttempt - 1);
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${newAttempt}/${reconnectAttempts})`);

      setState(current => ({
        ...current,
        isReconnecting: true,
        reconnectAttempt: newAttempt
      }));

      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldReconnectRef.current) {
          connect();
        }
      }, delay);

      return {
        ...prev,
        isReconnecting: true,
        reconnectAttempt: newAttempt
      };
    });
  }, [reconnectAttempts, calculateReconnectDelay, connect, addError]);

  const disconnect = useCallback(() => {
    console.log('🔌 Manually disconnecting WebSocket');
    shouldReconnectRef.current = false;
    cleanup();
    
    if (state.socket) {
      state.socket.disconnect();
      setState(prev => ({
        ...prev,
        socket: null,
        isConnected: false,
        isReconnecting: false,
        reconnectAttempt: 0
      }));
    }
  }, [state.socket, cleanup]);

  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnection triggered');
    shouldReconnectRef.current = true;
    
    setState(prev => ({
      ...prev,
      reconnectAttempt: 0,
      isReconnecting: false
    }));
    
    if (state.socket) {
      state.socket.disconnect();
    }
    
    connect();
  }, [state.socket, connect]);

  // Event listener utilities
  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (state.socket) {
      state.socket.on(event, callback);
    }
  }, [state.socket]);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (state.socket) {
      if (callback) {
        state.socket.off(event, callback);
      } else {
        state.socket.off(event);
      }
    }
  }, [state.socket]);

  const emit = useCallback((event: string, ...args: any[]) => {
    if (state.socket?.connected) {
      state.socket.emit(event, ...args);
      return true;
    } else {
      console.warn(`⚠️ Attempted to emit '${event}' on disconnected socket`);
      return false;
    }
  }, [state.socket]);

  // Initialize connection
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      shouldReconnectRef.current = false;
      cleanup();
      if (state.socket) {
        state.socket.disconnect();
      }
    };
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Browser back online');
      if (!state.isConnected && shouldReconnectRef.current) {
        reconnect();
      }
    };

    const handleOffline = () => {
      console.log('🌐 Browser went offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.isConnected, reconnect]);

  return {
    socket: state.socket,
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    reconnectAttempt: state.reconnectAttempt,
    lastError: state.lastError,
    connect,
    disconnect,
    reconnect,
    on,
    off,
    emit
  };
};

export default useWebSocket;