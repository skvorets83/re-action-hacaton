using System.Text;
using GanttManager.API;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// --- НАСТРОЙКА ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ ---
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");

if (string.IsNullOrEmpty(connectionString))
{
    // Зашитая строка для локального запуска (или если переменная не прилетела)
    connectionString = "Host=db-team-cmtvq2ykq00b4mx01tjøtg30q;Port=5432;Database=db_re_action_hacaton;Username=u_cntvr971k0;Password=QFV5jJ0rm3DBIfk4IxFyHLDndTVXlfl;Timeout=300;SSL Mode=Prefer;Trust Server Certificate=true;";
}
else if (connectionString.StartsWith("postgres://") || connectionString.StartsWith("postgresql://"))
{
    // ИСПРАВЛЕННЫЙ ПАРСИНГ ОБЛАЧНОЙ СТРОКИ ИЗ ПАНЕЛИ RELAX DEV
    var uri = new Uri(connectionString);
    var userInfo = uri.UserInfo.Split(':');
    var username = userInfo[0]; // Исправлено: берем первый элемент (логин)
    var password = userInfo.Length > 1 ? userInfo[1] : ""; // Исправлено: берем второй элемент (пароль)
    connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={username};Password={password};Timeout=300;SSL Mode=Prefer;Trust Server Certificate=true;";
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));
// --------------------------------------------

// --- НАСТРОЙКА JWT АУТЕНТИФИКАЦИИ ---
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? "SuperSecretKeyGanttManager2026ProtectedAndLongEnough!";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"] ?? "GanttManagerAPI",
        ValidAudience = jwtSettings["Audience"] ?? "GanttManagerClient",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "GanttManager API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Введите JWT токен в формате: Bearer {ваш_токен}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

app.UseRouting();
app.UseCors("AllowAll");

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// --- АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ МИГРАЦИЙ ПРИ СТАРТЕ ---
using (var scope = app.Services.CreateScope())
{
    try
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        context.Database.Migrate(); // Внутри облака этот метод сработает мгновенно!
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Ошибка при применении миграций БД: {ex.Message}");
    }
}

app.Run();
