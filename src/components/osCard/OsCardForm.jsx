import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function OsCardForm({ onClose, onSuccess, initialData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const formRef = useRef(null);
  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData && formRef.current) {
      setEmpPk(initialData.employee_id || '');
      setSearchTerm(initialData.employee_code ? `${initialData.employee_name} (${initialData.employee_code})` : initialData.employee_name || '');
      setSelectedEmployee({
        emp_pk_id: initialData.employee_id,
        employee_code: initialData.employee_code,
        name: initialData.employee_name
      });
      setFullName(initialData.employee_name || '');
      setIsEmployeeFound(true);

      // Sinkronisasi isian data field original bagian bawah Anda
      formRef.current.card_number.value = initialData.card_number;
      formRef.current.valid_from.value = initialData.valid_from;
      formRef.current.valid_to.value = initialData.valid_to || '';
      const isNoLimitActive = !initialData.valid_to;
      setIsNoLimit(isNoLimitActive);
    }
  }, [initialData]);

  // Mekanisme Debounce untuk Pencarian Karyawan Autocomplete
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

  const handleNoLimitToggle = (e) => {
    const checked = e.target.checked;
    setIsNoLimit(checked);
    if (checked) {
        if (formRef.current) formRef.current.valid_to.value = ""; 
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      employee_id: empPk,
      valid_to: isNoLimit ? null : (data.valid_to || null) 
    };
    try {
      const response = initialData 
            ? await api.put(`/oscard/${initialData.card_id}`, payload) 
            : await api.post('/oscard/submit', payload);
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
                <i className={`bi ${isEditMode ? 'bi-credit-card-2-front-fill' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Kartu Absensi' : 'Registrasi Kartu'}
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

                    {/* Dropdown Hasil Pencarian - Dilengkapi Batas Tinggi & Scrollbar */}
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

                <div className="d-flex align-items-center mb-3">
                   <hr className="flex-grow-1 my-0 opacity-25" />
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Detail Kartu</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                {/* ======================================================== */}
                {/* BAGIAN INPUT ISIAN ASLI KARTU ABSENSI (100% ORIGINAL)     */}
                {/* ======================================================== */}
                <div className="row g-2">
                  <div className="col-md-12 mb-1">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nomor Kartu (Card Number)</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0"><i className="bi bi-credit-card" style={{ fontSize: '0.8rem' }}></i></span>
                      <input 
                        type="text" 
                        name="card_number" 
                        className="form-control border-start-0" 
                        placeholder="Ketik atau scan nomor kartu..." 
                        disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Mulai Berlaku</label>
                    <input 
                      type="date" 
                      name="valid_from" 
                      className="form-control form-control-sm" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <div className="d-flex justify-content-between align-items-center">
                      <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Selesai Berlaku</label>
                      <div className="form-check p-0 m-0">
                        <input 
                          type="checkbox" 
                          id="no_limit" 
                          className="form-check-input"
                          style={{ marginLeft: '-1.2em', marginTop: '0.2em', scale: '0.8' }}
                          checked={isNoLimit}
                          onChange={handleNoLimitToggle}
                          disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                        />
                        <label className="form-check-label text-primary fw-bold" htmlFor="no_limit" style={{ cursor: 'pointer', fontSize: '0.65rem' }}>
                          NO LIMIT
                        </label>
                      </div>
                    </div>
                    <input 
                      type="date" 
                      name="valid_to" 
                      id="valid_to" 
                      className="form-control form-control-sm" 
                      required={!isNoLimit}
                      disabled={isNoLimit || (!isEmployeeFound && !isEditMode) || isSearching}
                      defaultValue={initialData?.valid_to}
                      style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
                    />
                  </div>
                </div>
                {/* ======================================================== */}

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

export default OsCardForm;