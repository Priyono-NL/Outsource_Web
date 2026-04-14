import { NavLink } from 'react-router-dom';
import { routesConfig } from '../utils/menuConfig';

const Sidebar = ({ isExpanded }) => {
  
  const renderGroup = (groupNumber) => {
    return routesConfig
      .filter((route) => route.group === groupNumber)
      .map((route) => (
        <li className="nav-item" key={route.path}>
          <NavLink
            to={route.path}
            end={route.path === "/"}
            title={!isExpanded ? route.label : ""} 
            className={({ isActive }) =>
              `nav-link d-flex align-items-center ${isExpanded ? 'justify-content-start px-3' : 'justify-content-center'} ${isActive ? 'active shadow-sm' : 'text-white-50'} py-2 mb-1`
            }
            style={{ 
              borderRadius: '6px',
              transition: 'all 0.3s ease'
            }}
          >
            {route.icon && (
                <i className={`bi ${route.icon}`} style={{ fontSize: '1.25rem', textAlign: 'center', width: '24px', flexShrink: 0 }}></i>
              )}
            <span className={isExpanded ? "ms-3" : "d-none"} style={{ whiteSpace: 'nowrap' }}>
              {route.label}
            </span>
          </NavLink>
        </li>
      ));
  };

  return (
    <div 
      className="d-flex flex-column flex-shrink-0 text-white bg-dark shadow-lg" 
      style={{ 
        width: isExpanded ? '230px' : '75px', 
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        borderTop: '1px solid rgba(255,255,255,0.05)', // Tambahan batas halus dengan navbar
        transition: 'width 0.3s ease'
      }}
    >
      <ul className={`nav nav-pills flex-column mt-3 ${isExpanded ? 'px-3' : 'px-2'}`}>
        {renderGroup(0)}        
        <hr className="my-2 opacity-25 text-white" /> 
        {renderGroup(1)}
        <hr className="my-2 opacity-25 text-white" />
        {renderGroup(2)}
        <hr className="my-2 opacity-25 text-white" />
        {renderGroup(3)}
      </ul>
    </div>
  );
};

export default Sidebar;