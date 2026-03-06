import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from './api/api';

import Sidebar from './components/Sidebar';

import SubCompany from './pages/SubCompany';
import Training_m from './pages/Training_m';
import Medical_m from './pages/Medical_m';
import Canteen from './pages/Canteen';
import CostCenter from './pages/CostCenter';

import Dashboard from './pages/Dashboard';
import Alokasi from './pages/Alokasi'
import OsMedical from './pages/OsMedical';
import OsTraining from './pages/OsTraining';

function App() {
  const [authState, setAuthState] = useState({ isAuthenticated: false, loading: true, user: null });

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // 1. TANGKAP: Lihat apakah ada ?token= di URL address bar
        const params = new URLSearchParams(window.location.search);
        const tokenURL = params.get('token');
        if (tokenURL) {
          // Simpan ke Local Storage agar tidak hilang saat refresh
          const cleanToken = tokenURL.replace(/^"|"$/g, '');
          localStorage.setItem('token', JSON.stringify(cleanToken));        
          // Bersihkan URL agar rapi (menghilangkan ?token=...)
          window.history.replaceState({}, document.title, "/");
        }
        // 2. AMBIL: Cek apakah sekarang sudah ada token di Local Storage?
        let token = localStorage.getItem('token');
        if (!token) {
          // Jika tetap tidak ada, hentikan loading dan tampilkan tombol login
          setAuthState({ isAuthenticated: false, loading: false, user: null });
          return;
        }
        // 3. VALIDASI: Kirim ke Flask untuk memastikan token masih aktif
        const finalToken = token.replace(/^"|"$/g, '');
        const res = await api.post('/api/validate-token-storage', { token: finalToken });
        if (res.data.isAuthenticated) {
          setAuthState({ isAuthenticated: true, loading: false, user: res.data.user });
        } else {
          localStorage.removeItem('token');
          setAuthState({ isAuthenticated: false, loading: false, user: null });
        }
      } catch (err) {
        console.error("Gagal memproses token", err);
        setAuthState({ isAuthenticated: false, loading: false, user: null });
      }
    };
    handleAuth();
  }, []);

  if (authState.loading) {
    return <div className="p-5 text-center">Memverifikasi Sesi...</div>;
  }
  if (!authState.isAuthenticated) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <p>Anda belum login.</p>
          <a href="https://sso.ceresnl.com/Logout" className="btn btn-primary">Ke Halaman Login</a>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await api.get('/api/logout');
      localStorage.removeItem('token');
      setAuthState({ isAuthenticated: false, loading: false, user: null });
      window.location.href = "https://sso.ceresnl.com/Logout";
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  };

  return (
    <BrowserRouter>
      <div className="d-flex flex-column vh-100 bg-light">         
        {/* --- 1. NAVBAR (ATAS) --- */}
        <nav className="navbar navbar-dark bg-dark shadow-sm z-1">
          <div className="container-fluid px-4">
            <span className="navbar-brand mb-0 h1 fw-bold">Manajemen OS</span>
            {authState.isAuthenticated && (
              <div className="d-flex align-items-center">
                <div className="text-end me-3">
                  <div className="text-white small fw-semibold">
                    {authState.user?.fname}
                  </div>
                  <div className="text-white-50" style={{ fontSize: '0.75rem' }}>
                    Logged In
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="btn btn-outline-danger btn-sm px-3 shadow-sm"
                >
                  <i className="bi bi-box-arrow-right me-1"></i> Logout
                </button>
              </div>
            )}
          </div>
        </nav>        
        {/* --- 2. AREA BAWAH (KIRI & KANAN) --- */}
        <div className="d-flex flex-grow-1 overflow-hidden">
          <Sidebar />          
          <div className="flex-grow-1 overflow-auto p-4">
            <Routes>
              {/* processing data */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/alokasi" element={<Alokasi />} />
              <Route path="/os-medical" element={<OsMedical />} />
              <Route path="/os-training" element={<OsTraining />} />
              <Route path="/costcenter" element={<CostCenter />} />
              {/* master data */}
              <Route path="/sub-company" element={<SubCompany />} />
              <Route path="/training-m" element={<Training_m />} />
              <Route path="/medical-m" element={<Medical_m />} />
              <Route path="/canteen" element={<Canteen />} />              
                            
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
