import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function AlokasiForm({ onClose, onSuccess, initialData }) {
  const [canteens, setCanteens] = useState([]);
  const formRef = useRef(null);

  // get canteen select
  useEffect(() => {
    const fetchCanteens = async () => {
      try {        
        const response = await api.get('/canteen?page=1&pageSize=100'); 
        if (response.data.status === 'success') {
          setCanteens(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data kantin:", error);
      }
    };
    fetchCanteens();
  }, [])

  useEffect(() => {
        if (initialData && formRef.current && canteens.length > 0) {
            formRef.current.employee_id.value = initialData.employee_id;
            formRef.current.canteen_id.value = initialData.canteen_id;
            formRef.current.valid_from.value = initialData.valid_from;
            formRef.current.valid_to.value = initialData.valid_to;
        }
    }, [initialData, , canteens]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/alokasi/${initialData.alokasi_id}`, data) 
            : await api.post('/alokasi/submit', data);
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
                        <label className="form-label small fw-bold">Canteen Name</label>
                        <select name="canteen_id" className="form-select">
                            {canteens.map((canteen) => (
                                <option key={canteen.canteen_id} value={canteen.canteen_id}>
                                    {canteen.canteen_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Valid From</label>
                        <input type="date" name="valid_from" className="form-control" />
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Valid To</label>
                        <input type="date" name="valid_to" className="form-control" />
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

export default AlokasiForm;