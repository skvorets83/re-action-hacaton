using System;
using System.Collections.Generic;

namespace GanttManager.Data
{
    // 1. Таблица Пользователей
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "User"; // User, Admin
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // 2. Таблица Проектов
    public class Project
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public Guid OwnerId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<TaskItem> Tasks { get; set; } = new();
    }

    // 3. Таблица Задач
    public class TaskItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ProjectId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = "Todo"; // Todo, InProgress, Done, Overdue
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public Guid? ExecutorId { get; set; } // Кто делает (может быть пустым)

        // Связи для каскадного пересчета Ганта (какие задачи должны завершиться ДО этой)
        public List<TaskDependency> Dependencies { get; set; } = new();
    }

    // 4. Таблица связей между задачами (Диаграмма Ганта)
    public class TaskDependency
    {
        public Guid ParentTaskId { get; set; } // Задача-предшественник
        public TaskItem ParentTask { get; set; } = null!;

        public Guid ChildTaskId { get; set; }  // Зависимая задача
        public TaskItem ChildTask { get; set; } = null!;
    }
}
