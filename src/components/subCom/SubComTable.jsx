import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import PageNav from '../PageNav';

const SubComTable = ({ refreshTrigger, onEditClick }) => { 
       
    const [SubCom, setSubCom] = useState([]);   
    const [error, setError] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(0); 

    const fetchData = async() => {
    try {
        const response = await api.get(`/subcom?page=${currentPage}&pageSize=${itemsPerPage}`);
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
        if (window.confirm(`Apakah Anda yakin ingin menghapus ${name}?`)) {
            try {
                const response = await api.delete(`/subcom/${id}`);
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
    fetchData();
    }, [currentPage, refreshTrigger]);

    return (<>
        {error && <div className="alert alert-danger">{error}</div>}        
        <div className="table-responsive">
            <table className="table align-middle mb-0">
            <thead className="table">
                <tr>
                    <th className="py-3">Sub Company Id</th>
                    <th className="py-3">Sub Company Name</th>
                    <th className="py-3">Company Type</th>
                    <th className='py-3'>Action</th>
                </tr>
            </thead>
            <tbody>{                  
                SubCom.map((sub, index) => (
                    <tr key={`row-${index+1}`} className="border-bottom">
                        <td>{sub.sub_company_id}</td>
                        <td>{sub.sub_company_name}</td>
                        <td>{sub.type_company}</td>
                        <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onEditClick(sub)}>
                                Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(sub.sub_company_id, sub.sub_company_name)}
                            >
                                Delete
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