import React, { useState, useEffect } from 'react';

function App() {
  const api_url = 'http://127.0.0.1:5000/';
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0); 
  const [totalItems, setTotalItems] = useState(0);

  const fetchData = async() => {
    try {
      const response = await fetch(`${api_url}employee?page=${currentPage}&pageSize=${itemsPerPage}`);
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

  return (
    <div className="bg-light min-vh-100">      

      <nav className="navbar navbar-dark bg-dark shadow-sm mb-4">
        <div className="container-fluid px-4">
          <span className="navbar-brand mb-0 h1 fw-bold">Manajemen OS</span>
          <div className="text-white-50 small">User</div>
        </div>
      </nav>

      <div className="container-fluid px-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="text-dark mb-0">Dashboard</h3>
          <button className="btn btn-primary px-4 fw-semibold">
            + Tambah Data
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            Error: {error}
          </div>
        )}

        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
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
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;