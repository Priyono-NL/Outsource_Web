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
                <h5 className="fw-bold mb-0">Data Details</h5>
                <button type="button" className="btn-close" onClick={onClose}></button>
              </div>
            </div>

            <div className="card-body">
              <div className="row">
                <div className="col-md-4 border-end text-center">
                  <div className="position-relative d-inline-block mb-3">
                    <img 
                      src={photoUrl || "/src/assets/no_image.png"} 
                      className="rounded shadow-sm border" 
                      style={{ width: '220px', height: '220px', objectFit: 'cover' }} 
                      alt="Profile"
                    />
                  </div>
                  <h4 className="fw-bold mb-0">{initialData.person_name}</h4>
                  <div className="mt-4 w-100 px-3">
                    <label className='fw-bold text-muted small d-block mb-2 text-center'>Status Blacklist</label>
                    <div className="text-center">
                      <span className={`badge p-2 w-100 ${initialData?.is_blacklist === 'Blacklist' ? 'bg-danger' : 'bg-success'}`}>
                        <i className={`bi ${initialData?.is_blacklist === 'Blacklist' ? 'bi-exclamation-octagon-fill' : 'bi-check-circle-fill'} me-2`}></i>
                        {initialData?.is_blacklist === 'Blacklist' ? 'BLACKLISTED' : 'ACTIVE / CLEAN'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-md-8 ps-md-4">
                  <div className="row g-3">
                    {/* Personal Information */}
                    <div className="col-md-12 fw-bold text-primary border-bottom pb-1">Personal Information</div>
                    <div className="col-md-6 text-muted">Gender: <span className="text-dark">{initialData.gender}</span></div>
                    <div className="col-md-6 text-muted">Religion: <span className="text-dark">{initialData?.religion || "-"}</span></div>
                    <div className="col-md-6 text-muted">Place Of Birth: <span className="text-dark">{initialData?.pob || "-"}</span></div>
                    <div className="col-md-6 text-muted">Date Of Birth: <span className="text-dark">{initialData?.dob || "-"}</span></div>
                    <div className="col-md-12 text-muted">NIK: <span className="text-dark">{initialData?.resident_id || "-"}</span></div>
                    <div className="col-md-12 text-muted">Address: <span className="text-dark">{initialData?.address || "-"}</span></div>

                    {/* Employment Information */}
                    <div className="col-md-12 fw-bold text-primary border-bottom pb-1 mt-4">Employment Information</div>
                    <div className="col-md-6 text-muted">Department: <span className="text-dark">{initialData?.cc_name || "-"}</span></div>
                    <div className="col-md-6 text-muted">Sub Company: <span className="text-dark">{initialData.sub_con_name}</span></div>
                    <div className="col-md-6 text-muted">Grade: <span className="text-dark">{initialData.grade}</span></div>
                    <div className="col-md-6 text-muted"></div>
                    <div className="col-md-6 text-muted">Valid From: <span className="text-dark">{initialData.v_valid_from}</span></div>
                    <div className="col-md-6 text-muted">Valid To: <span className="text-dark">{initialData?.v_valid_to || "-"}</span></div>

                    {/* Asset Information */}
                    <div className="col-md-12 fw-bold text-primary border-bottom pb-1 mt-4">Asset Information</div>
                    <div className="col-md-12 text-muted">Absence Card: <span className="text-dark">{initialData?.card_number || "-"}</span></div>
                    <div className="col-md-6 text-muted">Valid From: <span className="text-dark">{initialData?.card_number_from || "-"}</span></div>
                    <div className="col-md-6 text-muted">Valid To: <span className="text-dark">{initialData?.card_number_to || "-"}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="card-footer bg-white border-top-0 d-flex justify-content-end gap-2 pb-4">
              
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ViewDetails;