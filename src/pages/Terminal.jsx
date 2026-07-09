import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import Terminal_form from '../components/terminal/terminal_form';
import Terminal_table from '../components/terminal/terminal_table';

const Terminal = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader
        title="Master Terminal"
        searchPlaceholder="Cari Terminal ID..."
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
        <Terminal_form
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      <div className="app-card">
        <Terminal_table
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};
export default Terminal;
