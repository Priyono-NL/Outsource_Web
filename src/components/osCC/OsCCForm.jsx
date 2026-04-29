import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import Select from 'react-select';
import api from '../../api/api';

function OsCCForm({ onClose, onSuccess, initialData }) {
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [empId, setEmpId] = useState('');
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const [costCenter, setCostCenter] = useState([]);
  const [selectCCId, setselectCCId] = useState(null);
  const formRef = useRef(null);

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData && formRef.current) {
      setEmpId(initialData.employee_code || ''); 
      setEmpPk(initialData.employee_id || '');
      setselectCCId(initialData.cc_id);
      formRef.current.employee_code.value = initialData.employee_code;
      formRef.current.valid_from.value = initialData.valid_from;
      formRef.current.valid_to.value = initialData.valid_to;
      const isNoLimitActive = !initialData.valid_to;
      setIsNoLimit(isNoLimitActive);
      handleSearchEmployee(initialData.employee_code || initialData.employee_id);
    }
  }, [initialData]);

  useEffect(() => {
    const fetchCC = async () => {
      try {
        const cc_res = await api.get('/costcenter?page=1&pageSize=200');
        if (cc_res.data.status === 'success') setCostCenter(cc_res.data.data);
      } catch (error) {
        console.error("Gagal Mengambil CC:", error);
      }
    };
    fetchCC();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      cc_id: selectCCId, 
      employee_id: empPk,
      valid_to: isNoLimit ? null : (data.valid_to || null) 
    };
    delete payload.employee_code;

    try {
      const response = initialData 
            ? await api.put(`/oscc/${initialData.id_oscc}`, payload) 
            : await api.post('/oscc/submit', payload);
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

  const handleNoLimitToggle = (e) => {
    const checked = e.target.checked;
    setIsNoLimit(checked);
    if (checked) {
        if (formRef.current) formRef.current.valid_to.value = ""; 
    }
  };

  const ccOptions = [
    ...costCenter.map((item) => ({
        value: item.cost_center,
        label: item.org_name
    }))
  ]; 

  const customSelectStyles = {
    control: (base) => ({
      ...base,
      borderRadius: '6px',
      borderColor: '#dee2e6',
      fontSize: '13px', // Lebih kecil
      minHeight: '31px', // Setara form-control-sm
      height: '31px',
      '&:hover': { borderColor: '#0d6efd' }
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0px 8px',
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: '29px',
    }),
    menu: (base) => ({ ...base, zIndex: 9999, fontSize: '13px' })
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
            
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-building-gear' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Alokasi CC' : 'Tambah Alokasi CC'}
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
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Konfigurasi Departemen</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                <div className="row g-2">
                  <div className="col-md-12 mb-1">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Cost Center</label>
                    <Select 
                      options={ccOptions}
                      isSearchable={true} 
                      placeholder="Cari Cost Center..."
                      styles={customSelectStyles}
                      isDisabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      value={ccOptions.find(opt => opt.value === selectCCId) || null}
                      onChange={(opt) => setselectCCId(opt ? opt.value : null)}
                    />
                    <input type="hidden" name="cc_id" value={selectCCId || ''} required />
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
                          id="no_limit_cc" 
                          className="form-check-input"
                          style={{ marginLeft: '-1.2em', marginTop: '0.2em', scale: '0.8' }}
                          checked={isNoLimit}
                          onChange={handleNoLimitToggle}
                          disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                        />
                        <label className="form-check-label text-primary fw-bold" htmlFor="no_limit_cc" style={{ cursor: 'pointer', fontSize: '0.65rem' }}>
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

export default OsCCForm;