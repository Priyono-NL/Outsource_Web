import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function CanteenForm({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const [costCenter, setCostCenter] = useState([]);
  const [selectedCCs, setSelectedCCs] = useState([]);
  const isEditMode = !!initialData;

  useEffect(() => {
    const fetchCC = async () => {
      try {
        const cc_res = await api.get('/costcenter?page=1&pageSize=200');
        if (cc_res.data.status === 'success') setCostCenter(cc_res.data.data);
      } catch (error) {
        console.error("Gagal Mengambil CC:", error);
      }
    };
    fetchCC();
  }, []);

  const handleCCChange = (cc_id) => {
    setSelectedCCs((prev) =>
      prev.includes(cc_id)
        ? prev.filter((id) => id !== cc_id)
        : [...prev, cc_id]
    );
  };

  useEffect(() => {
    if (initialData && formRef.current) {
      formRef.current.canteen_id.value = initialData.canteen_id;
      formRef.current.canteen_name.value = initialData.canteen_name;
      setSelectedCCs(initialData.cc_ids || []);
    }
  }, [initialData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    data.cc_ids = selectedCCs; // Gunakan state selectedCCs langsung
    try {
      const response = initialData 
            ? await api.put(`/canteen/${initialData.canteen_id}`, data) 
            : await api.post('/canteen/submit', data);
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
        <div className="modal-dialog modal-md modal-dialog-centered"> {/* modal-md agar ramping */}
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-shop-window' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Kantin' : 'Tambah Kantin'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                
                <div className="row g-2 mb-3">
                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Kantin ID</label>
                    <input 
                      type="text" 
                      name="canteen_id" 
                      className={`form-control form-control-sm ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                      placeholder="KTN01"
                      required
                      readOnly={isEditMode}
                      style={isEditMode ? { cursor: 'not-allowed' } : {}}
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Kantin</label>
                    <input 
                      type="text" 
                      name="canteen_name" 
                      className="form-control form-control-sm" 
                      placeholder="Masukkan nama kantin..." 
                      required
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center mb-2">
                   <hr className="flex-grow-1 my-0 opacity-25" />
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Default Alokasi CC</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                <div 
                  className="border rounded bg-light p-2" 
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                >
                  <div className="row g-1">
                    {costCenter.length > 0 ? (
                      costCenter.map((item) => (
                        <div className="col-6" key={item.cost_center}>
                          <div className="form-check p-1 px-2 rounded bg-white border d-flex align-items-center" style={{ fontSize: '11px' }}>
                            <input
                              className="form-check-input mt-0"
                              type="checkbox"
                              id={`cc-${item.cost_center}`}
                              checked={selectedCCs.includes(item.cost_center)}
                              onChange={() => handleCCChange(item.cost_center)}
                              style={{ cursor: 'pointer', scale: '0.8' }}
                            />
                            <label 
                              className="form-check-label ms-2 text-truncate" 
                              htmlFor={`cc-${item.cost_center}`} 
                              style={{ cursor: 'pointer', width: '100%' }}
                              title={item.org_name}
                            >
                              {item.org_name}
                            </label>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-12 text-center text-muted py-3">
                        <div className="spinner-border spinner-border-sm text-primary mb-1" role="status"></div>
                        <div style={{ fontSize: '10px' }}>Memuat CC...</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 d-flex justify-content-between align-items-center px-1">
                  <small className="text-muted" style={{ fontSize: '10px' }}>* Pilih CC untuk alokasi default</small>
                  <span className="badge bg-primary rounded-pill px-2 py-1" style={{ fontSize: '10px' }}>
                    {selectedCCs.length} CC Terpilih
                  </span>
                </div>

              </div>

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

      <style jsx>{`
        .form-check {
          transition: all 0.2s ease;
          border: 1px solid #f0f0f0 !important;
        }
        .form-check:hover {
          border-color: #007bff !important;
          background-color: #f8fbff !important;
        }
      `}</style>
    </>
  );
}

export default CanteenForm;