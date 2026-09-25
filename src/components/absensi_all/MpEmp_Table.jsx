import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav'; 

const MpEmp_Table = ({ 
    refreshTrigger, 
    searchTerm, 
    subCompany, 
    department, 
    startDate, 
    endDate 
}) => { 
    
    const [employees, setEmployees] = useState([]); 
    const [error, setError] = useState(null); 
    const [loading, setLoading] = useState(false);

    // State Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalItem, setTotalItem] = useState(0);
    const [totalPage, setTotalPage] = useState(0);

    const fetchData = async () => {
        if (!startDate || !endDate) return;

        try {
            setLoading(true);
            setError(null);
            
            const params = new URLSearchParams({
                search: searchTerm || '',
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

    // Reset ke halaman 1 jika filter terapan diubah
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subCompany, department, startDate, endDate]);

    // Refetch data saat pagination, trigger refresh, atau filter berubah
    useEffect(() => {
        fetchData();
    }, [refreshTrigger, searchTerm, subCompany, department, startDate, endDate, currentPage]);

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '-';
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return dateStr;

        return dateObj.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const renderDateRange = () => {
        if (!startDate || !endDate) {
            return (
                <span className="text-muted fst-italic">
                    <i className="bi bi-calendar-x me-1.5 text-warning"></i>
                    Periode belum dipilih
                </span>
            );
        }

        const startFormatted = formatDisplayDate(startDate);
        const endFormatted = formatDisplayDate(endDate);

        if (startDate === endDate) {
            return (
                <span className="d-inline-flex align-items-center text-secondary">
                    <i className="bi bi-calendar3 me-2 text-primary"></i>
                    <span className="fw-semibold me-2">Periode:</span>
                    <span className="badge bg-white text-dark border px-2.5 py-1.5 fw-medium shadow-sm">
                        {startFormatted}
                    </span>
                </span>
            );
        }

        return (
            <span className="d-inline-flex align-items-center text-secondary">
                <i className="bi bi-calendar3 me-2 text-primary"></i>
                <span className="fw-semibold me-2">Periode:</span>
                <span className="badge bg-white text-dark border px-2 py-1 fw-medium shadow-sm">
                    {startFormatted}
                </span>
                <i className="bi bi-arrow-right mx-1.5 text-muted small"></i>
                <span className="badge bg-white text-dark border px-2 py-1 fw-medium shadow-sm">
                    {endFormatted}
                </span>
            </span>
        );
    };

    return (
        <>
            {error && (
                <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                </div>
            )} 

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-2 px-3 mb-3 bg-light bg-opacity-50 border rounded-3">
                <div className="d-flex align-items-center">
                    {renderDateRange()}
                </div>
                {totalItem > 0 && (
                    <div className="d-flex align-items-center">
                        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-1.5 fw-semibold">
                            <i className="bi bi-people-fill me-1.5"></i>
                            {totalItem.toLocaleString('id-ID')} Data
                        </span>
                    </div>
                )}
            </div>       

            <div className="table-responsive">
                <table className="app-table table-hover table-striped mb-3">
                    <thead>
                        <tr>
                            <th className="text-center">Employee ID</th>
                            <th>Display Name</th>
                            <th className="text-center">Cost Center</th>
                            <th className="text-center">Working Days</th>
                            <th className="text-center">Working Hours (jam)</th>
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
                                <tr key={`mp-emp-${emp.emp_id || index}-${index}`}>
                                    <td className="text-center fw-bold text-primary">{emp.emp_id || '-'}</td>
                                    <td>{emp.display_name || '-'}</td>
                                    <td className="text-center">{emp.cc_name || '-'}</td>
                                    <td className="text-center">{emp.working_days || 0}</td>
                                    <td className="text-center text-primary fw-bold">
                                        {Number(emp.working_hours || 0).toFixed(2)}
                                    </td>
                                    <td className="text-center">{emp.join_date || '-'}</td>
                                    <td className="text-center">{emp.termination_date || '-'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="empty-state text-center py-4 text-muted">
                                    <i className="bi bi-inbox d-block mb-1 fs-4 text-secondary"></i>
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