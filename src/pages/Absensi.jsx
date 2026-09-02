import React, { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';
import { Toast, Confirm } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

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
  const [editData, setEditData] = useState(null);

  const [subCompanies, setSubCompanies] = useState([]);
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayString());
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [statusFilter, setStatusFilter] = useState('all_data');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('all_data');

  // STATE BARU: Flag untuk mendeteksi perubahan filter (Dirty Filter)
  const [isFilterDirty, setIsFilterDirty] = useState(false);

  // Loading States Per Action
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [resSub] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
        ]);
        setSubCompanies(resSub.data.data || []);
      } catch { /* silent */ }
    };
    load();
  }, []);

  // HELPER BARU: Mengubah state filter & menyalakan status dirty
  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  const handleApplyFilters = () => {
    setIsApplyingFilter(true);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedStatusFilter(statusFilter);
    
    // Matikan flag dirty sehingga tabel muncul kembali
    setIsFilterDirty(false);
    
    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
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
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        search: crud.appliedSearch || '',
        sub_company: appliedSubCompany || '',
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
    setIsDownloadingTemplate(true);
    try {
      const { data } = await api.get('/absensi/template', { 
        params: { start_date: startDate, end_date: endDate },
        responseType: 'blob' 
      });
      saveAs(data, `Template_Mass_Update_${startDate}_to_${endDate}.xlsx`);
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
      const res = await api.post('/absensi/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
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
        searchPlaceholder="Cari ID Karyawan / Nama ..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true); // Nyalakan dirty filter saat user ngetik di search box
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

        <label className={`btn-app ${isUploading ? 'btn-ghost-app' : 'btn-ghost-app'}`} style={{ cursor: 'pointer' }}>
          {isUploading ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              Proses...
            </>
          ) : (
            <>
              <i className="bi bi-upload" /> Import
            </>
          )}
          <input type="file" hidden ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" disabled={isUploading} />
        </label>

        <LoadingButton
          loading={isExporting}
          loadingText="Mengeksport..."
          className="btn-app btn-success-app"
          icon="bi bi-file-earmark-excel"
          onClick={handleExport}
          disabled={isFilterDirty} // Cegah export jika filter belum ditekan
        >
          Export
        </LoadingButton>        
      </PageHeader>

      {crud.showForm && <AbsensiForm onClose={handleCloseForm} onSuccess={crud.handleRefresh} initialData={editData} />}

      <div className="app-card">

        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3">

          <div className="filter-group" style={{ minWidth: 220, margin: 0, flex: 1 }}>
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

          <div className="filter-group" style={{ minWidth: 180, margin: 0, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            
            <div className="filter-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: '4px' }}>Dari Tanggal</label>
              <input 
                type="date" 
                className="form-control-app"
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                style={{ fontSize: 13, height: 34, width: '130px' }}
              />
            </div>

            <span style={{ paddingBottom: '8px', fontSize: 14, fontWeight: 'bold' }}>-</span>

            <div className="filter-group" style={{ margin: 0 }}>
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

          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
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
        
        {/* LOGIKA CONDITIONAL RENDERING UNTUK DIRTY FILTER */}
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