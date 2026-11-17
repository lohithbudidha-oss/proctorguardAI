import io, { Socket } from 'socket.io-client';

const PRODUCTION_WS_URL = 'https://flair-sigma-red.vercel.app';

export type ProctorSocket = Socket;
export type { Socket };

/**
 * Resolves the appropriate WebSocket / Socket.IO server URL:
 * - Local URL (http://localhost:5000) when running locally
 * - Production URL (https://flair-sigma-red.vercel.app) when running in production
 */
export const getSocketURL = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal) {
      const localEnv = process.env.NEXT_PUBLIC_WS_URL?.trim().replace(/\/+$/, '');
      if (localEnv && (localEnv.includes('localhost') || localEnv.includes('127.0.0.1'))) {
        return localEnv;
      }
      return 'http://localhost:5000';
    }

    const envWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim().replace(/\/+$/, '');
    if (envWsUrl && !envWsUrl.includes('localhost') && !envWsUrl.includes('127.0.0.1')) {
      return envWsUrl;
    }
    return PRODUCTION_WS_URL;
  }

  const envWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim().replace(/\/+$/, '');
  if (envWsUrl) {
    return envWsUrl;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000';
  }
  return PRODUCTION_WS_URL;
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
