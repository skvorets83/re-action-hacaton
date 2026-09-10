using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace GanttManager.API
{

    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "User"; // User, Admin
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Project
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public Guid OwnerId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public List<TaskItem> Tasks { get; set; } = new();
    }

    public class TaskItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ProjectId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = "Todo"; // Todo, InProgress, Done, Overdue
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public Guid? ExecutorId { get; set; }
        public List<TaskDependency> Dependencies { get; set; } = new();
    }

    public class TaskDependency
    {
        public Guid ParentTaskId { get; set; }
        public TaskItem ParentTask { get; set; } = null!;
        public Guid ChildTaskId { get; set; }
        public TaskItem ChildTask { get; set; } = null!;
    }

    // ==========================================
    // 🛠️ КОНТЕКСТ ПОДКЛЮЧЕНИЯ К POSTGRESQL
    // ==========================================
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Project> Projects { get; set; } = null!;
        public DbSet<TaskItem> Tasks { get; set; } = null!;
        public DbSet<TaskDependency> TaskDependencies { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<TaskDependency>()
                .HasKey(td => new { td.ParentTaskId, td.ChildTaskId });

            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.ParentTask)
                .WithMany()
                .HasForeignKey(td => td.ParentTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.ChildTask)
                .WithMany(t => t.Dependencies)
                .HasForeignKey(td => td.ChildTaskId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
