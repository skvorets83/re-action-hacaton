import { API_BASE_URL } from './tasksApi';

export interface LoginResponse {
    token: string;
    userId: string;
    email: string;
    role: string;
}

export interface RegisterResponse {
    message: string;
}

export interface StoredUser {
    userId: string;
    email: string;
    role: string;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export async function login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Login failed (${res.status})${text ? `: ${text}` : ''}`);
    }
    const data: LoginResponse = await res.json();
    // Сохраняем токен и юзера
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(
        USER_KEY,
        JSON.stringify({ userId: data.userId, email: data.email, role: data.role })
    );
    return data;
}

export async function register(email: string, password: string): Promise<RegisterResponse> {
    const res = await fetch(`${API_BASE_URL}/api/Auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Register failed (${res.status})${text ? `: ${text}` : ''}`);
    }
    return res.json();
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredUser;
    } catch {
        return null;
    }
}

export function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
    return !!getToken();
}