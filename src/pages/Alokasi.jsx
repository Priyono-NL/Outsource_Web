import React, { useState } from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import AlokasiForm from '../components/alokasi/AlokasiForm';
import AlokasiTable from '../components/alokasi/AlokasiTable';

const Alokasi = () => {
  const crud = useCrudPage();
  const [filterTerm, setFilterTerm] = useState('all');

  return (
    <div>
      <PageHeader
        title="Alokasi Kantin"
        searchPlaceholder="Cari ID atau Nama Karyawan..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'}`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? <><i className="bi bi-x" /> Tutup</> : <><i className="bi bi-plus" /> Tambah</>}
        </button>
      </PageHeader>

      {crud.showForm && (
        <AlokasiForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      <div className="app-card">
        <div className="filter-bar">
          <div className="filter-group">
            <label>Status</label>
            <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)}>
              <option value="all">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <AlokasiTable
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
          searchTerm={crud.appliedSearch}
          filterTerm={filterTerm}
        />
      </div>
    </div>
  );
};
export default Alokasi;
