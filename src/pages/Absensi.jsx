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

  const [editData, setEditData] = useState(null);

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);

  // --- STATE FORM FILTER (DRAFT) ---
  const [statusFilter, setStatusFilter]         = useState('all_data');
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [departmentInput, setDepartmentInput]   = useState('');
  const [startDate, setStartDate]               = useState(getFirstDayOfMonth());
  const [endDate, setEndDate]                   = useState(getTodayString());

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('all_data');
  const [appliedSubCompany, setAppliedSubCompany]     = useState('');
  const [appliedDepartment, setAppliedDepartment]     = useState('');
  const [appliedStartDate, setAppliedStartDate]       = useState(getFirstDayOfMonth());
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
    
    setIsFilterApplied(true);
    setIsFilterDirty(false);
    
    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setStatusFilter('all_data');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    setStartDate(getFirstDayOfMonth());
    setEndDate(getTodayString());
    crud.setSearchInput('');

    setAppliedStatusFilter('all_data');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');
    setAppliedStartDate(getFirstDayOfMonth());
    setAppliedEndDate(getTodayString());

    setIsFilterApplied(false);
    setIsFilterDirty(false);
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
        status_filter: appliedStatusFilter || 'all_data'
      }).toString();

      const res = await api.get(`/absensi/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, 'Absensi_OS_Filtered.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    // 1. Validasi UX: Minta user apply filter dulu jika ada perubahan yang belum di-apply
    if (isFilterDirty) {
      Toast.fire({ icon: 'warning', title: 'Terapkan filter yang baru diubah sebelum mengunduh template.' });
      return;
    }

    setIsDownloadingTemplate(true);
    try {
      // 2. Susun Parameter LENGKAP menggunakan state 'applied' agar sinkron dengan tabel
      const params = {
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
        search: crud.appliedSearch || '',
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
        // status_filter tidak perlu dikirim karena backend sudah mem-force 'template_revisi'
      };

      // 3. Tembak API dengan parameter lengkap
      const { data } = await api.get('/absensi/template', { 
        params: params,
        responseType: 'blob' 
      });
      
      saveAs(data, `Template_Mass_Update_${appliedStartDate}_to_${appliedEndDate}.xlsx`);
    } catch (error) {
      // Parsing pesan error dari Blob JSON jika ada
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
          Import
        </LoadingButton>

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

      {crud.showForm && <AbsensiForm onClose={handleCloseForm} onSuccess={crud.handleRefresh} initialData={editData} />}

      <div className="app-card">

        {/* --- FILTER BAR CONTAINER --- */}
        <div className="filter-bar d-flex flex-wrap gap-3 align-items-end mb-3">

          {/* Violation Status Filter */}
          <div className="filter-group m-0" style={{ minWidth: 200, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Violation Status</label>
            <Select 
              options={statusOptions} 
              value={statusOptions.find(o => o.value === statusFilter)} 
              onChange={o => handleFilterChange(setStatusFilter, o?.value || 'all_data')} 
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          {/* Sub Company Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari Subcompany..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable={!isSubCompanyRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          {/* Department / Cost Center Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari Department..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => handleFilterChange(setDepartmentInput, o?.value || '')}
              isClearable={!isDeptRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
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
          />
        )}
      </div>

    </div>
  );
};

export default Absensi;