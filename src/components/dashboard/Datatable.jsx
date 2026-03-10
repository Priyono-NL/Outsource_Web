import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const Datatable = ({ refreshTrigger, onViewClick, searchTerm, filterTerm }) => { 
       
    const [employees, setEmployees] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            const response = await api.get(`/employee?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}&filter=${filterTerm}`);
            const result = await response.data;      
            if (result.status === 'success') { 
                setEmployees(result.data);
                setTotalPages(result.total_page);
            } 
            else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterTerm]);

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger, searchTerm, filterTerm]);
    
    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                    <th className="py-3">Employee ID</th>
                    <th className="py-3">Name Employee</th>
                    <th className="py-3">Sub Company</th>
                    <th className="py-3">Valid From</th>
                    <th className="py-3">Valid To</th>
                    <th className="py-3">Action</th>
                </tr>
            </thead>
            <tbody>
                {employees.length > 0 ? (
                    employees.map((emp, index) => (
                        <tr key={`row-${emp.employee_id || index}`} className="border-bottom">
                            <td className="ps-3">{emp.employee_id}</td>
                            <td>{emp.person_name}</td>
                            <td>{emp.sub_con_name}</td>
                            <td>{emp.valid_from ? emp.v_valid_from : '-'}</td>
                            <td>{emp.valid_to ? emp.v_valid_to : '-'}</td>
                            <td className="text-center">
                                <button className="btn btn-sm btn-outline-primary" onClick={() => onViewClick(emp)}>
                                    View
                                </button>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="6" className="text-center py-5 text-muted">
                            Data tidak ditemukan
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
    </>)
};
export default Datatable;