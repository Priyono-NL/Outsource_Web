import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000', 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      alert("Sesi Anda telah habis. Silakan login kembali.");
      window.location.href = "https://sso.ceresnl.com/Logout";
    }
    return Promise.reject(error);
  }
);

export default api;