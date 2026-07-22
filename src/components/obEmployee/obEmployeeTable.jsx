import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const ObEmployeeTable = ({ refreshTrigger, searchTerm }) => { 
       
    const [obEmployee, setObEmployee] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0); 

    const fetchData = async() => {
    try {
        const response = await api.get(`/obemployee?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}`);
        const result = await response.data;
        if (result.status === 'success') { 
            setObEmployee(result.data);
            setTotalPages(result.total_page);
        } 
        else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
    } catch (err) {
        setError(err.message);
        }
    }

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger, searchTerm]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="table-responsive">
            <table className="app-table">
            <thead>
                <tr>
                    <th>Employee Id</th>
                    <th>Employee Name</th>
                    <th>Card Number</th>
                    <th>Cost Center</th>
                </tr>
            </thead>
            <tbody>{                  
                obEmployee.map((sub, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{sub.employee_id}</td>
                        <td>{sub.employee_name}</td>
                        <td>{sub.card_no}</td>
                        <td>{sub.cost_center}</td>
                    </tr>
                ))}
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
export default ObEmployeeTable;