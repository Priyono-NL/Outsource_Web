import React from 'react';

function EmployTab() {
  return (
    <div className="fade show active">
        <div className="row g-3">
            <div className="mb-3 col-3">
                <label className="form-label small fw-bold">No Induk Karywan</label>
                <input type="text" name="nik" className="form-control" />
            </div>
            <div className="mb-3 col-3">
                <label className="form-label small fw-bold">Sub Company</label>
                <input type="text" name="sub_company" className="form-control" />
            </div>
            <div className="mb-3 col-3">
                <label className="form-label small fw-bold">Grade</label>
                <input type="text" name="grade" className="form-control" />
            </div>
            <div className="mb-3 col-3">
                <label className="form-label small fw-bold">Cost Center</label>
                <input type="text" name="cc" className="form-control" />
            </div>            
        </div>
    </div>
  );
}

export default EmployTab;