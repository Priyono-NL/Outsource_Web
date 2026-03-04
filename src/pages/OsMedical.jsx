import React, { useState } from 'react';
import api from '../api/api';
import OsMedicForm from '../components/osMedical/osMedicForm';
import OsMedicTable from '../components/osMedical/osMedicTable';

const OsMedical = () => {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingData, setEditingData] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const handleSearch = () => { setAppliedSearch(searchInput); };
  const handleRefresh = () => { setRefreshKey((oldKey) => oldKey + 1); };
  const handleAdd = () => {
      setEditingData(null);
      setShowForm(true);
  };
  const handleEdit = (data) => {
      setEditingData(data);
      setShowForm(true);
  };

  const handleExport = async () => {
    try {
        const response = await api.get('/osmedical/export', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Data_OS_Medical.xlsx');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
    } catch (error) {
        console.error("Gagal export data:", error);
        alert("Gagal mengunduh file Excel");
    }
  };

  return (
    <div className="container-fluid px-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="text-dark mb-0">Medical Check Up OS</h3>
      </div>
      <div className='row g-3 mb-4 align-items-center'>
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group">
            <input 
              type="text" 
              className="form-control" 
              placeholder="Cari ID atau Nama Karyawan..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-outline-primary" onClick={handleSearch}>
              Cari
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-lg-8 d-flex justify-content-md-end gap-2">
          <button className="btn btn-success px-4 fw-semibold shadow-sm d-flex align-items-center justify-content-center" onClick={handleExport}>
            Export ke Excel
          </button>
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold shadow-sm d-flex align-items-center justify-content-center`}
            onClick={handleAdd}
          >
            {showForm ? 'Tutup Form' : '+ Tambah Data'}
          </button>
        </div>
      </div>
      {showForm && (
        <OsMedicForm 
          onClose={() => setShowForm(false)} 
          onSuccess={handleRefresh} 
          initialData={editingData}
        />
      )}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <OsMedicTable 
            refreshTrigger={refreshKey} 
            onEditClick={handleEdit}
            searchTerm={appliedSearch}
          />          
        </div>
      </div>
  </div>
  );
}
export default OsMedical;