import React, { useState, useEffect } from 'react';

function AsetTab() {
  const [isNoLimit, setIsNoLimit] = useState(false);
  
  useEffect(() => {
        setIsNoLimit
    }, []);

  return (
    <div className="fade show active">
        <div className="row g-3">
            <div className="mb-3 col-7">
                <label className="form-label small fw-bold">Absence Card Number</label>
                <input type="text" name="card_number" className="form-control" required />
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Absence Card Valid From</label>
                <input type="date" name="c_valid_from" className="form-control" required />
            </div>
            <div className="mb-3 col-6">
                <label className="form-label small fw-bold">Absence Card Valid To</label>                        
                <input 
                    type="date" 
                    name="c_valid_to" 
                    id="c_valid_to" 
                    className="form-control" 
                    disabled={isNoLimit}
                />
                <input 
                    type="checkbox" 
                    id="no_c_limit" 
                    className="form-check-input"
                    checked={isNoLimit}
                    onChange={(e) => setIsNoLimit(e.target.checked)}
                />
                <label className="c_form-check-label" htmlFor="no_c_limit">
                    No Limit
                </label> 
            </div>         
        </div>
    </div>
  );
}

export default AsetTab;