import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

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
        Confirm.fire({
            title: 'Hapus Data?',
            text: `Apakah Anda yakin ingin menghapus kantin ${name}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/canteen/${id}`);
                    if (response.data.status === 'success') {
                        Toast.fire({ icon: 'success', title: response.data.message || `Data ${name} berhasil dihapus` });
                        fetchData(); 
                    }
                } catch (error) {
                    const msg = error.response?.data?.message || error.message;
                    Toast.fire({ icon: 'error', title: 'Gagal menghapus data', text: msg });
                }
            }
        });
    };

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="table-responsive">
            <table className="app-table">
            <thead>
                <tr>
                    <th>Canteen ID</th>
                    <th>Canteen Name</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                Canteen.map((can, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{can.canteen_id}</td>
                        <td>{can.canteen_name}</td>
                        <td>
                            <button className="btn-app btn-ghost-app btn-sm-app" onClick={() => onEditClick(can)}>
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button className="btn-app btn-danger-app btn-sm-app"
                                onClick={() => handleDelete(can.Canteen_id, can.Canteen_name)}
                            >
                                <i class="bi bi-trash"></i>
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