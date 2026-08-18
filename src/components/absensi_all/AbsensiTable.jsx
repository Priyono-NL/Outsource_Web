import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const AbsensiTable = ({ refreshTrigger, onEditClick, searchTerm, subCompany, startDate, endDate, statusFilter }) => { 
    
    const [absensi, setAbsensi] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async () => {
        try {
            setError(null);
            const params = new URLSearchParams({
                page: currentPage,
                pageSize: itemsPerPage,
                search: searchTerm || '',
                sub_company: subCompany || '',
                start_date: startDate || '',
                end_date: endDate || '',
                status_filter: statusFilter || 'all_data'
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
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subCompany, startDate, endDate, statusFilter]);
    
    useEffect(() => {
        if (!startDate || !endDate) return;
        fetchData();
    }, [currentPage, itemsPerPage, refreshTrigger, searchTerm, subCompany, startDate, endDate, statusFilter]);

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
            <table className="app-table">
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
                    <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
            </thead>
            <tbody>
                {(!startDate || !endDate) ? (
                    <tr>
                        <td colSpan="15" className="empty-state text-center py-5 text-muted">
                            <i className="bi bi-funnel d-block mb-2 fs-3 text-primary"></i>
                            Silakan tentukan parameter di atas lalu klik tombol <strong>Terapkan Filter</strong> untuk menampilkan data.
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

                        // =========================================================
                        // 1. EVALUASI CLOCK IN (PRIORITAS: BAC > ANOMALI > MESIN)
                        // =========================================================
                        if (emp.bac_clock_in) {
                            displayClockIn = formatTime(emp.bac_clock_in);
                            isClockInFromBAC = true;
                        } else if (isAnomaly && emp.full_clock_in && emp.full_clock_in !== 'null') {
                            displayClockIn = formatTime(emp.full_clock_in);
                        } else {
                            displayClockIn = formatTime(emp.clock_in);
                        }

                        // =========================================================
                        // 2. EVALUASI CLOCK OUT (PRIORITAS: BAC > ANOMALI > MESIN)
                        // =========================================================
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
                        let actionElement = null;

                        // =========================================================
                        // 3. BADGE STATUS DAN AKSI KOREKSI
                        // =========================================================
                        if (hasBAC) {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>
                                    <i className="bi bi-shield-check" style={{ marginRight: '4px' }}></i>
                                    BAC Found
                                </span>
                            );                        
                            actionElement = (
                                <button 
                                    className="btn-app btn-warning-app" 
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                    onClick={() => onEditClick(emp)}
                                    title="Koreksi Data Absensi"
                                >
                                    <i className="bi bi-pencil-square" style={{ marginRight: '4px' }}></i>
                                    Koreksi
                                </button>
                            );
                        } else if (isAnomaly) {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>
                                    <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '4px' }}></i>
                                    Anomali
                                </span>
                            );
                            actionElement = (
                                <button 
                                    className="btn-app btn-warning-app" 
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                    onClick={() => onEditClick(emp)}
                                    title="Koreksi Data Absensi Anomali"
                                >
                                    <i className="bi bi-pencil-square" style={{ marginRight: '4px' }}></i>
                                    Koreksi
                                </button>
                            );
                        } else if (!isViolation) {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#198754', fontWeight: 'bold' }}>
                                    <i className="bi bi-check-circle-fill" style={{ marginRight: '4px' }}></i>
                                    Lengkap
                                </span>
                            );
                            actionElement = statusElement;
                        } else {
                            statusElement = (
                                <span style={{ fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>
                                    <i className="bi bi-x-circle-fill" style={{ marginRight: '4px' }}></i>
                                    BAC not found
                                </span>
                            );
                            actionElement = (
                                <button 
                                    className="btn-app btn-warning-app" 
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                    onClick={() => onEditClick(emp)}
                                    title="Koreksi Data Absensi"
                                >
                                    <i className="bi bi-pencil-square" style={{ marginRight: '4px' }}></i>
                                    Koreksi
                                </button>
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

                                <td style={{ textAlign: 'center' }}>
                                    {actionElement}
                                </td>
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td colSpan="15" className="empty-state text-center py-4 text-muted">
                            <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                            Data absensi tidak ditemukan untuk filter tersebut.
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
            
            {startDate && endDate && (
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

export default AbsensiTable;