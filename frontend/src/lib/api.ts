import axios from 'axios';

const PRODUCTION_API_URL = 'https://flair-sigma-red.vercel.app/api';

// Resolve appropriate API URL: local URLs in local development, production URLs in production
export const getBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal) {
      const localEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
      if (localEnv && (localEnv.includes('localhost') || localEnv.includes('127.0.0.1'))) {
        return /\/api$/i.test(localEnv) ? localEnv : `${localEnv}/api`;
      }
      return 'http://localhost:5000/api';
    }

    const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return /\/api$/i.test(envUrl) ? envUrl : `${envUrl}/api`;
    }
    return PRODUCTION_API_URL;
  }

  // Server-side (SSR / Node.js build)
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (envUrl) {
    return /\/api$/i.test(envUrl) ? envUrl : `${envUrl}/api`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000/api';
  }
  return PRODUCTION_API_URL;
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
  config.baseURL = getBaseURL();
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      if (!isAuthEndpoint && typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          const isAdminRoute = window.location.pathname.startsWith('/admin');
          window.location.replace(isAdminRoute ? '/login?role=admin' : '/login');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
