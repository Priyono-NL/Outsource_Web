import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function AbsensiForm({ onClose, onSuccess, initialData }) {
  const [empId, setEmpId] = useState('');
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);

  const [bacOS, setBacOS] = useState({
    bac_no: '',
    bac_ket: '',
    clock_in: '',
    clock_out: ''
  });

  const [hasClockIn, setHasClockIn] = useState(false);
  const [hasClockOut, setHasClockOut] = useState(false);
  
  const formRef = useRef(null);
  const isEditMode = !!initialData;
  
  useEffect(() => {
    if (initialData) {
      setEmpId(initialData.employee_code || ''); 
      setEmpPk(initialData.employee_id || '');
      setHasClockIn(!!initialData.clocking_in);
      setHasClockOut(!!initialData.clocking_out);
      setBacOS({        
        bac_no: initialData.bac_no || '',
        bac_ket: initialData.bac_ket || '',
        clock_in: initialData.bac_clock_in || '',
        clock_out: initialData.bac_clock_out || ''
      });
    }

    if (initialData && formRef.current) {
      formRef.current.clock_date.value  = initialData.date_clocking || '';
      formRef.current.employee_code.value = initialData.employee_code || '';
      handleSearchEmployee(initialData.employee_code || initialData.employee_id);      
    }  
  }, [initialData, formRef.current]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      employee_id: empPk,
    };
    delete payload.employee_code;
    try {
      const response = initialData 
            ? await api.put(`/absensi/${initialData.absensi_id}`, payload) 
            : await api.post('/absensi/submit', payload);
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
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-person-gear' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit BAC' : 'Tambah BAC'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
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
                        className={`form-control border-start-0 ${isEditMode ? 'bg-light fw-bold' : ''}`} 
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

                {/* divider */}
                <div className="d-flex align-items-center mb-3">
                   <hr className="flex-grow-1 my-0 opacity-25" />
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Input BAC</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                <div className='row'>
                  <div className="col-md-6">
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

                    <div className='col-md-6'>
                      <label className='form-label mb-1' style={{ fontSize: '0.75rem', fontWeight: '600'}}>Clocking Date</label>
                      <input 
                        type="date" 
                        name="clock_date"
                        className='form-control form-control-sm'
                        disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                        required
                      />
                  </div>
                </div>

                  <div className="col-md-12">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Keterangan BAC</label>
                    <input 
                      type="text" 
                      name="bac_ket" 
                      className="form-control form-control-sm" 
                      placeholder="Contoh: Kartu Error"
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required
                      value={bacOS.bac_ket || ''}
                      onChange={(e) => setBacOS({ ...bacOS, bac_ket: e.target.value })} 
                    />
                  </div>

                  <div className='row'>
                    <div className='col-md-6'>
                      <label className='form-label mb-1' style={{ fontSize: '0.75rem', fontWeight: '600'}}>Clock In</label>
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
                      <label className='form-label mb-1' style={{ fontSize: '0.75rem', fontWeight: '600'}}>Clock Out</label>
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