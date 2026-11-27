import React, { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';
import { Toast, Confirm } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';
import { getCachedSubCompanies, getCachedCostCenters } from '../utils/masterDataCache';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import BacTreportTable from '../components/BacTreport/BacTreportTable';
import BacTreportForm from '../components/BacTreport/BacTreportForm';

const BacAtn = () => {
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const crud = useCrudPage();
  const { user } = useAuth();

  // Flag pembatasan hak akses SSO
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted = user?.allowed_costcenters && user.allowed_costcenters.length > 0;

  const [editData, setEditData] = useState(null);

  // --- MASTER DATA STATES ---
  const [departments, setDepartments] = useState([]);

  // --- STATE FORM FILTER (DRAFT) ---
  const [statusFilter, setStatusFilter] = useState('all_data');
  const [directionFilter, setDirectionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('all_data');
  const [appliedDirectionFilter, setAppliedDirectionFilter] = useState('');
  const [appliedTypeFilter, setAppliedTypeFilter] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState(getTodayString());
  const [appliedEndDate, setAppliedEndDate] = useState(getTodayString());

  // --- FLAG FILTER STATES ---
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDirty, setIsFilterDirty] = useState(false);

  // --- ACTION LOADING STATES ---
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [deptData] = await Promise.all([
          getCachedCostCenters(),
        ]);
        setDepartments(deptData);

        if (isDeptRestricted && deptData.length > 0) {
          const allowedDeptList = deptData.filter((d) =>
            user.allowed_costcenters.includes(d.id)
          );
          const defaultDept = allowedDeptList.length > 0 ? allowedDeptList[0].id : deptData[0].id;
          setDepartmentInput(defaultDept);
          setAppliedDepartment(defaultDept);
        }
      } catch {
        /* silent error handling */
      }
    };
    if (user) load();
  }, [user, isSubCompanyRestricted, isDeptRestricted]);

  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  const handleApplyFilters = () => {
    setIsApplyingFilter(true);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedDepartment(departmentInput);
    setAppliedStatusFilter(statusFilter);
    setAppliedDirectionFilter(directionFilter);
    setAppliedTypeFilter(typeFilter);

    setIsFilterApplied(true);
    setIsFilterDirty(false);

    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setStatusFilter('all_data');
    setDirectionFilter('');
    setTypeFilter('');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    setStartDate(getTodayString());
    setEndDate(getTodayString());
    crud.setSearchInput('');

    setAppliedStatusFilter('all_data');
    setAppliedDirectionFilter('');
    setAppliedTypeFilter('');
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

  const handleDownloadTemplate = async () => {
    if (isFilterDirty) {
      Toast.fire({
        icon: 'warning',
        title: 'Terapkan filter yang baru diubah sebelum mengunduh template.',
      });
      return;
    }

    setIsDownloadingTemplate(true);
    try {
      const params = {
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
        search: crud.appliedSearch || '',
        department: appliedDepartment || '',
        worker_type: 'tetap_kontrak',
      };

      const { data } = await api.get('/bac-atn/template', {
        params,
        responseType: 'blob',
      });

      saveAs(data, `Template_BAC_ATN_${appliedStartDate}_to_${appliedEndDate}.xlsx`);
    } catch (error) {
      if (error.response?.data?.type === 'application/json') {
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
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('worker_type', 'tetap_kontrak');

    try {
      const res = await api.post('/bac-atn/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { status, message, errors } = res.data;
      if (status === 'partial_success') {
        Confirm.fire({
          icon: 'warning',
          title: 'Import Selesai dengan Catatan',
          html: `<p>${message}</p><div style="text-align:left;max-height:200px;overflow-y:auto;background:#f8f9fa;padding:10px;font-size:.85em">${errors.join('<br>')}</div>`,
          confirmButtonText: 'Tutup',
          showCancelButton: false,
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
          confirmButtonText: 'Perbaiki Excel',
        });
      } else {
        Toast.fire({
          icon: 'error',
          title: error.response?.data?.message || 'Terjadi kesalahan saat upload',
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // --- DYNAMIC OPTIONS ---
  const departmentOptions = isDeptRestricted
    ? departments
        .filter((d) => user.allowed_costcenters.includes(d.id))
        .map((d) => ({ value: d.id, label: d.org_name }))
    : [
        { value: '', label: 'Semua Department / Cost Center' },
        ...departments.map((d) => ({ value: d.id, label: d.org_name })),
      ];

  const statusOptions = [
    { value: 'all_data', label: 'Semua Status' },
    { value: '0', label: 'Status 0 (Pending / Baru)' },
    { value: '1', label: 'Status 1 (Approved)' },
    { value: '2', label: 'Status 2 (Rejected)' },
  ];

  const directionOptions = [
    { value: '', label: 'Semua Direction (IN / OUT)' },
    { value: 'IN', label: 'IN' },
    { value: 'OUT', label: 'OUT' },
  ];

  const typeOptions = [
    { value: '', label: 'Semua Tipe (KIOSK / BACKDATE)' },
    { value: 'KIOSK', label: 'KIOSK' },
    { value: 'BACKDATE', label: 'BACKDATE' },
  ];

  return (
    <div>
      <PageHeader
        title="BAC ATN (Tetap / Kontrak)"
        searchPlaceholder="Cari NRP / Nama Karyawan..."
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

      {crud.showForm && (
        <BacTreportForm
          variant="modal"
          onClose={handleCloseForm}
          onSuccess={crud.handleRefresh}
          initialData={editData}
        />
      )}

      <div className="app-card">
        {/* --- GRID CARD FILTER CONTAINER --- */}
        <div className="card border-0 bg-light p-3 mb-3 rounded-3 shadow-sm">
          <div className="row g-2 align-items-end">
            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-flag me-1" /> Status
              </label>
              <Select
                options={statusOptions}
                value={statusOptions.find((o) => o.value === statusFilter) || statusOptions[0]}
                onChange={(o) => handleFilterChange(setStatusFilter, o?.value || 'all_data')}
                menuPortalTarget={document.body}
                styles={{
                  control: (b) => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-arrow-left-right me-1" /> Direction (IN / OUT)
              </label>
              <Select
                options={directionOptions}
                value={directionOptions.find((o) => o.value === directionFilter) || directionOptions[0]}
                onChange={(o) => handleFilterChange(setDirectionFilter, o?.value || '')}
                menuPortalTarget={document.body}
                styles={{
                  control: (b) => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            </div>

            <div className="col-md-3 col-sm-6">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-cpu me-1" /> Tipe Input
              </label>
              <Select
                options={typeOptions}
                value={typeOptions.find((o) => o.value === typeFilter) || typeOptions[0]}
                onChange={(o) => handleFilterChange(setTypeFilter, o?.value || '')}
                menuPortalTarget={document.body}
                styles={{
                  control: (b) => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            </div>

            <div className="col-md-3 col-sm-6 mt-2">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-diagram-3 me-1" /> Cost Center
              </label>
              <Select
                options={departmentOptions}
                placeholder="Cari Cost Center..."
                value={departmentOptions.find((o) => o.value === departmentInput) || departmentOptions[0]}
                onChange={(o) => handleFilterChange(setDepartmentInput, o?.value || '')}
                isClearable={!isDeptRestricted}
                isSearchable
                menuPortalTarget={document.body}
                styles={{
                  control: (b) => ({ ...b, minHeight: 34, fontSize: '0.8rem' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            </div>

            <div className="col-md-3 col-sm-6 mt-2">
              <label className="form-label mb-1 fw-bold text-secondary" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-calendar-event me-1" /> Dari Tanggal
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
                <i className="bi bi-calendar-check me-1" /> Sampai Tanggal
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
        {isFilterDirty && isFilterApplied ? (
          <div
            className="alert alert-warning text-center mt-2 mb-3 py-3"
            style={{ borderStyle: 'dashed' }}
            role="alert"
          >
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1" />
            <span style={{ fontSize: '13px' }}>
              <strong>Filter Sedang Diubah!</strong>
              <br />
              Silakan klik tombol <b>Terapkan Filter</b> untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <BacTreportTable
            refreshTrigger={crud.refreshKey}
            onEditClick={handleEdit}
            searchTerm={crud.appliedSearch}
            department={appliedDepartment}
            startDate={appliedStartDate}
            endDate={appliedEndDate}
            statusFilter={appliedStatusFilter}
            directionFilter={appliedDirectionFilter}
            typeFilter={appliedTypeFilter}
            isFilterApplied={isFilterApplied}
          />
        )}
      </div>
    </div>
  );
};

export default BacAtn;