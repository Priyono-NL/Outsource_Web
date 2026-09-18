import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { componentRegistry } from './utils/menuConfig';
import { AuthProvider, useAuth } from './utils/useAuth';
import AbsensiVendor from './pages/AbsensiVendor';

const EnvBanner = () => {
  const isDev = import.meta.env.MODE === 'development';
  if (!isDev) return null;
  return (
    <div 
      className="w-100 text-dark text-center py-1 fw-bold border-bottom" 
      style={{ 
        fontSize: '0.75rem', 
        letterSpacing: '0.5px',
        backgroundColor: '#ffe44c',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}
    >
      <span><i className="bi bi-cpu me-1"></i> You are running Development Server (Local Environment)</span>
    </div>
  );
};

const MainLayout = () => {
  const { user, role, loading, logout } = useAuth();  
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen d-flex flex-column justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <p className="fw-bold">Memuat sistem & hak akses...</p>
      </div>
    );
  }

  const publicRoutes = ['/auth/callback'];
  if (publicRoutes.includes(location.pathname)) {
    return (
      <Routes>        
        <Route path="/auth/callback" element={componentRegistry['/auth/callback']} />
      </Routes>
    );
  }

  const handleBackToSSO = () => {
    const ssoPortalUrl = import.meta.env.VITE_SSO_URL;
    window.location.href = ssoPortalUrl;
  };

  return (
    <div id="app-shell">

      {role !== 'vendor_app' && (
        <header id="app-topbar">
          <button
            className="topbar-toggle"
            onClick={() => setSidebarExpanded(v => !v)}
            title="Toggle Sidebar"
          >
            <i className={`bi ${sidebarExpanded ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'}`} />
          </button>

          <span className="topbar-brand">Manajemen OS</span>

          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <div className="topbar-user-name">{user?.nama || user?.email || 'User'}</div>
            <div className="topbar-user-role">{role || 'user'}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn btn-sm btn-outline-secondary d-flex align-items-center shadow-sm" 
              onClick={handleBackToSSO}
              style={{ fontWeight: '500', borderRadius: '6px' }}
            >
              <i className="bi bi-grid-3x3-gap-fill me-1" /> Portal SSO
            </button> 

            <button 
              className="btn-logout shadow-sm" 
              onClick={logout}
              style={{ borderRadius: '6px' }}
            >
              <i className="bi bi-box-arrow-right me-1" /> Keluar
            </button>
          </div>
        </header>
      )}

      <EnvBanner />

      <div id="app-body">        
        {role !== 'vendor_app' && (
          <nav
            id="app-sidebar"
            style={{ width: sidebarExpanded ? 232 : 64 }}
          >
            <Sidebar isExpanded={sidebarExpanded} />
          </nav>
        )}
        <main id="app-content">          
          {role === 'vendor_app' ? (
            <Routes>
              <Route path="/absenVendor" element={<AbsensiVendor />} />
              <Route path="*" element={<Navigate to="/absenVendor" replace />} />
            </Routes>
          ) : (
            <Routes>
              {Object.entries(componentRegistry).map(([path, element]) => {
                if (publicRoutes.includes(path)) return null;
                
                return (
                  <Route
                    key={path}
                    path={path}
                    element={element}
                  />
                );
              })}
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}

        </main>
      </div>

    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </Router>
  );
}

export default App;