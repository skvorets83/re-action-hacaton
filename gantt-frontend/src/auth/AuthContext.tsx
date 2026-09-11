// src/auth/AuthContext.tsx
import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from 'react';
import {
    getToken,
    getUser,
    saveToken,
    saveUser,
    clearAuth,
    type AuthUser,
} from './token';
import { login as apiLogin, register as apiRegister } from '../api/authApi';

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(() => {
        // Восстанавливаем сессию при загрузке страницы
        const token = getToken();
        const savedUser = getUser();
        if (token && savedUser) return savedUser;
        // Если есть одно, но нет другого — чистим
        if (token || savedUser) clearAuth();
        return null;
    });

    const login = async (email: string, password: string) => {
        const res = await apiLogin(email, password);

        saveToken(res.token);
        const u: AuthUser = {
            userId: res.userId,
            email: res.email,
            role: res.role,
        };
        saveUser(u);
        setUser(u);
    };

    const register = async (email: string, password: string) => {
        await apiRegister(email, password);
        // После регистрации не логиним — бэк не даёт токен
    };

    const logout = () => {
        clearAuth();
        setUser(null);
    };

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}