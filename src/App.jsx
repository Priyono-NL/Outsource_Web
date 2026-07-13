import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './components/Sidebar';
import { routesConfig, adminRoutes } from './utils/menuConfig';
import { useAuth } from './utils/useAuth';
// import { usePermission } from './utils/usePermission';

const flatRoutes = routesConfig.flatMap(route => 
  route.children ? route.children : [route]
);

const EnvBanner = () => {
  const isDev = import.meta.env.MODE === 'development';

  // Jika di server Production (bukan development), kembalikan null agar tidak merender apa pun (Clean Look)
  if (!isDev) return null;

  return (
    <div 
      className="w-100 text-dark text-center py-1 fw-bold border-bottom" 
      style={{ 
        fontSize: '0.75rem', 
        letterSpacing: '0.5px',
        backgroundColor: '#ffe44c', // Warna kuning cerah sesuai kecocokan layout
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}
    >
      <span><i className="bi bi-cpu me-1"></i> You are running Development Server (Local Environment)</span>
    </div>
  );
};

function App() {
  const { authState, handleLogout } = useAuth();  
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const role = authState.user?.role || 'user';
  const isAdmin = ['admin', 'superadmin'].includes(role);

  // const { loadingPerm, canAccess } = usePermission();
  // if (authState.loading || (authState.isAuthenticated && loadingPerm)) {
  //   return (
  //     <div className="loading-screen">
  //       <div className="loading-dot" />
  //       <p>Memuat sistem &amp; hak akses...</p>
  //     </div>
  //   );
  // }

  if (!authState.isAuthenticated) {
    return (
      <div className="loading-screen">
        <div className="loading-dot" />
        <p>Mengarahkan ke halaman login...</p>
      </div>
    );
  }
  
  return (
    <BrowserRouter>
      <div id="app-shell">

        {/* ── Topbar ── */}
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
            <div className="topbar-user-name">
              {authState.user?.full_name || authState.user?.username || 'User'}
            </div>
            <div className="topbar-user-role">{role}</div>
          </div>

          <button className="btn-logout" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right" style={{ marginRight: 5 }} />
            Keluar
          </button>
        </header>

        <EnvBanner />

        {/* ── Body ── */}
        <div id="app-body">
          <nav
            id="app-sidebar"
            style={{ width: sidebarExpanded ? 232 : 64 }}
          >
            <Sidebar isExpanded={sidebarExpanded} />
          </nav>

          <main id="app-content">
            <Routes>
              {flatRoutes.map((route, i) => {
                if (!route.path || !route.element) return null;
                
                return (
                  <Route
                    key={`main-${i}`}
                    path={route.path}
                    element={route.element}
                    // element={canAccess(route.path) ? route.element : <Navigate to="/" replace />}
                  />
                );
              })}

              {/* UNTUK ADMIN ROUTES: Lakukan hal yang sama jika suatu saat adminRoutes juga pakai folder */}
              {adminRoutes.flatMap(route => route.children ? route.children : [route]).map((route, i) => {
                if (!route.path || !route.element) return null;

                return (
                  <Route
                    key={`admin-${i}`}
                    path={route.path}
                    element={route.element}
                    // element={isAdmin ? route.element : <Navigate to="/" replace />}
                  />
                );
              })}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;