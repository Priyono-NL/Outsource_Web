import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import api from '../../api/api';

function EmployTab() {
  const [isNoLimit, setIsNoLimit] = useState(false);
  const [subcom, setSubcom] = useState([]);
  const [costCenter, setCostCenter] = useState([]);
  const [selectSubComId, setSelectSubComId] = useState(null);
  const [selectCCId, setselectCCId] = useState(null);

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

  const customSelectStyles = {
    control: (base) => ({
      ...base,
      minHeight: '38px',
      borderRadius: 'var(--radius-md)',
      borderColor: '#dee2e6',
      fontSize: '14px',
      boxShadow: 'none',
      '&:hover': { borderColor: 'var(--color-primary)' }
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '13px',
      backgroundColor: state.isSelected ? 'var(--color-primary)' : state.isFocused ? '#f8f9fa' : 'white',
    })
  };

  return (
    <div className="animate__animated animate__fadeIn">
      <div className="row g-3">
        <div className="col-md-8">
          <label className="form-label small fw-bold text-muted">No Induk Karyawan (NRP)<span className="text-danger">*</span></label>
          <input type="text" name="employee_id" className="form-control" placeholder="Contoh: 123456" />
        </div>
        
        <div className="col-md-4">
          <label className="form-label small fw-bold text-muted">Grade</label>
          <input type="text" name="grade" className="form-control" placeholder="Pilih Grade" />
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted">Sub Company</label>
          <Select
            options={subcomOptions}
            isSearchable={true}
            placeholder="Pilih Sub Co..."
            styles={customSelectStyles}
            value={subcomOptions.find(opt => opt.value === selectSubComId) || null}
            onChange={(opt) => setSelectSubComId(opt ? opt.value : null)}
          />
          <input type="hidden" name="sub_company_id" value={selectSubComId || ''} />
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted">Department</label>
          <Select
            options={ccOptions}
            isSearchable={true}
            placeholder="Pilih Department..."
            styles={customSelectStyles}
            value={ccOptions.find(opt => opt.value === selectCCId) || null}
            onChange={(opt) => setselectCCId(opt ? opt.value : null)}
          />
          <input type="hidden" name="cc_id" value={selectCCId || ''} />
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted">Type Worker</label>
          <select name="type_worker" className='form-select'>
            <option value="DAILYWAGE">Daily Wage</option>
            <option value="PIECERATE">Piece Rate</option>
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted">Posisi / Jabatan</label>
          <input type="text" name="posisi" className="form-control" placeholder="Contoh: Operator Produksi" />
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold text-muted">Mulai Kontrak (Valid From)</label>
          <input type="date" name="valid_from" className="form-control" />
        </div>

        <div className="col-md-6">
          <div className="d-flex justify-content-between">
            <label className="form-label small fw-bold text-muted">Selesai Kontrak (Valid To)</label>
            <div className="form-check">
              <input
                type="checkbox"
                id="no_limit"
                className="form-check-input"
                checked={isNoLimit}
                onChange={(e) => setIsNoLimit(e.target.checked)}
              />
              <label className="form-check-label small fw-bold text-primary" htmlFor="no_limit" style={{ cursor: 'pointer' }}>
                No Limit
              </label>
            </div>
          </div>
          <input
            type="date"
            name="valid_to"
            className="form-control"
            disabled={isNoLimit}
            style={isNoLimit ? { backgroundColor: '#f1f3f5', opacity: 0.6 } : {}}
          />
        </div>
      </div>
    </div>
  );
}

export default EmployTab;