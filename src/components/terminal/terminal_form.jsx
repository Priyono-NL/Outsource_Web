import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function Terminal_form({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData && formRef.current) {
      formRef.current.id.value = initialData.id;
      formRef.current.terminal_id.value = initialData.terminal_id;
      formRef.current.terminal_name.value = initialData.terminal_name;
      formRef.current.terminal_type.value = initialData.terminal_type;
      formRef.current.direction.value = initialData.direction;
      formRef.current.cost_center.value = initialData.cost_center;
      formRef.current.server_loc.value = initialData.server_loc;
    }
  }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/terminal/${initialData.id}`, data) 
            : await api.post('/terminal/submit', data);
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
                {isEditMode ? 'Edit Master Terminal' : 'Tambah Master Terminal'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                <div className="row g-2">
                  <input type="hidden" name="id" />
                  
                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>terminal ID <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="terminal_id" 
                      className={`form-control form-control-sm ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                      required
                      readOnly={isEditMode}
                      style={isEditMode ? { cursor: 'not-allowed' } : {}}
                    />
                  </div>

                  <div className="col-md-8">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>terminal Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      name="terminal_name" 
                      className="form-control form-control-sm"
                      required 
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Terminal Type</label>
                    <select 
                      name="terminal_type" 
                      className="form-select form-select-sm" 
                      required 
                    >
                      <option value="Attendance">Attendance</option>
                      <option value="Access">Access</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Direction</label>
                    <select
                      name="direction" 
                      className="form-select form-select-sm"
                      required
                    >
                      <option value="IN">IN</option>
                      <option value="OUT">OUT</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Cost Center</label>
                    <input 
                      type="text" 
                      name="cost_center" 
                      className="form-control form-control-sm" 
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Server Location</label>
                    <input 
                      type="text" 
                      name="server_loc" 
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

export default Terminal_form;