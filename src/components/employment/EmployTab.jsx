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
    // get subcom select
    const fetchSubCom = async () => {
      try {        
        const response = await api.get('/subcom?page=1&pageSize=200'); 
        if (response.data.status === 'success') setSubcom(response.data.data);
      } catch (error) {
        console.error("Gagal mengambil subcom:", error);
      }
    };
    // get CC select
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
  }, [])

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

  useEffect(() => {
        setIsNoLimit
    }, []);

  return (
    <div className="fade show active">
        <div className="row g-3">
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">No Induk Karyawan<span className="text-danger">*</span></label>
                <input type="text" name="employee_id" className="form-control"/>
            </div>
            <div className="mb-3 col-3">
                <label className="form-label small fw-bold">Grade</label>
                <input type="text" name="grade" className="form-control" />
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Sub Company</label>
                <Select 
                    options={subcomOptions}
                    isSearchable={true} 
                    placeholder="Cari Sub Company"
                    maxMenuHeight={200}
                    value={subcomOptions.find(opt => opt.value === selectSubComId) || null}
                    onChange={(selectedOption) => {
                        setSelectSubComId(selectedOption ? selectedOption.value : null);
                    }}
                />
                <input type="hidden" name="sub_company_id" value={selectSubComId || ''} />
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Department</label>
                <Select 
                    options={ccOptions}
                    isSearchable={true} 
                    placeholder="Cari Department"
                    maxMenuHeight={200}
                    value={ccOptions.find(opt => opt.value === selectCCId) || null}
                    onChange={(selectedOption) => {
                        setselectCCId(selectedOption ? selectedOption.value : null);
                    }}
                />
                <input type="hidden" name="cc_id" value={selectCCId || ''} />
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Type Work</label>
                <select name="type_worker" className='form-control' >
                    <option value="DAILYWAGE">Daily Wage</option>
                    <option value="PIECERATE">Piece Rate</option>
                </select>
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Posisi/Jabatan</label>
                <input type="text" name="posisi" className="form-control" />
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Valid From</label>
                <input type="date" name="valid_from" className="form-control" />
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Valid To</label>                        
                <input 
                    type="date" 
                    name="valid_to" 
                    id="valid_to" 
                    className="form-control" 
                    disabled={isNoLimit}
                />
                <input 
                    type="checkbox" 
                    id="no_limit" 
                    className="form-check-input"
                    checked={isNoLimit}
                    onChange={(e) => setIsNoLimit(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="no_limit">
                    No Limit
                </label> 
            </div>        
        </div>
    </div>
  );
}

export default EmployTab;