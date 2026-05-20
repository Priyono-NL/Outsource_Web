import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const AbsensiTable = ({ refreshTrigger, onEditClick, searchTerm, subCompany, startDate, endDate, statusFilter }) => { 
    
    const [absensi, setAbsensi] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
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
                setTotalPages(result.total_page);
            } else { 
                throw new Error(result.message || 'Terjadi kesalahan pada data'); 
            }
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subCompany, startDate, endDate, statusFilter]); 
    
    useEffect(() => {
        fetchData();
    }, [currentPage, itemsPerPage, refreshTrigger, searchTerm, subCompany, startDate, endDate, statusFilter]);

    return (
    <>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="app-table">
            <thead>
                <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Gender</th>
                    <th>Sub Company</th>
                    <th>Absense Card</th>
                    <th>Cost Center</th>
                    <th>Clocking Date</th>
                    <th>Clocking In</th>
                    <th>Clocking Out</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
            </thead>
            <tbody>
                { absensi.length > 0 ? absensi.map((emp, index) => {
                    const isViolation = !emp.clocking_in || !emp.clocking_out;

                    return (
                        <tr key={`row-${emp.absensi_id || index}`} >
                            <td>{emp.employee_code}</td>
                            <td>{emp.employee_name}</td>
                            <td>{emp.gender}</td>
                            <td>{emp.subCom}</td>
                            <td>{emp.card}</td>
                            <td>{emp.cc}</td>
                            <td>{emp.date_clocking}</td>
                            
                            <td style={{ color: !emp.clocking_in ? 'red' : 'inherit' }}>
                                {emp.clocking_in || 'No Clock In'}
                            </td>
                            <td style={{ color: !emp.clocking_out ? 'red' : 'inherit' }}>
                                {emp.clocking_out || 'No Clock Out'}
                            </td>

                            <td style={{textAlign: 'center'}}>
                                {isViolation ? (
                                    <span style={{ fontSize: '12px', color: 'red', fontWeight: 'bold' }}>
                                        <i className="bi bi-exclamation-circle-fill" style={{ marginRight: '4px' }}></i>
                                        BAC
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '12px', color: 'green', fontWeight: 'bold' }}>
                                        <i className="bi bi-check-circle-fill" style={{ marginRight: '4px' }}></i>
                                    </span>
                                )}
                            </td>

                            <td style={{ textAlign: 'center' }}>
                                {isViolation ? (
                                    <button 
                                        className="btn-app btn-warning-app" 
                                        style={{ padding: '4px 8px', fontSize: '12px' }}
                                        onClick={() => onEditClick(emp)}
                                        title="Koreksi Data Absensi"
                                    >
                                        <i className="bi bi-pencil-square" style={{ marginRight: '4px' }}></i>
                                        Koreksi
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '12px', color: 'green', fontWeight: 'bold' }}>
                                        <i className="bi bi-check-circle-fill" style={{ marginRight: '4px' }}></i>
                                        Lengkap
                                    </span>
                                )}
                            </td>
                        </tr>
                    );
                }) : (
                    <tr><td colSpan="10" className="empty-state" style={{ textAlign: 'center' }}>Data tidak ditemukan</td></tr>
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

export default AbsensiTable;