import React, { useState, useEffect } from 'react';
import api from '../../api/api';
// Sesuaikan path import di bawah ini dengan struktur folder Anda
import PageNav from '../PageNav'; 

const MpEmp_Table = ({ refreshTrigger, subCompany, department, startDate, endDate }) => { 
    
    const [employees, setEmployees] = useState([]); 
    const [error, setError] = useState(null); 
    const [loading, setLoading] = useState(false);

    // State untuk Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalItem, setTotalItem] = useState(0);
    const [totalPage, setTotalPage] = useState(0);

    const fetchData = async () => {
        if (!startDate || !endDate) return;

        try {
            setLoading(true);
            setError(null);
            
            const params = new URLSearchParams({
                sub_company: subCompany || '',
                department: department || '',
                start_date: startDate || '',
                end_date: endDate || '',
                page: currentPage,
                pageSize: pageSize
            }).toString();

            const response = await api.get(`/reportMpEmp?${params}`);
            const result = response.data;
            
            if (result && result.status === 'success') { 
                setEmployees(Array.isArray(result.data) ? result.data : []);
                setTotalItem(result.total_item || 0);
                setTotalPage(result.total_page || 0);
            } else { 
                throw new Error(result?.message || 'Terjadi kesalahan saat mengambil data laporan'); 
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Gagal terhubung ke server');
            setEmployees([]);
            setTotalItem(0);
            setTotalPage(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [subCompany, department, startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [refreshTrigger, subCompany, department, startDate, endDate, currentPage]);

    return (
        <>
            {error && (
                <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                </div>
            )}        

            <div className="table-responsive">
                <table className="app-table table-hover table-striped mb-3">
                    <thead>
                        <tr>
                            <th className="text-center">Employee ID</th>
                            <th>Display Name</th>
                            <th className="text-center">Cost Center</th>
                            <th className="text-center">Working Days</th>
                            <th className="text-center">Working Hours</th>
                            <th className="text-center">Join Date</th>
                            <th className="text-center">Termination Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        { loading ? (
                            <tr>
                                <td colSpan="7" className="text-center py-4 text-muted">
                                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                    Memuat data kehadiran karyawan...
                                </td>
                            </tr>
                        ) : employees.length > 0 ? (
                            employees.map((emp, index) => (
                                <tr key={`mp-emp-${emp.emp_id}-${index}`}>
                                    <td className="text-center fw-bold">{emp.emp_id || '-'}</td>
                                    <td>{emp.display_name || '-'}</td>
                                    <td className="text-center">{emp.cc_name || '-'}</td>
                                    <td className="text-center">{emp.working_days || 0}</td>
                                    <td className="text-center text-primary fw-bold">
                                        {(emp.working_hours || 0).toFixed(2)}
                                    </td>
                                    <td className="text-center">{emp.join_date || '-'}</td>
                                    <td className="text-center">{emp.termination_date || '-'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="empty-state text-center py-4 text-muted">
                                    <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                                    Data absensi tidak ditemukan untuk periode ini
                                </td>
                            </tr>
                        )}
                    </tbody>

                </table>
            </div>        

            {!loading && totalPage > 1 && (
                <PageNav 
                    currentPage={currentPage} 
                    totalPages={totalPage} 
                    onPageChange={setCurrentPage} 
                />
            )}
        </>
    );
};

export default MpEmp_Table;