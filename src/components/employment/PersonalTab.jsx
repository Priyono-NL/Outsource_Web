import React, { useState, useEffect } from 'react';
import { Toast, Confirm } from '../../utils/sweetalert';
import api from '../../api/api';

function PersonelTab({ onPersonSelect }) {
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

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.length >= 3 && !selectedPerson) {
                fetchPersons();
            } else {
                setResults([]);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedPerson]);

    const fetchPersons = async () => {
        setIsSearching(true);
        try {
            const response = await api.get(`/person/search?q=${searchTerm}`);
            const data = response.data.data;
            setResults(data);
            if (data.length === 1) handleSelect(data[0]);
        } catch (err) {
            const errorMsg = err.response?.data?.message || "Gagal menghubungi server pencarian";
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
        <div className="fade show active">
            <div className="row g-3">
                <div className="col-md-12 position-relative">
                    <label className="form-label fw-bold">Nama Lengkap</label>
                    <div className="input-group">
                    <input
                        type="text"
                        name='nama'
                        className="form-control"
                        placeholder="Ketik nama untuk mencari..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!!selectedPerson}
                    />
                    {selectedPerson && (
                        <button className="btn btn-outline-danger" type="button" onClick={handleReset}>
                        Reset
                        </button>
                    )}
                    </div>                    
                    <input type="hidden" name="person_id" value={selectedPerson?.person_id || ""} />
                    {results.length > 0 && (
                    <ul className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1000, top: '100%' }}>
                        {results.map((p) => (
                        <button
                            key={p.person_id}
                            type="button"
                            className="list-group-item list-group-item-action"
                            onClick={() => handleSelect(p)}
                        >
                            {p.is_blacklist === "Blacklist" && (
                                <span className="badge bg-danger">Blacklist</span>
                            )}
                            {p.name}                            
                        </button>
                        ))}
                    </ul>
                    )}
                    {isSearching && <small className="text-primary">Mencari...</small>}
                </div>                
            </div>
            <hr />
            <div className="row g-3">
                <div className="mb-3 col-6">
                    <label className="form-label small fw-bold"> Jenis Kelamin</label>
                    <select 
                        name="gender" className="form-select" required 
                        value={formData.gender} 
                        onChange={handleInputChange}
                    >
                        <option value="L">Laki - laki</option>
                        <option value="P">Perempuan</option>
                    </select>                            
                </div>
                <div className="mb-3 col-6">
                    <label className="form-label small fw-bold">Agama</label>
                    <select 
                        name="religion" className="form-select" required 
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
                <div className="mb-3 col-6">
                    <label className="form-label small fw-bold">Tempat Lahir</label>
                    <input 
                        type="text" name="pob" className="form-control" 
                        value={formData.pob} 
                        onChange={handleInputChange} 
                    />
                </div>
                <div className="mb-3 col-6">
                    <label className="form-label small fw-bold">Tanggal Lahir</label>
                    <input 
                        type="date" name="dob" className="form-control"
                        value={formData.dob} 
                        onChange={handleInputChange}
                    />
                </div>                    
                
                <div className="mb-3 col-6">
                    <label className="form-label small fw-bold">Nomor KTP</label>
                    <input 
                        type="text" name="resident_id" className="form-control" 
                        value={formData.resident_id} 
                        onChange={handleInputChange}
                    />                        
                </div>
            </div>        
            <div className="mb-3 col-12">
                <label className="form-label small fw-bold">Alamat</label>
                <textarea 
                    rows="3" name="address" className='form-control' 
                    value={formData.address} 
                    onChange={handleInputChange}
                ></textarea>
            </div>        
        </div>
    );
}

export default PersonelTab;