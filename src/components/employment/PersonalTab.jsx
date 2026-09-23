import React, { useState, useEffect, useRef } from 'react';
import { Toast } from '../../utils/sweetalert';
import api from '../../api/api';

function PersonelTab({ onPersonSelect, initialData }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState(null);
    
    // Ref untuk memantau klik di luar elemen pencarian
    const searchContainerRef = useRef(null);

    const [formData, setFormData] = useState({
        gender: "L",
        religion: "islam",
        pob: "",
        dob: "",
        resident_id: "",
        address: ""
    });

    const isEditMode = !!initialData;

    // 1. EVENT LISTENER CLICK OUTSIDE (Menutup Dropdown Otomatis saat Klik di Luar)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 2. INITIAL DATA LOAD (EDIT MODE)
    useEffect(() => {
        if (initialData) {
            const personObj = {
                person_id: initialData.person_id,
                name: initialData.person_name || initialData.name,
                is_blacklist: initialData.is_blacklist
            };
            setSelectedPerson(personObj);
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

    // 3. DEBOUNCE SEARCH (Minimal 3 Karakter)
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.trim().length >= 3 && !selectedPerson && !isEditMode) {
                fetchPersons();
            } else {
                setResults([]);
                setShowDropdown(false);
            }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedPerson, isEditMode]);

    const fetchPersons = async () => {
        setIsSearching(true);
        try {
            const response = await api.get(`/person/search?q=${encodeURIComponent(searchTerm.trim())}`);
            const data = response.data.data || [];
            setResults(data);
            setShowDropdown(true);
        } catch (err) {
            const errorMsg = err.response?.data?.message || "Gagal mencari personel";
            Toast.fire({ icon: 'error', title: 'Pencarian Gagal', text: errorMsg });
        } finally {
            setIsSearching(false);
        }
    };

    // Handler memilih Personel dari Database
    const handleSelect = (person) => {
        setSelectedPerson(person);
        setSearchTerm(person.name);
        setResults([]);
        setShowDropdown(false);
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

    // Handler memilih Input sebagai Personel Baru (misal: "Budi")
    const handleSelectNewPerson = () => {
        const newPersonObj = {
            person_id: null,
            name: searchTerm.trim(),
            is_new: true
        };
        setSelectedPerson(newPersonObj);
        setResults([]);
        setShowDropdown(false);
        onPersonSelect?.(newPersonObj);
    };

    // Handler mengetik nama baru
    const handleSearchChange = (e) => {
        if (isEditMode) return;
        const val = e.target.value;
        setSearchTerm(val);
        
        // Kirim perubahan nama secara live ke parent jika belum mengunci pilihan
        if (!selectedPerson) {
            onPersonSelect?.({
                person_id: null,
                name: val,
                is_new: true
            });
        }
    };

    const handleReset = () => {
        if (isEditMode) return;
        setSelectedPerson(null);
        setSearchTerm("");
        setResults([]);
        setShowDropdown(false);
        setFormData({ gender: "L", religion: "islam", pob: "", dob: "", resident_id: "", address: "" });
        onPersonSelect?.({ person_id: null, name: "", is_blacklist: "No in Blacklist" });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="animate__animated animate__fadeIn">
            <div className="row g-2">
                {/* Ref dipasang pada container input pencarian */}
                <div className="col-md-12 position-relative" ref={searchContainerRef}>
                    <label className="form-label mb-1" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                        Nama Lengkap (Cari Nama/NIK)
                    </label>
                    
                    <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white border-end-0">
                            <i className={`bi ${isSearching ? 'spinner-border spinner-border-sm text-primary' : 'bi-search text-muted'}`} style={{ fontSize: '0.8rem' }}></i>
                        </span>
                        <input
                            type="text"
                            name="nama"
                            className={`form-control border-start-0 ps-0 ${selectedPerson ? 'bg-light fw-bold text-primary' : ''} ${isEditMode ? 'opacity-75' : ''}`}
                            placeholder="Ketik nama (min. 3 karakter)..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            onFocus={() => {
                                if (results.length > 0 || (searchTerm.trim().length >= 3 && !selectedPerson)) {
                                    setShowDropdown(true);
                                }
                            }}
                            readOnly={isEditMode || !!selectedPerson}
                            autoComplete="off"
                            style={isEditMode ? { backgroundColor: '#f1f3f5', cursor: 'not-allowed', fontSize: '0.85rem' } : { fontSize: '0.85rem' }}
                        />
                        {selectedPerson && !isEditMode && (
                            <button className="btn btn-outline-danger py-0 px-2" type="button" onClick={handleReset} style={{ fontSize: '0.75rem' }}>
                                <i className="bi bi-arrow-counterclockwise me-1"></i> Ganti / Reset
                            </button>
                        )}
                    </div>

                    {/* DROPDOWN HASIL PENCARIAN & OPSI INPUT PERSONEL BARU */}
                    {showDropdown && !selectedPerson && !isEditMode && (
                        <div className="list-group position-absolute w-100 shadow border mt-1" style={{ zIndex: 1100, borderRadius: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                            
                            {/* Opsi 1: Pilihan Input Personel Baru dengan nama yang sedang diketik */}
                            {searchTerm.trim().length >= 3 && (
                                <button
                                    type="button"
                                    className="list-group-item list-group-item-action list-group-item-primary d-flex align-items-center py-2 px-3 fw-bold"
                                    onClick={handleSelectNewPerson}
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    <i className="bi bi-person-plus-fill me-2 text-primary"></i>
                                    <span>Gunakan "<span className="text-decoration-underline">{searchTerm.trim()}</span>" sebagai Personel Baru</span>
                                </button>
                            )}

                            {/* Opsi 2: Hasil Pencarian Database */}
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
                                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>NIK: {p.resident_id || '-'}</small>
                                    </div>
                                    {p.is_blacklist === "Blacklist" ? (
                                        <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>Blacklisted</span>
                                    ) : (
                                        <i className="bi bi-check-circle text-success small"></i>
                                    )}
                                </button>
                            ))}

                            {/* Opsi 3: Jika Tidak Ada Hasil di DB */}
                            {results.length === 0 && searchTerm.trim().length >= 3 && (
                                <div className="p-2 text-center text-muted small bg-light" style={{ fontSize: '0.75rem' }}>
                                    Tidak ada data yang cocok di database. Klik tombol biru di atas untuk membuat data baru.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="d-flex align-items-center my-3">
                <hr className="flex-grow-1 my-0 opacity-25" />
                <span className="mx-2 text-muted fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Data Detail Personel
                </span>
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
                        rows="2" name="address" className="form-control form-control-sm" 
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