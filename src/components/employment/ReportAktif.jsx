import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const ReportAktif_Table = ({ 
  refreshTrigger, 
  searchTerm,
  filterSubCompany, 
  filterDepartment,
  filterTargetDate,
  isFilterApplied 
}) => {
  const [employees, setEmployees]   = useState([]);
  const [error, setError]           = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(0);
  const [isLoading, setIsLoading]   = useState(false);
  const PAGE_SIZE = 20;

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage, 
        pageSize: PAGE_SIZE,
        search: searchTerm || '', 
        status: 'active', // Dikunci ke status aktif
        sub_company: filterSubCompany || '', 
        department: filterDepartment || '',
        target_date: filterTargetDate || ''
      }).toString();
      
      const res = await api.get(`/employee?${params}`);
      if (res.data.status === 'success') {
        setEmployees(res.data.data);
        setTotalPages(res.data.total_page);
      } else {
        throw new Error(res.data.message);
      }
    } catch (err) { 
      setError(err.message); 
      setEmployees([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset pagination ke halaman 1 jika ada perubahan filter
  useEffect(() => { 
    if (!isFilterApplied) return;
    setCurrentPage(1); 
  }, [searchTerm, filterSubCompany, filterDepartment, filterTargetDate, isFilterApplied]);

  // Fetch data saat pagination atau trigger refresh berubah
  useEffect(() => { 
    if (!isFilterApplied) return;
    fetchData(); 
  }, [currentPage, refreshTrigger, searchTerm, filterSubCompany, filterDepartment, filterTargetDate, isFilterApplied]);

  // Helper Penentu Badge Aktif Presisi (Diselaraskan 100% dengan Aturan Strict Backend)
  const checkIsActive = (validFromStr, validToStr) => {
    if (!validFromStr) return false; // Aturan Backend: valid_from WAJIB terisi

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Gunakan filterTargetDate jika ada, jika tidak gunakan tanggal hari ini
    const refDate = filterTargetDate ? new Date(filterTargetDate) : today;
    refDate.setHours(0, 0, 0, 0);

    const vFrom = new Date(validFromStr);
    vFrom.setHours(0, 0, 0, 0);

    // Jika tanggal mulai berlaku berada di masa depan dari tanggal target, belum aktif
    if (vFrom > refDate) return false;

    // Jika valid_to NULL, berarti aktif tanpa batas (No Limit)
    if (!validToStr) return true;

    const vTo = new Date(validToStr);
    vTo.setHours(0, 0, 0, 0);

    // Aktif jika valid_to >= refDate
    return vTo >= refDate;
  };

  return (
    <>
      {error && <div className="alert alert-danger m-3 py-2" style={{ fontSize: '0.85rem' }}>{error}</div>}
      
      <div className="table-responsive">
        <table className="app-table table-hover table-striped">
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
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Memuat data karyawan aktif...
                </td>
              </tr>
            ) : employees.length > 0 ? (
              employees.map((emp, i) => {
                const isActive = checkIsActive(emp.valid_from, emp.valid_to);

                return (
                  <tr key={emp.id || i}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{emp.employee_code}</span></td>
                    <td style={{ fontWeight: 500 }}>{emp.person_name}</td>
                    <td>{emp.gender}</td>
                    <td>{emp.sub_con_name}</td>
                    <td>{emp.cc_name ? emp.cc_name : '-'}</td>
                    <td>{emp.card_number ? emp.card_number : '-'}</td>
                    <td>{emp.type_worker ? emp.type_worker : '-'}</td>
                    <td>{emp.posisi ? emp.posisi : '-'}</td>
                    <td>{emp.valid_from ? (emp.v_valid_from || emp.valid_from) : '-'}</td>
                    <td>
                      {isActive ? (
                        <span className="badge-active">
                          {emp.valid_to ? (emp.v_valid_to || emp.valid_to) : 'Aktif (No Limit)'}
                        </span>
                      ) : (
                        <span className="badge-inactive">
                          {emp.valid_to ? (emp.v_valid_to || emp.valid_to) : 'Inaktif'}
                        </span>
                      )}
                    </td>                 
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="10" className="empty-state text-center py-4 text-muted">
                  <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                  Data karyawan aktif pada tanggal {filterTargetDate || 'hari ini'} tidak ditemukan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && isFilterApplied && totalPages > 1 && (
        <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </>
  );
};

export default ReportAktif_Table;