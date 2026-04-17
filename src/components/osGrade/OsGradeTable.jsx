import React, { useState, useEffect, use } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const OsGradeTable = ({ refreshTrigger, onEditClick, searchTerm, filterTerm }) => { 
       
    const [card, setCard] = useState([]);   
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(100);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            const response = await api.get(`/osgrade?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}&filter=${filterTerm}`);
            const result = await response.data;
            if (result.status === 'success') { 
                setCard(result.data);
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
            text: `Apakah Anda yakin ingin menghapus grade untuk ${name}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/osgrade/${id}`);
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
    }, [searchTerm, filterTerm]);

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger, searchTerm, filterTerm]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="app-table">
            <thead>
                <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Grade</th>
                    <th>Valid From</th>
                    <th>Valid To</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                card.map((emp, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{emp.employee_code}</td>
                        <td>{emp.employee_name}</td>
                        <td>{emp.grade}</td>
                        <td>{emp.v_valid_from ? emp.v_valid_from : '-'}</td>
                        <td>{emp.v_valid_to ? emp.v_valid_to : '-'}</td>
                        <td>
                            <button className="btn-app btn-ghost-app btn-sm-app" onClick={() => onEditClick(emp)}>
                                <i className="bi bi-pencil-square"></i>
                            </button>
                            <button className="btn-app btn-danger-app btn-sm-app"
                                onClick={() => handleDelete(emp.grade_id, emp.employee_name)}
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
export default OsGradeTable;