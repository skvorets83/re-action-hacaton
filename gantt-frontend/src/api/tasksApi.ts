// src/api/tasksApi.ts

export type TaskStatus = 'Todo' | 'InProgress' | 'Done' | 'Overdue';

export interface Task {
    id: string;
    name: string;
    executor: string;
    executorId?: string;
    start: string;
    end: string;
    status: TaskStatus;
    dependencies: string[];
    projectId?: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    ownerId?: string;
    startDate: string;
    deadline: string;
    tasks?: Task[];
}

export interface Comment {
    id: string;
    taskId: string;
    author: string;
    text: string;
    createdAt: string;
}


// ---------- Константы ----------
const ENV_URL =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    (import.meta.env.VITE_API_BASE_URL as string | undefined);

export const API_BASE_URL = ENV_URL ?? 'http://localhost:5209';

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
        throw new Error(
            `API ${res.status} ${res.statusText} — ${path}${text ? ` — ${text}` : ''}`
        );
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

const toISO = (ymd: string): string =>
    new Date(ymd + 'T00:00:00.000Z').toISOString();

const normalizeStatus = (s: any): TaskStatus => {
    const v = String(s ?? 'Todo');
    const map: Record<string, TaskStatus> = {
        todo: 'Todo',
        '0': 'Todo',
        inprogress: 'InProgress',
        in_progress: 'InProgress',
        '1': 'InProgress',
        done: 'Done',
        '2': 'Done',
        overdue: 'Overdue',
        '3': 'Overdue',
    };
    return map[v.toLowerCase()] ?? 'Todo';
};

// ---------- Нормализация ----------
const normalizeTask = (raw: any): Task => {
    const depsRaw = raw.dependencies ?? raw.Dependencies ?? [];
    const deps: string[] = Array.isArray(depsRaw)
        ? depsRaw
            .map((d: any) =>
                d?.parentTaskId ??
                d?.ParentTaskId ??
                (typeof d === 'string' ? d : null)
            )
            .filter(Boolean)
        : [];

    return {
        id: String(raw.id ?? raw.Id ?? ''),
        name: String(raw.name ?? raw.Name ?? ''),
        executor: String(
            raw.executor ?? raw.Executor ?? raw.executorId ?? raw.ExecutorId ?? ''
        ),
        executorId: raw.executorId ?? raw.ExecutorId,
        start: toYMD(String(raw.startDate ?? raw.StartDate ?? raw.start ?? raw.Start ?? '')),
        end: toYMD(String(raw.endDate ?? raw.EndDate ?? raw.end ?? raw.End ?? '')),
        status: normalizeStatus(raw.status ?? raw.Status),
        dependencies: deps,
        projectId: raw.projectId ?? raw.ProjectId
            ? String(raw.projectId ?? raw.ProjectId)
            : undefined,
    };
};

const normalizeProject = (raw: any): Project => {
    const tasks: Task[] = Array.isArray(raw.tasks ?? raw.Tasks)
        ? (raw.tasks ?? raw.Tasks).map(normalizeTask)
        : [];

    const startDate = toYMD(
        String(raw.startDate ?? raw.StartDate ?? '2026-01-01')
    );
    const deadline = toYMD(
        String(
            raw.endDate ??
            raw.EndDate ??
            raw.deadline ??
            raw.Deadline ??
            tasks.reduce((max, t) => (t.end > max ? t.end : max), startDate)
        )
    );

    return {
        id: String(raw.id ?? raw.Id ?? ''),
        name: String(raw.name ?? raw.Name ?? ''),
        description: raw.description ?? raw.Description,
        ownerId: raw.ownerId ?? raw.OwnerId,
        startDate,
        deadline,
        tasks,
    };
};

// ============================================================
//                        ПРОЕКТЫ
// ============================================================

export async function getProjects(): Promise<Project[]> {
    const data = await http<any>('/api/Gantt/projects');
    return Array.isArray(data) ? data.map(normalizeProject) : [];
}

export async function getProject(id: string): Promise<Project | null> {
    try {
        const data = await http<any>(`/api/Gantt/projects/${id}`);
        return normalizeProject(data);
    } catch {
        return null;
    }
}

export async function createProject(data: {
    name: string;
    description?: string;
    start?: string;
    deadline?: string;
}): Promise<Project> {
    const today = new Date().toISOString().slice(0, 10);
    const created = await http<any>('/api/Gantt/projects', {
        method: 'POST',
        body: JSON.stringify({
            name: data.name,
            description: data.description ?? '',
            startDate: toISO(data.start ?? today),
            endDate: toISO(data.deadline ?? today),
        }),
    });
    return normalizeProject(created);
}

export async function updateProject(
    id: string,
    patch: {
        name?: string;
        description?: string;
        start?: string;
        deadline?: string;
    }
): Promise<Project> {
    const current = await getProject(id);
    if (!current) throw new Error('Проект не найден');

    const updated = await http<any>(`/api/Gantt/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: patch.name ?? current.name,
            description: patch.description ?? current.description ?? '',
            startDate: toISO(patch.start ?? current.startDate),
            endDate: toISO(patch.deadline ?? current.deadline),
        }),
    });
    return normalizeProject(updated);
}

export async function deleteProject(id: string): Promise<void> {
    await http<void>(`/api/Gantt/projects/${id}`, { method: 'DELETE' });
}

// ============================================================
//                          ЗАДАЧИ
// ============================================================

export async function getTasksByProject(projectId: string): Promise<Task[]> {
    const data = await http<any>(`/api/Gantt/projects/${projectId}/tasks`);
    return Array.isArray(data) ? data.map(normalizeTask) : [];
}

/** Совместимость со старым API — задачи первого проекта. */
export async function getTasks(): Promise<Task[]> {
    const projects = await getProjects();
    if (projects.length === 0) return [];
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
    dependencies?: string[];
}): Promise<Task> {
    if (!data.projectId) throw new Error('Не указан projectId');

    const payload = {
        name: data.name,
        projectId: data.projectId,
        executorId: data.executorId || '00000000-0000-0000-0000-000000000000',
        startDate: toISO(data.start),
        endDate: toISO(data.end),
        status: data.status ?? 'Todo',
        dependencies: [],
    };

    const created = await http<any>('/api/Gantt/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    const normalized = normalizeTask(created);

    if (data.dependencies && data.dependencies.length > 0) {
        await saveDependencies(normalized.id, data.dependencies);
        normalized.dependencies = data.dependencies;
    }

    return normalized;
}

export async function updateTask(
    id: string,
    patch: Partial<Omit<Task, 'id'>>
): Promise<Task[]> {
    // Подтягиваем текущее состояние (чтобы не потерять поля)
    const current = (await getTasks()).find((t) => t.id === id);
    if (!current) throw new Error('Задача не найдена');

    const merged = { ...current, ...patch };

    const body: Record<string, unknown> = {
        id,
        name: merged.name,
        status: merged.status,
        executorId: merged.executorId || '00000000-0000-0000-0000-000000000000',
        projectId: merged.projectId,
        startDate: toISO(merged.start),
        endDate: toISO(merged.end),
    };

    await http<void>(`/api/Gantt/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });

    // Зависимости — отдельным запросом
    if (patch.dependencies) {
        await saveDependencies(id, patch.dependencies);
    }

    return getTasks();
}

export async function updateTaskStatus(
    id: string,
    status: TaskStatus
): Promise<Task[]> {
    return updateTask(id, { status });
}

export async function updateTaskDates(
    id: string,
    start: string,
    end: string
): Promise<Task[]> {
    return updateTask(id, { start: toYMD(start), end: toYMD(end) });
}

export async function deleteTask(id: string): Promise<Task[]> {
    await http<void>(`/api/Gantt/tasks/${id}`, { method: 'DELETE' });
    return getTasks();
}


// ---------- Зависимости ----------
async function saveDependencies(
    childId: string,
    parentIds: string[]
): Promise<void> {

    for (const parentId of parentIds) {
        await http<void>(`/api/Gantt/tasks/${childId}/dependencies`, {
            method: 'POST',
            body: JSON.stringify({ parentTaskId: parentId }),
        });
    }
}

// ============================================================
//                        КОММЕНТАРИИ
// ============================================================

export async function getComments(taskId: string): Promise<Comment[]> {
    const data = await http<any[]>(`/api/Gantt/tasks/${taskId}/comments`);
    return Array.isArray(data)
        ? data.map((c) => ({
            id: String(c.id ?? c.Id ?? ''),
            taskId: String(c.taskId ?? c.TaskId ?? taskId),
            author: String(c.author ?? c.Author ?? ''),
            text: String(c.text ?? c.Text ?? ''),
            createdAt: String(c.createdAt ?? c.CreatedAt ?? ''),
        }))
        : [];
}

export async function addComment(
    taskId: string,
    author: string,
    text: string
): Promise<Comment> {
    const c = await http<any>(`/api/Gantt/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ author, text }),
    });
    return {
        id: String(c.id ?? c.Id ?? ''),
        taskId: String(c.taskId ?? c.TaskId ?? taskId),
        author: String(c.author ?? c.Author ?? author),
        text: String(c.text ?? c.Text ?? text),
        createdAt: String(c.createdAt ?? c.CreatedAt ?? ''),
    };
}

export async function deleteComment(id: string): Promise<void> {
    await http<void>(`/api/Gantt/comments/${id}`, { method: 'DELETE' });
}

// ============================================================
//                          ЭКСПОРТ
// ============================================================

export interface ProjectExport {
    project: {
        id: string;
        name: string;
        startDate: string;
        deadline: string;
    };
    exportedAt: string;
    tasks: Task[];
}

/** Экспорт идёт через бэк — данные берутся напрямую из БД. */
export async function fetchProjectExport(
    projectId: string
): Promise<ProjectExport> {
    return http<ProjectExport>(`/api/Gantt/projects/${projectId}/export`);
}

export function downloadJson(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
export function downloadCsv(rows: string[][], filename: string): void {
    // Экранируем кавычки и оборачиваем каждую ячейку в ""
    const csv = rows
        .map((row) =>
            row
                .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
                .join(',')
        )
        .join('\r\n');   // \r\n — чтобы Excel на Windows корректно открыл

    // BOM (U+FEFF) — чтобы Excel не поломал кириллицу
    const blob = new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
//                          УТИЛИТЫ
// ============================================================

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

export function wouldCreateCycle(
    taskId: string,
    depId: string,
    tasks: Task[]
): boolean {
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

export function getOverdueTasks(tasks: Task[]): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((t) => {
        if (t.status === 'Done') return false;
        const end = new Date(t.end + 'T00:00:00');
        return end < today;
    });
}

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
            orig.status !== t.status;
        if (changed) {
            await updateTask(t.id, {
                name: t.name,
                executor: t.executor,
                executorId: t.executorId,
                start: t.start,
                end: t.end,
                status: t.status,
                projectId: t.projectId,
            });
        }
    }
    return getTasks();
}