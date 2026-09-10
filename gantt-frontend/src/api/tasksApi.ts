import axios from 'axios';

// URL-адрес C# бэкенда Участника 2. 
// По умолчанию ASP.NET Core локально запускается на http://localhost:5000 или http://localhost:5173/api
// Пусть Участник 2 скажет свой точный порт, и вы измените его здесь.
const API_URL = 'http://localhost:5000/api';

export const tasksApi = {
    /**
     * 1. Получить все задачи проекта с бэкенда
     * Метод: GET /api/tasks
     */
    async getTasks() {
        const response = await axios.get(`${API_URL}/tasks`);
        return response.data; // Возвращает массив задач из базы данных PostgreSQL
    },

    /**
     * 2. Обновить даты задачи при перетаскивании полоски на графике Ганта
     * Метод: PUT /api/tasks/{id}
     * @param id - уникальный идентификатор задачи
     * @param startDate - новая дата начала (в формате ISO строки)
     * @param endDate - новая дата окончания (в формате ISO строки)
     */
    async updateTaskDates(id: string, startDate: string, endDate: string) {
        const response = await axios.put(`${API_URL}/tasks/${id}`, {
            start: startDate,
            end: endDate
        });
        // Бэкенд C# пересчитает зависимости и вернет нам актуальный массив всех задач
        return response.data;
    }
};
