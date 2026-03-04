import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Login from './pages/Login';

import SubCompany from './pages/SubCompany';
import Training_m from './pages/Training_m';
import Medical_m from './pages/Medical_m';
import Canteen from './pages/Canteen';
import CostCenter from './pages/CostCenter';

import Dashboard from './pages/Dashboard';
import Alokasi from './pages/Alokasi'
import OsMedical from './pages/OsMedical';
import OsTraining from './pages/OsTraining';

function AppLayout({children}) {
  const location = useLocation()
  if (location.pathname === '/') return <>{children}</>;
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = "https://sso.ceresnl.com";
  };
  return (
    <div className="d-flex flex-column vh-100 bg-light"> 
      {/* --- 1. NAVBAR (ATAS) --- */}
      <nav className="navbar navbar-dark bg-dark shadow-sm z-1">
        <div className="container-fluid px-4">
          <span className="navbar-brand mb-0 h1 fw-bold">Manajemen OS</span>
          <div className="d-flex align-items-center">
            <div className="text-white-50 small me-3">
              User
            </div>            
            <button 
              onClick={handleLogout} 
              className="btn btn-outline-danger btn-sm border-0 d-flex align-items-center"
              title="Klik untuk Logout"
            >
              <i className="bi bi-box-arrow-right me-1"></i> Logout
            </button>
          </div>
        </div>
      </nav>
      {/* --- 2. AREA BAWAH (KIRI SIDEBAR & KANAN MAIN LAYOUT) --- */}
      <div className="d-flex flex-grow-1 overflow-hidden">
        <Sidebar />
        <div className="flex-grow-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

function App() {
  const api_url = 'http://127.0.0.1:5000';
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path='/' element={<Login />} />
          {/* processing data */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/alokasi" element={<Alokasi />} />
          <Route path="/os-medical" element={<OsMedical />} />
          <Route path="/os-training" element={<OsTraining />} />
          <Route path="/costcenter" element={<CostCenter />} />
          {/* master data */}
          <Route path="/sub-company" element={<SubCompany />} />
          <Route path="/training-m" element={<Training_m />} />
          <Route path="/medical-m" element={<Medical_m />} />
          <Route path="/canteen" element={<Canteen />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
