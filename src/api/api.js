// src/api/api.js
import axios from 'axios';
import { getCookie } from '../utils/sso';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
  headers: {
    'X-Tunnel-Skip-Anti-Phishing-Page': 'true',
    'Content-Type': 'application/json',
  },
});

let cachedToken = null;
let cachedEmail = null;

function decodeTokenEmail(token) {
  if (!token) return null;
  if (token === cachedToken && cachedEmail !== null) {
    return cachedEmail;
  }
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    cachedToken = token;
    cachedEmail = payload.email || payload.sub || null;
    return cachedEmail;
  } catch (error) {
    console.error('Gagal men-decode token JWT di Interceptor:', error);
    return null;
  }
}

api.interceptors.request.use(
  (config) => {
    const impersonateToken = localStorage.getItem('app_token');     
    let ssoToken = getCookie('sso_token');
    if (!ssoToken) ssoToken = localStorage.getItem('sso_token_backup');
    const activeToken = impersonateToken || ssoToken;
    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
      const email = decodeTokenEmail(activeToken);
      if (email) {
        config.headers['X-User-Email'] = email;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      cachedToken = null;
      cachedEmail = null;
    }
    return Promise.reject(error);
  }
);

export default api;