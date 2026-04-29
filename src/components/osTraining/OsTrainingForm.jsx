import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function OsTrainingForm({ onClose, onSuccess, initialData }) {
  const [training, setTraining] = useState([]);
  const [empId, setEmpId] = useState('');
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const formRef = useRef(null);
  const isEditMode = !!initialData;
  
  useEffect(() => {
    const fetchTraining = async () => {
      try {        
        const response = await api.get('/training?page=1&pageSize=50'); 
        if (response.data.status === 'success') {
          setTraining(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      }
    };
    fetchTraining();
  }, []);

  useEffect(() => {
    if (initialData && formRef.current && training.length > 0) {
      setEmpId(initialData.employee_code || ''); 
      setEmpPk(initialData.employee_id || '');
      formRef.current.employee_code.value = initialData.employee_code;
      formRef.current.training_id.value = initialData.training_id;
      formRef.current.training_date_from.value = initialData.training_date_from;
      formRef.current.training_date_to.value = initialData.training_date_to;
      formRef.current.training_result.value = initialData.training_result;
      formRef.current.training_score.value = initialData.training_score;
      handleSearchEmployee(initialData.employee_code || initialData.employee_id);
    }
  }, [initialData, training]);

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
            ? await api.put(`/ostraining/${initialData.osTraining_id}`, payload) 
            : await api.post('/ostraining/submit', payload);
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
      Toast.fire({ icon: 'warning', title: 'ID Karyawan tidak ditemukan' });
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
        {/* Menggunakan modal-md agar lebih ramping */}
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header Tipis */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-journal-check' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Training OS' : 'Tambah Training OS'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                
                {/* Employee Search Section */}
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
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Detail Training</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                <div className="row g-2">
                  <div className="col-12 mb-1">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Jenis Training</label>
                    <select 
                      name="training_id" 
                      className="form-select form-select-sm" 
                      required 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                    >
                      <option value="">-- Pilih Pelatihan --</option>
                      {training.map((t) => (
                        <option key={t.training_id} value={t.training_id}>
                          {t.training_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Mulai</label>
                    <input 
                      type="date" 
                      name="training_date_from" 
                      className="form-control form-control-sm" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Selesai</label>
                    <input 
                      type="date" 
                      name="training_date_to" 
                      className="form-control form-control-sm" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Hasil (Result)</label>
                    <select 
                      name="training_result" 
                      className='form-select form-select-sm' 
                      defaultValue={initialData ? initialData.training_result : ""}
                      required 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                    >
                      <option value="">-- Pilih --</option>
                      <option value="0">Tidak Lulus</option>
                      <option value="1">Lulus</option>
                    </select>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nilai (Score)</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light text-muted border-end-0"><i className="bi bi-star" style={{ fontSize: '0.8rem' }}></i></span>
                      <input 
                        type="number" 
                        name="training_score" 
                        className="form-control form-control-sm border-start-0" 
                        placeholder="0 - 100"
                        disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      />
                    </div>
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
                  {initialData ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default OsTrainingForm;