import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const Terminal_table = ({ refreshTrigger, onEditClick, searchTerm }) => { 
       
    const [terminal, setTerminal] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0); 

    const fetchData = async() => {
    try {
        const response = await api.get(`/terminal?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}`);
        const result = await response.data;
        if (result.status === 'success') { 
            setTerminal(result.data);
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
            text: `Apakah Anda yakin ingin menghapus Terminal ${name}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/terminal/${id}`);
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
                    <th>Terminal Id</th>
                    <th>Terminal Name</th>
                    <th>Terminal Type</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                terminal.map((sub, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{sub.terminal_id}</td>
                        <td>{sub.terminal_name}</td>
                        <td>{sub.terminal_type}</td>
                        <td>
                            <button className="btn-app btn-ghost-app btn-sm-app" onClick={() => onEditClick(sub)}>
                                <i className="bi bi-pencil-square"></i>
                            </button>
                            <button className="btn-app btn-danger-app btn-sm-app"
                                onClick={() => handleDelete(sub.id, sub.terminal_name)}
                            >
                                <i className="bi bi-trash"></i>
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
export default Terminal_table;