import React, { useState, useRef } from 'react';
import { saveAs } from 'file-saver';
import api from '../api/api';
import OsMedicForm from '../components/osMedical/osMedicForm';
import OsMedicTable from '../components/osMedical/osMedicTable';

const OsMedical = () => {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingData, setEditingData] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

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
        saveAs(response.data, 'Data_OS_medical.xlsx')
    } catch (error) {
        console.error("Gagal export data:", error);
        alert("Gagal mengunduh file Excel");
    }
  };
  const handleDownloadTemplate = async () => {
    try {
        const { data } = await api.get('/osmedical/template', { responseType: 'blob' });
        saveAs(data, 'Template_Import_OS_Medical.xlsx');
    } catch (error) {
        alert("Gagal mengunduh template");
    }
  };
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await api.post('/osmedical/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert(response.data.message);
        handleRefresh();        
    } catch (error) {
        const serverResponse = error.response?.data;
        const errorList = serverResponse?.errors;
        if (errorList && errorList.length > 0) {
            alert(`Gagal import:\n\n${errorList.join('\n')}`);
        } else {
            alert("Gagal import: " + (serverResponse?.message || "Cek format file"));
        }
    } finally {
        setIsUploading(false); 
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
          <button className="btn btn-outline-secondary btn-sm" onClick={handleDownloadTemplate}>
            Template (Import)
          </button>
          <label className={`btn ${isUploading ? 'btn-secondary' : 'btn-outline-primary'} px-4 fw-semibold shadow-sm d-flex align-items-center`}>
            {isUploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Processing...
              </>
            ) : (
              <>Import From Excel</>
            )}
            <input 
              type="file" 
              hidden 
              ref={fileInputRef}
              onChange={handleImport} 
              accept=".xlsx, .xls" 
              disabled={isUploading}
            />
          </label>
          <button className="btn btn-success px-4 fw-semibold shadow-sm d-flex align-items-center justify-content-center" onClick={handleExport}>
            Export To Excel
          </button>          
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold shadow-sm d-flex align-items-center justify-content-center`}
            onClick={handleAdd}
          >
            {showForm ? 'Close Form' : '+ Add New'}
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