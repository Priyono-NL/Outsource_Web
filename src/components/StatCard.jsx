// src/components/StatCard.jsx
// StatCard.css dihapus — style masuk index.css
const StatCard = ({ title, value, subtitle, icon, color = '#3b82f6' }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: `${color}18`, color }}>
      <i className={`bi ${icon}`} />
    </div>
    <div className="stat-body">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-sub">{subtitle}</div>}
    </div>
  </div>
);
export default StatCard;
