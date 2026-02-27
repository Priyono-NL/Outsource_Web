import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const OsMedicTable = ({ refreshTrigger, onEditClick, searchTerm  }) => { 
       
    const [osmedical, setOsMedical] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(100);
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = async() => {
        try {
            const response = await api.get(`/osmedical?page=${currentPage}&pageSize=${itemsPerPage}&search=${searchTerm}`);
            const result = await response.data;
            if (result.status === 'success') { 
            setOsMedical(result.data);
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
                const response = await api.delete(`/osmedical/${id}`);
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
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, [currentPage, refreshTrigger, searchTerm]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                    <th className="py-3">Employee ID</th>
                    <th className="py-3">Employee Name</th>
                    <th className="py-3">Medical Check</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Result</th>
                    <th className="py-3">Notes</th>
                    <th className='py-3'>Aksi</th>
                </tr>
            </thead>
            <tbody>{                  
                osmedical.map((emp, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{emp.employee_id}</td>
                        <td>{emp.employee_name}</td>
                        <td>{emp.medical_name}</td>
                        <td>{emp.v_medical_date ? emp.v_medical_date : '-'}</td>
                        <td>{emp.medical_result}</td>                        
                        <td>{emp.medical_notes ? emp.medical_notes : '-'}</td>
                        <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditClick(emp)}>
                                Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(emp.osMedical_id, emp.employee_name)}
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
export default OsMedicTable;