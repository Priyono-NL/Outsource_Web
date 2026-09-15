import React, { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';
import { Toast } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import AbsensiReportTable from '../components/absensi_all/AbsensiReportTable';

const ReportAbsen = () => {
  const getFirstDayOfMonth = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  };

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const crud = useCrudPage();
  const { user } = useAuth();

  // Flag Pembatasan Hak Akses SSO
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted       = user?.allowed_costcenters && user.allowed_costcenters.length > 0;

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);

  // --- STATE FORM FILTER (DRAFT) ---
  const [workerType, setWorkerType]             = useState(isSubCompanyRestricted ? 'os' : 'all');
  const [statusFilter, setStatusFilter]         = useState('all_data');
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [departmentInput, setDepartmentInput]   = useState('');
  const [startDate, setStartDate]               = useState(getFirstDayOfMonth());
  const [endDate, setEndDate]                   = useState(getTodayString());

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedWorkerType, setAppliedWorkerType]     = useState(isSubCompanyRestricted ? 'os' : 'all');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('all_data');
  const [appliedSubCompany, setAppliedSubCompany]     = useState('');
  const [appliedDepartment, setAppliedDepartment]     = useState('');
  const [appliedStartDate, setAppliedStartDate]       = useState(getFirstDayOfMonth());
  const [appliedEndDate, setAppliedEndDate]           = useState(getTodayString());

  // --- FLAG FILTER STATES ---
  const [isFilterApplied, setIsFilterApplied] = useState(true);
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

        // Auto-select Subcompany jika user dibatasi SSO
        if (isSubCompanyRestricted && subData.length > 0) {
          const allowedSubList = subData.filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id));
          const defaultSub = allowedSubList.length > 0 ? allowedSubList[0].sub_company_id : subData[0].sub_company_id;
          setSubCompanyInput(defaultSub);
          setAppliedSubCompany(defaultSub);
          setWorkerType('os');
          setAppliedWorkerType('os');
        }

        // Auto-select Department jika user dibatasi SSO
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
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
    setAppliedStatusFilter(statusFilter);
    setAppliedWorkerType(workerType);

    setIsFilterApplied(true);
    setIsFilterDirty(false);

    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setWorkerType(isSubCompanyRestricted ? 'os' : 'all');
    setStatusFilter('all_data');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    setStartDate(getFirstDayOfMonth());
    setEndDate(getTodayString());
    crud.setSearchInput('');

    setAppliedWorkerType(isSubCompanyRestricted ? 'os' : 'all');
    setAppliedStatusFilter('all_data');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');
    setAppliedStartDate(getFirstDayOfMonth());
    setAppliedEndDate(getTodayString());

    setIsFilterApplied(false);
    setIsFilterDirty(false);
  };

  const handleExport = async () => {
    if (isFilterDirty) {
      Toast.fire({ icon: 'warning', title: 'Terapkan filter yang baru diubah sebelum mengeksport data.' });
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        search: crud.appliedSearch || '',
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
        status_filter: appliedStatusFilter || 'all_data',
        worker_type: appliedWorkerType || 'all'
      }).toString();
      
      const res = await api.get(`/absensi/export?${params}`, { responseType: 'blob' });
      
      const fileName = `Absensi_${appliedWorkerType.toUpperCase()}_Filtered.xlsx`;
      saveAs(res.data, fileName);
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    } finally {
      setIsExporting(false);
    }
  };

  // --- DYNAMIC OPTIONS (SSO RESTRICTED) ---
  const workerTypeOptions = isSubCompanyRestricted
    ? [
        { value: 'os', label: 'Outsourcing (OS)' }
      ]
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
        { value: '', label: 'Semua Department' },
        ...departments.map(d => ({ value: d.id, label: d.org_name })),
      ];

  const statusOptions = [
    { value: 'all_data', label: 'Semua Data Absensi' },
    { value: 'lengkap', label: 'Data Lengkap' },
    { value: 'anomali', label: 'Semua Pelanggaran (Violation)' },
    { value: 'no_in', label: 'Clock In Kosong' },
    { value: 'no_out', label: 'Clock Out Kosong' },
    { value: 'no_both', label: 'Clock In & Out Kosong' }
  ];

  const compactSelectStyle = {
    control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
    menuPortal: base => ({ ...base, zIndex: 9999 })
  };

  return (
    <div>
      <PageHeader
        title="Report Absensi Employee"
        searchPlaceholder="Cari ID Karyawan / Nama ..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      >
        <LoadingButton
          loading={isExporting}
          loadingText="Mengeksport..."
          className="btn-app btn-success-app"
          icon="bi bi-file-earmark-excel"
          onClick={handleExport}
          disabled={isFilterDirty}
        >
          Export
        </LoadingButton>        
      </PageHeader>

      <div className="app-card">
        {/* --- FILTER BAR CONTAINER --- */}
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3">

          {/* Filter Tipe Karyawan */}
          <div className="filter-group m-0" style={{ minWidth: 160, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Tipe Karyawan</label>
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

          {/* Violation Status Filter */}
          <div className="filter-group m-0" style={{ minWidth: 200, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Violation Status</label>
            <Select 
              options={statusOptions} 
              value={statusOptions.find(o => o.value === statusFilter)} 
              onChange={o => handleFilterChange(setStatusFilter, o?.value || 'all_data')} 
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
          </div>

          {/* Sub Company Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Sub Company</label>
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

          {/* Department / Cost Center Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => handleFilterChange(setDepartmentInput, o?.value || '')}
              isClearable={!isDeptRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
          </div>

          {/* Date Range Filters */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div className="filter-group m-0">
              <label style={{ fontSize: 13, display: 'block', marginBottom: '4px' }}>Dari Tanggal</label>
              <input 
                type="date" 
                className="form-control-app"
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                style={{ fontSize: 13, height: 34, width: '130px' }}
              />
            </div>

            <span style={{ paddingBottom: '6px', fontSize: 14, fontWeight: 'bold' }}>-</span>

            <div className="filter-group m-0">
              <label style={{ fontSize: 13, display: 'block', marginBottom: '4px' }}>Sampai Tanggal</label>
              <input 
                type="date" 
                className="form-control-app"
                value={endDate}
                onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                min={startDate}
                style={{ fontSize: 13, height: 34, width: '130px' }}
              />
            </div>
          </div>

          {/* Filter Action Buttons */}
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
            {isFilterApplied && (
              <button 
                type="button" 
                className="btn-app btn-ghost-app" 
                style={{ height: '34px', fontSize: '13px' }}
                onClick={handleResetFilters}
              >
                <i className="bi bi-x-circle me-1" /> Clear Filter
              </button>
            )}

            <LoadingButton
              loading={isApplyingFilter}
              loadingText="Memfilter..."
              className="btn-app btn-primary-app"
              style={{ height: '34px', fontSize: '13px', display: 'flex', alignItems: 'center' }}
              icon="bi bi-funnel"
              onClick={handleApplyFilters}
            >
              Terapkan Filter
            </LoadingButton>
          </div>

        </div>
        
        {/* --- DIRTY FILTER WARNING / DATATABLE --- */}
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> di pojok kanan atas untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <AbsensiReportTable
            workerType={appliedWorkerType}
            refreshTrigger={crud.refreshKey}
            searchTerm={crud.appliedSearch}
            subCompany={appliedSubCompany}
            department={appliedDepartment}
            startDate={appliedStartDate}
            endDate={appliedEndDate}
            statusFilter={appliedStatusFilter}
          />
        )}
      </div>

    </div>
  );
};

export default ReportAbsen;