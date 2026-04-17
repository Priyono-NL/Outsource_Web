import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function Train_m_form({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData && formRef.current) {
      formRef.current.training_id.value = initialData.training_id;
      formRef.current.training_name.value = initialData.training_name;
      formRef.current.organizer.value = initialData.organizer;
    }
  }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/training/${initialData.training_id}`, data) 
            : await api.post('/training/submit', data);
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

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }} 
        onClick={onClose}
      ></div>

      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-journal-bookmark-fill' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Master Training' : 'Tambah Jenis Training'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                <div className="row g-3">
                  
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">Training ID <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="training_id" 
                      className={`form-control ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                      placeholder="Contoh: TRN-001"
                      required
                      readOnly={isEditMode}
                      style={isEditMode ? { cursor: 'not-allowed' } : {}}
                    />
                  </div>

                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-muted">Training Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="training_name" 
                      className="form-control" 
                      placeholder="Nama Pelatihan / Sertifikasi..." 
                      required 
                    />
                  </div>

                  <div className="col-md-12">
                    <label className="form-label small fw-bold text-muted">Organizer (Penyelenggara)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-person-workspace"></i>
                      </span>
                      <input 
                        type="text" 
                        name="organizer" 
                        className="form-control" 
                        placeholder="Contoh: HRD / Internal / Vendor..." 
                      />
                    </div>
                  </div>

                </div>

                <div className="mt-4 p-3 rounded border bg-light">
                   <small className="text-muted d-flex">
                      <i className="bi bi-info-circle me-2 text-primary"></i>
                      <span>Gunakan Training Name Saat Upload Excel Pada Input Training OS.</span>
                   </small>
                </div>
              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm">
                  <i className="bi bi-check-lg me-1"></i> Simpan Data Training
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default Train_m_form;