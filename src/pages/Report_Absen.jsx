import React, { useState } from 'react';
import { saveAs } from 'file-saver'; 

import api from '../api/api';
import { Toast } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import Summary_Table from '../components/absensi_all/Summary_Table';

const Report_Absen = () => {

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const crud = useCrudPage();
  const todayStr = getTodayString();

  const [searchDate, setSearchDate] = useState(todayStr);
  const [appliedSearchDate, setAppliedSearchDate] = useState(todayStr);

  const [isExporting, setIsExporting] = useState(false);

  // STATE BARU: Flag untuk mendeteksi perubahan filter
  const [isFilterDirty, setIsFilterDirty] = useState(false);

  // Helper untuk mengubah state sekaligus menyalakan flag Dirty Filter
  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  const handleApplyFilters = () => {
    setAppliedSearchDate(searchDate);
    // Matikan flag dirty sehingga tabel muncul kembali
    setIsFilterDirty(false);
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        search_date: appliedSearchDate || '',
      }).toString();

      const response = await api.get(`/exportHarian?${params}`, {
        responseType: 'blob'
      });

      const fileName = `Report_Absensi_Harian_${appliedSearchDate || 'all'}.xlsx`;
      saveAs(new Blob([response.data]), fileName);

      Toast.fire({
        icon: 'success',
        title: 'Laporan Excel berhasil diunduh'
      });
    } catch (err) {
      Toast.fire({
        icon: 'error',
        title: 'Gagal mengunduh laporan Excel'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Laporan Harian Per Cost Center" />

      <div className="app-card">
        {/* Container flex disesuaikan agar rapi dan ringkas */}
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3" style={{ fontSize: '12px' }}>

          {/* Filter Tanggal */}
          <div className="filter-group" style={{ minWidth: 150 }}>
            <label className="fw-semibold mb-1">Tanggal</label>
            <input 
              type="date" 
              className="form-control-app"
              style={{ height: '30px', fontSize: '12px', padding: '4px 8px' }}
              value={searchDate}
              onChange={(e) => handleFilterChange(setSearchDate, e.target.value)}
            />
          </div>

          {/* Group Tombol Aksi */}
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }} className="d-flex gap-2">
            <button 
              className="btn-app btn-primary-app" 
              style={{ height: '30px', fontSize: '12px', display: 'flex', alignItems: 'center' }}
              onClick={handleApplyFilters}
            >
              <i className="bi bi-funnel me-1" /> Terapkan Filter
            </button>

            <button 
              className="btn-app btn-success-app" 
              style={{ height: '30px', fontSize: '12px', display: 'flex', alignItems: 'center' }}
              onClick={handleExportExcel}
              disabled={isExporting || isFilterDirty} // Cegah export jika filter kotor
            >
              {isExporting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Mengunduh...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-excel me-1" /> Export Excel
                </>
              )}
            </button>
          </div>

        </div>
        
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> di pojok kanan atas untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <Summary_Table
            refreshTrigger={crud.refreshKey}
            searchDate={appliedSearchDate}
          />
        )}
      </div>
    </div>
  );
};

export default Report_Absen;