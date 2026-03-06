import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000', 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
// Interceptor untuk menangani error secara global
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Cek error-nya
    if (error.response && error.response.status === 401) {
      console.warn("Sesi terdeteksi habis oleh Interceptor!");
      localStorage.removeItem('token');
      alert("Sesi Anda telah berakhir. Silakan login kembali.");
      window.location.href = "https://sso.ceresnl.com/Logout"; 
    }    
    return Promise.reject(error);
  }
);

export default api;