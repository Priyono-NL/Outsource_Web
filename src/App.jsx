import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toast } from './utils/sweetalert';

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
import OsCard from './pages/OsCard';
import OsCC from './pages/OsCC';
import OsGrade from './pages/OsGrade';
import Blacklist from './pages/Blacklist';

function App() {
  const [authState, setAuthState] = useState({ isAuthenticated: false, loading: true, user: null });
  const SSO_API_URL = "https://sso.ceresnl.com:50443/api/session"
  const SSO_VALIDATE_URL = "https://sso.ceresnl.com:50443/api/validate-token";
  const SSO_LOGIN_URL = "https://sso.ceresnl.com";
  const SSO_LOGOUT_URL = "https://sso.ceresnl.com/Logout";

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');
        if (tokenFromUrl) {
          localStorage.setItem('sso_token', tokenFromUrl);
          window.history.replaceState({}, document.title, window.location.pathname);
          const valRes = await api.post(SSO_VALIDATE_URL, { token: tokenFromUrl });
          if (!valRes.data.isAuthenticated) {
            throw new Error("Token tidak valid");
          }
          Toast.fire({ icon: 'success', title: 'Login Berhasil!', text: 'Selamat datang.' });
        }
        const res = await api.get(SSO_API_URL);
        if (res.data.isAuthenticated === true) {
          await api.post('/sync-session', { 
            isAuthenticated: true, 
            user: res.data 
          });
          setAuthState({ 
            isAuthenticated: true, 
            loading: false, 
            user: res.data 
          });
        } else {
          redirectToSSO();
        }
      } catch (err) {
        console.error("Auth failed:", err);
        redirectToSSO();
      }
    };

    const redirectToSSO = () => {
      const currentUrl = window.location.origin;
      window.location.href = `${SSO_LOGIN_URL}/?returnUrl=${encodeURIComponent(currentUrl)}`;
    };

    handleAuth();
  }, []);

  useEffect(() => {
    if (!authState.isAuthenticated) return;
    const syncWithSSO = setInterval(async () => {
      try {
        const res = await api.get(SSO_API_URL);        
        if (res.data && res.data.isAuthenticated === false) {
          Toast.fire({ icon: 'warning', title: 'Sesi Anda telah berakhir.' });
          await api.get('/logout'); 
          const currentUrl = window.location.origin;
          window.location.href = `${SSO_LOGIN_URL}/?returnUrl=${encodeURIComponent(currentUrl)}`;
        }
      } catch (err) {
        console.error("Gagal sinkronisasi sesi:", err);
      }
    }, 60000);
    return () => clearInterval(syncWithSSO);
  }, [authState.isAuthenticated]);

  const handleLogout = async () => {
    try {
      await api.get('/logout');
      Toast.fire({ icon: 'info', title: 'Anda telah keluar.' }); 
    } catch (error) {
      console.error("Gagal logout di server:", error);
    } finally {      
      window.location.href = SSO_LOGOUT_URL;
    }
  };

  if (authState.loading) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary mb-2" role="status"></div>
          <p>Memeriksa Autentikasi...</p>
        </div>
      </div>
    );
  }

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
              <Route path='/card' element={<OsCard />} />
              <Route path='/oscc' element={<OsCC />} />
              <Route path='/grade' element={<OsGrade />} />
              <Route path='/blacklist' element={<Blacklist />} />

              <Route path="*" element={<Dashboard />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
