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
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }} 
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        {/* Menggunakan modal-md agar lebih ramping secara horizontal */}
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header Tipis */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-building-gear' : 'bi-building-add'} me-2`}></i>
                {isEditMode ? 'Edit Sub Company' : 'Tambah Sub Company'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                <div className="row g-2">
                  
                  <div className="col-md-7">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Sub Company <span className="text-danger">*</span></label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light text-muted border-end-0">
                        <i className="bi bi-briefcase" style={{ fontSize: '0.8rem' }}></i>
                      </span>
                      <input 
                        type="text" 
                        name="sub_company_name" 
                        className="form-control form-control-sm border-start-0" 
                        placeholder="Contoh: PT. Sumber Maju" 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-5">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tipe</label>
                    <select 
                      name="type_company" 
                      className="form-select form-select-sm" 
                    >
                      <option value="OS">Outsourcing (OS)</option>
                      <option value="Vendor">Vendor / Kontraktor</option>
                    </select>
                  </div>

                </div>

                {/* Info Box Compact */}
                <div className="mt-3 p-2 rounded border bg-light d-flex align-items-start">
                   <i className="bi bi-info-circle-fill me-2 text-primary" style={{ fontSize: '0.9rem', marginTop: '1px' }}></i>
                   <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
                     Data ini digunakan untuk mengelompokkan karyawan berdasarkan instansi penyedia jasa mereka.
                   </span>
                </div>
              </div>

              {/* Footer Compact */}
              <div className="modal-footer bg-light border-top p-2 px-3">
                <button type="button" className="btn btn-sm btn-light border" style={{ fontSize: '0.8rem' }} onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-sm btn-primary px-3 shadow-sm" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-save me-1"></i> Simpan
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