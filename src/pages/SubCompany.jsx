import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import SubComTable from '../components/subCom/SubComTable';
import SubComForm from '../components/subCom/SubComForm';

const SubCompany = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader
        title="Master Sub Company"
        searchPlaceholder="Cari Nama..."
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
        <SubComForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      <div className="app-card">
        <SubComTable
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};
export default SubCompany;
