import React, { Fragment, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { routesConfig, adminRoutes } from '../utils/menuConfig';
import { usePermission } from '../utils/usePermission';
import { useAuth } from '../utils/useAuth';

/* ── Reusable nav item (Link Tunggal) ── */
const NavItem = ({ route, isExpanded }) => {
  // BENAR: Jika TIDAK ADA path, jangan di-render (mencegah error link kosong)
  if (!route.path) return null;

  return (
    <li>
      <NavLink
        to={route.path}
        end={route.path === '/'}
        title={isExpanded ? undefined : route.label}
        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
      >
        <i className={`bi ${route.icon} sidebar-icon`} />
        {isExpanded && <span className="sidebar-label">{route.label}</span>}
      </NavLink>
    </li>
  );
};

/* ── Komponen Folder (Dropdown) ── */
const NavFolder = ({ route, isExpanded }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Pakai onClickCapture untuk mencegat script bawaan template
  const handleToggleFolder = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }
    setIsOpen(!isOpen);
  };

  return (
    // UBAH <li> jadi <div> agar tidak dibajak oleh script template
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
        <i className={`bi ${route.icon} sidebar-icon`} style={{ marginRight: isExpanded ? '10px' : '0' }} />
        {isExpanded && (
          <>
            <span className="sidebar-label">{route.label}</span>
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
          {route.children.map(child => (
            <NavItem key={child.path} route={child} isExpanded={isExpanded} />
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Komponen Utama Sidebar ── */
const Sidebar = ({ isExpanded }) => {
  // const { filterRoutes } = usePermission();
  const { authState } = useAuth();

  const role = authState.user?.role || 'user';
  const isAdmin = ['admin', 'superadmin'].includes(role);
  
  // const allowedRoutes = filterRoutes(routesConfig);
  const allowedRoutes = routesConfig;

  // Kelompokkan route per group number
  const groups = [...new Set(allowedRoutes.map(r => r.group))].sort();

  return (
    <ul className="sidebar-nav">
      {groups.map((g, gi) => (
        <Fragment key={`group-${g}`}>
          {gi > 0 && <li><div className="sidebar-divider" /></li>}
          {allowedRoutes
            .filter(r => r.group === g)
            .map((route, index) => (
              route.children ? (
                <NavFolder key={`folder-${index}`} route={route} isExpanded={isExpanded} />
              ) : (
                <NavItem key={route.path} route={route} isExpanded={isExpanded} />
              )
            ))}
        </Fragment>
      ))}

      {isAdmin && (
        <Fragment key="admin-section">
          <li><div className="sidebar-divider" /></li>
          {adminRoutes
            .filter(r => r.roles.includes(role))
            .map((route, index) => (
              route.children ? (
                <NavFolder key={`admin-folder-${index}`} route={route} isExpanded={isExpanded} />
              ) : (
                <NavItem key={route.path} route={route} isExpanded={isExpanded} />
              )
            ))}
        </Fragment>
      )}
    </ul>
  );
};

export default Sidebar;