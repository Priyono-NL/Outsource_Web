import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select'; 
import { saveAs } from 'file-saver';
import api from '../api/api';
import { Toast, Confirm } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import GuestForm from '../components/guest/GuestForm';
import GuestBulkForm from '../components/guest/GuestBulkForm';
import GuestTable from '../components/guest/GuestTable';

// =============================================================================
// SUB-COMPONENT: TOMBOL UPLOAD & DOWNLOAD TEMPLATE ALLOWLIST
// =============================================================================
const AllowlistUploadActions = ({ activePeriodeId, onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const { data } = await api.get('/guest/template-allowlist', { responseType: 'blob' });
      saveAs(data, 'Template_Allowlist_Puasa.xlsx');
    } catch (error) {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh template' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!activePeriodeId || activePeriodeId === 'all') {
      Toast.fire({ icon: 'warning', title: 'Pilih Kategori (Reguler atau Puasa) di Filter terlebih dahulu!' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('periode_id', activePeriodeId);

    try {
      const res = await api.post('/guest/upload-allowlist', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      const { status, message, errors } = res.data; 

      if (status === 'partial_success' || (status === 'error' && errors?.length)) {
        const errorsHtml = `<div style="text-align:left; max-height:100px; overflow-y:auto; background:#fff3f3; padding:10px; border-radius:5px; font-size:.85em; color:#d32f2f;">
                              <strong>Daftar Error (${errors.length}):</strong><br/>
                              ${errors.slice(0, 5).join('<br>')} ${errors.length > 5 ? '<br/><i>... (periksa data Anda)</i>' : ''}
                            </div>`;
        Confirm.fire({ 
          icon: status === 'partial_success' ? 'warning' : 'error', 
          title: 'Hasil Import', 
          html: `<p>${message}</p>${errorsHtml}`
        });
      } else {
        Toast.fire({ icon: 'success', title: message });
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onUploadSuccess) onUploadSuccess();
      
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.message || 'Terjadi kesalahan saat upload' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="d-flex gap-2">
      <LoadingButton
        loading={isDownloading}
        loadingText="..."
        className="btn-app btn-ghost-app"
        icon="bi bi-file-earmark-excel"
        onClick={handleDownloadTemplate}
        title="Download Template Excel Allowlist"
      >
        Template
      </LoadingButton>

      <input type="file" hidden ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" disabled={isUploading} />
      
      <LoadingButton
        loading={isUploading}
        loadingText="Upload..."
        className="btn-app btn-success-app"
        icon="bi bi-cloud-arrow-up"
        onClick={() => fileInputRef.current?.click()}
        title="Mass Upload Allowlist Puasa (Pastikan Filter Periode Dipilih)"
      >
        Upload Allowlist
      </LoadingButton>
    </div>
  );
};


// =============================================================================
// MAIN COMPONENT
// =============================================================================
const Guest = () => {
  const crud = useCrudPage();
  const { user } = useAuth();
  
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted       = user?.allowed_costcenters && user.allowed_costcenters.length > 0;
  
  const [showBulkForm, setShowBulkForm] = useState(false);

  // --- STATE FORM FILTER ---
  const [statusInput, setStatusInput]         = useState('all');
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [periodeInput, setPeriodeInput]       = useState('all'); // Filter baru untuk Puasa

  // --- STATE APPLIED FILTER ---
  const [appliedStatus, setAppliedStatus]         = useState('all');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedPeriode, setAppliedPeriode]       = useState('all'); // Terapan Filter Puasa

  // --- FLAG FILTER STATES ---
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDirty, setIsFilterDirty]     = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]); 
  const [departments, setDepartments]   = useState([]);
  const [periodePuasa, setPeriodePuasa] = useState([]); // Master Data Puasa

  useEffect(() => {
    const load = async () => {
      try {
        // [PERFORMANCE SLA] Hit 3 API master data secara concurrent (parallel)
        const [resSub, resDept, resPuasa] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
          api.get('/costcenter?page=1&pageSize=200'),
          api.get('/periode?page=1&pageSize=100')
        ]);
        
        const subData   = resSub.data.data || [];
        const deptData  = resDept.data.data || [];
        const puasaData = resPuasa.data.data || [];

        setSubCompanies(subData);
        setDepartments(deptData);
        setPeriodePuasa(puasaData);

        if (isSubCompanyRestricted && subData.length > 0) {
          const allowedSubList = subData.filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id));
          const defaultSub = allowedSubList.length > 0 ? allowedSubList[0].sub_company_id : subData[0].sub_company_id;
          setSubCompanyInput(defaultSub);
          setAppliedSubCompany(defaultSub);
        }

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
    crud.handleSearch();
    
    setAppliedStatus(statusInput);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
    setAppliedPeriode(periodeInput);

    setIsFilterApplied(true);
    setIsFilterDirty(false);

    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setStatusInput('all');
    setPeriodeInput('all');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    crud.setSearchInput('');

    setAppliedStatus('all');
    setAppliedPeriode('all');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');

    setIsFilterApplied(false);
    setIsFilterDirty(false);
  };

  // --- DYNAMIC OPTIONS ---
  const subCompanyOptions = isSubCompanyRestricted
    ? subCompanies
        .filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id))
        .map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name }))
    : [
        { value: '', label: 'Semua Sub Company' },
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

  const periodeOptions = [
    { value: 'all', label: 'Tampilkan Semua' },
    { value: 'reguler', label: 'Guest Reguler (Non-Puasa)' },
    ...periodePuasa.map(p => ({ value: p.periode_id, label: `Puasa: ${p.tahun} ` }))
  ];

  return (
    <div>
      <PageHeader
        title="Alokasi Kantin Periode Khusus (Exception List)"
        searchPlaceholder="Cari ID / Nama Karyawan..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      >
        {/* Fitur Upload Massal Allowlist Puasa */}
        {!crud.showForm && (
          <AllowlistUploadActions 
            activePeriodeId={periodeInput} 
            onUploadSuccess={crud.handleRefresh} 
          />
        )}

        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'} ms-2`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? (
            <><i className="bi bi-x" /> Tutup</>
          ) : (
            <><i className="bi bi-plus" /> Tambah 1 Karyawan</>
          )}
        </button>

        {!crud.showForm && (
          <button className="btn-app btn-secondary-app ms-2" onClick={() => setShowBulkForm(true)}>
            <i className="bi bi-people-fill me-1" /> Tambah Massal Guest
          </button>
        )}
      </PageHeader>

      {crud.showForm && (
        <GuestForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
          periodePuasaList={periodePuasa}
        />
      )}

      {showBulkForm && (
        <GuestBulkForm
          onClose={() => setShowBulkForm(false)}
          onSuccess={crud.handleRefresh}
          periodePuasaList={periodePuasa}
        />
      )}

      <div className="app-card">
        <div className="filter-bar d-flex flex-wrap gap-3 mb-3 align-items-end">
          
          <div className="filter-group m-0" style={{ minWidth: 140 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Kategori & Periode</label>
            <Select
              options={periodeOptions}
              value={periodeOptions.find(o => o.value === periodeInput) || periodeOptions[0]}
              onChange={o => handleFilterChange(setPeriodeInput, o?.value || 'all')}
              menuPortalTarget={document.body} 
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 }) // Paksa z-index maksimal
              }}
            />
          </div>

          <div className="filter-group m-0">
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Status</label>
            <select 
              className="form-select-app" style={{ height: 34, fontSize: 13 }}
              value={statusInput} onChange={e => handleFilterChange(setStatusInput, e.target.value)}
            >
              <option value="all">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="filter-group m-0" style={{ minWidth: 180 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Sub Company</label>
            <Select
              options={subCompanyOptions} placeholder="Cari Subcompany..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable={!isSubCompanyRestricted} isSearchable
              menuPortalTarget={document.body} 
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 }) // Paksa z-index maksimal
              }}
            />
          </div>

          <div className="filter-group m-0" style={{ minWidth: 180 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Cost Center</label>
            <Select
              options={departmentOptions} placeholder="Cari Cost Center..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => handleFilterChange(setDepartmentInput, o?.value || '')}
              isClearable={!isDeptRestricted} isSearchable
              menuPortalTarget={document.body} 
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 }) // Paksa z-index maksimal
              }}
            />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {isFilterApplied && (
              <button type="button" className="btn-app btn-ghost-app" onClick={handleResetFilters}>
                <i className="bi bi-x-circle me-1" /> Clear Filter
              </button>
            )}
            <LoadingButton
              loading={isApplyingFilter} loadingText="Memfilter..."
              className="btn-app btn-primary-app" icon="bi bi-funnel" onClick={handleApplyFilters}
            >
              Terapkan Filter
            </LoadingButton>
          </div>
          
        </div>

        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <GuestTable
            refreshTrigger={crud.refreshKey}
            onEditClick={crud.handleEdit}
            searchTerm={crud.appliedSearch}
            filterTerm={appliedStatus}
            subCompanyFilter={appliedSubCompany}
            departmentFilter={appliedDepartment}
            periodePuasaFilter={appliedPeriode} // Lempar filter ke Tabel
            isFilterApplied={isFilterApplied}
          />
        )}

      </div>
    </div>
  );
};

export default Guest;