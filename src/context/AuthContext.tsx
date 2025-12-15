import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage, type UserSession } from '../lib/storage';

interface AuthContextType {
    user: UserSession | null;
    isLoading: boolean;
    login: (user: UserSession) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const session = await storage.getMe();
            setUser(session);
        } catch (e) {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = (user: UserSession) => {
        setUser(user);
    };

    const logout = async () => {
        await storage.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
