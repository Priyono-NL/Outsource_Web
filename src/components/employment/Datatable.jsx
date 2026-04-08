import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';
import PageNav from '../PageNav';

const Datatable = ({ 
    refreshTrigger, onViewClick
    , searchTerm, filterStatus, 
    filterSubCompany, filterDepartment
}) => {
    const [employees, setEmployees] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            const queryParams = new URLSearchParams({
                page: currentPage,
                pageSize: itemsPerPage,
                search: searchTerm || "",
                status: filterStatus || "all",
                sub_company: filterSubCompany || "",
                department: filterDepartment || ""
            }).toString();

            const response = await api.get(`/employee?${queryParams}`);
            const result = await response.data;      
            if (result.status === 'success') { 
                setEmployees(result.data);
                setTotalPages(result.total_page);
            } 
            else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterSubCompany, filterDepartment]);

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger, searchTerm, filterStatus, filterSubCompany, filterDepartment]);

    const handleDeactivate = async (pkId, empCode) => {
        const result = await Confirm.fire({
            title: `Nonaktifkan ${empCode}?`,
            text: "Masa berlaku akan diakhiri per kemarin (H-1).",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Nonaktifkan!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
            const response = await api.put(`/employee/deactivate/${pkId}`);
            if (response.data.status === 'success') {
                Toast.fire({ icon: 'success', title: response.data.message });
                // Panggil fungsi untuk refresh data tabel Anda (misal: fetchData())
                fetchData(); 
            }
            } catch (error) {
            Toast.fire({ 
                icon: 'error', 
                title: error.response?.data?.message || "Gagal menonaktifkan karyawan" 
            });
            }
        }
        };
    
    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                    <th className="py-3">Employee ID</th>
                    <th className="py-3">Name Employee</th>
                    <th className="py-3">Gender</th>
                    <th className="py-3">Sub Company</th>
                    <th className="py-3">Departement</th>
                    <th className="py-3">Card Number</th>
                    <th className="py-3">Valid From</th>
                    <th className="py-3">Valid To</th>
                    <th className="py-3">Action</th>
                </tr>
            </thead>
            <tbody>
                {employees.length > 0 ? (
                    employees.map((emp, index) => (
                        <tr key={`row-${emp.id || index}`} className="border-bottom">
                            <td className="ps-3">{emp.employee_code}</td>
                            <td>{emp.person_name}</td>
                            <td>{emp.gender}</td>
                            <td>{emp.sub_con_name}</td>
                            <td>{emp.cc_name}</td>
                            <td>{emp.card_number}</td>
                            <td>{emp.valid_from ? emp.v_valid_from : '-'}</td>
                            <td>{emp.valid_to ? emp.v_valid_to : '-'}</td>
                            <td className="text-center">
                                <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onViewClick(emp)}>
                                    <i className="bi bi-eye"></i> View
                                </button>
                                {(emp.valid_to === null || new Date(emp.valid_to) >= new Date()) && (
                                    <button 
                                        className="btn btn-sm btn-outline-danger me-2"
                                        title="Nonaktifkan Karyawan"
                                        onClick={() => handleDeactivate(emp.id, emp.employee_code)}
                                    >
                                        <i className="bi bi-person-x"></i> Deactivate
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="9" className="text-center py-5 text-muted">
                            Data tidak ditemukan
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
    </>)
};
export default Datatable;