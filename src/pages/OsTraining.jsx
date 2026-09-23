import React, { useRef, useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select'; 
import { Toast, Confirm } from '../utils/sweetalert';
import { downloadLogFile } from '../utils/logDownloader';
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import OsTrainingForm from '../components/osTraining/OsTrainingForm';
import OsTrainingTable from '../components/osTraining/OsTrainingTable';

const OsTraining = () => {
  const crud = useCrudPage();
  const { user } = useAuth();
  
  // Flag Pembatasan Hak Akses SSO
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted       = user?.allowed_costcenters && user.allowed_costcenters.length > 0;

  // --- STATE FORM FILTER (DRAFT) ---
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');

  // --- FLAG FILTER STATES ---
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDirty, setIsFilterDirty]     = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]); 
  const [departments, setDepartments]   = useState([]);

  // --- ACTION LOADING STATES ---
  const [isUploading, setIsUploading]             = useState(false);
  const [isExporting, setIsExporting]             = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

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
    crud.handleSearch();
    
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);

    setIsFilterApplied(true);
    setIsFilterDirty(false);

    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    crud.setSearchInput('');

    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');

    setIsFilterApplied(false);
    setIsFilterDirty(false);
  };

  // --- DYNAMIC OPTIONS (SSO RESTRICTED) ---
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
        { value: '', label: 'Semua Cost Center' },
        ...departments.map(d => ({ value: d.id, label: d.org_name })),
      ];

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
        subcompany: appliedSubCompany || '',
        department: appliedDepartment || ''
      }).toString();
      
      const res = await api.get(`/ostraining/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, 'Export_OS_Training.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal export data' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const { data } = await api.get('/ostraining/template', { responseType: 'blob' });
      saveAs(data, 'Template_Import_Training.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal download template' });
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
      const res = await api.post('/ostraining/upload', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });

      const { status, message, errors = [], notes = [] } = res.data; 

      const notesHtml = notes.length > 0 
        ? `<div style="text-align:left; margin-top:10px; max-height:100px; overflow-y:auto; background:#e9ecef; padding:10px; border-radius:5px; font-size:.85em; color:#495057;">
            <strong><i class="bi bi-info-circle"></i> Catatan Sistem (${notes.length}):</strong><br/>
            ${notes.slice(0, 5).join('<br/>')} ${notes.length > 5 ? '<br/><i>... (download log untuk melihat sisanya)</i>' : ''}
            </div>`
        : '';

      if (status === 'partial_success') {
        const errorsHtml = `<div style="text-align:left; max-height:100px; overflow-y:auto; background:#fff3f3; padding:10px; border-radius:5px; font-size:.85em; color:#d32f2f;">
                              <strong><i class="bi bi-exclamation-triangle"></i> Daftar Error (${errors.length}):</strong><br/>
                              ${errors.slice(0, 5).join('<br>')} ${errors.length > 5 ? '<br/><i>... (download log untuk melihat sisanya)</i>' : ''}
                            </div>`;
        
        Confirm.fire({ 
          icon: 'warning', 
          title: 'Import Selesai dengan Catatan', 
          html: `<p>${message}</p>${errorsHtml}${notesHtml}`, 
          confirmButtonText: 'Tutup', 
          showDenyButton: true,
          denyButtonText: '<i class="bi bi-file-earmark-text"></i> Download Log',
          denyButtonColor: '#17a2b8'
        }).then((result) => {
          if (result.isDenied) downloadLogFile(errors, notes);
        });

      } else {
        if (notes.length > 0) {
          Confirm.fire({ 
            icon: 'success', 
            title: 'Import Berhasil', 
            html: `<p>${message}</p>${notesHtml}`, 
            confirmButtonText: 'Tutup', 
            showDenyButton: true,
            denyButtonText: '<i class="bi bi-file-earmark-text"></i> Download Log',
            denyButtonColor: '#17a2b8'
          }).then((result) => {
            if (result.isDenied) downloadLogFile([], notes);
          });
        } else {
          Toast.fire({ icon: 'success', title: message });
        }
      }
      crud.handleRefresh();
    } catch (error) {
      const errList = error.response?.data?.errors || [];
      const noteList = error.response?.data?.notes || []; 

      const notesHtml = noteList.length > 0 
        ? `<div style="text-align:left; margin-top:10px; max-height:100px; overflow-y:auto; background:#e9ecef; padding:10px; border-radius:5px; font-size:.85em; color:#495057;">
            <strong>Catatan Sistem (${noteList.length}):</strong><br/>
            ${noteList.slice(0, 5).join('<br/>')} ${noteList.length > 5 ? '<br/><i>... (download log)</i>' : ''}
            </div>`
        : '';

      if (errList.length > 0) {
        const errorsHtml = `<div style="text-align:left; max-height:100px; overflow-y:auto; background:#fff3f3; padding:10px; border-radius:5px; font-size:.85em; color:#d32f2f;">
                              <strong>Daftar Error (${errList.length}):</strong><br/>
                              ${errList.slice(0, 5).join('<br>')} ${errList.length > 5 ? '<br/><i>... (download log)</i>' : ''}
                            </div>`;
                            
        Confirm.fire({ 
          icon: 'error', 
          title: 'Gagal Import', 
          html: `${errorsHtml}${notesHtml}`, 
          confirmButtonText: 'Perbaiki Excel',
          showDenyButton: true,
          denyButtonText: '<i class="bi bi-file-earmark-text"></i> Download Log',
          denyButtonColor: '#17a2b8'
        }).then((result) => {
          if (result.isDenied) downloadLogFile(errList, noteList);
        });
      } else {
        Toast.fire({ icon: 'error', title: error.response?.data?.message || 'Terjadi kesalahan saat upload' });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="OS Training"
        searchPlaceholder="Cari ID / Nama Karyawan..."
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
          loadingText="Exporting Data..."
          className="btn-app btn-success-app"
          icon="bi bi-file-earmark-excel"
          onClick={handleExport}
          disabled={!isFilterApplied || isFilterDirty}
        >
          Eksport Excel
        </LoadingButton>

        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'}`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? <><i className="bi bi-x" /> Tutup</> : <><i className="bi bi-plus" /> Tambah</>}
        </button>
      </PageHeader>

      {crud.showForm && (
        <OsTrainingForm 
          onClose={crud.handleClose} 
          onSuccess={crud.handleRefresh} 
          initialData={crud.editingData} 
        />
      )}

      <div className="app-card">
        {/* --- FILTER BAR CONTAINER --- */}
        <div className="filter-bar d-flex flex-wrap gap-3 mb-3">
          
          {/* Sub Company Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180 }}>
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

          {/* Cost Center Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Cost Center</label>
            <Select
              options={departmentOptions}
              placeholder="Cari Cost Center..."
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
          <OsTrainingTable 
            refreshTrigger={crud.refreshKey} 
            onEditClick={crud.handleEdit} 
            searchTerm={crud.appliedSearch} 
            subCompanyFilter={appliedSubCompany} 
            departmentFilter={appliedDepartment}
            isFilterApplied={isFilterApplied}
          />
        )}

      </div>
    </div>
  );
};

export default OsTraining;