import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function Medic_m_form({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const isEditMode = !!initialData;

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
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-capsule' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Master Medis' : 'Tambah Fasilitas Medis'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                <div className="row g-3">
                  
                  {/* Medical ID - Locked on Edit */}
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">Medical ID <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="medical_id" 
                      className={`form-control ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                      placeholder="Contoh: MED001"
                      required
                      readOnly={isEditMode}
                      style={isEditMode ? { cursor: 'not-allowed' } : {}}
                    />
                  </div>

                  {/* Medical Name */}
                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-muted">Medical Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="medical_name" 
                      className="form-control" 
                      placeholder="Nama Pemeriksaan..." 
                      required 
                    />
                  </div>

                  <div className="col-md-12">
                    <label className="form-label small fw-bold text-muted">Fasilitas Kesehatan (Faskes)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-hospital"></i>
                      </span>
                      <input 
                        type="text" 
                        name="faskes" 
                        className="form-control" 
                        placeholder="Contoh: Klinik / Rumah Sakit / dll..." 
                      />
                    </div>
                  </div>

                </div>

                {/* Info Tip */}
                <div className="mt-4 p-3 rounded border bg-light">
                   <small className="text-muted d-flex">
                      <i className="bi bi-info-circle me-2 text-primary"></i>
                      <span>Gunakan Medical Name Saat Upload Excel Pada Input Medical OS.</span>
                   </small>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm">
                  <i className="bi bi-check-lg me-1"></i> Simpan Data Medis
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default Medic_m_form;