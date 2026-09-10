import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 1. Tangkap parameter token dari URL
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');

    if (token) {
      // 2. Tentukan domain untuk Cookie (Sesuai helper utility SSO kita)
      const domain = window.location.hostname.includes('ceresnl.com')
        ? '.ceresnl.com'
        : window.location.hostname;

      // 3. Simpan token ke Cookie secara eksplisit agar bisa dibaca oleh useAuth.jsx
      // Set max-age ke 86400 detik (1 hari) atau sesuaikan dengan masa aktif JWT SSO
      document.cookie = `sso_token=${token};path=/;domain=${domain};max-age=86400;SameSite=Lax`;

      // 4. Redirect ke Dashboard dan bersihkan history URL callback
      navigate('/', { replace: true });
    } else {
      // Jika nyasar ke halaman ini tanpa token, kembalikan ke SSO Login
      const ssoUrl = import.meta.env.VITE_SSO_URL || 'https://account.ceresnl.com';
      const redirectUrl = encodeURIComponent(window.location.origin + '/auth/callback');
      window.location.href = `${ssoUrl}/login?redirect_url=${redirectUrl}`;
    }
  }, [location, navigate]);

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-sm border-0 p-4 text-center" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="card-body">
          {/* Spinner Bootstrap */}
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="card-title fw-bold text-dark mb-2">Autentikasi Berhasil</h4>
          <p className="card-text text-muted small mb-0">
            Menerima kredensial SSO... Mempersiapkan halaman utama Anda.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;