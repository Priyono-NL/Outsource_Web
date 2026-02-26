import React, { useState, useRef, useEffect } from 'react';
import api from '../api/api';

function Medic_m_form({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);

  useEffect(() => {
        if (initialData && formRef.current) {
            formRef.current.medical_id.value = initialData.medical_id;
            formRef.current.medical_name.value = initialData.medical_name;
            formRef.current.faskes.value = initialData.faskes;
        }
    }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/medical/${initialData.medical_id}`, data) 
            : await api.post('/medical/submit', data);
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
                        <label className="form-label small fw-bold">Medical ID</label>
                        <input type="text" name="medical_id" className="form-control" />
                    </div>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Medical Name</label>
                        <input type="text" name="medical_name" className="form-control" />
                    </div>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">faskes</label>
                        <input type="text" name="faskes" className="form-control" />
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

export default Medic_m_form;