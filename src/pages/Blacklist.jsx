import React, { useState } from 'react';
import BlacklistForm from '../components/blacklist/BlacklistForm';
import BlacklistTable from '../components/blacklist/BlacklistTable';

const Blacklist = () => {
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

     return (
        <div className="container-fluid px-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="text-dark mb-0">Blacklist Person</h3>
          <div className="flex-grow-1 mx-4" style={{ maxWidth: '500px' }}>
            <div className="input-group">
              <input 
                type="text" 
                className="form-control" 
                placeholder="Cari NIK atau Nama Karyawan..." 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className="btn btn-outline-primary" onClick={handleSearch}>
                Cari
              </button>
            </div>
          </div>
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold`}
            onClick={handleAdd}
          >
            {showForm ? 'Close Form' : '+ Add New'}
          </button>
        </div>
        {showForm && (
          <BlacklistForm 
            onClose={() => setShowForm(false)} 
            onSuccess={handleRefresh} 
            initialData={editingData}
          />
        )}
        <div className="card border-0 shadow-sm">          
          <div className="card-body p-0">
              <BlacklistTable 
                refreshTrigger={refreshKey} 
                onEditClick={handleEdit}
                searchTerm={appliedSearch}
              />          
          </div>
        </div>

      </div>
     );
}
export default Blacklist;