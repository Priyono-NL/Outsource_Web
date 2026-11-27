import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import BacTreportForm from '../components/BacTreport/BacTreportForm'

const KioskBacAtn = () => {
  const [searchParams] = useSearchParams();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Ambil nama terminal dari URL (?terminal=Lobby_Utama), jika tidak ada pakai default
  const terminalLabel = searchParams.get('terminal') || 'Kiosk';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: '#f0f2f5' }}>
      {/* Topbar Bersih Tanpa Tombol Logout */}
      <div className="bg-white shadow-sm px-4 py-2 d-flex justify-content-between align-items-center border-bottom">
        <div className="d-flex align-items-center gap-2">
          <span
            className="badge bg-primary d-inline-flex align-items-center justify-content-center p-2"
            style={{ borderRadius: '8px' }}
          >
            <i className="bi bi-display fs-6" />
          </span>
          <div>
            <div className="fw-bold text-dark" style={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
              KIOSK BAC ATTENDANCE
            </div>
            <small className="text-muted" style={{ fontSize: '0.75rem' }}>
              Terminal: <strong>{terminalLabel}</strong>
            </small>
          </div>
        </div>

        <div className="text-end">
          <div className="fw-bold text-dark" style={{ fontSize: '1.05rem', lineHeight: 1.1 }}>
            {formattedTime}
          </div>
          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
            {formattedDate}
          </small>
        </div>
      </div>

      {/* Area Utama Form Kiosk */}
      <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center py-4 px-3">
        <div className="w-100" style={{ maxWidth: '460px' }}>
          <BacTreportForm
            variant="page"
            modeType="KIOSK"
            terminalLabel={terminalLabel}
          />
        </div>
      </div>
    </div>
  );
};

export default KioskBacAtn;