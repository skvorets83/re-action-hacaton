using System.Text;
using GanttManager.API;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Жестко зашитая строка подключения к PostgreSQL в Docker (пользователь postgres)
var connectionString = "Host=localhost;Port=5433;Database=gantt_project_db;Username=postgres;Password=SecretPassword123;Timeout=300";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Настройка CORS для фронтендеров (React)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Swagger доступен всегда для тестов команды и жюри
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();
