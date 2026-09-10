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
} from './api/taskApi';
import type { Task, TaskStatus } from './api/taskApi';

const DEFAULT_PROJECT_NAME = 'Хакатон MVP';
const DEFAULT_PROJECT_DEADLINE = '2026-09-22';

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

  // модалка
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    executor: EXECUTORS[0],
    start: '',
    end: '',
    status: 'Todo' as TaskStatus,
    dependencies: [] as string[],
  });

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

  // ---------- Метрики ----------
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'Done').length;
  const inProgress = tasks.filter((t) => t.status === 'InProgress').length;
  const overdue = tasks.filter((t) => t.status === 'Overdue').length;
  const projectProgress = total > 0 ? Math.round((done / total) * 100) : 0;

  const lastTaskEnd = tasks.reduce(
    (max, t) => (t.end > max ? t.end : max),
    '1970-01-01'
  );
  const isProjectAtRisk = lastTaskEnd > DEFAULT_PROJECT_DEADLINE;

  const filteredTasks = useMemo(() => {
    if (activeTab === 'All') return tasks;
    return tasks.filter((t) => t.status === activeTab);
  }, [tasks, activeTab]);

  // ---------- Открытие модалки ----------
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
    const t = tasks.find((x) => x.id === id);
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

  // ---------- Сохранение ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start || !form.end) return;

    try {
      if (editingId) {
        const updated = await updateTask(editingId, {
          name: form.name,
          executor: form.executor,
          start: form.start,
          end: form.end,
          status: form.status,
          dependencies: form.dependencies,
        });
        setTasks(applyAutoOverdue(updated));
      } else {
        await createTask({
          name: form.name,
          executor: form.executor,
          start: form.start,
          end: form.end,
          status: form.status,
          dependencies: form.dependencies,
        });
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

  // ---------- Стили статусов ----------
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

  // ---------- Возможные зависимости для формы ----------
  const availableDeps = tasks.filter((t) => t.id !== editingId);

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

  // ================= RENDER =================
  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-gray-800">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Панель контроля состояния
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Проект: {DEFAULT_PROJECT_NAME} · дедлайн {DEFAULT_PROJECT_DEADLINE}
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
            Общий прогресс проекта
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
        {isProjectAtRisk && (
          <p className="text-xs text-red-600 mt-2 font-medium">
            ⚠️ Проект под риском: последняя задача заканчивается позже дедлайна ({DEFAULT_PROJECT_DEADLINE})
          </p>
        )}
      </div>

      {/* KPI */}
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
            className={`p-5 rounded-2xl text-left border transition-all bg-white ${
              activeTab === c.tab
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
          className={`pb-3 px-4 text-sm font-semibold border-b-2 ${
            currentView === 'table'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400'
          }`}
        >
          📋 Список задач
        </button>
        <button
          type="button"
          onClick={() => setCurrentView('gantt')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 ${
            currentView === 'gantt'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400'
          }`}
        >
          📊 Диаграмма Ганта
        </button>
      </div>

      {/* Контент */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка задач...</div>
      ) : currentView === 'table' ? (
        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Нет задач</div>
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
                      <td className="p-4 text-gray-600">{task.start} → {task.end}</td>
                      <td className="p-4 text-gray-500 text-xs">
                        {depNames.length === 0 ? '—' : depNames.join(', ')}
                      </td>
                      <td className="p-4">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${statusStyles[task.status]}`}
                        >
                          {(['Todo', 'InProgress', 'Done', 'Overdue'] as TaskStatus[]).map((s) => (
                            <option key={s} value={s}>{statusLabel[s]}</option>
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
            tasks={tasks}
            onTasksUpdate={(updated) => setTasks(applyAutoOverdue(updated))}
            onTaskClick={openEdit}
          />
        </div>
      )}

      {/* Модалка create/edit */}
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
                    <option key={e} value={e}>{e}</option>
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
                  onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white"
                >
                  {(['Todo', 'InProgress', 'Done', 'Overdue'] as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>{statusLabel[s]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Зависит от задач
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {availableDeps.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2">Нет других задач</p>
                  ) : (
                    availableDeps.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm p-1 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={form.dependencies.includes(t.id)}
                          onChange={() => toggleDep(t.id)}
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    ))
                  )}
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
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg text-sm"
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