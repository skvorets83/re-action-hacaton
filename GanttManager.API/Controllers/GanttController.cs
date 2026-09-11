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

        // 2. Получить один конкретный проект по ID
        [HttpGet("projects/{id}")]
        public async Task<ActionResult<Project>> GetProjectById(Guid id)
        {
            var project = await _context.Projects.Include(p => p.Tasks).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound(new { message = "Проект не найден" });
            return Ok(project);
        }

        // 3. Создать новый проект
        [HttpPost("projects")]
        public async Task<ActionResult<Project>> CreateProject([FromBody] Project projectDto)
        {
            var newProject = new Project
            {
                Id = Guid.NewGuid(),
                Name = string.IsNullOrEmpty(projectDto.Name) ? "Новый проект" : projectDto.Name,
                Description = projectDto.Description ?? "",
                OwnerId = projectDto.OwnerId,
                CreatedAt = DateTime.UtcNow,
                Tasks = new List<TaskItem>()
            };

            _context.Projects.Add(newProject);
            await _context.SaveChangesAsync();
            return Ok(newProject);
        }

        // 4. Обновить имя или описание проекта
        [HttpPut("projects/{id}")]
        public async Task<IActionResult> UpdateProject(Guid id, [FromBody] Project projectDto)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Проект не найден" });

            project.Name = string.IsNullOrEmpty(projectDto.Name) ? project.Name : projectDto.Name;
            project.Description = projectDto.Description ?? project.Description;

            await _context.SaveChangesAsync();
            return Ok(project);
        }

        // ==========================================
        // 📊 УПРАВЛЕНИЕ ЗАДАЧАМИ (СДВИГИ, ИСПОЛНИТЕЛИ)
        // ==========================================

        // 5. Получить все задачи проекта с их зависимостями
        [HttpGet("projects/{projectId}/tasks")]
        public async Task<ActionResult<IEnumerable<object>>> GetTasks(Guid projectId)
        {
            var tasks = await _context.Tasks
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.Dependencies)
                .ToListAsync();

            var result = tasks.Select(t => {
                // Выносим раскодирование строки исполнителя в отдельную переменную
                var executorName = (t.ExecutorId == null || t.ExecutorId == Guid.Empty)
                    ? ""
                    : System.Text.Encoding.UTF8.GetString(t.ExecutorId.Value.ToByteArray()).TrimEnd('\0', ' ');

                return new
                {
                    t.Id,
                    t.ProjectId,
                    t.Name,
                    t.Status,
                    t.StartDate,
                    t.EndDate,
                    ExecutorId = executorName, // Оставляем для обратной совместимости
                    Executor = executorName,   // ДОБАВИЛИ: Чистый текст, который просит фронтенд
                    Dependencies = t.Dependencies.Select(d => new
                    {
                        d.ParentTaskId,
                        d.ChildTaskId
                    }).ToList()
                };
            });

            return Ok(result);
        }





        // 6. Создать новую задачу
        [HttpPost("tasks")]
        public async Task<ActionResult<TaskItem>> CreateTask([FromBody] System.Text.Json.Nodes.JsonObject body)
        {
            // Безопасно достаем поля из динамического JSON-тела
            body.TryGetPropertyValue("projectId", out var projectIdNode);
            body.TryGetPropertyValue("name", out var nameNode);
            body.TryGetPropertyValue("status", out var statusNode);
            body.TryGetPropertyValue("startDate", out var startDateNode);
            body.TryGetPropertyValue("endDate", out var endDateNode);
            body.TryGetPropertyValue("executor", out var executorNode); // Вот то самое текстовое поле от фронта

            if (projectIdNode == null || !Guid.TryParse(projectIdNode.ToString(), out Guid projectId))
            {
                return BadRequest(new { message = "Некорректный или отсутствующий projectId" });
            }

            var projectExists = await _context.Projects.AnyAsync(p => p.Id == projectId);
            if (!projectExists) return BadRequest(new { message = "Указанный проект не найден" });

            DateTime.TryParse(startDateNode?.ToString(), out DateTime startDate);
            DateTime.TryParse(endDateNode?.ToString(), out DateTime endDate);

            // Кодируем пришедший текст из json-поля executor в Guid
            string executorText = executorNode?.ToString() ?? "";
            Guid encodedExecutorGuid = Guid.Empty;
            if (!string.IsNullOrEmpty(executorText))
            {
                byte[] bytes = new byte[16];
                byte[] textBytes = System.Text.Encoding.UTF8.GetBytes(executorText);
                System.Buffer.BlockCopy(textBytes, 0, bytes, 0, Math.Min(textBytes.Length, 16));
                encodedExecutorGuid = new Guid(bytes);
            }

            var newTask = new TaskItem
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Name = string.IsNullOrEmpty(nameNode?.ToString()) ? "Новая задача" : nameNode.ToString(),
                Status = string.IsNullOrEmpty(statusNode?.ToString()) ? "Todo" : statusNode.ToString(),
                StartDate = startDate,
                EndDate = endDate,
                ExecutorId = encodedExecutorGuid,
                Dependencies = new List<TaskDependency>()
            };

            _context.Tasks.Add(newTask);
            await _context.SaveChangesAsync();

            // Возвращаем объект анонимно, чтобы сразу отдать поле executor текстом обратно
            return Ok(new
            {
                newTask.Id,
                newTask.ProjectId,
                newTask.Name,
                newTask.Status,
                newTask.StartDate,
                newTask.EndDate,
                Executor = executorText, // Отдаем фронту чистый текст сразу в ответе
                newTask.Dependencies
            });
        }

        // 7. Обновление задачи
        [HttpPut("tasks/{id}")]
        public async Task<ActionResult> UpdateTask(Guid id, [FromBody] System.Text.Json.Nodes.JsonObject body)
        {
            var task = await _context.Tasks
                .Include(t => t.Dependencies)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound(new { message = "Задача не найдена" });

            body.TryGetPropertyValue("name", out var nameNode);
            body.TryGetPropertyValue("status", out var statusNode);
            body.TryGetPropertyValue("startDate", out var startDateNode);
            body.TryGetPropertyValue("endDate", out var endDateNode);
            body.TryGetPropertyValue("executor", out var executorNode);

            DateTime.TryParse(startDateNode?.ToString(), out DateTime startDate);
            DateTime.TryParse(endDateNode?.ToString(), out DateTime endDate);

            int daysShift = (startDate - task.StartDate).Days;

            var validationService = new Services.TaskValidationService();
            if (!validationService.ValidateDates(startDate, endDate, out string error))
            {
                return BadRequest(new { message = error });
            }

            task.Name = nameNode?.ToString() ?? task.Name;
            task.Status = statusNode?.ToString() ?? task.Status;
            task.StartDate = startDate;
            task.EndDate = endDate;

            // Кодируем обновленный текст executor в Guid
            string executorText = executorNode?.ToString() ?? "";
            if (!string.IsNullOrEmpty(executorText))
            {
                byte[] bytes = new byte[16];
                byte[] textBytes = System.Text.Encoding.UTF8.GetBytes(executorText);
                System.Buffer.BlockCopy(textBytes, 0, bytes, 0, Math.Min(textBytes.Length, 16));
                task.ExecutorId = new Guid(bytes);
            }
            else
            {
                task.ExecutorId = Guid.Empty;
            }

            if (daysShift != 0)
            {
                var ganttEngine = new Services.GanttEngine();
                await ganttEngine.RecalculateDependenciesAsync(_context, task.ProjectId, id, daysShift);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Задача успешно обновлена" });
        }


        // 8. Удалить задачу и её зависимости
        [HttpDelete("tasks/{id}")]
        public async Task<IActionResult> DeleteTask(Guid id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound(new { message = "Задача не найдена" });

            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ==========================================
        // 🔗 УПРАВЛЕНИЕ ЗАВИСИМОСТЯМИ (СТРЕЛОЧКИ ГАНТА)
        // ==========================================

        // 9. Создать связь между двумя задачами
        [HttpPost("tasks/{id}/dependencies")]
        public async Task<ActionResult> AddDependency(Guid id, [FromBody] System.Text.Json.Nodes.JsonObject body)
        {
            // Безопасно достаем ParentTaskId из JSON, не обращая внимания на регистр букв
            if (body == null || (!body.TryGetPropertyValue("parentTaskId", out var parentNode) && !body.TryGetPropertyValue("ParentTaskId", out parentNode)))
            {
                return BadRequest(new { message = "Поле parentTaskId обязательно в body." });
            }

            if (!Guid.TryParse(parentNode?.ToString(), out Guid parentTaskId))
            {
                return BadRequest(new { message = "Некорректный формат GUID в parentTaskId." });
            }

            Guid childTaskId = id; // Забираем из URL

            var parentExists = await _context.Tasks.AnyAsync(t => t.Id == parentTaskId);
            var childExists = await _context.Tasks.AnyAsync(t => t.Id == childTaskId);

            if (!parentExists || !childExists)
                return NotFound(new { message = "Одна из указанных задач не найдена" });

            var dependencyExists = await _context.TaskDependencies.AnyAsync(td =>
                td.ParentTaskId == parentTaskId && td.ChildTaskId == childTaskId);

            if (dependencyExists)
                return BadRequest(new { message = "Такая связь уже существует" });

            var dependency = new TaskDependency
            {
                ParentTaskId = parentTaskId,
                ChildTaskId = childTaskId
            };

            _context.TaskDependencies.Add(dependency);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Связь успешно добавлена" });
        }


        // 10. Получить список всех пользователей (Четкий контракт для фронтенда)
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users.ToListAsync();
            var result = new List<object>();
            int counter = 1;

            foreach (var u in users)
            {
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
    }
}
