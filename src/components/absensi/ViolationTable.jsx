import React, { useState, useEffect } from 'react';

import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const ViolationTable = ({ refreshTrigger, onEditClick, searchTerm, subCompany, startDate, endDate }) => { 
    
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
                end_date: endDate || ''
            }).toString();
            const response = await api.get(`/violation?${params}`);
            const result = response.data;
            if (result.status === 'success') { 
                setAbsensi(result.data);
                setTotalPages(result.total_page);
            } 
            else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subCompany, startDate, endDate]);
    
    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger, searchTerm, subCompany, startDate, endDate]);

    return (<>
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
                </tr>
            </thead>
            <tbody>
                { absensi.length > 0 ? absensi.map((emp, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{emp.employee_code}</td>
                        <td>{emp.employee_name}</td>
                        <td>{emp.gender}</td>
                        <td>{emp.subCom}</td>
                        <td>{emp.card}</td>
                        <td>{emp.cc}</td>
                        <td>{emp.date_clocking}</td>
                        <td>{emp.clocking_in}</td>
                        <td>{emp.clocking_out}</td>
                    </tr>
                )) : (
                    <tr><td colSpan="9" className="empty-state">Data tidak ditemukan</td></tr>
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
export default ViolationTable;