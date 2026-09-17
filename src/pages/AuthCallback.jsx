// src/pages/AuthCallback.jsx
import React, { useEffect } from 'react';
import { setCookie } from '../utils/sso';

const AuthCallback = () => {
  useEffect(() => {
    // 1. Ambil dari Vanilla BOM untuk akurasi tertinggi sebelum React Router ikut campur
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // 2. Tulis Cookie (Aman untuk IP Local)
      setCookie('sso_token', token);
      
      // 3. Tulis Backup ke LocalStorage
      localStorage.setItem('sso_token_backup', token);

      // 4. Force Redirect agar lifecycle React di / membaca storage baru secara bersih
      window.location.replace('/');
    } else {
      window.location.replace('/');
    }
  }, []);

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="text-center">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }} />
        <h5 className="fw-bold">Menulis Sesi...</h5>
      </div>
    </div>
  );
};

export default AuthCallback;