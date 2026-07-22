import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import ObEmployeeTable from '../components/obEmployee/obEmployeeTable';

const ObEmployee = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader
        title="Master Karyawan SAP"
        searchPlaceholder="Cari Nama / NRP ..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
      </PageHeader>

      <div className="app-card">
        <ObEmployeeTable
          refreshTrigger={crud.refreshKey}
          searchTerm={crud.appliedSearch}
        />
      </div>
      <div>
        DATA AKAN DIAMBIL DARI SAP (view_only)
      </div>
    </div>
  );
};
export default ObEmployee;
