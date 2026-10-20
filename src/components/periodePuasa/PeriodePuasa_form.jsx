import React, { useState, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function PeriodePuasaForm({ onClose, onSuccess, initialData }) {
  const isEditMode = !!initialData;

  // --- STATE: HEADER PERIODE ---
  const [header, setHeader] = useState({
    periode_id: '',
    periode_name: '',
    tahun: new Date().getFullYear(),
    start_date: '',
    end_date: ''
  });

  // --- STATE: FASE PERUBAHAN TANGGAL (Sesuai Gambar: 19 Feb-4 Mar & 5 Mar-20 Mar) ---
  const [phases, setPhases] = useState([
    { id: Date.now(), name: 'Fase 1', start_date: '', end_date: '' }
  ]);

  // --- STATE: ATURAN SHIFT & JAM ---
  const [schedules, setSchedules] = useState([
    { 
      id: Date.now() + 1, 
      shift_type: 'Regular Shift', 
      target_shift: '', 
      times: {}
    }
  ]);

  useEffect(() => {
    if (initialData) {
      // 1. Set Header secara instan agar form langsung terisi (UX yang baik)
      setHeader({
        periode_id: initialData.periode_id || '',
        periode_name: initialData.periode_name || '',
        tahun: initialData.tahun || new Date().getFullYear(),
        start_date: initialData.start_date || '',
        end_date: initialData.end_date || ''
      });

      // 2. Fetching Child Data (Phases & Schedules) ke Backend
      if (initialData.periode_id) {
        const fetchDetail = async () => {
          try {
            const response = await api.get(`/periode/${initialData.periode_id}`);
            if (response.data.status === 'success') {
              const detailData = response.data.data;
              
              // Timpa state dengan data utuh dari database
              if (detailData.phases && detailData.phases.length > 0) {
                setPhases(detailData.phases);
              }
              if (detailData.schedules && detailData.schedules.length > 0) {
                setSchedules(detailData.schedules);
              }
            }
          } catch (error) {
            Toast.fire({ 
              icon: 'error', 
              title: 'Gagal memuat detail fase dan jadwal' 
            });
            console.error(error);
          }
        };

        fetchDetail();
      }
    } else {
      // Reset State jika ini mode Add (Bukan Edit)
      setHeader({ periode_id: '', periode_name: '', tahun: new Date().getFullYear(), start_date: '', end_date: '' });
      setPhases([{ id: Date.now(), name: 'Fase 1', start_date: '', end_date: '' }]);
      setSchedules([{ id: Date.now() + 1, shift_type: 'Regular Shift', target_shift: '', times: {} }]);
    }
  }, [initialData]);

  const handleHeaderChange = (e) => {
    setHeader({ ...header, [e.target.name]: e.target.value });
  };

  const addPhase = () => setPhases([...phases, { id: Date.now(), name: `Fase ${phases.length + 1}`, start_date: '', end_date: '' }]);
  
  const removePhase = (idToRemove) => {
    const updatedPhases = phases
      .filter(p => p.id !== idToRemove)
      .map((p, index) => ({ ...p, name: `Fase ${index + 1}` }));
    setPhases(updatedPhases);
  };

  const addSchedule = () => setSchedules([...schedules, { 
    id: Date.now(), 
    shift_type: 'Regular Shift', 
    target_shift: '', 
    times: {} 
  }]);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...header, phases, schedules };
    
    try {
      const response = await api.post('/periode/submit', payload);
            
      if (response.data.status === 'success') {
        Toast.fire({ icon: 'success', title: response.data.message });
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.message || "Terjadi kesalahan server" });
    }    
  };

  const handleTimeChange = (schedId, timeKey, field, value) => {
    setSchedules(schedules.map(sched => {
      if (sched.id === schedId) {
        return {
          ...sched,
          times: {
            ...sched.times,
            [timeKey]: {
              ...(sched.times[timeKey] || { start: '', end: '' }),
              [field]: value
            }
          }
        };
      }
      return sched;
    }));
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>

        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px' }}>
            
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-light">
              <h6 className="fw-bold mb-0 text-primary">
                <i className={`bi ${isEditMode ? 'bi-journal-bookmark-fill' : 'bi-plus-circle'} me-2`}></i>
                {isEditMode ? 'Edit Konfigurasi Periode Puasa' : 'Tambah Konfigurasi Periode Puasa'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.8rem' }} onClick={onClose}></button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="modal-body p-4 bg-white" style={{ overflowY: 'auto' }}>
                
                {/* 1. HEADER PERIODE */}
                <h6 className="fw-bold mb-3 border-bottom pb-2" style={{ fontSize: '0.85rem' }}>Informasi Utama</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Periode <span className="text-danger">*</span></label>
                    <input type="text" name="periode_name" className="form-control form-control-sm" value={header.periode_name} onChange={handleHeaderChange} placeholder="Ramadhan 2026..." required />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tahun<span className="text-danger">*</span></label>
                    <input type="number" name="tahun" className="form-control form-control-sm" value={header.tahun} onChange={handleHeaderChange} required />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Start Date <span className="text-danger">*</span></label>
                    <input type="date" name="start_date" className="form-control form-control-sm" value={header.start_date} onChange={handleHeaderChange} required />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>End Date <span className="text-danger">*</span></label>
                    <input type="date" name="end_date" className="form-control form-control-sm" value={header.end_date} onChange={handleHeaderChange} required />
                  </div>
                </div>

                {/* 2. FASE PERUBAHAN TANGGAL */}
                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                  <h6 className="fw-bold mb-0" style={{ fontSize: '0.85rem' }}>Fase Perubahan Jam Kantin</h6>
                  <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={addPhase}>+ Tambah Fase</button>
                </div>
                <div className="row g-2 mb-4">
                  {phases.map((phase, idx) => (
                    <div className="col-md-6 d-flex align-items-center gap-2 mb-2" key={phase.id}>
                      <span className="badge bg-secondary" style={{ minWidth: '55px' }}>{phase.name}</span>
                      <input type="date" className="form-control form-control-sm" value={phase.start_date} onChange={e => { const newPhases = [...phases]; newPhases[idx].start_date = e.target.value; setPhases(newPhases); }} />
                      <span>-</span>
                      <input type="date" className="form-control form-control-sm" value={phase.end_date} onChange={e => { const newPhases = [...phases]; newPhases[idx].end_date = e.target.value; setPhases(newPhases); }} />
                      
                      {/* TOMBOL HAPUS FASE */}
                      {phases.length > 1 && (
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-danger py-0 px-2" 
                          onClick={() => removePhase(phase.id)}
                          title="Hapus Fase"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 3. ATURAN SHIFT & JAM PELAYANAN */}
                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                  <h6 className="fw-bold mb-0" style={{ fontSize: '0.85rem' }}>Jadwal Pelayanan Kantin</h6>
                  <button type="button" className="btn btn-sm btn-outline-primary py-0" onClick={addSchedule}>+ Tambah Jadwal</button>
                </div>
                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle text-center" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ minWidth: '130px' }}>Tipe Shift</th>
                        <th style={{ minWidth: '120px' }}>Shift</th>
                        
                        {/* RENDER HEADER FASE SECARA DINAMIS (Jam Normal Dihapus) */}
                        {phases.map(phase => (
                          <th key={`th-${phase.id}`} style={{ minWidth: '150px' }}>
                            Jam {phase.name}
                          </th>
                        ))}
                        
                        <th>#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((sched, idx) => (
                        <tr key={sched.id}>
                          {/* 1. Tipe Shift */}
                          <td>
                            <select className="form-select form-select-sm" value={sched.shift_type} onChange={e => { const newSched = [...schedules]; newSched[idx].shift_type = e.target.value; setSchedules(newSched); }}>
                              <option value="Regular Shift">Regular Shift</option>
                              <option value="Short Shift">Short Shift</option>
                            </select>
                          </td>
                          
                          {/* 2. Target Shift */}
                          <td>
                            <select className="form-select form-select-sm" value={sched.target_shift} onChange={e => { const newSched = [...schedules]; newSched[idx].target_shift = e.target.value; setSchedules(newSched); }}>
                              <option value="">-- Pilih --</option>
                              <option value="Shift 1">Shift 1</option>
                              <option value="Shift 2">Shift 2</option>
                              <option value="Shift 3">Shift 3</option>
                            </select>
                          </td>
                          
                          {/* 3. RENDER INPUT JAM FASE SECARA DINAMIS */}
                          {phases.map(phase => (
                            <td key={`td-${sched.id}-${phase.id}`}>
                              <div className="d-flex align-items-center justify-content-center gap-1">
                                <input 
                                  type="time" 
                                  className="form-control form-control-sm px-1 text-center" 
                                  value={sched.times[phase.id]?.start || ''} 
                                  onChange={e => handleTimeChange(sched.id, phase.id, 'start', e.target.value)}
                                />
                                <span className="text-muted">-</span>
                                <input 
                                  type="time" 
                                  className="form-control form-control-sm px-1 text-center" 
                                  value={sched.times[phase.id]?.end || ''} 
                                  onChange={e => handleTimeChange(sched.id, phase.id, 'end', e.target.value)}
                                />
                              </div>
                            </td>
                          ))}

                          {/* 4. Action Hapus */}
                          <td>
                            <button type="button" className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => setSchedules(schedules.filter(s => s.id !== sched.id))}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              <div className="modal-footer bg-light border-top p-3 d-flex justify-content-end">
                <button type="button" className="btn btn-sm btn-light border px-4" onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-sm btn-primary px-4 shadow-sm">
                  <i className="bi bi-check-lg me-1"></i> Simpan Konfigurasi
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default PeriodePuasaForm;