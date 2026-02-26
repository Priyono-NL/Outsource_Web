import React from 'react';

function PersonelTab() {
  return (
    <div className="fade show active">
        <div className="row g-3">
            <div class="mb-3 col-9">
                <label class="form-label small fw-bold"> Nama Lengkap</label>
                <input type="text" name="nama" class="form-control" />                            
            </div>
            <div class="mb-3 col-3">
                <label class="form-label small fw-bold"> Jenis Kelamin</label>
                <select name="gender" class="form-select">
                    <option value="L">Laki - laki</option>
                    <option value="P">Perempuan</option>
                </select>                            
            </div>
        </div>
        <div class="row g-3">
            <div class="mb-3 col-4">
                <label class="form-label small fw-bold">Tempat Lahir</label>
                <input type="text" name="pob" class="form-control" />
            </div>
            <div class="mb-3 col-4">
                <label class="form-label small fw-bold">Tanggal Lahir</label>
                <input type="date" name="dob" class="form-control" />
            </div>                    
            <div class="mb-3 col-4">
                <label class="form-label small fw-bold">Agama</label>
                <input type="text" name="religion" class="form-control" />
            </div>
        </div>
        <div class="mb-3 col-12">
            <label class="form-label small fw-bold">Alamat</label>
            <input type="text" name="address" class="form-control" />                        
        </div>
        <div class="mb-3 col-12">
            <label class="form-label small fw-bold">Nomor KTP</label>
            <input type="text" name="resident_id" class="form-control" />                        
        </div>
    </div>
  );
}

export default PersonelTab;