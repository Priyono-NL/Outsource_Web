import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function CanteenForm({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);
  const [costCenter, setCostCenter] = useState([]);
  const [selectedCCs, setSelectedCCs] = useState([])

  useEffect(() => {
    const fetchCC = async () => {
        try {
            const cc_res = await api.get('/costcenter?page=1&pageSize=200');
            if (cc_res.data.status === 'success') setCostCenter(cc_res.data.data);
        } catch (error) {
            console.error("Gagal Mengambil CC:", error)
        }
    };
    fetchCC();
  }, [])

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
        style={{ zIndex: 1050 }}
        onClick={onClose}
      ></div>

      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-xl">
          <div className="modal-content border-0 shadow-lg">
            
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white pt-3 border-bottom-0">
                <div className="d-flex justify-content-between align-items-center mb-3 px-2">
                  <h5 className="fw-bold mb-0">{initialData ? 'Edit Data' : 'Add New Data'}</h5>
                  <button type="button" className="btn-close" onClick={onClose}></button>
                </div>                
              </div>
              <form ref={formRef} onSubmit={handleSave}>
                <div className="card-body border-top">
                  <div className="row g-3">
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Kantin ID</label>
                        <input type="text" name="canteen_id" className="form-control" />
                    </div>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Nama Kantin</label>
                        <input type="text" name="canteen_name" className="form-control" />
                    </div>
                  </div>
                  <div className='row g-3'>
                    <label className='form-label small fw-bold'>Default Canteen for Cost Center</label>
                    <div 
                      className="border rounded p-3 bg-light" 
                      style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6' }}
                    >
                      <div className="row">
                        {costCenter.length > 0 ? (
                          costCenter.map((item) => (
                            <div className="col-md-4 mb-2" key={item.cost_center}>
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  name="cc_ids"
                                  id={`cc-${item.cost_center}`}
                                  value={item.cost_center}
                                  checked={selectedCCs.includes(item.cost_center)}
                                  onChange={() => handleCCChange(item.cost_center)}
                                />
                                <label className="form-check-label" htmlFor={`cc-${item.cost_center}`}>
                                  <small>{item.org_name}</small>
                                </label>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-12 text-center text-muted py-2">
                            <small>Memuat daftar Cost Center...</small>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-end">
                      <small className="text-primary fw-bold">{selectedCCs.length} Cost Center dipilih</small>
                    </div>
                  </div>
                </div>              
              <div className="card-footer bg-white d-flex justify-content-end py-3 border-top-0">
                <button type="button" className="btn btn-light me-2 fw-semibold" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm fw-semibold">
                  <i className="bi bi-check-lg me-1"></i> Simpan Data
                </button>
              </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default CanteenForm;