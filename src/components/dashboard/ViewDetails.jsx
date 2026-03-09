import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function ViewDetails({ onClose, initialData }) {
  const maskResidentId = (id) => {
    if (!id) return "-";
    const strId = String(id);
    return `${strId.substring(0, 4)}********${strId.slice(-2)}`;
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
            {/* Header dengan tombol close */}
            <div className="card-header bg-white pt-3 border-bottom-0">
              <div className="d-flex justify-content-between align-items-center mb-3 px-2">
                <h5 className="fw-bold mb-0">Data Details</h5>
                <button type="button" className="btn-close" onClick={onClose}></button>
              </div>
            </div>

            <div className="card-body">
              <div className="row">
                {/* Sisi Kiri: Foto & Nama Utama (Seperti di Gambar) */}
                <div className="col-md-4 border-end text-center">
                  <div className="position-relative d-inline-block mb-3">
                    <img 
                      src="\src\assets\no_image.png"
                      className="rounded img-thumbnail" 
                      style={{ width: '200px', height: '200px', objectFit: 'cover' }} 
                      alt="Profile" 
                    />
                  </div>
                  <h4 className="fw-bold mb-0">{initialData.person_name}</h4>
                </div>

                {/* Sisi Kanan: Informasi Detail (Gabungan script Anda) */}
                <div className="col-md-8 ps-md-4">
                  <div className="row g-3">
                    {/* Personal Information */}
                    <div className="col-md-12 fw-bold text-primary border-bottom pb-1">Personal Information</div>
                    <div className="col-md-6 text-muted">Gender: <span className="text-dark">{initialData.gender}</span></div>
                    <div className="col-md-6 text-muted">Religion: <span className="text-dark">{initialData?.religion || "-"}</span></div>
                    <div className="col-md-6 text-muted">POB: <span className="text-dark">{initialData?.pob || "-"}</span></div>
                    <div className="col-md-6 text-muted">DOB: <span className="text-dark">{initialData?.dob || "-"}</span></div>
                    <div className="col-md-12 text-muted">Resident ID: <span className="text-dark">{maskResidentId(initialData?.resident_id) || "-"}</span></div>
                    <div className="col-md-12 text-muted">Address: <span className="text-dark">{initialData?.address || "-"}</span></div>

                    {/* Employment Information */}
                    <div className="col-md-12 fw-bold text-primary border-bottom pb-1 mt-4">Employment Information</div>
                    <div className="col-md-6 text-muted">Department: <span className="text-dark">{initialData?.cc_name || "-"}</span></div>
                    <div className="col-md-6 text-muted">Sub Company: <span className="text-dark">{initialData.sub_con_name}</span></div>
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