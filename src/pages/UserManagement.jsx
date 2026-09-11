import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import User_m_table from '../components/user-m/User_m_table';
import User_m_form from '../components/user-m/User_m_form';

const UserManagement = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader
        title="Pengaturan Akses User"
        searchPlaceholder="Cari nama atau email..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
        {/* Tidak ada tombol tambah karena user mendaftar otomatis via SSO */}
      </PageHeader>

      {/* Modal Form Edit Akses */}
      {crud.showForm && (
        <User_m_form
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      {/* Tabel Data User */}
      <div className="app-card mt-3">
        <User_m_table
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};

export default UserManagement;