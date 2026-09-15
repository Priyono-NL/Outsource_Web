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
import ReportAktif_Table from '../components/employment/ReportAktif';

const ReportAktif = () => {
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

  // Form Filter States (Draft)
  const [statusInput, setStatusInput]           = useState('active');
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [departmentInput, setDepartmentInput]   = useState('');
  const [targetDateInput, setTargetDateInput]   = useState(todayStr);
  
  // Applied Filter States (Terapan)
  const [appliedStatus, setAppliedStatus]         = useState('active');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedTargetDate, setAppliedTargetDate] = useState(todayStr);

  // Flag Status Filter Terapan
  const [isFilterApplied, setIsFilterApplied]   = useState(false);
  const [isFilterDirty, setIsFilterDirty]       = useState(false);

  // Master Data States
  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);

  // Loading States Per Action
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

  const handleApplyFilters = () => {
    setIsApplyingFilter(true);
    crud.handleSearch();

    setAppliedStatus(statusInput);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
    setAppliedTargetDate(targetDateInput);
    
    setIsFilterApplied(true); 
    setIsFilterDirty(false);
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setStatusInput('active');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    setTargetDateInput(todayStr);
    crud.setSearchInput('');
    
    setAppliedStatus('active');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');
    setAppliedTargetDate(todayStr);
    
    setIsFilterApplied(false); 
    setIsFilterDirty(false);
  };

  const handleExport = async () => {
    if (!isFilterApplied) {
      Toast.fire({ icon: 'warning', title: 'Terapkan filter terlebih dahulu untuk mengeksport data.' });
      return;
    }
    if (isFilterDirty) {
      Toast.fire({ icon: 'warning', title: 'Terapkan filter yang baru diubah sebelum mengeksport data.' });
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        search: crud.appliedSearch || '',
        status: appliedStatus || 'active',
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
        target_date: appliedTargetDate || '',
      }).toString();
      
      const res = await api.get(`/employee/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, `Data_OS_Aktif_${appliedTargetDate}.xlsx`);
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    } finally {
      setIsExporting(false);
    }
  };

  const compactSelectStyle = {
    control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
    menuPortal: base => ({ ...base, zIndex: 9999 })
  };

  // Dynamic Options (SSO Restricted)
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

  return (
    <div>
      <PageHeader
        title="Data Karyawan Aktif"
        searchPlaceholder="Cari ID / Nama / Card Number..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      >
        <LoadingButton
          loading={isExporting}
          loadingText="Exporting..."
          className="btn-app btn-success-app"
          icon="bi bi-file-earmark-excel"
          onClick={handleExport}
          disabled={!isFilterApplied || isFilterDirty}
        >
          Eksport Excel
        </LoadingButton>
      </PageHeader>

      <div className="app-card">
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3">

          {/* Filter Tanggal Aktif */}
          <div className="filter-group" style={{ minWidth: 150 }}>
            <label className="fw-semibold mb-1">Aktif Per Tanggal</label>
            <input 
              type="date" 
              className="form-control-app"
              style={{ height: '34px', fontSize: '13px', padding: '4px 8px' }}
              value={targetDateInput}
              onChange={(e) => {
                setTargetDateInput(e.target.value);
                setIsFilterDirty(true);
              }}
            />
          </div>

          {/* Sub Company Filter */}
          <div className="filter-group" style={{ minWidth: 180, flex: 1 }}>
            <label className="fw-semibold mb-1">Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => { setSubCompanyInput(o?.value || ''); setIsFilterDirty(true); }}
              isClearable={!isSubCompanyRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
          </div>

          {/* Department / Cost Center Filter */}
          <div className="filter-group" style={{ minWidth: 180, flex: 1 }}>
            <label className="fw-semibold mb-1">Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => { setDepartmentInput(o?.value || ''); setIsFilterDirty(true); }}
              isClearable={!isDeptRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
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
              style={{ height: '34px', fontSize: '13px' }}
              icon="bi bi-funnel"
              onClick={handleApplyFilters}
            >
              Terapkan Filter
            </LoadingButton>
          </div>
        </div>
        
        {/* Dirty Filter Warning */}
        {isFilterDirty && isFilterApplied ? (
           <div className="alert alert-warning text-center mt-3 py-3" style={{ borderStyle: 'dashed' }}>
             <i className="bi bi-exclamation-triangle text-warning fs-5 me-2"></i>
             Filter diubah. Klik <b>Terapkan Filter</b> untuk memuat ulang data.
           </div>
        ) : (
          <ReportAktif_Table
            refreshTrigger={crud.refreshKey}
            searchTerm={crud.appliedSearch}
            filterSubCompany={appliedSubCompany}
            filterDepartment={appliedDepartment}
            filterTargetDate={appliedTargetDate}
            isFilterApplied={isFilterApplied}
          />
        )}
      </div>
    </div>
  );
};

export default ReportAktif;