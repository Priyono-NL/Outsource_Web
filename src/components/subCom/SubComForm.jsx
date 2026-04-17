import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function SubComForm({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData && formRef.current) {
      formRef.current.sub_company_name.value = initialData.sub_company_name;
      formRef.current.type_company.value = initialData.type_company;
    }
  }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/subcom/${initialData.sub_company_id}`, data) 
            : await api.post('/subcom/submit', data);
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
                <i className={`bi ${isEditMode ? 'bi-building-gear' : 'bi-building-add'} me-2`}></i>
                {isEditMode ? 'Edit Sub Company' : 'Tambah Sub Company Baru'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                <div className="row g-4">
                  
                  <div className="col-md-7">
                    <label className="form-label small fw-bold text-muted">Nama Sub Company <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-briefcase"></i>
                      </span>
                      <input 
                        type="text" 
                        name="sub_company_name" 
                        className="form-control" 
                        placeholder="Contoh: PT. Sumber Maju" 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-5">
                    <label className="form-label small fw-bold text-muted">Tipe Perusahaan</label>
                    <select 
                      name="type_company" 
                      className="form-select" 
                      style={{ borderRadius: 'var(--radius-md)' }}
                    >
                      <option value="OS">Outsourcing (OS)</option>
                      <option value="Vendor">Vendor / Kontraktor</option>
                    </select>
                  </div>

                  <div className="col-12 mt-4">
                    <div className="p-3 rounded border bg-light">
                       <small className="text-muted d-flex">
                          <i className="bi bi-info-circle me-2 text-primary"></i>
                          <span>Data Sub Company digunakan untuk mengelompokkan karyawan Outsourcing berdasarkan penyedia jasa mereka.</span>
                       </small>
                    </div>
                  </div>

                </div>
              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm">
                  <i className="bi bi-save me-2"></i> Simpan Sub Company
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default SubComForm;