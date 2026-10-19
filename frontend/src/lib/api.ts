import axios from 'axios';

const DEFAULT_API_URL = 'https://proctorguardai.onrender.com/api';

// Resolve appropriate API URL with high-speed local development & seamless cloud fallback
export const getBaseURL = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (envUrl) {
    const apiUrl = /\/api$/i.test(envUrl) ? envUrl : `${envUrl}/api`;
    if (typeof window !== 'undefined') {
      try {
        if (new URL(apiUrl, window.location.origin).origin === window.location.origin) {
          return DEFAULT_API_URL;
        }
      } catch {
        return DEFAULT_API_URL;
      }
    }
    return apiUrl;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal) {
      return 'http://localhost:5000/api';
    }
  }
  return DEFAULT_API_URL;
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 90000,
  headers: {
    'Accept': 'application/json',
  }
});

// Request interceptor to add token & dynamic baseURL
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle transparent fallback and 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    // Auto-fallback: If request to local backend failed (e.g. backend server not running locally),
    // automatically fallback to live cloud API so the developer / user experience is never broken
    if (
      config &&
      !config._fallbackAttempted &&
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      config.baseURL?.includes('localhost:5000') &&
      (!error.response || error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK')
    ) {
      config._fallbackAttempted = true;
      config.baseURL = DEFAULT_API_URL;
      console.warn('[API] Local server unreachable at localhost:5000; seamlessly falling back to live API.');
      return api(config);
    }

    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      if (!isAuthEndpoint && typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.replace('/login');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
