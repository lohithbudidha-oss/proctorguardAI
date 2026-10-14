import axios from 'axios';

// Resolve appropriate API URL with high-speed local development & seamless cloud fallback
export const getBaseURL = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    // If running in local browser and NEXT_PUBLIC_API_URL isn't explicitly pointing to a custom domain
    if (isLocal) {
      if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        return envUrl;
      }
      return 'http://localhost:5000/api';
    }
  }
  return envUrl || 'https://proctorguardai.onrender.com/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 25000,
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
      config.baseURL = 'https://proctorguardai.onrender.com/api';
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
