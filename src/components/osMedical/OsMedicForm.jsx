import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function OsMedicForm({ onClose, onSuccess, initialData }) {
  const [medical, setMedical] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
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
      setEmpPk(initialData.employee_id || '');
      setSearchTerm(initialData.employee_code ? `${initialData.employee_name} (${initialData.employee_code})` : initialData.employee_name || '');
      setSelectedEmployee({
        emp_pk_id: initialData.employee_id,
        employee_code: initialData.employee_code,
        name: initialData.employee_name
      });
      setFullName(initialData.employee_name || '');
      setIsEmployeeFound(true);

      formRef.current.medical_id.value = initialData.medical_id;
      formRef.current.medical_date.value = initialData.medical_date;
      formRef.current.medical_result.value = initialData.medical_result;
      formRef.current.medical_notes.value = initialData.medical_notes;
    }
  }, [initialData, medical]);

  // Efektif Debounce untuk Pencarian Karyawan
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 3 && !selectedEmployee && !isEditMode) {
        fetchEmployees();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedEmployee, isEditMode]);

  const fetchEmployees = async () => {
    setIsSearching(true);
    try {
      const response = await api.get(`/employee/search-autocomplete?q=${searchTerm}`);
      setResults(response.data.data);
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Pencarian Gagal', text: "Gagal menghubungi server pencarian" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (emp) => {
    setSelectedEmployee(emp);
    setSearchTerm(`${emp.name} (${emp.employee_code})`);
    setFullName(emp.name);
    setEmpPk(emp.emp_pk_id);
    setIsEmployeeFound(true);
    setResults([]);
  };

  const handleReset = () => {
    if (isEditMode) return;
    setSelectedEmployee(null);
    setSearchTerm("");
    setFullName("");
    setEmpPk("");
    setIsEmployeeFound(false);
    setResults([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      employee_id: empPk
    };
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
            
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-heart-pulse-fill' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Riwayat Medis' : 'Input MCU'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                
                {/* Search Section Autocomplete */}
                <div className="row g-2 mb-3">
                  <div className="col-md-12 position-relative">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Cari Karyawan (Nama / NRP)</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0">
                        <i className={`bi ${isSearching ? 'spinner-border spinner-border-sm text-primary' : 'bi-search text-muted'}`} style={{ fontSize: '0.8rem' }}></i>
                      </span>
                      <input 
                        type="text" 
                        className={`form-control border-start-0 ps-0 ${selectedEmployee ? 'bg-light fw-bold text-primary' : ''}`} 
                        placeholder="Ketik Nama atau NRP minimal 3 karakter..."
                        required
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        readOnly={isEditMode || !!selectedEmployee}
                        autoComplete="off"
                        style={isEditMode ? { cursor: 'not-allowed' } : { fontSize: '0.85rem' }}
                      />
                      {selectedEmployee && !isEditMode && (
                        <button className="btn btn-outline-danger btn-sm" type="button" onClick={handleReset} style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-x-circle"></i>
                        </button>
                      )}
                    </div>

                    {/* Dropdown Hasil Pencarian */}
                    {results.length > 0 && (
                      <div className="list-group position-absolute w-100 shadow-lg border mt-1" style={{ zIndex: 1100, borderRadius: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                        {results.map((emp) => (
                          <button
                            key={emp.emp_pk_id}
                            type="button"
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-3"
                            onClick={() => handleSelect(emp)}
                            style={{ fontSize: '0.8rem' }}
                          >
                            <div>
                              <div className="fw-bold text-dark">{emp.name}</div>
                              <small className="text-muted" style={{ fontSize: '0.7rem' }}>NRP: {emp.employee_code}</small>
                            </div>
                            <span className={`badge ${emp.is_active ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                              {emp.status_text}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
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