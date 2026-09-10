import { useState, useEffect } from 'react' // 1. Добавили useEffect сюда
import { Gantt, ViewMode } from 'gantt-task-react'
import type { Task } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'
import { tasksApi } from '../api/tasksApi' // 2. Подключили файл Участника 5

const initialTasks: Task[] = [
  {
    start: new Date(2026, 8, 10),
    end: new Date(2026, 8, 12),
    name: 'Анализ требований',
    id: '1',
    type: 'task',
    progress: 100,
  },
  {
    start: new Date(2026, 8, 12),
    end: new Date(2026, 8, 15),
    name: 'Дизайн',
    id: '2',
    type: 'task',
    progress: 40,
    dependencies: ['1'],
  },
  {
    start: new Date(2026, 8, 15),
    end: new Date(2026, 8, 22),
    name: 'Разработка',
    id: '3',
    type: 'task',
    progress: 0,
    dependencies: ['2'],
  },
  {
    start: new Date(2026, 8, 22),
    end: new Date(2026, 8, 25),
    name: 'Тестирование',
    id: '4',
    type: 'task',
    progress: 0,
    dependencies: ['3'],
  },
]

function GanttChart() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day)
  const [loading, setLoading] = useState<boolean>(true) // Состояние загрузки

  // 3. Этот хук сработает один раз при открытии страницы и запросит данные у C#
  useEffect(() => {
    const fetchServerData = async () => {
      try {
        const serverData = await tasksApi.getTasks()
        
        // Переводим строковые даты от бэка в объекты Date
        const formattedTasks: Task[] = serverData.map((t: any) => ({
          ...t,
          start: new Date(t.start),
          end: new Date(t.end),
          type: 'task'
        }))
        
        setTasks(formattedTasks)
      } catch (error) {
        console.log("Бэкенд еще не запущен Участником 2, работаем на мок-данных:", error)
      } finally {
        setLoading(false) // Выключаем экран загрузки в любом случае
      }
    }

    fetchServerData()
  }, [])

  // 4. Эта функция сработает, когда ты потащишь полоску мышкой
  const handleDateChange = async (updatedTask: Task) => {
    try {
      // Сначала отправляем изменения на сервер Участника 2
      const serverData = await tasksApi.updateTaskDates(
        updatedTask.id, 
        updatedTask.start.toISOString(), 
        updatedTask.end.toISOString()
      )

      // Если сервер ответил успехом, берем его пересчитанный массив
      const formattedTasks: Task[] = serverData.map((t: any) => ({
        ...t,
        start: new Date(t.start),
        end: new Date(t.end),
        type: 'task'
      }))

      setTasks(formattedTasks)
    } catch (error) {
      console.log("Ошибка сервера при сдвиге, обновляем только локально на фронте:", error)
      // Если бэк упал, двигаем таску локально, чтобы на демке ничего не зависло
      setTasks(prevTasks => prevTasks.map(t => (t.id === updatedTask.id ? updatedTask : t)))
    }
  }

  const handleProgressChange = (updatedTask: Task) => {
    setTasks(prevTasks => prevTasks.map(t => (t.id === updatedTask.id ? updatedTask : t)))
  }

  // Если данные еще грузятся, покажем простую надпись
  if (loading) {
    return <div className="text-center p-10 text-gray-600 font-medium">Загрузка данных проекта...</div>
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <Gantt
          tasks={tasks}
          viewMode={viewMode}
          onDateChange={handleDateChange} // Включили отслеживание сдвига
          onProgressChange={handleProgressChange} // Включили отслеживание прогресса
          listCellWidth="190px"
          columnWidth={55}
          rowHeight={42}
          headerHeight={54}
          barCornerRadius={6}
          todayColor="rgba(59, 130, 246, 0.12)"
          barBackgroundColor="#3b82f6"
          barBackgroundSelectedColor="#2563eb"
          arrowColor="#64748b"
          arrowIndent={20}
        />
      </div>
    </div>
  )
}

export default GanttChart
