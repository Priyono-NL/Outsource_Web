import React, { useState, useEffect } from 'react';
import api from '../api/api';

const UserApproval = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [subcompanies, setSubcompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  // State untuk form persetujuan (Modal / Inline)
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSubcompanies, setSelectedSubcompanies] = useState([]);

  useEffect(() => {
    fetchPendingData();
  }, []);

  const fetchPendingData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/pending'); // Sesuaikan rute endpoint
      if (res.data.success) {
        setPendingUsers(res.data.data.users || []);
        setRoles(res.data.data.roles || []);
        setSubcompanies(res.data.data.subcompanies || []);
      }
    } catch (error) {
      alert("Gagal memuat data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler Pilih User untuk diapprove
  const handleOpenForm = (user) => {
    setSelectedUser(user);
    setSelectedRole('');
    setSelectedSubcompanies([]);
  };

  const handleToggleSubcompany = (subcoId) => {
    setSelectedSubcompanies(prev => 
      prev.includes(subcoId) ? prev.filter(id => id !== subcoId) : [...prev, subcoId]
    );
  };

  const handleSubmitApproval = async (e) => {
    e.preventDefault();
    if (!selectedRole) {
      alert("Role wajib dipilih!");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/users/approve', {
        user_id: selectedUser.id,
        role_id: selectedRole,
        subcompanies: selectedSubcompanies
      });

      if (res.data.success) {
        alert("Akses berhasil diberikan!");
        setSelectedUser(null);
        // Refresh data agar user yang sudah diapprove hilang dari tabel
        fetchPendingData();
      }
    } catch (error) {
      alert("Gagal memberikan akses: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <h4 className="fw-bold mb-4">Persetujuan User Baru (SSO)</h4>

      <div className="row">
        {/* TABEL PENDING USERS */}
        <div className={selectedUser ? 'col-lg-7' : 'col-lg-12'}>
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body p-4">
              <h6 className="fw-bold text-uppercase text-muted small mb-3">Menunggu Persetujuan ({pendingUsers.length})</h6>
              
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="border-bottom border-2 text-muted small text-uppercase">
                    <tr>
                      <th>Username</th>
                      <th>Nama</th>
                      <th>Departement</th>
                      <th className="text-end">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.length > 0 ? (
                      pendingUsers.map(user => (
                        <tr key={user.id}>
                          <td className="fw-medium text-dark">{user.email}</td>
                          <td>{user.nama || '-'}</td>
                          <td>{user.department}</td>
                          <td className="text-end">
                            <button 
                              className="btn btn-primary btn-sm rounded-2 px-3"
                              onClick={() => handleOpenForm(user)}
                            >
                              Beri Akses <i className="bi bi-arrow-right ms-1"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          Tidak ada user yang menunggu persetujuan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* FORM PEMBERIAN AKSES (Tampil di sebelah kanan jika user dipilih) */}
        {selectedUser && (
          <div className="col-lg-5 mt-4 mt-lg-0">
            <div className="card border-0 shadow-sm rounded-3 bg-light">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                  <h6 className="fw-bold text-uppercase text-muted small mb-0">Form Pemberian Akses</h6>
                  <button type="button" className="btn-close" onClick={() => setSelectedUser(null)}></button>
                </div>

                <div className="mb-3">
                  <label className="text-muted small">Target User:</label>
                  <div className="fw-bold text-dark fs-5">{selectedUser.name}</div>
                  <div className="small text-secondary">{selectedUser.email}</div>
                </div>

                <form onSubmit={handleSubmitApproval}>
                  {/* PILIH ROLE */}
                  <div className="mb-4">
                    <label className="form-label fw-bold small">Pilih Role Aplikasi <span className="text-danger">*</span></label>
                    <select 
                      className="form-select shadow-none border-secondary"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      required
                    >
                      <option value="">-- Pilih Role --</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.role_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* PILIH SUBCOMPANY */}
                  <div className="mb-4">
                    <label className="form-label fw-bold small d-block">Akses Subcompany (Opsional)</label>
                    <span className="text-muted small d-block mb-2">Kosongkan jika user diizinkan mengakses semua subcompany.</span>
                    
                    <div className="bg-white border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {subcompanies.map(subco => (
                        <div className="form-check mb-2" key={subco.sub_company_id}>
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            id={`subco-${subco.sub_company_id}`}
                            checked={selectedSubcompanies.includes(subco.sub_company_id)}
                            onChange={() => handleToggleSubcompany(subco.sub_company_id)}
                          />
                          <label className="form-check-label small text-dark" htmlFor={`subco-${subco.sub_company_id}`}>
                            {subco.sub_company_name} <span className="text-muted">({subco.sub_company_id})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BUTTONS */}
                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-success fw-bold py-2" disabled={loading}>
                      {loading ? 'Menyimpan...' : 'Simpan & Aktifkan User'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary py-2" onClick={() => setSelectedUser(null)}>
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserApproval;