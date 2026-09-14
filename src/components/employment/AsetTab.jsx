import React, { useState, useEffect } from 'react';

function AsetTab({ initialData }) {
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true); 
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
      if (initialData.card_number) {
        const hasDot = String(initialData.card_number).includes('.');
        setAutoConvert(hasDot);
      }
    }
  }, [initialData]);

  // Logika Konversi Wiegand
  const parseCardNumber = (rawInput) => {
    const N = String(rawInput).trim();
    if (!N) return '';
    if (N.includes('.')) return N; 

    try {
      if (!isNaN(N)) {
        const hexStr = parseInt(N, 10).toString(16).toLowerCase();
        
        if (hexStr.length <= 4) {
          const part2Dec = parseInt(hexStr, 16).toString().padStart(5, '0');
          return `00000.${part2Dec}`;
        } else {
          const part1Hex = hexStr.substring(0, hexStr.length - 4);
          const part2Hex = hexStr.substring(hexStr.length - 4);

          const part1Dec = parseInt(part1Hex, 16).toString();
          const part2Dec = parseInt(part2Hex, 16).toString();

          return `${part1Dec.padStart(5, '0')}.${part2Dec.padStart(5, '0')}`;
        }
      }
    } catch (error) {
      console.error("Gagal konversi kartu:", error);
    }
    return N; 
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.name === 'card_number') {
      e.preventDefault(); 
      const rawValue = e.target.value;
      const finalCardValue = autoConvert ? parseCardNumber(rawValue) : String(rawValue).trim();
      setFormData(prev => ({ ...prev, card_number: finalCardValue }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="animate__animated animate__fadeIn">
      <div className="row g-2">
        <div className="col-md-12 mb-1">
          <div className="d-flex justify-content-between align-items-end mb-1">
            <label className="form-label mb-0" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
              Absence Card Number<span className="text-danger">*</span>
            </label>
            
            {/* TOGGLE SWITCH BOOTSTRAP */}
            <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
              <label 
                className="form-check-label me-5 text-muted" 
                htmlFor="toggleConvertCard" 
                style={{ fontSize: '0.7rem', cursor: 'pointer' }}
              >
                {autoConvert ? "Format XXXXX.XXXXX (Wiegand)" : "Format Asli (XXXXXXXXXX)"}
              </label>
              <input 
                className="form-check-input ms-1 mt-0" 
                type="checkbox" 
                id="toggleConvertCard"
                checked={autoConvert}
                onChange={(e) => setAutoConvert(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>

          <div className="input-group input-group-sm">
            <span className={`input-group-text border-end-0 ${autoConvert ? 'bg-primary text-white' : 'bg-warning text-dark'}`}>
              <i className="bi bi-credit-card-2-front" style={{ fontSize: '0.8rem' }}></i>
            </span>
            <input 
              type="text" 
              name="card_number" 
              className="form-control form-control-sm border-start-0 fw-bold" 
              placeholder="Scan/ Ketik Nomor kartu..." 
              value={formData.card_number}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown} 
              autoComplete="off"        
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

      <div className="mt-4 p-2 rounded border bg-light d-flex align-items-center">
        <i className="bi bi-info-circle-fill me-2 text-primary" style={{ fontSize: '0.9rem' }}></i>
        <span className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
          Pastikan kursor berada di kotak Nomor Kartu, lalu Tap fisik kartu pada alat.
        </span>
      </div>
    </div>
  );
}

export default AsetTab;