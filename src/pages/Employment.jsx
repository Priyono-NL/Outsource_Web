import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../utils/sweetalert';
import { saveAs } from 'file-saver';
import Select from 'react-select';
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
      const res = await api.post('/employee/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { status, message, errors } = res.data;
      if (status === 'partial_success') {
        Confirm.fire({ icon: 'warning', title: 'Import Selesai dengan Catatan', html: `<p>${message}</p><div style="text-align:left;max-height:200px;overflow-y:auto;background:#f8f9fa;padding:10px;font-size:.85em">${errors.join('<br>')}</div>`, confirmButtonText: 'Tutup', showCancelButton: false });
      } else {
        Toast.fire({ icon: 'success', title: message });
      }
      crud.handleRefresh();
    } catch (error) {
      const errList = error.response?.data?.errors;
      if (errList?.length) {
        Confirm.fire({ icon: 'error', title: 'Gagal Import', html: `<div style="text-align:left;max-height:200px;overflow-y:auto;font-size:.85em">${errList.join('<br>')}</div>`, confirmButtonText: 'Perbaiki Excel' });
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
        <button className="btn-app btn-success-app" onClick={handleExport}>
          <i className="bi bi-file-earmark-excel" /> Export
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
              styles={{ control: b => ({ ...b, minHeight: 34, fontSize: 13 }) }}
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
              styles={{ control: b => ({ ...b, minHeight: 34, fontSize: 13 }) }}
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