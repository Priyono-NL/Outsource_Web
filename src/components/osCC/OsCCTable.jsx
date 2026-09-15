import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const OsCCTable = ({ 
  refreshTrigger, 
  onEditClick, 
  searchTerm, 
  filterTerm, 
  subCompanyFilter, 
  departmentFilter 
}) => { 
  const [osCC, setOsCC] = useState([]);   
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

      const response = await api.get(`/oscc?${params}`);
      const result = response.data;
      
      if (result.status === 'success') { 
        setOsCC(result.data || []);
        setTotalPages(result.total_page || 0);
      } else { 
        throw new Error(result.message || 'Terjadi kesalahan pada data'); 
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat data department');
      setOsCC([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    Confirm.fire({
      title: 'Hapus Data?',
      text: `Apakah Anda yakin ingin menghapus departemen untuk ${name}?`,
      icon: 'warning',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await api.delete(`/oscc/${id}`);
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
              <th>Department</th>
              <th>Valid From</th>
              <th>Valid To</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Memuat data departemen...
                </td>
              </tr>
            ) : osCC.length > 0 ? (
              osCC.map((emp, index) => (
                <tr key={`row-${emp.id_oscc || index}`}>
                  <td><strong className="text-primary">{emp.employee_code}</strong></td>
                  <td>{emp.employee_name}</td>
                  <td>
                    <span className="badge bg-light text-dark border fw-medium px-2 py-1">
                      {emp.cc_name || '-'}
                    </span>
                  </td>
                  <td>{emp.v_valid_from ? emp.v_valid_from : '-'}</td>
                  <td>{emp.v_valid_to ? emp.v_valid_to : '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn-app btn-ghost-app btn-sm-app me-1" 
                      onClick={() => onEditClick(emp)}
                      title="Edit Department"
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>
                    <button 
                      className="btn-app btn-danger-app btn-sm-app"
                      onClick={() => handleDelete(emp.id_oscc, emp.employee_name)}
                      title="Hapus Department"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">
                  <i className="bi bi-inbox d-block fs-3 mb-1 text-secondary"></i>
                  Data departemen tidak ditemukan
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

export default OsCCTable;