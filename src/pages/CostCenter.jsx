import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import CCTable from '../components/costCenter/CCTable';
import CCForm from '../components/costCenter/CCFrom';
import { invalidateMasterDataCache } from '../utils/masterDataCache';

const CostCenter = () => {
  const crud = useCrudPage();

  const handleSuccess = () => {
    invalidateMasterDataCache();
    crud.handleRefresh();
  };

  return (
    <div>
      <PageHeader
        title="Master Cost Center (SAP)"
        searchPlaceholder="Cari Cost Center..."
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
        <CCForm
          onClose={crud.handleClose}
          onSuccess={handleSuccess}
          initialData={crud.editingData}
        />
      )}

      <div className="app-card">
        <CCTable
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};
export default CostCenter;
