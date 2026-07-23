import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function PeriodePuasaForm({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData && formRef.current) {
      formRef.current.periode_id.value = initialData.periode_id;
      formRef.current.periode_name.value = initialData.periode_name;
      formRef.current.tahun.value = initialData.tahun;
      formRef.current.start_date.value = initialData.start_date;
      formRef.current.end_date.value = initialData.end_date;
    }
  }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/periode/${initialData.periode_id}`, data) 
            : await api.post('/periode/submit', data);
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
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }} 
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        {/* Menggunakan modal-md agar lebih ramping */}
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header Tipis */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-journal-bookmark-fill' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Periode Puasa' : 'Tambah Periode Puasa'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <input type="hidden" name="periode_id" />
              <div className="modal-body p-3 bg-white">
                
                <div className="row g-2">

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Periode Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="periode_name" 
                      className="form-control form-control-sm" 
                      placeholder="Nama Periode..." 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tahun<span className="text-danger">*</span></label>
                    <input type="number" className="form-control form-control-sm" name="tahun" min="1900" max="2099" step="1" placeholder="YYYY" />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Start Date <span className="text-danger">*</span></label>
                    <input 
                      type="date" 
                      name="start_date" 
                      className="form-control form-control-sm" 
                      required 
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>End Date <span className="text-danger">*</span></label>
                    <input 
                      type="date" 
                      name="end_date" 
                      className="form-control form-control-sm" 
                      required 
                    />
                  </div>

                </div>

              </div>

              {/* Footer Compact */}
              <div className="modal-footer bg-light border-top p-2 px-3">
                <button type="button" className="btn btn-sm btn-light border" style={{ fontSize: '0.8rem' }} onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-sm btn-primary px-3 shadow-sm" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-check-lg me-1"></i> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default PeriodePuasaForm;