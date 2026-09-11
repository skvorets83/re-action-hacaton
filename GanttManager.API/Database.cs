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
        public string Role { get; set; } = "User";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<Project> Projects { get; set; } = new();
        public List<TaskItem> AssignedTasks { get; set; } = new();
    }

    public class Project
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public Guid OwnerId { get; set; }
        public User Owner { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public List<TaskItem> Tasks { get; set; } = new();
    }

    public class TaskItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = "Todo";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public Guid? ExecutorId { get; set; }
        public User? Executor { get; set; }

        public List<TaskDependency> ParentDependencies { get; set; } = new();
        public List<TaskDependency> ChildDependencies { get; set; } = new();
    }

    public class TaskDependency
    {
        public Guid ParentTaskId { get; set; }
        public TaskItem ParentTask { get; set; } = null!;

        public Guid ChildTaskId { get; set; }
        public TaskItem ChildTask { get; set; } = null!;
    }

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

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<Project>()
                .HasOne(p => p.Owner)
                .WithMany(u => u.Projects)
                .HasForeignKey(p => p.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Executor)
                .WithMany(u => u.AssignedTasks)
                .HasForeignKey(t => t.ExecutorId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Tasks)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TaskDependency>()
                .HasKey(td => new { td.ParentTaskId, td.ChildTaskId });

            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.ParentTask)
                .WithMany(t => t.ChildDependencies)
                .HasForeignKey(td => td.ParentTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.ChildTask)
                .WithMany(t => t.ParentDependencies)
                .HasForeignKey(td => td.ChildTaskId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
