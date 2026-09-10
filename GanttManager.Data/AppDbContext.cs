using Microsoft.EntityFrameworkCore;
using System.Reflection.Emit;

namespace GanttManager.Data
{
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

            // Настройка составного ключа для таблицы зависимостей
            modelBuilder.Entity<TaskDependency>()
                .HasKey(td => new { td.ParentTaskId, td.ChildTaskId });

            // Связь с родительской задачей
            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.ParentTask)
                .WithMany()
                .HasForeignKey(td => td.ParentTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            // Связь с дочерней задачей
            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.ChildTask)
                .WithMany(t => t.Dependencies)
                .HasForeignKey(td => td.ChildTaskId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
