import React, { Fragment, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../utils/useAuth';

/* ── Reusable nav item (Link Tunggal) ── */
const NavItem = ({ route, isExpanded }) => {
  // Ambil label dari title, label, atau name (fallback safe)
  const menuTitle = route.title || route.label || route.name;

  // Jika path kosong/tidak ada, jangan render
  if (!route.path) return null;

  return (
    <li>
      <NavLink
        to={route.path}
        end={route.path === '/'}
        title={isExpanded ? undefined : menuTitle}
        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
      >
        <i className={`bi ${route.icon || 'bi-circle'} sidebar-icon`} />
        {isExpanded && <span className="sidebar-label">{menuTitle}</span>}
      </NavLink>
    </li>
  );
};

/* ── Komponen Folder (Dropdown) ── */
const NavFolder = ({ route, isExpanded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuTitle = route.title || route.label || route.name;

  // Mencegat event bawaan template jika ada
  const handleToggleFolder = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="sidebar-folder-wrapper" style={{ display: 'block', width: '100%' }}>
      <button 
        type="button"
        className="sidebar-folder-btn" 
        onClickCapture={handleToggleFolder} 
        style={{ 
          cursor: 'pointer',
          display: 'flex', 
          alignItems: 'center',
          padding: '0.625rem 1.625rem',
          color: '#e9ecef',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left'
        }}
      >
        <i className={`bi ${route.icon || 'bi-folder'} sidebar-icon`} style={{ marginRight: isExpanded ? '10px' : '0' }} />
        {isExpanded && (
          <>
            <span className="sidebar-label">{menuTitle}</span>
            <i className={`bi bi-chevron-${isOpen ? 'down' : 'right'} ms-auto`} />
          </>
        )}
      </button>

      {isOpen && (
        <ul 
          className="sidebar-sub-nav" 
          style={{ 
            listStyle: 'none', 
            margin: isExpanded ? '5px 0' : '10px 0', 
            padding: isExpanded ? '0 0 0 1.5rem' : '0',
            textAlign: isExpanded ? 'left' : 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: isExpanded ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            paddingTop: isExpanded ? '0' : '5px',
            paddingBottom: isExpanded ? '0' : '5px'
          }}
        >
          {/* Looping anak menu (Sub-menu) */}
          {route.children.map(child => (
            <NavItem key={child.id || child.path} route={child} isExpanded={isExpanded} />
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Komponen Utama Sidebar ── */
const Sidebar = ({ isExpanded }) => {
  // 1. Ambil data user dari Context SSO
  const { user } = useAuth();
  
  // 2. Ambil array 'menus' hasil generate backend Python
  const dynamicRoutes = user?.menus || []; 

  // 3. Kelompokkan route per group_no / group (dengan fallback nilai default 1)
  const groups = [...new Set(dynamicRoutes.map(r => r.group_no ?? r.group ?? 1))].sort();

  return (
    <ul className="sidebar-nav">
      {groups.map((g, gi) => (
        <Fragment key={`group-${g}`}>
          {/* Divider antar grup */}
          {gi > 0 && <li><div className="sidebar-divider" /></li>}
          
          {/* Render menu berdasarkan grupnya */}
          {dynamicRoutes
            .filter(r => (r.group_no ?? r.group ?? 1) === g)
            .map((route, index) => (
              route.children && route.children.length > 0 ? (
                <NavFolder key={`folder-${route.id || index}`} route={route} isExpanded={isExpanded} />
              ) : (
                <NavItem key={route.id || route.path} route={route} isExpanded={isExpanded} />
              )
            ))}
        </Fragment>
      ))}
    </ul>
  );
};

export default Sidebar;