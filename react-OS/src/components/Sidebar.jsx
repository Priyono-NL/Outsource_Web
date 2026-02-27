import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const [isMasterOpen, setIsMasterOpen] = useState(false)
  return (
    <div 
      className="d-flex flex-column flex-shrink-0 p-3 text-white bg-dark vh-100 shadow-sm" 
      style={{ width: '250px', position: 'sticky', top: '0' }}
    >
      <ul className="nav nav-pills flex-column gap-1">
        <li className="nav-item">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
            Dashboard
          </NavLink>
        </li>        
      </ul>
      <hr />
      <ul className="nav nav-pills flex-column gap-1">
        <li>
          <button 
            onClick={() => setIsMasterOpen(!isMasterOpen)}
            className="nav-link text-white w-100 text-start d-flex justify-content-between align-items-center"
            style={{ background: 'transparent', border: 'none' }}
          >
            <span>Master Data</span>
            <span style={{ fontSize: '0.8rem' }}>{isMasterOpen ? '▼' : '▶'}</span>
          </button>
          {isMasterOpen && (
            <ul className="nav flex-column ms-3 mt-1 gap-1" style={{ borderLeft: '1px solid #495057' }}>
              <li>
                <NavLink to="/sub-company" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Master Sub Company
                </NavLink>
              </li>
              <li>
                <NavLink 
                  to="/training-m" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Master Training
                </NavLink>
              </li>
              <li>
                <NavLink to="/medical-m" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Master Medical
                </NavLink>
              </li>
              <li>
                <NavLink to="/canteen" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Master Kantin
                </NavLink>
              </li>
            </ul>
          )}
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;