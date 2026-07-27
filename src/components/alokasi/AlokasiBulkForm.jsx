import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function AlokasiBulkForm({ onClose, onSuccess }) {
  const [canteens, setCanteens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const formRef = useRef(null);

  // LOGIKA DISABLED: True jika BELUM ADA karyawan yang dipilih
  const isFormDisabled = selectedEmployees.length === 0;

  useEffect(() => {
    const fetchCanteens = async () => {
      try {        
        const response = await api.get('/canteen?page=1&pageSize=100'); 
        if (response.data.status === 'success') {
          setCanteens(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data kantin:", error);
      }
    };
    fetchCanteens();
  }, []);

  // Debounce Autocomplete Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 3) {
        fetchEmployees();
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchEmployees = async () => {
    setIsSearching(true);
    try {
      const response = await api.get(`/employee/search-all?q=${searchTerm}`);
      setResults(response.data.data || []);
    } catch (err) {
      console.error("Error search employee:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectEmployee = (emp) => {
    const isExist = selectedEmployees.some(item => item.emp_pk_id === emp.emp_pk_id);
    if (isExist) {
      Toast.fire({ icon: 'warning', title: 'Karyawan sudah ada di daftar!' });
      return;
    }

    setSelectedEmployees([...selectedEmployees, emp]);
    setSearchTerm('');
    setResults([]);
  };

  const handleRemoveEmployee = (empPkId) => {
    setSelectedEmployees(selectedEmployees.filter(emp => emp.emp_pk_id !== empPkId));
  };

  const handleNoLimitToggle = (e) => {
    const checked = e.target.checked;
    setIsNoLimit(checked);
    if (checked && formRef.current) {
      formRef.current.valid_to.value = ""; 
    }
  };

  const handleSaveBulk = async (e) => {
    e.preventDefault();

    if (selectedEmployees.length === 0) {
      Toast.fire({ icon: 'warning', title: 'Pilih minimal 1 karyawan!' });
      return;
    }

    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());

    const payload = {
      employee_ids: selectedEmployees.map(emp => emp.emp_pk_id),
      canteen_id: data.canteen_id,
      valid_from: data.valid_from,
      valid_to: isNoLimit ? null : (data.valid_to || null)
    };

    try {
      const response = await api.post('/alokasi/submit-bulk', payload);
      if (response.data.status === 'success') {
        Toast.fire({ icon: 'success', title: response.data.message });
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.message || "Gagal menyimpan alokasi massal" });
    }    
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className="bi bi-people-fill me-2"></i>
                Tambah Alokasi Massal (Multiple Employees)
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSaveBulk}>
              <div className="modal-body p-3 bg-white">
                
                {/* 1. SECTION SEARCH KARYAWAN */}
                <div className="row g-2 mb-3">
                  <div className="col-md-12 position-relative">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                      1. Pilih / Cari Karyawan (Bisa Tambah Banyak)
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0">
                        <i className={`bi ${isSearching ? 'spinner-border spinner-border-sm text-primary' : 'bi-search text-muted'}`} style={{ fontSize: '0.8rem' }}></i>
                      </span>
                      <input 
                        type="text" 
                        className="form-control border-start-0 ps-0" 
                        placeholder="Ketik Nama / NRP untuk menambah ke daftar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoComplete="off"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    {results.length > 0 && (
                      <div className="list-group position-absolute w-100 shadow-lg border mt-1" style={{ zIndex: 1100, borderRadius: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                        {results.map((emp) => (
                          <button
                            key={`${emp.source}-${emp.emp_pk_id}`}
                            type="button"
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-3"
                            onClick={() => handleSelectEmployee(emp)}
                            style={{ fontSize: '0.8rem' }}
                          >
                            <div>
                              <span className="fw-bold text-dark">{emp.name}</span>
                              <small className="text-muted ms-2" style={{ fontSize: '0.7rem' }}>NRP: {emp.employee_code}</small>
                            </div>
                            <span className={`badge ${emp.source === 'OS' ? 'bg-primary' : 'bg-info'}`} style={{ fontSize: '0.6rem' }}>
                              {emp.source}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DAFTAR KARYAWAN TERPILIH */}
                  <div className="col-12 mt-2">
                    <div className="border rounded p-2 bg-light" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="fw-bold text-muted" style={{ fontSize: '0.7rem' }}>
                          Daftar Karyawan Terpilih ({selectedEmployees.length})
                        </small>
                        {selectedEmployees.length > 0 && (
                          <button type="button" className="btn btn-link text-danger p-0 border-0" onClick={() => setSelectedEmployees([])} style={{ fontSize: '0.65rem' }}>
                            Hapus Semua
                          </button>
                        )}
                      </div>

                      {selectedEmployees.length === 0 ? (
                        <div className="text-center text-muted py-3" style={{ fontSize: '0.75rem' }}>
                          Belum ada karyawan dipilih. Silakan cari nama di atas untuk mengaktifkan pilihan kantin.
                        </div>
                      ) : (
                        <div className="d-flex flex-wrap gap-1">
                          {selectedEmployees.map((emp) => (
                            <span 
                              key={emp.emp_pk_id} 
                              className="badge bg-white text-dark border d-flex align-items-center gap-2 p-2 shadow-sm"
                              style={{ fontSize: '0.75rem' }}
                            >
                              <span><strong>{emp.name}</strong> ({emp.employee_code})</span>
                              <i 
                                className="bi bi-x-circle-fill text-danger cursor-pointer" 
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleRemoveEmployee(emp.emp_pk_id)}
                              ></i>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center mb-3">
                  <hr className="flex-grow-1 my-0 opacity-25" />
                  <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>2. Alokasikan Ke</span>
                  <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                {/* 2. SECTION CONFIGURATION (DI-DISABLED JIKA KARYAWAN KOSONG) */}
                <div className="row g-2">
                  <div className="col-12 mb-1">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Kantin</label>
                    <select 
                      name="canteen_id" 
                      className="form-select form-select-sm" 
                      disabled={isFormDisabled} 
                      required
                    >
                      <option value="">-- Pilih Kantin --</option>
                      {canteens.map((canteen) => (
                        <option key={canteen.canteen_id} value={canteen.canteen_id}>
                          {canteen.canteen_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Mulai Berlaku</label>
                    <input 
                      type="date" 
                      name="valid_from" 
                      className="form-control form-control-sm" 
                      disabled={isFormDisabled} 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <div className="d-flex justify-content-between align-items-center">
                      <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Selesai Berlaku</label>
                      <div className="form-check p-0 m-0">
                        <input 
                          type="checkbox" 
                          id="no_limit_bulk" 
                          className="form-check-input"
                          style={{ marginLeft: '-1.2em', marginTop: '0.2em', scale: '0.8' }}
                          checked={isNoLimit}
                          onChange={handleNoLimitToggle}
                          disabled={isFormDisabled}
                        />
                        <label className="form-check-label text-primary fw-bold" htmlFor="no_limit_bulk" style={{ cursor: 'pointer', fontSize: '0.65rem' }}>
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
                      disabled={isNoLimit || isFormDisabled}
                      style={(isNoLimit || isFormDisabled) ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
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
                  disabled={isFormDisabled}
                >
                  <i className="bi bi-save me-1"></i>
                  Simpan All ({selectedEmployees.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default AlokasiBulkForm;