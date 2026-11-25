import React from 'react';

const LoadingButton = ({ 
  loading = false, 
  loadingText = 'Memproses...', 
  children, 
  className = 'btn-app btn-primary-app', 
  disabled = false, 
  icon = null,
  type = 'button',
  ...props 
}) => {
  return (
    <button 
      type={type} 
      className={className} 
      disabled={loading || disabled} 
      {...props}
    >
      {loading ? (
        <>
          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
          {loadingText}
        </>
      ) : (
        <>
          {icon && <i className={`${icon} me-1`}></i>}
          {children}
        </>
      )}
    </button>
  );
};

export default LoadingButton;