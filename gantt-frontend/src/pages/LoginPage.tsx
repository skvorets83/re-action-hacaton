import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/authApi';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(err.message ?? 'Не удалось войти');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <form
                onSubmit={handleSubmit}
                className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md space-y-4"
            >
                <h1 className="text-2xl font-bold text-gray-900">Вход в систему</h1>
                <p className="text-sm text-gray-500">
                    Введите email и пароль для входа
                </p>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="user@example.com"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Пароль
                    </label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="••••••••"
                    />
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition"
                >
                    {loading ? 'Вход...' : 'Войти'}
                </button>

                <div className="text-xs text-center text-gray-500">
                    Нет аккаунта?{' '}
                    <Link to="/register" className="text-blue-600 font-semibold">
                        Зарегистрироваться
                    </Link>
                </div>
            </form>
        </div>
    );
}