import React, { useState } from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import AlokasiForm from '../components/alokasi/AlokasiForm';
import AlokasiBulkForm from '../components/alokasi/AlokasiBulkForm';
import AlokasiTable from '../components/alokasi/AlokasiTable';

const Alokasi = () => {
  const crud = useCrudPage();
  const [filterTerm, setFilterTerm] = useState('all');
  const [showBulkForm, setShowBulkForm] = useState(false);

  return (
    <div>
      <PageHeader
        title="Alokasi Kantin"
        searchPlaceholder="Cari ID atau Nama Karyawan..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
        {/* Tombol Tambah Single (1 per 1) */}
        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'} me-2`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? (
            <><i className="bi bi-x" /> Tutup</>
          ) : (
            <><i className="bi bi-plus" /> Tambah 1 Karyawan</>
          )}
        </button>

        {/* Tombol Tambah Massal (Bulk / Multiple Employees) */}
        {!crud.showForm && (
          <button
            className="btn-app btn-secondary-app"
            onClick={() => setShowBulkForm(true)}
          >
            <i className="bi bi-people-fill me-1" /> Tambah Massal
          </button>
        )}
      </PageHeader>

      {crud.showForm && (
        <AlokasiForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      {showBulkForm && (
        <AlokasiBulkForm
          onClose={() => setShowBulkForm(false)}
          onSuccess={crud.handleRefresh}
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
