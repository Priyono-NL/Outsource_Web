import React from 'react';
import { useAuth } from '../utils/useAuth';

const PendingAccess = () => {
  const { user } = useAuth();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(user?.email || '');
    alert('Email berhasil disalin! Silakan kirimkan ke Admin IT / HR.');
  };

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 text-center p-4 bg-white">
            
            {/* Icon Status */}
            <div className="mb-3">
              <div 
                className="d-inline-flex align-items-center justify-content-center bg-warning bg-opacity-10 text-warning rounded-circle"
                style={{ width: '80px', height: '80px' }}
              >
                <i className="bi bi-person-lock fs-1"></i>
              </div>
            </div>

            {/* Header Text */}
            <h5 className="fw-bold text-dark mb-2">Akun SSO Berhasil Terintegrasi</h5>
            <span className="badge bg-warning text-dark px-3 py-2 rounded-pill mx-auto mb-3" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-clock-history me-1"></i> Menunggu Mapping Role Akses
            </span>

            <p className="text-secondary mb-4" style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
              Halo <strong>{user?.nama || 'Pengguna'}</strong>, akun Anda telah terdaftar melalui SSO. 
              Namun, Admin belum mengonfigurasi <strong>Role & Hak Akses Sub Company/Cost Center</strong> untuk akun ini.
            </p>

            {/* User Info Box */}
            <div className="card border-0 bg-light p-3 rounded-3 text-start mb-4" style={{ fontSize: '0.8rem' }}>
              <div className="row g-2">
                <div className="col-4 text-secondary">Nama Lengkap</div>
                <div className="col-8 fw-semibold text-dark">: {user?.nama || '-'}</div>

                <div className="col-4 text-secondary">Username</div>
                <div className="col-8 fw-semibold text-dark">: {user?.email || '-'}</div>

                <div className="col-4 text-secondary">Status Mapping</div>
                <div className="col-8 text-danger fw-bold">: Belum Di-mapping</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingAccess;