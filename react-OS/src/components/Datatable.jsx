import React, { useState, useEffect } from 'react';

const Datatable = ({api}) => { 
       
    const [employees, setEmployees] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0); 
    const [totalItems, setTotalItems] = useState(0);

    const fetchData = async() => {
    try {
        const response = await fetch(`${api}employee?page=${currentPage}&pageSize=${itemsPerPage}`);
        if (!response.ok) { throw new Error('Gagal mengambil data dari server'); }
        const result = await response.json();      
        if (result.status === 'success') { 
        setEmployees(result.data);
        setTotalPages(result.total_page);
        setTotalItems(result.total_item);
        } 
        else { throw new Error(result.message || 'Terjadi kesalahan pada data'); }
    } catch (err) {
        setError(err.message);
    }
    }

    useEffect(() => {
    fetchData();
    }, [currentPage, itemsPerPage]);

    const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    };

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}
        
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                <th className="py-3">employee_id</th>
                <th className="py-3">NIK</th>
                <th className="py-3">person_id</th>
                <th className="py-3">sub_company_id</th>
                <th className="py-3">valid_from</th>
                <th className="py-3 text-center">valid_to</th>
                </tr>
            </thead>
            <tbody>{                  
                employees.map((emp, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                    <td>{emp.employee_id}</td>
                    <td>{emp.nik}</td>
                    <td>{emp.person_id}</td>
                    <td>{emp.sub_company_id}</td>
                    <td>{emp.valid_from ? emp.valid_from : '-'}</td>
                    <td>{emp.valid_to ? emp.valid_to : '-'}</td>
                    </tr>
                ))}
            </tbody>
            </table>
            <div className="d-flex justify-content-between align-items-center mt-4 border-top pt-3">
            <span className="text-secondary small">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <nav>
                <ul className="pagination m-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link shadow-none" onClick={() => setCurrentPage(prev => prev - 1)}>Previous</button>
                </li>
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link shadow-none" onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
                </li>
                </ul>
            </nav>
            </div>
        </div>        
    </>)
};
export default Datatable;