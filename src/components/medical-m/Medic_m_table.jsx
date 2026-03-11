import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/api';
import PageNav from '../PageNav';

const Medic_m_table = ({ refreshTrigger, onEditClick }) => { 
       
    const [Medical, setMedical] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0); 

    const fetchData = async() => {
    try {
        const response = await api.get(`/medical?page=${currentPage}&pageSize=${itemsPerPage}`);
        const result = await response.data;
        if (result.status === 'success') { 
            setMedical(result.data);
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
                const response = await api.delete(`/medical/${id}`);
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
                    <th className="py-3">Medical Id</th>
                    <th className="py-3">Medical Name</th>
                    <th className="py-3">Fasilitas Kesehatan</th>
                    <th className='py-3'>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                Medical.map((sub, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{sub.medical_id}</td>
                        <td>{sub.medical_name}</td>
                        <td>{sub.faskes}</td>
                        <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditClick(sub)}>
                                Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(sub.medical_id, sub.medical_name)}
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
export default Medic_m_table;