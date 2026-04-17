import React, { useState } from 'react';

function AsetTab() {
  const [isNoLimit, setIsNoLimit] = useState(false);

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
                onChange={(e) => setIsNoLimit(e.target.checked)}
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
            style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
          />
        </div>
        
      </div>
    </div>
  );
}

export default AsetTab;