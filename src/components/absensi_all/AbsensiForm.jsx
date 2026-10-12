import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

// Helper pembentuk URL foto berbasis VITE_BACKEND_URL
const BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

const formatPhotoUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('blob:')) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

function AbsensiForm({ onClose, onSuccess, initialData }) {
  // State Autocomplete Karyawan
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // State untuk menyimpan NRP 5 digit secara spesifik
  const [empCode, setEmpCode] = useState('');
  
  const [clockDate, setClockDate] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);

  const [previewUrl, setPreviewUrl] = useState('');

  const [bacOS, setBacOS] = useState({
    bac_no: '',
    bac_ket: '',
    clock_in: '',
    clock_out: '',
    evidence_photo: ''
  });

  const [hasClockIn, setHasClockIn] = useState(false);
  const [hasClockOut, setHasClockOut] = useState(false);
  
  const formRef = useRef(null);
  const isEditMode = !!initialData;
  
  // Efek Inisialisasi Data Edit
  useEffect(() => {
    if (initialData) {
      // Set employee_code 5 digit dari data existing
      setEmpCode(initialData.employee_code || '');
      setClockDate(initialData.clocking_date || initialData.date_clocking || '');
      
      setSearchTerm(initialData.employee_code ? `${initialData.employee_name} (${initialData.employee_code})` : initialData.employee_name || '');
      setSelectedEmployee({
        emp_pk_id: initialData.employee_id,
        employee_code: initialData.employee_code,
        name: initialData.employee_name
      });
      setIsEmployeeFound(true);
      
      setHasClockIn(!!(initialData.clock_in && initialData.clock_in !== 'KOSONG' && !initialData.bac_clock_in));
      setHasClockOut(!!(initialData.clock_out && initialData.clock_out !== 'KOSONG' && !initialData.bac_clock_out));
      
      const existingPhoto = initialData.evidence_photo || initialData.bac_evidence || '';

      setBacOS({        
        bac_no: (initialData.bac_no && initialData.bac_no !== '-') ? initialData.bac_no : '',
        bac_ket: (initialData.bac_ket && initialData.bac_ket !== '-') ? initialData.bac_ket : '',
        clock_in: initialData.bac_clock_in || '',
        clock_out: initialData.bac_clock_out || '',
        evidence_photo: existingPhoto
      });

      if (existingPhoto) {
        setPreviewUrl(formatPhotoUrl(existingPhoto));
      }
    }
  }, [initialData]);

  // Efek Debounce Pencarian Karyawan (SLA Performance)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 3 && !selectedEmployee && !isEditMode) {
        fetchEmployees();
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedEmployee, isEditMode]);

  const fetchEmployees = async () => {
    setIsSearching(true);
    try {
      // Pastikan endpoint ini me-return field 'employee_code' (5 digit) di dalam array datanya
      const response = await api.get(`/employee/search-autocomplete?q=${searchTerm}`);
      setResults(response.data.data || []);
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Pencarian Gagal' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (emp) => {
    setSelectedEmployee(emp);
    setSearchTerm(`${emp.name} (${emp.employee_code})`);
    
    // Simpan NRP 5 digit saat user memilih dari dropdown
    setEmpCode(emp.employee_code);
    
    setIsEmployeeFound(true);
    setResults([]);
  };

  const handleReset = () => {
    if (isEditMode) return;
    setSelectedEmployee(null);
    setSearchTerm("");
    setEmpCode(""); // Reset NRP
    setIsEmployeeFound(false);
    setResults([]);
  };

  const handleFileChange = (e) => {    
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
    } else {
      setPreviewUrl(formatPhotoUrl(bacOS.evidence_photo));
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSave = async (e) => {
    e.preventDefault();    

    // Validasi berbasis employee_code (NRP 5 digit)
    if (!empCode) {
      Toast.fire({ icon: 'warning', title: 'Pilih Karyawan terlebih dahulu!' });
      return;
    }

    const formData = new FormData(formRef.current);
    
    // Set field yang akan disimpan ke backend menggunakan NRP 5 Digit
    formData.set('employee_code', empCode);
    
    // Jika backend Anda mengharuskan parameter bernama 'employee_id' 
    // tetapi isinya adalah NRP 5 digit, gunakan baris di bawah ini:
    formData.set('employee_id', empCode); 
    
    formData.set('clock_date', clockDate);
    formData.set('bac_no', bacOS.bac_no || '');
    formData.set('bac_ket', bacOS.bac_ket || '');
    
    if (bacOS.clock_in) formData.set('clock_in', bacOS.clock_in);
    if (bacOS.clock_out) formData.set('clock_out', bacOS.clock_out);

    try {
      const response = await api.post('/absensi/bac', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.status === 'success') {
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
            
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-pencil-square text-warning' : 'bi-plus-circle text-success'} me-2`}></i>
                {isEditMode ? 'Koreksi Absensi (BAC)' : 'Tambah BAC Baru'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave} encType="multipart/form-data">
              <div className="modal-body p-3 bg-white">
                
                {/* Autocomplete Karyawan */}
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
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                     {isEditMode ? 'Edit Data BAC' : 'Input BAC'}
                   </span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                <div className='row'>
                  <div className="col-md-6 mb-2">
                      <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>No BAC</label>
                      <input 
                        type="text" 
                        name="bac_no" 
                        className="form-control form-control-sm" 
                        placeholder="Contoh: 001122"
                        disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                        required
                        value={bacOS.bac_no || ''}
                        onChange={(e) => setBacOS({ ...bacOS, bac_no: e.target.value })} 
                      />
                    </div>

                    <div className='col-md-6 mb-2'>
                      <label className='form-label mb-1' style={{ fontSize: '0.75rem', fontWeight: '600'}}>Clocking Date</label>
                      <input 
                        type="date" 
                        name="clock_date"
                        className='form-control form-control-sm'
                        disabled={(!isEmployeeFound && !isEditMode) || isSearching || isEditMode} 
                        required
                        value={clockDate}
                        onChange={(e) => setClockDate(e.target.value)}
                      />
                  </div>
                </div>

                <div className="col-md-12 mb-2">
                  <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Keterangan BAC</label>
                  <select 
                    name="bac_ket" 
                    className="form-select form-select-sm"
                    disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                    required
                    value={bacOS.bac_ket || ''}
                    onChange={(e) => setBacOS({ ...bacOS, bac_ket: e.target.value })}
                  >
                    <option value=""></option>                      
                    <option value="Kartu Ketinggalan">Kartu Ketinggalan</option>
                    <option value="Kartu Belum Diterima">Kartu Belum Diterima</option>
                    <option value="Kartu Error">Kartu Error</option>
                    <option value="Karyawan Lupa Clocking">Karyawan Lupa Clocking</option>
                    <option value="Dipulangkan">Dipulangkan</option>
                  </select>
                </div>

                <div className='row mb-2'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1' style={{ fontSize: '0.75rem', fontWeight: '600'}}>Clock In (Opsional)</label>
                    <input 
                      type="datetime-local" 
                      name="clock_in"
                      className='form-control form-control-sm'
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching || hasClockIn}
                      value={bacOS.clock_in ? bacOS.clock_in.slice(0, 16) : ''}
                      onChange={(e) => setBacOS({ ...bacOS, clock_in: e.target.value })} 
                    />
                  </div>

                  <div className='col-md-6'>
                    <label className='form-label mb-1' style={{ fontSize: '0.75rem', fontWeight: '600'}}>Clock Out (Opsional)</label>
                    <input 
                      type="datetime-local" 
                      name="clock_out"
                      className='form-control form-control-sm'
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching || hasClockOut}
                      value={bacOS.clock_out ? bacOS.clock_out.slice(0, 16) : ''}
                      onChange={(e) => setBacOS({ ...bacOS, clock_out: e.target.value })}
                    />
                  </div>
                </div>

                {/* BUKTI FOTO / DOKUMEN BAC + PREVIEW */}
                <div className="col-md-12">
                  <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                    Upload Foto Bukti / Dokumen <span className="text-muted fw-normal">(Opsional)</span>
                  </label>
                  <input 
                    type="file" 
                    name="evidence_photo"
                    accept="image/*"
                    className="form-control form-control-sm"
                    disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                    onChange={handleFileChange}
                  />
                  <div className="form-text mt-1 text-muted" style={{ fontSize: '0.65rem' }}>
                    Format: JPG, PNG, WEBP.
                  </div>

                  {/* KOTAK PREVIEW FOTO BUKTI */}
                  {previewUrl ? (
                    <div className="mt-2 p-2 border rounded bg-light text-center">
                      <div className="text-secondary mb-1" style={{ fontSize: '0.7rem', fontWeight: '600' }}>
                        <i className="bi bi-image me-1"></i> Foto Bukti Lampiran:
                      </div>
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer" title="Klik untuk melihat gambar penuh">
                        <img 
                          src={previewUrl} 
                          alt="Bukti BAC" 
                          className="img-thumbnail shadow-sm"
                          style={{ maxHeight: '180px', objectFit: 'contain', width: 'auto', backgroundColor: '#fff' }}
                        />
                      </a>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 border rounded bg-light text-center text-muted" style={{ fontSize: '0.75rem' }}>
                      <i className="bi bi-file-earmark-x me-1"></i> Tidak ada lampiran foto bukti.
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
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

export default AbsensiForm;