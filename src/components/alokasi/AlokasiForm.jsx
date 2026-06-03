import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function AlokasiForm({ onClose, onSuccess, initialData }) {
  const [canteens, setCanteens] = useState([]);
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [empId, setEmpId] = useState('');
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const formRef = useRef(null);
  const isEditMode = !!initialData;
  
  useEffect(() => {
    const fetchCanteens = async () => {
      try {        
        const response = await api.get('/canteen?page=1&pageSize=100'); 
        if (response.data.status === 'success') {
          setCanteens(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      }
    };
    fetchCanteens();
  }, [])

  useEffect(() => {
    if (initialData && formRef.current && canteens.length > 0) {
      setEmpId(initialData.employee_code || ''); 
      setEmpPk(initialData.employee_id || '');
      formRef.current.employee_code.value = initialData.employee_code;
      formRef.current.canteen_id.value = initialData.canteen_id;
      formRef.current.valid_from.value = initialData.valid_from;
      formRef.current.valid_to.value = initialData.valid_to;
      const isNoLimitActive = !initialData.valid_to;
      setIsNoLimit(isNoLimitActive);
      setFullName(initialData.employee_name || '');
      setIsEmployeeFound(true);
    }
  }, [initialData, canteens]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      employee_id: empPk,
      valid_to: isNoLimit ? null : (data.valid_to || null) 
    };
    delete payload.employee_code;
    try {
      const response = initialData 
            ? await api.put(`/alokasi/${initialData.alokasi_id}`, payload) 
            : await api.post('/alokasi/submit', payload);
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

  const handleNoLimitToggle = (e) => {
    const checked = e.target.checked;
    setIsNoLimit(checked);
    if (checked) {
        if (formRef.current) formRef.current.valid_to.value = ""; 
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
                <i className={`bi ${initialData ? 'bi-pencil-square' : 'bi-plus-circle'} me-2`}></i>
                {initialData ? 'Edit Alokasi' : 'Tambah Alokasi'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                
                <div className="row g-2 mb-3">
                  <div className="col-md-5">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>ID Karyawan</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0"><i className="bi bi-person-badge" style={{ fontSize: '0.8rem' }}></i></span>
                      <input 
                        type="text" 
                        name="employee_code" 
                        className="form-control form-control-sm border-start-0" 
                        placeholder="Ketik ID..."
                        required
                        value={empId}
                        onChange={handleIdChange}
                        onBlur={(e) => handleSearchEmployee(e.target.value)}
                        readOnly={isEditMode}
                        style={isEditMode ? { cursor: 'not-allowed' } : {}}
                      />
                    </div>
                  </div>
                  <div className="col-md-7">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Lengkap</label>
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

                <div className="d-flex align-items-center mb-3">
                   <hr className="flex-grow-1 my-0 opacity-25" />
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Konfigurasi</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                <div className="row g-2">
                  <div className="col-12 mb-1">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Kantin</label>
                    <select 
                      name="canteen_id" 
                      className="form-select form-select-sm" 
                      disabled={!isEmployeeFound || isSearching} 
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
                      disabled={!isEmployeeFound || isSearching} 
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
                          disabled={!isEmployeeFound || isSearching}
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
                      disabled={isNoLimit || !isEmployeeFound || isSearching}
                      defaultValue={initialData?.valid_to}
                      style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
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
                  disabled={!isEmployeeFound || isSearching}
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

export default AlokasiForm;