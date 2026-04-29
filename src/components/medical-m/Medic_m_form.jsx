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
                <i className={`bi ${isEditMode ? 'bi-capsule' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Master Medis' : 'Tambah Jenis Medis'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                <div className="row g-2">
                  
                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Medical ID <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="medical_id" 
                      className={`form-control form-control-sm ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                      placeholder="MED001"
                      required
                      readOnly={isEditMode}
                      style={isEditMode ? { cursor: 'not-allowed' } : {}}
                    />
                  </div>

                  <div className="col-md-8">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Medical Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="medical_name" 
                      className="form-control form-control-sm" 
                      placeholder="Nama Pemeriksaan..." 
                      required 
                    />
                  </div>

                  <div className="col-md-12">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Fasilitas Kesehatan</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light text-muted border-end-0">
                        <i className="bi bi-hospital" style={{ fontSize: '0.8rem' }}></i>
                      </span>
                      <input 
                        type="text" 
                        name="faskes" 
                        className="form-control form-control-sm border-start-0" 
                        placeholder="Klinik / RS / Laboratorium..." 
                      />
                    </div>
                  </div>

                </div>

                {/* Info Box Compact */}
                <div className="mt-3 p-2 rounded border bg-light d-flex align-items-center">
                    <i className="bi bi-info-circle-fill me-2 text-primary" style={{ fontSize: '0.9rem' }}></i>
                    <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
                      Gunakan Medical Name yang sama saat upload data excel pada modul Medical OS.
                    </span>
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

export default Medic_m_form;