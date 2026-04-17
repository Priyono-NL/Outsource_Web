import React, { useState, useRef, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function BiodataForm({ onClose, onSuccess, initialData }) {
  const formRef = useRef(null);

  const fileInputRef = useRef(null);  
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);  

  useEffect(() => {    
    if (initialData && formRef.current) {
      formRef.current.nama.value = initialData.name || '';
      formRef.current.gender.value = initialData.gender || 'L';
      formRef.current.address.value = initialData.address || '';
      formRef.current.pob.value = initialData.pob || '';
      formRef.current.dob.value = initialData.dob || '';
      formRef.current.religion.value = initialData.religion || 'islam';
      formRef.current.resident_id.value = initialData.resident_id || '';

      const photoPath = initialData.photo;
      const BASE_URL = 'http://localhost:5000';
      if (photoPath) {
        const fullPhotoUrl = photoPath.startsWith('http') 
          ? photoPath 
          : `${BASE_URL}${photoPath}`;
        setPreviewUrl(fullPhotoUrl);
      } else { setPreviewUrl(null); }
    }
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        Toast.fire({ 
          icon: 'error', 
          title: 'Format file tidak didukung. Harap pilih gambar (JPG, PNG, dll).' 
        });
        e.target.value = "";
        return;
      }
      setSelectedFile(file);
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const customConfig = { headers: { 'Content-Type': 'multipart/form-data', } };
    const formData = new FormData(formRef.current);
    
    if (selectedFile) formData.append('photo', selectedFile);
    try {
      const response = initialData 
        ? await api.put(`/person/${initialData.person_id}`, formData, customConfig) 
        : await api.post('/person/submit', formData, customConfig);
      if (response.data.status === 'success') {
        Toast.fire({ icon: 'success', title: response.data.message });
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.message || "Terjadi kesalahan" });
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
                  <h5 className="fw-bold mb-0">{initialData ? 'Edit Data' : 'Add New Data'}</h5>
                  <button type="button" className="btn-close" onClick={onClose}></button>
                </div>                
              </div>
              <form ref={formRef} onSubmit={handleSave}>
                <div className="card-body border-top py-4">
                  <div className="container-fluid">
                    <div className="row justify-content-center">
                      
                      <div className="col-md-4 border-end d-flex flex-column align-items-center justify-content-start pt-3">
                        <div 
                          className="border rounded d-flex align-items-center justify-content-center mb-3 shadow-sm bg-light"
                          style={{ width: '250px', height: '250px', overflow: 'hidden' }}
                        >
                          <img 
                            src={previewUrl || "/src/assets/no_image.png"} 
                            className="rounded" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => {
                              e.target.onerror = null; 
                              e.target.src = "/no_image.png";
                            }}
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
                      </div>

                      <div className="col-md-7 ps-md-5">
                        <div className="row g-3">
                          <div className="mb-3 col-12">
                            <label className="form-label small fw-bold">Name</label>
                            <input type="text" name="nama" className="form-control" required />
                          </div>
                          <div className="mb-3 col-6">
                            <label className="form-label small fw-bold"> Jenis Kelamin</label>
                            <select name="gender" className="form-select" >
                              <option value="L">Laki - laki</option>
                              <option value="P">Perempuan</option>
                            </select>
                          </div>
                          <div className="mb-3 col-6">
                            <label className="form-label small fw-bold">Agama</label>
                            <select name="religion" className="form-select" >
                              <option value="islam">Islam</option>
                              <option value="kristen">Kristen</option>
                              <option value="katolik">Katolik</option>
                              <option value="hindu">Hindu</option>
                              <option value="budha">Budha</option>
                              <option value="khonghucu">Khonghucu</option>
                            </select> 
                          </div>
                          <div className="mb-3 col-6">
                            <label className="form-label small fw-bold">Tempat Lahir</label>
                            <input type="text" name="pob" className="form-control" />
                          </div>
                          <div className="mb-3 col-6">
                            <label className="form-label small fw-bold">Tanggal Lahir</label>
                            <input type="date" name="dob" className="form-control" />
                          </div>
                          <div className="mb-3 col-6">
                            <label className="form-label small fw-bold">Nomor KTP</label>
                            <input type="text" name="resident_id" className="form-control" />                        
                          </div>
                          <div className="mb-3 col-12">
                            <label className="form-label small fw-bold">Alamat</label>
                            <textarea rows="3" name="address" className='form-control' ></textarea>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="card-footer bg-white d-flex justify-content-end py-3 border-top-0">
                  <button type="button" className="btn btn-light me-2 fw-semibold" onClick={onClose}>Batal</button>
                  <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm fw-semibold">
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

export default BiodataForm;