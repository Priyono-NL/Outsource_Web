import React from 'react';
import './StatCard.css';

// Props: title, value, subtitle, icon, color (hex)
const StatCard = ({ title, value, subtitle, icon, color = "#198754" }) => {
  return (
    <div className="card custom-card shadow-sm p-4 h-100">

      <div 
        className="icon-bg-shape" 
        style={{ backgroundColor: color, opacity: 0.1 }}
      ></div>
      
      <div className="card-body z-1 p-0">
        <h6 className="text-uppercase fw-bold text-secondary mb-3" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>
          {title}
        </h6>
        
        <h1 className="display-5 fw-bold mb-0">
          {value}
        </h1>
        
        <p className="text-secondary mt-2 mb-0" style={{ fontSize: '0.85rem' }}>
          {subtitle}
        </p>

        <div className="position-absolute top-0 end-0 m-3" style={{ color: color }}>
          <i className={`bi ${icon}`} style={{ fontSize: '1.6rem' }}></i>
        </div>
      </div>
    </div>
  );
};

export default StatCard;