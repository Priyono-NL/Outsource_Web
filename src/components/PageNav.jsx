import React, { useState, useEffect } from 'react';

const PageNav = ({ currentPage, totalPages, onPageChange }) => {
  const [jumpToPage, setJumpToPage] = useState('');

  useEffect(() => {
    setJumpToPage(currentPage);
  }, [currentPage]);

  if (totalPages <= 0) return null;

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handleJump = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    } else {
      setJumpToPage(currentPage);
    }
  };

  return (
    <div className="pagination-bar text-end mt-3">

      {/* Bagian Paginasi Utama (Memakai inline-block murni) */}
      <div className="d-inline-block" style={{ verticalAlign: 'middle' }}>
        <button
          className="btn-app btn-ghost-app btn-sm-app"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="bi bi-chevron-left" /> Prev
        </button>

        <span className="page-info mx-2">
          {getPageNumbers().map((page, index) => (
            <button
              key={index}
              className={`btn-app btn-sm-app mx-1 ${page === currentPage ? 'btn-primary-app text-white' : 'btn-ghost-app'}`}
              onClick={() => page !== '...' && onPageChange(page)}
              disabled={page === '...'}
              style={{ minWidth: '32px' }}
            >
              {page}
            </button>
          ))}
        </span>

        <button
          className="btn-app btn-ghost-app btn-sm-app"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next <i className="bi bi-chevron-right" />
        </button>
      </div>

      {/* Bagian Go To Sederhana (Menyamping, tanpa flexbox yang ribet) */}
      <form onSubmit={handleJump} className="d-inline-block ms-4" style={{ verticalAlign: 'middle' }}>
        <span className="me-2 text-muted" style={{ fontSize: '14px' }}>Go to:</span>
        
        {/* Input Group bawaan Bootstrap */}
        <div className="input-group input-group-sm d-inline-flex" style={{ width: '110px' }}>
          <input
            type="number"
            className="form-control text-center"
            min="1"
            max={totalPages}
            value={jumpToPage}
            onChange={(e) => setJumpToPage(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">
            Go
          </button>
        </div>
      </form>

    </div>
  );
};

export default PageNav;