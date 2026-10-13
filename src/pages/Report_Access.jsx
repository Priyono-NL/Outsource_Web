import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { saveAs } from 'file-saver'; 

import api from '../api/api';
import { Toast } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

// Import Komponen Modular
import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
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
  const { user } = useAuth();

  // Flag Pembatasan Hak Akses SSO
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted       = user?.allowed_costcenters && user.allowed_costcenters.length > 0;

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);

  // --- STATE FORM FILTER (DRAFT) ---
  const [workerType, setWorkerType]           = useState(isSubCompanyRestricted ? 'os' : 'all');
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [shiftInput, setShiftInput]           = useState('');
  const [startDate, setStartDate]             = useState(todayStr);
  const [endDate, setEndDate]                 = useState(todayStr);

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedWorkerType, setAppliedWorkerType] = useState(isSubCompanyRestricted ? 'os' : 'all');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedShift, setAppliedShift]           = useState('');
  const [appliedStartDate, setAppliedStartDate]   = useState(todayStr);
  const [appliedEndDate, setAppliedEndDate]       = useState(todayStr);
  const [appliedSearch, setAppliedSearch]         = useState('');

  // --- FLAG FILTER STATES ---
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDirty, setIsFilterDirty]     = useState(false);

  // --- ACTION LOADING STATES ---
  const [isExporting, setIsExporting]             = useState(false);
  const [isApplyingFilter, setIsApplyingFilter]   = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [resSub, resDept] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
          api.get('/costcenter?page=1&pageSize=200'),
        ]);

        const subData  = resSub.data.data || [];
        const deptData = resDept.data.data || [];

        setSubCompanies(subData);
        setDepartments(deptData);

        // Auto-select Subcompany & Tipe Karyawan jika user dibatasi SSO
        if (isSubCompanyRestricted && subData.length > 0) {
          const allowedSubList = subData.filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id));
          const defaultSub = allowedSubList.length > 0 ? allowedSubList[0].sub_company_id : subData[0].sub_company_id;
          setSubCompanyInput(defaultSub);
          setAppliedSubCompany(defaultSub);
          setWorkerType('os');
          setAppliedWorkerType('os');
        }

        // Auto-select Cost Center jika user dibatasi SSO
        if (isDeptRestricted && deptData.length > 0) {
          const allowedDeptList = deptData.filter(d => user.allowed_costcenters.includes(d.id));
          const defaultDept = allowedDeptList.length > 0 ? allowedDeptList[0].id : deptData[0].id;
          setDepartmentInput(defaultDept);
          setAppliedDepartment(defaultDept);
        }

      } catch { /* silent error handling */ }
    };
    if (user) load();
  }, [user]);

  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  const handleApplyFilters = () => {
    setIsApplyingFilter(true);
    setAppliedWorkerType(workerType);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
    setAppliedShift(shiftInput);
    setAppliedSearch(crud.searchInput);
    
    setIsFilterApplied(true);
    setIsFilterDirty(false); // Hilangkan status kotor setelah diterapkan

    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setWorkerType(isSubCompanyRestricted ? 'os' : 'all');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    setShiftInput('');
    setStartDate(todayStr);
    setEndDate(todayStr);
    crud.setSearchInput('');

    setAppliedWorkerType(isSubCompanyRestricted ? 'os' : 'all');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');
    setAppliedShift('');
    setAppliedStartDate(todayStr);
    setAppliedEndDate(todayStr);
    setAppliedSearch('');

    setIsFilterApplied(false);
    setIsFilterDirty(false);
  };

  const handleExportExcel = async () => {
    if (isFilterDirty) {
      Toast.fire({ icon: 'warning', title: 'Terapkan filter yang baru diubah sebelum mengeksport data.' });
      return;
    }

    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        worker_type: appliedWorkerType || 'all',
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
        shift: appliedShift || '',
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
        search: appliedSearch || '',
      }).toString();

      const response = await api.get(`/exportAccess?${params}`, {
        responseType: 'blob'
      });

      const fileName = `Report_Access_Employee_${appliedStartDate}_to_${appliedEndDate}.xlsx`;
      saveAs(new Blob([response.data]), fileName);

      Toast.fire({
        icon: 'success',
        title: 'Laporan Excel berhasil diunduh'
      });
    } catch {
      Toast.fire({
        icon: 'error',
        title: 'Gagal mengunduh laporan Excel'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const compactSelectStyle = {
    control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
    menuPortal: base => ({ ...base, zIndex: 9999 })
  };

  // --- DYNAMIC OPTIONS (SSO RESTRICTED) ---
  const workerTypeOptions = isSubCompanyRestricted
    ? [ { value: 'os', label: 'Outsourcing (OS)' } ]
    : [
        { value: 'all', label: 'Semua Karyawan (All)' },
        { value: 'tetap', label: 'Tetap / Kontrak' },
        { value: 'os', label: 'Outsourcing (OS)' }
      ];

  const subCompanyOptions = isSubCompanyRestricted
    ? subCompanies
        .filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id))
        .map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name }))
    : [
        { value: '', label: 'Semua Sub Company' },
        { value: 'TYPE_OS', label: 'Outsource' },
        { value: 'TYPE_VENDOR', label: 'Vendor/Kontraktor' },
        ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
      ];

  const departmentOptions = isDeptRestricted
    ? departments
        .filter(d => user.allowed_costcenters.includes(d.id))
        .map(d => ({ value: d.id, label: d.org_name }))
    : [
        { value: '', label: 'Semua Cost Center' },
        ...departments.map(d => ({ value: d.id, label: d.org_name })),
      ];

  const shiftOptions = [
    { value: '', label: 'Semua Shift' },
    { value: 'SHIFT 1', label: 'SHIFT 1' },
    { value: 'SHIFT 2', label: 'SHIFT 2' },
    { value: 'SHIFT 3', label: 'SHIFT 3' },
  ];

  return (
    <div>
      <PageHeader 
        title="Access Clocking Report" 
        searchPlaceholder="Cari ID Karyawan / Nama / Card Number ..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      >
        {/* Tombol Export di PageHeader seperti ReportAbsen */}
        <LoadingButton
          loading={isExporting}
          loadingText="Mengunduh..."
          className="btn btn-sm btn-success shadow-sm"
          style={{ height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}
          icon="bi bi-file-earmark-excel"
          onClick={handleExportExcel}
          disabled={isExporting || isFilterDirty}
        >
          Export Excel
        </LoadingButton>
      </PageHeader>

      <div className="app-card">
        
        {/* --- GRID CARD FILTER CONTAINER --- */}
        <div className="card border-0 bg-light p-3 mb-3 rounded-3 shadow-sm">
          <div className="row g-3 align-items-end">

            {/* --- BARIS 1 --- */}
            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-people me-1"></i> Tipe Karyawan
              </label>
              <Select 
                options={workerTypeOptions} 
                value={workerTypeOptions.find(o => o.value === workerType) || workerTypeOptions[0]} 
                onChange={o => handleFilterChange(setWorkerType, o?.value || 'all')} 
                isSearchable={false}
                isDisabled={isSubCompanyRestricted}
                menuPortalTarget={document.body}
                styles={compactSelectStyle}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-building me-1"></i> Sub Company
              </label>
              <Select
                options={subCompanyOptions}
                placeholder="Cari..."
                value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
                onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
                isClearable={!isSubCompanyRestricted}
                isSearchable
                menuPortalTarget={document.body}
                styles={compactSelectStyle}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-diagram-3 me-1"></i> Cost Center
              </label>
              <Select
                options={departmentOptions}
                placeholder="Cari Cost Center..."
                value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
                onChange={o => handleFilterChange(setDepartmentInput, o?.value || '')}
                isClearable={!isDeptRestricted}
                isSearchable
                menuPortalTarget={document.body}
                styles={compactSelectStyle}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-clock-history me-1"></i> Shift
              </label>
              <Select
                options={shiftOptions}
                placeholder="Pilih Shift..."
                value={shiftOptions.find(o => o.value === shiftInput) || shiftOptions[0]}
                onChange={o => handleFilterChange(setShiftInput, o?.value || '')}
                isClearable
                isSearchable={false}
                menuPortalTarget={document.body}
                styles={compactSelectStyle}
              />
            </div>

            {/* --- BARIS 2 --- */}
            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-calendar-event me-1"></i> Tanggal Mulai
              </label>
              <input 
                type="date" 
                className="form-control form-control-sm"
                style={{ height: '34px', fontSize: '0.8rem' }}
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-calendar-check me-1"></i> Sampai Tanggal
              </label>
              <input 
                type="date" 
                className="form-control form-control-sm"
                style={{ height: '34px', fontSize: '0.8rem' }}
                value={endDate}
                min={startDate}
                onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
              />
            </div>

            {/* Tombol Clear & Terapkan sejajar di kanan */}
            <div className="col-md-6 col-sm-12 d-flex justify-content-end align-items-end gap-2">
              {isFilterApplied && (
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary px-3" 
                  onClick={handleResetFilters}
                  style={{ height: '34px', fontSize: '0.8rem' }}
                >
                  <i className="bi bi-x-circle me-1" /> Clear
                </button>
              )}

              <LoadingButton
                loading={isApplyingFilter}
                loadingText="Memfilter..."
                className="btn btn-sm btn-primary px-3 shadow-sm"
                style={{ height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}
                icon="bi bi-funnel"
                onClick={handleApplyFilters}
              >
                Terapkan Filter
              </LoadingButton>
            </div>

          </div>
        </div>
        
        {/* --- DIRTY FILTER WARNING / DATATABLE --- */}
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> di pojok kanan bawah area filter untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <AccessReport_Table    
            workerType={appliedWorkerType}
            refreshTrigger={crud.refreshKey}
            subCompany={appliedSubCompany}
            department={appliedDepartment}
            shift={appliedShift}
            startDate={appliedStartDate}
            endDate={appliedEndDate}
            search={appliedSearch}
            isFilterApplied={isFilterApplied}
          />
        )}
      </div>
    </div>
  );
};

export default Report_Access;