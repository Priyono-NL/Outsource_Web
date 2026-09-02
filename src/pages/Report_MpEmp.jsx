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

  const [departments, setDepartments] = useState([]);
  const [departmentInput, setDepartmentInput] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [appliedStartDate, setAppliedStartDate] = useState(todayStr);
  const [appliedEndDate, setAppliedEndDate] = useState(todayStr);

  const [isExporting, setIsExporting] = useState(false);
  
  // STATE BARU: Flag untuk mendeteksi perubahan filter
  const [isFilterDirty, setIsFilterDirty] = useState(false);

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

  // Helper untuk mengubah state sekaligus menyalakan flag Dirty Filter
  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  // Update State yang diaplikasikan saat tombol "Terapkan" ditekan
  const handleApplyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
    
    // Matikan flag dirty sehingga tabel muncul kembali
    setIsFilterDirty(false);
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
      }).toString();

      const response = await api.get(`/exportMpEmp?${params}`, {
        responseType: 'blob'
      });

      const fileName = `Report_MP_Employee_${appliedStartDate}_to_${appliedEndDate}.xlsx`;
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

  // --- STYLING MODULAR: CSS-in-JS untuk Select Kompak ---
  const compactSelectStyle = {
    control: (base) => ({ 
      ...base, 
      minHeight: 30, 
      fontSize: 12,
      boxShadow: 'none'
    }),
    valueContainer: (base) => ({ ...base, padding: '0px 8px' }),
    dropdownIndicator: (base) => ({ ...base, padding: 4 }),
    clearIndicator: (base) => ({ ...base, padding: 4 }),
    option: (base) => ({ ...base, fontSize: 12 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 })
  };

  const subCompanyOptions = [
    { value: '', label: 'Semua Sub Company' },
    ...subCompanies.map(sc => ({ 
      value: sc.sub_company_id, 
      label: sc.sub_company_name 
    })),
  ];

  const departmentOptions = [
    { value: '', label: 'Semua Department' },
    ...departments.map(d => ({ value: d.cost_center, label: d.org_name })),
  ];

  return (
    <div>
      <PageHeader title="Working Hours Report" />

      <div className="app-card">
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3" style={{ fontSize: '12px' }}>

          {/* Filter Sub Company */}
          <div className="filter-group" style={{ minWidth: 160, flex: 1 }}>
            <label className="fw-semibold mb-1">Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable 
              isSearchable
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
          </div>

          <div className="filter-group" style={{ minWidth: 180, flex: 1 }}>
            <label className="fw-semibold mb-1">Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => handleFilterChange(setDepartmentInput, o?.value || '')}
              isClearable isSearchable
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
          </div>

          {/* Filter Tanggal Mulai */}
          <div className="filter-group" style={{ minWidth: 120 }}>
            <label className="fw-semibold mb-1">Tanggal Mulai</label>
            <input 
              type="date" 
              className="form-control-app"
              style={{ height: '30px', fontSize: '12px', padding: '4px 8px' }}
              value={startDate}
              onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
            />
          </div>

          {/* Filter Tanggal Sampai */}
          <div className="filter-group" style={{ minWidth: 120 }}>
            <label className="fw-semibold mb-1">Sampai</label>
            <input 
              type="date" 
              className="form-control-app"
              style={{ height: '30px', fontSize: '12px', padding: '4px 8px' }}
              value={endDate}
              min={startDate}
              onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
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
        
        {/* LOGIKA CONDITIONAL RENDERING UNTUK DIRTY FILTER */}
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> di pojok kanan atas untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <MpEmp_Table
            refreshTrigger={crud.refreshKey}
            subCompany={appliedSubCompany}
            department={appliedDepartment}
            startDate={appliedStartDate}
            endDate={appliedEndDate}
          />
        )}
      </div>
    </div>
  );
};

export default Report_MpEmp;