import io, { Socket } from 'socket.io-client';

const DEFAULT_WS_URL = 'https://proctorguardai.onrender.com';

export type ProctorSocket = Socket;
export type { Socket };

/**
 * Resolves the appropriate WebSocket / Socket.IO server URL.
 * Serverless platforms like Vercel do not support persistent WebSockets,
 * so any *.vercel.app domain will safely fall back to the dedicated Render WebSocket server.
 */
export const getSocketURL = (): string => {
  // 1. Explicit WebSocket URL from environment variable (ensure it's not pointing to Vercel)
  const envWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim().replace(/\/+$/, '');
  if (envWsUrl && !envWsUrl.includes('vercel.app')) {
    return envWsUrl;
  }

  // 2. Local development fallback
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }

  // 3. Fallback from NEXT_PUBLIC_API_URL (only if not on Vercel)
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (envApiUrl && !envApiUrl.includes('vercel.app')) {
    return envApiUrl.replace(/\/api\/?$/i, '');
  }

  // 4. Default persistent WebSocket backend
  return DEFAULT_WS_URL;
};

/**
 * Creates and configures a Socket.IO client instance with safe transport defaults.
 * Using transports: ['polling', 'websocket'] allows Socket.IO to perform the initial
 * handshake gracefully and upgrade to WebSocket, avoiding native WebSocket handshake 200 errors.
 */
export const createSocket = (options?: {
  token?: string | null;
  timeout?: number;
  reconnectionAttempts?: number;
}): Socket => {
  const wsUrl = getSocketURL();
  const token = options?.token ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  const socket = io(wsUrl, {
    auth: { token: token || '' },
    reconnectionAttempts: options?.reconnectionAttempts ?? 5,
    reconnectionDelay: 1500,
    timeout: options?.timeout ?? 10000,
    transports: ['polling', 'websocket']
  });

  socket.on('connect_error', (error) => {
    // Graceful error logging to prevent uncaught error spam
    console.warn(`[Socket.IO] Connection warning to ${wsUrl}:`, error?.message || error);
  });

  return socket;
};
