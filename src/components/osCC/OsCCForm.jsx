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
    { value: "", label: "Pilih Cost Center" }, 
    ...costCenter.map((item) => ({
        value: item.cost_center,
        label: item.org_name
    }))
  ]; 

  const customSelectStyles = {
    control: (base) => ({
      ...base,
      borderRadius: 'var(--radius-md)',
      borderColor: '#dee2e6',
      fontSize: '14px',
      minHeight: '38px',
      '&:hover': { borderColor: 'var(--color-primary)' }
    }),
    menu: (base) => ({ ...base, zIndex: 9999 })
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-building-gear' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Alokasi Cost Center' : 'Tambah Alokasi Cost Center'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">Employee ID</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><i className="bi bi-person-badge"></i></span>
                      <input 
                        type="text" 
                        name="employee_code" 
                        className={`form-control ${isEditMode ? 'bg-light fw-bold' : ''}`} 
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
                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-muted">Nama Karyawan</label>
                    <div className="position-relative">
                      <input 
                        type="text" 
                        className={`form-control ${fullName.includes('tidak terdaftar') ? 'is-invalid' : ''}`}
                        value={isSearching ? "Sedang mencari..." : fullName}
                        readOnly
                        placeholder="Nama akan muncul otomatis..."
                        style={{ backgroundColor: '#f8f9fa', fontWeight: '600' }} 
                      />
                      {isSearching && (
                        <div className="position-absolute end-0 top-50 translate-middle-y me-3">
                          <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="hr-text text-muted small fw-bold mb-4">
                  <span className="bg-white px-2">Konfigurasi Alokasi</span>
                </div>

                <div className="row g-3">
                  <div className="col-md-12">
                    <label className="form-label small fw-bold text-muted">Department / Cost Center</label>
                    <Select 
                      options={ccOptions}
                      isSearchable={true} 
                      placeholder="Cari Cost Center..."
                      styles={customSelectStyles}
                      isDisabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      value={ccOptions.find(opt => opt.value === selectCCId) || null}
                      onChange={(opt) => setselectCCId(opt ? opt.value : null)}
                      required
                    />
                    <input type="hidden" name="cc_id" value={selectCCId || ''} />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Mulai Berlaku (Valid From)</label>
                    <input 
                      type="date" 
                      name="valid_from" 
                      className="form-control" 
                      disabled={(!isEmployeeFound && !isEditMode) || isSearching} 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <div className="d-flex justify-content-between">
                      <label className="form-label small fw-bold text-muted">Selesai Berlaku (Valid To)</label>
                      <div className="form-check">
                        <input 
                          type="checkbox" 
                          id="no_limit_cc" 
                          className="form-check-input"
                          checked={isNoLimit}
                          onChange={handleNoLimitToggle}
                          disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                        />
                        <label className="form-check-label small fw-bold text-primary" htmlFor="no_limit_cc" style={{ cursor: 'pointer' }}>
                          No Limit
                        </label>
                      </div>
                    </div>
                    <input 
                      type="date" 
                      name="valid_to" 
                      id="valid_to" 
                      className="form-control" 
                      required={!isNoLimit}
                      disabled={isNoLimit || (!isEmployeeFound && !isEditMode) || isSearching}
                      defaultValue={initialData?.valid_to}
                      style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button 
                  type="submit" 
                  className="btn-app btn-primary-app px-4" 
                  disabled={(!isEmployeeFound && !isEditMode) || isSearching}
                >
                  <i className="bi bi-save me-2"></i>
                  {isEditMode ? 'Update Alokasi' : 'Simpan Alokasi'}
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