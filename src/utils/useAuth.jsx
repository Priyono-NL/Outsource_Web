// src/utils/useAuth.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api';
import { getCookie, removeCookie, redirectToSSOLogin, redirectToSSOLogout } from './sso';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const MODULE_CODE = import.meta.env.VITE_MODULE_CODE || 'CRSHR';

  useEffect(() => {
    if (sessionStorage.getItem('is_logging_out') === 'true') {
      sessionStorage.removeItem('is_logging_out');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const verifyAndSyncSSO = async () => {
      try {
        // 1. Ambil token dari URL, Cookie, atau Backup LocalStorage
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        let token = getCookie('sso_token');

        if (tokenFromUrl) {
          token = tokenFromUrl;
          localStorage.setItem('sso_token_backup', token);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (!token) {
          token = localStorage.getItem('sso_token_backup');
        }

        if (!token) {
          redirectToSSOLogin();
          return;
        }

        // 2. Dekode & Validasi Token
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));

        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < currentTime) {
          throw new Error('Token SSO Expired');
        }

        if (payload.module_access && payload.module_access[MODULE_CODE] === false) {
          throw new Error(`Unauthorized: User tidak memiliki akses modul ${MODULE_CODE}`);
        }

        const ssoRole = payload.module_roles?.[MODULE_CODE] || payload.role || 'viewer';

        // 3. Tembak API Backend dengan Async/Await
        const response = await api.post('/api/auth/sso-sync', {
          sso_user_id: payload.user_id || payload.sub || payload.email,
          email: payload.email,
          nama: payload.name || payload.nama,
          department: payload.department,
          role_sso: ssoRole
        });

        if (!isMounted) return;

        const res = response.data;
        if (res.success) {
          setIsAuthenticated(true);
          setUser(res.user);
          setRole(res.user.role_app);
        }
      } catch (error) {
        console.error('SSO Validation Error:', error);
        removeCookie('sso_token');
        localStorage.removeItem('sso_token_backup');
        
        if (isMounted) {
          redirectToSSOLogin();
        }
      } finally {
        // PASTI DIEKSEKUSI: Matikan loading apapun yang terjadi
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifyAndSyncSSO();

    return () => {
      isMounted = false;
    };
  }, []);

  // Polling Cookie untuk Single Sign-Out Sync
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      let token = getCookie('sso_token') || localStorage.getItem('sso_token_backup');

      if (!token) {
        console.log("Sesi terhapus, mengembalikan ke SSO...");
        setIsAuthenticated(false);
        setUser(null);
        redirectToSSOLogin();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    removeCookie('sso_token');
    removeCookie('sso_user');
    localStorage.clear();
    sessionStorage.clear();    
    sessionStorage.setItem('is_logging_out', 'true'); 
    redirectToSSOLogout();
  };
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h5 className="fw-bold">Memverifikasi Sesi SSO...</h5>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};