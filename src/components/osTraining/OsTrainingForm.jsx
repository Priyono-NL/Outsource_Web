import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function OsTrainingForm({ onClose, onSuccess, initialData }) {
  const [training, setTraining] = useState([]);
  const [empId, setEmpId] = useState('');
  const [empPk, setEmpPk] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEmployeeFound, setIsEmployeeFound] = useState(false);
  const formRef = useRef(null);
  
  useEffect(() => {
    const fetchTraining = async () => {
      try {        
        const response = await api.get('/training?page=1&pageSize=50'); 
        if (response.data.status === 'success') {
          setTraining(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      }
    };
    fetchTraining();
  }, []) // get training select

  useEffect(() => {
        if (initialData && formRef.current && training.length > 0) {
          setEmpId(initialData.employee_code || ''); 
          setEmpPk(initialData.employee_id || '');
          formRef.current.employee_code.value = initialData.employee_code;
          formRef.current.training_id.value = initialData.training_id;
          formRef.current.training_date_from.value = initialData.training_date_from;
          formRef.current.training_date_to.value = initialData.training_date_to;
          formRef.current.training_result.value = initialData.training_result;
          formRef.current.training_score.value = initialData.training_score;
          handleSearchEmployee(initialData.employee_id)
        }
    }, [initialData, , training]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    const payload = {
      ...data,
      employee_id: empPk
    };
    delete payload.employee_code;
    try {
      const response = initialData 
            ? await api.put(`/ostraining/${initialData.osTraining_id}`, payload) 
            : await api.post('/ostraining/submit', payload);
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
      Toast.warning("ID Karyawan tidak ditemukan.");
    } finally { setIsSearching(false); }
  };

  const handleIdChange = (e) => {
    const value = e.target.value;
    setEmpId(value);
    if (value === "") {
      setIsEmployeeFound(false);
      setFullName("");
      setEmpPk("");
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
                          name="employee_code" 
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
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Training Name</label>
                        <select name="training_id" className="form-select" required disabled={!isEmployeeFound || isSearching}>
                            {training.map((training) => (
                                <option key={training.training_id} value={training.training_id}>
                                    {training.training_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold" required >Date From</label>
                        <input type="date" name="training_date_from" className="form-control" disabled={!isEmployeeFound || isSearching} />
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Date To</label>
                        <input type="date" name="training_date_to" className="form-control" disabled={!isEmployeeFound || isSearching} />
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Result</label>
                        <select name="training_result" className='form-control' 
                          defaultValue={initialData ? initialData.training_result : ""}
                          required disabled={!isEmployeeFound || isSearching}
                        >
                          <option value="0">Tidak Lulus</option>
                          <option value="1">Lulus</option>
                        </select>
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Score</label>
                        <input type="number" name="training_score" className="form-control" disabled={!isEmployeeFound || isSearching} />
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

export default OsTrainingForm;