import React, { useState, useEffect, useRef } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function User_m_form({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const [roles, setRoles] = useState([]);
  const [subcompanies, setSubcompanies] = useState([]);
  const [costCenters, setCostCenters] = useState([]); // Master Cost Center
  const [loadingForm, setLoadingForm] = useState(false);
  
  const [selectedRole, setSelectedRole] = useState(initialData?.local_role_id || '');
  const [selectedSubcompanies, setSelectedSubcompanies] = useState(initialData?.subcompany_access || []);
  const [selectedCostCenters, setSelectedCostCenters] = useState(initialData?.costcenter_access || []); // Selected CC

  const [searchSubco, setSearchSubco] = useState('');
  const [searchCc, setSearchCc] = useState('');

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setLoadingForm(true);
        const res = await api.get('/api/users/management');
        if (res.data.success) {
          setRoles(res.data.data.roles || []);
          setSubcompanies(res.data.data.subcompanies || []);
          setCostCenters(res.data.data.cost_centers || []); // Master CC dari backend
        }
      } catch (error) {
        Toast.fire({ icon: 'error', title: 'Gagal memuat master data' });
      } finally {
        setLoadingForm(false);
      }
    };
    fetchMasterData();
  }, []);

  // --- HANDLER SUBCOMPANY ---
  const handleToggleSubcompany = (subcoId) => {
    if (selectedSubcompanies.includes(subcoId)) {
      setSelectedSubcompanies(selectedSubcompanies.filter(id => id !== subcoId));
    } else {
      setSelectedSubcompanies([...selectedSubcompanies, subcoId]);
    }
  };

  // --- HANDLER COST CENTER ---
  const handleToggleCostCenter = (ccId) => {
    if (selectedCostCenters.includes(ccId)) {
      setSelectedCostCenters(selectedCostCenters.filter(id => id !== ccId));
    } else {
      setSelectedCostCenters([...selectedCostCenters, ccId]);
    }
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
        subcompanies: selectedSubcompanies,
        cost_centers: selectedCostCenters // Payload baru
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

  const filteredSubcompanies = subcompanies.filter(s => 
    s.sub_company_name.toLowerCase().includes(searchSubco.toLowerCase()) ||
    s.sub_company_id.toLowerCase().includes(searchSubco.toLowerCase())
  );

  const filteredCostCenters = costCenters.filter(c => {
    const orgName = String(c.org_name || '').toLowerCase();
    const costCenterCode = String(c.cost_center || '').toLowerCase();
    const search = searchCc.toLowerCase();
    return orgName.includes(search) || costCenterCode.includes(search);
  });

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0 text-primary">
                <i className="bi bi-shield-lock-fill me-2"></i>Kelola Hak Akses User
              </h6>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-light" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
                
                {/* User Info Header */}
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body p-2 px-3 d-flex align-items-center justify-content-between">
                    <div>
                      <small className="text-muted d-block fw-semibold" style={{ fontSize: '0.7rem' }}>TARGET USER</small>
                      <span className="fw-bold text-dark">{initialData?.nama || '-'}</span>
                    </div>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                      <i className="bi bi-envelope me-1"></i>{initialData?.email}
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
                    
                    {/* Role Dropdown */}
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

                    <div className="row g-3">
                      {/* Subcompany Access Section */}
                      <div className="col-md-6">
                        <div className="bg-white p-3 rounded border shadow-sm h-100">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <label className="form-label fw-semibold mb-0" style={{ fontSize: '0.8rem' }}>Akses Subcompany</label>
                            <span className={`badge ${selectedSubcompanies.length === 0 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'}`} style={{ fontSize: '0.68rem' }}>
                              {selectedSubcompanies.length === 0 ? 'Akses Semua' : `${selectedSubcompanies.length} Dipilih`}
                            </span>
                          </div>

                          <input 
                            type="text" 
                            className="form-control form-control-sm bg-light mb-2"
                            placeholder="Cari Subcompany..."
                            value={searchSubco}
                            onChange={(e) => setSearchSubco(e.target.value)}
                          />

                          <div className="btn-group btn-group-sm mb-2 w-100">
                            <button type="button" className="btn btn-outline-secondary py-0" style={{ fontSize: '0.7rem' }} onClick={() => setSelectedSubcompanies(subcompanies.map(s => s.sub_company_id))}>Semua</button>
                            <button type="button" className="btn btn-outline-secondary py-0" style={{ fontSize: '0.7rem' }} onClick={() => setSelectedSubcompanies([])}>Reset</button>
                          </div>

                          <div className="border rounded p-2 bg-light overflow-auto d-flex flex-column gap-1.5" style={{ maxHeight: '160px' }}>
                            {filteredSubcompanies.map(subco => (
                              <div 
                                key={subco.sub_company_id}
                                className={`d-flex align-items-center p-2 rounded border bg-white ${selectedSubcompanies.includes(subco.sub_company_id) ? 'border-primary bg-primary-subtle bg-opacity-10' : ''}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleToggleSubcompany(subco.sub_company_id)}
                              >
                                <input 
                                  className="form-check-input me-3 mt-0 flex-shrink-0" 
                                  type="checkbox"
                                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                  checked={selectedSubcompanies.includes(subco.sub_company_id)}
                                  onChange={() => {}}
                                />
                                <span style={{ fontSize: '0.78rem' }}>
                                  {subco.sub_company_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Cost Center / Department Access Section */}
                      <div className="col-md-6">
                        <div className="bg-white p-3 rounded border shadow-sm h-100">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <label className="form-label fw-semibold mb-0" style={{ fontSize: '0.8rem' }}>Akses Cost Center / Dept</label>
                            <span className={`badge ${selectedCostCenters.length === 0 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'}`} style={{ fontSize: '0.68rem' }}>
                              {selectedCostCenters.length === 0 ? 'Akses Semua' : `${selectedCostCenters.length} Dipilih`}
                            </span>
                          </div>

                          <input 
                            type="text" 
                            className="form-control form-control-sm bg-light mb-2"
                            placeholder="Cari Cost Center..."
                            value={searchCc}
                            onChange={(e) => setSearchCc(e.target.value)}
                          />

                          <div className="btn-group btn-group-sm mb-2 w-100">
                            <button type="button" className="btn btn-outline-secondary py-0" style={{ fontSize: '0.7rem' }} onClick={() => setSelectedCostCenters(costCenters.map(c => c.id))}>Semua</button>
                            <button type="button" className="btn btn-outline-secondary py-0" style={{ fontSize: '0.7rem' }} onClick={() => setSelectedCostCenters([])}>Reset</button>
                          </div>

                          <div className="border rounded p-2 bg-light overflow-auto d-flex flex-column gap-1.5" style={{ maxHeight: '160px' }}>
                            {filteredCostCenters.map(cc => (
                              <div 
                                key={cc.id}
                                className={`d-flex align-items-center p-2 rounded border bg-white ${selectedCostCenters.includes(cc.id) ? 'border-primary bg-primary-subtle bg-opacity-10' : ''}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleToggleCostCenter(cc.id)}
                              >
                                <input 
                                  className="form-check-input me-3 mt-0 flex-shrink-0" 
                                  type="checkbox"
                                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                  checked={selectedCostCenters.includes(cc.id)}
                                  onChange={() => {}}
                                />
                                <span style={{ fontSize: '0.78rem' }}>
                                  {cc.org_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="modal-footer bg-white border-top p-2 px-3">
                <button type="button" className="btn btn-sm btn-light border" onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-sm btn-primary px-3 shadow-sm" disabled={loadingForm}>
                  <i className="bi bi-check-lg me-1"></i>Simpan Akses
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