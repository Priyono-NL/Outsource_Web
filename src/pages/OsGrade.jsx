import React, { useState, useEffect } from 'react';
import Select from 'react-select'; 
import api from '../api/api'; 
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import OsGradeForm from '../components/osGrade/OsGradeForm';
import OsGradeTable from '../components/osGrade/OsGradeTable';

const OsGrade = () => {
  const crud = useCrudPage();
  const { user } = useAuth();
  const isRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  
  // --- STATE FILTER ---
  const [filterTerm, setFilterTerm] = useState('all');
  const [subCompanies, setSubCompanies] = useState([]); 
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [resSub] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
        ]);        
        setSubCompanies(resSub.data.data || []);
        if (user?.allowed_subcompanies?.length > 0 && resSub.data.data.length > 0) {
          setSubCompanyInput(resSub.data.data[0].sub_company_id);
          setAppliedSubCompany(resSub.data.data[0].sub_company_id);
        }
      } catch { /* silent */ }
    };
    if (user) load();
  }, [user]);

  const handleFilterChange = (setter, value) => {
    setter(value);
    setAppliedSubCompany(value); 
  };

  const subCompanyOptions = isRestricted
    ? subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name }))
    : [
        { value: '', label: 'Semua Sub Company' },
        ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
      ];

  return (
    <div>
      <PageHeader
        title="Grade"
        searchPlaceholder="Cari Grade..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'}`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? <><i className="bi bi-x" /> Tutup</> : <><i className="bi bi-plus" /> Tambah</>}
        </button>
      </PageHeader>
      
      {crud.showForm && (
        <OsGradeForm 
          onClose={crud.handleClose} 
          onSuccess={crud.handleRefresh} 
          initialData={crud.editingData} 
        />
      )}
      
      <div className="app-card">
        <div className="filter-bar d-flex gap-3 mb-3">
          
          <div className="filter-group m-0">
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Status</label>
            <select 
              className="form-select-app"
              style={{ height: 34, fontSize: 13 }}
              value={filterTerm} 
              onChange={e => setFilterTerm(e.target.value)}
            >
              <option value="all">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="filter-group m-0" style={{ minWidth: 180 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable={!isRestricted}
              isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>
          
        </div>

        <OsGradeTable 
          refreshTrigger={crud.refreshKey} 
          onEditClick={crud.handleEdit} 
          searchTerm={crud.appliedSearch} 
          filterTerm={filterTerm} 
          subCompanyFilter={appliedSubCompany} 
        />
      </div>
    </div>
  );
};

export default OsGrade;