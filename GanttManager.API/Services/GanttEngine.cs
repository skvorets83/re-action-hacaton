using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using GanttManager.API;

namespace GanttManager.Services;

public class GanttEngine
{
    public async Task RecalculateDependenciesAsync(AppDbContext context, Guid projectId, Guid updatedTaskId, int daysShift)
    {
        if (daysShift == 0) return;

        var allTasks = await context.Tasks
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.ParentDependencies)
            .Include(t => t.ChildDependencies)
            .ToListAsync();

        var queue = new Queue<Guid>();
        var directDependents = await context.TaskDependencies
            .Where(td => td.ParentTaskId == updatedTaskId)
            .Select(td => td.ChildTaskId)
            .ToListAsync();

        foreach (var id in directDependents)
        {
            queue.Enqueue(id);
        }

        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            var currentTask = allTasks.FirstOrDefault(t => t.Id == currentId);

            if (currentTask != null)
            {
                currentTask.StartDate = currentTask.StartDate.AddDays(daysShift);
                currentTask.EndDate = currentTask.EndDate.AddDays(daysShift);

                var nextDependents = currentTask.ChildDependencies
                    .Select(td => td.ChildTaskId)
                    .ToList();

                foreach (var id in nextDependents)
                {
                    queue.Enqueue(id);
                }
            }
        }
    }
}
