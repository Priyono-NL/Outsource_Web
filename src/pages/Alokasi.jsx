import React, { useState, useEffect } from 'react';
import Select from 'react-select'; 
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth';

import PageHeader from '../components/PageHeader';
import AlokasiForm from '../components/alokasi/AlokasiForm';
import AlokasiBulkForm from '../components/alokasi/AlokasiBulkForm';
import AlokasiTable from '../components/alokasi/AlokasiTable';

const Alokasi = () => {
  const crud = useCrudPage();
  const { user } = useAuth();
  
  // 1. Cek apakah user dibatasi oleh hak akses SSO
  const isRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;
  
  const [filterTerm, setFilterTerm] = useState('all');
  const [showBulkForm, setShowBulkForm] = useState(false);

  // 2. State untuk Filter Sub Company
  const [subCompanies, setSubCompanies] = useState([]); 
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  // 3. Fetch Master Subcompany saat komponen dimuat
  useEffect(() => {
    const load = async () => {
      try {
        const [resSub] = await Promise.all([
          api.get('/subcom?page=1&pageSize=200'),
        ]);
        
        setSubCompanies(resSub.data.data || []);
        
        // Auto-select Sub Company jika user dibatasi aksesnya
        if (user?.allowed_subcompanies?.length > 0 && resSub.data.data.length > 0) {
          setSubCompanyInput(resSub.data.data[0].sub_company_id);
          setAppliedSubCompany(resSub.data.data[0].sub_company_id);
        }
      } catch { /* silent */ }
    };
    if (user) load();
  }, [user]);

  // Handler update state filter Sub Company
  const handleFilterChange = (setter, value) => {
    setter(value);
    setAppliedSubCompany(value); 
  };

  // Dinamisasi opsi dropdown: Hapus opsi "Semua" jika user dibatasi
  const subCompanyOptions = isRestricted
    ? subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name }))
    : [
        { value: '', label: 'Semua Sub Company' },
        { value: 'TYPE_OS', label: 'Outsource' },
        { value: 'TYPE_VENDOR', label: 'Vendor/Kontraktor' },
        ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
      ];

  return (
    <div>
      <PageHeader
        title="Alokasi Kantin"
        searchPlaceholder="Cari ID atau Nama Karyawan..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
        {/* Tombol Tambah Single (1 per 1) */}
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

        {/* Tombol Tambah Massal (Bulk / Multiple Employees) */}
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
        <AlokasiForm
          onClose={crud.handleClose}
          onSuccess={crud.handleRefresh}
          initialData={crud.editingData}
        />
      )}

      {showBulkForm && (
        <AlokasiBulkForm
          onClose={() => setShowBulkForm(false)}
          onSuccess={crud.handleRefresh}
        />
      )}

      <div className="app-card">
        {/* Menggunakan d-flex dan gap untuk merapikan baris filter */}
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

          {/* 4. Tambahan Filter Dropdown Sub Company */}
          <div className="filter-group m-0" style={{ minWidth: 180 }}>
            <label style={{ fontSize: 13, marginBottom: '4px', display: 'block' }}>Sub Company</label>
            <Select
              options={subCompanyOptions}
              placeholder="Cari..."
              value={subCompanyOptions.find(o => o.value === subCompanyInput) || subCompanyOptions[0]}
              onChange={o => handleFilterChange(setSubCompanyInput, o?.value || '')}
              isClearable={!isRestricted} // Disable tombol clear jika user dibatasi
              isSearchable
              menuPortalTarget={document.body}
              styles={{ 
                control: b => ({ ...b, minHeight: 34, fontSize: 13 }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>

        </div>

        {/* 5. Meneruskan subCompanyFilter ke komponen tabel */}
        <AlokasiTable
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

export default Alokasi;