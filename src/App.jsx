import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/useAuth';
import { componentRegistry } from './utils/menuConfig'; // Sesuai nama file kamu

const MainLayout = () => {
  const { isConfigured, loading } = useAuth();
  const location = useLocation();

  // 1. Daftarkan rute publik yang bebas diakses tanpa perlu status isConfigured = true
  const publicRoutes = ['/auth/callback', '/pending-approval'];

  // 2. Cegah Infinite Loop:
  // Jika user belum dikonfigurasi DAN saat ini BUKAN berada di rute publik, baru lempar!
  if (!isConfigured && !publicRoutes.includes(location.pathname)) {
    return <Navigate to="/pending-approval" replace />;
  }

  // Jika masih loading autentikasi, tampilkan background kosong/spinner
  // (opsional, karena di useAuth sudah ada spinner)
  if (loading) return null; 

  return (
    <div className="d-flex">
      {/* Jika kamu punya Sidebar/Navbar komponen, render di sini kondisional */}
      {/* {isConfigured && <Sidebar />} */}
      
      <div className="content-wrapper w-100">
        <Routes>
          {/* Looping semua komponen dari menuConfig.jsx */}
          {Object.entries(componentRegistry).map(([path, element]) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Routes>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <MainLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;