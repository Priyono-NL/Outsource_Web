import React, { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';

import { Toast, Confirm } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import ViolationTable from '../components/absensi/ViolationTable';
import AbsensiForm from '../components/absensi/AbsensiForm';

const Violation = () => {
  const crud = useCrudPage();
  const [editData, setEditData] = useState(null);

  const [subCompanies, setSubCompanies] = useState([]);
  const [subCompanyInput, setSubCompanyInput]   = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [resSub, resDept] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
        ]);
        setSubCompanies(resSub.data.data);
      } catch { /* silent */ }
    };
    load();
  }, []);

  const handleApplyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedSubCompany(subCompanyInput);
    crud.handleSearch();
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
    try {
      const params = new URLSearchParams({
        search: crud.appliedSearch || '',
        sub_company: appliedSubCompany || '',
        start_date: appliedStartDate || '',
        end_date: appliedEndDate || ''
      }).toString();
      const res = await api.get(`/absensi/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, 'Absensi_OS_Filtered.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    }
  };

  const subCompanyOptions = [
    { value: '', label: 'Semua Sub Company' },
    ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
  ];

  return (
    <div>
      <PageHeader
        title="Absensi Violation OS"
        searchPlaceholder="Cari ID Karyawan / Nama ..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={handleApplyFilters}
      >
        <button className="btn-app btn-success-app" onClick={handleExport}>
            <i className="bi bi-file-earmark-excel" /> Export
        </button>        
      </PageHeader>

      <h5>INI NANTI JADI HALAMAN APLIKASI ABSENSI OS</h5>
      <p>ON DEVELOPMENT</p>

      {crud.showForm && <AbsensiForm onClose={handleCloseForm} onSuccess={crud.handleRefresh} initialData={editData} />}

      <div className="app-card">

        <div className="filter-bar">

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

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            
            <div className="filter-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: '4px' }}>Dari Tanggal</label>
              <input 
                type="date" 
                className="form-control-app"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ fontSize: 13, height: 34, width: '150px' }}
              />
            </div>

            <span style={{ paddingBottom: '8px', fontSize: 14, fontWeight: 'bold' }}>-</span>

            <div className="filter-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: '4px' }}>Sampai Tanggal</label>
              <input 
                type="date" 
                className="form-control-app"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                style={{ fontSize: 13, height: 34, width: '150px' }}
              />
            </div>

          </div>

          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <button className="btn-app btn-primary-app" onClick={handleApplyFilters}>
              <i className="bi bi-funnel" /> Terapkan Filter
            </button>
          </div>

        </div>
        
        <ViolationTable
          refreshTrigger={crud.refreshKey}
          onEditClick={handleEdit} 
          searchTerm={crud.appliedSearch}
          subCompany={appliedSubCompany}
          startDate={appliedStartDate}
          endDate={appliedEndDate}
        />
      </div>

    </div>
  );
};

export default Violation;