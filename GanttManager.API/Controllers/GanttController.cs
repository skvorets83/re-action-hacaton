using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GanttManager.API;

namespace GanttManager.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GanttController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GanttController(AppDbContext context)
        {
            _context = context;
        }

        // ==========================================
        // 📁 УПРАВЛЕНИЕ ПРОЕКТАМИ (CRUD)
        // ==========================================

        // 1. Получить все проекты со списком их задач
        [HttpGet("projects")]
        public async Task<ActionResult<IEnumerable<Project>>> GetProjects()
        {
            return await _context.Projects.Include(p => p.Tasks).ToListAsync();
        }

        // 2. Создать новый проект (Всеядный эндпоинт)
        [HttpPost("projects")]
        public async Task<ActionResult<Project>> CreateProject([FromBody] System.Text.Json.JsonElement json)
        {
            if (!json.TryGetProperty("name", out var nameProp))
            {
                return BadRequest(new { message = "Поле name является обязательным" });
            }

            var newProject = new Project
            {
                Id = Guid.NewGuid(),
                Name = nameProp.GetString() ?? "Новый проект",
                Description = json.TryGetProperty("description", out var descProp) ? descProp.GetString() ?? "" : "",
                OwnerId = json.TryGetProperty("ownerId", out var ownerProp) && Guid.TryParse(ownerProp.GetString(), out var oId) ? oId : Guid.Empty,
                CreatedAt = DateTime.UtcNow,
                Tasks = new List<TaskItem>()
            };

            _context.Projects.Add(newProject);
            await _context.SaveChangesAsync();
            return Ok(newProject);
        }

        // ==========================================
        // 📊 УПРАВЛЕНИЕ ЗАДАЧАМИ
        // ==========================================

        // 3. Получить все задачи конкретного проекта с их родительскими зависимостями
        [HttpGet("projects/{projectId}/tasks")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetTasks(Guid projectId)
        {
            return await _context.Tasks
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.ParentDependencies) // Подгружаем задачи, от которых зависит текущая
                .ToListAsync();
        }

        // 4. Создать новую задачу в проекте
        [HttpPost("tasks")]
        public async Task<ActionResult<TaskItem>> CreateTask([FromBody] System.Text.Json.JsonElement json)
        {
            if (!json.TryGetProperty("projectId", out var projProp) || !Guid.TryParse(projProp.GetString(), out var projId))
            {
                return BadRequest(new { message = "Обязательное поле projectId отсутствует или имеет неверный формат GUID" });
            }

            // Проверяем, существует ли вообще такой проект в PostgreSQL
            var projectExists = await _context.Projects.AnyAsync(p => p.Id == projId);
            if (!projectExists)
            {
                return BadRequest(new { message = $"Проект с ID {projId} не найден в базе данных" });
            }

            if (!json.TryGetProperty("startDate", out var startProp) || !json.TryGetProperty("endDate", out var endProp))
            {
                return BadRequest(new { message = "Поля startDate и endDate обязательны для создания задачи" });
            }

            var newTask = new TaskItem
            {
                Id = Guid.NewGuid(), // Генерируем новый ID на бэке
                ProjectId = projId,
                Name = json.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "Новая задача" : "Новая задача",
                Status = json.TryGetProperty("status", out var statusProp) ? statusProp.GetString() ?? "Todo" : "Todo",
                StartDate = startProp.GetDateTime(),
                EndDate = endProp.GetDateTime(),
                ExecutorId = json.TryGetProperty("executorId", out var execProp) && Guid.TryParse(execProp.GetString(), out var eId) ? eId : null,
                ParentDependencies = new List<TaskDependency>(),
                ChildDependencies = new List<TaskDependency>()
            };

            _context.Tasks.Add(newTask);
            await _context.SaveChangesAsync();
            return Ok(newTask);
        }

        // 5. ОБНОВЛЕНИЕ ЗАДАЧИ С КАСКАДНЫМ ПЕРЕСЧЕТОМ ДАТ ГАНТА
        [HttpPut("tasks/{id}")]
        public async Task<IActionResult> UpdateTask(Guid id, [FromBody] System.Text.Json.JsonElement json)
        {
            var task = await _context.Tasks
                .Include(t => t.ParentDependencies)
                .Include(t => t.ChildDependencies) // Включаем обе коллекции для корректного BFS обхода графа
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound(new { message = "Задача не найдена" });

            if (!json.TryGetProperty("startDate", out var startProp) || !json.TryGetProperty("endDate", out var endProp))
            {
                return BadRequest(new { message = "Поля startDate и endDate обязательны для обновления" });
            }

            DateTime newStartDate = startProp.GetDateTime();
            DateTime newEndDate = endProp.GetDateTime();

            // Вычисляем сдвиг по дням для алгоритма Ганта
            int daysShift = (newStartDate - task.StartDate).Days;

            var validationService = new Services.TaskValidationService();
            if (!validationService.ValidateDates(newStartDate, newEndDate, out string error))
            {
                return BadRequest(new { message = error });
            }

            if (json.TryGetProperty("name", out var nameProp)) task.Name = nameProp.GetString() ?? task.Name;
            if (json.TryGetProperty("status", out var statusProp)) task.Status = statusProp.GetString() ?? task.Status;
            if (json.TryGetProperty("executorId", out var execProp)) task.ExecutorId = Guid.TryParse(execProp.GetString(), out var eId) ? eId : null;

            task.StartDate = newStartDate;
            task.EndDate = newEndDate;

            // Если ползунок сдвинули — запускаем каскадный BFS алгоритм
            if (daysShift != 0)
            {
                var ganttEngine = new Services.GanttEngine();
                await ganttEngine.RecalculateDependenciesAsync(_context, task.ProjectId, id, daysShift);
            }

            await _context.SaveChangesAsync();
            return Ok(task);
        }

        // 6. УДАЛЕНИЕ ЗАДАЧИ И ВСЕХ ЕЁ СВЯЗЕЙ
        [HttpDelete("tasks/{id}")]
        public async Task<IActionResult> DeleteTask(Guid id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound(new { message = "Задача не найдена" });

            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
