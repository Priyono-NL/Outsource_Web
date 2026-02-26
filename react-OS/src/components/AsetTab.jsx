import React from 'react';

function AsetTab() {
  return (
    <div className="fade show active">
        <div class="row g-3">
            <div class="mb-3 col-3">
                <label class="form-label small fw-bold">No Kartu Absensi</label>
                <input type="text" name="card_number" class="form-control" />
            </div>          
        </div>
    </div>
  );
}

export default AsetTab;