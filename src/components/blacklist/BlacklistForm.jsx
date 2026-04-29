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
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }} 
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        {/* Ukuran modal-md agar lebih ramping */}
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            {/* Header Tipis */}
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className="bi bi-shield-exclamation me-2"></i>
                {initialData ? 'Update Status' : 'Input Status Blacklist'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                
                {/* Search Section */}
                <div className="row g-2 mb-3">
                  <div className="col-md-12 position-relative">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Cari Personel (Nama/NIK)</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0">
                        <i className={`bi ${isSearching ? 'spinner-border spinner-border-sm text-primary' : 'bi-search text-muted'}`} style={{ fontSize: '0.8rem' }}></i>
                      </span>
                      <input
                        type="text"
                        className={`form-control border-start-0 ps-0 ${selectedPerson ? 'bg-light fw-bold' : ''}`}
                        placeholder="Minimal 3 karakter..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        readOnly={isEditMode || !!selectedPerson} 
                        autoComplete="off"
                        required
                        style={isEditMode ? { cursor: 'not-allowed' } : { fontSize: '0.85rem' }}
                      />
                      {selectedPerson && !isEditMode && (
                        <button className="btn btn-outline-danger btn-sm" type="button" onClick={handleReset} style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-x-circle"></i>
                        </button>
                      )}
                    </div>

                    {/* Compact Search Results */}
                    {results.length > 0 && (
                      <div className="list-group position-absolute w-100 shadow-lg border mt-1" style={{ zIndex: 1100, borderRadius: '6px', overflow: 'hidden' }}>
                        {results.map((p) => (
                          <button
                            key={p.person_id}
                            type="button"
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-3"
                            onClick={() => handleSelect(p)}
                            style={{ fontSize: '0.8rem' }}
                          >
                            <div>
                              <div className="fw-bold text-dark">{p.name}</div>
                              <small className="text-muted" style={{ fontSize: '0.7rem' }}>NIK: {p.resident_id}</small>
                            </div>
                            <i className="bi bi-plus-lg text-primary small"></i>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider Minimalis */}
                <div className="d-flex align-items-center mb-3">
                   <hr className="flex-grow-1 my-0 opacity-25" />
                   <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Detail Status</span>
                   <hr className="flex-grow-1 my-0 opacity-25" />
                </div>

                {/* Form Inputs */}
                <div className={`row g-2 transition-opacity ${!selectedPerson ? 'opacity-50' : ''}`} style={{ pointerEvents: selectedPerson ? 'auto' : 'none' }}>
                  <input type="hidden" name="person_id" value={selectedPerson?.person_id || ""} />
                  
                  <div className="col-md-5">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Status</label>
                    <select name="status" className="form-select form-select-sm" required>
                      <option value="0">✅ AMAN (Clean)</option>
                      <option value="1">🚫 BLACKLIST</option>
                    </select>
                  </div>

                  <div className="col-md-7">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Alasan / Keterangan</label>
                    <input 
                      type="text" 
                      name="block_status" 
                      className="form-control form-control-sm" 
                      placeholder="Input alasan..."
                      required={selectedPerson && formRef.current?.status?.value === "1"}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Compact */}
              <div className="modal-footer bg-light border-top p-2 px-3">
                <button type="button" className="btn btn-sm btn-light border" style={{ fontSize: '0.8rem' }} onClick={onClose}>Batal</button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary px-3 shadow-sm"
                  disabled={!selectedPerson}
                  style={{ fontSize: '0.8rem' }}
                >
                  <i className="bi bi-check-lg me-1"></i>
                  {initialData ? 'Update' : 'Simpan'}
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