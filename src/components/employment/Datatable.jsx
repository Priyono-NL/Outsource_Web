import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const Datatable = ({ refreshTrigger, onViewClick, onEditClick, searchTerm, filterStatus, filterSubCompany, filterDepartment }) => {
  const [employees, setEmployees] = useState([]);
  const [error, setError]         = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(0);
  const PAGE_SIZE = 20;

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage, 
        pageSize: PAGE_SIZE,
        search: searchTerm || '', 
        status: filterStatus || 'all',
        sub_company: filterSubCompany || '', 
        department: filterDepartment || '',
      }).toString();
      
      const res = await api.get(`/employee?${params}`);
      if (res.data.status === 'success') {
        setEmployees(res.data.data);
        setTotalPages(res.data.total_page);
      } else throw new Error(res.data.message);
    } catch (err) { 
      setError(err.message); 
    }
  };

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterSubCompany, filterDepartment]);
  useEffect(() => { fetchData(); }, [currentPage, refreshTrigger, searchTerm, filterStatus, filterSubCompany, filterDepartment]);

  const handleDeactivate = async (pkId, empCode) => {
    const res = await Confirm.fire({
      title: `Nonaktifkan ${empCode}?`,
      text: 'Masa berlaku akan diakhiri per kemarin (H-1).',
      icon: 'warning', 
      showCancelButton: true,
      confirmButtonColor: '#d33', 
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Nonaktifkan!', 
      cancelButtonText: 'Batal',
    });
    if (!res.isConfirmed) return;
    try {
      const r = await api.put(`/employee/deactivate/${pkId}`);
      if (r.data.status === 'success') { 
        Toast.fire({ icon: 'success', title: r.data.message }); 
        fetchData(); 
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: err.response?.data?.message || 'Gagal menonaktifkan karyawan' });
    }
  };

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
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {employees.length > 0 ? employees.map((emp, i) => (
              <tr key={emp.id || i}>
                <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{emp.employee_code}</span></td>
                <td style={{ fontWeight: 500 }}>{emp.person_name}</td>
                <td>{emp.gender}</td>
                <td>{emp.sub_con_name}</td>
                <td>{emp.cc_name ? emp.cc_name : '-'}</td>
                <td>{emp.card_number}</td>
                <td>{emp.type_worker ? emp.type_worker : '-'}</td>
                <td>{emp.posisi ? emp.posisi : '-'}</td>
                <td>{emp.valid_from ? emp.v_valid_from : '-'}</td>
                <td>
                  {emp.valid_to
                    ? <span className={new Date(emp.valid_to) < new Date() ? 'badge-inactive' : ''}>{emp.v_valid_to}</span>
                    : <span className="badge-active">Aktif</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className="btn-app btn-ghost-app btn-sm-app" 
                      onClick={() => onViewClick(emp)}
                      title="Lihat Detail"
                    >
                      <i className="bi bi-eye" />
                    </button>

                    <button 
                      className="btn-app btn-ghost-app btn-sm-app" 
                      onClick={() => onEditClick(emp)}
                      title="Edit Data"
                    >
                      <i className="bi bi-pencil-square" />
                    </button>

                    {(emp.valid_to === null || new Date(emp.valid_to) >= new Date()) && (
                      <button 
                        className="btn-app btn-danger-app btn-sm-app" 
                        onClick={() => handleDeactivate(emp.id, emp.employee_code)}
                        title="Nonaktifkan Karyawan"
                      >
                        <i className="bi bi-person-x" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="9" className="empty-state">Data tidak ditemukan</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </>
  );
};

export default Datatable;