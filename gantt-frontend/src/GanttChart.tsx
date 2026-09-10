// src/GanttChart.tsx
import { useState } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { updateTaskDates, type Task } from './api/tasksApi';

interface GanttChartProps {
  tasks: Task[];
  onTasksUpdate: (updatedTasks: Task[]) => void;
}

// YYYY-MM-DD → Date в локальной зоне (без UTC-сдвигов)
const parseYMD = (s: string): Date => {
  const clean = s.includes('T') ? s.split('T')[0] : s;
  return new Date(clean + 'T00:00:00');
};

// Date → YYYY-MM-DD (локально, без toISOString)
const toYMD = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function GanttChart({ tasks, onTasksUpdate }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);

  const formattedTasks: GanttTask[] = tasks.map((t) => {
    let progress = 0;
    if (t.status === 'Done') progress = 100;
    if (t.status === 'InProgress') progress = 50;

    let barColor = '#3b82f6';
    if (t.status === 'Done') barColor = '#10b981';
    if (t.status === 'InProgress') barColor = '#f59e0b';
    if (t.status === 'Overdue') barColor = '#ef4444';

    const parsedStart = parseYMD(t.start);
    const parsedEnd = parseYMD(t.end);
    const validStart = isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
    const validEnd = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;

    return {
      id: t.id,
      name: `${t.name}`,
      start: validStart,
      end: validEnd,
      type: 'task',
      progress,
      dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
      styles: {
        progressColor: barColor,
        progressSelectedColor: barColor,
        backgroundColor: '#f3f4f6',
      },
    };
  });
  console.log('=== TASKS ===');
  formattedTasks.forEach((t) => {
    console.log('id:', t.id, '| name:', t.name, '| deps:', t.dependencies);
  });

  const handleDateChange = async (updatedTask: GanttTask) => {
    try {
      // Отправляем чистые YYYY-MM-DD, а не ISO с Z
      const startYMD = toYMD(updatedTask.start);
      const endYMD = toYMD(updatedTask.end);

      const updatedDB = await updateTaskDates(updatedTask.id, startYMD, endYMD);
      onTasksUpdate(updatedDB);
    } catch (error) {
      console.error('Ошибка сохранения дат из диаграммы Ганта:', error);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-xs">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
          Масштаб графика:
        </span>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode(ViewMode.Day)}
            className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === ViewMode.Day
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            День
          </button>
          <button
            type="button"
            onClick={() => setViewMode(ViewMode.Week)}
            className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === ViewMode.Week
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            Неделя
          </button>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        {formattedTasks.length > 0 ? (
          <Gantt
            tasks={formattedTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            listCellWidth="220px"
            columnWidth={60}
            rowHeight={45}
            headerHeight={50}
            barCornerRadius={8}
            todayColor="rgba(59, 130, 246, 0.08)"
            arrowColor="#cbd5e1"
            locale="ru"
          />
        ) : (
          <div className="text-center py-10 text-gray-400">Нет операций для отображения</div>
        )}
      </div>
    </div>
  );
}

export default GanttChart;