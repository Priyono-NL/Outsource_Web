import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const SubComTable = ({ refreshTrigger, onEditClick, searchTerm }) => { 
       
    const [SubCom, setSubCom] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0); 

    const fetchData = async() => {
    try {
        const response = await api.get(`/subcom?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}`);
        const result = await response.data;
        if (result.status === 'success') { 
            setSubCom(result.data);
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
            text: `Apakah Anda yakin ingin menghapus sub company ${name}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/subcom/${id}`);
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
                    <th>Sub Company Id</th>
                    <th>Sub Company Name</th>
                    <th>Company Type</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                SubCom.map((sub, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{sub.sub_company_id}</td>
                        <td>{sub.sub_company_name}</td>
                        <td>{sub.type_company}</td>
                        <td>
                            <button className="btn-app btn-ghost-app btn-sm-app" onClick={() => onEditClick(sub)}>
                                <i className="bi bi-pencil-square"></i>
                            </button>
                            <button className="btn-app btn-danger-app btn-sm-app"
                                onClick={() => handleDelete(sub.sub_company_id, sub.sub_company_name)}
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
export default SubComTable;