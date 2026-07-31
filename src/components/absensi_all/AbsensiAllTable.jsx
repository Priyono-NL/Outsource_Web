import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const AbsensiAllTable = ({ refreshTrigger, searchTerm, subCompany, startDate, endDate, statusFilter, onEditClick }) => { 
    
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

            const response = await api.get(`/absensiAll?${params}`);
            const result = response.data;
            
            if (result.status === 'success') { 
                setAbsensi(result.data);
                setTotalPages(result.total_page || 0);
            } else { 
                throw new Error(result.message || 'Terjadi kesalahan saat mengambil data absensi'); 
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

    return (
    <>
        {error && <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>{error}</div>}        
        <div className="table-responsive">
            <table className="app-table">
            <thead>
                <tr>
                    <th>Employee Code</th>
                    <th>Employee Name</th>
                    <th>Gender</th>
                    <th>Sub Company</th>
                    <th>Absence Card</th>
                    <th>Cost Center</th>
                    <th>Type</th>
                    <th>Clocking Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
            </thead>
            <tbody>
                { absensi.length > 0 ? absensi.map((emp, index) => {
                    const isViolation = !emp.clock_in || !emp.clock_out;
                    const hasBAC = emp.bac_id ? true : false;

                    let displayClockIn = emp.clock_in;
                    let displayClockOut = emp.clock_out;
                    let isClockInFromBAC = false;
                    let isClockOutFromBAC = false;
                    let statusElement = null;

                    if (!isViolation) {
                        // Absensi Lengkap (Lulus / Hijau)
                        statusElement = (
                            <span style={{ fontSize: '12px', color: '#198754', fontWeight: 'bold' }}>
                                <i className="bi bi-check-circle-fill" style={{ marginRight: '4px' }}></i>
                                Lengkap
                            </span>
                        );
                    } else if (isViolation && hasBAC) {
                        // Ada pelanggaran absensi, TETAPI diselesaikan via BAC (Biru)
                        if (emp.bac_clock_in) {
                            displayClockIn = emp.bac_clock_in;
                            isClockInFromBAC = true;
                        }

                        if (emp.bac_clock_out) {
                            displayClockOut = emp.bac_clock_out;
                            isClockOutFromBAC = true;
                        }

                        statusElement = (
                            <span style={{ fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>
                                <i className="bi bi-file-earmark-check-fill" style={{ marginRight: '4px' }}></i>
                                BAC Verified
                            </span>
                        );
                    } else {
                        // Jam Absen Tidak Lengkap & Belum Ada BAC (Merah)
                        statusElement = (
                            <span style={{ fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>
                                <i className="bi bi-exclamation-circle-fill" style={{ marginRight: '4px' }}></i>
                                Tidak Lengkap
                            </span>
                        );
                    }

                    return (
                        <tr key={`abs-${emp.employee_id}-${emp.clocking_date || index}`}>
                            <td className="fw-bold">{emp.employee_code || emp.employee_id}</td>
                            <td>{emp.employee_name || '-'}</td>
                            <td>{emp.gender || '-'}</td>
                            <td>{emp.subCom || '-'}</td>
                            <td>{emp.card || '-'}</td>
                            <td>{emp.cc || '-'}</td>
                            <td>{emp.type || '-'}</td>
                            <td>{emp.v_clocking_date || '-'}</td>

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
                        </tr>
                    );
                }) : (
                    <tr>
                        <td colSpan="11" className="empty-state text-center py-4 text-muted">
                            <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                            Data absensi tidak ditemukan
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
            
            <PageNav 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={(page) => setCurrentPage(page)} 
            />
        </div>        
    </>
    );
};

export default AbsensiAllTable;