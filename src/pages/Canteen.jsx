import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import CanteenTable from '../components/canteen-m/Canteen_table';
import CanteenForm from '../components/canteen-m/Canteen_form';

const Canteen = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader title="Master Kantin">
        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'}`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? <><i className="bi bi-x" /> Tutup</> : <><i className="bi bi-plus" /> Tambah</>}
        </button>
      </PageHeader>

      {crud.showForm && (
        <CanteenForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      <div className="app-card">
        <CanteenTable
          refreshTrigger={crud.refreshKey}
          onEditClick={crud.handleEdit}
        />
      </div>
    </div>
  );
};
export default Canteen;
