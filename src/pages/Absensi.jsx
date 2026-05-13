import React, { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';

import { Toast, Confirm } from '../utils/sweetalert';
import { useCrudPage } from '../utils/useCrudPage';

import PageHeader from '../components/PageHeader';
import AbsensiTable from '../components/absensi/AbsensiTable';
import AbsensiForm from '../components/absensi/AbsensiForm';

const Absensi = () => {
  const crud = useCrudPage();
  const [editData, setEditData] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [appliedDate, setAppliedDate] = useState('');

  const handleApplyFilters = () => {
    setAppliedDate(filterDate);
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
      }).toString();
      const res = await api.get(`/absensi/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, 'Absensi_OS_Filtered.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal mengunduh file Excel' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Absensi OS"
        searchPlaceholder="Cari ID / Nama / Card Number..."
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
          <div className="filter-group">
            <label>Pilih Tanggal</label>
            <input 
              type="date" 
              className="form-control-app"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ fontSize: 13, height: 34 }}
            />
          </div>
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <button className="btn-app btn-primary-app" onClick={handleApplyFilters}>
              <i className="bi bi-funnel" /> Terapkan Filter
            </button>
          </div>
        </div>
        
        <AbsensiTable
          refreshTrigger={crud.refreshKey}
          onEditClick={handleEdit} 
          searchTerm={crud.appliedSearch}
          filterDate={appliedDate}
        />
      </div>

    </div>
  );
};

export default Absensi;