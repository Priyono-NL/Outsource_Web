import React, { useState, useEffect } from 'react';
import Select from 'react-select'; 
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import LoadingButton from '../components/LoadingButton';
import GuestForm from '../components/guest/GuestForm';
import GuestBulkForm from '../components/guest/GuestBulkForm';
import GuestTable from '../components/guest/GuestTable';

const Guest = () => {
  const crud = useCrudPage();
  const { user } = useAuth();
  
  // Flag Pembatasan Hak Akses SSO
  const isSubCompanyRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  const isDeptRestricted       = user?.allowed_costcenters && user.allowed_costcenters.length > 0;
  
  const [showBulkForm, setShowBulkForm] = useState(false);

  // --- STATE FORM FILTER (DRAFT) ---
  const [statusInput, setStatusInput]         = useState('all');
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');

  // --- STATE APPLIED FILTER (TERAPAN) ---
  const [appliedStatus, setAppliedStatus]         = useState('all');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');

  // --- FLAG FILTER STATES ---
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isFilterDirty, setIsFilterDirty]     = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  // --- MASTER DATA STATES ---
  const [subCompanies, setSubCompanies] = useState([]); 
  const [departments, setDepartments]   = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [resSub, resDept] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
          api.get('/costcenter?page=1&pageSize=200'),
        ]);
        
        const subData  = resSub.data.data || [];
        const deptData = resDept.data.data || [];

        setSubCompanies(subData);
        setDepartments(deptData);

        // Auto-select Subcompany jika user dibatasi SSO
        if (isSubCompanyRestricted && subData.length > 0) {
          const allowedSubList = subData.filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id));
          const defaultSub = allowedSubList.length > 0 ? allowedSubList[0].sub_company_id : subData[0].sub_company_id;
          setSubCompanyInput(defaultSub);
          setAppliedSubCompany(defaultSub);
        }

        // Auto-select Department jika user dibatasi SSO
        if (isDeptRestricted && deptData.length > 0) {
          const allowedDeptList = deptData.filter(d => user.allowed_costcenters.includes(d.id));
          const defaultDept = allowedDeptList.length > 0 ? allowedDeptList[0].id : deptData[0].id;
          setDepartmentInput(defaultDept);
          setAppliedDepartment(defaultDept);
        }

      } catch { /* silent error handling */ }
    };
    if (user) load();
  }, [user]);

  const handleFilterChange = (setter, value) => {
    setter(value);
    setIsFilterDirty(true);
  };

  const handleApplyFilters = () => {
    setIsApplyingFilter(true);
    crud.handleSearch();
    
    setAppliedStatus(statusInput);
    setAppliedSubCompany(subCompanyInput);
    setAppliedDepartment(departmentInput);

    setIsFilterApplied(true);
    setIsFilterDirty(false);

    setTimeout(() => setIsApplyingFilter(false), 300);
  };

  const handleResetFilters = () => {
    setStatusInput('all');
    setSubCompanyInput(isSubCompanyRestricted ? appliedSubCompany : '');
    setDepartmentInput(isDeptRestricted ? appliedDepartment : '');
    crud.setSearchInput('');

    setAppliedStatus('all');
    if (!isSubCompanyRestricted) setAppliedSubCompany('');
    if (!isDeptRestricted) setAppliedDepartment('');

    setIsFilterApplied(false);
    setIsFilterDirty(false);
  };

  // --- DYNAMIC OPTIONS (SSO RESTRICTED) ---
  const subCompanyOptions = isSubCompanyRestricted
    ? subCompanies
        .filter(sc => user.allowed_subcompanies.includes(sc.sub_company_id))
        .map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name }))
    : [
        { value: '', label: 'Semua Sub Company' },
        ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
      ];

  const departmentOptions = isDeptRestricted
    ? departments
        .filter(d => user.allowed_costcenters.includes(d.id))
        .map(d => ({ value: d.id, label: d.org_name }))
    : [
        { value: '', label: 'Semua Department' },
        ...departments.map(d => ({ value: d.id, label: d.org_name })),
      ];

  return (
    <div>
      <PageHeader
        title="Alokasi Kantin Periode Khusus (Exception List)"
        searchPlaceholder="Cari ID / Nama Karyawan..."
        searchValue={crud.searchInput}
        onSearchChange={(val) => {
          crud.setSearchInput(val);
          setIsFilterDirty(true);
        }}
        onSearch={handleApplyFilters}
      >
        {/* Tombol Tambah Single */}
        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'} me-2`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? (
            <><i className="bi bi-x" /> Tutup</>
          ) : (
            <><i className="bi bi-plus" /> Tambah 1 Karyawan</>
          )}
        </button>

        {/* Tombol Tambah Massal */}
        {!crud.showForm && (
          <button
            className="btn-app btn-secondary-app"
            onClick={() => setShowBulkForm(true)}
          >
            <i className="bi bi-people-fill me-1" /> Tambah Massal
          </button>
        )}
      </PageHeader>

      {crud.showForm && (
        <GuestForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      {showBulkForm && (
        <GuestBulkForm
          onClose={() => setShowBulkForm(false)}
          onSuccess={crud.handleRefresh}
        />
      )}

      <div className="app-card">
        {/* --- FILTER BAR CONTAINER --- */}
        <div className="filter-bar d-flex flex-wrap gap-3 mb-3">
          
          {/* Status Filter */}
          <div className="filter-group m-0">
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Status</label>
            <select 
              className="form-select-app"
              style={{ height: 34, fontSize: 13 }}
              value={statusInput} 
              onChange={e => handleFilterChange(setStatusInput, e.target.value)}
            >
              <option value="all">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Sub Company Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari Subcompany..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable={!isSubCompanyRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          {/* Department / Cost Center Filter */}
          <div className="filter-group m-0" style={{ minWidth: 180 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Department</label>
            <Select
              options={departmentOptions}
              placeholder="Cari Department..."
              value={departmentOptions.find(o => o.value === departmentInput) || departmentOptions[0]}
              onChange={o => handleFilterChange(setDepartmentInput, o?.value || '')}
              isClearable={!isDeptRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

          {/* Filter Action Buttons */}
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
            {isFilterApplied && (
              <button 
                type="button" 
                className="btn-app btn-ghost-app" 
                onClick={handleResetFilters}
              >
                <i className="bi bi-x-circle me-1" /> Clear Filter
              </button>
            )}

            <LoadingButton
              loading={isApplyingFilter}
              loadingText="Memfilter..."
              className="btn-app btn-primary-app"
              icon="bi bi-funnel"
              onClick={handleApplyFilters}
            >
              Terapkan Filter
            </LoadingButton>
          </div>
          
        </div>

        {/* --- DIRTY FILTER WARNING / DATATABLE --- */}
        {isFilterDirty ? (
          <div className="alert alert-warning text-center mt-3 mb-3 py-3" style={{ borderStyle: 'dashed' }} role="alert">
            <i className="bi bi-exclamation-triangle text-warning fs-4 d-block mb-1"></i>
            <span style={{ fontSize: '14px' }}>
              <strong>Filter Sedang Diubah!</strong><br />
              Silakan klik tombol <b>Terapkan Filter</b> untuk memuat ulang data.
            </span>
          </div>
        ) : (
          <GuestTable
            refreshTrigger={crud.refreshKey}
            onEditClick={crud.handleEdit}
            searchTerm={crud.appliedSearch}
            filterTerm={appliedStatus}
            subCompanyFilter={appliedSubCompany}
            departmentFilter={appliedDepartment}
            isFilterApplied={isFilterApplied}
          />
        )}

      </div>
    </div>
  );
};

export default Guest;