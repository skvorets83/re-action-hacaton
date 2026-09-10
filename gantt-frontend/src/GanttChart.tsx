// src/GanttChart.tsx
import { useState } from 'react'
import { Gantt, ViewMode } from 'gantt-task-react'
import type { Task as GanttTask } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'
import { updateTaskDates, Task as DashboardTask } from './api/taskApi' // Импорт API Участника 5

interface GanttChartProps {
    tasks: DashboardTask[];
    onTasksUpdate: (updatedTasks: DashboardTask[]) => void; // Чтобы обновить метрики на Дашборде
}

function GanttChart({ tasks, onTasksUpdate }: GanttChartProps) {
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day)

    // Переводим формат данных Дашборда в формат библиотеки Ганта
    const formattedTasks: GanttTask[] = tasks.map(t => {
        // Вычисляем прогресс на основе статуса задачи
        let progress = 0;
        if (t.status === 'Done') progress = 100;
        if (t.status === 'InProgress') progress = 50;

        // Выставляем цвета полосок под тему Tailwind
        let barColor = '#3b82f6'; // Синий по умолчанию (Todo)
        if (t.status === 'Done') barColor = '#10b981'; // Зеленый
        if (t.status === 'InProgress') barColor = '#f59e0b'; // Амбер
        if (t.status === 'Overdue') barColor = '#ef4444'; // Красный

        return {
            id: t.id,
            name: `${t.name} (${t.executor})`,
            start: new Date(t.start + 'T00:00:00'), // Защита от сдвига часовых поясов
            end: new Date(t.end + 'T23:59:59'),
            type: 'task',
            progress: progress,
            styles: {
                progressColor: barColor,
                progressSelectedColor: barColor,
                backgroundColor: '#f3f4f6'
            }
        };
    })

    // Функция, которая срабатывает при перетаскивании полоски Ганта мышкой
    const handleDateChange = async (updatedTask: GanttTask) => {
        // Форматируем дату обратно в строку YYYY-MM-DD для хранилища
        const startStr = updatedTask.start.toISOString().split('T')[0];
        const endStr = updatedTask.end.toISOString().split('T')[0];

        try {
            // Вызываем обновление в базе данных Участника 5
            const updatedDB = await updateTaskDates(updatedTask.id, startStr, endStr);
            // Передаем новый массив наверх в Дашборд, чтобы обновились графики и таблицы
            onTasksUpdate(updatedDB);
        } catch (error) {
            console.error('Ошибка сохранения дат из диаграммы Ганта:', error);
        }
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-xs animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Масштаб графика:</span>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setViewMode(ViewMode.Day)}
                        className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === ViewMode.Day ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        День
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode(ViewMode.Week)}
                        className={`cursor-pointer px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === ViewMode.Week ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
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
    )
}

export default GanttChart;
