// src/utils/useAuth.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api'; // Menggunakan Axios Client yang sudah kamu buat
import { getCookie, removeCookie, redirectToSSOLogin, redirectToSSOLogout } from './sso';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);

  const MODULE_CODE = import.meta.env.VITE_MODULE_CODE || 'OUTSOURCE_WEB';

  useEffect(() => {
    let isMounted = true; // Cleanup flag untuk mencegah memory leak / state update pada unmounted component

    // 1. TANGKAP TOKEN DARI URL (Wajib untuk testing beda domain/IP)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    let token = getCookie('sso_token'); // Coba baca dari cookie dulu

    // 2. Jika ada token di URL, itu yang kita pakai & simpan ke LocalStorage
    if (tokenFromUrl) {
      token = tokenFromUrl;
      localStorage.setItem('sso_token_backup', token); // Simpan manual untuk IP address
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 3. Fallback: Jika di cookie tidak ada, ambil dari backup LocalStorage
    if (!token) {
      token = localStorage.getItem('sso_token_backup');
    }

    // 4. Jika benar-benar tidak ada token, baru lempar ke SSO
    if (!token) {
      redirectToSSOLogin();
      return;
    }

    try {
      // Dekode payload JWT
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));

      // Cek Expiration Time
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentTime) {
        throw new Error('Token SSO Expired');
      }

      // Validasi Hak Akses Modul Spesifik
      if (payload.module_access && payload.module_access[MODULE_CODE] === false) {
        throw new Error(`Unauthorized: User tidak memiliki akses modul ${MODULE_CODE}`);
      }

      const ssoRole = payload.module_roles?.[MODULE_CODE] || payload.role || 'viewer';

      // 3. Sinkronkan dengan Backend (Python/PHP) Menggunakan AXIOS
      api.post('/api/auth/sso-sync', {
        sso_user_id: payload.user_id,
        email: payload.email,
        nama: payload.name,
        department: payload.department,
        role_sso: ssoRole
      })
      .then((response) => {
        if (!isMounted) return;

        const res = response.data;
        if (res.success) {
          if (res.is_configured === false) {
            setIsConfigured(false);
          } else {
            setIsConfigured(true);
            setUser(res.user);
            setRole(res.user.role_app); // Role Lokal dari MySQL
            setIsAuthenticated(true);
          }
        }
      })
      .catch((err) => {
        console.error('Gagal verifikasi ke backend lokal via Axios:', err);
        if (isMounted) {
          removeCookie('sso_token');
          redirectToSSOLogin();
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false); // Memastikan loading dimatikan setelah request selesai
        }
      });

    } catch (error) {
      console.error('SSO Validation Error:', error);
      removeCookie('sso_token');
      redirectToSSOLogin();
    }

    return () => {
      isMounted = false; // Cleanup
    };
  }, []);

  // 4. Polling Cookie untuk Single Sign-Out Sync (Setiap 3 detik)
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      // 1. Coba baca dari Cookie
      let token = getCookie('sso_token');
      
      // 2. Jika di Cookie kosong (karena pakai IP Address), cari di backup LocalStorage
      if (!token) {
        token = localStorage.getItem('sso_token_backup');
      }

      // 3. Jika kedua tempat tersebut BENAR-BENAR KOSONG, baru lempar balik ke SSO
      if (!token) {
        console.log("Sesi terhapus, mengembalikan ke SSO...");
        setIsAuthenticated(false);
        setUser(null);
        redirectToSSOLogin();
      }
    }, 3000); // Mengecek setiap 3 detik

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const logout = () => {
    removeCookie('sso_token');
    removeCookie('sso_user');
    localStorage.removeItem('sso_token_backup');
    localStorage.clear();
    sessionStorage.clear();
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
    <AuthContext.Provider value={{ user, role, isAuthenticated, isConfigured, logout }}>
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