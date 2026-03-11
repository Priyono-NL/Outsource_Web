import React, { useState, useEffect, use } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/api';
import PageNav from '../PageNav';

const BlacklistTable = ({ refreshTrigger, onEditClick, searchTerm }) => { 
       
    const [blacklist, setBlacklist] = useState([]);   
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            const response = await api.get(`/oslist?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}`);
            const result = await response.data;
            if (result.status === 'success') { 
                setBlacklist(result.data);
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
                const response = await api.delete(`/oslist/${id}`);
                if (response.data.status === 'success') {
                    toast.success(response.data.message || `Data ${name} berhasil dihapus`);               
                    fetchData(); 
                }
            } catch (error) {
                const msg = error.response?.data?.message || error.message;
                toast.error("Gagal menghapus data: " + msg);
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
                    <th className="py-3">ID Person</th>
                    <th className="py-3">Name Person</th>
                    <th className="py-3">Blacklist</th>
                    <th className="py-3">Reason</th>
                    <th className='py-3'>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                blacklist.map((emp, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{emp.person_id}</td>
                        <td>{emp.person_name}</td>
                        <td>{emp.status_text}</td>
                        <td>{emp.block_status ? emp.block_status : '-'}</td>
                        <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditClick(emp)}>
                                Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(emp.id, emp.person_name)}
                            >
                                Delete
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
export default BlacklistTable;