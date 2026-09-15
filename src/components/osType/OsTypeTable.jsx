import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const OsTypeTable = ({ 
  refreshTrigger, 
  onEditClick, 
  searchTerm, 
  filterTerm, 
  subCompanyFilter, 
  departmentFilter 
}) => { 
  const [osType, setOsType] = useState([]);   
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
        filter: filterTerm || 'all',
        subcompany: subCompanyFilter || '',
        department: departmentFilter || ''
      }).toString();

      const response = await api.get(`/ostype?${params}`);
      const result = response.data;
      
      if (result.status === 'success') { 
        setOsType(result.data || []);
        setTotalPages(result.total_page || 0);
      } else { 
        throw new Error(result.message || 'Terjadi kesalahan pada data'); 
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat data tipe worker');
      setOsType([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    Confirm.fire({
      title: 'Hapus Data?',
      text: `Apakah Anda yakin ingin menghapus tipe worker untuk ${name}?`,
      icon: 'warning',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await api.delete(`/ostype/${id}`);
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

  // Reset ke halaman 1 jika filter terapan diubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTerm, subCompanyFilter, departmentFilter]);

  // Load data ketika halaman atau props terapan diubah
  useEffect(() => {
    fetchData();
  }, [currentPage, refreshTrigger, searchTerm, filterTerm, subCompanyFilter, departmentFilter]);

  return (
    <>
      {error && <div className="alert alert-danger py-2 mb-3" style={{ fontSize: '13px' }}>{error}</div>}        
      <div className="table-responsive">
        <table className="app-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Type Worker</th>
              <th>Posisi/Jabatan</th>
              <th>Valid From</th>
              <th>Valid To</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Memuat data tipe worker...
                </td>
              </tr>
            ) : osType.length > 0 ? (
              osType.map((emp, index) => (
                <tr key={`row-${emp.id_OsType || index}`}>
                  <td><strong className="text-primary">{emp.employee_code}</strong></td>
                  <td>{emp.employee_name}</td>
                  <td>
                    <span className="badge bg-light text-dark border fw-medium px-2 py-1">
                      {emp.type_worker || '-'}
                    </span>
                  </td>
                  <td>{emp.posisi || '-'}</td>
                  <td>{emp.v_valid_from ? emp.v_valid_from : '-'}</td>
                  <td>{emp.v_valid_to ? emp.v_valid_to : '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn-app btn-ghost-app btn-sm-app me-1" 
                      onClick={() => onEditClick(emp)}
                      title="Edit Type Worker"
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>
                    <button 
                      className="btn-app btn-danger-app btn-sm-app"
                      onClick={() => handleDelete(emp.id_OsType, emp.employee_name)}
                      title="Hapus Type Worker"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-4 text-muted">
                  <i className="bi bi-inbox d-block fs-3 mb-1 text-secondary"></i>
                  Data tipe worker tidak ditemukan
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

export default OsTypeTable;