import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const AbsenVendorReport = ({ 
    refreshTrigger, 
    searchTerm, 
    subCompany, 
    startDate, 
    endDate, 
    statusFilter,
    clockingType, // Tangkap prop filter jenis
}) => { 
    
    const [absensi, setAbsensi] = useState([]);   
    const [error, setError] = useState(null);     
    const [loading, setLoading] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    // +++ STATE UNTUK SORTING +++
    const [sortConfig, setSortConfig] = useState({ key: 'tgl_clocking', direction: 'DESC' });

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const params = new URLSearchParams({
                page: currentPage,
                pageSize: itemsPerPage,
                search: searchTerm || '',
                sub_company: subCompany || '',
                start_date: startDate || '',
                end_date: endDate || '',
                status_filter: statusFilter || 'all_data',
                clocking_type: clockingType || 'all_data', 
                sort_by: sortConfig.key,
                sort_dir: sortConfig.direction 
            }).toString();

            const response = await api.get(`/absensiVendor?${params}`);
            const result = response.data;
            
            if (result.status === 'success') { 
                setAbsensi(result.data);
                setTotalPages(result.total_page || 0);
            } else { 
                throw new Error(result.message || 'Terjadi kesalahan pada data absensi'); 
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Gagal terhubung ke server');
            setAbsensi([]);
            setTotalPages(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subCompany, startDate, endDate, statusFilter, clockingType, sortConfig]);
    
    useEffect(() => {
        if (!startDate || !endDate) return;
        fetchData();
    }, [currentPage, itemsPerPage, refreshTrigger, searchTerm, subCompany, startDate, endDate, statusFilter, clockingType, sortConfig]);

    const formatDateTime = (dateTimeStr) => {
        if (!dateTimeStr || dateTimeStr === 'null' || dateTimeStr === 'None' || dateTimeStr === '-') {
            return { date: '-', time: '' };
        }
        try {
            if (dateTimeStr.includes(',')) {
                const parts = dateTimeStr.split(' ');
                const dd = parts[1];
                const mmm = parts[2].toUpperCase(); 
                const yyyy = parts[3];
                const timePart = parts[4].substring(0, 5).replace(':', '.');
                return { date: `${dd} ${mmm} ${yyyy}`, time: timePart };
            }
            const cleanStr = dateTimeStr.replace('T', ' ');
            const parts = cleanStr.split(' '); 
            const datePart = parts[0]; 
            const timePart = parts[1] ? parts[1].substring(0, 5) : ''; 
            const [yyyy, mm, dd] = datePart.split('-');
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGS', 'SEP', 'OKT', 'NOV', 'DES'];
            const dateStr = `${dd} ${months[parseInt(mm, 10) - 1]} ${yyyy}`;
            return { date: dateStr, time: timePart.replace(':', '.') };
        } catch (e) {
            return { date: dateTimeStr, time: '' };
        }
    };

    const requestSort = (key) => {
        let direction = 'ASC';
        if (sortConfig.key === key && sortConfig.direction === 'ASC') {
            direction = 'DESC';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <i className="bi bi-arrow-down-up text-muted ms-1" style={{ fontSize: '0.75rem', opacity: 0.3 }}></i>;
        if (sortConfig.direction === 'ASC') return <i className="bi bi-arrow-up text-primary ms-1"></i>;
        return <i className="bi bi-arrow-down text-primary ms-1"></i>;
    };

    return (
    <>
        {error && <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>{error}</div>}        
        <div className="table-responsive">
            <table className="app-table table-hover table-striped mb-3" style={{ fontSize: '0.9rem' }}>

            <thead className="table-light">
                <tr>
                    <th onClick={() => requestSort('tgl_clocking')} style={{ cursor: 'pointer' }} className="text-nowrap user-select-none">
                        Waktu Clocking {getSortIcon('tgl_clocking')}
                    </th>
                    <th onClick={() => requestSort('jenis_clocking')} style={{ cursor: 'pointer' }} className="user-select-none">
                        Jenis {getSortIcon('jenis_clocking')}
                    </th>
                    <th onClick={() => requestSort('mode')} style={{ cursor: 'pointer' }} className="user-select-none">
                        Mode {getSortIcon('mode')}
                    </th>
                    <th onClick={() => requestSort('comp_id')} style={{ cursor: 'pointer' }} className="user-select-none">
                        Sub Company {getSortIcon('comp_id')}
                    </th>
                    <th onClick={() => requestSort('emp_id')} style={{ cursor: 'pointer' }} className="user-select-none">
                        NRP / Emp ID {getSortIcon('emp_id')}
                    </th>
                    <th onClick={() => requestSort('card_no')} style={{ cursor: 'pointer' }} className="user-select-none">
                        No Kartu {getSortIcon('card_no')}
                    </th>
                    <th onClick={() => requestSort('display_name')} style={{ cursor: 'pointer' }} className="user-select-none">
                        Nama Karyawan {getSortIcon('display_name')}
                    </th>
                    <th>Ket Reject</th>
                </tr>
            </thead>

            <tbody>
                {(!startDate || !endDate) ? (
                    <tr>
                        <td colSpan="8" className="empty-state text-center py-5 text-muted">
                            <i className="bi bi-funnel d-block mb-2 fs-3 text-primary"></i>
                            Silakan tentukan parameter di atas lalu klik tombol <strong>Terapkan Filter</strong> untuk menampilkan data.
                        </td>
                    </tr>
                ) : loading ? (
                    <tr>
                        <td colSpan="8" className="text-center py-4 text-muted">
                            <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                            Memuat data report...
                        </td>
                    </tr>
                ) : absensi.length > 0 ? (
                    absensi.map((emp, index) => {
                        const { date, time } = formatDateTime(emp.tgl_clocking);
                        const isReject = emp.status_data === 'Reject';

                        return (
                            <tr key={`abs-${emp.card_no}-${index}`} className={isReject ? 'table-danger' : ''}>
                                <td className="fw-bold text-nowrap">
                                    {date} {time && <span className="ms-2 text-primary">{time}</span>}
                                </td>
                                <td>{emp.jenis_clocking || '-'}</td>
                                <td>
                                    {emp.mode === 'IN' ? (
                                        <span className="badge bg-success">IN</span>
                                    ) : emp.mode === 'OUT' ? (
                                        <span className="badge bg-danger">OUT</span>
                                    ) : '-'}
                                </td>
                                <td>{emp.comp_id || '-'}</td>
                                <td className="fw-bold">{emp.emp_id || '-'}</td>
                                <td>{emp.card_no || '-'}</td>
                                <td>{emp.display_name || '-'}</td>                               
                                <td className={isReject ? 'text-danger fw-bold' : ''}>
                                    {emp.ket_reject || '-'}
                                </td>
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td colSpan="8" className="empty-state text-center py-4 text-muted">
                            <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                            Data absensi tidak ditemukan untuk filter tersebut.
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
            
            {!loading && startDate && endDate && totalPages > 1 && (
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

export default AbsenVendorReport;