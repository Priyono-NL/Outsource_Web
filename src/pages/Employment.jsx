import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../utils/sweetalert';
import { saveAs } from 'file-saver';
import Select from 'react-select';
import { downloadLogFile } from '../utils/logDownloader';
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import Datatable from '../components/employment/Datatable';
import Dataform from '../components/employment/Dataform';
import ViewDetails from '../components/employment/ViewDetails';

const Employment = () => {
  const crud = useCrudPage();
  const { user } = useAuth();
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted       = user?.allowed_costcenters && user.allowed_costcenters.length > 0;

  const [viewForm, setViewForm]       = useState(false);
  const [viewData, setViewData]       = useState(null);
  const [editData, setEditData]       = useState(null);

  // Form Filter States
  const [statusInput, setStatusInput]           = useState('all');
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [departmentInput, setDepartmentInput]   = useState('');
  
  // Applied Filter States
  const [appliedStatus, setAppliedStatus]       = useState('all');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');

  // Flag Status Filter Terapan
  const [isFilterApplied, setIsFilterApplied]   = useState(false);
  const [isFilterDirty, setIsFilterDirty]       = useState(false);

  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);

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

        // --- Auto-Select Subcompany jika user dibatasi ---
        if (isSubCompanyRestricted && subData.length > 0) {
          const allowedSubList = subData.filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id));
          const defaultSub = allowedSubList.length > 0 ? allowedSubList[0].sub_company_id : subData[0].sub_company_id;
          setSubCompanyInput(defaultSub);
          setAppliedSubCompany(defaultSub);
        }

        // --- Auto-Select Department / Cost Center jika user dibatasi ---
        if (isDeptRestricted && deptData.length > 0) {
          const allowedDeptList = deptData.filter(d => user.allowed_costcenters.includes(d.id));
          const defaultDept = allowedDeptList.length > 0 ? allowedDeptList[0].id : deptData[0].id;
          setDepartmentInput(defaultDept);
          setAppliedDepartment(defaultDept);
        }

      } catch { /* silent */ }
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
    
    setIsFilterApplied(true);
    setIsFilterDirty(false);
    
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setStatusInput('all');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    crud.setSearchInput('');
    
    setAppliedStatus('all');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');
    
    setIsFilterApplied(false);
    setIsFilterDirty(false);
  };

  const handleView = (data) => { setViewData(data); setViewForm(true); };

  const handleEdit = (data) => {
    setEditData(data);
    crud.handleAdd();
  };

  const handleAddNew = () => {
    setEditData(null);
    crud.handleAdd();
  };

  const handleCloseForm = () => {
    setEditData(null);
    crud.handleClose();
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
        status: appliedStatus || 'all',
        sub_company: appliedSubCompany || '',
        department: appliedDepartment || '',
      }).toString();
      const res = await api.get(`/employee/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, 'Data_OS_Filtered.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const { data } = await api.get('/employee/template', { responseType: 'blob' });
      saveAs(data, 'Template_Import.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal download template import' });
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
      const res = await api.post('/employee/upload', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      const { status, message, errors, notes } = res.data; 

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
        if (notes && notes.length > 0) {
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
      const errList = error.response?.data?.errors;
      const noteList = error.response?.data?.notes; 

      const notesHtml = noteList?.length > 0 
      ? `<div style="text-align:left; margin-top:10px; max-height:100px; overflow-y:auto; background:#e9ecef; padding:10px; border-radius:5px; font-size:.85em; color:#495057;">
          <strong>Catatan Sistem (${noteList.length}):</strong><br/>
          ${noteList.slice(0, 5).join('<br/>')} ${noteList.length > 5 ? '<br/><i>... (download log)</i>' : ''}
        </div>`
      : '';

      if (errList?.length) {
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

  // --- Dynamic Opsi Subcompany ---
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
      
  // --- Dynamic Opsi Department / Cost Center ---
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
        title="Employment"
        searchPlaceholder="Cari ID / Nama / Card Number..."
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
          onClick={crud.showForm ? handleCloseForm : handleAddNew}
        >
          {crud.showForm ? <><i className="bi bi-x" /> Tutup</> : <><i className="bi bi-plus" /> Tambah</>}
        </button>
      </PageHeader>

      {crud.showForm && <Dataform onClose={handleCloseForm} onSuccess={crud.handleRefresh} initialData={editData} />}
      {viewForm && <ViewDetails onClose={() => setViewForm(false)} initialData={viewData} />}

      <div className="app-card">

        <div className="filter-bar">

          <div className="filter-group">
            <label>Status</label>
            <select 
              value={statusInput} 
              onChange={e => handleFilterChange(setStatusInput, e.target.value)}
              className="form-select-app"
            >
              <option value="all">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Sub Company Dropdown */}
          <div className="filter-group" style={{ minWidth: 180 }}>
            <label>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
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

          {/* Department / Cost Center Dropdown (Restricted Dynamic) */}
          <div className="filter-group" style={{ minWidth: 180 }}>
            <label>Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari..."
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
        
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <Datatable
            refreshTrigger={crud.refreshKey}
            onViewClick={handleView}
            onEditClick={handleEdit} 
            searchTerm={crud.appliedSearch}
            filterStatus={appliedStatus}
            filterSubCompany={appliedSubCompany}
            filterDepartment={appliedDepartment}
            isFilterApplied={isFilterApplied}
          />
        )}
      </div>
    </div>
  );
};

export default Employment;