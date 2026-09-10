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

        // 4. Создать новую задачу в проекте (Принимает ПЛОСКИЙ JSON)
        [HttpPost("tasks")]
        public async Task<ActionResult<TaskItem>> CreateTask([FromBody] TaskItem dto)
        {
            // Полностью сбрасываем автоматическую строгую валидацию .NET,
            // чтобы убрать ошибки "The dto field is required"
            ModelState.Clear();

            // Защитная проверка на случай, если фронтенд прислал битый projectId
            if (dto == null || dto.ProjectId == Guid.Empty)
            {
                return BadRequest(new { message = "Ошибка: Передан пустой или некорректный ProjectId! Он должен быть валидным Guid." });
            }

            _context.Tasks.Add(dto);
            await _context.SaveChangesAsync();
            return Ok(dto);
        }

        // 5. ОБНОВЛЕНИЕ ЗАДАЧИ (СЮДА УЧАСТНИК 2 ВСТАВИТ ПЕРЕСЧЕТ ГАНТА)
        [HttpPut("tasks/{id}")]
        public async Task<IActionResult> UpdateTask(Guid id, [FromBody] TaskItem dto)
        {
            ModelState.Clear();

            if (dto == null) return BadRequest(new { message = "Данные не переданы" });
            if (id != dto.Id) return BadRequest(new { message = "ID задачи не совпадает" });

            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound(new { message = "Задача не найдена" });

            // Обновляем базовые поля, пришедшие с фронтенда из плоского объекта dto
            task.Name = dto.Name;
            task.Status = dto.Status;
            task.StartDate = dto.StartDate;
            task.EndDate = dto.EndDate;
            task.ExecutorId = dto.ExecutorId;
            task.ProjectId = dto.ProjectId;

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
