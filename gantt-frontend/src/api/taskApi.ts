// src/api/taskApi.ts

export type TaskStatus = 'Todo' | 'InProgress' | 'Done' | 'Overdue';

export interface Task {
  id: string;
  name: string;
  executor: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  status: TaskStatus;
  dependencies: string[]; // ← НОВОЕ: id задач-предшественников
}

const STORAGE_KEY = 'gantt_tasks_v1';

// Стартовые данные (используются, если localStorage пуст)
const SEED: Task[] = [
  {
    id: '1',
    name: 'Разработка архитектуры базы данных',
    executor: 'Иванов А. (Бэк)',
    start: '2026-09-10',
    end: '2026-09-11',
    status: 'Done',
    dependencies: [],
  },
  {
    id: '2',
    name: 'Интеграция JWT-авторизации и защиты',
    executor: 'Петров С. (Бэк)',
    start: '2026-09-10',
    end: '2026-09-12',
    status: 'InProgress',
    dependencies: ['1'],
  },
  {
    id: '3',
    name: 'Верстка интерактивной диаграммы Ганта',
    executor: 'Сидоров К. (Фронт Lead)',
    start: '2026-09-13',
    end: '2026-09-15',
    status: 'Todo',
    dependencies: ['2'],
  },
  {
    id: '4',
    name: 'Сквозное тестирование безопасности API',
    executor: 'Тимлид',
    start: '2026-09-08',
    end: '2026-09-09',
    status: 'Overdue',
    dependencies: [],
  },
];

// ---------- Хранилище ----------
let tasksDB: Task[] = loadFromStorage();

function loadFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED];
    const parsed = JSON.parse(raw) as Task[];
    // миграция на случай старых данных без dependencies
    return parsed.map((t) => ({ ...t, dependencies: t.dependencies ?? [] }));
  } catch {
    return [...SEED];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksDB));
  } catch {
    /* ignore */
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `t_${Date.now()}_${Math.random().toString(36).slice(2)}`);

// ---------- CRUD ----------

export async function getTasks(): Promise<Task[]> {
  await delay(200);
  return [...tasksDB];
}

export async function createTask(data: {
  name: string;
  executor: string;
  start: string;
  end: string;
  status?: TaskStatus;
  dependencies?: string[];
}): Promise<Task> {
  await delay(200);
  const task: Task = {
    id: newId(),
    name: data.name,
    executor: data.executor,
    start: data.start,
    end: data.end,
    status: data.status ?? 'Todo',
    dependencies: data.dependencies ?? [],
  };
  tasksDB = [...tasksDB, task];
  saveToStorage();
  return task;
}

export async function updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<Task[]> {
  await delay(150);
  tasksDB = tasksDB.map((t) => (t.id === id ? { ...t, ...patch } : t));
  saveToStorage();
  return [...tasksDB];
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task[]> {
  return updateTask(id, { status });
}

export async function updateTaskDates(id: string, start: string, end: string): Promise<Task[]> {
  await delay(150);
  tasksDB = tasksDB.map((t) => (t.id === id ? { ...t, start, end } : t));
  // Каскадный сдвиг зависимых задач
  tasksDB = cascadeShift(id, tasksDB);
  saveToStorage();
  return [...tasksDB];
}

export async function deleteTask(id: string): Promise<Task[]> {
  await delay(150);
  // Удаляем задачу и убираем её id из зависимостей других
  tasksDB = tasksDB
    .filter((t) => t.id !== id)
    .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => d !== id) }));
  saveToStorage();
  return [...tasksDB];
}

// ---------- Зависимости ----------

/** Прямые потомки задачи */
export function getDirectDependents(taskId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.dependencies.includes(taskId));
}

/** Транзитивные потомки (все, кто в итоге зависит от задачи) */
export function getTransitiveDependents(taskId: string, tasks: Task[]): Task[] {
  const result = new Map<string, Task>();
  const stack = [taskId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const t of tasks) {
      if (t.dependencies.includes(current) && !result.has(t.id)) {
        result.set(t.id, t);
        stack.push(t.id);
      }
    }
  }
  return [...result.values()];
}

/** Проверка на цикл: можно ли добавить зависимость taskId → depId */
export function wouldCreateCycle(taskId: string, depId: string, tasks: Task[]): boolean {
  if (taskId === depId) return true;
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return false;
  // Если depId уже зависит (транзитивно) от taskId — цикл
  const deps = getTransitiveDependents(taskId, tasks).map((t) => t.id);
  return deps.includes(depId);
}

/** Каскадный сдвиг: если задача сдвинулась, сдвигаем всех потомков так, чтобы они стартовали не раньше конца предшественника */
function cascadeShift(changedId: string, tasks: Task[]): Task[] {
  const map = new Map(tasks.map((t) => [t.id, { ...t }]));
  const queue = [changedId];
  const visited = new Set<string>();

  const DAY = 24 * 60 * 60 * 1000;
  const toDate = (s: string) => new Date(s + 'T00:00:00');
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  while (queue.length) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const current = map.get(currentId)!;
    const currentEnd = toDate(current.end);

    for (const t of map.values()) {
      if (!t.dependencies.includes(currentId)) continue;
      const tStart = toDate(t.start);
      if (tStart <= currentEnd) {
        const durationDays = Math.max(
          1,
          Math.round((toDate(t.end).getTime() - tStart.getTime()) / DAY) + 1
        );
        const newStart = new Date(currentEnd.getTime() + DAY);
        const newEnd = new Date(newStart.getTime() + (durationDays - 1) * DAY);
        t.start = toYMD(newStart);
        t.end = toYMD(newEnd);
        queue.push(t.id);
      }
    }
  }

  return [...map.values()];
}

// ---------- Авто-просрочка ----------

/** Обновляет статусы: если end < сегодня и статус не Done → Overdue; если end >= сегодня и статус Overdue → возвращаем в Todo/InProgress */
export function applyAutoOverdue(tasks: Task[]): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tasks.map((t) => {
    if (t.status === 'Done') return t;
    const end = new Date(t.end + 'T00:00:00');
    if (end < today && t.status !== 'Overdue') return { ...t, status: 'Overdue' };
    if (end >= today && t.status === 'Overdue') return { ...t, status: 'Todo' };
    return t;
  });
}

/** Сохранить изменённый массив (например, после applyAutoOverdue) */
export async function persistTasks(tasks: Task[]): Promise<Task[]> {
  tasksDB = [...tasks];
  saveToStorage();
  return [...tasksDB];
}