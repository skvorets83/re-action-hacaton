// src/api/taskApi.ts

export interface Task {
    id: string;
    name: string;
    executor: string;
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
    status: 'Todo' | 'InProgress' | 'Done' | 'Overdue';
}

// Временное хранилище (пока нет бэкенда)
let tasksDB: Task[] = [
    {
        id: '1',
        name: 'Разработка архитектуры базы данных',
        executor: 'Иванов А. (Бэк)',
        start: '2026-09-10',
        end: '2026-09-11',
        status: 'Done',
    },
    {
        id: '2',
        name: 'Интеграция JWT-авторизации и защиты',
        executor: 'Петров С. (Бэк)',
        start: '2026-09-10',
        end: '2026-09-12',
        status: 'InProgress',
    },
    {
        id: '3',
        name: 'Верстка интерактивной диаграммы Ганта',
        executor: 'Сидоров К. (Фронт Lead)',
        start: '2026-09-11',
        end: '2026-09-15',
        status: 'Todo',
    },
    {
        id: '4',
        name: 'Сквозное тестирование безопасности API',
        executor: 'Тимлид',
        start: '2026-09-08',
        end: '2026-09-09',
        status: 'Overdue',
    },
];

// Имитация задержки сети
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Получить все задачи
 */
export async function getTasks(): Promise<Task[]> {
    await delay(300); // имитация запроса
    return [...tasksDB];
}

/**
 * Создать новую задачу
 */
export async function createTask(data: {
    name: string;
    executor: string;
    start: string;
    end: string;
    status?: Task['status'];
}): Promise<Task> {
    await delay(250);

    const newTask: Task = {
        id: Date.now().toString(),
        name: data.name,
        executor: data.executor,
        start: data.start,
        end: data.end,
        status: data.status || 'Todo',
    };

    tasksDB.push(newTask);
    return newTask;
}

/**
 * Обновить статус задачи (на будущее)
 */
export async function updateTaskStatus(
    id: string,
    status: Task['status']
): Promise<Task | null> {
    await delay(200);
    const task = tasksDB.find(t => t.id === id);
    if (!task) return null;

    task.status = status;
    return { ...task };
}

/**
 * Удалить задачу (на будущее)
 */
export async function deleteTask(id: string): Promise<boolean> {
    await delay(200);
    const initialLength = tasksDB.length;
    tasksDB = tasksDB.filter(t => t.id !== id);
    return tasksDB.length < initialLength;
}