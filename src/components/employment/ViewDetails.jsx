import React from 'react';

function ViewDetails({ onClose, initialData }) {
  const BASE_URL = 'http://localhost:5000';
  const photoUrl = initialData?.photo 
    ? (initialData.photo.startsWith('http') ? initialData.photo : `${BASE_URL}${initialData.photo}`)
    : "/src/assets/no_image.png";

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      ></div>

      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content" style={{ 
            border: "none", 
            borderRadius: "var(--radius-lg)", 
            overflow: "hidden",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)" 
          }}>
            
            <div className="app-card mb-0" style={{ border: "none" }}>
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <h5 className="fw-bold mb-0" style={{ color: "var(--color-primary)" }}>
                  <i className="bi bi-person-badge me-2"></i>
                  Detail Karyawan
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={onClose}
                  style={{ fontSize: '0.8rem' }}
                ></button>
              </div>

              <div className="p-4">
                <div className="row">
                  {/* Left Column: Profile Picture & Status */}
                  <div className="col-md-3 border-end text-center">
                    <div className="mb-3">
                      <img 
                        src={photoUrl} 
                        className="rounded shadow-sm border" 
                        style={{ 
                          width: '100%', 
                          maxWidth: '200px', 
                          aspectRatio: '1/1', 
                          objectFit: 'cover',
                          backgroundColor: '#f8f9fa' 
                        }} 
                        alt="Profile"
                        onError={(e) => e.target.src = "/src/assets/no_image.png"}
                      />
                    </div>
                    <h5 className="fw-bold mb-1">{initialData.person_name}</h5>
                    <p className="text-muted small mb-3">{initialData.person_id}</p>
                    
                    <div className="px-2">
                      <label className='fw-bold text-muted small d-block mb-2'>Status Blacklist</label>
                      <span className={`badge p-2 w-100 ${initialData?.is_blacklist === 'Blacklist' ? 'bg-danger' : 'bg-success'}`} style={{ borderRadius: 'var(--radius-md)' }}>
                        <i className={`bi ${initialData?.is_blacklist === 'Blacklist' ? 'bi-exclamation-octagon-fill' : 'bi-check-circle-fill'} me-2`}></i>
                        {initialData?.is_blacklist === 'Blacklist' ? 'BLACKLISTED' : 'CLEAN / ACTIVE'}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Information Sections */}
                  <div className="col-md-9 ps-md-4">
                    <div className="row g-4">
                      
                      {/* Section 1: Personal */}
                      <div className="col-12">
                        <h6 className="fw-bold text-uppercase small text-primary mb-3" style={{ letterSpacing: '0.5px' }}>
                          Informasi Pribadi
                        </h6>
                        <div className="row g-3">
                          <DetailItem label="Jenis Kelamin" value={initialData.gender} />
                          <DetailItem label="Agama" value={initialData.religion} />
                          <DetailItem label="Tempat Lahir" value={initialData.pob} />
                          <DetailItem label="Tanggal Lahir" value={initialData.dob} />
                          <DetailItem label="NIK / Resident ID" value={initialData.resident_id} col={12} />
                          <DetailItem label="Alamat" value={initialData.address} col={12} />
                        </div>
                      </div>

                      {/* Section 2: Employment */}
                      <div className="col-12">
                        <h6 className="fw-bold text-uppercase small text-primary mb-3 border-top pt-3">
                          Informasi Pekerjaan
                        </h6>
                        <div className="row g-3">
                          <DetailItem label="Department" value={initialData.cc_name} />
                          <DetailItem label="Sub Company" value={initialData.sub_con_name} />
                          <DetailItem label="Grade" value={initialData.grade} />
                          <div className='col-md-6'></div>
                          <DetailItem label="Type Work" value={initialData.type_worker} />
                          <DetailItem label="Posisi" value={initialData.posisi} />
                          <DetailItem label="Mulai Kontrak" value={initialData.v_valid_from} />
                          <DetailItem label="Selesai Kontrak" value={initialData.v_valid_to} />
                          
                        </div>
                      </div>

                      {/* Section 3: Asset */}
                      <div className="col-12">
                        <h6 className="fw-bold text-uppercase small text-primary mb-3 border-top pt-3">
                          Asset Karyawan
                        </h6>
                        <div className="row g-3">
                          <DetailItem label="Nomor Kartu Absensi" value={initialData.card_number} />
                          <DetailItem label="Masa Berlaku Kartu" value={`${initialData.card_number_from || '-'} s/d ${initialData.card_number_to || '-'}`} />                          
                        </div>
                      </div>

                      {/* Section 3: ChangeLog */}
                      <div className="col-12">
                        <h6 className="fw-bold text-uppercase small text-primary mb-3 border-top pt-3">
                          Log Sistem
                        </h6>
                        <div className="row g-3">
                          <DetailItem label="Dibuat Oleh" value={`${initialData.created_by} (${initialData.created_date})`} />
                          <DetailItem label="Diubah Terakhir" value={`${initialData.modified_by || '-'} (${initialData.modified_date || '-'})`} />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-top bg-light d-flex justify-content-end">
                <button className="btn-app btn-ghost-app" onClick={onClose}>
                  Tutup Detail
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

// Komponen Helper untuk merapikan layout label-value
const DetailItem = ({ label, value, col = 6 }) => (
  <div className={`col-md-${col}`}>
    <label className="d-block text-muted small mb-0">{label}</label>
    <span className="fw-semibold text-dark">{value || "-"}</span>
  </div>
);

export default ViewDetails;