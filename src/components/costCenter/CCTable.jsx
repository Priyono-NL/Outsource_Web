import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/api';
import PageNav from '../PageNav';

const CCTable = ({ refreshTrigger, onEditClick }) => { 
       
    const [costCenter, setCostCenter] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0); 

    const fetchData = async() => {
    try {
        const response = await api.get(`/costcenter?page=${currentPage}&pageSize=${itemsPerPage}`);
        const result = await response.data;
        if (result.status === 'success') { 
            setCostCenter(result.data);
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
                const response = await api.delete(`/costcenter/${id}`);
                if (response.data.status === 'success') {
                    toast.success(response.data.message);                
                    fetchData(); 
                }
            } catch (error) {
                const msg = error.response?.data?.message || error.message;
                toast.error("Gagal menghapus data: " + msg);
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                    <th className="py-3">Company ID</th>
                    <th className="py-3">Org ID</th>
                    <th className="py-3">Cost Center Name</th>
                    <th className="py-3">Cost Center ID</th>
                    <th className='py-3'>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                costCenter.map((cc, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{cc.company_id}</td>
                        <td>{cc.org_id}</td>
                        <td>{cc.org_name}</td>
                        <td>{cc.cost_center}</td>                        
                        <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditClick(cc)}>
                                Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(cc.cost_center, cc.org_name)}
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
export default CCTable;