import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import SubCompany from './pages/SubCompany';
import Training_m from './pages/Training_m';
import Medical_m from './pages/Medical_m';

function App() {
  const api_url = 'http://127.0.0.1:5000';
  return (
    <BrowserRouter>
      <div className="bg-light min-vh-100"> 
        
        <nav className="navbar navbar-dark bg-dark shadow-sm mb-4">
          <div className="container-fluid px-4">
            <span className="navbar-brand mb-0 h1 fw-bold">Manajemen OS</span>

            <div className="me-auto ms-4 d-flex gap-3">
              <Link to="/" className="text-white text-decoration-none">Dashboard</Link>
              <Link to="/sub-company" className="text-white text-decoration-none">Sub Company</Link>
              <Link to="/training-m" className="text-white text-decoration-none">Training</Link>
              <Link to="/medical-m" className="text-white text-decoration-none">Medical</Link>
            </div>

            <div className="text-white-50 small">User</div>
          </div>
        </nav>
        
        <Routes>
          <Route path="/" element={<Dashboard api={api_url} />} />
          <Route path="/sub-company" element={<SubCompany api={api_url} />} />
          <Route path="/training-m" element={<Training_m api={api_url} />} />
          <Route path="/medical-m" element={<Medical_m api={api_url} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
