import React, { useState, useEffect, useMemo } from 'react';
import GanttChart from './GanttChart';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  applyAutoOverdue,
  persistTasks,
  wouldCreateCycle,
} from './api/tasksApi';
import type { Task, TaskStatus } from './api/tasksApi';

interface Project {
  id: string;
  name: string;
  ownerId?: string;
  deadline: string;
}

const EXECUTORS = [
  'Иванов А. (Бэк)',
  'Петров С. (Бэк)',
  'Сидоров К. (Фронт Lead)',
  'Тимлид',
];

type Tab = 'All' | TaskStatus;

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentView, setCurrentView] = useState<'table' | 'gantt'>('table');
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Список проектов (Блок 1)
  const [projects, setProjects] = useState<Project[]>([
    { id: 'p1', name: 'Хакатон MVP', deadline: '2026-09-22' },
    { id: 'p2', name: 'Внедрение CRM системы', deadline: '2026-11-30' },
  ]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('p1');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [projectForm, setProjectForm] = useState({ name: '', deadline: '' });
  const [form, setForm] = useState({
    name: '',
    executor: EXECUTORS[0],
    start: '',
    end: '',
    status: 'Todo' as TaskStatus,
    dependencies: [] as string[],
  });

  const activeProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) || projects[0],
    [projects, currentProjectId]
  );

  // ---------- Загрузка + авто-просрочка ----------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getTasks();
        const normalized = applyAutoOverdue(data);
        await persistTasks(normalized);
        setTasks(normalized);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Задачи текущего проекта ----------
  const currentProjectTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.projectId === currentProjectId ||
        (!t.projectId && currentProjectId === 'p1')
    );
  }, [tasks, currentProjectId]);

  // ---------- Метрики ----------
  const total = currentProjectTasks.length;
  const done = currentProjectTasks.filter((t) => t.status === 'Done').length;
  const inProgress = currentProjectTasks.filter((t) => t.status === 'InProgress').length;
  const overdue = currentProjectTasks.filter((t) => t.status === 'Overdue').length;
  const projectProgress = total > 0 ? Math.round((done / total) * 100) : 0;

  const lastUnfinishedTaskEnd = currentProjectTasks
    .filter((t) => t.status !== 'Done')
    .reduce((max, t) => (t.end > max ? t.end : max), '1970-01-01');

  const isProjectAtRisk = activeProject
    ? lastUnfinishedTaskEnd > activeProject.deadline
    : false;

  const filteredTasks = useMemo(() => {
    let result = currentProjectTasks;

    if (activeTab !== 'All') {
      result = result.filter((t) => t.status === activeTab);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.executor.toLowerCase().includes(query)
      );
    }

    return result;
  }, [currentProjectTasks, activeTab, searchQuery]);

  // ---------- Создание проекта ----------
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name || !projectForm.deadline) return;

    const newProject: Project = {
      id: 'p_' + Date.now(),
      name: projectForm.name,
      deadline: projectForm.deadline,
    };

    setProjects([...projects, newProject]);
    setCurrentProjectId(newProject.id);
    setIsProjectModalOpen(false);
    setProjectForm({ name: '', deadline: '' });
  };

  // ---------- Открытие модалки задачи ----------
  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: '',
      executor: EXECUTORS[0],
      start: '',
      end: '',
      status: 'Todo',
      dependencies: [],
    });
    setIsModalOpen(true);
  };

  const openEdit = (id: string) => {
    const t = currentProjectTasks.find((x) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setForm({
      name: t.name,
      executor: t.executor,
      start: t.start,
      end: t.end,
      status: t.status,
      dependencies: t.dependencies,
    });
    setIsModalOpen(true);
  };

  // ---------- Сохранение задачи ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start || !form.end) return;

    try {
      const taskPayload = {
        name: form.name,
        executor: form.executor,
        executorId: activeProject?.ownerId,
        start: form.start,
        end: form.end,
        status: form.status,
        dependencies: form.dependencies,
        projectId: currentProjectId,
      };

      if (editingId) {
        const updated = await updateTask(editingId, taskPayload);
        setTasks(applyAutoOverdue(updated));
      } else {
        await createTask(taskPayload);
        const fresh = await getTasks();
        setTasks(applyAutoOverdue(fresh));
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось сохранить задачу');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить задачу?')) return;
    const updated = await deleteTask(id);
    setTasks(applyAutoOverdue(updated));
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    const updated = await updateTask(id, { status });
    setTasks(applyAutoOverdue(updated));
  };

  const statusStyles: Record<TaskStatus, string> = {
    Todo: 'bg-gray-100 text-gray-700',
    InProgress: 'bg-amber-100 text-amber-700',
    Done: 'bg-green-100 text-green-700',
    Overdue: 'bg-red-100 text-red-700',
  };

  const statusLabel: Record<TaskStatus, string> = {
    Todo: 'К выполнению',
    InProgress: 'В работе',
    Done: 'Готово',
    Overdue: 'Просрочено',
  };

  const availableDeps = currentProjectTasks.filter((t) => t.id !== editingId);

  const toggleDep = (id: string) => {
    setForm((f) => {
      const has = f.dependencies.includes(id);
      if (!has && editingId && wouldCreateCycle(editingId, id, tasks)) {
        alert('Нельзя создать циклическую зависимость');
        return f;
      }
      return {
        ...f,
        dependencies: has
          ? f.dependencies.filter((x) => x !== id)
          : [...f.dependencies, id],
      };
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      {/* Панель управления проектами */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/60 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-bold uppercase text-gray-400 tracking-wider whitespace-nowrap">
            Выбор проекта:
          </label>
          <select
            value={currentProjectId}
            onChange={(e) => {
              setCurrentProjectId(e.target.value);
              setActiveTab('All');
            }}
            className="border border-gray-200 rounded-lg p-2 text-sm bg-gray-50 font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsProjectModalOpen(true)}
            className="border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold py-2 px-3 rounded-lg transition"
          >
            📁 Создать проект
          </button>
        </div>
        {activeProject && (
          <div className="text-xs font-medium text-gray-500">
            Плановый дедлайн проекта:{' '}
            <span className="font-mono text-gray-900 font-bold bg-gray-100 px-1.5 py-0.5 rounded">
              {activeProject.deadline}
            </span>
          </div>
        )}
      </div>

      {/* Шапка */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {activeProject ? activeProject.name : 'Панель контроля состояния'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Текущее состояние и каскадный контроль сроков диаграммы Ганта
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setCurrentView('gantt')}
            className="flex-1 sm:flex-none border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold py-2 px-4 rounded-lg text-sm"
          >
            📊 Диаграмма Ганта
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
          >
            + Добавить задачу
          </button>
        </div>
      </div>

      {/* Прогресс */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/60 mb-6">
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
            Общий прогресс текущего проекта
          </span>
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
        {isProjectAtRisk && activeProject && (
          <p className="text-xs text-red-600 mt-2 font-medium">
            ⚠️ Проект под риском: последняя задача заканчивается позже дедлайна ({activeProject.deadline})
          </p>
        )}
      </div>

      {/* KPI карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { tab: 'All' as Tab, label: 'Всего', value: total, color: 'blue' },
          { tab: 'Done' as Tab, label: 'Выполнено', value: done, color: 'green' },
          { tab: 'InProgress' as Tab, label: 'В работе', value: inProgress, color: 'amber' },
          { tab: 'Overdue' as Tab, label: 'Просрочено', value: overdue, color: 'red' },
        ].map((c) => (
          <button
            key={c.tab}
            type="button"
            onClick={() => setActiveTab(c.tab)}
            className={`p-5 rounded-2xl text-left border transition-all bg-white ${activeTab === c.tab
              ? `border-${c.color}-500 ring-2 ring-${c.color}-500/10 shadow-md`
              : 'border-gray-200/80 hover:border-gray-300'
              }`}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {c.label}
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{c.value}</p>
          </button>
        ))}
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl p-2 pb-0 gap-2">
        <button
          type="button"
          onClick={() => setCurrentView('table')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 ${currentView === 'table'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-400'
            }`}
        >
          📋 Список задач
        </button>
        <button
          type="button"
          onClick={() => setCurrentView('gantt')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 ${currentView === 'gantt'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-400'
            }`}
        >
          📊 Диаграмма Ганта
        </button>
      </div>

      {/* Поиск */}
      <div className="mb-5 bg-white p-4 rounded-xl border border-gray-200/60 shadow-xs flex items-center gap-3">
        <div className="text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Живой поиск по названию операции или исполнителю..."
          className="w-full text-sm outline-none bg-transparent placeholder:text-gray-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-gray-400 hover:text-gray-600 text-xs font-bold"
          >
            Очистить
          </button>
        )}
      </div>

      {/* Контент */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка задач...</div>
      ) : currentView === 'table' ? (
        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Нет задач в данном проекте</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-4 font-semibold">Задача</th>
                  <th className="p-4 font-semibold">Исполнитель</th>
                  <th className="p-4 font-semibold">Сроки</th>
                  <th className="p-4 font-semibold">Зависит от</th>
                  <th className="p-4 font-semibold">Статус</th>
                  <th className="p-4 font-semibold text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const depNames = task.dependencies
                    .map((id) => tasks.find((t) => t.id === id)?.name)
                    .filter(Boolean) as string[];
                  return (
                    <tr key={task.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="p-4 font-medium text-gray-900">{task.name}</td>
                      <td className="p-4 text-gray-600">{task.executor}</td>
                      <td className="p-4 text-gray-600">
                        {task.start} → {task.end}
                      </td>
                      <td className="p-4 text-gray-500 text-xs">
                        {depNames.length === 0 ? '—' : depNames.join(', ')}
                      </td>
                      <td className="p-4">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleStatusChange(task.id, e.target.value as TaskStatus)
                          }
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${statusStyles[task.status]}`}
                        >
                          {(['Todo', 'InProgress', 'Done', 'Overdue'] as TaskStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {statusLabel[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(task.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-semibold mr-3"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-semibold"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div id="gantt">
          <GanttChart
            tasks={currentProjectTasks}
            onTasksUpdate={(updated) => setTasks(applyAutoOverdue(updated))}
            onTaskClick={openEdit}
          />
        </div>
      )}

      {/* Модалка: создание проекта */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Создать новый проект</h2>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Название проекта
                </label>
                <input
                  type="text"
                  required
                  value={projectForm.name}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, name: e.target.value })
                  }
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: Разработка ядра платформы"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Плановый дедлайн проекта
                </label>
                <input
                  type="date"
                  required
                  value={projectForm.deadline}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, deadline: e.target.value })
                  }
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg text-sm"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: create/edit задачи */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Редактировать задачу' : 'Добавить задачу'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Название
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Исполнитель
                </label>
                <select
                  value={form.executor}
                  onChange={(e) => setForm({ ...form, executor: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EXECUTORS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Старт
                  </label>
                  <input
                    type="date"
                    required
                    value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Конец
                  </label>
                  <input
                    type="date"
                    required
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Статус
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as TaskStatus })
                  }
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white"
                >
                  {(['Todo', 'InProgress', 'Done', 'Overdue'] as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {statusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Зависит от задач
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {availableDeps.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2">
                      Нет других задач в этом проекте
                    </p>
                  ) : (
                    availableDeps.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-sm p-1 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.dependencies.includes(t.id)}
                          onChange={() => toggleDep(t.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate text-gray-700">{t.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg text-sm shadow-sm transition-colors"
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