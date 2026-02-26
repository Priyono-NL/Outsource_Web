import React from 'react';

function PersonelTab() {
  return (
    <div className="fade show active">
        <div className="row g-3">
            <div className="mb-3 col-9">
                <label className="form-label small fw-bold"> Nama Lengkap</label>
                <input type="text" name="nama" className="form-control" />                            
            </div>
            <div className="mb-3 col-3">
                <label className="form-label small fw-bold"> Jenis Kelamin</label>
                <select name="gender" className="form-select">
                    <option value="L">Laki - laki</option>
                    <option value="P">Perempuan</option>
                </select>                            
            </div>
        </div>
        <div className="row g-3">
            <div className="mb-3 col-4">
                <label className="form-label small fw-bold">Tempat Lahir</label>
                <input type="text" name="pob" className="form-control" />
            </div>
            <div className="mb-3 col-4">
                <label className="form-label small fw-bold">Tanggal Lahir</label>
                <input type="date" name="dob" className="form-control" />
            </div>                    
            <div className="mb-3 col-4">
                <label className="form-label small fw-bold">Agama</label>
                <input type="text" name="religion" className="form-control" />
            </div>
        </div>
        <div className="mb-3 col-12">
            <label className="form-label small fw-bold">Alamat</label>
            <input type="text" name="address" className="form-control" />                        
        </div>
        <div className="mb-3 col-12">
            <label className="form-label small fw-bold">Nomor KTP</label>
            <input type="text" name="resident_id" className="form-control" />                        
        </div>
    </div>
  );
}

export default PersonelTab;