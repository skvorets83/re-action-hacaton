// src/auth/token.ts

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
    userId: string;
    email: string;
    role: string;
}

export const saveToken = (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
};

export const clearToken = (): void => {
    localStorage.removeItem(TOKEN_KEY);
};

export const saveUser = (user: AuthUser): void => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = (): AuthUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthUser;
    } catch {
        return null;
    }
};

export const clearUser = (): void => {
    localStorage.removeItem(USER_KEY);
};

export const clearAuth = (): void => {
    clearToken();
    clearUser();
};