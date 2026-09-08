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
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [counter, setCounter] = useState({ in: 0, out: 0 });

  const inputRef = useRef(null);
  const clearTimerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    try {
      const response = await api.post('/absensiVendor/tap', {
        card_no: scanInput.trim(),
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
      
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setLastScanData(null);
        setStatusMsg({ type: '', text: '' });
      }, 4000);
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
        style={
          isDevMode 
            ? { position: 'relative', marginBottom: '20px', zIndex: 10 } 
            : { position: 'absolute', opacity: 0, pointerEvents: 'none' } 
        }
      >
        <input 
          ref={inputRef}
          type="text" 
          className={isDevMode ? "form-control text-center shadow" : ""}
          placeholder={isDevMode ? "Dev Mode: Ketik No Kartu lalu tekan Enter..." : ""}
          value={scanInput} 
          onChange={(e) => setScanInput(e.target.value)} 
          autoComplete="off" 
          style={isDevMode ? { border: '2px solid #0d6efd' } : {}}
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
              <tr>
                <td style={{ width: '35%', color: '#6c757d' }}>N R P</td>
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
                src={lastScanData.photo_url} 
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