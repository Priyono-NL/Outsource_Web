import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

// [FIX] 1. Tangkap semua props filter, termasuk department dan periodePuasa
const GuestTable = ({ refreshTrigger, onEditClick, searchTerm, filterTerm, subCompanyFilter, departmentFilter, periodePuasaFilter }) => { 
       
    const [guest, setGuest] = useState([]);   
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            // [FIX] 2. Format parameter puasa (Hindari mengirim 'all' ke database)
            const puasaParam = (!periodePuasaFilter || periodePuasaFilter === 'all') ? '' : periodePuasaFilter;
            
            // [FIX] 3. Rangkai URL API lengkap dengan seluruh filter
            const response = await api.get(
                `/guest?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm || ''}&filter=${filterTerm || ''}&subcompany=${subCompanyFilter || ''}&department=${departmentFilter || ''}&periode_puasa_id=${puasaParam}`
            );
            
            const result = response.data; 
            
            if (result.status === 'success') { 
                setGuest(result.data);
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
            text: `Apakah Anda yakin ingin menghapus akses kantin untuk ${name}?`,
            icon: 'warning',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await api.delete(`/guest/${id}`);
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

    // [FIX] 4. Reset halaman ke 1 jika ada satu saja filter yang berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterTerm, subCompanyFilter, departmentFilter, periodePuasaFilter]);

    // [FIX] 5. Tambahkan seluruh filter ke dalam dependency array
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, refreshTrigger, searchTerm, filterTerm, subCompanyFilter, departmentFilter, periodePuasaFilter]);

    return (
        <>
            {error && <div className="alert alert-danger">{error}</div>}        
            <div className="table-responsive">
                <table className="app-table">
                <thead>
                    <tr>
                        <th>Employee ID</th>
                        <th>Employee Name</th>
                        <th>Canteen</th>
                        <th>Kategori / Alasan</th> {/* Kolom Hibrida Baru */}
                        <th>Valid From</th>
                        <th>Valid To</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>{                  
                    guest.map((emp, index) => (
                        <tr key={`row-${index+1}`} >
                            <td>{emp.employee_code}</td>
                            <td>{emp.employee_name}</td>
                            <td>{emp.canteen_name}</td>
                            
                            {/* [FIX] Rendering Visual untuk Mode Hibrida */}
                            <td>
                                {emp.is_puasa_allowlist ? (
                                    <span className="badge bg-warning text-dark border border-warning shadow-sm" style={{ fontSize: '0.7rem' }}>
                                        <i className="bi bi-moon-stars-fill me-1"></i> Puasa
                                    </span>
                                ) : (
                                    <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>Guest Reguler</span>
                                )}
                                {emp.reason && emp.reason !== '-' && (
                                    <div className="mt-1 fw-bold" style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                        {emp.reason}
                                    </div>
                                )}
                            </td>

                            <td>{emp.v_valid_from ? emp.v_valid_from : '-'}</td>
                            <td>{emp.v_valid_to ? emp.v_valid_to : '-'}</td>
                            <td>
                                <button className="btn-app btn-ghost-app btn-sm-app me-1" onClick={() => onEditClick(emp)} title="Edit Data">
                                    <i className="bi bi-pencil-square"></i>
                                </button>
                                <button className="btn-app btn-danger-app btn-sm-app"
                                    onClick={() => handleDelete(emp.guest_id, emp.employee_name)} title="Hapus Data"
                                >
                                    <i className="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                </table>
                {guest.length === 0 && !error && (
                    <div className="text-center py-4 text-muted">Tidak ada data ditemukan.</div>
                )}
                <PageNav 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={(page) => setCurrentPage(page)} 
                />
            </div>        
        </>
    );
};

export default GuestTable;