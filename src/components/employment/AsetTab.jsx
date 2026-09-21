import React, { useState, useEffect, useRef } from 'react';

function AsetTab({ initialData }) {
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true); 
  const rawCardRef = useRef(''); // Menyimpan nilai asli sebelum diberi titik untuk switch toggle
  
  const [formData, setFormData] = useState({
    card_number: '',
    c_valid_from: '',
    c_valid_to: ''
  });

  // Helper Penjamin 11 Digit Presisi (XXXXX.XXXXX)
  const format11Digits = (p1, p2) => {
    const clean1 = (String(p1).replace(/\D/g, '') || '0').padStart(5, '0').slice(-5);
    const clean2 = (String(p2).replace(/\D/g, '') || '0').padStart(5, '0').slice(-5);
    return `${clean1}.${clean2}`;
  };

  // Fungsi Pemroses Format Kartu (Wiegand vs Raw)
  const processCardFormat = (rawInput, isWiegandMode) => {
    const inputStr = String(rawInput || '').trim();
    if (!inputStr) return '';

    // 1. Jika input dari awal sudah punya titik (misal: 56.46807)
    if (inputStr.includes('.')) {
      const parts = inputStr.split('.');
      return format11Digits(parts[0], parts[1]);
    }

    // 2. Mode Auto-Convert Wiegand (Desimal -> Hex -> Split -> Desimal)
    if (isWiegandMode && !isNaN(inputStr) && inputStr !== '') {
      try {
        const num = BigInt(inputStr);
        const hexStr = num.toString(16).toLowerCase();

        let p1Dec = '0';
        let p2Dec = '0';

        if (hexStr.length <= 4) {
          p2Dec = parseInt(hexStr, 16).toString();
        } else {
          const p1Hex = hexStr.substring(0, hexStr.length - 4);
          const p2Hex = hexStr.substring(hexStr.length - 4);
          p1Dec = parseInt(p1Hex, 16).toString();
          p2Dec = parseInt(p2Hex, 16).toString();
        }

        return format11Digits(p1Dec, p2Dec);
      } catch (error) {
        console.error("Gagal konversi Wiegand:", error);
      }
    }

    // 3. Mode Format Asli / Raw (Tanpa Hitungan Hex -> Angka Mentah Langsung Dipisah Titik)
    const cleanDigits = inputStr.replace(/\D/g, '');
    if (!cleanDigits) return inputStr;

    if (cleanDigits.length >= 10) {
      return format11Digits(cleanDigits.slice(-10, -5), cleanDigits.slice(-5));
    } else if (cleanDigits.length > 5) {
      return format11Digits(cleanDigits.slice(0, -5), cleanDigits.slice(-5));
    } else {
      return format11Digits('0', cleanDigits);
    }
  };

  useEffect(() => {
    if (initialData) {
      const initCard = initialData.card_number || '';
      rawCardRef.current = initCard;

      const hasDot = String(initCard).includes('.');
      setAutoConvert(hasDot);

      setFormData({
        card_number: processCardFormat(initCard, hasDot),
        c_valid_from: initialData.c_valid_from || '',
        c_valid_to: initialData.c_valid_to || ''
      });
      setIsNoLimit(!initialData.c_valid_to);
    }
  }, [initialData]);

  // Handler saat toggle di-switch ON/OFF
  const handleToggleConvert = (e) => {
    const isChecked = e.target.checked;
    setAutoConvert(isChecked);
    
    // Format ulang dari nilai rawCardRef
    const sourceVal = rawCardRef.current || formData.card_number;
    if (sourceVal) {
      const newFormatted = processCardFormat(sourceVal, isChecked);
      setFormData(prev => ({ ...prev, card_number: newFormatted }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.name === 'card_number') {
      e.preventDefault(); 
      const val = e.target.value;
      rawCardRef.current = val; // Simpan nilai mentah hasil scan
      const formatted = processCardFormat(val, autoConvert);
      setFormData(prev => ({ ...prev, card_number: formatted }));
    }
  };

  const handleBlur = (e) => {
    if (e.target.name === 'card_number' && e.target.value) {
      const val = e.target.value;
      rawCardRef.current = val; // Simpan nilai mentah saat blur
      const formatted = processCardFormat(val, autoConvert);
      setFormData(prev => ({ ...prev, card_number: formatted }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'card_number') {
      rawCardRef.current = value;
    }
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
                {autoConvert ? "Format Wiegand (Converted)" : "Format Asli (Vendor)"}
              </label>
              <input 
                className="form-check-input ms-1 mt-0" 
                type="checkbox" 
                id="toggleConvertCard"
                checked={autoConvert}
                onChange={handleToggleConvert}
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
              onBlur={handleBlur}
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