import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { saveAs } from 'file-saver'; 

import api from '../api/api';
import { Toast } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import MpEmp_Table from '../components/absensi_all/MpEmp_Table';

const Report_MpEmp = () => {

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const crud = useCrudPage();
  const todayStr = getTodayString();

  const [subCompanies, setSubCompanies] = useState([]);
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  const [searchDate, setSearchDate] = useState(todayStr);
  const [appliedSearchDate, setAppliedSearchDate] = useState(todayStr);

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadSubCompanies = async () => {
      try {
        const resSub = await api.get('/subcom?page=1&pageSize=200');
        setSubCompanies(resSub.data?.data || []);
      } catch (err) {
        /* silent */
      }
    };
    loadSubCompanies();
  }, []);

  const handleApplyFilters = () => {
    setAppliedSearchDate(searchDate);
    setAppliedSubCompany(subCompanyInput);
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        sub_company: appliedSubCompany || '',
        search_date: appliedSearchDate || '',
      }).toString();

      const response = await api.get(`/exportMpCc?${params}`, {
        responseType: 'blob'
      });

      const fileName = `Report_Manpower_CC_${appliedSearchDate || 'all'}.xlsx`;
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

  const subCompanyOptions = [
    { value: '', label: 'Semua Sub Company' },
    ...subCompanies.map(sc => ({ 
      value: sc.sub_company_id, 
      label: sc.sub_company_name 
    })),
  ];

  return (
    <div>
      <PageHeader title="Manpower Per Employee" />

      <div className="app-card">
        <div className="filter-bar">

          {/* Filter Sub Company */}
          <div className="filter-group" style={{ minWidth: 180 }}>
            <label>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => setSubCompanyInput(o?.value || '')}
              isClearable 
              isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

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
        
        {/* Tabel Rekap Manpower Per Employee */}
        <MpEmp_Table
          refreshTrigger={crud.refreshKey}
          subCompany={appliedSubCompany}
          searchDate={appliedSearchDate}
        />
      </div>
    </div>
  );
};

export default Report_MpEmp;