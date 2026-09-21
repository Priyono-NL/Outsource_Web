// src/utils/useAuth.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api';
import { getCookie, removeCookie, redirectToSSOLogin, redirectToSSOLogout, setCookie } from './sso';

const AuthContext = createContext(null);

// DAFTAR EMAIL USER KHUSUS DISPLAY / MONITORING (NEVER EXPIRE)
const INFINITE_SESSION_USERS = [
  'security'
];

// KONFIGURASI DURASI SESI (DALAM DETIK)
const NORMAL_USER_MAX_AGE   = 3600;      // 1 Jam
const INFINITE_USER_MAX_AGE = 315360000;  // 10 Tahun (315.360.000 Detik)

/**
 * HELPER: Memeriksa Izin Akses Modul berdasarkan Payload JWT
 */
const validateModuleAccess = (moduleAccessMap, targetModuleCode) => {
  if (!moduleAccessMap || typeof moduleAccessMap !== 'object') {
    return false;
  }

  const accessVal = moduleAccessMap[targetModuleCode];

  if (accessVal === undefined || accessVal === null) return false;
  if (accessVal === false || accessVal === 0) return false;

  const strVal = String(accessVal).trim().toUpperCase();
  const forbiddenValues = ['NO', 'FALSE', '0', 'NONE', 'DISABLED', ''];
  
  return !forbiddenValues.includes(strVal);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('sso_user_cache') || 'null'));
  const [role, setRole] = useState(() => localStorage.getItem('sso_role_cache') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDeniedError, setAccessDeniedError] = useState(null);

  const MODULE_CODE = import.meta.env.VITE_MODULE_CODE || 'CRSHR';

  useEffect(() => {
    if (window.location.pathname.includes('/auth/callback')) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const verifyAndSyncSSO = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');

        let token = getCookie('sso_token') || localStorage.getItem('sso_token_backup');

        if (tokenFromUrl) {
          token = tokenFromUrl;
          localStorage.setItem('sso_token_backup', token);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (!token) {
          throw new Error('Token tidak ditemukan di Cookie maupun LocalStorage.');
        }

        // 1. Decode Payload JWT
        const payloadBase64 = token.split('.')[1];
        const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));

        const userEmail = payload.email || payload.sub || payload.user_id;
        const isInfiniteUser = INFINITE_SESSION_USERS.includes(userEmail);

        // 2. Validasi Expired (Bypass jika user khusus)
        const currentTime = Math.floor(Date.now() / 1000);
        if (!isInfiniteUser && payload.exp && payload.exp < currentTime) {
          throw new Error('Token JWT SSO sudah Expired.');
        }

        // 3. ATURAN KETAT: VALIDASI HAK AKSES MODUL
        const hasAccess = validateModuleAccess(payload.module_access, MODULE_CODE);
        if (!hasAccess) {
          const errorMessage = `Akun Anda (${userEmail}) tidak memiliki hak akses untuk modul [${MODULE_CODE}].`;
          if (isMounted) {
            setAccessDeniedError(errorMessage);
          }
          throw new Error(errorMessage);
        }

        // 4. Set Cookie & Role SSO untuk Modul Spesifik
        const cookieMaxAge = isInfiniteUser ? INFINITE_USER_MAX_AGE : NORMAL_USER_MAX_AGE;
        setCookie('sso_token', token, cookieMaxAge);
        localStorage.setItem('sso_token_backup', token);

        const ssoRole = payload.module_roles?.[MODULE_CODE] || payload.role || 'viewer';

        // 5. Tembak Backend untuk Sinkronisasi Sesi
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
          // Jika penyebab error BUKAN karena ditolak modul, kembalikan ke Login SSO
          if (!error.message.includes('tidak memiliki hak akses')) {
            redirectToSSOLogin();
          }
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

  // TAMPILAN ELEGAN JIKA AKSES MODUL DITOLAK (MENCEGAH INFINITE REDIRECT LOOP)
  if (accessDeniedError) {
    const ssoUrl = import.meta.env.VITE_SSO_URL || 'https://account.ceresnl.com';

    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow-sm border-0 p-4 text-center" style={{ maxWidth: '480px', borderRadius: '12px' }}>
          <div className="mb-3 text-danger">
            <i className="bi bi-shield-lock-fill" style={{ fontSize: '3.5rem' }}></i>
          </div>
          <h4 className="fw-bold text-dark mb-2">403 - Akses Modul Ditolak</h4>
          <p className="text-muted mb-4">{accessDeniedError}</p>
          <div className="d-grid gap-2">
            <a href={ssoUrl} className="btn btn-primary fw-bold py-2" style={{ borderRadius: '8px' }}>
              <i className="bi bi-grid-3x3-gap-fill me-2"></i> Kembali ke Portal SSO
            </a>
            <button onClick={logout} className="btn btn-outline-secondary py-2" style={{ borderRadius: '8px' }}>
              <i className="bi bi-box-arrow-right me-2"></i> Keluar / Ganti Akun
            </button>
          </div>
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

export const useAuth = () => useContext(AuthContext);