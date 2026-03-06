import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function AlokasiForm({ onClose, onSuccess, initialData }) {
  const [canteens, setCanteens] = useState([]);
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [empId, setEmpId] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const formRef = useRef(null);
  
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
  }, []) // get canteen select

  useEffect(() => {
        if (initialData && formRef.current && canteens.length > 0) {
          setEmpId(initialData.employee_id);
          formRef.current.employee_id.value = initialData.employee_id;
          formRef.current.canteen_id.value = initialData.canteen_id;
          formRef.current.valid_from.value = initialData.valid_from;
          formRef.current.valid_to.value = initialData.valid_to;
          const isNoLimitActive = !initialData.valid_to;
          setIsNoLimit(isNoLimitActive);
          handleSearchEmployee(initialData.employee_id)
        }
    }, [initialData, , canteens]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      valid_to: isNoLimit ? null : (data.valid_to || null) 
    };
    try {
      const response = initialData 
            ? await api.put(`/alokasi/${initialData.alokasi_id}`, payload) 
            : await api.post('/alokasi/submit', data);
      if (response.data.status === 'success') {
        formRef.current.reset();
        alert(response.data.message);
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      alert("Gagal: " + error.response.data.message);
    }    
  };

  const handleSearchEmployee = async (id) => {
    if (!id) {
      setFullName('');
      return;
    }
    setIsSearching(true);
    try {
      const response = await api.get(`/alokasi/search-employee/${id}`);
      if (response.data.status === "success") { 
        setFullName(response.data.full_name);
        setIsEmployeeFound(true);
      }
    } catch (err) {
      setFullName('Karyawan ID tidak terdaftar!');
      setIsEmployeeFound(false);
      console.error("Employee lookup failed:", err);
    } finally { setIsSearching(false); }
  };

  const handleIdChange = (e) => {
    const value = e.target.value;
    setEmpId(value);
    if (value === "") {
      setIsEmployeeFound(false);
      setFullName("");
      setFormData({
        canteen_id: "",
        valid_from: "",
        valid_to: ""
      });
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
        style={{ zIndex: 1050 }}
        onClick={onClose}
      ></div>

      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-xl">
          <div className="modal-content border-0 shadow-lg">
            
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white pt-3 border-bottom-0">
                <div className="d-flex justify-content-between align-items-center mb-3 px-2">
                  <h5 className="fw-bold mb-0">{initialData ? 'Edit Data' : 'Add New Data'}</h5>
                  <button type="button" className="btn-close" onClick={onClose}></button>
                </div>                
              </div>
              <form ref={formRef} onSubmit={handleSave}>
                <div className="card-body border-top">
                  <div className="row g-3">
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Employee ID</label>
                        <input 
                          type="text" 
                          name="employee_id" 
                          className="form-control" 
                          required
                          value={empId}
                          onChange={handleIdChange}
                          onBlur={(e) => handleSearchEmployee(e.target.value)}
                        />
                    </div>
                    <div className="mb-3 col-9">
                      <label className="form-label fw-bold">Nama Lengkap</label>
                      <input 
                        type="text" 
                        className={`form-control ${fullName.includes('tidak terdaftar') ? 'is-invalid' : ''}`}
                        value={isSearching ? "Mencari..." : fullName}
                        readOnly
                        style={{ backgroundColor: '#e9ecef' }} 
                      />
                      {isSearching && <div className="spinner-border spinner-border-sm text-primary mt-1" role="status"></div>}
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Canteen Name</label>
                        <select name="canteen_id" className="form-select" disabled={!isEmployeeFound || isSearching} required>
                            {canteens.map((canteen) => (
                                <option key={canteen.canteen_id} value={canteen.canteen_id}>
                                    {canteen.canteen_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Valid From</label>
                        <input type="date" name="valid_from" className="form-control" disabled={!isEmployeeFound || isSearching} required />
                    </div>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Valid To</label>                        
                        <input 
                          type="date" 
                          name="valid_to" 
                          id="valid_to" 
                          className="form-control" 
                          required
                          disabled={isNoLimit || !isEmployeeFound || isSearching}
                          defaultValue={initialData?.valid_to}                          
                        />
                        <input 
                          type="checkbox" 
                          id="no_limit" 
                          className="form-check-input"
                          checked={isNoLimit}
                          onChange={handleNoLimitToggle}
                        />
                        <label className="form-check-label" htmlFor="no_limit">
                          No Limit
                        </label> 
                    </div>
                  </div>
                </div>              
              <div className="card-footer bg-white d-flex justify-content-end py-3 border-top-0">
                <button type="button" className="btn btn-light me-2 fw-semibold" onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-primary px-4 shadow-sm fw-semibold" disabled={!isEmployeeFound || isSearching}>
                  <i className="bi bi-check-lg me-1"></i> Simpan Data
                </button>
              </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default AlokasiForm;