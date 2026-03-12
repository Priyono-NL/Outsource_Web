import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

import PersonelTab from './PersonalTab';
import EmployTab from './EmployTab';
import AsetTab from './AsetTab';

function DataFrom({ onClose, onSuccess, initialData }) {
  const [activeTab, setActiveTab] = useState(0);
  const formRef = useRef(null);
  
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
    console.log(data);
    try {
      const response = initialData 
            ? await api.put(`/employee/${initialData.employee_id}`, data) 
            : await api.post('/employee/submit', data);
      if (response.data.status === 'success') {
        formRef.current.reset();
        Toast.fire({ icon: 'success', title: response.data.message });
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.message || "Terjadi kesalahan server" });
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} onClick={onClose}></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            
            {/* Header Modal */}
            <div className="modal-header bg-white border-bottom-0 pt-4 px-4">
              <h5 className="fw-bold mb-0">Form Input Data</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body px-4">
                <div className="row">
                  
                  <div className="col-md-4 border-end d-flex flex-column align-items-center justify-content-start pt-3">
                    <div 
                      className="border rounded d-flex align-items-center justify-content-center mb-3 shadow-sm bg-light"
                      style={{ width: '250px', height: '250px', overflow: 'hidden' }}
                    >
                      <img 
                        src="\src\assets\no_image.png"
                        className="rounded img-thumbnail" 
                        style={{ width: '200px', height: '200px', objectFit: 'cover' }} 
                      />
                    </div>
                    <label className="fw-bold text-muted small mt-2">Nanti Buat upload Foto</label>
                    <button type="button" className="btn btn-sm btn-outline-primary mt-3 px-4">
                       Pilih Foto
                    </button>

                    <label className='fw-bold text-muted small mt-2'>Status Blacklist</label>
                    
                  </div>

                  <div className="col-md-8 ps-md-4">
                    <ul className="nav nav-pills mb-4 bg-light p-1 rounded" role="tablist">
                      {['Data Pribadi', 'Data Pekerjaan', 'Data Aset'].map((label, index) => (
                        <li className="nav-item flex-fill" key={index}>
                          <button 
                            type="button"
                            className={`nav-link w-100 fw-bold border-0 ${activeTab === index ? 'active shadow-sm' : 'text-secondary bg-transparent'}`}
                            onClick={() => setActiveTab(index)}
                          >
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="tab-content" style={{ minHeight: '400px' }}>
                      <div className={activeTab === 0 ? 'animate__animated animate__fadeIn' : 'd-none'}>
                        <PersonelTab />
                      </div>
                      <div className={activeTab === 1 ? 'animate__animated animate__fadeIn' : 'd-none'}>
                        <EmployTab />
                      </div>
                      <div className={activeTab === 2 ? 'animate__animated animate__fadeIn' : 'd-none'}>
                        <AsetTab />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="modal-footer bg-white border-top py-3 px-4">
                <button 
                  type="button" 
                  className={`btn btn-outline-secondary fw-semibold ${activeTab === 0 ? 'invisible' : ''}`} 
                  onClick={handlePrev}
                >
                  Sebelumnya
                </button>
                
                <div>
                  {activeTab < 2 ? (
                    <button type="button" className="btn btn-primary px-5 shadow-sm fw-bold" onClick={handleNext}>
                      Selanjutnya
                    </button>
                  ) : (
                    <button type="submit" className="btn btn-success px-5 shadow-sm fw-bold">
                      <i className="bi bi-check-lg me-1"></i> Simpan Data
                    </button>
                  )}
                </div>
              </div>
            </form>
            
          </div>
        </div>
      </div>
    </>
  );
}

export default DataFrom;