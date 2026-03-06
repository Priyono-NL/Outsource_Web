import React, { useState } from 'react';
import Medic_m_form from '../components/medical-m/Medic_m_form';
import Medic_m_table from '../components/medical-m/Medic_m_table';

const Medical_m = () => {
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
          <h3 className="text-dark mb-0">Master Medical</h3>
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold`}
            onClick={handleAdd}
          >
            {showForm ? 'Close Form' : '+ Add New'}
          </button>          
        </div>
        {showForm && (
          <Medic_m_form 
            onClose={() => setShowForm(false)} 
            onSuccess={handleRefresh} 
            initialData={editingData}
          />
        )}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
              <Medic_m_table 
                refreshTrigger={refreshKey} 
                onEditClick={handleEdit}
              />
          </div>
        </div>

      </div>
     );
}
export default Medical_m;