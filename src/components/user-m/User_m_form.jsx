import React, { useState, useEffect, useRef } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function User_m_form({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const [roles, setRoles] = useState([]);
  const [subcompanies, setSubcompanies] = useState([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState(initialData?.local_role_id || '');
  const [selectedSubcompanies, setSelectedSubcompanies] = useState(initialData?.subcompany_access || []);
  const [searchSubco, setSearchSubco] = useState('');

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setLoadingForm(true);
        const res = await api.get('/api/users/management');
        if (res.data.success) {
          setRoles(res.data.data.roles || []);
          setSubcompanies(res.data.data.subcompanies || []);
        }
      } catch (error) {
        Toast.fire({ icon: 'error', title: 'Gagal memuat master data' });
      } finally {
        setLoadingForm(false);
      }
    };
    fetchMasterData();
  }, []);

  // Toggle checklist subcompany
  const handleToggleSubcompany = (subcoId) => {
    if (selectedSubcompanies.includes(subcoId)) {
      setSelectedSubcompanies(selectedSubcompanies.filter(id => id !== subcoId));
    } else {
      setSelectedSubcompanies([...selectedSubcompanies, subcoId]);
    }
  };

  // Pilih Semua Subcompany
  const handleSelectAll = () => {
    const allIds = subcompanies.map(s => s.sub_company_id);
    setSelectedSubcompanies(allIds);
  };

  // Kosongkan Pilihan (Akses Penuh ke Semua Subcompany)
  const handleClearAll = () => {
    setSelectedSubcompanies([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedRole) {
      Toast.fire({ icon: 'warning', title: 'Role aplikasi wajib dipilih!' });
      return;
    }

    try {
      const payload = {
        user_id: initialData.id,
        role_id: selectedRole,
        subcompanies: selectedSubcompanies
      };

      const response = await api.post('/api/users/update-access', payload);
      if (response.data.success || response.data.status === 'success') {
        Toast.fire({ icon: 'success', title: response.data.message || 'Akses user berhasil diperbarui' });
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      Toast.fire({ 
        icon: 'error', 
        title: error.response?.data?.message || 'Terjadi kesalahan server' 
      });
    }
  };

  // Filter pencarian subcompany
  const filteredSubcompanies = subcompanies.filter(s => 
    s.sub_company_name.toLowerCase().includes(searchSubco.toLowerCase()) ||
    s.sub_company_id.toLowerCase().includes(searchSubco.toLowerCase())
  );

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }} 
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0 text-primary">
                <i className="bi bi-shield-lock-fill me-2"></i>
                Kelola Hak Akses User
              </h6>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-light">
                
                {/* User Information Card */}
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body p-2 px-3 d-flex align-items-center justify-content-between">
                    <div>
                      <small className="text-muted d-block fw-semibold" style={{ fontSize: '0.7rem' }}>TARGET USER</small>
                      <span className="fw-bold text-dark">{initialData?.nama || '-'}</span>
                    </div>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                      <i className="bi bi-envelope me-1"></i>
                      {initialData?.email}
                    </span>
                  </div>
                </div>

                {loadingForm ? (
                  <div className="text-center py-5 bg-white rounded border">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Memuat data master...</span>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    
                    {/* Role App Dropdown */}
                    <div className="bg-white p-3 rounded border shadow-sm">
                      <label className="form-label fw-semibold mb-1" style={{ fontSize: '0.8rem' }}>
                        Role Aplikasi <span className="text-danger">*</span>
                      </label>
                      <select 
                        className="form-select form-select-sm"
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

                    {/* Interactive Subcompany Access Section */}
                    <div className="bg-white p-3 rounded border shadow-sm">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <label className="form-label fw-semibold mb-0" style={{ fontSize: '0.82rem' }}>
                          Akses Subcompany (Cabang)
                        </label>
                        
                        {/* Status Summary */}
                        {selectedSubcompanies.length === 0 ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: '0.72rem' }}>
                            <i className="bi bi-globe me-1"></i> Akses Semua Subcompany
                          </span>
                        ) : (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1" style={{ fontSize: '0.72rem' }}>
                            <i className="bi bi-building-lock me-1"></i> Terbatas ({selectedSubcompanies.length} Dipilih)
                          </span>
                        )}
                      </div>

                      {/* Filter Search Box */}
                      <div className="input-group input-group-sm mb-2">
                        <span className="input-group-text bg-light border-end-0 text-muted px-2.5">
                          <i className="bi bi-search" style={{ fontSize: '0.75rem' }}></i>
                        </span>
                        <input 
                          type="text" 
                          className="form-control border-start-0 bg-light shadow-none"
                          style={{ fontSize: '0.78rem' }}
                          placeholder="Cari Subcompany..."
                          value={searchSubco}
                          onChange={(e) => setSearchSubco(e.target.value)}
                        />
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="d-flex justify-content-start gap-1 mb-2.5">
                        <button 
                          type="button" 
                          className="btn btn-sm btn-light border py-1 px-2 text-secondary fw-medium"
                          style={{ fontSize: '0.72rem', borderRadius: '5px' }}
                          onClick={handleSelectAll}
                        >
                          <i className="bi bi-check2-all me-1"></i>Pilih Semua
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-light border py-1 px-2 text-secondary fw-medium"
                          style={{ fontSize: '0.72rem', borderRadius: '5px' }}
                          onClick={handleClearAll}
                        >
                          <i className="bi bi-arrow-counterclockwise me-1"></i>Reset (Akses Semua)
                        </button>
                      </div>

                      {/* Custom List Container - Dibuat Lebih Lega */}
                      <div 
                        className="border rounded p-2 bg-light overflow-auto d-flex flex-column gap-2" 
                        style={{ maxHeight: '200px' }}
                      >
                        {filteredSubcompanies.length === 0 ? (
                          <div className="text-center text-muted py-3" style={{ fontSize: '0.78rem' }}>
                            Subcompany tidak ditemukan
                          </div>
                        ) : (
                          filteredSubcompanies.map(subco => {
                            const isChecked = selectedSubcompanies.includes(subco.sub_company_id);
                            return (
                              <div 
                                key={subco.sub_company_id}
                                className={`d-flex align-items-center p-2 px-3 rounded border bg-white user-select-none ${
                                  isChecked ? 'border-primary shadow-sm bg-primary-subtle bg-opacity-10' : 'border-gray-200'
                                }`}
                                style={{ cursor: 'pointer', transition: 'all 0.15s ease-in-out' }}
                                onClick={() => handleToggleSubcompany(subco.sub_company_id)}
                              >
                                {/* Custom Checkbox Tanpa Kelas .form-check Agar Tidak Terpotong */}
                                <input 
                                  className="form-check-input me-3 mt-0 flex-shrink-0" 
                                  type="checkbox" 
                                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                  id={`subco-${subco.sub_company_id}`}
                                  checked={isChecked}
                                  onChange={() => {}}
                                />
                                <label 
                                  className="form-check-label mb-0 text-truncate text-dark" 
                                  htmlFor={`subco-${subco.sub_company_id}`}
                                  style={{ fontSize: '0.8rem', cursor: 'pointer', fontWeight: isChecked ? '600' : 'normal' }}
                                >
                                    {subco.sub_company_name}
                                </label>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Explanatory Helper Note */}
                      <div className="d-flex align-items-start gap-1.5 mt-2.5 text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.35' }}>
                        <i className="bi bi-info-circle-fill text-primary flex-shrink-0 mt-0.5" style={{ fontSize: '0.75rem' }}></i>
                        <span>
                          Jika <b>tidak ada</b> subcompany yang dicentang, user secara otomatis berhak mengakses <b>SEMUA</b> data subcompany (Akses Global).
                        </span>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="modal-footer bg-white border-top p-2 px-3">
                <button 
                  type="button" 
                  className="btn btn-sm btn-light border" 
                  style={{ fontSize: '0.8rem' }} 
                  onClick={onClose}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary px-3 shadow-sm" 
                  style={{ fontSize: '0.8rem' }}
                  disabled={loadingForm}
                >
                  <i className="bi bi-check-lg me-1"></i> Simpan Akses
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </>
  );
}

export default User_m_form;