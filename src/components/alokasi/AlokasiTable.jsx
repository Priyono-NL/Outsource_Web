import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

// 1. Tangkap props subCompanyFilter
const AlokasiTable = ({ refreshTrigger, onEditClick, searchTerm, filterTerm, subCompanyFilter }) => { 
       
    const [alokasi, setAlokasi] = useState([]);   
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            // 2. Sisipkan parameter &subcompany= ke dalam endpoint URL
            const response = await api.get(`/alokasi?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}&filter=${filterTerm}&subcompany=${subCompanyFilter || ''}`);
            const result = response.data; // Hapus await, Axios otomatis mem-parse JSON
            
            if (result.status === 'success') { 
                setAlokasi(result.data);
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
            text: `Apakah Anda yakin ingin menghapus alokasi untuk ${name}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/alokasi/${id}`);
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

    // 3. Reset halaman ke 1 jika filter berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterTerm, subCompanyFilter]);

    // 4. Trigger pemanggilan data jika subCompanyFilter berubah
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, refreshTrigger, searchTerm, filterTerm, subCompanyFilter]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="app-table">
            <thead>
                <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Canteen</th>
                    <th>Valid From</th>
                    <th>Valid To</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                alokasi.map((emp, index) => (
                    <tr key={`row-${index+1}`} >
                        <td>{emp.employee_code}</td>
                        <td>{emp.employee_name}</td>
                        <td>{emp.canteen_name}</td>
                        <td>{emp.v_valid_from ? emp.v_valid_from : '-'}</td>
                        <td>{emp.v_valid_to ? emp.v_valid_to : '-'}</td>
                        <td>
                            <button className="btn-app btn-ghost-app btn-sm-app me-1" onClick={() => onEditClick(emp)}>
                                <i className="bi bi-pencil-square"></i>
                            </button>
                            <button className="btn-app btn-danger-app btn-sm-app"
                                onClick={() => handleDelete(emp.alokasi_id, emp.employee_name)}
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

export default AlokasiTable;