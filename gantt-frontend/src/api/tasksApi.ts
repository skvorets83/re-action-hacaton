// src/api/taskApi.ts

export type TaskStatus = 'Todo' | 'InProgress' | 'Done' | 'Overdue';

// Внутренняя модель — то, чем оперирует фронт
export interface Task {
    id: string;
    name: string;
    executor: string;         // человекочитаемое имя (из executorId)
    executorId?: string;      // исходный Guid
    start: string;            // YYYY-MM-DD
    end: string;              // YYYY-MM-DD
    status: TaskStatus;
    dependencies: string[];   // id задач-предшественников
    projectId?: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    ownerId?: string;
    deadline: string;         // на бэке нет — заглушка
    tasks?: Task[];
}

export interface User {
    id: string;
    name: string;
    email?: string;
}

export async function getUsers(): Promise<User[]> {
    const data = await http<any>('/api/Gantt/users');   // ← точный URL от бэков
    return Array.isArray(data)
        ? data.map((u) => ({
            id: String(u.id ?? u.Id ?? ''),
            name: String(u.name ?? u.Name ?? u.fullName ?? u.FullName ?? ''),
            email: u.email ?? u.Email,
        }))
        : [];
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ---------- HTTP ----------
async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(options.headers ?? {}),
        },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API ${res.status} ${res.statusText} — ${path}${text ? ` — ${text}` : ''}`);
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return (await res.text()) as unknown as T;
    return (await res.json()) as T;
}

// ---------- Хелперы ----------
const toYMD = (v: string): string => {
    if (!v) return v;
    const s = String(v);
    return s.includes('T') ? s.split('T')[0] : s;
};

// status приходит как строка; нормализуем на всякий случай
const normalizeStatus = (s: any): TaskStatus => {
    const v = String(s ?? 'Todo');
    const map: Record<string, TaskStatus> = {
        todo: 'Todo', '0': 'Todo',
        inprogress: 'InProgress', in_progress: 'InProgress', '1': 'InProgress',
        done: 'Done', '2': 'Done',
        overdue: 'Overdue', '3': 'Overdue',
    };
    return map[v.toLowerCase()] ?? 'Todo';
};

// ---------- Нормализация ----------
const normalizeTask = (raw: any): Task => {
    const depsRaw = raw.dependencies ?? raw.Dependencies ?? [];
    // На бэке это массив объектов { parentTaskId, childTaskId, ... }
    const deps: string[] = Array.isArray(depsRaw)
        ? depsRaw
            .map((d: any) => d?.parentTaskId ?? d?.ParentTaskId ?? (typeof d === 'string' ? d : null))
            .filter(Boolean)
        : [];

    return {
        id: String(raw.id ?? raw.Id ?? ''),
        name: String(raw.name ?? raw.Name ?? ''),
        executor: String(raw.executor ?? raw.Executor ?? raw.executorId ?? raw.ExecutorId ?? ''),
        executorId: raw.executorId ?? raw.ExecutorId,
        start: toYMD(String(raw.startDate ?? raw.StartDate ?? raw.start ?? raw.Start ?? '')),
        end: toYMD(String(raw.endDate ?? raw.EndDate ?? raw.end ?? raw.End ?? '')),
        status: normalizeStatus(raw.status ?? raw.Status),
        dependencies: deps,
        projectId: raw.projectId ?? raw.ProjectId ? String(raw.projectId ?? raw.ProjectId) : undefined,
    };
};

const normalizeProject = (raw: any): Project => {
    const tasks: Task[] = Array.isArray(raw.tasks ?? raw.Tasks)
        ? (raw.tasks ?? raw.Tasks).map(normalizeTask)
        : [];

    // deadline считаем локально: максимум endDate среди всех задач
    const computedDeadline = tasks.reduce(
        (max, t) => (t.end > max ? t.end : max),
        '2099-12-31'
    );

    return {
        id: String(raw.id ?? raw.Id ?? ''),
        name: String(raw.name ?? raw.Name ?? ''),
        description: raw.description ?? raw.Description,
        ownerId: raw.ownerId ?? raw.OwnerId,
        deadline: toYMD(String(raw.deadline ?? raw.Deadline ?? computedDeadline)),
        tasks,
    };
};

// ---------- Проекты ----------
export async function getProjects(): Promise<Project[]> {
    const data = await http<any>('/api/Gantt/projects');
    return Array.isArray(data) ? data.map(normalizeProject) : [];
}

export async function createProject(data: {
    name: string;
    description?: string;
    deadline?: string;
}): Promise<Project> {
    // На бэке deadline нет, отправляем что есть
    const created = await http<any>('/api/Gantt/projects', {
        method: 'POST',
        body: JSON.stringify({
            name: data.name,
            description: data.description ?? '',
        }),
    });
    return normalizeProject(created);
}

// ---------- Задачи ----------
/** Задачи по проекту. */
export async function getTasksByProject(projectId: string): Promise<Task[]> {
    const data = await http<any>(`/api/Gantt/projects/${projectId}/tasks`);
    return Array.isArray(data) ? data.map(normalizeTask) : [];
}

/** Совместимость: возвращает задачи первого проекта. */
export async function getTasks(): Promise<Task[]> {
    const projects = await getProjects();
    if (projects.length === 0) return [];
    // У проектов может быть вложенный tasks[] — используем его, если есть
    if (projects[0].tasks && projects[0].tasks.length > 0) return projects[0].tasks;
    return getTasksByProject(projects[0].id);
}

export async function createTask(data: {
    name: string;
    executor: string;
    executorId?: string;
    start: string;
    end: string;
    status?: TaskStatus;
    projectId?: string;
}): Promise<Task> {
    const payload = {
        name: data.name,
        projectId: data.projectId,
        executorId: data.executorId ?? '00000000-0000-0000-0000-000000000000',
        startDate: data.start + 'T00:00:00.000Z',
        endDate: data.end + 'T00:00:00.000Z',
        status: data.status ?? 'Todo',
        dependencies: [],           // ← всегда пусто при создании
    };
    const created = await http<any>('/api/Gantt/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return normalizeTask(created);
}

export async function updateTask(
    id: string,
    patch: Partial<Omit<Task, 'id'>>
): Promise<Task[]> {
    const body: Record<string, unknown> = { id };   // ← id тоже в тело
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.executorId !== undefined) body.executorId = patch.executorId;
    if (patch.projectId !== undefined) body.projectId = patch.projectId;
    if (patch.start !== undefined) body.startDate = patch.start + 'T00:00:00.000Z';
    if (patch.end !== undefined) body.endDate = patch.end + 'T00:00:00.000Z';
    if (patch.status !== undefined) body.status = patch.status;

    await http<void>(`/api/Gantt/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
    return getTasks();
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task[]> {
    return updateTask(id, { status });
}

export async function updateTaskDates(id: string, start: string, end: string): Promise<Task[]> {
    return updateTask(id, { start: toYMD(start), end: toYMD(end) });
}

/** Эндпоинта DELETE на бэке нет — заглушка. */
export async function deleteTask(id: string): Promise<Task[]> {
    await http<void>(`/api/Gantt/tasks/${id}`, { method: 'DELETE' });
    return getTasks();
}

/** Совместимость со старым Dashboard. */
export async function persistTasks(tasks: Task[]): Promise<Task[]> {
    const fresh = await getTasks();
    const freshMap = new Map(fresh.map((t) => [t.id, t]));
    for (const t of tasks) {
        const orig = freshMap.get(t.id);
        if (!orig) continue;
        const changed =
            orig.name !== t.name ||
            orig.start !== t.start ||
            orig.end !== t.end ||
            orig.status !== t.status ||
            JSON.stringify(orig.dependencies) !== JSON.stringify(t.dependencies);
        if (changed) {
            await updateTask(t.id, {
                name: t.name,
                executor: t.executor,
                executorId: t.executorId,
                start: t.start,
                end: t.end,
                status: t.status,
                dependencies: t.dependencies,
                projectId: t.projectId,
            });
        }
    }
    return getTasks();
}

// ---------- Утилиты ----------
export function getDirectDependents(taskId: string, tasks: Task[]): Task[] {
    return tasks.filter((t) => t.dependencies.includes(taskId));
}
export function getTransitiveDependents(taskId: string, tasks: Task[]): Task[] {
    const result = new Map<string, Task>();
    const stack = [taskId];
    while (stack.length) {
        const cur = stack.pop()!;
        for (const t of tasks) {
            if (t.dependencies.includes(cur) && !result.has(t.id)) {
                result.set(t.id, t);
                stack.push(t.id);
            }
        }
    }
    return [...result.values()];
}
export function wouldCreateCycle(taskId: string, depId: string, tasks: Task[]): boolean {
    if (taskId === depId) return true;
    const deps = getTransitiveDependents(taskId, tasks).map((t) => t.id);
    return deps.includes(depId);
}
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