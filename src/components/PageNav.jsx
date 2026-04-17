// src/components/PageNav.jsx
const PageNav = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 0) return null;
  return (
    <div className="pagination-bar">
      <button
        className="btn-app btn-ghost-app btn-sm-app"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <i className="bi bi-chevron-left" /> Prev
      </button>
      <span className="page-info">
        <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
      </span>
      <button
        className="btn-app btn-ghost-app btn-sm-app"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next <i className="bi bi-chevron-right" />
      </button>
    </div>
  );
};
export default PageNav;
