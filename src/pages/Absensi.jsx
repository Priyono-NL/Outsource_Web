import React, { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';
import { Toast, Confirm } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import AbsensiTable from '../components/absensi_all/AbsensiTable';
import AbsensiForm from '../components/absensi_all/AbsensiForm';

const Absensi = () => {
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

  const [editData, setEditData] = useState(null);

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);

  // --- STATE FORM FILTER (DRAFT) ---
  const [statusFilter, setStatusFilter]         = useState('all_data');
  const [shiftFilter, setShiftFilter]           = useState('');
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [departmentInput, setDepartmentInput]   = useState('');
  const [startDate, setStartDate]               = useState(getTodayString());
  const [endDate, setEndDate]                   = useState(getTodayString());

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('all_data');
  const [appliedShiftFilter, setAppliedShiftFilter]   = useState('');
  const [appliedSubCompany, setAppliedSubCompany]     = useState('');
  const [appliedDepartment, setAppliedDepartment]     = useState('');
  const [appliedStartDate, setAppliedStartDate]       = useState(getTodayString());
  const [appliedEndDate, setAppliedEndDate]           = useState(getTodayString());

  // --- FLAG FILTER STATES ---
  const [isFilterApplied, setIsFilterApplied] = useState(true);
  const [isFilterDirty, setIsFilterDirty]     = useState(false);

  // --- ACTION LOADING STATES ---
  const [isUploading, setIsUploading]             = useState(false);
  const [isExporting, setIsExporting]             = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter]   = useState(false);

  const fileInputRef = useRef(null);

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
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
    setAppliedStatusFilter(statusFilter);
    setAppliedShiftFilter(shiftFilter);
    
    setIsFilterApplied(true);
    setIsFilterDirty(false);
    
    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setStatusFilter('all_data');
    setShiftFilter('');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    setStartDate(getTodayString());
    setEndDate(getTodayString());
    crud.setSearchInput('');

    setAppliedStatusFilter('all_data');
    setAppliedShiftFilter('');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');
    setAppliedStartDate(getTodayString());
    setAppliedEndDate(getTodayString());

    setIsFilterApplied(false);
    setIsFilterDirty(false);
  };

  const handleCreateNew = () => {
    setEditData(null);
    crud.handleAdd();
  };

  const handleEdit = (data) => {
    setEditData(data);
    crud.handleAdd();
  };

  const handleCloseForm = () => {
    setEditData(null);
    crud.handleClose();
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
        shift: appliedShiftFilter || ''
      }).toString();

      const res = await api.get(`/absensi/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, `Absensi_OS_Filtered_${appliedStartDate}_to_${appliedEndDate}.xlsx`);
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (isFilterDirty) {
      Toast.fire({ icon: 'warning', title: 'Terapkan filter yang baru diubah sebelum mengunduh template.' });
      return;
    }

    setIsDownloadingTemplate(true);
    try {
      const params = {
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
        search: crud.appliedSearch || '',
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
      };

      const { data } = await api.get('/absensi/template', { 
        params: params,
        responseType: 'blob' 
      });
      
      saveAs(data, `Template_Mass_Update_${appliedStartDate}_to_${appliedEndDate}.xlsx`);
    } catch (error) {
      if (error.response && error.response.data && error.response.data.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = () => {
          const errData = JSON.parse(reader.result);
          Toast.fire({ icon: 'error', title: 'Gagal', text: errData.message });
        };
        reader.readAsText(error.response.data);
      } else {
        Toast.fire({ icon: 'error', title: 'Gagal mengunduh template Excel' });
      }
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.post('/absensi/upload', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      const { status, message, errors } = res.data;
      if (status === 'partial_success') {
        Confirm.fire({ 
          icon: 'warning', 
          title: 'Import Selesai dengan Catatan', 
          html: `<p>${message}</p><div style="text-align:left;max-height:200px;overflow-y:auto;background:#f8f9fa;padding:10px;font-size:.85em">${errors.join('<br>')}</div>`, 
          confirmButtonText: 'Tutup', 
          showCancelButton: false 
        });
      } else {
        Toast.fire({ icon: 'success', title: message });
      }
      crud.handleRefresh();
    } catch (error) {
      const errList = error.response?.data?.errors;
      if (errList?.length) {
        Confirm.fire({ 
          icon: 'error', 
          title: 'Gagal Import', 
          html: `<div style="text-align:left;max-height:200px;overflow-y:auto;font-size:.85em">${errList.join('<br>')}</div>`, 
          confirmButtonText: 'Perbaiki Excel' 
        });
      } else {
        Toast.fire({ icon: 'error', title: error.response?.data?.message || 'Terjadi kesalahan saat upload' });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // --- DYNAMIC OPTIONS ---
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
    { value: 'all_data', label: 'Semua Status Absensi' },
    { value: 'lengkap', label: 'Data Lengkap' },
    { value: 'anomali', label: 'Semua Pelanggaran (Violation)' },
    { value: 'no_in', label: 'Clock In Kosong' },
    { value: 'no_out', label: 'Clock Out Kosong' },
    { value: 'no_both', label: 'Clock In & Out Kosong' }
  ];

  const shiftOptions = [
    { value: '', label: 'Semua Shift' },
    { value: 'SHIFT 1', label: 'SHIFT 1' },
    { value: 'SHIFT 2', label: 'SHIFT 2' },
    { value: 'SHIFT 3', label: 'SHIFT 3' }
  ];

  return (
    <div>
      <PageHeader
        title="BAC Absensi OS"
        searchPlaceholder="Cari ID Karyawan / Nama..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      >      
        <LoadingButton
          loading={isDownloadingTemplate}
          loadingText="Menyiapkan..."
          className="btn-app btn-ghost-app"
          icon="bi bi-download"
          onClick={handleDownloadTemplate}
        >
          Template
        </LoadingButton>

        <input 
          type="file" 
          hidden 
          ref={fileInputRef} 
          onChange={handleImport} 
          accept=".xlsx,.xls" 
          disabled={isUploading} 
        />
        <LoadingButton
          loading={isUploading}
          loadingText="Proses..."
          className="btn-app btn-ghost-app"
          icon="bi bi-upload"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload
        </LoadingButton>

        <button
          type="button"
          className="btn-app btn-primary-app shadow-sm"
          onClick={handleCreateNew}
        >
          <i className="bi bi-plus-circle me-1" />
          Tambah BAC
        </button>

      </PageHeader>

      {crud.showForm && <AbsensiForm onClose={handleCloseForm} onSuccess={crud.handleRefresh} initialData={editData} />}

      <div className="app-card">

        {/* --- RAPI: GRID CARD FILTER CONTAINER --- */}
        <div className="card border-0 bg-light p-3 mb-3 rounded-3 shadow-sm">
          <div className="row g-2 align-items-end">

            {/* Row 1: Dropdown Filters */}
            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-shield-exclamation me-1"></i> Violation Status
              </label>
              <Select 
                options={statusOptions} 
                value={statusOptions.find(o => o.value === statusFilter)} 
                onChange={o => handleFilterChange(setStatusFilter, o?.value || 'all_data')} 
                menuPortalTarget={document.body}
                styles={{ 
                  control: b => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: base => ({ ...base, zIndex: 9999 })
                }}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-clock-history me-1"></i> Shift Kerja
              </label>
              <Select 
                options={shiftOptions} 
                value={shiftOptions.find(o => o.value === shiftFilter) || shiftOptions[0]} 
                onChange={o => handleFilterChange(setShiftFilter, o?.value || '')} 
                menuPortalTarget={document.body}
                styles={{ 
                  control: b => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: base => ({ ...base, zIndex: 9999 })
                }}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-building me-1"></i> Sub Company
              </label>
              <Select
                options={subCompanyOptions}
                placeholder="Cari Subcompany..."
                value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
                onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
                isClearable={!isSubCompanyRestricted}
                isSearchable
                menuPortalTarget={document.body}
                styles={{ 
                  control: b => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: base => ({ ...base, zIndex: 9999 })
                }}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-diagram-3 me-1"></i> Cost Center
              </label>
              <Select
                options={departmentOptions}
                placeholder="Cari Department..."
                value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
                onChange={o => handleFilterChange(setDepartmentInput, o?.value || '')}
                isClearable={!isDeptRestricted}
                isSearchable
                menuPortalTarget={document.body}
                styles={{ 
                  control: b => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: base => ({ ...base, zIndex: 9999 })
                }}
              />
            </div>

            {/* Row 2: Date Range & Action Buttons */}
            <div className="col-md-3 col-sm-6 mt-2">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-calendar-event me-1"></i> Dari Tanggal
              </label>
              <input 
                type="date" 
                className="form-control form-control-sm"
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                style={{ fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <div className="col-md-3 col-sm-6 mt-2">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-calendar-check me-1"></i> Sampai Tanggal
              </label>
              <input 
                type="date" 
                className="form-control form-control-sm"
                value={endDate}
                onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                min={startDate}
                style={{ fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <div className="col-md-6 col-sm-12 d-flex justify-content-end align-items-center gap-2 mt-3">
              {isFilterApplied && (
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary px-3" 
                  onClick={handleResetFilters}
                  style={{ height: '34px', fontSize: '0.8rem' }}
                >
                  <i className="bi bi-x-circle me-1" /> Clear Filter
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
        
        {/* WARNING DIRTY FILTER / DATATABLE */}
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-2 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '13px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <AbsensiTable
            refreshTrigger={crud.refreshKey}
            onEditClick={handleEdit} 
            searchTerm={crud.appliedSearch}
            subCompany={appliedSubCompany}
            department={appliedDepartment}
            startDate={appliedStartDate}
            endDate={appliedEndDate}
            statusFilter={appliedStatusFilter}
            shiftFilter={appliedShiftFilter}
            isFilterApplied={isFilterApplied}
          />
        )}
      </div>

    </div>
  );
};

export default Absensi;