import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import api from '../api/api';

const Dashboard = () => {
  const [totalActive, setTotalActive] = useState(0);
  const [totalInctive, setTotalInctive] = useState(0);
  const fetchStats = async () => {
      try {
          const response = await api.get('/employee/stats');
          if (response.data.status === 'success') {
              setTotalActive(response.data.data.total_active);
              setTotalInctive(response.data.data.total_inactive);
          }
      } catch (err) {
          console.error("Gagal mengambil data statistik:", err);
      }
  };

  useEffect(() => {
      fetchStats();
  }, []);
  return (
    <div className="container-fluid px-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="text-dark mb-0">Dashboard</h3>
      </div>
      <div className='row md-3'>
        <div className="col-md-3">
          <StatCard 
            title="Karyawan Aktif" 
            value={totalActive} 
            subtitle="Per Hari Ini" 
            icon="bi-person-check" 
            color="#00ff00" 
          />
        </div>
        <div className="col-md-3">
          <StatCard 
            title="Karyawan Tidak Aktif" 
            value={totalInctive} 
            subtitle="Per Hari Ini" 
            icon="bi-people" 
            color="#ff0000" 
          />
        </div>
      </div>      
  </div>
  );
}
export default Dashboard;