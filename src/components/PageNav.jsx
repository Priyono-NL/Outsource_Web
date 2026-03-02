import React, { useState, useEffect } from 'react';

const PageNav = ({ currentPage, totalPages, onPageChange   }) => {
    if (totalPages <= 0) return null;
    return(
        <div className="d-flex justify-content-center align-items-center gap-3 mt-4 mb-3">
            <button 
                className="btn btn-outline-secondary btn-sm px-3" 
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{ minWidth: '80px' }}
            >
                &laquo; Prev
            </button>
            <span className="text-secondary small mb-0">
                Page <strong className="text-dark fs-6">{currentPage}</strong> of <strong className="text-dark">{totalPages}</strong>
            </span>
            <button 
                className="btn btn-outline-primary btn-sm px-3" 
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{ minWidth: '80px' }}
            >
                Next &raquo;
            </button>
        </div>
    );
}
export default PageNav;