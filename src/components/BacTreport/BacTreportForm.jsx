import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';
import { Toast } from '../../utils/sweetalert';
import LoadingButton from '../LoadingButton';

const DEFAULT_REASONS = [
  'Kartu Ketinggalan',
  'Kartu Belum Diterima',
  'Kartu Error / Rusak',
  'Lupa Clocking',
  'Keperluan Dinas / Lapangan',
];

const BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

const formatPhotoUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const extractDatePart = (row) => {
  const raw = row.submit_at || row.clocking_date || row.date_clocking || '';
  if (!raw) return '';
  const cleaned = String(raw).replace('T', ' ').trim();
  const [datePart] = cleaned.split(' ');
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
};

const isEmptyClockValue = (val) => {
  if (val === undefined || val === null) return true;
  const s = String(val).trim();
  return (
    s === '' ||
    s === '-' ||
    s.toUpperCase() === 'KOSONG' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'none' ||
    s.toLowerCase() === 'no clock in' ||
    s.toLowerCase() === 'no clock out'
  );
};

const BacTreportForm = ({
  variant = 'modal', // 'modal' | 'page'
  modeType = 'BACKDATE', // 'KIOSK' | 'BACKDATE'
  terminalLabel = 'By System',
  reasons = DEFAULT_REASONS,
  initialData = null,
  onClose,
  onCancel,
  onSuccess,
}) => {
  const isEditMode = !!initialData;

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetail, setEmployeeDetail] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [recordId, setRecordId] = useState(null);
  const [activeType, setActiveType] = useState(modeType);
  const [dateVal, setDateVal] = useState('');
  const [timeVal, setTimeVal] = useState('');
  const [reasonVal, setReasonVal] = useState('');
  const [directionVal, setDirectionVal] = useState('OUT'); // 'IN' | 'OUT'
  const [availableDirections, setAvailableDirections] = useState(['IN', 'OUT']);

  // State webcam khusus kiosk
  const [cameraActive, setCameraActive] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const resetFormState = (nextType = modeType) => {
    stopCamera();
    setPhotoBlob(null);
    setRecordId(null);
    setActiveType(nextType);
    setSelectedEmployee(null);
    setEmployeeDetail(null);
    setSearchTerm('');
    setResults([]);
    setDateVal('');
    setTimeVal('');
    setReasonVal('');
    setDirectionVal('OUT');
    setAvailableDirections(['IN', 'OUT']);
    setPhotoPreview('');
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  // Isi otomatis saat tombol Koreksi / Edit ditekan, atau reset saat Tambah Baru
  useEffect(() => {
    stopCamera();
    setPhotoBlob(null);

    if (initialData) {
      const empCode = initialData.employee_code || initialData.employee_id || '';
      const empName = initialData.employee_name || initialData.name || '-';
      const deptName =
        initialData.dept_name ||
        initialData.department_name ||
        initialData.cc_name ||
        initialData.cc ||
        initialData.cost_center ||
        '-';
      const ccCode = initialData.cost_center ?? '';

      const rawIn =
        initialData.bac_clock_in ?? initialData.clock_in ?? initialData.full_clock_in ?? '';
      const rawOut =
        initialData.bac_clock_out ?? initialData.clock_out ?? initialData.full_clock_out ?? '';

      const inIsEmpty = isEmptyClockValue(rawIn);
      const outIsEmpty = isEmptyClockValue(rawOut);

      const emptyDirs = [];
      if (inIsEmpty) emptyDirs.push('IN');
      if (outIsEmpty) emptyDirs.push('OUT');

      const dirsToShow = emptyDirs.length > 0 ? emptyDirs : ['IN', 'OUT'];
      const rawDir = String(initialData.direction || '').toUpperCase();
      const defaultDir = dirsToShow.includes(rawDir) ? rawDir : dirsToShow[0];

      const resolvedType = String(initialData.type || modeType).toUpperCase();
      const existingPhoto =
        initialData.link_photo || initialData.evidence_photo || initialData.bac_evidence || '';

      setRecordId(initialData.id || initialData.bac_id || null);
      setActiveType(resolvedType === 'KIOSK' || resolvedType === 'BACKDATE' ? resolvedType : modeType);
      setSelectedEmployee({
        employee_code: empCode,
        name: empName,
        dept_name: deptName,
        cost_center: ccCode,
      });
      setEmployeeDetail({
        name: empName,
        employee_id: empCode,
        dept_name: deptName,
        cost_center: ccCode,
      });
      setSearchTerm(empCode ? `${empName} (${empCode})` : empName);
      setResults([]);

      setDateVal(extractDatePart(initialData));
      setTimeVal('');
      setReasonVal(
        initialData.alasan ||
          (initialData.bac_ket && initialData.bac_ket !== '-' ? initialData.bac_ket : '')
      );
      setAvailableDirections(dirsToShow);
      setDirectionVal(defaultDir);
      setPhotoPreview(existingPhoto ? formatPhotoUrl(existingPhoto) : '');
    } else {
      resetFormState(modeType);
    }
  }, [initialData, modeType]);

  // Waktu realtime otomatis untuk mode KIOSK saat tambah data baru
  useEffect(() => {
    if (isEditMode || activeType !== 'KIOSK') return;

    const syncNow = () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      setDateVal(`${yyyy}-${mm}-${dd}`);
      setTimeVal(`${hh}:${min}`);
    };

    syncNow();
    const timer = setInterval(syncNow, 1000);
    return () => clearInterval(timer);
  }, [isEditMode, activeType]);

  // Debounce pencarian karyawan (hanya saat tambah data baru)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (!isEditMode && searchTerm.trim().length >= 3 && !selectedEmployee) {
        fetchEmployees();
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedEmployee, isEditMode]);

  const fetchEmployees = async () => {
    setIsSearching(true);
    try {
      const res = await api.get('/employee/search-ob', {
        params: { q: searchTerm.trim() },
      });
      setResults(res.data?.data || []);
    } catch {
      Toast.fire({ icon: 'error', title: 'Pencarian karyawan gagal' });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectEmployee = (emp) => {
    const empCode = emp.employee_code || emp.employee_id || '';
    const deptName = emp.dept_name || emp.department_name || emp.cc_name || '-';
    setSelectedEmployee(emp);
    setSearchTerm(`${emp.name} (${empCode})`);
    setEmployeeDetail({
      name: emp.name || '-',
      employee_id: empCode,
      dept_name: deptName,
      cost_center: emp.cost_center ?? '',
    });
    setResults([]);
  };

  const handleResetEmployee = () => {
    if (isEditMode) return;
    stopCamera();
    setPhotoBlob(null);
    setPhotoPreview('');
    setSelectedEmployee(null);
    setEmployeeDetail(null);
    setSearchTerm('');
    setResults([]);
  };

  const handleCloseModal = () => {
    stopCamera();
    if (onClose || onCancel) {
      onClose?.();
      onCancel?.();
    } else if (variant === 'page') {
      resetFormState(modeType);
    }
  };

  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengakses webcam kiosk' });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setPhotoPreview(canvas.toDataURL('image/jpeg', 0.85));
    canvas.toBlob(
      (blob) => {
        if (blob) setPhotoBlob(blob);
      },
      'image/jpeg',
      0.85
    );
    stopCamera();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!employeeDetail?.employee_id) {
      Toast.fire({ icon: 'warning', title: 'Pilih karyawan dari hasil pencarian terlebih dahulu' });
      return;
    }
    if (!dateVal || !timeVal) {
      Toast.fire({ icon: 'warning', title: 'Date dan Time Attendance wajib diisi' });
      return;
    }
    if (!reasonVal) {
      Toast.fire({ icon: 'warning', title: 'Pilih Reason Attendance terlebih dahulu' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      if (recordId) payload.append('id', String(recordId));
      payload.append('employee_id', employeeDetail.employee_id);
      payload.append('dept_name', employeeDetail.dept_name || '');
      if (employeeDetail.cost_center !== '') {
        payload.append('cost_center', String(employeeDetail.cost_center));
      }
      payload.append('type', activeType);
      payload.append('direction', directionVal);
      payload.append('alasan', reasonVal);
      payload.append(
        'status',
        isEditMode && initialData?.status !== undefined ? String(initialData.status) : '0'
      );

      if (activeType === 'BACKDATE') {
        payload.append('submit_at', `${dateVal} ${timeVal}:00`);
      }
      if (photoBlob) {
        payload.append('photo', photoBlob, `bac_atn_${employeeDetail.employee_id}.jpg`);
      }

      const res = await api.post('/api/bac-atn', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.status === 'success') {
        Toast.fire({
          icon: 'success',
          title:
            res.data?.message || (isEditMode ? 'Koreksi BAC ATN tersimpan' : 'BAC ATN berhasil dikirim'),
        });
        stopCamera();
        onSuccess?.(res.data);
        if (variant === 'page') {
          resetFormState(modeType);
        }
      } else {
        Toast.fire({ icon: 'error', title: res.data?.message || 'Gagal menyimpan BAC ATN' });
      }
    } catch (err) {
      Toast.fire({
        icon: 'error',
        title: err.response?.data?.message || 'Terjadi kesalahan saat submit',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isEmployeeSelected = !!employeeDetail?.employee_id;
  const directionsToRender = isEditMode ? availableDirections : ['IN', 'OUT'];
  const isKioskTwoStep = !isEditMode && activeType === 'KIOSK';
  const kioskStep = isEmployeeSelected ? 2 : 1;

  const formBodyContent = (
    <div className="mx-auto" style={{ maxWidth: '420px', width: '100%' }}>
      <div className="text-center mb-3">
        <h3 className="fw-normal text-secondary mb-1">
          {isEditMode
            ? 'BAC Attendance'
            : activeType === 'KIOSK'
            ? 'Kiosk BAC Attendance'
            : 'Backdate BAC Attendance'}
        </h3>
        <div className="text-muted small">Terminal: {terminalLabel}</div>
      </div>

      {isKioskTwoStep && (
        <div className="d-flex justify-content-center align-items-center gap-2 mb-3">
          <span
            className={`badge rounded-pill px-3 py-1 ${
              kioskStep === 1 ? 'bg-primary' : 'bg-success'
            }`}
            style={{ fontSize: '0.75rem' }}
          >
            {kioskStep === 1 ? 'Step 1: Cari Karyawan' : 'Step 1: Terpilih'}
          </span>
          <i className="bi bi-chevron-right text-muted small" />
          <span
            className={`badge rounded-pill px-3 py-1 ${
              kioskStep === 2 ? 'bg-primary' : 'bg-light text-muted border'
            }`}
            style={{ fontSize: '0.75rem' }}
          >
            Step 2: Absensi
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Pencarian NRP / Nama */}
        <div className="mb-3 position-relative">
          <label className="form-label fw-bold text-dark">NRP / Nama:</label>
          <div className="input-group">
            <span className="input-group-text bg-light">
              <i
                className={`bi ${
                  isSearching ? 'spinner-border spinner-border-sm text-primary' : 'bi-search text-muted'
                }`}
              />
            </span>
            <input
              type="text"
              className={`form-control ${
                selectedEmployee ? 'bg-light fw-bold text-primary' : 'bg-light'
              }`}
              placeholder="Ketik NRP atau Nama min. 3 karakter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              readOnly={isEditMode || !!selectedEmployee}
              autoComplete="off"
              required
            />
            {selectedEmployee && !isEditMode && (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleResetEmployee}
                title="Ganti Karyawan"
              >
                <i className="bi bi-x-circle" />
              </button>
            )}
          </div>

          {!isEditMode && results.length > 0 && !selectedEmployee && (
            <div
              className="list-group position-absolute w-100 shadow-lg border mt-1"
              style={{ zIndex: 1100, borderRadius: '6px', maxHeight: '200px', overflowY: 'auto' }}
            >
              {results.map((emp, idx) => (
                <button
                  key={`${emp.employee_code || emp.employee_id}-${idx}`}
                  type="button"
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2 px-3"
                  onClick={() => handleSelectEmployee(emp)}
                  style={{ fontSize: '0.85rem' }}
                >
                  <div>
                    <div className="fw-bold text-dark">{emp.name}</div>
                    <small className="text-muted">NRP: {emp.employee_code || emp.employee_id}</small>
                  </div>
                  <span className="badge bg-primary" style={{ fontSize: '0.7rem' }}>
                    {emp.status_text || 'Tetap / Kontrak'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Detail Employee & Input Absensi (muncul setelah karyawan dipilih pada Kiosk) */}
        {(!isKioskTwoStep || kioskStep === 2) && (
          <div className="card border-0 shadow-sm">
            <div
              className="text-white text-center py-2 fw-semibold"
              style={{ backgroundColor: '#3f51b5', fontSize: '1.1rem' }}
            >
              Detail Employee
            </div>

            <div className="card-body px-4 py-3">
              <div className="mb-3 small text-dark" style={{ lineHeight: 1.55 }}>
                <div>
                  <strong>Name:</strong> {employeeDetail?.name || '-'}
                </div>
                <div>
                  <strong>NRP:</strong> {employeeDetail?.employee_id || '-'}
                </div>
                <div>
                  <strong>Department Name:</strong> {employeeDetail?.dept_name || '-'}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-dark">Date:</label>
                <input
                  type="date"
                  className="form-control bg-light"
                  value={dateVal}
                  onChange={(e) => setDateVal(e.target.value)}
                  disabled={!isEmployeeSelected || isSearching}
                  readOnly={!isEditMode && activeType === 'KIOSK'}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-dark">Time Attendance:</label>
                <input
                  type="time"
                  className="form-control"
                  value={timeVal}
                  onChange={(e) => setTimeVal(e.target.value)}
                  disabled={!isEmployeeSelected || isSearching}
                  readOnly={!isEditMode && activeType === 'KIOSK'}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold text-dark">Reason Attendance:</label>
                <select
                  className="form-select"
                  value={reasonVal}
                  onChange={(e) => setReasonVal(e.target.value)}
                  disabled={!isEmployeeSelected || isSearching}
                  required
                >
                  <option value="">Choose Reason</option>
                  {reasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {activeType === 'KIOSK' && (
                <div className="mb-3">
                  <label className="form-label fw-bold text-dark d-block">Webcam Kiosk:</label>
                  <div className="d-flex gap-2 mb-2">
                    {!cameraActive ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={startCamera}
                        disabled={!isEmployeeSelected}
                      >
                        <i className="bi bi-camera me-1" /> Buka Webcam
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={capturePhoto}
                        >
                          <i className="bi bi-camera-fill me-1" /> Ambil Foto
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={stopCamera}
                        >
                          Tutup
                        </button>
                      </>
                    )}
                  </div>

                  <div className={cameraActive ? 'd-block mb-2' : 'd-none'}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-100 rounded border bg-dark"
                      style={{ maxHeight: '190px', objectFit: 'cover' }}
                    />
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Foto Kiosk"
                      className="w-100 rounded border"
                      style={{ maxHeight: '190px', objectFit: 'cover' }}
                    />
                  )}
                </div>
              )}

              <div className="mb-4 d-flex align-items-center gap-4">
                {directionsToRender.includes('IN') && (
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="direction"
                      id="bacAtnDirIn"
                      value="IN"
                      checked={directionVal === 'IN'}
                      onChange={(e) => setDirectionVal(e.target.value)}
                      disabled={!isEmployeeSelected}
                    />
                    <label className="form-check-label" htmlFor="bacAtnDirIn">
                      In
                    </label>
                  </div>
                )}

                {directionsToRender.includes('OUT') && (
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="direction"
                      id="bacAtnDirOut"
                      value="OUT"
                      checked={directionVal === 'OUT'}
                      onChange={(e) => setDirectionVal(e.target.value)}
                      disabled={!isEmployeeSelected}
                    />
                    <label className="form-check-label" htmlFor="bacAtnDirOut">
                      Out
                    </label>
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-center gap-2">
                <button
                  type="button"
                  className="btn btn-danger px-3 fw-semibold"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  CANCEL
                </button>
                <LoadingButton
                  type="submit"
                  className="btn btn-success px-3 fw-semibold"
                  loading={submitting}
                  loadingText="SUBMITTING..."
                  disabled={!isEmployeeSelected || isSearching}
                >
                  {isEditMode ? 'UPDATE' : 'SUBMIT'}
                </LoadingButton>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );

  if (variant === 'page') {
    return (
      <div className="bg-white p-4 rounded-3 shadow-sm border mx-auto" style={{ maxWidth: '460px' }}>
        {formBodyContent}
      </div>
    );
  }

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.45)' }}
      />

      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        style={{ zIndex: 1055, overflowY: 'auto' }}
      >
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
          <div
            className="modal-content border-0 shadow-lg"
            style={{ borderRadius: '10px', overflow: 'hidden' }}
          >
            <div className="modal-body p-4 bg-white position-relative">
              <button
                type="button"
                className="btn-close position-absolute top-0 end-0 m-3"
                aria-label="Close"
                onClick={handleCloseModal}
              />
              {formBodyContent}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BacTreportForm;