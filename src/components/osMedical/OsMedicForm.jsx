import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function OsMedicForm({ onClose, onSuccess, initialData }) {
  const [medical, setMedical] = useState([]);
  const [empId, setEmpId] = useState('');
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const formRef = useRef(null);
  const isEditMode = !!initialData;
  
  useEffect(() => {
    const fetchOsMedical = async () => {
      try {        
        const response = await api.get('/medical?page=1&pageSize=50'); 
        if (response.data.status === 'success') {
          setMedical(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data medical:", error);
      }
    };
    fetchOsMedical();
  }, []);

  useEffect(() => {
    if (initialData && formRef.current && medical.length > 0) {
      setEmpId(initialData.employee_code || ''); 
      setEmpPk(initialData.employee_id || '');
      formRef.current.employee_code.value = initialData.employee_code;
      formRef.current.medical_id.value = initialData.medical_id;
      formRef.current.medical_date.value = initialData.medical_date;
      formRef.current.medical_result.value = initialData.medical_result;
      formRef.current.medical_notes.value = initialData.medical_notes;
      handleSearchEmployee(initialData.employee_code || initialData.employee_id);
    }
  }, [initialData, medical]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      employee_id: empPk
    };
    delete payload.employee_code;
    try {
      const response = initialData 
            ? await api.put(`/osmedical/${initialData.osMedical_id}`, payload) 
            : await api.post('/osmedical/submit', payload);
      if (response.data.status === 'success') {
        formRef.current.reset();
        Toast.fire({ icon: 'success', title: response.data.message });
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.message || "Terjadi kesalahan server" });
    }    
  };

  const handleSearchEmployee = async (id) => {
    if (!id) {
      setFullName('');
      return;
    }
    setIsSearching(true);
    try {
      const response = await api.get(`/employee/search/${id}`);
      if (response.data.status === "success") { 
        setFullName(response.data.full_name);
        setEmpPk(response.data.emp_pk_id);
        setIsEmployeeFound(true);
      }
    } catch (err) {
      setFullName('Karyawan ID tidak terdaftar!');
      setEmpPk('');
      setIsEmployeeFound(false);
      Toast.fire({ icon: 'warning', title: 'Pencarian Gagal', text: "ID Karyawan tidak ditemukan." });
    } finally { setIsSearching(false); }
  };

  const handleIdChange = (e) => {
    if (isEditMode) return;
    const value = e.target.value;
    setEmpId(value);
    if (value === "") {
      setIsEmployeeFound(false);
      setFullName("");
      setEmpPk("");
    } else {
      setIsEmployeeFound(false);
    }
  };

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-heart-pulse-fill' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Riwayat Medis' : 'Input Medical Check-up'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">Employee ID</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted"><i className="bi bi-person-badge"></i></span>
                      <input 
                        type="text" 
                        name="employee_code" 
                        className={`form-control ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                        placeholder="Ketik ID..."
                        required
                        value={empId}
                        onChange={handleIdChange}
                        onBlur={(e) => !isEditMode && handleSearchEmployee(e.target.value)}
                        readOnly={isEditMode}
                        style={isEditMode ? { cursor: 'not-allowed' } : {}}
                      />
                    </div>
                  </div>
                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-muted">Nama Lengkap</label>
                    <div className="position-relative">
                      <input 
                        type="text" 
                        className={`form-control ${fullName.includes('tidak terdaftar') ? 'is-invalid' : ''}`}
                        value={isSearching ? "Sedang mencari..." : fullName}
                        readOnly
                        placeholder="Nama otomatis..."
                        style={{ backgroundColor: '#f8f9fa', fontWeight: '600' }} 
                      />
                      {isSearching && (
                        <div className="position-absolute end-0 top-50 translate-middle-y me-3">
                          <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="hr-text text-muted small fw-bold mb-4">
                  <span className="bg-white px-2">Hasil Pemeriksaan Medis</span>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Jenis Pemeriksaan</label>
                    <select 
                      name="medical_id" 
                      className="form-select" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required
                    >
                      <option value="">-- Pilih Jenis MCU --</option>
                      {medical.map((m) => (
                        <option key={m.medical_id} value={m.medical_id}>
                          {m.medical_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Tanggal Pemeriksaan</label>
                    <input 
                      type="date" 
                      name="medical_date" 
                      className="form-control" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Hasil (Result)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted"><i className="bi bi-clipboard2-check"></i></span>
                      <input 
                        type="text" 
                        name="medical_result" 
                        className="form-control" 
                        placeholder="Contoh: Fit / Unfit / Fit with Note"
                        disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Catatan (Notes)</label>
                    <input 
                      type="text" 
                      name="medical_notes" 
                      className="form-control" 
                      placeholder="Catatan tambahan dokter..."
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                    />
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button 
                  type="submit" 
                  className="btn-app btn-primary-app px-4" 
                  disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                >
                  <i className="bi bi-save me-2"></i>
                  {isEditMode ? 'Update Data' : 'Simpan Data Medis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default OsMedicForm;