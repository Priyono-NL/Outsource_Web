import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function OsMedicForm({ onClose, onSuccess, initialData }) {
  const [medical, setMedical] = useState([]);
  const [empId, setEmpId] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const formRef = useRef(null);
  
  useEffect(() => {
    const fetchOsMedical = async () => {
      try {        
        const response = await api.get('/medical?page=1&pageSize=50'); 
        if (response.data.status === 'success') {
          setMedical(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      }
    };
    fetchOsMedical();
  }, []) // get medical select

  useEffect(() => {
        if (initialData && formRef.current && medical.length > 0) {
          setEmpId(initialData.employee_id);
          formRef.current.employee_id.value = initialData.employee_id;
          formRef.current.medical_id.value = initialData.medical_id;
          formRef.current.medical_date.value = initialData.medical_date;
          formRef.current.medical_result.value = initialData.medical_result;
          formRef.current.medical_notes.value = initialData.medical_notes;
          handleSearchEmployee(initialData.employee_id)
        }
    }, [initialData, , medical]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/osmedical/${initialData.osMedical_id}`, data) 
            : await api.post('/osmedical/submit', data);
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
      const response = await api.get(`/employee/search/${id}`);
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
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Medical Check Name</label>
                        <select name="medical_id" className="form-select"  disabled={!isEmployeeFound || isSearching} required>
                            {medical.map((medical) => (
                                <option key={medical.medical_id} value={medical.medical_id}>
                                    {medical.medical_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Date</label>
                        <input type="date" name="medical_date" className="form-control" disabled={!isEmployeeFound || isSearching} required />
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Result</label>
                        <input type="text" name="medical_result" className="form-control" disabled={!isEmployeeFound || isSearching} required />
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Notes</label>
                        <input type="text" name="medical_notes" className="form-control" disabled={!isEmployeeFound || isSearching} />
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

export default OsMedicForm;