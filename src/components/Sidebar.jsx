import React, { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { routesConfig, adminRoutes } from '../utils/menuConfig';
// import { usePermission } from '../utils/usePermission';
import { useAuth } from '../utils/useAuth';

/* ── Reusable nav item ── */
const NavItem = ({ route, isExpanded }) => (
  <li>
    <NavLink
      to={route.path}
      end={route.path === '/'}
      title={isExpanded ? undefined : route.label}
      className={({ isActive }) =>
        `sidebar-link${isActive ? ' active' : ''}`
      }
    >
      <i className={`bi ${route.icon} sidebar-icon`} />
      {isExpanded && <span className="sidebar-label">{route.label}</span>}
    </NavLink>
  </li>
);

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
            .map(route => (
              <NavItem key={route.path} route={route} isExpanded={isExpanded} />
            ))}
        </Fragment>
      ))}

      {isAdmin && (
        <Fragment key="admin-section">
          <li><div className="sidebar-divider" /></li>
          {adminRoutes
            .filter(r => r.roles.includes(role))
            .map(route => (
              <NavItem key={route.path} route={route} isExpanded={isExpanded} />
            ))}
        </Fragment>
      )}
    </ul>
  );
};

export default Sidebar;
