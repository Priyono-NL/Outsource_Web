import React, { useState, useEffect } from 'react';
import api from '../../api/api';

const Summary_Table = ({ refreshTrigger, searchDate }) => { 
    
    const [absensi, setAbsensi] = useState([]); 
    const [shifts, setShifts] = useState(["NS", "SHIFT 1", "SHIFT 2", "SHIFT 3"]);
    const [totals, setTotals] = useState(null);
    const [error, setError] = useState(null); 
    const [loading, setLoading] = useState(false);

    // Hitung total kolom dinamis untuk colSpan loading & empty state
    // Formula: 1 (Cost Center) + (Jumlah Shift * 2 [OS & OB]) + 1 (Total CC)
    const safeShiftLength = shifts.length > 0 ? shifts.length : 4;
    const totalColumns = 1 + (safeShiftLength * 2) + 1;

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const params = new URLSearchParams({
                search_date: searchDate || '',
            }).toString();

            // Panggil endpoint khusus Laporan Harian
            const response = await api.get(`/reportHarian?${params}`);
            const result = response.data;
            
            if (result && result.status === 'success') { 
                setAbsensi(Array.isArray(result.data) ? result.data : []);
                setShifts(Array.isArray(result.shifts) ? result.shifts : ["NS", "SHIFT 1", "SHIFT 2", "SHIFT 3"]);
                setTotals(result.totals || null);
            } else { 
                throw new Error(result?.message || 'Terjadi kesalahan saat mengambil data laporan'); 
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Gagal terhubung ke server');
            setAbsensi([]);
            setTotals(null);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data otomatis jika searchDate atau refreshTrigger berubah
    useEffect(() => {
        if (!searchDate) return;
        fetchData();
    }, [refreshTrigger, searchDate]);

    return (
        <>
            {error && (
                <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                </div>
            )}        
            
            <div className="table-responsive">
                <table className="app-table">
                    {/* ========================================================================= */}
                    {/* HEADER MATRIKS BERTINGKAT (COST CENTER - MANPOWER - STATUS & SHIFT) */}
                    {/* ========================================================================= */}
                    <thead>
                        <tr>
                            <th rowSpan="3" className="align-middle text-center">COST CENTER</th>
                            <th colSpan={safeShiftLength * 2} className="text-center">MAN POWER</th>
                            <th rowSpan="3" className="align-middle text-center">TOTAL</th>
                        </tr>
                        <tr>
                            <th colSpan={safeShiftLength} className="text-center">Outsourcing</th>
                            <th colSpan={safeShiftLength} className="text-center">Tetap / Kontrak</th>
                        </tr>
                        <tr>
                            {/* Header Shift untuk Outsourcing */}
                            {shifts.map((sName, idx) => (
                                <th key={`head-os-s-${idx}`} className="text-center" style={{ minWidth: 60 }}>
                                    {sName}
                                </th>
                            ))}
                            {/* Header Shift untuk Tetap / Kontrak */}
                            {shifts.map((sName, idx) => (
                                <th key={`head-ob-s-${idx}`} className="text-center" style={{ minWidth: 60 }}>
                                    {sName}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* ========================================================================= */}
                    {/* BODY DATA TABEL (MEMUAT SELURUH DATA LANGSUNG) */}
                    {/* ========================================================================= */}
                    <tbody>
                        { loading ? (
                            <tr>
                                <td colSpan={totalColumns} className="text-center py-4 text-muted">
                                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                    Memuat data laporan harian...
                                </td>
                            </tr>
                        ) : absensi.length > 0 ? (
                            absensi.map((emp, index) => (
                                <tr key={`daily-cc-${emp?.cc || 'none'}-${index}`}>
                                    <td>{emp?.cc || '-'}</td>

                                    {/* Kolom Shift Outsourcing (OS) */}
                                    {shifts.map((sName, sIdx) => {
                                        const count = emp?.os?.[sName] || 0;
                                        return (
                                            <td key={`val-os-${sIdx}`} className="text-center">
                                                {count > 0 ? count : '-'}
                                            </td>
                                        );
                                    })}

                                    {/* Kolom Shift Tetap / Kontrak (OB) */}
                                    {shifts.map((sName, sIdx) => {
                                        const count = emp?.ob?.[sName] || 0;
                                        return (
                                            <td key={`val-ob-${sIdx}`} className="text-center">
                                                {count > 0 ? count : '-'}
                                            </td>
                                        );
                                    })}

                                    {/* Total Manpower Cost Center */}
                                    <td className="text-center fw-bold">{emp?.total_cc || 0}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={totalColumns} className="empty-state text-center py-4 text-muted">
                                    <i className="bi bi-inbox d-block mb-1 fs-4"></i>
                                    Data absensi harian tidak ditemukan
                                </td>
                            </tr>
                        )}
                    </tbody>

                    {/* ========================================================================= */}
                    {/* FOOTER BARIS TOTAL DI PALING BAWAH */}
                    {/* ========================================================================= */}
                    {!loading && absensi.length > 0 && totals && (
                        <tfoot>
                            <tr className="fw-bold" style={{ backgroundColor: '#f4f5f7', borderTop: '2px solid #333' }}>
                                <td>TOTAL</td>

                                {/* Total Vertikal Shift OS */}
                                {shifts.map((sName, sIdx) => (
                                    <td key={`foot-os-${sIdx}`} className="text-center">
                                        {totals?.os?.[sName] || 0}
                                    </td>
                                ))}

                                {/* Total Vertikal Shift OB */}
                                {shifts.map((sName, sIdx) => (
                                    <td key={`foot-ob-${sIdx}`} className="text-center">
                                        {totals?.ob?.[sName] || 0}
                                    </td>
                                ))}

                                {/* Grand Total Manpower */}
                                <td className="text-center">{totals?.grand_total || 0}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>        
        </>
    );
};

export default Summary_Table;