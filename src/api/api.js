import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000', 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sso_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('sso_token');
      const returnUrl = encodeURIComponent(window.location.origin);
      window.location.href = `https://sso.ceresnl.com/?returnUrl=${returnUrl}`;
    }
    return Promise.reject(error);
  }
);

export default api;