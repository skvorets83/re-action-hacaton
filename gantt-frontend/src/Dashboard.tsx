import React, { useState, useEffect } from 'react';
// ⬇️ Подключи API от 5-го разработчика (путь поправь под свой проект)
import { getTasks, createTask } from './api/tasksApi'; // <-- проверь путь

interface Task {
    id: string;
    name: string;
    executor: string;
    start: string;       // ГГГГ-ММ-ДД
    end: string;         // ГГГГ-ММ-ДД
    status: 'Todo' | 'InProgress' | 'Done' | 'Overdue';
}

const PROJECT_DEADLINE = '2026-09-22';

export default function Dashboard() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [currentView, setCurrentView] = useState<'table' | 'gantt'>('table');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'All' | 'Todo' | 'InProgress' | 'Done' | 'Overdue'>('All');
    const [loading, setLoading] = useState(true);

    // Поля формы
    const [newTitle, setNewTitle] = useState('');
    const [newExecutor, setNewExecutor] = useState('Иванов А. (Бэк)');
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');

    // ===== Загрузка задач при старте (API 5-го) =====
    useEffect(() => {
        const loadTasks = async () => {
            try {
                setLoading(true);
                const data = await getTasks();
                setTasks(data);
            } catch (error) {
                console.error('Ошибка загрузки задач:', error);
            } finally {
                setLoading(false);
            }
        };
        loadTasks();
    }, []);

    // ===== Метрики =====
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'Done').length;
    const inProgress = tasks.filter(t => t.status === 'InProgress').length;
    const overdue = tasks.filter(t => t.status === 'Overdue').length;
    const projectProgress = total > 0 ? Math.round((done / total) * 100) : 0;

    const lastTaskEnd = tasks.reduce((max, task) => (task.end > max ? task.end : max), '1970-01-01');
    const isProjectAtRisk = lastTaskEnd > PROJECT_DEADLINE;

    // ===== Создание задачи через API =====
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle || !newStart || !newEnd) return;

        try {
            const created = await createTask({
                name: newTitle,
                executor: newExecutor,
                start: newStart,
                end: newEnd,
                status: 'Todo',
            });

            setTasks(prev => [...prev, created]);
            setIsModalOpen(false);
            setNewTitle('');
            setNewStart('');
            setNewEnd('');
        } catch (error) {
            console.error('Ошибка создания задачи:', error);
            alert('Не удалось создать задачу');
        }
    };

    // ===== Фильтрация =====
    const filteredTasks = tasks.filter(task => {
        if (activeTab === 'Done') return task.status === 'Done';
        if (activeTab === 'InProgress') return task.status === 'InProgress';
        if (activeTab === 'Overdue') return task.status === 'Overdue';
        if (activeTab === 'Todo') return task.status === 'Todo';
        return true;
    });

    // ===== Цвета статусов =====
    const statusStyles = {
        Todo: 'bg-gray-100 text-gray-700',
        InProgress: 'bg-amber-100 text-amber-700',
        Done: 'bg-green-100 text-green-700',
        Overdue: 'bg-red-100 text-red-700',
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">

            {/* ===== Шапка ===== */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Панель контроля состояния</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        MVP-система планирования проектов и каскадного контроля рисков
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => {
                            const ganttElement = document.getElementById('gantt');
                            if (ganttElement) {
                                ganttElement.scrollIntoView({ behavior: 'smooth' });
                            } else {
                                setCurrentView('gantt');
                            }
                        }}
                        className="flex-1 sm:flex-none border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold py-2 px-4 rounded-lg transition text-sm flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Просмотр диаграммы Ганта
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition text-sm"
                    >
                        + Добавить задачу
                    </button>
                </div>
            </div>

            {/* ===== Прогресс-бар ===== */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/60 mb-6 shadow-xs">
                <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                        <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                            Общий прогресс выполнения проекта
                        </span>
                    </div>
                    <span className="text-sm font-bold text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded-md">
                        {projectProgress}%
                    </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${projectProgress}%` }}
                    />
                </div>

                {isProjectAtRisk && (
                    <p className="text-xs text-red-600 mt-2 font-medium">
                        ⚠️ Проект под риском: последняя задача заканчивается позже дедлайна ({PROJECT_DEADLINE})
                    </p>
                )}
            </div>

            {/* ===== Аналитические карточки ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {/* Всего */}
                <button
                    type="button"
                    onClick={() => setActiveTab('All')}
                    className={`p-5 rounded-2xl text-left border transition-all duration-200 flex items-center justify-between ${activeTab === 'All'
                        ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/10'
                        : 'bg-white border-gray-200/80 hover:border-gray-300 shadow-xs'
                        }`}
                >
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Всего операций</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${activeTab === 'All' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                </button>

                {/* Выполнено */}
                <button
                    type="button"
                    onClick={() => setActiveTab('Done')}
                    className={`p-5 rounded-2xl text-left border transition-all duration-200 flex items-center justify-between ${activeTab === 'Done'
                        ? 'bg-white border-green-500 shadow-md ring-2 ring-green-500/10'
                        : 'bg-white border-gray-200/80 hover:border-gray-300 shadow-xs'
                        }`}
                >
                    <div>
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Выполнено</p>
                        <p className="text-3xl font-bold text-green-700 mt-1">{done}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${activeTab === 'Done' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </button>

                {/* В работе */}
                <button
                    type="button"
                    onClick={() => setActiveTab('InProgress')}
                    className={`p-5 rounded-2xl text-left border transition-all duration-200 flex items-center justify-between ${activeTab === 'InProgress'
                        ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/10'
                        : 'bg-white border-gray-200/80 hover:border-gray-300 shadow-xs'
                        }`}
                >
                    <div>
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">В работе</p>
                        <p className="text-3xl font-bold text-amber-700 mt-1">{inProgress}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${activeTab === 'InProgress' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </button>

                {/* Просрочено */}
                <button
                    type="button"
                    onClick={() => setActiveTab('Overdue')}
                    className={`p-5 rounded-2xl text-left border transition-all duration-200 flex items-center justify-between ${activeTab === 'Overdue'
                        ? 'bg-white border-red-500 shadow-md ring-2 ring-red-500/10'
                        : 'bg-white border-gray-200/80 hover:border-gray-300 shadow-xs'
                        }`}
                >
                    <div>
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Просрочено</p>
                        <p className="text-3xl font-bold text-red-700 mt-1">{overdue}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${activeTab === 'Overdue' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                </button>
            </div>

            {/* ===== Вкладки Список / Ганта ===== */}
            <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl p-2 pb-0 gap-2 shadow-xs">
                <button
                    type="button"
                    onClick={() => setCurrentView('table')}
                    className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${currentView === 'table' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
                        }`}
                >
                    📋 Список задач
                </button>
                <button
                    type="button"
                    onClick={() => setCurrentView('gantt')}
                    className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${currentView === 'gantt' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
                        }`}
                >
                    📊 Диаграмма Ганта
                </button>
            </div>

            {/* ===== Контент ===== */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">Загрузка задач...</div>
            ) : currentView === 'table' ? (
                <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden shadow-xs">
                    {filteredTasks.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">Нет задач по выбранному фильтру</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="p-4 font-semibold">Задача</th>
                                    <th className="p-4 font-semibold">Исполнитель</th>
                                    <th className="p-4 font-semibold">Сроки</th>
                                    <th className="p-4 font-semibold">Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.map(task => (
                                    <tr key={task.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                                        <td className="p-4 font-medium text-gray-900">{task.name}</td>
                                        <td className="p-4 text-gray-600">{task.executor}</td>
                                        <td className="p-4 text-gray-600">
                                            {task.start} → {task.end}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[task.status]}`}>
                                                {task.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                /* ===== Заглушка Ганта (будет заменена 3-м разработчиком) ===== */
                <div id="gantt" className="bg-white p-8 rounded-xl border border-gray-200/60 text-center shadow-xs">
                    <div className="inline-flex bg-blue-50 text-blue-600 p-4 rounded-full mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Интерактивный таймлайн Ганта</h3>
                    <p className="text-sm text-gray-400 max-w-sm mx-auto mt-1">
                        Здесь будет отрисовываться график связей задач. Компонент Frontend Lead (Участник 3) подготовлен к слиянию через Git branch.
                    </p>
                </div>
            )}

            {/* ===== Модалка создания задачи ===== */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100/80">
                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Добавить операцию в план</h2>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Название задачи</label>
                                <input
                                    type="text"
                                    required
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Например: Тестирование критического пути"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ответственный исполнитель</label>
                                <select
                                    value={newExecutor}
                                    onChange={e => setNewExecutor(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Иванов А. (Бэк)">Иванов А. (Бэк)</option>
                                    <option value="Петров С. (Бэк)">Петров С. (Бэк)</option>
                                    <option value="Сидоров К. (Фронт Lead)">Сидоров К. (Фронт Lead)</option>
                                    <option value="Тимлид">Тимлид</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Дата старта</label>
                                    <input
                                        type="date"
                                        required
                                        value={newStart}
                                        onChange={e => setNewStart(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Дедлайн (Конец)</label>
                                    <input
                                        type="date"
                                        required
                                        value={newEnd}
                                        onChange={e => setNewEnd(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg text-sm shadow-sm"
                                >
                                    Сохранить
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}