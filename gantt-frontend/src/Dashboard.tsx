import React, { useState, useEffect, useMemo } from 'react';
import GanttChart from './GanttChart';
import { logout, getStoredUser } from './api/authApi';
import CommentsPanel from './CommentsPanel';
import OverdueToast from './OverdueToast';
import {
  getProjects,
  getTasksByProject,
  createProject,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  deleteTask,
  applyAutoOverdue,
  persistTasks,
  wouldCreateCycle,
  getOverdueTasks,
  fetchProjectExport,
  downloadJson,
  downloadCsv,
} from './api/tasksApi';
import type { Task, TaskStatus, Project } from './api/tasksApi';

import { useAuth } from './auth/AuthContext';

type Tab = 'All' | TaskStatus;

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentView, setCurrentView] = useState<'table' | 'gantt'>('table');
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [projectForm, setProjectForm] = useState({
    name: '',
    start: '',
    deadline: '',
  });
  const [projectSettingsForm, setProjectSettingsForm] = useState({
    name: '',
    start: '',
    deadline: '',
  });

  const [showOverdueToast, setShowOverdueToast] = useState(false);

  const [form, setForm] = useState({
    name: '',
    executor: '',
    start: '',
    end: '',
    status: 'Todo' as TaskStatus,
    dependencies: [] as string[],
  });

  const activeProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) || projects[0],
    [projects, currentProjectId]
  );

  // ---------- Загрузка проектов ----------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ps = await getProjects();
        setProjects(ps);
        if (ps.length > 0) setCurrentProjectId(ps[0].id);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Загрузка задач при смене проекта ----------
  useEffect(() => {
    if (!currentProjectId) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getTasksByProject(currentProjectId);
        const normalized = applyAutoOverdue(data);
        setTasks((prev) => {
          // объединяем со задачами других проектов
          const others = prev.filter((t) => t.projectId !== currentProjectId);
          return [...others, ...normalized];
        });

        if (getOverdueTasks(normalized).length > 0) {
          setShowOverdueToast(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentProjectId]);

  // ---------- Задачи текущего проекта ----------
  const currentProjectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === currentProjectId),
    [tasks, currentProjectId]
  );

  // ---------- Метрики ----------
  const total = currentProjectTasks.length;
  const done = currentProjectTasks.filter((t) => t.status === 'Done').length;
  const inProgress = currentProjectTasks.filter((t) => t.status === 'InProgress').length;
  const overdue = currentProjectTasks.filter((t) => t.status === 'Overdue').length;
  const upcoming = currentProjectTasks.filter((t) => t.status === 'Todo').length;
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
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name) return;

    try {
      const created = await createProject({
        name: projectForm.name,
        description: '',
        start: projectForm.start,
        deadline: projectForm.deadline,
      });

      const ps = await getProjects();
      setProjects(ps);
      setCurrentProjectId(created.id);

      setIsProjectModalOpen(false);
      setProjectForm({ name: '', start: '', deadline: '' });
    } catch (err) {
      console.error(err);
      alert('Не удалось создать проект на сервере');
    }
  };

  // ---------- Настройки проекта ----------
  const openProjectSettings = () => {
    if (!activeProject) return;
    setProjectSettingsForm({
      name: activeProject.name,
      start: activeProject.startDate,
      deadline: activeProject.deadline,
    });
    setIsProjectSettingsOpen(true);
  };

  const handleSaveProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    try {
      const updated = await updateProject(activeProject.id, {
        name: projectSettingsForm.name,
        start: projectSettingsForm.start,
        deadline: projectSettingsForm.deadline,
      });

      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setIsProjectSettingsOpen(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось сохранить настройки проекта');
    }
  };

  // ---------- Открытие модалки задачи ----------
  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: '',
      executor: '',
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
    if (!currentProjectId) {
      alert('Сначала выберите или создайте проект');
      return;
    }

    try {
      const taskPayload = {
        name: form.name,
        executor: form.executor.trim() || 'Не назначен',
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
        const fresh = await getTasksByProject(currentProjectId);
        setTasks((prev) => {
          const others = prev.filter((t) => t.projectId !== currentProjectId);
          return [...others, ...applyAutoOverdue(fresh)];
        });
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
    const normalized = applyAutoOverdue(updated);
    setTasks((prev) => {
      const others = prev.filter((t) => t.projectId !== currentProjectId);
      return [...others, ...normalized.filter((t) => t.projectId === currentProjectId)];
    });
  };
  const handleDeleteProject = async () => {
    if (!activeProject) return;
    if (!confirm(`Удалить проект «${activeProject.name}»? Все задачи и зависимости будут удалены.`)) return;

    try {
      await deleteProject(activeProject.id);

      // Перезагружаем список проектов
      const ps = await getProjects();
      setProjects(ps);

      // Сбрасываем на первый проект (или пусто)
      if (ps.length > 0) {
        setCurrentProjectId(ps[0].id);
      } else {
        setCurrentProjectId('');
        setTasks([]);
      }
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить проект');
    }
  };



  // ---------- Экспорт ----------
  const handleExport = async () => {
    if (!currentProjectId) return;
    try {
      const data = await fetchProjectExport(currentProjectId);
      const filename = `project-${(activeProject?.name ?? 'export').replace(/\s+/g, '-')}-${Date.now()}.json`;
      downloadJson(data, filename);
    } catch (err) {
      console.error(err);
      alert('Не удалось экспортировать проект');
    }
  };
  const handleExportCsv = () => {
    if (!activeProject) return;

    // Заголовки CSV
    const rows: string[][] = [
      ['Задача', 'Исполнитель', 'Статус', 'Начало', 'Конец', 'Зависит от'],
    ];

    // Строки — по одной на задачу
    for (const t of currentProjectTasks) {
      const depNames = t.dependencies
        .map((id) => currentProjectTasks.find((x) => x.id === id)?.name ?? '')
        .filter(Boolean)
        .join('; ');   // в CSV зависимости через ; внутри одной ячейки

      rows.push([
        t.name,
        t.executor || '',
        statusLabel[t.status],
        t.start,
        t.end,
        depNames,
      ]);
    }

    const filename = `${activeProject.name.replace(/\s+/g, '-')}-${Date.now()}.csv`;
    downloadCsv(rows, filename);
  };

  // ---------- Стили ----------
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
      if (!has && editingId && wouldCreateCycle(editingId, id, currentProjectTasks)) {
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

  // ================= RENDER =================
  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      {showOverdueToast && (
        <OverdueToast count={overdue} onClose={() => setShowOverdueToast(false)} />
      )}

      {/* Панель управления проектами */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/60 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
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
          {activeProject && (
            <button
              type="button"
              onClick={openProjectSettings}
              className="border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-bold py-2 px-3 rounded-lg transition"
            >
              ⚙️ Настройки
            </button>
          )}
          {activeProject && (
            <button
              type="button"
              onClick={handleDeleteProject}
              className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold py-2 px-3 rounded-lg transition"
            >
              🗑 Удалить проект
            </button>
          )}
          {activeProject && (
            <button
              type="button"
              onClick={handleExport}
              className="border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-bold py-2 px-3 rounded-lg transition"
            >
              💾 Экспорт
            </button>
          )}
          {activeProject && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-bold py-2 px-3 rounded-lg transition"
            >
              📊 CSV
            </button>
          )}
          {user && (
            <div className="flex items-center gap-2 ml-auto">
              <span
                className="text-xs text-gray-500 truncate max-w-[180px]"
                title={user.email}
              >
                {user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="border border-gray-200 bg-white text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-xs font-bold py-2 px-3 rounded-lg transition"
                title="Выйти из аккаунта"
              >
                🚪 Выйти
              </button>
            </div>
          )}
        </div>

        {activeProject && (
          <div className="text-xs font-medium text-gray-500">
            Дедлайн:{' '}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {[
          {
            tab: 'All' as Tab,
            label: 'Всего',
            value: total,
            active: 'border-blue-500 ring-2 ring-blue-500/10',
          },
          {
            tab: 'Todo' as Tab,
            label: 'Предстоит',
            value: upcoming,
            active: 'border-gray-500 ring-2 ring-gray-500/10',
          },
          {
            tab: 'InProgress' as Tab,
            label: 'В работе',
            value: inProgress,
            active: 'border-amber-500 ring-2 ring-amber-500/10',
          },
          {
            tab: 'Done' as Tab,
            label: 'Готово',
            value: done,
            active: 'border-green-500 ring-2 ring-green-500/10',
          },
          {
            tab: 'Overdue' as Tab,
            label: 'Просрочено',
            value: overdue,
            active: 'border-red-500 ring-2 ring-red-500/10',
          },
        ].map((c) => (
          <button
            key={c.tab}
            type="button"
            onClick={() => setActiveTab(c.tab)}
            className={`p-4 rounded-2xl text-left border transition-all bg-white ${activeTab === c.tab
              ? `${c.active} shadow-md`
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
      <div className="mb-5 bg-white p-4 rounded-xl border border-gray-200/60 flex items-center gap-3">
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

                      <td className="p-4 text-gray-600">
                        {task.start} → {task.end}
                      </td>
                      <td className="p-4 text-gray-500 text-xs">
                        {depNames.length === 0 ? '—' : depNames.join(', ')}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[task.status]}`}>
                          {statusLabel[task.status]}
                        </span>
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
            onTasksUpdate={(updated) => {
              setTasks((prev) => {
                const others = prev.filter((t) => t.projectId !== currentProjectId);
                return [...others, ...applyAutoOverdue(updated)];
              });
            }}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Дата старта
                  </label>
                  <input
                    type="date"
                    required
                    value={projectForm.start}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, start: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Дедлайн
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

      {/* Модалка: настройки проекта */}
      {isProjectSettingsOpen && activeProject && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Настройки проекта</h2>
              <button
                type="button"
                onClick={() => setIsProjectSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProjectSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Название проекта
                </label>
                <input
                  type="text"
                  required
                  value={projectSettingsForm.name}
                  onChange={(e) =>
                    setProjectSettingsForm({
                      ...projectSettingsForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Дата старта
                  </label>
                  <input
                    type="date"
                    required
                    value={projectSettingsForm.start}
                    onChange={(e) =>
                      setProjectSettingsForm({
                        ...projectSettingsForm,
                        start: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Дедлайн
                  </label>
                  <input
                    type="date"
                    required
                    value={projectSettingsForm.deadline}
                    onChange={(e) =>
                      setProjectSettingsForm({
                        ...projectSettingsForm,
                        deadline: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsProjectSettingsOpen(false)}
                  className="bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg text-sm"
                >
                  Сохранить
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
                <input
                  type="text"
                  value={form.executor}
                  onChange={(e) => setForm({ ...form, executor: e.target.value })}
                  placeholder="Введите имя исполнителя"
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
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

              {/* Комментарии — только при редактировании */}
              {editingId && (
                <CommentsPanel taskId={editingId} author={form.executor || 'Аноним'} />
              )}

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