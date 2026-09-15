import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const OsTrainingTable = ({ 
  refreshTrigger, 
  onEditClick, 
  searchTerm, 
  subCompanyFilter, 
  departmentFilter 
}) => { 
  const [osTraining, setOsTraining] = useState([]);   
  const [error, setError] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        pageSize: itemsPerPage,
        search: searchTerm || '',
        subcompany: subCompanyFilter || '',
        department: departmentFilter || ''
      }).toString();

      const response = await api.get(`/ostraining?${params}`);
      const result = response.data;
      
      if (result.status === 'success') { 
        setOsTraining(result.data || []);
        setTotalPages(result.total_page || 0);
      } else { 
        throw new Error(result.message || 'Terjadi kesalahan saat mengambil data'); 
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat data training');
      setOsTraining([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    Confirm.fire({
      title: 'Hapus Data?',
      text: `Apakah Anda yakin ingin menghapus data training untuk ${name}?`,
      icon: 'warning',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await api.delete(`/ostraining/${id}`);
          if (response.data.status === 'success') {
            Toast.fire({ icon: 'success', title: response.data.message || `Data ${name} berhasil dihapus` });
            fetchData(); 
          }
        } catch (error) {
          const msg = error.response?.data?.message || error.message;
          Toast.fire({ icon: 'error', title: 'Gagal menghapus data', text: msg });
        }
      }
    });
  };

  // Reset ke halaman 1 saat filter terapan berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, subCompanyFilter, departmentFilter]);

  // Refetch data saat pagination, trigger refresh, atau filter berubah
  useEffect(() => {
    fetchData();
  }, [currentPage, refreshTrigger, searchTerm, subCompanyFilter, departmentFilter]);

  return (
    <>
      {error && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: '13px' }}>{error}</div>}        
      <div className="table-responsive">
        <table className="app-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Training Name</th>
              <th>Date From</th>
              <th>Date To</th>
              <th>Result</th>
              <th>Score</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Memuat data training...
                </td>
              </tr>
            ) : osTraining.length > 0 ? (
              osTraining.map((emp, index) => (
                <tr key={`row-${emp.osTraining_id || index}`}>
                  <td><strong className="text-primary">{emp.employee_code}</strong></td>
                  <td>{emp.employee_name}</td>
                  <td>{emp.training_name || '-'}</td>
                  <td>{emp.v_training_date_from ? emp.v_training_date_from : '-'}</td>
                  <td>{emp.v_training_date_to ? emp.v_training_date_to : '-'}</td>
                  <td>
                    {emp.training_result == 1 ? (
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Lulus</span>
                    ) : (
                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">Tidak Lulus</span>
                    )}
                  </td>                        
                  <td>
                    <span className="fw-semibold text-dark">
                      {emp.training_score !== null && emp.training_score !== undefined ? emp.training_score : '-'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn-app btn-ghost-app btn-sm-app me-1" 
                      onClick={() => onEditClick(emp)}
                      title="Edit Training"
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>
                    <button 
                      className="btn-app btn-danger-app btn-sm-app"
                      onClick={() => handleDelete(emp.osTraining_id, emp.employee_name)}
                      title="Hapus Training"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center py-4 text-muted">
                  <i className="bi bi-inbox d-block fs-3 mb-1 text-secondary"></i>
                  Data training tidak ditemukan
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <PageNav 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={(page) => setCurrentPage(page)} 
          />
        )}
      </div>        
    </>
  );
};

export default OsTrainingTable;