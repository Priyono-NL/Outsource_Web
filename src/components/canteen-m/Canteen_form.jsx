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
    data.cc_ids = formData.getAll('cc_ids');
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
                <i className={`bi ${isEditMode ? 'bi-shop-window' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Master Kantin' : 'Tambah Master Kantin'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">Kantin ID</label>
                    <input 
                      type="text" 
                      name="canteen_id" 
                      className={`form-control ${isEditMode ? 'bg-light fw-bold' : ''}`} 
                      placeholder="Contoh: KTN01"
                      required
                      readOnly={isEditMode}
                      style={isEditMode ? { cursor: 'not-allowed' } : {}}
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-muted">Nama Kantin</label>
                    <input 
                      type="text" 
                      name="canteen_name" 
                      className="form-control" 
                      placeholder="Masukkan nama kantin..." 
                      required
                    />
                  </div>
                </div>

                <div className="hr-text text-muted small fw-bold mb-3">
                  <span className="bg-white px-2">Alokasi Default Cost Center</span>
                </div>
                
                <p className="text-muted small mb-3 px-1">
                  Pilih Cost Center yang akan menggunakan kantin ini sebagai alokasi makan default:
                </p>

                <div 
                  className="border rounded p-3 bg-light" 
                  style={{ 
                    maxHeight: '320px', 
                    overflowY: 'auto', 
                    border: '1px solid #dee2e6',
                    borderRadius: 'var(--radius-md)' 
                  }}
                >
                  <div className="row">
                    {costCenter.length > 0 ? (
                      costCenter.map((item) => (
                        <div className="col-md-4 col-sm-6 mb-1" key={item.cost_center}>
                          <div 
                            className="form-check card-checklist p-1 px-2 rounded bg-white border d-flex align-items-center" 
                            style={{ minHeight: '32px' }}
                          >
                            <input
                              className="form-check-input mt-0"
                              type="checkbox"
                              name="cc_ids"
                              id={`cc-${item.cost_center}`}
                              value={item.cost_center}
                              checked={selectedCCs.includes(item.cost_center)}
                              onChange={() => handleCCChange(item.cost_center)}
                              style={{ cursor: 'pointer' }}
                            />
                            <label 
                              className="form-check-label ms-2 text-truncate" 
                              htmlFor={`cc-${item.cost_center}`} 
                              style={{ cursor: 'pointer', fontSize: '11px', lineHeight: '1', width: '100%' }}
                              title={item.org_name}
                            >
                              <span>{item.org_name}</span>
                            </label>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-12 text-center text-muted py-5">
                        <div className="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                        <div className="small">Memuat daftar Cost Center...</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 d-flex justify-content-between align-items-center px-1">
                  <small className="text-muted italic">* Centang untuk menambahkan ke grup kantin ini</small>
                  <span className="badge bg-primary rounded-pill px-3 py-2">
                    {selectedCCs.length} Cost Center Terpilih
                  </span>
                </div>

              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm">
                  <i className="bi bi-save me-2"></i> Simpan Data Kantin
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        .card-checklist {
          transition: all 0.2s ease;
          border: 1px solid #eee !important;
        }
        .card-checklist:hover {
          border-color: var(--color-primary) !important;
          background-color: #f0f7ff !important;
        }
        .form-check-input:checked + .form-check-label {
          color: var(--color-primary);
        }
      `}</style>
    </>
  );
}

export default CanteenForm;