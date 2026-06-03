import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../utils/sweetalert';
import { saveAs } from 'file-saver';
import Select from 'react-select';
import { downloadLogFile } from '../utils/logDownloader';
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import Datatable from '../components/employment/Datatable';
import Dataform from '../components/employment/Dataform';
import ViewDetails from '../components/employment/ViewDetails';

const Employment = () => {
  const crud = useCrudPage();
  const [viewForm, setViewForm]       = useState(false);
  const [viewData, setViewData]       = useState(null);
  const [editData, setEditData]       = useState(null);

  const [statusInput, setStatusInput]           = useState('all');
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [departmentInput, setDepartmentInput]   = useState('');
  const [appliedStatus, setAppliedStatus]       = useState('all');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');

  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments]   = useState([]);
  const [isUploading, setIsUploading]   = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef(null);

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
    crud.handleSearch();
    setAppliedStatus(statusInput);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
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
    try {
      const { data } = await api.get('/employee/template', { responseType: 'blob' });
      saveAs(data, 'Template_Import.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal download template import' });
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

      const notesHtml = noteList.length > 0 
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
        title="Employment"
        searchPlaceholder="Cari ID / Nama / Card Number..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={handleApplyFilters}
      >
        <button className="btn-app btn-ghost-app" onClick={handleDownloadTemplate}>
          <i className="bi bi-download" /> Template
        </button>
        <label className="btn-app btn-ghost-app" style={{ cursor: 'pointer' }}>
          {isUploading
            ? <><span className="spinner-border spinner-border-sm me-1" role="status" /> Proses...</>
            : <><i className="bi bi-upload" /> Import</>}
          <input type="file" hidden ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" disabled={isUploading} />
        </label>
        <button className="btn-app btn-success-app" onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <>
              {/* Spinner kecil ala Bootstrap */}
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Exporting Data...
            </>
          ) : (
            <>
              <i className="bi bi-file-earmark-excel me-2"></i> {/* Jika pakai Bootstrap Icons */}
              Eksport Excel
            </>
          )}
        </button>
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
            <select value={statusInput} onChange={e => setStatusInput(e.target.value)}>
              <option value="all">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="filter-group" style={{ minWidth: 180 }}>
            <label>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => setSubCompanyInput(o?.value || '')}
              isClearable isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          <div className="filter-group" style={{ minWidth: 180 }}>
            <label>Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => setDepartmentInput(o?.value || '')}
              isClearable isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <button className="btn-app btn-primary-app" onClick={handleApplyFilters}>
              <i className="bi bi-funnel" /> Terapkan Filter
            </button>
          </div>
          
        </div>
        
        {/* Tambahkan properti onEditClick ke Datatable */}
        <Datatable
          refreshTrigger={crud.refreshKey}
          onViewClick={handleView}
          onEditClick={handleEdit} 
          searchTerm={crud.appliedSearch}
          filterStatus={appliedStatus}
          filterSubCompany={appliedSubCompany}
          filterDepartment={appliedDepartment}
        />
      </div>
    </div>
  );
};

export default Employment;