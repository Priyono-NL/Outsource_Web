import React, { useState, useEffect } from 'react';
import api from '../api/api';
import PageNav from './PageNav';

const Datatable = ({api}) => { 
       
    const [employees, setEmployees] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0); 
    const [totalItems, setTotalItems] = useState(0);

    const fetchData = async() => {
        try {
            const response = await fetch(`${api}/employee?page=${currentPage}&pageSize=${itemsPerPage}`);
            if (!response.ok) { throw new Error('Gagal mengambil data dari server'); }
            const result = await response.json();      
            if (result.status === 'success') { 
            setEmployees(result.data);
            setTotalPages(result.total_page);
            setTotalItems(result.total_item);
            } 
            else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
    fetchData();
    }, [currentPage, itemsPerPage]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                <th className="py-3">employee_id</th>
                <th className="py-3">NIK</th>
                <th className="py-3">person_id</th>
                <th className="py-3">sub_company_id</th>
                <th className="py-3">valid_from</th>
                <th className="py-3 text-center">valid_to</th>
                </tr>
            </thead>
            <tbody>{                  
                employees.map((emp, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                    <td>{emp.employee_id}</td>
                    <td>{emp.nik}</td>
                    <td>{emp.person_name}</td>
                    <td>{emp.sub_con_name}</td>
                    <td>{emp.valid_from ? emp.valid_from : '-'}</td>
                    <td>{emp.valid_to ? emp.valid_to : '-'}</td>
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
export default Datatable;