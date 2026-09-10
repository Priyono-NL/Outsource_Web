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
    // 1. Cek token penyamaran (Impersonate)
    const impersonateToken = localStorage.getItem('app_token');
    
    // 2. Coba ambil token SSO dari Cookie
    let ssoToken = getCookie('sso_token');

    // 3. PERBAIKAN: Jika cookie kosong (karena pakai IP Address), ambil dari backup
    if (!ssoToken) {
      ssoToken = localStorage.getItem('sso_token_backup');
    }

    // 4. Pilih token mana yang akan dipakai
    const activeToken = impersonateToken || ssoToken;

    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;