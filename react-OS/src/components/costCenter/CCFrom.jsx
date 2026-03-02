import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function CCForm({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);

  useEffect(() => {
        if (initialData && formRef.current) {
            formRef.current.company_id.value = initialData.company_id;
            formRef.current.org_id.value = initialData.org_id;
            formRef.current.org_name.value = initialData.org_name;
            formRef.current.cost_center.value = initialData.cost_center;
        }
    }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/costcenter/${initialData.cost_center}`, data) 
            : await api.post('/costcenter/submit', data);
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
                        <label className="form-label small fw-bold">Company ID</label>
                        <input type="number" name="company_id" className="form-control" />
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Org ID</label>
                        <input type="number" name="org_id" className="form-control" />
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Cost Center Name</label>
                        <input type="text" name="org_name" className="form-control" required />
                    </div>
                    <div className="mb-3 col-3">
                        <label className="form-label small fw-bold">Cost Center ID</label>
                        <input type="number" name="cost_center" className="form-control" required />
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

export default CCForm;