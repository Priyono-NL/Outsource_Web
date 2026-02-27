import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SubCompany from './pages/SubCompany';
import Training_m from './pages/Training_m';
import Medical_m from './pages/Medical_m';
import Canteen from './pages/Canteen';
import Alokasi from './pages/Alokasi'
import OsMedical from './pages/OsMedical';

function App() {
  const api_url = 'http://127.0.0.1:5000';
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/sub-company" element={<SubCompany />} />
              <Route path="/training-m" element={<Training_m />} />
              <Route path="/medical-m" element={<Medical_m />} />
              <Route path="/canteen" element={<Canteen />} />
              <Route path="/alokasi" element={<Alokasi />} />
              <Route path="/os-medical" element={<OsMedical />} />
                            
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </div>

        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;
