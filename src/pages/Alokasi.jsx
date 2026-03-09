import React, { useState } from 'react';
import AlokasiForm from '../components/alokasi/AlokasiForm';
import AlokasiTable from '../components/alokasi/AlokasiTable';

const Alokasi = () => {
    const [showForm, setShowForm] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [editingData, setEditingData] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [filterTerm, setFilterTerm] = useState("all");
    
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
          <h3 className="text-dark mb-0">Alokasi Kantin</h3>
          <div className="flex-grow-1 mx-4" style={{ maxWidth: '500px' }}>
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
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold`}
            onClick={handleAdd}
          >
            {showForm ? 'Close Form' : '+ Add New'}
          </button>
        </div>
        {showForm && (
          <AlokasiForm 
            onClose={() => setShowForm(false)} 
            onSuccess={handleRefresh} 
            initialData={editingData}
          />
        )}
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="row g-3 align-items-end">

              <div className="col-md-3">
                <label className="form-label small fw-bold">Status</label>
                <select 
                  className="form-select"
                  value={filterTerm} 
                  onChange={(e) => setFilterTerm(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

            </div>
          </div>
          <div className="card-body p-0">
              <AlokasiTable 
                refreshTrigger={refreshKey} 
                onEditClick={handleEdit}
                searchTerm={appliedSearch}
                filterTerm={filterTerm}
              />          
          </div>
        </div>

      </div>
     );
}
export default Alokasi;