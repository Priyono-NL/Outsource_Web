import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const ReportAktif_Table = ({ 
  refreshTrigger, 
  searchTerm,
  filterSubCompany, 
  filterDepartment,
  filterTargetDate, // Prop baru
  isFilterApplied 
}) => {
  const [employees, setEmployees] = useState([]);
  const [error, setError]         = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const PAGE_SIZE = 20;

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage, 
        pageSize: PAGE_SIZE,
        search: searchTerm || '', 
        status: 'active', // Kita kunci di active karena ini report karyawan aktif
        sub_company: filterSubCompany || '', 
        department: filterDepartment || '',
        target_date: filterTargetDate || '' // Kirim ke Backend
      }).toString();
      
      const res = await api.get(`/employee?${params}`);
      if (res.data.status === 'success') {
        setEmployees(res.data.data);
        setTotalPages(res.data.total_page);
      } else throw new Error(res.data.message);
    } catch (err) { 
      setError(err.message); 
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    if (!isFilterApplied) return;
    setCurrentPage(1); 
  }, [searchTerm, filterSubCompany, filterDepartment, filterTargetDate, isFilterApplied]);

  useEffect(() => { 
    if (!isFilterApplied) return;
    fetchData(); 
  }, [currentPage, refreshTrigger, searchTerm, filterSubCompany, filterDepartment, filterTargetDate, isFilterApplied]);

  return (
    <>
      {error && <div className="alert alert-danger m-3">{error}</div>}
      <div className="table-responsive">
        <table className="app-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Nama</th>
              <th>Gender</th>
              <th>Sub Company</th>
              <th>Department</th>
              <th>Card No.</th>
              <th>Type Worker</th>
              <th>Posisi</th>
              <th>Valid From</th>
              <th>Valid To</th>
            </tr>
          </thead>
          <tbody>
            {!isFilterApplied ? (
              <tr>
                <td colSpan="10" className="empty-state text-center py-5 text-muted">
                  <i className="bi bi-funnel d-block mb-2 fs-3 text-primary"></i>
                  Silakan tentukan parameter filter di atas lalu klik tombol <strong>Terapkan Filter</strong>.
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan="10" className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                  Memuat data...
                </td>
              </tr>
            ) : employees.length > 0 ? (
              employees.map((emp, i) => (
                <tr key={emp.id || i}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{emp.employee_code}</span></td>
                  <td style={{ fontWeight: 500 }}>{emp.person_name}</td>
                  <td>{emp.gender}</td>
                  <td>{emp.sub_con_name}</td>
                  <td>{emp.cc_name ? emp.cc_name : '-'}</td>
                  <td>{emp.card_number ? emp.card_number : '-'}</td>
                  <td>{emp.type_worker ? emp.type_worker : '-'}</td>
                  <td>{emp.posisi ? emp.posisi : '-'}</td>
                  <td>{emp.valid_from ? emp.v_valid_from : '-'}</td>
                  <td>
                    {emp.valid_to
                      ? <span className={new Date(emp.valid_to) < new Date(filterTargetDate || new Date()) ? 'badge-inactive' : ''}>{emp.v_valid_to}</span>
                      : <span className="badge-active">Aktif</span>}
                  </td>                  
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="empty-state text-center py-4 text-muted">
                  <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                  Data karyawan aktif pada {filterTargetDate} tidak ditemukan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isFilterApplied && totalPages > 1 && (
        <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </>
  );
};

export default ReportAktif_Table;