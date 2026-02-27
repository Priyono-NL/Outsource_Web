import React, { useState, useEffect } from 'react';
import api from '../api/api';
import PageNav from './PageNav';

const AlokasiTable = ({ refreshTrigger, onEditClick }) => { 
       
    const [alokasi, setAlokasi] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            const response = await api.get(`/alokasi?page=${currentPage}&pageSize=${itemsPerPage}`);
            const result = await response.data;
            if (result.status === 'success') { 
            setAlokasi(result.data);
            setTotalPages(result.total_page);
            } 
            else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                    <th className="py-3">Employee Name</th>
                    <th className="py-3">Canteen</th>
                    <th className="py-3">Valid From</th>
                    <th className="py-3">Valid To</th>
                    <th className='py-3'>Aksi</th>
                </tr>
            </thead>
            <tbody>{                  
                alokasi.map((emp, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{emp.employee_name}</td>
                        <td>{emp.canteen_name}</td>
                        <td>{emp.v_valid_from ? emp.v_valid_from : '-'}</td>
                        <td>{emp.v_valid_to ? emp.v_valid_from : '-'}</td>
                        <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditClick(emp)}>
                                Edit
                            </button>
                        </td>
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
export default AlokasiTable;