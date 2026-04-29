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

      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        {/* Menggunakan modal-lg agar lebih compact */}
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
            
            <div className="d-flex justify-content-between align-items-center p-2 px-3 border-bottom bg-white">
              <h6 className="fw-bold mb-0" style={{ color: "var(--color-primary)" }}>
                <i className="bi bi-person-badge me-2"></i>
                Detail Karyawan
              </h6>
              <button type="button" className="btn-close" onClick={onClose} style={{ fontSize: '0.7rem' }}></button>
            </div>

            <div className="modal-body p-3 bg-white">
              <div className="row g-3">
                
                {/* Left Column: Avatar & Blacklist Status */}
                <div className="col-md-3 border-end text-center pt-2">
                  <div className="mb-2 mx-auto" style={{ width: '130px', height: '130px', overflow: 'hidden', borderRadius: '8px' }}>
                    <img 
                      src={photoUrl} 
                      className="border shadow-sm" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#f8f9fa' }} 
                      alt="Profile"
                      onError={(e) => e.target.src = "/src/assets/no_image.png"}
                    />
                  </div>
                  <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>{initialData.person_name}</h6>
                  <p className="text-muted mb-3" style={{ fontSize: '0.75rem' }}>{initialData.employee_code || initialData.person_id}</p>
                  
                  <div className="px-1">
                    <span className={`badge w-100 py-2 ${initialData?.is_blacklist === 'Blacklist' ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: '0.65rem', borderRadius: '5px' }}>
                      <i className={`bi ${initialData?.is_blacklist === 'Blacklist' ? 'bi-exclamation-octagon-fill' : 'bi-check-circle-fill'} me-1`}></i>
                      {initialData?.is_blacklist === 'Blacklist' ? 'BLACKLISTED' : 'CLEAN / ACTIVE'}
                    </span>
                  </div>
                </div>

                {/* Right Column: Info Sections */}
                <div className="col-md-9 ps-md-3">
                  <div className="row g-2">
                    
                    {/* Section 1: Pribadi */}
                    <div className="col-12 mb-2">
                      <div className="d-flex align-items-center mb-2">
                         <span className="fw-bold text-primary" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>PERSONAL INFO</span>
                         <hr className="flex-grow-1 ms-2 my-0 opacity-25" />
                      </div>
                      <div className="row g-2">
                        <DetailItem label="Gender" value={initialData.gender} />
                        <DetailItem label="Agama" value={initialData.religion} />
                        <DetailItem label="Tempat Lahir" value={initialData.pob} />
                        <DetailItem label="Tgl Lahir" value={initialData.dob} />
                        <DetailItem label="NIK / Resident ID" value={initialData.resident_id} col={12} />
                        <DetailItem label="Alamat" value={initialData.address} col={12} />
                      </div>
                    </div>

                    {/* Section 2: Pekerjaan */}
                    <div className="col-12 mb-2">
                      <div className="d-flex align-items-center mb-2">
                         <span className="fw-bold text-primary" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>EMPLOYMENT</span>
                         <hr className="flex-grow-1 ms-2 my-0 opacity-25" />
                      </div>
                      <div className="row g-2">
                        <DetailItem label="Department" value={initialData.cc_name} />
                        <DetailItem label="Sub Company" value={initialData.sub_con_name} />
                        <DetailItem label="Grade" value={initialData.grade} />
                        <DetailItem label="Type Work" value={initialData.type_worker} />
                        <DetailItem label="Posisi" value={initialData.posisi} />
                        <DetailItem label="Masa Kontrak" value={`${initialData.v_valid_from || '-'} s/d ${initialData.v_valid_to || '-'}`} />
                      </div>
                    </div>

                    {/* Section 3: Asset & Log */}
                    <div className="col-12">
                      <div className="d-flex align-items-center mb-2">
                         <span className="fw-bold text-primary" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>ASSETS & SYSTEM</span>
                         <hr className="flex-grow-1 ms-2 my-0 opacity-25" />
                      </div>
                      <div className="row g-2">
                        <DetailItem label="ID Card" value={initialData.card_number} />
                        <DetailItem label="Card Validity" value={`${initialData.card_number_from || '-'} s/d ${initialData.card_number_to || '-'}`} />
                        <DetailItem label="Last Modified" value={`${initialData.modified_by || initialData.created_by} (${initialData.modified_date || initialData.created_date})`} col={12} />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 px-3 border-top bg-light d-flex justify-content-end">
              <button className="btn btn-sm btn-secondary px-4" onClick={onClose} style={{ fontSize: '0.8rem' }}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Helper perapih layout (Compact version)
const DetailItem = ({ label, value, col = 6 }) => (
  <div className={`col-md-${col}`}>
    <label className="d-block text-muted mb-0" style={{ fontSize: '0.65rem', fontWeight: '600' }}>{label}</label>
    <span className="text-dark fw-bold" style={{ fontSize: '0.8rem' }}>{value || "-"}</span>
  </div>
);

export default ViewDetails;