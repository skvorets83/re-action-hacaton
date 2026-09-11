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
        // 📊 УПРАВЛЕНИЕ ЗАЗАЧАМИ
        // ==========================================

        // 3. Получить все задачи конкретного проекта с их зависимостями
        [HttpGet("projects/{projectId}/tasks")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetTasks(Guid projectId)
        {
            return await _context.Tasks
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.Dependencies)
                .ToListAsync();
        }

        // 4. Создать новую задачу в проекте (Чинит баг создания проектов вместо задач)
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
                Id = Guid.NewGuid(), // Всегда жестко генерируем НОВЫЙ ID на бэке, чтобы не было конфликтов
                ProjectId = projId,
                Name = json.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "Новая задача" : "Новая задача",
                Status = json.TryGetProperty("status", out var statusProp) ? statusProp.GetString() ?? "Todo" : "Todo",
                StartDate = startProp.GetDateTime(),
                EndDate = endProp.GetDateTime(),
                ExecutorId = json.TryGetProperty("executorId", out var execProp) && Guid.TryParse(execProp.GetString(), out var eId) ? eId : null,
                Dependencies = new List<TaskDependency>()
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
                .Include(t => t.Dependencies)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound(new { message = "Задача не найдена" });

            if (!json.TryGetProperty("startDate", out var startProp) || !json.TryGetProperty("endDate", out var endProp))
            {
                return BadRequest(new { message = "Поля startDate и endDate обязательны для обновления" });
            }

            DateTime newStartDate = startProp.GetDateTime();
            DateTime newEndDate = endProp.GetDateTime();

            // Вычисляем сдвиг по дням для твоего алгоритма Ганта
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

            // Если ползунок сдвинули — запускаем твой каскадный BFS алгоритм
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
        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            // Загружаем пользователей из PostgreSQL
            var users = await _context.Users.ToListAsync();

            int counter = 1;
            var result = new List<object>();

            foreach (var u in users)
            {
                // С помощью рефлексии безопасно ищем ХОТЬ КАКОЕ-ТО текстовое поле в модели Матвея
                string detectedName = u.GetType().GetProperties()
                    .Where(p => p.PropertyType == typeof(string) && p.Name != "PasswordHash" && p.Name != "Role")
                    .Select(p => p.GetValue(u)?.ToString())
                    .FirstOrDefault(v => !string.IsNullOrEmpty(v)) ?? $"Разработчик {counter++}";

                result.Add(new
                {
                    id = u.Id,
                    name = detectedName,
                    email = detectedName.Contains("@") ? detectedName : $"{detectedName}@example.com"
                });
            }

            return Ok(result);
        }
        // 9. ПОЛУЧИТЬ ОДИН ПРОЕКТ ПО ID
        [HttpGet("projects/{id}")]
        public async Task<ActionResult<Project>> GetProjectById(Guid id)
        {
            var project = await _context.Projects.Include(p => p.Tasks).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound(new { message = "Проект не найден" });
            return Ok(project);
        }

        // 10. ОБНОВИТЬ ИМЯ/ОПИСАНИЕ ПРОЕКТА
        [HttpPut("projects/{id}")]
        public async Task<IActionResult> UpdateProject(Guid id, [FromBody] System.Text.Json.JsonElement json)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Проект не найден" });

            if (json.TryGetProperty("name", out var nameProp)) project.Name = nameProp.GetString() ?? project.Name;
            if (json.TryGetProperty("description", out var descProp)) project.Description = descProp.GetString() ?? project.Description;

            await _context.SaveChangesAsync();
            return Ok(project);
        }

        // 11. СОЗДАТЬ СВЯЗЬ МЕЖДУ ЗАДАЧАМИ (ПОСТРОИТЬ СТРЕЛОЧКУ)
        [HttpPost("tasks/{id}/dependencies")]
        public async Task<IActionResult> AddDependency(Guid id, [FromBody] System.Text.Json.JsonElement json)
        {
            if (!json.TryGetProperty("parentTaskId", out var parentProp) || !Guid.TryParse(parentProp.GetString(), out var parentId))
            {
                return BadRequest(new { message = "Необходимо передать корректный parentTaskId" });
            }

            // Проверяем, существуют ли обе задачи в базе
            var parentExists = await _context.Tasks.AnyAsync(t => t.Id == parentId);
            var childExists = await _context.Tasks.AnyAsync(t => t.Id == id);

            if (!parentExists || !childExists) return NotFound(new { message = "Одна из задач не найдена в базе" });

            // Проверяем, нет ли уже такой связи, чтобы не поймать дубликат ключа в Postgres
            var dependencyExists = await _context.TaskDependencies.AnyAsync(td => td.ParentTaskId == parentId && td.ChildTaskId == id);
            if (dependencyExists) return BadRequest(new { message = "Такая связь уже существует" });

            var dependency = new TaskDependency
            {
                ParentTaskId = parentId,
                ChildTaskId = id
            };

            _context.TaskDependencies.Add(dependency);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Связь успешно добавлена" });
        }

    }
}
