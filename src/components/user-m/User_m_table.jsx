import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const User_m_table = ({ refreshTrigger, onEditClick, searchTerm }) => { 
    const [users, setUsers] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1); 

    const fetchData = async () => {
        try {
            const response = await api.get(`/api/users/management?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}`);
            const result = response.data;
            
            if (result.success || result.status === 'success') { 
                const userData = result.data?.users || (Array.isArray(result.data) ? result.data : []);
                setUsers(userData);

                const totalPg = result.data?.pagination?.total_page 
                             || result.total_page 
                             || result.data?.total_page 
                             || 1;
                             
                setTotalPages(totalPg);
            } else { 
                throw new Error(result.message || 'Terjadi kesalahan pada data'); 
            }
        } catch (err) {
            setError(err.message);
            Toast.fire({ icon: 'error', title: 'Gagal memuat data user', text: err.message });
        }
    };

    const handleDelete = async (id, email) => {
        Confirm.fire({
            title: 'Hapus User?',
            text: `Apakah Anda yakin ingin menghapus user ${email}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/api/users/${id}`);
                    if (response.data.success || response.data.status === 'success') {
                        Toast.fire({ icon: 'success', title: response.data.message || `User ${email} berhasil dihapus` });
                        fetchData(); 
                    }
                } catch (error) {
                    const msg = error.response?.data?.message || error.message;
                    Toast.fire({ icon: 'error', title: 'Gagal menghapus user', text: msg });
                }
            }
        });
    };

    const handleImpersonate = async (user) => {
        Confirm.fire({
            title: 'Impersonate User?',
            text: `Anda akan login ke dalam sistem sebagai ${user.email}. Lanjutkan?`,
            icon: 'info',
            confirmButtonText: 'Ya, Login sbg User',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.post(`/api/users/impersonate`, { email: user.email });
                    
                    if (response.data.success || response.data.status === 'success') {
                        const currentSession = localStorage.getItem('sso_user_cache');
                        localStorage.setItem('sso_admin_backup', currentSession);
                        localStorage.setItem('sso_user_cache', JSON.stringify(response.data.data.session_payload));
                        Toast.fire({ icon: 'success', title: `Berhasil masuk sebagai ${user.email}` });
                        
                        setTimeout(() => {
                            window.location.href = '/'; 
                        }, 1000);
                    }
                } catch (error) {
                    const msg = error.response?.data?.message || error.message;
                    Toast.fire({ icon: 'error', title: 'Gagal melakukan impersonate', text: msg });
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

    return (
        <>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="table-responsive">
                <table className="app-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Username / Email</th>
                            <th>Nama</th>
                            <th>Role Lokal</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length > 0 ? (
                            users.map((user, index) => (
                                <tr key={`user-row-${user.id || index}`}>
                                    <td>{(currentPage - 1) * itemsPerPage + (index + 1)}</td>
                                    <td className="fw-bold">{user.email}</td>
                                    <td>{user.nama || '-'}</td>
                                    <td>
                                        <span className="badge bg-light text-dark border">
                                            {user.role_name || 'Belum di-mapping'}
                                        </span>
                                    </td>
                                    <td>
                                        {/* TOMBOL IMPERSONATE */}
                                        <button 
                                            className="btn-app btn-outline-primary btn-sm-app me-1" 
                                            onClick={() => handleImpersonate(user)}
                                            title={`Login sebagai ${user.email}`}
                                        >
                                            <i className="bi bi-box-arrow-in-right"></i>
                                        </button>

                                        {/* TOMBOL EDIT */}
                                        <button 
                                            className="btn-app btn-ghost-app btn-sm-app me-1" 
                                            onClick={() => onEditClick(user)}
                                            title="Edit Akses"
                                        >
                                            <i className="bi bi-pencil-square"></i>
                                        </button>
                                        
                                        {/* TOMBOL DELETE */}
                                        <button 
                                            className="btn-app btn-danger-app btn-sm-app"
                                            onClick={() => handleDelete(user.id, user.email)}
                                            title="Hapus User"
                                        >
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="text-center py-3 text-muted">
                                    Tidak ada data user yang ditemukan.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                
                <PageNav 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={(page) => setCurrentPage(page)} 
                />
            </div>        
        </>
    );
};

export default User_m_table;