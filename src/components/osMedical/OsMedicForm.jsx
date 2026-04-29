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
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        {/* Ukuran modal-md agar ramping */}
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header Tipis */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-heart-pulse-fill' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Riwayat Medis' : 'Input MCU'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                
                {/* Search Section */}
                <div className="row g-2 mb-3">
                  <div className="col-md-5">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Employee ID</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0"><i className="bi bi-person-badge" style={{ fontSize: '0.8rem' }}></i></span>
                      <input 
                        type="text" 
                        name="employee_code" 
                        className={`form-control border-start-0 ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                        placeholder="ID..."
                        required
                        value={empId}
                        onChange={handleIdChange}
                        onBlur={(e) => !isEditMode && handleSearchEmployee(e.target.value)}
                        readOnly={isEditMode}
                        style={isEditMode ? { cursor: 'not-allowed' } : {}}
                      />
                    </div>
                  </div>
                  <div className="col-md-7">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Karyawan</label>
                    <div className="position-relative">
                      <input 
                        type="text" 
                        className={`form-control form-control-sm ${fullName.includes('tidak terdaftar') ? 'is-invalid' : ''}`}
                        value={isSearching ? "Mencari..." : fullName}
                        readOnly
                        placeholder="Otomatis..."
                        style={{ backgroundColor: '#f8f9fa', fontWeight: '600', fontSize: '0.85rem' }} 
                      />
                      {isSearching && (
                        <div className="position-absolute end-0 top-50 translate-middle-y me-2">
                          <div className="spinner-border spinner-border-sm text-primary" style={{ width: '0.8rem', height: '0.8rem' }} role="status"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Divider Minimalis */}
                <div className="d-flex align-items-center mb-3">
                   <hr className="flex-grow-1 my-0 opacity-25" />
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Data Pemeriksaan</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Jenis MCU</label>
                    <select 
                      name="medical_id" 
                      className="form-select form-select-sm" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required
                    >
                      <option value="">-- Pilih --</option>
                      {medical.map((m) => (
                        <option key={m.medical_id} value={m.medical_id}>
                          {m.medical_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tanggal</label>
                    <input 
                      type="date" 
                      name="medical_date" 
                      className="form-control form-control-sm" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Hasil (Result)</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0"><i className="bi bi-clipboard2-check" style={{ fontSize: '0.8rem' }}></i></span>
                      <input 
                        type="text" 
                        name="medical_result" 
                        className="form-control border-start-0" 
                        placeholder="Contoh: Fit"
                        disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Catatan</label>
                    <input 
                      type="text" 
                      name="medical_notes" 
                      className="form-control form-control-sm" 
                      placeholder="Notes dokter..."
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                    />
                  </div>
                </div>
              </div>

              {/* Footer Compact */}
              <div className="modal-footer bg-light border-top p-2 px-3">
                <button type="button" className="btn btn-sm btn-light border" style={{ fontSize: '0.8rem' }} onClick={onClose}>Batal</button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary px-3 shadow-sm" 
                  style={{ fontSize: '0.8rem' }}
                  disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                >
                  <i className="bi bi-save me-1"></i>
                  {isEditMode ? 'Update' : 'Simpan'}
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