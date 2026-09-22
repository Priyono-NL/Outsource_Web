import React, { useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import api from '../api/api';

const AbsensiVendor = () => {
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    clockingType: 'Absensi',
    clockingMode: 0,
  });
  const isDevMode = import.meta.env.DEV;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scanInput, setScanInput] = useState('');
  const [lastScanData, setLastScanData] = useState(null);
  const [lastScannedCard, setLastScannedCard] = useState(''); // State penampung nomor kartu
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [counter, setCounter] = useState({ in: 0, out: 0 });
  const lastScannedRef = useRef({ card: '', time: 0 });

  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto Focus Kiosk Input
  useEffect(() => {
    const focusInput = (e) => {
      if (e && e.target) {
        const targetTag = e.target.tagName.toUpperCase();
        if (['SELECT', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(targetTag)) {
          return;
        }
      }
      
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    document.addEventListener('click', focusInput);
    focusInput();
    
    return () => document.removeEventListener('click', focusInput);
  }, []);

  // Helper Penjamin Format 11 Karakter Presisi (XXXXX.XXXXX)
  const format11Digits = (p1, p2) => {
    const clean1 = (String(p1).replace(/\D/g, '') || '0').padStart(5, '0').slice(-5);
    const clean2 = (String(p2).replace(/\D/g, '') || '0').padStart(5, '0').slice(-5);
    return `${clean1}.${clean2}`;
  };

  // Logika Konversi & Parsing Kartu Presisi 11 Karakter
  const parseCardNumber = (rawInput) => {
    const inputStr = String(rawInput || '').trim();
    if (!inputStr) return { raw: '', converted: '' };

    if (inputStr.includes('.')) {
      const parts = inputStr.split('.');
      const formatted = format11Digits(parts[0], parts[1]);
      return { raw: formatted, converted: formatted };
    }

    let convertedFormat = inputStr;

    if (!isNaN(inputStr) && inputStr !== '') {
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

        convertedFormat = format11Digits(p1Dec, p2Dec);
      } catch (error) {
        console.error("Gagal konversi Wiegand kartu:", error);
      }
    }

    const cleanDigits = inputStr.replace(/\D/g, '');
    let rawFormatted = inputStr;
    if (cleanDigits) {
      if (cleanDigits.length >= 10) {
        rawFormatted = format11Digits(cleanDigits.slice(-10, -5), cleanDigits.slice(-5));
      } else if (cleanDigits.length > 5) {
        rawFormatted = format11Digits(cleanDigits.slice(0, -5), cleanDigits.slice(-5));
      } else {
        rawFormatted = format11Digits('0', cleanDigits);
      }
    }

    return { raw: rawFormatted, converted: convertedFormat };
  };

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const currentInput = scanInput.trim();
    if (!currentInput) return;

    // Debounce Tapping Berulang < 3 Detik
    const now = Date.now();
    if (lastScannedRef.current.card === currentInput && (now - lastScannedRef.current.time) < 3000) {
      setScanInput('');
      return; 
    }
    lastScannedRef.current = { card: currentInput, time: now };

    const cardData = parseCardNumber(currentInput);
    setLastScannedCard(cardData.raw);

    try {
      const response = await api.post('/absensiVendor/tap', {
        card_no: cardData.converted,
        raw_card_no: cardData.raw,
        clocking_type: config.clockingType,
        clocking_mode: parseInt(config.clockingMode)
      });
      
      const resData = response.data;

      if (resData.success) {
        setLastScanData(resData.employee);
        setStatusMsg({ type: 'success', text: `Absen ${config.clockingMode === 0 ? 'IN' : 'OUT'} Berhasil!` });
        
        if (config.clockingMode === 0) setCounter(p => ({ ...p, in: p.in + 1 }));
        else setCounter(p => ({ ...p, out: p.out + 1 }));

      } else {
        setLastScanData(null);
        setStatusMsg({ type: 'error', text: resData.message || 'Gagal merekam data' });
      }
    } catch (error) {
      setLastScanData(null);
      const errorMsg = error.response?.data?.message || 'Koneksi ke server terputus atau terjadi kesalahan';
      setStatusMsg({ type: 'error', text: errorMsg });
    } finally {
      setScanInput('');
    }
  };

  return (
    <div>      
      <PageHeader title={`Kiosk ${config.clockingType} - Mode: ${config.clockingMode === 0 ? 'IN' : 'OUT'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <strong style={{ fontSize: '1.2rem' }}>
            {currentTime.toLocaleTimeString('id-ID')}
          </strong>
          <span style={{ padding: '5px 10px', background: '#d1e7dd', color: '#0f5132', borderRadius: '5px', fontWeight: 'bold' }}>
            IN: {counter.in}
          </span>
          <span style={{ padding: '5px 10px', background: '#f8d7da', color: '#842029', borderRadius: '5px', fontWeight: 'bold' }}>
            OUT: {counter.out}
          </span>
          
          <button
            className={`btn-app ${showConfig ? 'btn-danger-app' : 'btn-primary-app'}`}
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? <><i className="bi bi-x" /> Tutup Config</> : <><i className="bi bi-gear" /> Config</>}
          </button>
        </div>
      </PageHeader>

      <form 
        onSubmit={handleScanSubmit} 
        style={{ position: 'relative', marginBottom: '20px', zIndex: 10 }}
      >
        <input 
          ref={inputRef}
          type="text" 
          className="form-control text-center shadow"
          placeholder="Scan Kartu/Ketik No Kartu..."
          value={scanInput} 
          onChange={(e) => setScanInput(e.target.value)} 
          autoComplete="off" 
          style={{ border: '2px solid #0d6efd' }}
        />
      </form>

      {showConfig && (
        <div className="app-card" style={{ marginBottom: '20px', padding: '20px' }}>
          <h5 style={{ marginBottom: '15px' }}><i className="bi bi-sliders"></i> Pengaturan Kiosk</h5>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <label>Mode Absen (IN/OUT)</label>
              <select 
                className="form-control"
                value={config.clockingMode} 
                onChange={(e) => setConfig({...config, clockingMode: Number(e.target.value)})}
              >
                <option value={0}>IN (Masuk)</option>
                <option value={1}>OUT (Keluar)</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Tipe Absen</label>
              <select 
                className="form-control"
                value={config.clockingType} 
                onChange={(e) => setConfig({...config, clockingType: e.target.value})}
              >
                <option value="Absensi">Absensi</option>
                <option value="Break">Break</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="app-card" style={{ padding: '30px', minHeight: '60vh', display: 'flex', gap: '30px' }}>
        <div style={{ flex: 2, borderRight: '2px dashed #eee', paddingRight: '20px' }}>
          {statusMsg.text && (
            <div className={`alert ${statusMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center' }}>
              {statusMsg.text}
            </div>
          )}

          <table className="table table-borderless" style={{ fontSize: '1.4rem' }}>
            <tbody>
              {/* ITEM TAMBAHAN: INFORMASI NO. KARTU TAP */}
              <tr>
                <td style={{ width: '35%', color: '#6c757d' }}>No. Kartu</td>
                <td style={{ fontWeight: 'bold', color: '#198754' }}>
                  : {lastScanData?.card_no || lastScanData?.card_number || lastScannedCard || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#6c757d' }}>N R P</td>
                <td style={{ fontWeight: 'bold' }}>: {lastScanData?.emp_id || '-'}</td>
              </tr>
              <tr>
                <td style={{ color: '#6c757d' }}>Nama</td>
                <td style={{ fontWeight: 'bold', color: '#0d6efd' }}>: {lastScanData?.display_name || '-'}</td>
              </tr>
              <tr>
                <td style={{ color: '#6c757d' }}>Sub Company</td>
                <td style={{ fontWeight: 'bold' }}>: {lastScanData?.sub_company_name || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          {lastScanData ? (
            lastScanData.photo_url ? (
              <img 
                src={`${import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || ''}${lastScanData.photo_url.startsWith('/') ? '' : '/'}${lastScanData.photo_url}`}
                alt="Profile" 
                style={{ width: '100%', maxWidth: '300px', borderRadius: '10px', border: '4px solid #f8f9fa', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }} 
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#adb5bd' }}>
                <i className="bi bi-person-bounding-box" style={{ fontSize: '6rem' }}></i>
                <h5>FOTO TIDAK TERSEDIA</h5>
              </div>
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#adb5bd', animation: 'pulse 2s infinite' }}>
              <i className="bi bi-credit-card-2-front" style={{ fontSize: '8rem' }}></i>
              <h2>SILAKAN TAP KARTU</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AbsensiVendor;