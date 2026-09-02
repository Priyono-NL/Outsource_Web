import React, { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';
import { Toast, Confirm } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import AbsensiReportTable from '../components/absensi_all/AbsensiReportTable';

const ReportAbsen = () => {
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

  // --- FILTER STATES ---
  const [subCompanies, setSubCompanies] = useState([]);
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayString());
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [statusFilter, setStatusFilter] = useState('all_data');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('all_data');

  // FILTER BARU: Tipe Karyawan (OS vs Tetap/Kontrak)
  const [workerType, setWorkerType] = useState('all');
  const [appliedWorkerType, setAppliedWorkerType] = useState('all');

  // Flag UI untuk menyembunyikan tabel jika filter diubah namun belum di-apply
  const [isFilterDirty, setIsFilterDirty] = useState(false);

  // --- LOADING STATES ---
  const [isExporting, setIsExporting] = useState(false);
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

  const handleApplyFilters = () => {
    setIsApplyingFilter(true);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    setAppliedStatusFilter(statusFilter);
    setAppliedWorkerType(workerType);     
    setIsFilterDirty(false);
    crud.handleSearch();
    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        search: crud.appliedSearch || '',
        sub_company: appliedSubCompany || '',
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || '',
        status_filter: appliedStatusFilter || 'all_data',
        worker_type: appliedWorkerType || 'all'
      }).toString();
      
      const res = await api.get(`/absensi/export?${params}`, { responseType: 'blob' });
      
      const fileName = `Absensi_${appliedWorkerType.toUpperCase()}_Filtered.xlsx`;
      saveAs(res.data, fileName);
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    } finally {
      setIsExporting(false);
    }
  };

  // --- OPSI DROPDOWN ---
  const workerTypeOptions = [
    { value: 'all', label: 'Semua Karyawan (All)' },
    { value: 'tetap', label: 'Tetap / Kontrak' },
    { value: 'os', label: 'Outsourcing (OS)' }
  ];

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

  // Helper untuk membersihkan tabel & merubah filter state
  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  return (
    <div>
      <PageHeader
        title="Report Absensi Employee"
        searchPlaceholder="Cari ID Karyawan / Nama ..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      >
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

      <div className="app-card">
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3">

          {/* Filter Tipe Karyawan */}
          <div className="filter-group" style={{ minWidth: 180, margin: 0, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Tipe Karyawan</label>
            <Select 
              options={workerTypeOptions} 
              value={workerTypeOptions.find(o => o.value === workerType)} 
              onChange={o => handleFilterChange(setWorkerType, o?.value || 'all')} 
              isSearchable={false}
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

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
        
        { isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> di pojok kanan atas untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <AbsensiReportTable
            workerType={appliedWorkerType}
            refreshTrigger={crud.refreshKey}
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

export default ReportAbsen;