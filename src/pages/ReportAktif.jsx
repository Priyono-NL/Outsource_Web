import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { saveAs } from 'file-saver';
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import { Toast } from '../utils/sweetalert'; // Pastikan ini di-import jika dipakai

// Import Komponen Modular
import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import ReportAktif_Table from '../components/employment/ReportAktif'; // Pastikan path benar

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

  // Form Filter States
  const [statusInput, setStatusInput]           = useState('active'); // Default ke active agar filter tanggal logis
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [departmentInput, setDepartmentInput]   = useState('');
  const [targetDateInput, setTargetDateInput]   = useState(todayStr);
  
  // Applied Filter States
  const [appliedStatus, setAppliedStatus]       = useState('active');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedTargetDate, setAppliedTargetDate] = useState(todayStr);

  // Flag Status Filter Terapan
  const [isFilterApplied, setIsFilterApplied]   = useState(false);
  const [isFilterDirty, setIsFilterDirty]       = useState(false); // Opsional: untuk reset tabel saat mengetik filter

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
        setSubCompanies(resSub.data.data);
        setDepartments(resDept.data.data);
      } catch { /* silent */ }
    };
    load();
  }, []);

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
    setSubCompanyInput('');
    setDepartmentInput('');
    setTargetDateInput(todayStr);
    crud.setSearchInput('');
    
    setAppliedStatus('active');
    setAppliedSubCompany('');
    setAppliedDepartment('');
    setAppliedTargetDate(todayStr);
    setIsFilterApplied(false); 
  };

  const handleExport = async () => {
    if (!isFilterApplied) {
      Toast.fire({ icon: 'warning', title: 'Terapkan filter terlebih dahulu untuk mengeksport data.' });
      return;
    }
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        search: crud.appliedSearch || '',
        status: appliedStatus || 'active',
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
        target_date: appliedTargetDate || '', // Kirim target date
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

  const subCompanyOptions = [
    { value: '', label: 'Semua Sub Company' },
    ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
  ];
  
  const departmentOptions = [
    { value: '', label: 'Semua Department' },
    ...departments.map(d => ({ value: d.cost_center, label: d.org_name })),
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

          <div className="filter-group" style={{ minWidth: 180, flex: 1 }}>
            <label className="fw-semibold mb-1">Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => { setSubCompanyInput(o?.value || ''); setIsFilterDirty(true); }}
              isClearable isSearchable
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
              onChange={o => { setDepartmentInput(o?.value || ''); setIsFilterDirty(true); }}
              isClearable isSearchable
              menuPortalTarget={document.body}
              styles={compactSelectStyle}
            />
          </div>

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
            filterTargetDate={appliedTargetDate} // PROPS BARU
            isFilterApplied={isFilterApplied}
          />
        )}
      </div>
    </div>
  );
};

export default ReportAktif;