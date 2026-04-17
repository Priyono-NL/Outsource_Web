import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import BlacklistForm from '../components/blacklist/BlacklistForm';
import BlacklistTable from '../components/blacklist/BlacklistTable';

const Blacklist = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader
        title="Blacklist Person"
        searchPlaceholder="Cari ID atau Nama..."
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
        <BlacklistForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      <div className="app-card">
        <BlacklistTable
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};
export default Blacklist;
