import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function OsTrainingForm({ onClose, onSuccess, initialData }) {
  const [training, setTraining] = useState([]);
  const formRef = useRef(null);

  // get training select
  useEffect(() => {
    const fetchTraining = async () => {
      try {        
        const response = await api.get('/training?page=1&pageSize=50'); 
        if (response.data.status === 'success') {
          setTraining(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data kantin:", error);
      }
    };
    fetchTraining();
  }, [])

  useEffect(() => {
        if (initialData && formRef.current && training.length > 0) {
            formRef.current.employee_id.value = initialData.employee_id;
            formRef.current.training_id.value = initialData.training_id;
            formRef.current.training_date_from.value = initialData.training_date_from;
            formRef.current.training_date_to.value = initialData.training_date_to;
            formRef.current.training_result.value = initialData.training_result;
            formRef.current.training_score.value = initialData.training_score;
        }
    }, [initialData, , training]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/ostraining/${initialData.osTraining_id}`, data) 
            : await api.post('/ostraining/submit', data);
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
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Employee ID</label>
                        <input type="text" name="employee_id" className="form-control" />
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Training Name</label>
                        <select name="training_id" className="form-select">
                            {training.map((training) => (
                                <option key={training.training_id} value={training.training_id}>
                                    {training.training_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Date From</label>
                        <input type="date" name="training_date_from" className="form-control" />
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Date To</label>
                        <input type="date" name="training_date_to" className="form-control" />
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Result</label>
                        <select name="training_result" className='form-control' 
                          defaultValue={initialData ? initialData.training_result : ""}
                        >
                          <option value="0">Tidak Lulus</option>
                          <option value="1">Lulus</option>
                        </select>
                    </div>
                    <div className="mb-3 col-6">
                        <label className="form-label small fw-bold">Score</label>
                        <input type="number" name="training_score" className="form-control" />
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

export default OsTrainingForm;