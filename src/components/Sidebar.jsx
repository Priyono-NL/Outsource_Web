import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const [isMasterOpen, setIsMasterOpen] = useState(false)
  return (
    <div 
      className="d-flex flex-column flex-shrink-0 p-3 text-white bg-dark vh-100 shadow-sm" 
      style={{ width: '250px', position: 'sticky', top: '0', overflowY: 'auto', }}
    >
      <ul className="nav nav-pills flex-column gap-1">
        <li className="nav-item">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
            Dashboard
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/card" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
            Absence Card
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/oscc" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
            OS Cost Center
          </NavLink>
        </li>
      </ul>
      <hr />
      <ul className="nav nav-pills flex-column gap-1">
        <li className="nav-item">
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
                  Sub Company
                </NavLink>
              </li>
              <li>
                <NavLink 
                  to="/training-m" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Training
                </NavLink>
              </li>
              <li>
                <NavLink to="/medical-m" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Medical
                </NavLink>
              </li>
              <li>
                <NavLink to="/canteen" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Kantin
                </NavLink>
              </li>
              <li>
                <NavLink to="/costcenter" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
                  Cost Center
                </NavLink>
              </li>
            </ul>
          )}
        </li>
        <li className="nav-item">
          <NavLink to="/alokasi" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
            Alokasi Kantin
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/os-medical" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
            Medical OS
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink to="/os-training" className={({ isActive }) => `nav-link ${isActive ? 'active bg-primary' : 'text-white'}`}>
            Training OS
          </NavLink>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;