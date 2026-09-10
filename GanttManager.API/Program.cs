using System.Text;
using GanttManager.API;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Жестко зашитая строка подключения к PostgreSQL в Docker (пользователь postgres)
var connectionString = "Host=db-team-cntvq2ykq00b4mx01tjøtg30q;Port=5432;Database=db_re_action_hacaton;Username=u_cntvr971k0;Password=QFV5jJ0rm3DBIfk4IxFyHLDndTVXlfl;Timeout=300;SSL Mode=Disable;Trust Server Certificate=true;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Настройка CORS для фронтендеров (React)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "https://re-action-hacaton.vercel.app") 
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseRouting();
app.UseCors("AllowAll");

// Swagger доступен всегда для тестов команды и жюри
app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthorization();
app.MapControllers();

app.Run();
