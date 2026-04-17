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
      <div className="row g-3">
        
        <div className="col-md-12">
          <label className="form-label small fw-bold text-muted">
            Absence Card Number (Nomor Kartu Absensi)<span className="text-danger">*</span>
          </label>
          <div className="input-group">
            <span className="input-group-text bg-light text-muted">
              <i className="bi bi-credit-card-2-front"></i>
            </span>
            <input 
              type="text" 
              name="card_number" 
              className="form-control" 
              placeholder="Ketik atau scan nomor kartu..." 
              value={formData.card_number}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted">Masa Berlaku Kartu (From)</label>
          <input 
            type="date" 
            name="c_valid_from" 
            className="form-control" 
            value={formData.c_valid_from}
            onChange={handleInputChange}
          />
        </div>

        <div className="col-md-6">
          <div className="d-flex justify-content-between">
            <label className="form-label small fw-bold text-muted">Masa Berlaku Kartu (To)</label>
            <div className="form-check">
              <input 
                type="checkbox" 
                id="no_c_limit" 
                className="form-check-input"
                checked={isNoLimit}
                onChange={(e) => {
                  setIsNoLimit(e.target.checked);
                  if (e.target.checked) {
                    setFormData(prev => ({ ...prev, c_valid_to: '' }));
                  }
                }}
              />
              <label className="form-check-label small fw-bold text-primary" htmlFor="no_c_limit" style={{ cursor: 'pointer' }}>
                No Limit
              </label>
            </div>
          </div>
          <input 
            type="date" 
            name="c_valid_to" 
            id="c_valid_to" 
            className="form-control" 
            disabled={isNoLimit}
            value={formData.c_valid_to}
            onChange={handleInputChange}
            style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
          />
        </div>

      </div>
    </div>
  );
}

export default AsetTab;