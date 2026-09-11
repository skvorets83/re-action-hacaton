using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GanttManager.API;

namespace GanttManager.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Защита включена обратно
    public class GanttController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GanttController(AppDbContext context)
        {
            _context = context;
        }

        private string GetCurrentUserIdString()
        {
            // Строгое нативное чтение по умолчанию, которое просил фронтендер
            return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }

        [HttpGet("projects")]
        public async Task<ActionResult<IEnumerable<Project>>> GetProjects()
        {
            var userIdString = GetCurrentUserIdString();
            if (!Guid.TryParse(userIdString, out var currentUserId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из токена" });
            }

            return await _context.Projects
                .Where(p => p.OwnerId == currentUserId)
                .Include(p => p.Tasks)
                .ToListAsync();
        }

        [HttpPost("projects")]
        public async Task<ActionResult<Project>> CreateProject([FromBody] System.Text.Json.JsonElement json)
        {
            if (!json.TryGetProperty("name", out var nameProp))
            {
                return BadRequest(new { message = "Поле name является обязательным" });
            }

            var userIdString = GetCurrentUserIdString();
            if (!Guid.TryParse(userIdString, out var currentUserId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из токена" });
            }

            var newProject = new Project
            {
                Id = Guid.NewGuid(),
                Name = nameProp.GetString() ?? "Новый проект",
                Description = json.TryGetProperty("description", out var descProp) ? descProp.GetString() ?? "" : "",
                OwnerId = currentUserId,
                CreatedAt = DateTime.UtcNow,
                Tasks = new List<TaskItem>()
            };

            _context.Projects.Add(newProject);
            await _context.SaveChangesAsync();
            return Ok(newProject);
        }

        [HttpDelete("projects/{id}")]
        public async Task<IActionResult> DeleteProject(Guid id)
        {
            var userIdString = GetCurrentUserIdString();
            if (!Guid.TryParse(userIdString, out var currentUserId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из токена" });
            }

            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound(new { message = "Проект не найден" });

            if (project.OwnerId != currentUserId)
            {
                return Forbid();
            }

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("projects/{projectId}/tasks")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetTasks(Guid projectId)
        {
            var userIdString = GetCurrentUserIdString();
            if (!Guid.TryParse(userIdString, out var currentUserId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из токена" });
            }

            var projectExists = await _context.Projects.AnyAsync(p => p.Id == projectId && p.OwnerId == currentUserId);
            if (!projectExists) return Forbid();

            return await _context.Tasks
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.ParentDependencies)
                .ToListAsync();
        }

        [HttpPost("tasks")]
        public async Task<ActionResult<TaskItem>> CreateTask([FromBody] System.Text.Json.JsonElement json)
        {
            if (!json.TryGetProperty("projectId", out var projProp) || !Guid.TryParse(projProp.GetString(), out var projId))
            {
                return BadRequest(new { message = "Обязательное поле projectId отсутствует или имеет неверный формат GUID" });
            }

            var userIdString = GetCurrentUserIdString();
            if (!Guid.TryParse(userIdString, out var currentUserId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из токена" });
            }

            var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == projId && p.OwnerId == currentUserId);
            if (project == null)
            {
                return BadRequest(new { message = $"Проект с ID {projId} не найден или у вас нет прав на его редактирование" });
            }

            if (!json.TryGetProperty("startDate", out var startProp) || !json.TryGetProperty("endDate", out var endProp))
            {
                return BadRequest(new { message = "Поля startDate и endDate обязательны для создания задачи" });
            }

            var newTask = new TaskItem
            {
                Id = Guid.NewGuid(),
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

        [HttpPut("tasks/{id}")]
        public async Task<IActionResult> UpdateTask(Guid id, [FromBody] System.Text.Json.JsonElement json)
        {
            var task = await _context.Tasks
                .Include(t => t.ParentDependencies)
                .Include(t => t.ChildDependencies)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound(new { message = "Задача не найдена" });

            var userIdString = GetCurrentUserIdString();
            if (!Guid.TryParse(userIdString, out var currentUserId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из токена" });
            }

            var hasAccess = await _context.Projects.AnyAsync(p => p.Id == task.ProjectId && p.OwnerId == currentUserId);
            if (!hasAccess) return Forbid();

            if (!json.TryGetProperty("startDate", out var startProp) || !json.TryGetProperty("endDate", out var endProp))
            {
                return BadRequest(new { message = "Поля startDate и endDate обязательны для обновления" });
            }

            DateTime newStartDate = startProp.GetDateTime();
            DateTime newEndDate = endProp.GetDateTime();

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

            if (daysShift != 0)
            {
                var ganttEngine = new Services.GanttEngine();
                await ganttEngine.RecalculateDependenciesAsync(_context, task.ProjectId, id, daysShift);
            }

            await _context.SaveChangesAsync();
            return Ok(task);
        }

        [HttpDelete("tasks/{id}")]
        public async Task<IActionResult> DeleteTask(Guid id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound(new { message = "Задача не найдена" });

            var userIdString = GetCurrentUserIdString();
            if (!Guid.TryParse(userIdString, out var currentUserId))
            {
                return Unauthorized(new { message = "Не удалось определить пользователя из токена" });
            }

            var hasAccess = await _context.Projects.AnyAsync(p => p.Id == task.ProjectId && p.OwnerId == currentUserId);
            if (!hasAccess) return Forbid();

            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
