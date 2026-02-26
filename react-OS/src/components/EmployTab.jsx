import React from 'react';

function EmployTab() {
  return (
    <div className="fade show active">
        <div class="row g-3">
            <div class="mb-3 col-3">
                <label class="form-label small fw-bold">No Induk Karywan</label>
                <input type="text" name="nik" class="form-control" />
            </div>
            <div class="mb-3 col-3">
                <label class="form-label small fw-bold">Sub Company</label>
                <input type="text" name="sub_company" class="form-control" />
            </div>
            <div class="mb-3 col-3">
                <label class="form-label small fw-bold">Grade</label>
                <input type="text" name="grade" class="form-control" />
            </div>
            <div class="mb-3 col-3">
                <label class="form-label small fw-bold">Cost Center</label>
                <input type="text" name="cc" class="form-control" />
            </div>            
        </div>
    </div>
  );
}

export default EmployTab;