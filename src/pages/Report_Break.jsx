import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { saveAs } from 'file-saver'; 

import api from '../api/api';
import { Toast } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import BreakReport_Table from '../components/absensi_all/BreakReport_Table';

const Report_Break = () => {

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const crud = useCrudPage();
  const todayStr = getTodayString();

  // --- FILTER STATES ---
  const [subCompanies, setSubCompanies] = useState([]);
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  const [departments, setDepartments] = useState([]);
  const [departmentInput, setDepartmentInput] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [appliedStartDate, setAppliedStartDate] = useState(todayStr);
  const [appliedEndDate, setAppliedEndDate] = useState(todayStr);

  // Status Filter Baru
  const [statusInput, setStatusInput] = useState('all_data');
  const [appliedStatus, setAppliedStatus] = useState('all_data');

  const [appliedSearch, setAppliedSearch] = useState('');

  // UI States
  const [isExporting, setIsExporting] = useState(false);
  const [isFilterDirty, setIsFilterDirty] = useState(false); // Flag pembersih tabel

  useEffect(() => {
    const load = async () => {
      try {
        const [resSub, resDept] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
          api.get('/costcenter?page=1&pageSize=200'),
        ]);
        setSubCompanies(resSub.data.data);
        setDepartments(resDept.data.data);
      } catch { /* silent */ }
    };
    load();
  }, []);

  const handleApplyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
    setAppliedStatus(statusInput); // Terapkan status
    setAppliedSearch(crud.searchInput);
    
    setIsFilterDirty(false); // Tampilkan tabel kembali
    crud.handleSearch();
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
        status_filter: appliedStatus || 'all_data', // Kirim status ke endpoint export
        search: appliedSearch || '',
      }).toString();

      const response = await api.get(`/exportBreak?${params}`, {
        responseType: 'blob'
      });

      const fileName = `Report_Break_Employee_${appliedStartDate}_to_${appliedEndDate}.xlsx`;
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
    ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
  ];

  const departmentOptions = [
    { value: '', label: 'Semua Department' },
    ...departments.map(d => ({ value: d.cost_center, label: d.org_name })),
  ];

  const statusOptions = [
    { value: 'all_data', label: 'Semua Status' },
    { value: 'lengkap', label: 'Lengkap (Normal)' },
    { value: 'overbreak', label: 'Overbreak (> 60 menit)' },
    { value: 'tidak_lengkap', label: 'Tidak Lengkap (Missed)' },
  ];

  return (
    <div>
      <PageHeader 
        title="Employee Break Report" 
        searchPlaceholder="Cari ID Karyawan / Nama / Card Number ..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      />

      <div className="app-card">
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3" style={{ fontSize: '12px' }}>

          <div className="filter-group" style={{ minWidth: 140, flex: 1 }}>
            <label className="fw-semibold mb-1">Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => { setSubCompanyInput(o?.value || ''); setIsFilterDirty(true); }}
              isClearable isSearchable
              menuPortalTarget={document.body}
            />
          </div>

          <div className="filter-group" style={{ minWidth: 140, flex: 1 }}>
            <label className="fw-semibold mb-1">Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => { setDepartmentInput(o?.value || ''); setIsFilterDirty(true); }}
              isClearable isSearchable
              menuPortalTarget={document.body}
            />
          </div>

          <div className="filter-group" style={{ minWidth: 140, flex: 1 }}>
            <label className="fw-semibold mb-1">Status Break</label>
            <Select
              options={statusOptions}
              value={statusOptions.find(o => o.value === statusInput)}
              onChange={o => { setStatusInput(o?.value || 'all_data'); setIsFilterDirty(true); }}
              isSearchable={false}
              menuPortalTarget={document.body}
            />
          </div>

          <div className="filter-group" style={{ minWidth: 120 }}>
            <label className="fw-semibold mb-1">Tanggal Mulai</label>
            <input 
              type="date" 
              className="form-control-app"
              style={{ height: '30px', fontSize: '12px', padding: '4px 8px' }}
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setIsFilterDirty(true); }}
            />
          </div>

          <div className="filter-group" style={{ minWidth: 120 }}>
            <label className="fw-semibold mb-1">Sampai</label>
            <input 
              type="date" 
              className="form-control-app"
              style={{ height: '30px', fontSize: '12px', padding: '4px 8px' }}
              value={endDate}
              min={startDate}
              onChange={(e) => { setEndDate(e.target.value); setIsFilterDirty(true); }}
            />
          </div>

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
              disabled={isExporting || isFilterDirty}
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
        
        {/* State Pencegahan Salah Baca Data */}
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> di pojok kanan atas untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <BreakReport_Table    
            refreshTrigger={crud.refreshKey}
            subCompany={appliedSubCompany}
            department={appliedDepartment}
            startDate={appliedStartDate}
            endDate={appliedEndDate}
            statusFilter={appliedStatus}
            search={appliedSearch}
          />
        )}
      </div>
    </div>
  );
};

export default Report_Break;