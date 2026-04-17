import React, { useState } from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import OsTypeForm from '../components/osType/OsTypeForm';
import OsTypeTable from '../components/osType/OsTypeTable';

const OsType = () => {
  const crud = useCrudPage();
  const [filterTerm, setFilterTerm] = useState('all');

  return (
    <div>
      <PageHeader
        title="OS Type Work"
        searchPlaceholder="Cari Tipe..."
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
      {crud.showForm && <OsTypeForm onClose={crud.handleClose} onSuccess={crud.handleRefresh} initialData={crud.editingData} />}
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
        <OsTypeTable refreshTrigger={crud.refreshKey} onEditClick={crud.handleEdit} searchTerm={crud.appliedSearch} filterTerm={filterTerm} />
      </div>
    </div>
  );
};
export default OsType;
