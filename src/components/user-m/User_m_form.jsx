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

  const handleSubcompanyChange = (e) => {
    const options = e.target.options;
    const selectedValues = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedValues.push(options[i].value);
      }
    }
    setSelectedSubcompanies(selectedValues);
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

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }} 
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header Tipis */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className="bi bi-shield-lock-fill me-2"></i>
                Edit Akses User
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                
                {/* Target User Info Header */}
                <div className="p-2 mb-3 rounded border bg-light d-flex align-items-center justify-content-between">
                  <div>
                    <span className="text-muted d-block" style={{ fontSize: '0.68rem', fontWeight: '600' }}>TARGET USER</span>
                    <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>{initialData?.nama || '-'}</span>
                  </div>
                  <div className="text-end">
                    <span className="badge bg-primary px-2" style={{ fontSize: '0.7rem' }}>{initialData?.email}</span>
                  </div>
                </div>

                {loadingForm ? (
                  <div className="text-center py-4 text-muted" style={{ fontSize: '0.8rem' }}>
                    <span className="spinner-border spinner-border-sm me-2 text-primary"></span>
                    Memuat data master...
                  </div>
                ) : (
                  <div className="row g-2">
                    
                    {/* Role App Dropdown */}
                    <div className="col-md-12">
                      <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
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

                    {/* Multiple Select Subcompany */}
                    <div className="col-md-12 mt-2">
                      <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                        Akses Subcompany (Perusahaan Cabang)
                      </label>
                      <select 
                        multiple
                        className="form-select form-select-sm"
                        style={{ height: '130px', fontSize: '0.75rem' }}
                        value={selectedSubcompanies}
                        onChange={handleSubcompanyChange}
                      >
                        {subcompanies.map(subco => (
                          <option key={subco.sub_company_id} value={subco.sub_company_id}>
                            {subco.sub_company_id} - {subco.sub_company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>
                )}

                {/* Info Box Compact */}
                <div className="mt-3 p-2 rounded border bg-light d-flex align-items-center">
                  <i className="bi bi-info-circle-fill me-2 text-primary" style={{ fontSize: '0.9rem' }}></i>
                  <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
                    Tahan tombol <b>Ctrl</b> (Windows) / <b>Cmd</b> (Mac) untuk memilih beberapa Subcompany. <b>Kosongkan pilihan jika user berhak mengakses SEMUA Subcompany.</b>
                  </span>
                </div>

              </div>

              {/* Footer Compact */}
              <div className="modal-footer bg-light border-top p-2 px-3">
                <button type="button" className="btn btn-sm btn-light border" style={{ fontSize: '0.8rem' }} onClick={onClose}>
                  Batal
                </button>
                <button type="submit" className="btn btn-sm btn-primary px-3 shadow-sm" style={{ fontSize: '0.8rem' }}>
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