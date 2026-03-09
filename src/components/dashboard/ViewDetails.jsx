import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/api';

function ViewDetails({ onClose, initialData }) {

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
              
                <div className="card-body border-top">
                    <div className='row g-3'>
                        <div className='col-md-12 fw-bold'>Personal Information</div>
                        <div className='col-md-6'>Full Name : {initialData.person_name}</div>
                        <div className='col-md-3'>Place of Birth : {initialData?.pob ? initialData.pob : "-"}</div>
                        <div className='col-md-3'>Date of Birth : {initialData?.dob ? initialData.dob : "-"}</div>
                        <div className='col-md-3'>Gender : {initialData.gender}</div>                        
                        <div className='col-md-3'>Religion : {initialData?.religion ? initialData.religion : "-"}</div>
                        <div className='col-md-6'>Resident ID (KTP) : {initialData?.resident_id ? initialData.resident_id : "-"}</div>
                        <div className='col-md-12'>Address : {initialData?.address ? initialData.address : "-"}</div>                        
                    </div>
                    <hr />
                    <div className='row g-3'>
                        <div className='col-md-12 fw-bold'>Employment Information</div>
                        <div className='col-md-3'>Sub Company : {initialData.sub_con_name}</div>
                        <div className='col-md-3'>Type Company : {initialData.type_company}</div>
                        <div className='col-md-3'>Valid From : {initialData.v_valid_from}</div>
                        <div className='col-md-3'>Valid To : {initialData?.valid_to ? initialData.valid_to : "-"}</div>
                        <div className='col-md-6'>Cost Center : {initialData.sub_con_name}</div>
                        <div className='col-md-3'>Valid From : {initialData.v_valid_from}</div>
                        <div className='col-md-3'>Valid To : {initialData?.valid_to ? initialData.valid_to : "-"}</div>
                        <div></div>                        
                    </div>
                    <hr />
                    <div className='row g-3'>
                        <div className='col-md-12 fw-bold'>Asset Information</div>
                        <div></div>                        
                    </div>
                </div>            
              
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ViewDetails;