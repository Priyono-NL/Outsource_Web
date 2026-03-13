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
              `nav-link ${isActive ? 'active bg-primary' : 'text-white'} mb-1`
            }
            style={{ borderRadius: '8px' }}
          >
            {route.label}
          </NavLink>
        </li>
      ));
  };

  return (
    <div 
      className="d-flex flex-column flex-shrink-0 p-3 text-white bg-dark vh-100 shadow-sm" 
      style={{ width: '220px', position: 'sticky', top: '0', overflowY: 'auto' }}
    >
      <ul className="nav nav-pills flex-column">
        {renderGroup(0)}        
        <hr className="text-white-50" />
        {renderGroup(1)}
        <hr className="text-white-50" />
        {renderGroup(2)}
        <hr className="text-white-50" />
        {renderGroup(3)}
      </ul>
    </div>
  );
};

export default Sidebar;