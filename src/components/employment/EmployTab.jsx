import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import api from '../../api/api';

function EmployTab({ initialData }) {
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [subcom, setSubcom] = useState([]);
  const [costCenter, setCostCenter] = useState([]);
  const [selectSubComId, setSelectSubComId] = useState(null);
  const [selectCCId, setselectCCId] = useState(null);

  const [formData, setFormData] = useState({
    employee_id: '',
    grade: '',
    type_worker: 'DAILYWAGE',
    posisi: '',
    valid_from: '',
    valid_to: ''
  });

  const isEditMode = !!initialData;

  useEffect(() => {
    const fetchSubCom = async () => {
      try {
        const response = await api.get('/subcom?page=1&pageSize=200');
        if (response.data.status === 'success') setSubcom(response.data.data);
      } catch (error) {
        console.error("Gagal mengambil subcom:", error);
      }
    };
    const fetchCC = async () => {
      try {
        const cc_res = await api.get('/costcenter?page=1&pageSize=200');
        if (cc_res.data.status === 'success') setCostCenter(cc_res.data.data);
      } catch (error) {
        console.error("Gagal Mengambil CC:", error)
      }
    };
    fetchSubCom();
    fetchCC();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        employee_id: initialData.employee_code || initialData.employee_id || '',
        grade: initialData.grade || '',
        type_worker: initialData.type_worker || '',
        posisi: initialData.posisi || '',
        valid_from: initialData.valid_from || '',
        valid_to: initialData.valid_to || ''
      });
      setSelectSubComId(initialData.sub_company_id || null);
      setselectCCId(initialData.cc_id || null);
      setIsNoLimit(!initialData.valid_to);
    }
  }, [initialData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const subcomOptions = subcom.map((item) => ({
    value: item.sub_company_id,
    label: item.sub_company_name
  }));

  const ccOptions = [
    { value: "", label: "No Cost Center" },
    ...costCenter.map((item) => ({
      value: item.cost_center,
      label: item.org_name
    }))
  ];

  // Style Select agar setara dengan form-control-sm
  const customSelectStyles = {
    control: (base) => ({
      ...base,
      minHeight: '31px',
      height: '31px',
      borderRadius: '6px',
      borderColor: '#dee2e6',
      fontSize: '13px',
      boxShadow: 'none',
      '&:hover': { borderColor: '#0d6efd' }
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0px 8px',
    }),
    indicatorsContainer: (base) => ({
      ...base,
      height: '29px',
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '12px',
      padding: '4px 10px',
      backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#f8f9fa' : 'white',
    }),
    menu: (base) => ({ ...base, zIndex: 9999 })
  };

  return (
    <div className="animate__animated animate__fadeIn">
      <div className="row g-2">
        <div className="col-md-8">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>No Induk Karyawan (NRP) <span className="text-danger">*</span></label>
          <input 
            type="text" 
            name="employee_id" 
            className={`form-control form-control-sm ${isEditMode ? 'bg-light fw-bold' : ''}`} 
            placeholder="Contoh: 123456" 
            value={formData.employee_id}
            onChange={handleInputChange}
            readOnly={isEditMode}
            style={isEditMode ? { cursor: 'not-allowed' } : {}}
            required
          />
        </div>
        
        <div className="col-md-4">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Grade</label>
          <input 
            type="text" 
            name="grade" 
            className="form-control form-control-sm" 
            placeholder="Grade"
            value={formData.grade}
            onChange={handleInputChange} 
          />
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Sub Company</label>
          <Select
            options={subcomOptions}
            isSearchable={true}
            placeholder="Pilih..."
            styles={customSelectStyles}
            value={subcomOptions.find(opt => opt.value === selectSubComId) || null}
            onChange={(opt) => setSelectSubComId(opt ? opt.value : null)}
          />
          <input type="hidden" name="sub_company_id" value={selectSubComId || ''} />
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Department</label>
          <Select
            options={ccOptions}
            isSearchable={true}
            placeholder="Pilih..."
            styles={customSelectStyles}
            value={ccOptions.find(opt => opt.value === selectCCId) || null}
            onChange={(opt) => setselectCCId(opt ? opt.value : null)}
          />
          <input type="hidden" name="cc_id" value={selectCCId || ''} />
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Type Worker</label>
          <select 
            name="type_worker" 
            className='form-select form-select-sm'
            value={formData.type_worker}
            onChange={handleInputChange}
          >
            <option value="">-- Pilih --</option>
            <option value="DAILYWAGE">Daily Wage</option>
            <option value="PIECERATE">Piece Rate</option>
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Posisi / Jabatan</label>
          <input 
            type="text" 
            name="posisi" 
            className="form-control form-control-sm" 
            placeholder="Contoh: Operator" 
            value={formData.posisi}
            onChange={handleInputChange}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Mulai Kontrak</label>
          <input 
            type="date" 
            name="valid_from" 
            className="form-control form-control-sm" 
            value={formData.valid_from}
            onChange={handleInputChange}
          />
        </div>

        <div className="col-md-6">
          <div className="d-flex justify-content-between align-items-center">
            <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Selesai Kontrak</label>
            <div className="form-check p-0 m-0">
              <input
                type="checkbox"
                id="no_limit_employ"
                className="form-check-input"
                style={{ marginLeft: '-1.2em', marginTop: '0.2em', scale: '0.8' }}
                checked={isNoLimit}
                onChange={(e) => {
                  setIsNoLimit(e.target.checked);
                  if (e.target.checked) {
                    setFormData(prev => ({ ...prev, valid_to: '' }));
                  }
                }}
              />
              <label className="form-check-label text-primary fw-bold" htmlFor="no_limit_employ" style={{ cursor: 'pointer', fontSize: '0.65rem' }}>
                NO LIMIT
              </label>
            </div>
          </div>
          <input
            type="date"
            name="valid_to"
            className="form-control form-control-sm"
            disabled={isNoLimit}
            value={formData.valid_to}
            onChange={handleInputChange}
            style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
          />
        </div>
      </div>
    </div>
  );
}

export default EmployTab;