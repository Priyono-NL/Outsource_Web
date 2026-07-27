import React, { useState } from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import Terminal_table from '../components/terminal/terminal_table';
import api from '../api/api';
import { Toast, Confirm } from '../utils/sweetalert';

const Terminal = () => {
  const crud = useCrudPage();
  const [isSyncing, setIsSyncing] = useState(false);

  // Handler untuk tombol Sync
  const handleSync = async () => {
    Confirm.fire({
      title: 'Sinkronisasi Data?',
      text: 'Data terminal akan diperbarui dari Google Sheet.',
      icon: 'question',
      confirmButtonText: 'Ya, Sync sekarang!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsSyncing(true);
        try {
          const response = await api.post('/terminal/sync-sheet');
          
          if (response.data.status === 'success') {
            Toast.fire({
              icon: 'success',
              title: response.data.message || 'Sync berhasil!'
            });
            
            if (crud.triggerRefresh) {
              crud.triggerRefresh();
            } else {
              crud.handleSearch(); 
            }
          }
        } catch (error) {
          const msg = error.response?.data?.message || error.message || 'Gagal sinkronisasi data';
          Toast.fire({
            icon: 'error',
            title: 'Gagal Sync',
            text: msg
          });
        } finally {
          setIsSyncing(false);
        }
      }
    });
  };

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
          className='btn-app btn-primary-app'
          onClick={handleSync}
          disabled={isSyncing}
        >
          <i className={`bi bi-arrow-repeat ${isSyncing ? 'spin-icon' : ''}`} /> 
          {isSyncing ? ' Memproses...' : ' Sync'}
        </button>
      </PageHeader>

      <div className="app-card">
        <Terminal_table
          refreshTrigger={crud.refreshKey}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};

export default Terminal;