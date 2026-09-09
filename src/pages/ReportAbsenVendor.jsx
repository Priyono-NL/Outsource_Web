import React, { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';
import { Toast } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import AbsenVendorReport from '../components/absensi_all/AbsenVendorReport';

const ReportAbsenVendor = () => {
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

  const [jenisFilter, setJenisFilter] = useState('all_data');
  const [appliedJenisFilter, setAppliedJenisFilter] = useState('all_data');

  const [isFilterDirty, setIsFilterDirty] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

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
    setAppliedJenisFilter(jenisFilter);
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
        clocking_type: appliedJenisFilter || 'all_data',
      }).toString();
      
      const res = await api.get(`/absensiVendor/export?${params}`, { responseType: 'blob' });
      
      const fileName = `Report_Vendor_${appliedStartDate}_to_${appliedEndDate}.xlsx`;
      saveAs(res.data, fileName);
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    } finally {
      setIsExporting(false);
    }
  };

  const subCompanyOptions = [
    { value: '', label: 'Semua Sub Company' },
    ...subCompanies.map(sc => ({ value: sc.sub_company_name, label: sc.sub_company_name })),
  ];

  const statusOptions = [
    { value: 'all_data', label: 'Semua Data (Diterima & Reject)' },
    { value: 'valid', label: 'Data Diterima (Valid)' },
    { value: 'reject', label: 'Data Ditolak (Reject)' }
  ];

  const jenisOptions = [
    { value: 'all_data', label: 'Semua Jenis' },
    { value: 'Absensi', label: 'Absensi' },
    { value: 'Break', label: 'Break' }
  ];

  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  return (
    <div>
      <PageHeader
        title="Report Absensi Vendor"
        searchPlaceholder="Cari No Kartu / NRP / Nama..."
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
          disabled={isFilterDirty} 
        >
          Export
        </LoadingButton>        
      </PageHeader>

      <div className="app-card">
        <div className="filter-bar d-flex flex-wrap gap-2 align-items-end mb-3">

          <div className="filter-group" style={{ minWidth: 200, margin: 0, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Status Clocking</label>
            <Select 
              options={statusOptions} 
              value={statusOptions.find(o => o.value === statusFilter)} 
              onChange={o => handleFilterChange(setStatusFilter, o?.value || 'all_data')} 
              menuPortalTarget={document.body}
              styles={{ control: b => ({ ...b, minHeight: 34, fontSize: 13 }) }}
            />
          </div>

          <div className="filter-group" style={{ minWidth: 150, margin: 0, flex: 1 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Jenis</label>
            <Select 
              options={jenisOptions} 
              value={jenisOptions.find(o => o.value === jenisFilter)} 
              onChange={o => handleFilterChange(setJenisFilter, o?.value || 'all_data')} 
              menuPortalTarget={document.body}
              styles={{ control: b => ({ ...b, minHeight: 34, fontSize: 13 }) }}
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
              styles={{ control: b => ({ ...b, minHeight: 34, fontSize: 13 }) }}
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
          <AbsenVendorReport
            refreshTrigger={crud.refreshKey}
            searchTerm={crud.appliedSearch}
            subCompany={appliedSubCompany}
            startDate={appliedStartDate}
            endDate={appliedEndDate}
            statusFilter={appliedStatusFilter}
            clockingType={appliedJenisFilter} // Lempar prop baru ke tabel
          />
        )}
      </div>
    </div>
  );
};

export default ReportAbsenVendor;