import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { Toast } from './sweetalert';

export function useAuth() {
  const authState = {
      isAuthenticated: true,
      loading: false,
      user: { fname: "Admin Lokal", role: "admin" }
  };

  const handleLogout = () => console.log("Logout (dev mode)");

  // const [authState, setAuthState] = useState({
  //   isAuthenticated: false,
  //   loading: true,
  //   user: null,
  // });

  // -----------------------------------------------------------
  // Cek status login ke backend saat pertama load
  // Backend yang pegang token SSO (server-side session)
  // -----------------------------------------------------------
  // const checkAuth = useCallback(async () => {
  //   try {
  //     const res = await api.get('/auth/me');
  //     if (res.data.logged_in) {
  //       setAuthState({
  //         isAuthenticated: true,
  //         loading: false,
  //         user: res.data.user,
  //       });
  //     } else {
  //       redirectToSSO();
  //     }
  //   } catch (err) {
  //     // 401 = belum login, redirect ke SSO
  //     if (err.response?.status === 401) {
  //       redirectToSSO();
  //     } else {
  //       console.error('Auth check error:', err);
  //       setAuthState({ isAuthenticated: false, loading: false, user: null });
  //     }
  //   }
  // }, []);

  // useEffect(() => {
  //   checkAuth();
  // }, [checkAuth]);

  // -----------------------------------------------------------
  // Sinkronisasi sesi — pastikan token masih valid
  // -----------------------------------------------------------
  // useEffect(() => {
  //   if (!authState.isAuthenticated) return;

  //   const interval = setInterval(async () => {
  //     try {
  //       const res = await api.get('/auth/me');
  //       if (!res.data.logged_in) {
  //         Toast.fire({ icon: 'warning', title: 'Sesi Anda telah berakhir.' });
  //         redirectToSSO();
  //       }
  //     } catch (err) {
  //       if (err.response?.status === 401) {
  //         Toast.fire({ icon: 'warning', title: 'Sesi Anda telah berakhir.' });
  //         redirectToSSO();
  //       }
  //     }
  //   }, 30 * 60 * 1000); // 30 menit

  //   return () => clearInterval(interval);
  // }, [authState.isAuthenticated]);

  // -----------------------------------------------------------
  // Logout — revoke token di SSO, clear session backend
  // -----------------------------------------------------------
  // const handleLogout = async () => {
  //   try {
  //     await api.post('/auth/logout');
  //     Toast.fire({ icon: 'info', title: 'Anda telah keluar.' });
  //   } catch (err) {
  //     console.error('Logout error:', err);
  //   } finally {
  //     setAuthState({ isAuthenticated: false, loading: false, user: null });
  //     // Redirect ke halaman login SSO
  //     const res = await api.get('/auth/sso-url').catch(() => null);
  //     if (res?.data?.url) {
  //       window.location.href = res.data.url;
  //     } else {
  //       window.location.reload();
  //     }
  //   }
  // };

  // -----------------------------------------------------------
  // Redirect ke SSO login
  // -----------------------------------------------------------
  // const redirectToSSO = async () => {
  //   try {
  //     const res = await api.get('/auth/sso-url');
  //     window.location.href = res.data.url;
  //   } catch (err) {
  //     console.error('Gagal ambil SSO URL:', err);
  //     setAuthState({ isAuthenticated: false, loading: false, user: null });
  //   }
  // };

  return { authState, handleLogout };
}
