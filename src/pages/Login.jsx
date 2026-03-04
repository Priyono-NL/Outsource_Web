import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
    const formRef = useRef(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const formData = new FormData(formRef.current);
        const payload = Object.fromEntries(formData.entries());
        try {
            const response = await axios.post('https://sso.ceresnl.com:50443/api/login', payload);            
            if (response.data.message === "Login successful") {
                localStorage.setItem('token', JSON.stringify(response.data.token));
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.error || "Terjadi kesalahan koneksi");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container d-flex justify-content-center align-items-center vh-100">
            <div className="card p-4 shadow" style={{ width: '400px' }}>
                <h3 className="text-center mb-4">Login System</h3>
                
                {error && <div className="alert alert-danger p-2 small">{error}</div>}

                <form ref={formRef} onSubmit={handleLogin}>
                    <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input 
                            name="username" 
                            type="text" 
                            className="form-control" 
                            required 
                            placeholder="Username"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Password</label>
                        <input 
                            name="password" 
                            type="password" 
                            className="form-control" 
                            required 
                            placeholder="******"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="btn btn-primary w-100" 
                        disabled={loading}
                    >
                        {loading ? 'Login processing ...' : 'Success Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;