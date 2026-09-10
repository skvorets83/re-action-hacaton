using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using GanttManager.API; // Подключаем базу данных Матвея

namespace GanttManager.Services;

public class GanttEngine
{
    /// <summary>
    /// Каскадно пересчитывает даты всех зависимых задач в PostgreSQL при сдвиге родительской
    /// </summary>
    public async Task RecalculateDependenciesAsync(AppDbContext context, Guid projectId, Guid updatedTaskId, int daysShift)
    {
        if (daysShift == 0) return;

        // 1. Вытягиваем абсолютно все задачи проекта и их зависимости из базы в оперативную память
        var allTasks = await context.Tasks
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.Dependencies)
            .ToListAsync();

        // 2. Инициализируем очередь для обхода графа зависимостей (BFS)
        var queue = new Queue<Guid>();

        // Находим задачи, у которых в таблице зависимостей ParentTaskId равен измененной задаче
        var directDependents = await context.TaskDependencies
            .Where(td => td.ParentTaskId == updatedTaskId)
            .Select(td => td.ChildTaskId)
            .ToListAsync();

        foreach (var id in directDependents)
        {
            queue.Enqueue(id);
        }

        // 3. Каскадный обход дерева связей
        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            var currentTask = allTasks.FirstOrDefault(t => t.Id == currentId);

            if (currentTask != null)
            {
                // Сдвигаем даты зависимой задачи на то же число дней
                currentTask.StartDate = currentTask.StartDate.AddDays(daysShift);
                currentTask.EndDate = currentTask.EndDate.AddDays(daysShift);

                // Ищем задачи, которые зависят уже от текущей сдвинутой задачи, и добавляем в очередь
                var nextDependents = await context.TaskDependencies
                    .Where(td => td.ParentTaskId == currentId)
                    .Select(td => td.ChildTaskId)
                    .ToListAsync();

                foreach (var id in nextDependents)
                {
                    queue.Enqueue(id);
                }
            }
        }
    }
}
