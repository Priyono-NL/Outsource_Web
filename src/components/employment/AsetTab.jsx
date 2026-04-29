import React, { useState, useEffect } from 'react';

function AsetTab({ initialData }) {
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [formData, setFormData] = useState({
    card_number: '',
    c_valid_from: '',
    c_valid_to: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        card_number: initialData.card_number || '',
        c_valid_from: initialData.c_valid_from || '',
        c_valid_to: initialData.c_valid_to || ''
      });
      setIsNoLimit(!initialData.c_valid_to);
    }
  }, [initialData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="animate__animated animate__fadeIn">
      <div className="row g-2">
        
        <div className="col-md-12 mb-1">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
            Absence Card Number (Nomor Kartu)<span className="text-danger">*</span>
          </label>
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-light text-muted border-end-0">
              <i className="bi bi-credit-card-2-front" style={{ fontSize: '0.8rem' }}></i>
            </span>
            <input 
              type="text" 
              name="card_number" 
              className="form-control form-control-sm border-start-0" 
              placeholder="Scan atau ketik nomor kartu..." 
              value={formData.card_number}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Masa Berlaku (Dari)</label>
          <input 
            type="date" 
            name="c_valid_from" 
            className="form-control form-control-sm" 
            value={formData.c_valid_from}
            onChange={handleInputChange}
          />
        </div>

        <div className="col-md-6">
          <div className="d-flex justify-content-between align-items-center">
            <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Masa Berlaku (Hingga)</label>
            <div className="form-check p-0 m-0">
              <input 
                type="checkbox" 
                id="no_c_limit" 
                className="form-check-input"
                style={{ marginLeft: '-1.2em', marginTop: '0.2em', scale: '0.8' }}
                checked={isNoLimit}
                onChange={(e) => {
                  setIsNoLimit(e.target.checked);
                  if (e.target.checked) {
                    setFormData(prev => ({ ...prev, c_valid_to: '' }));
                  }
                }}
              />
              <label className="form-check-label text-primary fw-bold" htmlFor="no_c_limit" style={{ cursor: 'pointer', fontSize: '0.65rem' }}>
                NO LIMIT
              </label>
            </div>
          </div>
          <input 
            type="date" 
            name="c_valid_to" 
            id="c_valid_to" 
            className="form-control form-control-sm" 
            disabled={isNoLimit}
            value={formData.c_valid_to}
            onChange={handleInputChange}
            style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
          />
        </div>

      </div>

      {/* Info Box Tipis untuk estetika */}
      <div className="mt-4 p-2 rounded border bg-light d-flex align-items-center">
        <i className="bi bi-info-circle-fill me-2 text-primary" style={{ fontSize: '0.9rem' }}></i>
        <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
          Pastikan nomor kartu sesuai dengan fisik kartu absensi yang dipegang karyawan.
        </span>
      </div>
    </div>
  );
}

export default AsetTab;