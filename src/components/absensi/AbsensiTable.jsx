import React, { useState, useEffect } from 'react';

import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const AbsensiTable = ({ refreshTrigger, onEditClick, searchTerm, filterDate }) => { 
    
    const [absensi, setAbsensi] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    // const fetchData = async() => {
    //     try {
    //         const response = await api.get(`/absensi?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}&date=${filterDate}`);
    //         const result = await response.data;
    //         if (result.status === 'success') { 
    //         setAbsensi(result.data);
    //         setTotalPages(result.total_page);
    //         } 
    //         else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
    //     } catch (err) {
    //         setError(err.message);
    //     }
    // }

    // useEffect(() => {
    //         setCurrentPage(1);
    //     }, [searchTerm, filterDate]);
    
    // useEffect(() => {
    //     fetchData();
    // }, [currentPage, refreshTrigger, searchTerm, filterDate]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="app-table">
            <thead>
                <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Tanggal Clocking</th>
                    <th>Clocking In</th>
                    
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                { absensi.length > 0 ? absensi.map((emp, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{emp.employee_code}</td>
                        <td>{emp.employee_name}</td>
                        <td>{emp.tanggal_clocking}</td>
                        <td>{emp.date_in}</td>
                        <td>
                            <button className="btn-app btn-ghost-app btn-sm-app" onClick={() => onEditClick(emp)}>
                                <i className="bi bi-pencil-square"></i>
                            </button>
                        </td>
                    </tr>
                )) : (
                    <tr><td colSpan="5" className="empty-state">Data tidak ditemukan</td></tr>
                )}
            </tbody>
            </table>
            <PageNav 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={(page) => setCurrentPage(page)} 
            />
        </div>        
    </>)
};
export default AbsensiTable;