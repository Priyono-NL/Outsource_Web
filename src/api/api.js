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

api.interceptors.request.use(
  (config) => {
    const impersonateToken = localStorage.getItem('app_token');     
    let ssoToken = getCookie('sso_token');
    if (!ssoToken) ssoToken = localStorage.getItem('sso_token_backup');
    const activeToken = impersonateToken || ssoToken;
    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
      try {
        const payloadBase64 = activeToken.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        config.headers['X-User-Email'] = payload.email;
      } catch (error) {
        console.error("Gagal men-decode token JWT di Interceptor:", error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;