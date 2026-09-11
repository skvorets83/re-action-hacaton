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





        // 6. Создать новую задачу (С привязкой выбранного исполнителя)
        [HttpPost("tasks")]
        public async Task<ActionResult<TaskItem>> CreateTask([FromBody] TaskItem taskDto)
        {
            var projectExists = await _context.Projects.AnyAsync(p => p.Id == taskDto.ProjectId);
            if (!projectExists) return BadRequest(new { message = "Указанный проект не найден" });

            if (taskDto.ExecutorId.HasValue && taskDto.ExecutorId != Guid.Empty)
            {
                var userExists = await _context.Users.AnyAsync(u => u.Id == taskDto.ExecutorId.Value);
                if (!userExists) return BadRequest(new { message = "Указанный исполнитель не найден в базе данных" });
            }

            var newTask = new TaskItem
            {
                Id = Guid.NewGuid(),
                ProjectId = taskDto.ProjectId,
                Name = string.IsNullOrEmpty(taskDto.Name) ? "Новая задача" : taskDto.Name,
                Status = string.IsNullOrEmpty(taskDto.Status) ? "Todo" : taskDto.Status,
                StartDate = taskDto.StartDate,
                EndDate = taskDto.EndDate,
                ExecutorId = taskDto.ExecutorId == Guid.Empty ? null : taskDto.ExecutorId,
                Dependencies = new List<TaskDependency>()
            };

            _context.Tasks.Add(newTask);
            await _context.SaveChangesAsync();
            return Ok(newTask);
        }

        // 7. ОБНОВЛЕНИЕ ЗАДАЧИ С КАСКАДНЫМ ПЕРЕСЧЕТОМ ГАНТА И СМЕНОЙ ИСПОЛНИТЕЛЯ
        [HttpPut("tasks/{id}")]
        public async Task<IActionResult> UpdateTask(Guid id, [FromBody] TaskItem taskDto)
        {
            var task = await _context.Tasks
                .Include(t => t.Dependencies)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound(new { message = "Задача не найдена" });

            int daysShift = (taskDto.StartDate - task.StartDate).Days;

            var validationService = new Services.TaskValidationService();
            if (!validationService.ValidateDates(taskDto.StartDate, taskDto.EndDate, out string error))
            {
                return BadRequest(new { message = error });
            }

            task.Name = taskDto.Name;
            task.Status = taskDto.Status;
            task.StartDate = taskDto.StartDate;
            task.EndDate = taskDto.EndDate;
            task.ExecutorId = taskDto.ExecutorId == Guid.Empty ? null : taskDto.ExecutorId;

            if (daysShift != 0)
            {
                var ganttEngine = new Services.GanttEngine();
                await ganttEngine.RecalculateDependenciesAsync(_context, task.ProjectId, id, daysShift);
            }

            await _context.SaveChangesAsync();
            return Ok(task);
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
