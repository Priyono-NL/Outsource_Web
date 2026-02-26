import React, { useState } from 'react';
import Datatable from '../components/Datatable';
import Dataform from '../components/Dataform';

const Dashboard = ({ api }) => {
    const [showForm, setShowForm] = useState(false);

     return (
        <div className="container-fluid px-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="text-dark mb-0">Dashboard</h3>
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold`}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Tutup Form' : '+ Tambah Data'}
          </button>          
        </div>
        {showForm && <Dataform onClose={() => setShowForm(false)} />}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
              <Datatable api={api} />          
          </div>
        </div>

      </div>
     );
}
export default Dashboard;