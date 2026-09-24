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
  const [empId, setEmpId] = useState('');
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
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

  // DETEKSI MODE READ-ONLY (JIKA STATUS BAC FOUND ATAU SUDAH MEMILIKI RECORD BAC)
  const isReadOnly = isEditMode && (
    initialData?.status === 'BAC Found' || 
    !!(initialData?.bac_id || (initialData?.bac_no && initialData?.bac_no !== '-'))
  );
  
  useEffect(() => {
    if (initialData) {
      const code = initialData.employee_code || initialData.employee_id || '';
      const pk = initialData.employee_id || '';
      const dateVal = initialData.clocking_date || initialData.date_clocking || '';
      
      setEmpId(code); 
      setEmpPk(pk);
      setClockDate(dateVal);

      if (initialData.employee_name) {
        setFullName(initialData.employee_name);
        setIsEmployeeFound(true);
      }
      
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

  const handleFileChange = (e) => {
    if (isReadOnly) return;
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
    if (isReadOnly) return; // Guard agar read-only tidak bisa submit

    const formData = new FormData(formRef.current);
    
    formData.set('employee_id', empId || empPk);
    formData.set('clock_date', clockDate);
    formData.set('bac_no', bacOS.bac_no || '');
    formData.set('bac_ket', bacOS.bac_ket || '');
    
    if (bacOS.clock_in) formData.set('clock_in', bacOS.clock_in);
    if (bacOS.clock_out) formData.set('clock_out', bacOS.clock_out);
    
    formData.delete('employee_code');

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

  const handleSearchEmployee = async (id) => {
    if (!id || isReadOnly) {
      if (!id) setFullName('');
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
    if (isEditMode || isReadOnly) return;
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
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isReadOnly ? 'bi-shield-check text-primary' : isEditMode ? 'bi-pencil-square text-warning' : 'bi-plus-circle text-success'} me-2`}></i>
                {isReadOnly ? 'Detail BAC Absensi' : isEditMode ? 'Koreksi Absensi (BAC)' : 'Tambah BAC Baru'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave} encType="multipart/form-data">
              <div className="modal-body p-3 bg-white">
                
                {/* Section Employee Search */}
                <div className="row g-2 mb-3">
                  <div className="col-md-5">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Employee ID</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0"><i className="bi bi-person-badge" style={{ fontSize: '0.8rem' }}></i></span>
                      <input 
                        type="text" 
                        name="employee_code" 
                        className={`form-control border-start-0 ${(isEditMode || isReadOnly) ? 'bg-light fw-bold' : ''}`} 
                        placeholder="Ketik ID..."
                        required
                        value={empId}
                        onChange={handleIdChange}
                        onBlur={(e) => !isEditMode && !isReadOnly && handleSearchEmployee(e.target.value)}
                        readOnly={isEditMode || isReadOnly}
                        style={(isEditMode || isReadOnly) ? { cursor: 'not-allowed' } : {}}
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

                {/* Divider */}
                <div className="d-flex align-items-center mb-3">
                   <hr className="flex-grow-1 my-0 opacity-25" />
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                     {isReadOnly ? 'Data BAC Tersimpan' : 'Input BAC'}
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
                        disabled={isReadOnly || (!isEmployeeFound && !isEditMode) || isSearching} 
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
                        disabled={isReadOnly || (!isEmployeeFound && !isEditMode) || isSearching || isEditMode} 
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
                    disabled={isReadOnly || (!isEmployeeFound && !isEditMode) || isSearching}
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
                      disabled={isReadOnly || (!isEmployeeFound && !isEditMode) || isSearching || hasClockIn}
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
                      disabled={isReadOnly || (!isEmployeeFound && !isEditMode) || isSearching || hasClockOut}
                      value={bacOS.clock_out ? bacOS.clock_out.slice(0, 16) : ''}
                      onChange={(e) => setBacOS({ ...bacOS, clock_out: e.target.value })}
                    />
                  </div>
                </div>

                {/* BUKTI FOTO / DOKUMEN BAC + PREVIEW */}
                <div className="col-md-12">
                  {!isReadOnly && (
                    <>
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
                    </>
                  )}

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
                  ) : isReadOnly && (
                    <div className="mt-2 p-2 border rounded bg-light text-center text-muted" style={{ fontSize: '0.75rem' }}>
                      <i className="bi bi-file-earmark-x me-1"></i> Tidak ada lampiran foto bukti.
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="modal-footer bg-light border-top p-2 px-3">
                {isReadOnly ? (
                  <button type="button" className="btn btn-sm btn-primary px-4 shadow-sm" style={{ fontSize: '0.8rem' }} onClick={onClose}>
                    <i className="bi bi-check2-circle me-1"></i> Tutup
                  </button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default AbsensiForm;