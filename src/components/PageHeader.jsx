// src/components/PageHeader.jsx
// Komponen header halaman — menghilangkan repeat di 14 pages
const PageHeader = ({
  title,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSearch,
  children,   // tombol-tombol aksi (Add, Export, dll)
}) => (
  <div className="page-header">
    <h1 className="page-title">{title}</h1>

    {searchPlaceholder !== undefined && (
      <div className="page-search">
        <i className="bi bi-search search-icon" />
        <input
          type="text"
          placeholder={searchPlaceholder || 'Cari...'}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch?.()}
        />
      </div>
    )}

    {children && <div className="page-actions">{children}</div>}
  </div>
);

export default PageHeader;
