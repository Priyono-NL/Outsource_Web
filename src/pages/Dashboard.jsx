import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import api from '../api/api';

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    all_total_active: 0, 
    all_total_inactive: 0,
    active_per_cost_center: {} 
  });

  useEffect(() => {
    api.get('/employee/stats')
      .then(res => { 
        if (res.data.status === 'success') {
          setStats(res.data.data); 
        }
      })
      .catch(err => console.error('Gagal mengambil statistik:', err));
  }, []);

  console.log(stats);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>
      <div className="row g-3">

        <div className="col-md-4 col-lg-3">
          <StatCard
            title="Karyawan Aktif"
            value={stats.all_total_active}
            subtitle="Per hari ini"
            icon="bi-person-check"
            color="#22c55e"
          />
        </div>

        <div className="col-md-4 col-lg-3">
          <StatCard
            title="Karyawan Tidak Aktif"
            value={stats.all_total_inactive}
            subtitle="Per hari ini"
            icon="bi-person-dash"
            color="#ef4444"
          />
        </div>

      </div>

      <div className="col-12 mt-4">
        <h5 className="text-muted">Active per Cost Center</h5>
      </div>

      <div className="row g-3">
        {stats.active_per_cost_center && 
          Object.entries(stats.active_per_cost_center)
            .filter(([_, count]) => count > 0)
            .map(([name, count]) => (
              <div className="col-md-4 col-lg-3" key={name}>
                <StatCard
                  title={name}
                  value={count}
                  subtitle="Karyawan Aktif"
                  icon="bi-building"
                  color="#3b82f6"
                />
              </div>
            ))
        }
      </div>
    </div>
  );
};
export default Dashboard;
