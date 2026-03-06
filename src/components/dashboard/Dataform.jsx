import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

import PersonelTab from './PersonalTab';
import EmployTab from './EmployTab';
import AsetTab from './AsetTab';

function Dataform({ onClose, onSuccess, initialData }) {
  const [activeTab, setActiveTab] = useState(0);
  const formRef = useRef(null);

  const tabs = ['Data Pribadi', 'Data Pekerjaan', 'Data Aset'];

  const handleNext = (e) => {
    e.preventDefault()
    setActiveTab((prev) => prev + 1);
  };

  const handlePrev = (e) => {
    e.preventDefault()
    setActiveTab((prev) => prev - 1);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    try {
      const response = initialData 
            ? await api.put(`/employee/${initialData.alokasi_id}`, data) 
            : await api.post('/employee/submit', data);
      if (response.data.status === 'success') {
        formRef.current.reset();
        alert(response.data.message);
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      if (error.response) {
        alert("Gagal: " + error.response.data.message);
      } else {
         alert("Gagal: " + error);
      }
    }
  };

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1050 }}
        onClick={onClose}
      ></div>

      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-xl">
          <div className="modal-content border-0 shadow-lg">
            
            <div className="card shadow-sm border-0">
              
              <div className="card-header bg-white pt-3 border-bottom-0">
                <div className="d-flex justify-content-between align-items-center mb-3 px-2">
                  <h5 className="fw-bold mb-0">Form Input Data</h5>
                  <button type="button" className="btn-close" onClick={onClose}></button>
                </div>
                <ul className="nav nav-tabs card-header-tabs" role="tablist">
                  <li className="nav-item">
                    <button 
                      type="button"
                      className={`nav-link fw-bold ${activeTab === 0 ? 'active text-primary' : 'text-secondary'}`}
                      onClick={() => setActiveTab(0)}
                    >
                      Data Pribadi
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      type="button"
                      className={`nav-link fw-bold ${activeTab === 1 ? 'active text-primary' : 'text-secondary'}`}
                      onClick={() => setActiveTab(1)}
                    >
                      Data Pekerjaan
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      type="button"
                      className={`nav-link fw-bold ${activeTab === 2 ? 'active text-primary' : 'text-secondary'}`}
                      onClick={() => setActiveTab(2)}
                    >
                      Data Aset
                    </button>
                  </li>
                </ul>
              </div>

              <form ref={formRef} onSubmit={handleSave}>
                <div className="card-body border-top">
                  <div className="tab-content py-3">
                    <div className={activeTab === 0 ? '' : 'd-none'}>
                      <PersonelTab />
                    </div>
                    <div className={activeTab === 1 ? '' : 'd-none'}>
                      <EmployTab />
                    </div>
                    <div className={activeTab === 2 ? '' : 'd-none'}>
                      <AsetTab />
                    </div>                    
                  </div>
                </div>

                <div className="card-footer bg-white d-flex justify-content-between py-3 border-top-0">
                  <div>
                    {activeTab === 0 ? (
                      <p></p>
                    ) : (
                      <button type="button" className="btn btn-outline-secondary fw-semibold" onClick={handlePrev}>
                        Sebelumnya
                      </button>
                    )}
                  </div>
                  <div>
                    {activeTab < 2 ? (
                      <button type="button" className="btn btn-primary px-4 shadow-sm fw-semibold" onClick={handleNext}>
                        Selanjutnya
                      </button>
                    ) : (
                      <button type="submit" className="btn btn-success px-4 shadow-sm fw-semibold">
                        <i className="bi bi-check-lg me-1"></i> Simpan Data
                      </button>
                    )}
                  </div>
                </div>
              </form>
              
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dataform;