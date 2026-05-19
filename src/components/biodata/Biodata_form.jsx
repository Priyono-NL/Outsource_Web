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
      const BASE_URL = import.meta.env.VITE_BACKEND_URL;
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
          title: 'Format file tidak didukung.' 
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
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }} 
        onClick={onClose}
      ></div>

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${initialData ? 'bi-person-gear' : 'bi-person-plus'} me-2`}></i>
                {initialData ? 'Update Biodata' : 'Registrasi Biodata'}
              </h6>
              <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-3 bg-white">
                <div className="row g-3">
                  
                  {/* Kolom Foto (Kiri) - Penyesuaian Ukuran */}
                  <div className="col-md-3 border-end d-flex flex-column align-items-center justify-content-start pt-2">
                    <label className="form-label mb-2" style={{ fontSize: '0.7rem', fontWeight: '700', color: '#6c757d', textTransform: 'uppercase' }}>Foto</label>
                    <div 
                      className="rounded shadow-sm border bg-light mb-2"
                      style={{ 
                        width: '140px',   /* Sedikit diperlebar */
                        height: '186px',  /* Aspek rasio ~3:4 */
                        overflow: 'hidden', 
                        borderStyle: 'dashed',
                        borderColor: '#dee2e6'
                      }}
                    >
                      <img 
                        src={previewUrl || "/src/assets/no_image.png"} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => e.target.src = "/no_image.png"}
                        alt="Preview"
                      />
                    </div>
                    
                    <input type="file" ref={fileInputRef} className="d-none" accept="image/*" onChange={handleFileChange} />
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-primary"
                      style={{ fontSize: '0.7rem', padding: '0.25rem 1rem' }}
                      onClick={() => fileInputRef.current.click()}
                    >
                      <i className="bi bi-camera me-1"></i> Pilih Foto
                    </button>
                    <small className="text-muted mt-2" style={{ fontSize: '0.6rem' }}>JPG, PNG (Maks 2MB)</small>
                  </div>

                  {/* Kolom Form (Kanan) - Tetap Compact */}
                  <div className="col-md-9 ps-md-3">
                    <div className="row g-2">
                      <div className="col-md-12">
                        <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Lengkap (Sesuai KTP)</label>
                        <input type="text" name="nama" className="form-control form-control-sm" placeholder="Nama lengkap..." required />
                      </div>
                      
                      <div className="col-md-6">
                        <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>NIK (KTP)</label>
                        <input type="text" name="resident_id" className="form-control form-control-sm" placeholder="16 digit nomor NIK" />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Gender</label>
                        <select name="gender" className="form-select form-select-sm">
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </div>

                      <div className="col-md-3">
                        <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Agama</label>
                        <select name="religion" className="form-select form-select-sm">
                          <option value="islam">Islam</option>
                          <option value="kristen">Kristen</option>
                          <option value="katolik">Katolik</option>
                          <option value="hindu">Hindu</option>
                          <option value="budha">Budha</option>
                          <option value="khonghucu">Konghucu</option>
                        </select> 
                      </div>

                      <div className="col-md-6">
                        <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tempat Lahir</label>
                        <input type="text" name="pob" className="form-control form-control-sm" placeholder="Kota lahir" />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tanggal Lahir</label>
                        <input type="date" name="dob" className="form-control form-control-sm" />
                      </div>

                      <div className="col-md-12">
                        <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Alamat Domisili</label>
                        <textarea rows="2" name="address" className="form-control form-control-sm" placeholder="Alamat lengkap sesuai KTP..."></textarea>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="modal-footer bg-light border-top p-2 px-3">
                <button type="button" className="btn btn-sm btn-light border" style={{ fontSize: '0.8rem' }} onClick={onClose}>Batal</button>
                <button type="submit" className="btn btn-sm btn-primary px-3 shadow-sm" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-save me-1"></i>
                  {initialData ? 'Simpan' : 'Daftarkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default BiodataForm;