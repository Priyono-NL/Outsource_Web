// src/utils/useAuth.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api';
import { getCookie, removeCookie, redirectToSSOLogin, redirectToSSOLogout } from './sso';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('sso_user_cache') || 'null'));
  const [role, setRole] = useState(() => localStorage.getItem('sso_role_cache') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const MODULE_CODE = import.meta.env.VITE_MODULE_CODE || 'CRSHR';

  useEffect(() => {
    // Abaikan jika sedang berada di halaman Callback agar tidak bentrok
    if (window.location.pathname.includes('/auth/callback')) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const verifyAndSyncSSO = async () => {
      try {
        // 1. Tangkap Token dari URL (Jika SSO melempar langsung ke root '/')
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');

        let token = getCookie('sso_token') || localStorage.getItem('sso_token_backup');

        // Jika ada token di URL, jadikan sebagai sumber utama dan amankan ke Storage
        if (tokenFromUrl) {
          token = tokenFromUrl;
          
          import('./sso').then(({ setCookie }) => setCookie('sso_token', token));
          localStorage.setItem('sso_token_backup', token);
          
          // Bersihkan URL dari token agar terlihat rapi dan tidak memicu infinite loop
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // 2. Validasi Ketersediaan Token
        if (!token) {
          throw new Error('Token tidak ditemukan di Cookie maupun LocalStorage.');
        }

        // 3. Decode Token dengan Base64Url Fix (Mencegah DOMException)
        const payloadBase64 = token.split('.')[1];
        const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));

        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < currentTime) {
          throw new Error('Token JWT SSO sudah Expired.');
        }

        const ssoRole = payload.module_roles?.[MODULE_CODE] || payload.role || 'viewer';

        // 4. Hit-and-Run API sso-sync
        const response = await api.post('/api/auth/sso-sync', {
          sso_user_id: payload.user_id || payload.sub || payload.email,
          email: payload.email,
          nama: payload.name || payload.nama,
          department: payload.department,
          role_sso: ssoRole
        });

        if (!isMounted) return;

        if (response.data && response.data.success) {
          const userData = response.data.user;
          const userRole = userData.role_app || userData.role || ssoRole;

          setIsAuthenticated(true);
          setUser(userData);
          setRole(userRole);

          localStorage.setItem('sso_user_cache', JSON.stringify(userData));
          localStorage.setItem('sso_role_cache', userRole);
        } else {
          throw new Error('Backend berhasil dihubungi, tapi respons sukses bernilai false.');
        }
      } catch (error) {
        removeCookie('sso_token');
        localStorage.removeItem('sso_token_backup');
        localStorage.removeItem('sso_user_cache');
        localStorage.removeItem('sso_role_cache');

        if (isMounted) {
          redirectToSSOLogin();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifyAndSyncSSO();
    return () => { isMounted = false; };
  }, []);

  const logout = () => {
    removeCookie('sso_token');
    localStorage.clear();
    sessionStorage.clear();    
    redirectToSSOLogout();
  };
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }} />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);