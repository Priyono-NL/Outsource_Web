import { NavLink } from 'react-router-dom';
import { routesConfig } from '../utils/menuConfig';

const Sidebar = () => {
  const renderGroup = (groupNumber) => {
    return routesConfig
      .filter((route) => route.group === groupNumber)
      .map((route) => (
        <li className="nav-item" key={route.path}>
          <NavLink
            to={route.path}
            end={route.path === "/"}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active shadow-sm' : 'text-white-50'} py-2 mb-1`
            }
            style={{ 
              borderRadius: '6px',
              paddingLeft: '12px'
            }}
          >
            {route.icon && (
                <i className={`bi ${route.icon}`} style={{ width: 16, textAlign: 'center', flexShrink: 0 }}></i>
              )}
            <span>  {route.label}</span>
          </NavLink>
        </li>
      ));
  };

  return (
    <div 
      className="d-flex flex-column flex-shrink-0 text-white bg-dark shadow-lg" 
      style={{ 
        width: '230px', 
        height: '93vh', 
        position: 'sticky', 
        top: '0', 
        overflowY: 'auto',
        borderRight: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      <ul className="nav nav-pills flex-column px-3">
        {renderGroup(0)}        
        <hr className="my-2 opacity-25 text-white" /> {/* my-2 untuk merapatkan garis */}
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