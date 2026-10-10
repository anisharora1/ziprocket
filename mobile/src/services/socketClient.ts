import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  (process.env.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '')
    : 'https://ziprocket-backend.onrender.com');

/**
 * Initialize or re-authenticate the singleton Socket.IO connection.
 */
export const initSocket = (token?: string | null): Socket => {
  const authToken = token || null;

  if (socket) {
    if (authToken && socket.auth && (socket.auth as any).token !== authToken) {
      socket.auth = { token: authToken };
      if (socket.disconnected) {
        socket.connect();
      }
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token: authToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: !!authToken,
  });

  if (__DEV__) {
    socket.on('connect', () => {
      console.log('[Socket.IO Mobile] Connected to server. Socket ID:', socket?.id);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket.IO Mobile] Connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO Mobile] Disconnected from server:', reason);
    });
  }

  return socket;
};

/**
 * Get the active socket instance.
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Disconnect and clean up the current socket.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
