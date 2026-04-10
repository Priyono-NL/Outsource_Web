import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

import PersonelTab from './PersonalTab';
import EmployTab from './EmployTab';
import AsetTab from './AsetTab';

function DataFrom({ onClose, onSuccess, initialData: propsData }) {
  const [activeTab, setActiveTab] = useState(0);
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);  
  const [initialData, setInitialData] = useState(propsData || { is_blacklist: "No in Blacklist" });
  const [previewUrl, setPreviewUrl] = useState("/no_image.png");
  const BASE_URL = 'http://localhost:5000';
  
  useEffect(() => {
    if (initialData?.photo_url) {
      const fullUrl = initialData.photo_url.startsWith('http') 
        ? initialData.photo_url 
        : `${BASE_URL}${initialData.photo_url}`;
      setPreviewUrl(fullUrl);
    } else if (!selectedFile) {
      setPreviewUrl("/no_image.png");
    }
  }, [initialData, selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) { URL.revokeObjectURL(previewUrl); }
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return; 
    if (!file.type.startsWith('image/')) {
      Toast.fire({ 
        icon: 'error', 
        title: 'Format tidak didukung',
        text: 'Harap pilih file gambar (JPG, PNG, atau WebP).' 
      });
      e.target.value = "";
      return;
    }
    if (previewUrl && previewUrl.startsWith('blob:')) { URL.revokeObjectURL(previewUrl); }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
  
  const handleNext = (e) => {
    e.preventDefault()
    if (initialData?.is_blacklist === "Blacklist") {
      Toast.fire({
        icon: 'error',
        title: 'Akses Ditolak!',
        text: 'Personel ini masuk dalam daftar Blacklist dan tidak dapat diproses lebih lanjut.',
      });
      return;
    }
    setActiveTab((prev) => prev + 1);
  };

  const handlePrev = (e) => {
    e.preventDefault()
    setActiveTab((prev) => prev - 1);
  };  

  const handlePersonSelect = (person) => {
    setInitialData({
      is_blacklist: person.is_blacklist,
      photo: person.photo
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const customConfig = { headers: { 'Content-Type': 'multipart/form-data', } };
    const formData = new FormData(formRef.current);
    if (selectedFile) { formData.append('photo', selectedFile); }
    console.log(Object.fromEntries(formData));
    try {
      const response = await api.post('/employee/submit', formData, customConfig);
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
                        src={previewUrl}
                        className="rounded" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => e.target.src = "/src/assets/no_image.png"}
                      />
                    </div>

                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="d-none" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                    />

                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-primary mt-3 px-4"
                      onClick={() => fileInputRef.current.click()}
                    >
                      Pilih Foto
                    </button>

                    <div className="mt-4 w-100 px-3">
                      <label className='fw-bold text-muted small d-block mb-2 text-center'>Status Blacklist</label>
                      <div className="text-center">
                        <span className={`badge p-2 w-100 ${initialData?.is_blacklist === 'Blacklist' ? 'bg-danger' : ''}`}>
                          <i className={`bi ${initialData?.is_blacklist === 'Blacklist' ? 'bi-shield-slash-fill' : 'bi-shield-check-fill'} me-2`}></i>
                          {initialData?.is_blacklist === 'Blacklist' ? 'BLACKLISTED' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-8 ps-md-4">
                    <ul className="nav nav-pills mb-4 bg-light p-1 rounded" role="tablist">
                      {['Data Pribadi', 'Data Pekerjaan', 'Data Aset'].map((label, index) => {
                        const isLocked = initialData?.is_blacklist === 'Blacklist' && index > 0;
                        return (
                          <li className="nav-item flex-fill" key={index}>
                            <button 
                              type="button"
                              disabled={isLocked}
                              className={`nav-link w-100 fw-bold border-0 ${activeTab === index ? 'active shadow-sm' : 'text-secondary bg-transparent'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                              onClick={() => !isLocked && setActiveTab(index)}
                            >
                              {isLocked ? <i className="bi bi-lock-fill me-1"></i> : null}
                              {label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="tab-content" style={{ minHeight: '400px' }}>
                      <div className={activeTab === 0 ? 'animate__animated animate__fadeIn' : 'd-none'}>
                        <PersonelTab onPersonSelect={handlePersonSelect} />
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
                    <button 
                      type="button" 
                      className={`btn px-5 shadow-sm fw-bold ${initialData?.is_blacklist === 'Blacklist' ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={handleNext}
                      disabled={initialData?.is_blacklist === 'Blacklist'} 
                    >
                      {initialData?.is_blacklist === 'Blacklist' ? 'Blacklist' : 'Selanjutnya'}
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