import React, { useState } from 'react';

function PersonelTab() {
  return (
    <div className="fade show active">
        <div className="row g-3">
            <div className="mb-3 col-12">
                <label className="form-label small fw-bold"> Nama Lengkap</label>
                <input type="text" name="nama" className="form-control" required />
            </div>            
        </div>
        <div className="row g-3">
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold"> Jenis Kelamin</label>
                <select name="gender" className="form-select" required >
                    <option value="L">Laki - laki</option>
                    <option value="P">Perempuan</option>
                </select>                            
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Agama</label>
                <select name="religion" className="form-select" required >
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
        </div>        
        <div className="mb-3 col-12">
            <label className="form-label small fw-bold">Alamat</label>
            <textarea rows="3" name="address" className='form-control'></textarea>
        </div>        
    </div>
  );
}

export default PersonelTab;