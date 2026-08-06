import React, { useState, useEffect } from 'react';
import api from '../../api/api';

const ReportMpCcTable = ({ refreshTrigger, searchDate }) => { 
    
    const [absensi, setAbsensi] = useState([]); 
    const [subCompanies, setSubCompanies] = useState([]); 
    const [error, setError] = useState(null); 
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const params = new URLSearchParams({
                search_date: searchDate || '',
            }).toString();

            const response = await api.get(`/reportMpCc?${params}`);
            const result = response.data;
            
            if (result && result.status === 'success') { 
                setAbsensi(Array.isArray(result.data) ? result.data : []); 
                // ✅ BARIS INI DIKEMBALIKAN: Membaca ["GLB", "PRO"] dari Backend
                setSubCompanies(Array.isArray(result.sub_companies) ? result.sub_companies : []); 
            } else { 
                throw new Error(result?.message || 'Terjadi kesalahan saat mengambil data laporan'); 
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Gagal terhubung ke server');
            setAbsensi([]);
            setSubCompanies([]); // Reset kolom jika error
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch data jika searchDate tersedia atau tombol apply (refreshTrigger) ditekan
    useEffect(() => {
        if (!searchDate) return;
        fetchData();
    }, [refreshTrigger, searchDate]);

    // Kalkulasi dinamis untuk colSpan Empty State & Loading
    const safeSubComLength = Array.isArray(subCompanies) ? subCompanies.length : 0;
    const totalColumns = safeSubComLength + 2; // 1 Kolom CC + N Kolom SubCom + 1 Kolom Total

    // Kalkulasi Total Bawah (Footer)
    const grandTotalManpower = absensi.reduce((acc, curr) => acc + (curr?.total_manpower || 0), 0);

    const getSubCompanyTotal = (scName) => {
        return absensi.reduce((acc, curr) => acc + (curr?.sub_companies?.[scName] || 0), 0);
    };

    return (
        <>
            {error && (
                <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                </div>
            )}        
            
            <div className="table-responsive">
                <table className="app-table">
                    {/* HEADER */}
                    <thead>
                        <tr>
                            <th>COST CENTER</th>
                            {/* Render Nama Sub Company (GLB, PRO) secara Dinamis dari Backend */}
                            {safeSubComLength > 0 && subCompanies.map((scName, idx) => (
                                <th key={`head-sc-${idx}`} className="text-center">{scName}</th>
                            ))}
                            <th className="text-center">TOTAL MANPOWER</th>
                        </tr>
                    </thead>
                    
                    {/* BODY */}
                    <tbody>
                        { loading ? (
                            <tr>
                                <td colSpan={totalColumns} className="text-center py-4 text-muted">
                                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                    Memuat seluruh data laporan...
                                </td>
                            </tr>
                        ) : absensi.length > 0 ? (
                            absensi.map((emp, index) => (
                                <tr key={`mp-cc-${emp.cc || 'none'}-${index}`}>
                                    <td>{emp.cc || '-'}</td>
                                    
                                    {/* Looping Nilai Absensi per Sub Company */}
                                    {safeSubComLength > 0 && subCompanies.map((scName, scIdx) => {
                                        const count = emp.sub_companies?.[scName] || 0;
                                        return (
                                            <td key={`val-${scIdx}`} className="text-center">
                                                {count > 0 ? count : '-'}
                                            </td>
                                        );
                                    })}
                                    
                                    <td className="text-center fw-bold">{emp.total_manpower || 0}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={totalColumns} className="empty-state text-center py-4 text-muted">
                                    <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                                    Data absensi tidak ditemukan
                                </td>
                            </tr>
                        )}
                    </tbody>

                    {/* FOOTER TOTAL */}
                    {!loading && absensi.length > 0 && (
                        <tfoot>
                            <tr className="fw-bold" style={{ backgroundColor: '#f4f5f7', borderTop: '2px solid #333' }}>
                                <td>TOTAL</td>
                                
                                {safeSubComLength > 0 && subCompanies.map((scName, scIdx) => (
                                    <td key={`foot-sc-${scIdx}`} className="text-center">
                                        {getSubCompanyTotal(scName)}
                                    </td>
                                ))}
                                
                                <td className="text-center">{grandTotalManpower}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>        
        </>
    );
};

export default ReportMpCcTable;