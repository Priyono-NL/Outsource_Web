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
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }} 
        onClick={onClose}
      ></div>

      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-white">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--color-primary)' }}>
                <i className={`bi ${initialData ? 'bi-person-gear' : 'bi-person-plus'} me-2`}></i>
                {initialData ? 'Update Master Biodata' : 'Registrasi Biodata Baru'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <form ref={formRef} onSubmit={handleSave}>
              <div className="modal-body p-4 bg-white">
                <div className="row">
                  
                  <div className="col-md-4 border-end text-center d-flex flex-column align-items-center">
                    <label className="form-label small fw-bold text-muted mb-3">Foto Profil / KTP</label>
                    <div 
                      className="rounded shadow-sm border bg-light mb-3"
                      style={{ width: '100%', maxWidth: '250px', aspectRatio: '1/1', overflow: 'hidden' }}
                    >
                      <img 
                        src={previewUrl || "/src/assets/no_image.png"} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => e.target.src = "/no_image.png"}
                        alt="Preview"
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
                      className="btn-app btn-ghost-app w-75 mb-3"
                      onClick={() => fileInputRef.current.click()}
                    >
                      <i className="bi bi-camera me-2"></i> Unggah Foto
                    </button>
                  </div>

                  <div className="col-md-8 ps-md-4">
                    <div className="row g-3">
                      <div className="col-md-12">
                        <label className="form-label small fw-bold text-muted">Nama Lengkap (Sesuai KTP)</label>
                        <input type="text" name="nama" className="form-control" placeholder="Masukkan nama lengkap..." required />
                      </div>
                      
                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-muted">Jenis Kelamin</label>
                        <select name="gender" className="form-select">
                          <option value="L">Laki - laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-muted">Agama</label>
                        <select name="religion" className="form-select">
                          <option value="islam">Islam</option>
                          <option value="kristen">Kristen</option>
                          <option value="katolik">Katolik</option>
                          <option value="hindu">Hindu</option>
                          <option value="budha">Budha</option>
                          <option value="khonghucu">Khonghucu</option>
                        </select> 
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-muted">Tempat Lahir</label>
                        <input type="text" name="pob" className="form-control" placeholder="Contoh: Bandung" />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-muted">Tanggal Lahir</label>
                        <input type="date" name="dob" className="form-control" />
                      </div>

                      <div className="col-md-12">
                        <label className="form-label small fw-bold text-muted">Nomor Induk Kependudukan (NIK)</label>
                        <input type="text" name="resident_id" className="form-control" placeholder="16 Digit NIK KTP" />
                      </div>

                      <div className="col-md-12">
                        <label className="form-label small fw-bold text-muted">Alamat Domisili</label>
                        <textarea rows="3" name="address" className='form-control' placeholder="Tulis alamat lengkap sesuai KTP..."></textarea>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="modal-footer bg-light border-top p-3 px-4">
                <button type="button" className="btn-app btn-ghost-app" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-app btn-primary-app px-4 shadow-sm">
                  <i className="bi bi-save me-2"></i>
                  {initialData ? 'Simpan Perubahan' : 'Daftarkan Biodata'}
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