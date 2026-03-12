import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function BlacklistForm({ onClose, onSuccess, initialData }) {  
  const formRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
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
      if (data.length === 1) {
        handleSelect(data[0]);
      }
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
                    <div className="col-md-12 position-relative">
                      <label className="form-label fw-bold">Name Person</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ketik minimal 3 karakter untuk mencari..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          disabled={!!selectedPerson} // Kunci jika sudah terpilih
                          required
                        />
                        {selectedPerson && (
                          <button className="btn btn-outline-danger" type="button" onClick={handleReset}>
                            Reset
                          </button>
                        )}
                      </div>                      
                      <input type="hidden" name="person_id" value={selectedPerson?.person_id || ""} />
                      {results.length > 0 && (
                        <ul className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1000, top: '100%' }}>
                          {results.map((p) => (
                            <button
                              key={p.person_id}
                              type="button"
                              className="list-group-item list-group-item-action"
                              onClick={() => handleSelect(p)}
                            >
                              {p.name}
                            </button>
                          ))}
                        </ul>
                      )}
                      {isSearching && <small className="text-primary">Mencari...</small>}
                    </div>
                  </div>
                  <hr />
                  <div className={`row g-3 ${!selectedPerson ? 'opacity-50' : ''}`} style={{ pointerEvents: selectedPerson ? 'auto' : 'none' }}>
                    <div className="mb-3 col-4">
                        <label className="form-label small fw-bold">Blacklist Status</label>
                        <select name="status" className="form-select" required>
                          <option value="0">Aman (Tidak Diblacklist)</option>
                          <option value="1">Blacklist</option>
                        </select>
                    </div>
                    <div className="mb-3 col-8">
                        <label className="form-label small fw-bold">Reason</label>
                        <input type="text" name="block_status" className="form-control" />
                    </div>
                  </div>
                </div>              
              <div className="card-footer bg-white d-flex justify-content-end py-3 border-top-0">
                <button type="button" className="btn btn-light me-2 fw-semibold" onClick={onClose}>Batal</button>
                <button 
                    type="submit" 
                    className="btn btn-primary px-4 shadow-sm fw-semibold"
                    disabled={!selectedPerson}
                  >
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

export default BlacklistForm;