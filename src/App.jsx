import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

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

const apiLokal = axios.create({
  baseURL: 'http://127.0.0.1:5000',
  withCredentials: true // WAJIB agar Flask bisa menitipkan cookie di localhost
});

// Buat instance axios untuk SSO (via Proxy Vite)
const apiSSO = axios.create({
  baseURL: '/api-sso', // Menggunakan proxy Vite yang sudah dibuat
  withCredentials: true // WAJIB agar browser mengirim cookie .ceresnl.com
});

function App() {
  const [authState, setAuthState] = useState({ isAuthenticated: false, loading: true, user: null });

  useEffect(() => {
  const validasiToken = async () => {
    try {
      const tokenLocal = localStorage.getItem('token');

      if (!tokenLocal) {
        setAuthState({ isAuthenticated: false, loading: false, user: null });
        return;
      }

      // MEMBERSIHKAN TOKEN
      const tokenClean = tokenLocal.replace(/^"|"$/g, '');

      // Kirim ke backend
      const res = await apiLokal.post('/api/validate-token-storage', { token: tokenClean });

      if (res.data.isAuthenticated) {
        setAuthState({ isAuthenticated: true, loading: false, user: res.data.user });
      } else {
        localStorage.removeItem('token'); // Hapus jika token salah/expired
        setAuthState({ isAuthenticated: false, loading: false, user: null });
      }
    } catch (err) {
      console.error("Payload salah atau token expired", err);
      setAuthState({ isAuthenticated: false, loading: false, user: null });
    }
  };

  validasiToken();
}, []);

  // --- TAMBAHKAN INI AGAR TIDAK LANGSUNG MERENDER DASHBOARD ---
  if (authState.loading) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-dark text-white">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <h5>Memeriksa Sesi Manajemen OS...</h5>
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
            <div className="text-white-50 small">User</div>
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
