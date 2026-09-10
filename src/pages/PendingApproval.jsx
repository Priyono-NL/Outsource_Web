// src/pages/PendingApproval.jsx
import React from 'react';
import { redirectToSSOLogout, removeCookie } from '../utils/sso';

const PendingApproval = () => {
  const handleLogout = () => {
    removeCookie('sso_token');
    removeCookie('sso_user');
    localStorage.clear();
    redirectToSSOLogout();
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card shadow-lg border-0 text-center p-4" style={{ maxWidth: '500px' }}>
        <div className="card-body">
          <div className="mb-3 text-warning">
            <i className="bi bi-clock-history display-1"></i>
          </div>
          <h3 className="card-title fw-bold mb-2">Akses Belum Dikonfigurasi</h3>
          <p className="card-text text-muted mb-4">
            Akun SSO Anda berhasil terhubung, tetapi Admin belum menentukan hak akses role lokal untuk Anda di aplikasi ini.
          </p>
          <div className="alert alert-info small text-start mb-4" role="alert">
            <i className="bi bi-info-circle-fill me-2"></i>
            Silakan hubungi Administrator IT untuk memberikan konfigurasi role pada akun Anda.
          </div>
          <button className="btn btn-outline-danger w-100" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right me-2"></i> Keluar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;