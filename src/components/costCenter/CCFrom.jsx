import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function CCForm({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const isEditMode = !!initialData;

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
                <i className={`bi ${isEditMode ? 'bi-building-gear' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Cost Center' : 'Tambah Cost Center Baru'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Company ID</label>
                    <input 
                      type="number" 
                      name="company_id" 
                      className="form-control" 
                      placeholder="Masukkan ID Perusahaan..." 
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted">Org ID</label>
                    <input 
                      type="number" 
                      name="org_id" 
                      className="form-control" 
                      placeholder="Masukkan ID Organisasi..." 
                    />
                  </div>

                  <div className="col-12 my-2">
                    <hr className="text-muted opacity-25" />
                  </div>

                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-muted">Cost Center Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="org_name" 
                      className="form-control" 
                      placeholder="Contoh: Production Division" 
                      required 
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">Cost Center ID <span className="text-danger">*</span></label>
                    <input 
                      type="number" 
                      name="cost_center" 
                      className={`form-control ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                      placeholder="Kode Numerik..." 
                      required 
                      readOnly={isEditMode}
                      style={isEditMode ? { cursor: 'not-allowed' } : {}}
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm">
                  <i className="bi bi-check-lg me-1"></i> Simpan Cost Center
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default CCForm;