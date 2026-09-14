import React, { useRef, useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Select from 'react-select'; // 1. Import Select
import { Toast, Confirm } from '../utils/sweetalert';
import { downloadLogFile } from '../utils/logDownloader';
import api from '../api/api';
import { useCrudPage } from '../utils/useCrudPage';
import { useAuth } from '../utils/useAuth'; // 2. Import useAuth

import PageHeader from '../components/PageHeader';
import OsMedicForm from '../components/osMedical/OsMedicForm';
import OsMedicTable from '../components/osMedical/OsMedicTable';

const OsMedical = () => {
  const crud = useCrudPage();
  const { user } = useAuth();
  
  // Cek apakah user dibatasi oleh hak akses SSO
  const isRestricted = user?.allowed_subcompanies && user.allowed_subcompanies.length > 0;

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // --- STATE FILTER SUB COMPANY ---
  const [subCompanies, setSubCompanies] = useState([]); 
  const [subCompanyInput, setSubCompanyInput] = useState('');
  const [appliedSubCompany, setAppliedSubCompany] = useState('');

  // Fetch Master Subcompany saat komponen dimuat
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

  // Handler update state filter
  const handleFilterChange = (setter, value) => {
    setter(value);
    setAppliedSubCompany(value); 
  };

  // Dinamisasi opsi dropdown
  const subCompanyOptions = isRestricted
    ? subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name }))
    : [
        { value: '', label: 'Semua Sub Company' },
        ...subCompanies.map(sc => ({ value: sc.sub_company_id, label: sc.sub_company_name })),
      ];

  const handleExport = async () => {
    try {
      // 3. Tambahkan filter subcompany ke parameter Export!
      const params = new URLSearchParams({ 
        search: crud.appliedSearch || '',
        subcompany: appliedSubCompany || '' 
      }).toString();
      
      const res = await api.get(`/osmedical/export?${params}`, { responseType: 'blob' });
      saveAs(res.data, 'Data_OS_medical.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal export data' });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const { data } = await api.get('/osmedical/template', { responseType: 'blob' });
      saveAs(data, 'Template_Import_Medical.xlsx');
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal download template' });
    }
  };

  const handleImport = async (e) => {
    // ... (Kode handleImport tidak ada yang diubah, tetap sama seperti aslinya)
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.post('/osmedical/upload', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      const { status, message, errors = [], notes = [] } = res.data; 

      const notesHtml = notes.length > 0 
        ? `<div style="text-align:left; margin-top:10px; max-height:100px; overflow-y:auto; background:#e9ecef; padding:10px; border-radius:5px; font-size:.85em; color:#495057;">
            <strong><i class="bi bi-info-circle"></i> Catatan Sistem (${notes.length}):</strong><br/>
            ${notes.slice(0, 5).join('<br/>')} ${notes.length > 5 ? '<br/><i>... (download log untuk melihat sisanya)</i>' : ''}
           </div>`
        : '';

      if (status === 'partial_success') {
        const errorsHtml = `<div style="text-align:left; max-height:100px; overflow-y:auto; background:#fff3f3; padding:10px; border-radius:5px; font-size:.85em; color:#d32f2f;">
                              <strong><i class="bi bi-exclamation-triangle"></i> Daftar Error (${errors.length}):</strong><br/>
                              ${errors.slice(0, 5).join('<br>')} ${errors.length > 5 ? '<br/><i>... (download log untuk melihat sisanya)</i>' : ''}
                            </div>`;
        
        Confirm.fire({ 
          icon: 'warning', 
          title: 'Import Selesai dengan Catatan', 
          html: `<p>${message}</p>${errorsHtml}${notesHtml}`, 
          confirmButtonText: 'Tutup', 
          showDenyButton: true,
          denyButtonText: '<i class="bi bi-file-earmark-text"></i> Download Log',
          denyButtonColor: '#17a2b8'
        }).then((result) => {
          if (result.isDenied) downloadLogFile(errors, notes);
        });

      } else {
        if (notes.length > 0) {
          Confirm.fire({ 
            icon: 'success', 
            title: 'Import Berhasil', 
            html: `<p>${message}</p>${notesHtml}`, 
            confirmButtonText: 'Tutup', 
            showDenyButton: true,
            denyButtonText: '<i class="bi bi-file-earmark-text"></i> Download Log',
            denyButtonColor: '#17a2b8'
          }).then((result) => {
            if (result.isDenied) downloadLogFile([], notes);
          });
        } else {
          Toast.fire({ icon: 'success', title: message });
        }
      }
      crud.handleRefresh();
      
    } catch (error) {
      const errList = error.response?.data?.errors || [];
      const noteList = error.response?.data?.notes || []; 

      const notesHtml = noteList.length > 0 
        ? `<div style="text-align:left; margin-top:10px; max-height:100px; overflow-y:auto; background:#e9ecef; padding:10px; border-radius:5px; font-size:.85em; color:#495057;">
            <strong>Catatan Sistem (${noteList.length}):</strong><br/>
            ${noteList.slice(0, 5).join('<br/>')} ${noteList.length > 5 ? '<br/><i>... (download log)</i>' : ''}
           </div>`
        : '';

      if (errList.length > 0) {
        const errorsHtml = `<div style="text-align:left; max-height:100px; overflow-y:auto; background:#fff3f3; padding:10px; border-radius:5px; font-size:.85em; color:#d32f2f;">
                              <strong>Daftar Error (${errList.length}):</strong><br/>
                              ${errList.slice(0, 5).join('<br>')} ${errList.length > 5 ? '<br/><i>... (download log)</i>' : ''}
                            </div>`;
                            
        Confirm.fire({ 
          icon: 'error', 
          title: 'Gagal Import', 
          html: `${errorsHtml}${notesHtml}`, 
          confirmButtonText: 'Perbaiki Excel',
          showDenyButton: true,
          denyButtonText: '<i class="bi bi-file-earmark-text"></i> Download Log',
          denyButtonColor: '#17a2b8'
        }).then((result) => {
          if (result.isDenied) downloadLogFile(errList, noteList);
        });
      } else {
        Toast.fire({ icon: 'error', title: error.response?.data?.message || 'Terjadi kesalahan saat upload' });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="OS Medical"
        searchPlaceholder="Cari ID atau Nama Karyawan..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
        <button className="btn-app btn-ghost-app" onClick={handleDownloadTemplate}>
          <i className="bi bi-download" /> Template
        </button>
        <label className={`btn-app ${isUploading ? 'btn-ghost-app' : 'btn-ghost-app'}`} style={{ cursor: 'pointer' }}>
          {isUploading
            ? <><span className="spinner-border spinner-border-sm me-1" role="status" /> Proses...</>
            : <><i className="bi bi-upload" /> Import</>}
          <input type="file" hidden ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" disabled={isUploading} />
        </label>
        <button className="btn-app btn-success-app" onClick={handleExport}>
          <i className="bi bi-file-earmark-excel" /> Export
        </button>
        <button
          className={`btn-app ${crud.showForm ? 'btn-danger-app' : 'btn-primary-app'}`}
          onClick={crud.showForm ? crud.handleClose : crud.handleAdd}
        >
          {crud.showForm ? <><i className="bi bi-x" /> Tutup</> : <><i className="bi bi-plus" /> Tambah</>}
        </button>
      </PageHeader>

      {crud.showForm && <OsMedicForm onClose={crud.handleClose} onSuccess={crud.handleRefresh} initialData={crud.editingData} />}

      <div className="app-card">
        {/* 4. Tampilkan Bar Filter Dropdown */}
        <div className="filter-bar d-flex gap-3 mb-3">
          <div className="filter-group m-0" style={{ minWidth: 220 }}>
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

        {/* 5. Lempar subCompanyFilter ke komponen Tabel */}
        <OsMedicTable 
          refreshTrigger={crud.refreshKey} 
          onEditClick={crud.handleEdit} 
          searchTerm={crud.appliedSearch}
          subCompanyFilter={appliedSubCompany} 
        />
      </div>
    </div>
  );
};
export default OsMedical;