import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { saveAs } from 'file-saver'; // Import file-saver untuk mengunduh Blob

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

  const handleApplyFilters = () => {
    setAppliedSearchDate(searchDate);
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
        <div className="filter-bar">

          {/* Filter Tanggal */}
          <div className="filter-group" style={{ minWidth: 180 }}>
            <label>Tanggal</label>
            <input 
              type="date" 
              className="form-control-app"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
            />
          </div>

          {/* Group Tombol Aksi */}
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }} className="d-flex gap-2">
            <button className="btn-app btn-primary-app" onClick={handleApplyFilters}>
              <i className="bi bi-funnel" /> Terapkan Filter
            </button>

            <button 
              className="btn-app btn-success-app" 
              onClick={handleExportExcel}
              disabled={isExporting}
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
        
        {/* Tabel Rekap Manpower Per Cost Center */}
        <Summary_Table
          refreshTrigger={crud.refreshKey}
          searchDate={appliedSearchDate}
        />
      </div>
    </div>
  );
};

export default Report_Absen;