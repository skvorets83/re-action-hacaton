using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        // 2. Создать новый проект
        [HttpPost("projects")]
        public async Task<ActionResult<Project>> CreateProject([FromBody] Project project)
        {
            _context.Projects.Add(project);
            await _context.SaveChangesAsync();
            return Ok(project);
        }

        // ==========================================
        // 📊 УПРАВЛЕНИЕ ЗАДАЧАМИ (ДЛЯ УЧАСТНИКА 2)
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

        // 4. Создать новую задачу в проекте
        [HttpPost("tasks")]
        public async Task<ActionResult<TaskItem>> CreateTask([FromBody] TaskItem task)
        {
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();
            return Ok(task);
        }

        // 5. ОБНОВЛЕНИЕ ЗАДАЧИ (СЮДА УЧАСТНИК 2 ВСТАВИТ ПЕРЕСЧЕТ ГАНТА)
        [HttpPut("tasks/{id}")]
        public async Task<IActionResult> UpdateTask(Guid id, [FromBody] TaskItem updatedTask)
        {
            if (id != updatedTask.Id) return BadRequest(new { message = "ID задачи не совпадает" });

            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound(new { message = "Задача не найдена" });

            // Обновляем базовые поля, пришедшие с фронтенда
            task.Name = updatedTask.Name;
            task.Status = updatedTask.Status;
            task.StartDate = updatedTask.StartDate;
            task.EndDate = updatedTask.EndDate;
            task.ExecutorId = updatedTask.ExecutorId;

            // ------------------------------------------------------------
            // TODO ДЛЯ УЧАСТНИКА 2: 
            // Вызвать алгоритм каскадного пересчета дат для зависимых задач!
            // Например: Вызвать метод GanttService.Recalculate(task.ProjectId);
            // ------------------------------------------------------------

            await _context.SaveChangesAsync();
            return Ok(task);
        }
        // 6. УДАЛЕНИЕ ЗАДАЧИ И ВСЕХ ЕЁ СВЯЗЕЙ (ДЛЯ ПУНКТА 4 ФРОНТЕНДА)
        [HttpDelete("tasks/{id}")]
        public async Task<IActionResult> DeleteTask(Guid id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound(new { message = "Задача не найдена" });

            // Удаляем задачу (связи в БД почистятся автоматически по правилу Cascade)
            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();

            return NoContent(); // Статус 204 (Успешно удалено, контента нет)
        }

    }
}
