import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
  headers: {
    'X-Tunnel-Skip-Anti-Phishing-Page': 'true',
    'Content-Type': 'application/json',
  },
}); 

// -----------------------------------------------------------
// Interceptor response: tangani 401 otomatis
// Jika session habis, redirect ke SSO login
// -----------------------------------------------------------
// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const status = error.response?.status;
//     const code   = error.response?.data?.code;
//     const url    = error.config?.url;

//     // Hindari infinite loop pada endpoint auth itu sendiri
//     const isAuthEndpoint = url?.includes('/auth/');

//     if (status === 401 && !isAuthEndpoint) {
//       try {
//         const res = await axios.get(`${BACKEND_URL}/auth/sso-url`, { withCredentials: true });
//         window.location.href = res.data.url;
//       } catch {
//         window.location.reload();
//       }
//       return Promise.reject(error);
//     }

//     return Promise.reject(error);
//   }
// );

export default api;
