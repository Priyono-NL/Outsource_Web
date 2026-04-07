import React, { useState, useRef, useEffect } from 'react';
import { Toast, Confirm } from "..//utils/sweetalert";
import { saveAs } from 'file-saver';
import Select from 'react-select';

import api from '../api/api';
import Datatable from '../components/employment/Datatable';
import Dataform from '../components/employment/Dataform';
import ViewDetails from '../components/employment/ViewDetails';

const Employement = () => {
  const [showForm, setShowForm] = useState(false);
  const [viewForm, setViewForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingData, setEditingData] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState("all");
  const [subCompanyInput, setSubCompanyInput] = useState("");
  const [departmentInput, setDepartmentInput] = useState("");

  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [appliedSubCompany, setAppliedSubCompany] = useState("");
  const [appliedDepartment, setAppliedDepartment] = useState("");

  const [subCompanies, setSubCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const resSub = await api.get('/subcom?page=1&pageSize=200'); 
        const resDept = await api.get('/costcenter?page=1&pageSize=200'); 

        setSubCompanies(resSub.data.data);
        setDepartments(resDept.data.data);
      } catch (error) {
        console.error("Gagal mengambil data dropdown filter:", error);
      }
    };
    fetchFilterOptions();
  }, []);

  const handleApplyFilters = () => {
    setAppliedSearch(searchInput);
    setAppliedStatus(statusInput);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);
  };

  const handleRefresh = () => { setRefreshKey((oldKey) => oldKey + 1); };
  const handleAdd = () => { setEditingData(null); setShowForm(true); };
  const handleView = (data) => { setEditingData(data); setViewForm(true); };

  const handleExport = async () => {
    try {
        const queryParams = new URLSearchParams({
            search: appliedSearch || "",
            status: appliedStatus || "all",
            sub_company: appliedSubCompany || "",
            department: appliedDepartment || ""
        }).toString();

        const response = await api.get(`/employee/export?${queryParams}`, { 
            responseType: 'blob' 
        });
        
        saveAs(response.data, 'Data_OS_Filtered.xlsx');
    } catch (error) {
        console.error("Gagal export data:", error);
        Toast.fire({
            icon: 'error',
            title: 'Gagal mengunduh file Excel'
        });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
        const { data } = await api.get('/employee/template', { responseType: 'blob' });
        saveAs(data, 'Template_Import.xlsx');
    } catch (error) {
      Toast.fire({
        icon: 'error',
        title: "Gagal Download Template Import"
      })
    }    
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await api.post('/employee/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        const { status, message, errors } = response.data;

        if (status === 'partial_success') {
            Confirm.fire({
                icon: 'warning',
                title: 'Import Selesai dengan Catatan',
                html: `
                    <p>${message}</p>
                    <div style="text-align: left; max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border: 1px solid #dee2e6; font-size: 0.85em;">
                        <strong>Detail Kesalahan:</strong><br>
                        ${errors.join('<br>')}
                    </div>
                `,
                confirmButtonText: 'Tutup',
                showCancelButton: false
            });
        } else {
            Toast.fire({ icon: 'success', title: message });
        }
        handleRefresh();        
    } catch (error) {
        const serverResponse = error.response?.data;
        const errorList = serverResponse?.errors;
        if (errorList && errorList.length > 0) {
            Confirm.fire({
                icon: 'error',
                title: 'Gagal Import',
                html: `
                    <div style="text-align: left; max-height: 200px; overflow-y: auto; background: #fff1f0; padding: 10px; border: 1px solid #ffa39e; font-size: 0.85em;">
                        ${errorList.join('<br>')}
                    </div>
                `,
                confirmButtonText: 'Perbaiki Excel'
            });
        } else {
            Toast.fire({
                icon: 'error',
                title: serverResponse?.message || "Terjadi kesalahan saat upload"
            })
        }
    } finally {
        setIsUploading(false); 
    }
  };

  const subCompanyOptions = [
    { value: "", label: "Semua Sub Company" },
    ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name }))
  ];

  const departmentOptions = [
    { value: "", label: "Semua Department" },
    ...departments.map(dept => ({ value: dept.cost_center, label: dept.org_name }))
  ];

  return (
    <div className="container-fluid px-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="text-dark mb-0">Employement</h3>
      </div>
      <div className='row g-3 mb-4 align-items-center'>
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group">
            <input 
              type="text" 
              className="form-control" 
              placeholder="Cari ID / Nama Karyawan / Card Number..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            />
            <button className="btn btn-outline-primary" onClick={handleApplyFilters}>
              Cari
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-lg-8 d-flex justify-content-md-end gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={handleDownloadTemplate}>
            Template (Import)
          </button>
          <label className={`btn ${isUploading ? 'btn-secondary' : 'btn-outline-primary'} px-4 fw-semibold shadow-sm d-flex align-items-center`}>
            {isUploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Processing...
              </>
            ) : (
              <>Import From Excel</>
            )}
            <input 
              type="file" 
              hidden 
              ref={fileInputRef}
              onChange={handleImport} 
              accept=".xlsx, .xls" 
              disabled={isUploading}
            />
          </label>
          <button className="btn btn-success px-4 fw-semibold shadow-sm d-flex align-items-center justify-content-center" onClick={handleExport}>
            Export To Excel
          </button>          
          <button 
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 fw-semibold shadow-sm d-flex align-items-center justify-content-center`}
            onClick={handleAdd}
          >
            {showForm ? 'Close Form' : '+ Add New'}
          </button>
        </div>
      </div>
      {showForm && (
        <Dataform
          onClose={() => setShowForm(false)} 
          onSuccess={handleRefresh} 
        />
      )}
      {viewForm && (
        <ViewDetails 
          onClose={() => setViewForm(false)} 
          initialData={editingData}
        />
      )}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            {/* Filter Status */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Status</label>
              <select 
                className="form-select"
                value={statusInput} 
                onChange={(e) => setStatusInput(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Filter Sub Company */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Sub Company</label>
              <Select
                options={subCompanyOptions}
                placeholder="Cari Sub Company..."
                value={subCompanyOptions.find(opt => opt.value === subCompanyInput) || subCompanyOptions[0]}
                onChange={(selectedOption) => setSubCompanyInput(selectedOption ? selectedOption.value : "")}
                isClearable={false}
                isSearchable={true}
              />
            </div>

            {/* Filter Departement */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Department</label>
              <Select
                options={departmentOptions}
                placeholder="Cari Department..."
                value={departmentOptions.find(opt => opt.value === departmentInput) || departmentOptions[0]}
                onChange={(selectedOption) => setDepartmentInput(selectedOption ? selectedOption.value : "")}
                isClearable={false}
                isSearchable={true}
              />
            </div>

            {/* Tombol Apply Filter di Paling Kanan */}
            <div className="col-md-3 d-flex justify-content-end">
              <button 
                className="btn btn-primary w-100 fw-semibold" 
                onClick={handleApplyFilters}
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          <Datatable 
            refreshTrigger={refreshKey} 
            onViewClick={handleView}
            searchTerm={appliedSearch}
            filterStatus={appliedStatus}
            filterSubCompany={appliedSubCompany}
            filterDepartment={appliedDepartment}
          />          
        </div>
      </div>
  </div>
  );
}
export default Employement;