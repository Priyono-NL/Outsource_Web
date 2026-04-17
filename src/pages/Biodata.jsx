import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import BiodataTable from '../components/biodata/Biodata_table';
import BiodataForm from '../components/biodata/Biodata_form';

const Biodata = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader
        title="Biodata"
        searchPlaceholder="Cari Nama..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      />

      {crud.showForm && (
        <BiodataForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      <div className="app-card">
        <BiodataTable
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};
export default Biodata;
