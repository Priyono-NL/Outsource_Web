import React, { useState, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { componentRegistry } from './utils/menuConfig';
import { AuthProvider, useAuth } from './utils/useAuth';
const AbsensiVendor = React.lazy(() => import('./pages/AbsensiVendor'));
const PendingAccess = React.lazy(() => import('./pages/PendingAccess'));

const RouteLoader = () => (
  <div className="d-flex justify-content-center align-items-center py-5 w-100" style={{ minHeight: '300px' }}>
    <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}></div>
  </div>
);

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

const ImpersonateBanner = () => {
  const [isAdminBackedUp, setIsAdminBackedUp] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const adminBackup = localStorage.getItem('sso_admin_backup');
    if (adminBackup) {
      setIsAdminBackedUp(true);
      const activeSession = JSON.parse(localStorage.getItem('sso_user_cache'));
      setCurrentUser(activeSession?.user?.email || activeSession?.user?.nama || 'User');
    }
  }, []);

  const handleDeImpersonate = () => {
    const adminBackup = localStorage.getItem('sso_admin_backup');
    if (adminBackup) {
      localStorage.setItem('sso_user_cache', adminBackup);
      
      const parsedBackup = JSON.parse(adminBackup);
      const roleApp = parsedBackup?.user?.role_app || parsedBackup?.user?.role || 'superadmin';
      localStorage.setItem('sso_role_cache', roleApp);      
      localStorage.removeItem('sso_admin_backup');
      
      window.location.href = '/'; 
    }
  };

  if (!isAdminBackedUp) return null;

  return (
    <div style={{
      backgroundColor: '#dc3545',
      color: 'white',
      padding: '6px 16px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '0.85rem',
      fontWeight: 'bold',
      zIndex: 9999,
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}>
      <i className="bi bi-incognito me-2 fs-5"></i>
      MODE IMPERSONATE: Anda sedang mengontrol akun [ {currentUser} ]
      <button 
        onClick={handleDeImpersonate}
        className="btn btn-sm btn-light ms-4 fw-bold shadow-sm"
        style={{ borderRadius: '20px', padding: '2px 14px', fontSize: '0.75rem' }}
      >
        <i className="bi bi-arrow-return-left me-1"></i> Kembali ke Akun Admin
      </button>
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

  const isSuperAdmin = role === 'superadmin' || user?.role_app === 'superadmin';
  const isVendorApp  = role === 'vendor_app';
  const hasNoMenus   = !user?.menus || user.menus.length === 0;

  const isPendingAccess = 
    !isSuperAdmin && 
    !isVendorApp && 
    (!role || role === 'Belum di-mapping' || role === 'pending' || hasNoMenus);

  return (
    <div id="app-shell">

      {/* RENDER BANNER IMPERSONATE DI PALING ATAS */}
      <ImpersonateBanner />

      {role !== 'vendor_app' && (
        <header id="app-topbar">
          {!isPendingAccess && (
            <button
              className="topbar-toggle"
              onClick={() => setSidebarExpanded(v => !v)}
              title="Toggle Sidebar"
            >
              <i className={`bi ${sidebarExpanded ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'}`} />
            </button>
          )}

          <span className="topbar-brand">Manajemen OS</span>

          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <div className="topbar-user-name">{user?.nama || user?.email || 'User'}</div>
            <div className="topbar-user-role">
              {isPendingAccess ? 'Belum di-mapping' : (role || 'user')}
            </div>
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
        {role !== 'vendor_app' && !isPendingAccess && (
          <nav
            id="app-sidebar"
            style={{ width: sidebarExpanded ? 232 : 64 }}
          >
            <Sidebar isExpanded={sidebarExpanded} />
          </nav>
        )}

        <main id="app-content" style={{ width: isPendingAccess ? '100%' : 'auto' }}>          
          <Suspense fallback={<RouteLoader />}>
            {role === 'vendor_app' ? (
              <Routes>
                <Route path="/absenVendor" element={<AbsensiVendor />} />
                <Route path="*" element={<Navigate to="/absenVendor" replace />} />
              </Routes>
            ) : isPendingAccess ? (
              /* DILOCK KE HALAMAN PENDING JIKA MENUS KOSONG */
              <Routes>
                <Route path="/pending" element={<PendingAccess />} />
                <Route path="*" element={<Navigate to="/pending" replace />} />
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
          </Suspense>
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