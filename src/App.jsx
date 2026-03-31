import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import { routesConfig } from './utils/menuConfig';
import { useAuth } from './utils/useAuth';


function App() {
  const { authState, handleLogout } = useAuth();

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
              {routesConfig.map((route, index) => (
                <Route key={index} path={route.path} element={route.element} />
              ))}
              <Route path="*" element={routesConfig[0].element} />
            </Routes>
          </div>
        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;