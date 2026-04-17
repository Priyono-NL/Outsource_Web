import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

import PersonelTab from './PersonalTab';
import EmployTab from './EmployTab';
import AsetTab from './AsetTab';

function DataForm({ onClose, onSuccess, initialData: propsData }) {
  const [activeTab, setActiveTab] = useState(0);
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);  
  const [initialData, setInitialData] = useState(propsData || { is_blacklist: "No in Blacklist" });
  const [previewUrl, setPreviewUrl] = useState("/no_image.png");
  const BASE_URL = 'http://localhost:5000';
  const isEditMode = !!propsData;

  useEffect(() => {
    if (initialData?.photo) {
      const fullUrl = initialData.photo.startsWith('http') 
        ? initialData.photo 
        : `${BASE_URL}${initialData.photo}`;
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
      Toast.fire({ icon: 'error', title: 'Format tidak didukung' });
      return;
    }
    if (previewUrl && previewUrl.startsWith('blob:')) { URL.revokeObjectURL(previewUrl); }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };
  
  const handleNext = (e) => {
    e.preventDefault();
    if (initialData?.is_blacklist === "Blacklist") {
      Toast.fire({ icon: 'error', title: 'Akses Ditolak!', text: 'Personel masuk daftar Blacklist.' });
      return;
    }
    setActiveTab((prev) => prev + 1);
  };

  const handlePrev = (e) => {
    e.preventDefault();
    setActiveTab((prev) => prev - 1);
  };  

  const handlePersonSelect = (person) => {
    setInitialData({
      ...initialData,
      is_blacklist: person.is_blacklist,
      photo: person.photo
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const customConfig = { headers: { 'Content-Type': 'multipart/form-data' } };
    const formData = new FormData(formRef.current);
    
    if (selectedFile) { 
      formData.append('photo', selectedFile); 
    }
    
    try {
      const response = isEditMode 
        ? await api.put(`/employee/${propsData.id}`, formData, customConfig)
        : await api.post('/employee/submit', formData, customConfig);
        
      if (response.data.status === 'success') {
        Toast.fire({ icon: 'success', title: response.data.message || 'Data berhasil disimpan' });
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.message || "Kesalahan server" });
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${isEditMode ? 'bi-person-gear' : 'bi-pencil-square'} me-2`}></i>
                {isEditMode ? 'Edit Data Employment' : 'Form Input Data Employment'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                <div className="row">
                  
                  <div className="col-md-3 border-end text-center">
                    <div 
                      className="rounded shadow-sm border bg-light mx-auto mb-3"
                      style={{ width: '100%', maxWidth: '200px', aspectRatio: '1/1', overflow: 'hidden' }}
                    >
                      <img 
                        src={previewUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => e.target.src = "/src/assets/no_image.png"}
                        alt="Preview"
                      />
                    </div>

                    <input type="file" ref={fileInputRef} className="d-none" accept="image/*" onChange={handleFileChange} />

                    <button 
                      type="button" 
                      className="btn-app btn-ghost-app w-100 mb-4"
                      onClick={() => fileInputRef.current.click()}
                    >
                      <i className="bi bi-camera me-2"></i> Ganti Foto
                    </button>

                    <div className="px-2">
                      <label className='fw-bold text-muted small d-block mb-2'>Status Blacklist</label>
                      <span className={`badge p-2 w-100 ${initialData?.is_blacklist === 'Blacklist' ? 'bg-danger' : 'bg-success'}`} style={{ borderRadius: 'var(--radius-md)' }}>
                        <i className={`bi ${initialData?.is_blacklist === 'Blacklist' ? 'bi-shield-slash-fill' : 'bi-shield-check-fill'} me-2`}></i>
                        {initialData?.is_blacklist === 'Blacklist' ? 'BLACKLISTED' : 'CLEAN / ACTIVE'}
                      </span>
                    </div>
                  </div>

                  <div className="col-md-9 ps-md-4">
                    <ul className="nav nav-pills mb-4 bg-light p-1 rounded" style={{ borderRadius: 'var(--radius-md)' }}>
                      {['Data Pribadi', 'Data Pekerjaan', 'Data Aset'].map((label, index) => {
                        const isLocked = initialData?.is_blacklist === 'Blacklist' && index > 0;
                        return (
                          <li className="nav-item flex-fill" key={index}>
                            <button 
                              type="button"
                              disabled={isLocked}
                              className={`nav-link w-100 fw-bold border-0 ${activeTab === index ? 'active shadow-sm' : 'text-secondary bg-transparent'}`}
                              style={{ 
                                transition: 'all 0.2s',
                                borderRadius: 'var(--radius-md)',
                                cursor: isLocked ? 'not-allowed' : 'pointer'
                              }}
                              onClick={() => !isLocked && setActiveTab(index)}
                            >
                              {isLocked && <i className="bi bi-lock-fill me-1"></i>}
                              {label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="tab-content-container" style={{ minHeight: '380px' }}>
                      <div className={activeTab === 0 ? '' : 'd-none'}>
                        <PersonelTab onPersonSelect={handlePersonSelect} initialData={propsData} />
                      </div>
                      <div className={activeTab === 1 ? '' : 'd-none'}>
                        <EmployTab initialData={propsData} />
                      </div>
                      <div className={activeTab === 2 ? '' : 'd-none'}>
                        <AsetTab initialData={propsData} />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button 
                  type="button" 
                  className={`btn-app btn-ghost-app me-auto ${activeTab === 0 ? 'invisible' : ''}`} 
                  onClick={handlePrev}
                >
                  <i className="bi bi-chevron-left"></i> Sebelumnya
                </button>
                
                <div className="d-flex gap-2">
                  <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                  
                  {activeTab < 2 ? (
                    <button 
                      type="button" 
                      className="btn-app btn-primary-app px-4"
                      onClick={handleNext}
                      disabled={initialData?.is_blacklist === 'Blacklist'} 
                    >
                      Selanjutnya <i className="bi bi-chevron-right ms-1"></i>
                    </button>
                  ) : (
                    <button type="submit" className="btn-app btn-success-app px-4">
                      <i className="bi bi-save me-2"></i> {isEditMode ? 'Update Data' : 'Simpan Data'}
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

export default DataForm;