import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav'; 

const BreakReport_Table = ({ refreshTrigger, subCompany, department, startDate, endDate }) => { 
    
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
                sub_company_id: subCompany || '',
                department_id: department || '',
                start_date: startDate || '',
                end_date: endDate || '',
                page: currentPage,
                pageSize: pageSize
            }).toString();

            const response = await api.get(`/reportBreak?${params}`);
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

    // Fungsi helper untuk menentukan warna badge status
    const getStatusBadgeClass = (statusStr) => {
        if (!statusStr) return 'bg-secondary';
        
        const s = statusStr.toLowerCase();
        if (s.includes('normal break')) return 'bg-success';
        if (s.includes('>60')) return 'bg-warning text-dark';
        if (s.includes('no clocking')) return 'bg-danger';
        
        return 'bg-secondary';
    };

    return (
        <>
            {error && (
                <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                </div>
            )}        

            <div className="table-responsive">
                <table className="app-table table-hover table-striped mb-3" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    <thead>
                        <tr>
                            <th className="text-center">Employee Id</th>
                            <th>Display Name</th>
                            <th className="text-center">Absence Card No</th>
                            <th className="text-center">Tanggal OUT</th>
                            <th className="text-center">Jam OUT</th>
                            <th className="text-center">Tanggal Makan</th>
                            <th className="text-center">Jam Makan</th>
                            <th className="text-center">Tanggal IN</th>
                            <th className="text-center">Jam IN</th>
                            <th className="text-center">Access Area</th>
                            <th className="text-center">Total</th>
                            <th className="text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        { loading ? (
                            <tr>
                                <td colSpan="12" className="text-center py-4 text-muted">
                                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                    Memuat data log istirahat...
                                </td>
                            </tr>
                        ) : employees.length > 0 ? (
                            employees.map((emp, index) => (
                                <tr key={`mp-emp-${emp.emp_id}-${index}`}>
                                    <td className="text-center fw-bold">{emp.emp_id || '-'}</td>
                                    <td>{emp.display_name || '-'}</td>
                                    <td className="text-center">{emp.card_number || '-'}</td>
                                    <td className="text-center">{emp.tanggal_out || ''}</td>
                                    <td className="text-center">{emp.jam_out || ''}</td>
                                    <td className="text-center">{emp.tanggal_makan || ''}</td>
                                    <td className="text-center">{emp.jam_makan || ''}</td>
                                    <td className="text-center">{emp.tanggal_in || ''}</td>
                                    <td className="text-center">{emp.jam_in || ''}</td>
                                    <td className="text-center">{emp.access_area || '-'}</td>
                                    <td className="text-center fw-bold">{emp.total !== undefined ? emp.total : '-'}</td>
                                    <td className="text-center">
                                        <span className={`badge ${getStatusBadgeClass(emp.status)}`}>
                                            {emp.status || '-'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="12" className="empty-state text-center py-4 text-muted">
                                    <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                                    Data absensi istirahat tidak ditemukan untuk periode ini
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

export default BreakReport_Table;