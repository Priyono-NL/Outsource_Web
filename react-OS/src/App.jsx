import Dashboard from './pages/Dashboard';

function App() {
  const api_url = 'http://127.0.0.1:5000/';
  return (
    <div className="bg-light min-vh-100">      

      <nav className="navbar navbar-dark bg-dark shadow-sm mb-4">
        <div className="container-fluid px-4">
          <span className="navbar-brand mb-0 h1 fw-bold">Manajemen OS</span>
          <div className="text-white-50 small">User</div>
        </div>
      </nav>
      <Dashboard api={api_url} />
    </div>
  );
}

export default App;