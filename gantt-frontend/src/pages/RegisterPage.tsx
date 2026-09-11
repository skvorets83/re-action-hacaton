import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, login } from '../api/authApi';

export default function RegisterPage() {
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
            await register(email, password);
            // Регистрация успешна — сразу логинимся
            await login(email, password);
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(err.message ?? 'Не удалось зарегистрироваться');
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
                <h1 className="text-2xl font-bold text-gray-900">Регистрация</h1>
                <p className="text-sm text-gray-500">
                    Создайте аккаунт для работы с проектами
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
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Минимум 6 символов"
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
                    {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                </button>

                <div className="text-xs text-center text-gray-500">
                    Уже есть аккаунт?{' '}
                    <Link to="/login" className="text-blue-600 font-semibold">
                        Войти
                    </Link>
                </div>
            </form>
        </div>
    );
}