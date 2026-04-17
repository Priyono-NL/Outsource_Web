import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import api from '../api/api';

const Dashboard = () => {
  const [stats, setStats] = useState({ total_active: 0, total_inactive: 0 });

  useEffect(() => {
    api.get('/employee/stats')
      .then(res => { if (res.data.status === 'success') setStats(res.data.data); })
      .catch(err => console.error('Gagal mengambil statistik:', err));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>
      <div className="row g-3">
        <div className="col-md-4 col-lg-3">
          <StatCard
            title="Karyawan Aktif"
            value={stats.total_active}
            subtitle="Per hari ini"
            icon="bi-person-check"
            color="#22c55e"
          />
        </div>
        <div className="col-md-4 col-lg-3">
          <StatCard
            title="Karyawan Tidak Aktif"
            value={stats.total_inactive}
            subtitle="Per hari ini"
            icon="bi-person-dash"
            color="#ef4444"
          />
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
