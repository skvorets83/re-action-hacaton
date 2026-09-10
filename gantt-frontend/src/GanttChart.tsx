// src/GanttChart.tsx
import { useState } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { updateTaskDates } from './api/taskApi';
import type { Task as DashboardTask } from './api/taskApi';

interface GanttChartProps {
  tasks: DashboardTask[];
  onTasksUpdate: (updatedTasks: DashboardTask[]) => void;
  onTaskClick?: (taskId: string) => void;
}

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

function GanttChart({ tasks, onTasksUpdate, onTaskClick }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);

  const formattedTasks: GanttTask[] = tasks.map((t) => {
    let progress = 0;
    if (t.status === 'Done') progress = 100;
    else if (t.status === 'InProgress') progress = 50;
    else if (t.status === 'Overdue') progress = 30;

    let barColor = '#3b82f6';
    let barBg = '#dbeafe';
    if (t.status === 'Done') { barColor = '#10b981'; barBg = '#d1fae5'; }
    if (t.status === 'InProgress') { barColor = '#f59e0b'; barBg = '#fef3c7'; }
    if (t.status === 'Overdue') { barColor = '#ef4444'; barBg = '#fee2e2'; }

    return {
      id: t.id,
      name: `${t.name} (${t.executor})`,
      start: new Date(t.start + 'T00:00:00'),
      end: new Date(t.end + 'T23:59:59'),
      type: 'task',
      progress,
      dependencies: t.dependencies ?? [],
      styles: {
        progressColor: barColor,
        progressSelectedColor: barColor,
        backgroundColor: barBg,
        backgroundSelectedColor: barBg,
      },
    };
  });

  const handleDateChange = async (updated: GanttTask) => {
    const startStr = toYMD(updated.start);
    const endStr = toYMD(updated.end);
    try {
      const updatedDB = await updateTaskDates(updated.id, startStr, endStr);
      onTasksUpdate(updatedDB);
    } catch (e) {
      console.error('Ошибка сохранения дат:', e);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-xs">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
          Масштаб графика:
        </span>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          {[
            { mode: ViewMode.Day, label: 'День' },
            { mode: ViewMode.Week, label: 'Неделя' },
          ].map(({ mode, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        {formattedTasks.length > 0 ? (
          <Gantt
            tasks={formattedTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            onClick={(task) => onTaskClick?.(task.id)}
            listCellWidth="220px"
            columnWidth={60}
            rowHeight={45}
            headerHeight={50}
            barCornerRadius={8}
            todayColor="rgba(59, 130, 246, 0.08)"
            arrowColor="#94a3b8"
            arrowIndent={20}
          />
        ) : (
          <div className="text-center py-10 text-gray-400">
            Нет операций для отображения
          </div>
        )}
      </div>
    </div>
  );
}

export default GanttChart;