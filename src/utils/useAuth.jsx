import { useState, useEffect } from 'react';
import api from '../api/api';
import { Toast } from './sweetalert';

const SSO_API_URL = "https://sso.ceresnl.com:50443/api/session";
const SSO_VALIDATE_URL = "https://sso.ceresnl.com:50443/api/validate-token";
const SSO_LOGIN_URL = "https://sso.ceresnl.com";
const SSO_LOGOUT_URL = "https://sso.ceresnl.com/Logout";

export function useAuth() {
    const authState = {
        isAuthenticated: true,
        loading: false,
        user: { fname: "Admin Lokal" }
    };

    const handleLogout = () => console.log("Logout (dev mode)");
//   const [authState, setAuthState] = useState({
//     isAuthenticated: false,
//     loading: true,
//     user: null,
//   });

//   // --- Cek & inisialisasi sesi saat pertama load ---
//   useEffect(() => {
//     const handleAuth = async () => {
//       try {
//         const params = new URLSearchParams(window.location.search);
//         const tokenFromUrl = params.get('token');

//         if (tokenFromUrl) {
//           localStorage.setItem('sso_token', tokenFromUrl);
//           window.history.replaceState({}, document.title, window.location.pathname);

//           const valRes = await api.post(SSO_VALIDATE_URL, { token: tokenFromUrl });
//           if (!valRes.data.isAuthenticated) {
//             throw new Error("Token tidak valid");
//           }
//           Toast.fire({ icon: 'success', title: 'Login Berhasil!', text: 'Selamat datang.' });
//         }

//         const res = await api.get(SSO_API_URL);
//         if (res.data.isAuthenticated === true) {
//           await api.post('/sync-session', {
//             isAuthenticated: true,
//             user: res.data,
//           });
//           setAuthState({ isAuthenticated: true, loading: false, user: res.data });
//         } else {
//           redirectToSSO();
//         }
//       } catch (err) {
//         console.error("Auth failed:", err);
//         redirectToSSO();
//       }
//     };

//     handleAuth();
//   }, []);

//   // --- Sinkronisasi sesi setiap 60 detik ---
//   useEffect(() => {
//     if (!authState.isAuthenticated) return;

//     const syncWithSSO = setInterval(async () => {
//       try {
//         const res = await api.get(SSO_API_URL);
//         if (res.data && res.data.isAuthenticated === false) {
//           Toast.fire({ icon: 'warning', title: 'Sesi Anda telah berakhir.' });
//           await api.get('/logout');
//           redirectToSSO();
//         }
//       } catch (err) {
//         console.error("Gagal sinkronisasi sesi:", err);
//       }
//     }, 60000);

//     return () => clearInterval(syncWithSSO);
//   }, [authState.isAuthenticated]);

//   // --- Logout ---
//   const handleLogout = async () => {
//     try {
//       await api.get('/logout');
//       Toast.fire({ icon: 'info', title: 'Anda telah keluar.' });
//     } catch (error) {
//       console.error("Gagal logout di server:", error);
//     } finally {
//       window.location.href = SSO_LOGOUT_URL;
//     }
//   };

//   const redirectToSSO = () => {
//     const currentUrl = window.location.origin;
//     window.location.href = `${SSO_LOGIN_URL}/?returnUrl=${encodeURIComponent(currentUrl)}`;
//   };

  return { authState, handleLogout };
}