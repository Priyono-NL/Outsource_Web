import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { saveAs } from 'file-saver'; 

import api from '../api/api';
import { Toast } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import AccessReport_Table from '../components/absensi_all/AccessReport_Table';

const Report_Access = () => {

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

  // Update State yang diaplikasikan saat tombol "Terapkan" ditekan
  const handleApplyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
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
      <PageHeader 
        title="Access Clocking Report" 
        searchPlaceholder="Cari ID Karyawan / Nama / Card Number ..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={handleApplyFilters}
    />

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

          <div className="filter-group" style={{ minWidth: 180 }}>
            <label>Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => setDepartmentInput(o?.value || '')}
              isClearable isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          {/* Filter Tanggal Mulai */}
          <div className="filter-group" style={{ minWidth: 150 }}>
            <label>Tanggal Mulai</label>
            <input 
              type="date" 
              className="form-control-app"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Filter Tanggal Sampai */}
          <div className="filter-group" style={{ minWidth: 150 }}>
            <label>Sampai</label>
            <input 
              type="date" 
              className="form-control-app"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
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
        
        <AccessReport_Table    
          refreshTrigger={crud.refreshKey}
          subCompany={appliedSubCompany}
          department={appliedDepartment}
          startDate={appliedStartDate}
          endDate={appliedEndDate}
        />
      </div>
    </div>
  );
};

export default Report_Access;