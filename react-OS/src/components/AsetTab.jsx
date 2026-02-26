import React from 'react';

function AsetTab() {
  return (
    <div className="fade show active">
        <div className="row g-3">
            <div className="mb-3 col-3">
                <label className="form-label small fw-bold">No Kartu Absensi</label>
                <input type="text" name="card_number" className="form-control" />
            </div>          
        </div>
    </div>
  );
}

export default AsetTab;