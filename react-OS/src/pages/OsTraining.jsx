import React, { useState } from 'react';
import OsTrainingTable from '../components/osTraining/OsTrainingTable';
import OsTrainingForm from '../components/osTraining/OsTrainingForm';

const OsTraining = () => {
    const [showForm, setShowForm] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [editingData, setEditingData] = useState(null);

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
          <h3 className="text-dark mb-0">Training OS</h3>
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold`}
            onClick={handleAdd}
          >
            {showForm ? 'Tutup Form' : '+ Tambah Data'}
          </button>
        </div>
        {showForm && (
          <OsTrainingForm 
            onClose={() => setShowForm(false)} 
            onSuccess={handleRefresh} 
            initialData={editingData}
          />
        )}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
              <OsTrainingTable 
                refreshTrigger={refreshKey} 
                onEditClick={handleEdit}
              />          
          </div>
        </div>

      </div>
     );
}
export default OsTraining;