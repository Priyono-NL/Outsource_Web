import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

// 1. Tambahkan subCompanyFilter pada props
const OsTrainingTable = ({ refreshTrigger, onEditClick, searchTerm, subCompanyFilter }) => { 
       
    const [osTraining, setOsTraining] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            // 2. Sisipkan parameter &subcompany= ke URL API
            const response = await api.get(`/ostraining?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}&subcompany=${subCompanyFilter || ''}`);
            const result = response.data; // Hapus await
            
            if (result.status === 'success') { 
                setOsTraining(result.data);
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
            text: `Apakah Anda yakin ingin menghapus training untuk ${name}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/ostraining/${id}`);
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

    // 3. Tambahkan subCompanyFilter agar halaman kembali ke 1 saat filter diubah
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subCompanyFilter]);
    
    // 4. Tambahkan subCompanyFilter agar men-trigger fetch ulang
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, refreshTrigger, searchTerm, subCompanyFilter]);

    return (
        <>
            {error && <div className="alert alert-danger">{error}</div>}        
            <div className="table-responsive">
                <table className="app-table">
                <thead>
                    <tr>
                        <th>Employee ID</th>
                        <th>Employee Name</th>
                        <th>Training Name</th>
                        <th>Date From</th>
                        <th>Date To</th>
                        <th>Result</th>
                        <th>Score</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>{                  
                    osTraining.map((emp, index) => (
                        <tr key={`row-${index+1}`} >
                            <td>{emp.employee_code}</td>
                            <td>{emp.employee_name}</td>
                            <td>{emp.training_name}</td>
                            <td>{emp.v_training_date_from ? emp.v_training_date_from : '-'}</td>
                            <td>{emp.v_training_date_to ? emp.v_training_date_to : '-'}</td>
                            <td>{emp.training_result == 1 ? (
                                    <span className="badge bg-success">Lulus</span>
                                ) : (
                                    <span className="badge bg-danger">Tidak Lulus</span>
                                )}
                            </td>                        
                            <td>{emp.training_score ? emp.training_score : '-'}</td>
                            <td>
                                <button className="btn-app btn-ghost-app btn-sm-app me-1" onClick={() => onEditClick(emp)}>
                                    <i className="bi bi-pencil-square"></i>
                                </button>
                                <button className="btn-app btn-danger-app btn-sm-app"
                                    onClick={() => handleDelete(emp.osTraining_id, emp.employee_name)}
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
        </>
    )
};

export default OsTrainingTable;