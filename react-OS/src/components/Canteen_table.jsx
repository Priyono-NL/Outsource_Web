import React, { useState, useEffect } from 'react';
import api from '../api/api';
import PageNav from './PageNav';

const CanteenTable = ({ refreshTrigger, onEditClick }) => { 
       
    const [Canteen, setCanteen] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0); 

    const fetchData = async() => {
    try {
        const response = await api.get(`/canteen?page=${currentPage}&pageSize=${itemsPerPage}`);
        const result = await response.data;
        if (result.status === 'success') { 
            setCanteen(result.data);
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
                const response = await api.delete(`/canteen/${id}`);
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
        fetchData();
    }, [currentPage, refreshTrigger]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                    <th className="py-3">KantinID</th>
                    <th className="py-3">Nama Kantin</th>
                    <th className='py-3'>Aksi</th>
                </tr>
            </thead>
            <tbody>{                  
                Canteen.map((can, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{can.canteen_id}</td>
                        <td>{can.canteen_name}</td>
                        <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditClick(can)}>
                                Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(can.Canteen_id, can.Canteen_name)}
                            >
                                Hapus
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
export default CanteenTable;