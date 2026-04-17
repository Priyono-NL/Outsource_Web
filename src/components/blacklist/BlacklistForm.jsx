import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function BlacklistForm({ onClose, onSuccess, initialData }) {  
  const formRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const isEditMode = !!initialData;
  
  useEffect(() => {
    if (initialData) {
      setSelectedPerson({
        person_id: initialData.person_id,
        name: initialData.person_name
      });
      setSearchTerm(initialData.person_name);      
      if (formRef.current) {
        formRef.current.status.value = initialData.status;
        formRef.current.block_status.value = initialData.block_status;
      }
    }
  }, [initialData]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 3 && !selectedPerson) {
        fetchPersons();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedPerson]);

  const fetchPersons = async () => {
    setIsSearching(true);
    try {
      const response = await api.get(`/person/search?q=${searchTerm}`);
      const data = response.data.data;
      setResults(data);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Gagal menghubungi server pencarian";
      Toast.fire({ icon: 'error', title: 'Pencarian Gagal', text: errorMsg });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (person) => {
    setSelectedPerson(person);
    setSearchTerm(person.name);
    setResults([]);
  };

  const handleReset = () => {
    if (isEditMode) return;
    setSelectedPerson(null);
    setSearchTerm("");
    setResults([]);    
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/oslist/${initialData.id}`, data) 
            : await api.post('/oslist/submit', data);
      if (response.data.status === 'success') {
        formRef.current.reset();
        Toast.fire({ icon: 'success', title: response.data.message || 'Data berhasil disimpan' });
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
                <i className="bi bi-shield-exclamation me-2"></i>
                {initialData ? 'Update Status Blacklist' : 'Input Status Blacklist'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                
                <div className="row g-3 mb-4">
                  <div className="col-md-12 position-relative">
                    <label className="form-label small fw-bold text-muted">Cari Personel (Nama atau NIK)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className={`bi ${isSearching ? 'spinner-border spinner-border-sm text-primary' : 'bi-search text-muted'}`}></i>
                      </span>
                      <input
                        type="text"
                        className={`form-control border-start-0 ps-0 ${selectedPerson ? 'bg-light fw-bold' : ''}`}
                        placeholder="Ketik minimal 3 karakter untuk mencari..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        readOnly={isEditMode || !!selectedPerson} 
                        autoComplete="off"
                        required
                        style={isEditMode ? { backgroundColor: '#e9ecef', cursor: 'not-allowed' } : {}}
                      />
                      {selectedPerson && !isEditMode && (
                        <button className="btn btn-outline-danger" type="button" onClick={handleReset}>
                          <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
                        </button>
                      )}
                    </div>

                    {results.length > 0 && (
                      <div className="list-group position-absolute w-100 shadow-lg border-0 mt-1" style={{ zIndex: 1100, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        {results.map((p) => (
                          <button
                            key={p.person_id}
                            type="button"
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2 px-3"
                            onClick={() => handleSelect(p)}
                          >
                            <div>
                              <div className="fw-bold text-dark">{p.name}</div>
                              <small className="text-muted"><i className="bi bi-card-text me-1"></i>{p.resident_id}</small>
                            </div>
                            <i className="bi bi-plus-circle text-primary"></i>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="hr-text text-muted small fw-bold mb-4">
                  <span className="bg-white px-2">Detail Status Keamanan</span>
                </div>

                <div className={`row g-3 transition-opacity ${!selectedPerson ? 'opacity-50' : ''}`} style={{ pointerEvents: selectedPerson ? 'auto' : 'none' }}>
                  <input type="hidden" name="person_id" value={selectedPerson?.person_id || ""} />
                  
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-muted">Status Blacklist</label>
                    <select name="status" className="form-select" required style={{ borderRadius: 'var(--radius-md)' }}>
                      <option value="0">✅ AMAN (Clean)</option>
                      <option value="1">🚫 BLACKLIST</option>
                    </select>
                  </div>

                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-muted">Alasan / Keterangan (Reason)</label>
                    <input 
                      type="text" 
                      name="block_status" 
                      className="form-control" 
                      placeholder="Contoh: Mengundurkan diri tidak baik-baik, dll..."
                      required={selectedPerson && formRef.current?.status?.value === "1"}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button 
                  type="submit" 
                  className="btn-app btn-primary-app px-5 shadow-sm"
                  disabled={!selectedPerson}
                >
                  <i className="bi bi-check-lg me-2"></i>
                  {initialData ? 'Update Data' : 'Simpan Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default BlacklistForm;