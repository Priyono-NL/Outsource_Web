import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const Datatable = ({ refreshTrigger, onEditClick, searchTerm }) => { 
       
    const [employees, setEmployees] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(100);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            const response = await api.get(`/employee?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}`);
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

    const handleDelete = async (id, name) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus ${name}?`)) {
            try {
                const response = await api.delete(`/osmedical/${id}`);
                if (response.data.status === 'success') {
                    alert(response.data.message);                
                    fetchData(); 
                }
            } catch (error) {
                alert("Gagal menghapus data: " + (error.response?.data?.message || error.message));
            }
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger, searchTerm]);

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
                    <th className='py-3 text-center'>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                employees.map((emp, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{emp.employee_id}</td>
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