import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { saveAs } from 'file-saver';
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import { Toast } from '../utils/sweetalert';
import { useAuth } from '../utils/useAuth';

// Import Komponen Modular
import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
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
  const { user } = useAuth();

  // Flag Pembatasan Hak Akses SSO
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted       = user?.allowed_costcenters && user.allowed_costcenters.length > 0;

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);
  const [isMasterLoaded, setIsMasterLoaded] = useState(false); // Penanda Master Data & SSO siap

  // --- STATE FORM FILTER (DRAFT) ---
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [startDate, setStartDate]             = useState(todayStr);
  const [endDate, setEndDate]                 = useState(todayStr);

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedStartDate, setAppliedStartDate]   = useState(todayStr);
  const [appliedEndDate, setAppliedEndDate]       = useState(todayStr);

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
        }

        // Auto-select Department jika user dibatasi SSO (Gunakan Cost Center Code)
        if (isDeptRestricted && deptData.length > 0) {
          const allowedDeptList = deptData.filter(d => user.allowed_costcenters.includes(d.id));
          const defaultDeptObj = allowedDeptList.length > 0 ? allowedDeptList[0] : deptData[0];
          const defaultDept = defaultDeptObj.cost_center || defaultDeptObj.id;
          setDepartmentInput(defaultDept);
          setAppliedDepartment(defaultDept);
        }

      } catch { 
        /* silent error handling */ 
      } finally {
        setIsMasterLoaded(true); // Membuka kuncian render tabel setelah SSO terapan siap
      }
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
    
    setIsFilterApplied(true);
    setIsFilterDirty(false);

    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    setStartDate(todayStr);
    setEndDate(todayStr);
    crud.setSearchInput('');

    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');
    setAppliedStartDate(todayStr);
    setAppliedEndDate(todayStr);

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

  // FIX: Menggunakan cost_center sebagai value agar cocok dengan kueri backend
  const departmentOptions = isDeptRestricted
    ? departments
        .filter(d => user.allowed_costcenters.includes(d.id))
        .map(d => ({ value: d.cost_center || d.id, label: d.org_name }))
    : [
        { value: '', label: 'Semua Department' },
        ...departments.map(d => ({ value: d.cost_center || d.id, label: d.org_name })),
      ];

  return (
    <div>
      <PageHeader title="Working Hours Report" />

      <div className="app-card">
        {/* --- FILTER BAR CONTAINER --- */}
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3">

          {/* Filter Sub Company */}
          <div className="filter-group m-0" style={{ minWidth: 160, flex: 1 }}>
            <label className="fw-semibold mb-1" style={{ fontSize: 13, display: 'block' }}>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari Subcompany..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable={!isSubCompanyRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
          </div>

          {/* Filter Department */}
          <div className="filter-group m-0" style={{ minWidth: 180, flex: 1 }}>
            <label className="fw-semibold mb-1" style={{ fontSize: 13, display: 'block' }}>Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari Department..."
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
              <label className="fw-semibold mb-1" style={{ fontSize: 13, display: 'block' }}>Tanggal Mulai</label>
              <input 
                type="date" 
                className="form-control-app"
                style={{ height: '34px', fontSize: '13px', width: '130px' }}
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
              />
            </div>

            <span style={{ paddingBottom: '6px', fontSize: 14, fontWeight: 'bold' }}>-</span>

            <div className="filter-group m-0">
              <label className="fw-semibold mb-1" style={{ fontSize: 13, display: 'block' }}>Sampai</label>
              <input 
                type="date" 
                className="form-control-app"
                style={{ height: '34px', fontSize: '13px', width: '130px' }}
                value={endDate}
                min={startDate}
                onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
              />
            </div>
          </div>

          {/* Group Tombol Aksi */}
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }} className="d-flex gap-2">
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

            <LoadingButton
              loading={isExporting}
              loadingText="Mengunduh..."
              className="btn-app btn-success-app"
              style={{ height: '34px', fontSize: '13px', display: 'flex', alignItems: 'center' }}
              icon="bi bi-file-earmark-excel"
              onClick={handleExportExcel}
              disabled={isExporting || isFilterDirty}
            >
              Export Excel
            </LoadingButton>
          </div>

        </div>
        
        {/* --- DIRTY FILTER WARNING / DATATABLE --- */}
        {!isMasterLoaded ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2 text-muted" style={{ fontSize: 13 }}>Menyiapkan parameter akses...</p>
          </div>
        ) : isFilterDirty ? (
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