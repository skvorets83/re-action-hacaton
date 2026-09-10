using System.Text;
using GanttManager.API;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// --- НАСТРОЙКА ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ ---
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");

if (string.IsNullOrEmpty(connectionString))
{
    // Зашитая строка для локального запуска (параметры SSL исправлены под требования RelaxDev)
    connectionString = "Host=db-team-cmtvq2ykq00b4mx01tjøtg30q;Port=5432;Database=db_re_action_hacaton;Username=u_cntvr971k0;Password=QFV5jJ0rm3DBIfk4IxFyHLDndTVXlfl;Timeout=300;SSL Mode=Prefer;Trust Server Certificate=true;";
}
else if (connectionString.StartsWith("postgres://") || connectionString.StartsWith("postgresql://"))
{
    // Парсинг облачной переменной DATABASE_URL из формата URL в формат строки подключения Npgsql
    var uri = new Uri(connectionString);
    var userInfo = uri.UserInfo.Split(':');
    var username = userInfo[0];
    var password = userInfo.Length > 1 ? userInfo[1] : "";
    connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={username};Password={password};Timeout=300;SSL Mode=Prefer;Trust Server Certificate=true;";
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));
// --------------------------------------------

// Настройка CORS для фронтендеров (React) - разрешены локальный хост и облачный Vercel
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()   // Разрешить любой сайт (больше никаких проблем со слешами и URL!)
              .AllowAnyMethod()   // Разрешить GET, POST, PUT, DELETE
              .AllowAnyHeader();  // Разрешить любые заголовки
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseRouting();

// CORS должен быть строго между UseRouting и UseAuthorization
app.UseCors("AllowAll");

// Swagger доступен всегда для тестов команды и жюри
app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthorization();
app.MapControllers();

// --- АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ МИГРАЦИЙ ПРИ СТАРТЕ ---
using (var scope = app.Services.CreateScope())
{
    try
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // Этот метод сам создаст базу данных и все таблицы в облаке, если их еще нет
        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        // Если при миграции что-то пойдет не так, ошибка запишется в логи контейнера
        Console.WriteLine($"Ошибка при применении миграций БД: {ex.Message}");
    }
}
// ----------------------------------------------------

app.Run();
