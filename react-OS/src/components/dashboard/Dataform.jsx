import React, { useState, useRef } from 'react';
import PersonelTab from './PersonalTab';
import EmployTab from './EmployTab';
import AsetTab from './AsetTab';

function Dataform({ onClose }) {
  const [activeTab, setActiveTab] = useState('pribadi');
  const formRef = useRef(null);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const data = Object.fromEntries(formData.entries());
    console.log("Data yang akan dikirim:", data);
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
                      className={`nav-link fw-bold ${activeTab === 'pribadi' ? 'active text-primary' : 'text-secondary'}`}
                      onClick={() => setActiveTab('pribadi')}
                    >
                      Data Pribadi
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`nav-link fw-bold ${activeTab === 'pekerjaan' ? 'active text-primary' : 'text-secondary'}`}
                      onClick={() => setActiveTab('pekerjaan')}
                    >
                      Data Pekerjaan
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`nav-link fw-bold ${activeTab === 'aset' ? 'active text-primary' : 'text-secondary'}`}
                      onClick={() => setActiveTab('aset')}
                    >
                      Data Aset
                    </button>
                  </li>
                </ul>
              </div>
              <form ref={formRef} onSubmit={handleSave}>
                <div className="card-body border-top">
                  <div className="tab-content py-3">
                    <div className={activeTab === 'pribadi' ? '' : 'd-none'}>
                      <PersonelTab />
                    </div>
                    <div className={activeTab === 'pekerjaan' ? '' : 'd-none'}>
                      <EmployTab />
                    </div>
                    <div className={activeTab === 'aset' ? '' : 'd-none'}>
                      <AsetTab />
                    </div>                    
                  </div>
                </div>              
              <div className="card-footer bg-white d-flex justify-content-end py-3 border-top-0">
                <button type="button" className="btn btn-light me-2 fw-semibold" onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-primary px-4 shadow-sm fw-semibold">
                  <i className="bi bi-check-lg me-1"></i> Simpan Data
                </button>
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