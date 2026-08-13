import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [owner, setOwner] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        try {
            const { data } = await axios.get('/api/owner/me');
            setOwner(data);
        } catch {
            setOwner(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const login = async (email, password) => {
        const { data } = await axios.post('/api/owner/login', { email, password });
        setOwner(data);
        return data;
    };

    const signup = async (name, number, email, password) => {
        const { data } = await axios.post('/api/owner/signup', { name, number, email, password });
        setOwner(data);
        return data;
    };

    const logout = async () => {
        await axios.post('/api/owner/logout');
        setOwner(null);
    };

    return (
        <AuthContext.Provider value={{ owner, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
