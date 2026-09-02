import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const AbsensiReportTable = ({ 
    refreshTrigger, 
    searchTerm, 
    subCompany, 
    startDate, 
    endDate, 
    statusFilter,
    workerType // PROPS BARU
}) => { 
    
    const [absensi, setAbsensi] = useState([]);   
    const [error, setError] = useState(null); 
    
    // STATE BARU: Indikator Loading
    const [loading, setLoading] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async () => {
        try {
            setLoading(true); // Nyalakan loading sebelum request
            setError(null);
            
            const params = new URLSearchParams({
                page: currentPage,
                pageSize: itemsPerPage,
                search: searchTerm || '',
                sub_company: subCompany || '',
                start_date: startDate || '',
                end_date: endDate || '',
                status_filter: statusFilter || 'all_data',
                worker_type: workerType || 'all' 
            }).toString();

            const response = await api.get(`/absensi?${params}`);
            const result = response.data;
            
            if (result.status === 'success') { 
                setAbsensi(result.data);
                setTotalPages(result.total_page || 0);
            } else { 
                throw new Error(result.message || 'Terjadi kesalahan pada data absensi'); 
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Gagal terhubung ke server');
            setAbsensi([]); // Kosongkan data jika error
            setTotalPages(0);
        } finally {
            setLoading(false); // Matikan loading setelah request selesai (sukses/gagal)
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subCompany, startDate, endDate, statusFilter, workerType]);
    
    useEffect(() => {
        if (!startDate || !endDate) return;
        fetchData();
    }, [currentPage, itemsPerPage, refreshTrigger, searchTerm, subCompany, startDate, endDate, statusFilter, workerType]);

    // Helper formatter jam
    const formatTime = (timeStr) => {
        if (!timeStr || timeStr === 'null' || timeStr === 'None') return null;
        if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
        if (timeStr.includes(' ')) return timeStr.split(' ')[1].substring(0, 5);
        return timeStr.substring(0, 5);
    };

    return (
    <>
        {error && <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>{error}</div>}        
        <div className="table-responsive">
            <table className="app-table table-hover table-striped mb-3">
            <thead>
                <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Gender</th>
                    <th>Sub Company</th>
                    <th>Absence Card</th>
                    <th>Cost Center</th>
                    <th>Type</th>
                    <th>Clocking Date</th>
                    <th>Clocking In</th>
                    <th>Clocking Out</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Ket BAC</th>
                    <th>Updated By</th>
                    <th>Updated Date</th>
                </tr>
            </thead>
            <tbody>
                {/* 1. Kondisi jika filter belum diisi */}
                {(!startDate || !endDate) ? (
                    <tr>
                        <td colSpan="14" className="empty-state text-center py-5 text-muted">
                            <i className="bi bi-funnel d-block mb-2 fs-3 text-primary"></i>
                            Silakan tentukan parameter di atas lalu klik tombol <strong>Terapkan Filter</strong> untuk menampilkan data.
                        </td>
                    </tr>
                
                ) : loading ? (
                    <tr>
                        <td colSpan="14" className="text-center py-4 text-muted">
                            <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                            Memuat data absensi...
                        </td>
                    </tr>
                
                ) : absensi.length > 0 ? (
                    absensi.map((emp, index) => {
                        const isAnomaly = emp.is_anomaly === 1;
                        const hasBAC = !!(emp.bac_id || emp.bac_no || emp.bac_clock_in || emp.bac_clock_out);

                        let displayClockIn = null;
                        let displayClockOut = null;
                        let isClockInFromBAC = false;
                        let isClockOutFromBAC = false;

                        if (emp.bac_clock_in) {
                            displayClockIn = formatTime(emp.bac_clock_in);
                            isClockInFromBAC = true;
                        } else if (isAnomaly && emp.full_clock_in && emp.full_clock_in !== 'null') {
                            displayClockIn = formatTime(emp.full_clock_in);
                        } else {
                            displayClockIn = formatTime(emp.clock_in);
                        }

                        if (emp.bac_clock_out) {
                            displayClockOut = formatTime(emp.bac_clock_out);
                            isClockOutFromBAC = true;
                        } else if (isAnomaly && emp.full_clock_out && emp.full_clock_out !== 'null') {
                            displayClockOut = formatTime(emp.full_clock_out);
                        } else {
                            displayClockOut = formatTime(emp.clock_out);
                        }

                        const isViolation = !displayClockIn || !displayClockOut;
                        let statusElement = null;

                        if (hasBAC) {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>
                                    <i className="bi bi-shield-check" style={{ marginRight: '4px' }}></i>
                                    BAC Found
                                </span>
                            );
                        } else if (isAnomaly) {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>
                                    <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '4px' }}></i>
                                    Tidak Lengkap
                                </span>
                            );
                        } else if (!isViolation) {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#198754', fontWeight: 'bold' }}>
                                    <i className="bi bi-check-circle-fill" style={{ marginRight: '4px' }}></i>
                                    Lengkap
                                </span>
                            );
                        } else {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>
                                    <i className="bi bi-x-circle-fill" style={{ marginRight: '4px' }}></i>
                                    BAC not found
                                </span>
                            );                            
                        }

                        return (
                            <tr 
                                key={`abs-${emp.employee_id}-${emp.clocking_date}-${index}`} 
                                className={isAnomaly && !hasBAC ? 'table-warning' : ''}
                            >
                                <td className="fw-bold">{emp.employee_code || emp.employee_id}</td>
                                <td>{emp.employee_name || '-'}</td>
                                <td>{emp.gender || '-'}</td>
                                <td>{emp.subCom || '-'}</td>
                                <td>{emp.card || '-'}</td>
                                <td>{emp.cc || '-'}</td>
                                <td>{emp.type || '-'}</td>
                                <td>{emp.v_clocking_date || emp.clocking_date || '-'}</td>

                                <td style={{ 
                                    color: !displayClockIn ? '#dc3545' : (isClockInFromBAC ? '#0d6efd' : 'inherit'),
                                    fontWeight: (isClockInFromBAC || !displayClockIn) ? 'bold' : 'normal'
                                }}>
                                    {displayClockIn || 'No Clock In'}
                                </td>                            
                                
                                <td style={{ 
                                    color: !displayClockOut ? '#dc3545' : (isClockOutFromBAC ? '#0d6efd' : 'inherit'),
                                    fontWeight: (isClockOutFromBAC || !displayClockOut) ? 'bold' : 'normal'
                                }}>
                                    {displayClockOut || 'No Clock Out'}
                                </td>

                                <td style={{ textAlign: 'center' }}>
                                    {statusElement}
                                </td>

                                <td>{emp.bac_ket || '-'}</td>
                                <td>{emp.bac_updated_by || '-'}</td>
                                <td>{emp.bac_updated_date || '-'}</td>
                            </tr>
                        );
                    })
                
                ) : (
                    <tr>
                        <td colSpan="14" className="empty-state text-center py-4 text-muted">
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

export default AbsensiReportTable;