import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function OsMedicForm({ onClose, onSuccess, initialData }) {
  const [medical, setMedical] = useState([]);
  const formRef = useRef(null);

  // get medical select
  useEffect(() => {
    const fetchOsMedical = async () => {
      try {        
        const response = await api.get('/medical?page=1&pageSize=100'); 
        if (response.data.status === 'success') {
          setMedical(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data kantin:", error);
      }
    };
    fetchOsMedical();
  }, [])

  useEffect(() => {
        if (initialData && formRef.current && medical.length > 0) {
            formRef.current.employee_id.value = initialData.employee_id;
            formRef.current.medical_id.value = initialData.medical_id;
            formRef.current.medical_date.value = initialData.medical_date;
            formRef.current.medical_result.value = initialData.medical_result;
            formRef.current.medical_notes.value = initialData.medical_notes;
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
      if (error.response) {
        alert("Gagal: " + error.response.data.message);
      } else {
        alert("Terjadi kesalahan jaringan.");
      }
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
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Employee ID</label>
                        <input type="text" name="employee_id" className="form-control" />
                    </div>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Medical Check Name</label>
                        <select name="medical_id" className="form-select">
                            {medical.map((medical) => (
                                <option key={medical.medical_id} value={medical.medical_id}>
                                    {medical.medical_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Date</label>
                        <input type="date" name="medical_date" className="form-control" />
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Result</label>
                        <input type="text" name="medical_result" className="form-control" />
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Notes</label>
                        <input type="text" name="medical_notes" className="form-control" />
                    </div>
                  </div>
                </div>              
              <div className="card-footer bg-white d-flex justify-content-end py-3 border-top-0">
                <button type="button" className="btn btn-light me-2 fw-semibold" onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-primary px-4 shadow-sm fw-semibold">
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