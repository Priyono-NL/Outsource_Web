import React, { useState, useEffect } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function PersonelTab({ onPersonSelect, initialData }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [formData, setFormData] = useState({
        gender: "L",
        religion: "islam",
        pob: "",
        dob: "",
        resident_id: "",
        address: ""
    });

    const isEditMode = !!initialData;

    useEffect(() => {
        if (initialData) {
            setSelectedPerson({
                person_id: initialData.person_id,
                name: initialData.person_name || initialData.name,
                is_blacklist: initialData.is_blacklist
            });
            setSearchTerm(initialData.person_name || initialData.name || "");
            
            setFormData({
                gender: initialData.gender || "L",
                religion: initialData.religion || "islam",
                pob: initialData.pob || "",
                dob: initialData.dob || "",
                resident_id: initialData.resident_id || "",
                address: initialData.address || ""
            });
        }
    }, [initialData]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.length >= 3 && !selectedPerson && !isEditMode) {
                fetchPersons();
            } else {
                setResults([]);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedPerson, isEditMode]);

    const fetchPersons = async () => {
        setIsSearching(true);
        try {
            const response = await api.get(`/person/search?q=${searchTerm}`);
            setResults(response.data.data);
        } catch (err) {
            const errorMsg = err.response?.data?.message || "Gagal mencari personel";
            Toast.fire({ icon: 'error', title: 'Pencarian Gagal', text: errorMsg });
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelect = (person) => {
        setSelectedPerson(person);
        setSearchTerm(person.name);
        setResults([]);
        onPersonSelect?.(person);
        setFormData({
            gender: person.gender || "L",
            religion: person.religion || "islam",
            pob: person.pob || "",
            dob: person.dob || "",
            resident_id: person.resident_id || "",
            address: person.address || ""
        });
    };

    const handleReset = () => {
        if (isEditMode) return;
        setSelectedPerson(null);
        setSearchTerm("");
        setFormData({ gender: "L", religion: "islam", pob: "", dob: "", resident_id: "", address: "" });
        onPersonSelect?.({ is_blacklist: "No in Blacklist" });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="animate__animated animate__fadeIn">
            <div className="row g-2">
                <div className="col-md-12 position-relative">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nama Lengkap (Cari Nama/NIK)</label>
                    <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white border-end-0">
                            <i className={`bi ${isSearching ? 'spinner-border spinner-border-sm text-primary' : 'bi-search text-muted'}`} style={{ fontSize: '0.8rem' }}></i>
                        </span>
                        <input
                            type="text"
                            name='nama'
                            className={`form-control border-start-0 ps-0 ${selectedPerson ? 'bg-light fw-bold text-primary' : ''} ${isEditMode ? 'opacity-75' : ''}`}
                            placeholder="Minimal 3 karakter..."
                            value={searchTerm}
                            onChange={(e) => !isEditMode && setSearchTerm(e.target.value)}
                            readOnly={isEditMode || !!selectedPerson}
                            autoComplete="off"
                            style={isEditMode ? { backgroundColor: '#f1f3f5', cursor: 'not-allowed', fontSize: '0.85rem' } : { fontSize: '0.85rem' }}
                        />
                        {selectedPerson && !isEditMode && (
                            <button className="btn btn-outline-danger py-0 px-2" type="button" onClick={handleReset} style={{ fontSize: '0.75rem' }}>
                                <i className="bi bi-arrow-counterclockwise me-1"></i> Ganti
                            </button>
                        )}
                    </div>

                    {results.length > 0 && (
                        <div className="list-group position-absolute w-100 shadow border mt-1" style={{ zIndex: 1100, borderRadius: '6px', overflow: 'hidden' }}>
                            {results.map((p) => (
                                <button
                                    key={p.person_id}
                                    type="button"
                                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-3"
                                    onClick={() => handleSelect(p)}
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    <div>
                                        <div className="fw-bold text-dark">{p.name}</div>
                                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>NIK: {p.resident_id}</small>
                                    </div>
                                    {p.is_blacklist === "Blacklist" ? (
                                        <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>Blacklisted</span>
                                    ) : (
                                        <i className="bi bi-plus-circle text-primary small"></i>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Divider Minimalis */}
            <div className="d-flex align-items-center my-3">
                <hr className="flex-grow-1 my-0 opacity-25" />
                <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Data Detail Personel</span>
                <hr className="flex-grow-1 my-0 opacity-25" />
            </div>

            <div className="row g-2">
                <input type="hidden" name="person_id" value={selectedPerson?.person_id || initialData?.person_id || ""} />
                
                <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Jenis Kelamin</label>
                    <select 
                        name="gender" 
                        className="form-select form-select-sm"  
                        value={formData.gender} 
                        onChange={handleInputChange}
                    >
                        <option value="L">Laki - laki</option>
                        <option value="P">Perempuan</option>
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Agama</label>
                    <select 
                        name="religion" 
                        className="form-select form-select-sm"  
                        value={formData.religion} 
                        onChange={handleInputChange}
                    >
                        <option value="islam">Islam</option>
                        <option value="kristen">Kristen</option>
                        <option value="katolik">Katolik</option>
                        <option value="hindu">Hindu</option>
                        <option value="budha">Budha</option>
                        <option value="khonghucu">Khonghucu</option>
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tempat Lahir</label>
                    <input 
                        type="text" name="pob" className="form-control form-control-sm" 
                        placeholder="Kota lahir"
                        value={formData.pob} 
                        onChange={handleInputChange} 
                    />
                </div>

                <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tanggal Lahir</label>
                    <input 
                        type="date" name="dob" className="form-control form-control-sm"
                        value={formData.dob} 
                        onChange={handleInputChange}
                    />
                </div>

                <div className="col-md-12">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nomor KTP (NIK)</label>
                    <input 
                        type="text" name="resident_id" className="form-control form-control-sm" 
                        placeholder="16 Digit NIK"
                        value={formData.resident_id} 
                        onChange={handleInputChange}
                    />
                </div>

                <div className="col-md-12">
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>Alamat Lengkap</label>
                    <textarea 
                        rows="2" name="address" className='form-control form-control-sm' 
                        placeholder="Alamat sesuai KTP..."
                        value={formData.address} 
                        onChange={handleInputChange}
                        style={{ fontSize: '0.85rem' }}
                    ></textarea>
                </div>
            </div>
        </div>
    );
}

export default PersonelTab;