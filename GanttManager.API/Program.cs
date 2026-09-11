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
    connectionString = "Host=db-team-cmtvq2ykq00b4mx01tjøtg30q;Port=5432;Database=db_re_action_hacaton;Username=u_cntvr971k0;Password=QFV5jJ0rm3DBIfk4IxFyHLDndTVXlfl;Timeout=300;SSL Mode=Prefer;Trust Server Certificate=true;";
}
else if (connectionString.StartsWith("postgres://") || connectionString.StartsWith("postgresql://"))
{
    var uri = new Uri(connectionString);
    var userInfo = uri.UserInfo.Split(':');
    var username = userInfo[0];
    var password = userInfo.Length > 1 ? userInfo[1] : "";
    connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={username};Password={password};Timeout=300;SSL Mode=Prefer;Trust Server Certificate=true;";
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));
// --------------------------------------------

// --- НАСТРОЙКА JWT АУТЕНТИФИКАЦИИ ---

var fixedSecretKey = "SuperSecretKeyGanttManager2026ProtectedAndLongEnough!";
var fixedIssuer = "GanttManagerAPI";
var fixedAudience = "GanttManagerClient";

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
        ValidIssuer = fixedIssuer,
        ValidAudience = fixedAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(fixedSecretKey)),
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

// --- СТРОГИЙ ПОРЯДОК СБОРКИ КОНВЕЙЕРА (ОШИБКА БЫЛА ТУТ) ---
app.UseSwagger();
app.UseSwaggerUI();

app.UseRouting(); // 1. Сначала определяем маршрут запроса

app.UseCors("AllowAll"); // 2. Затем применяем CORS-политики

app.UseAuthentication(); // 3. Проверяем, кто пришел (Расшифровываем JWT)
app.UseAuthorization();  // 4. Проверяем права доступа к роуту

app.MapControllers(); // 5. Направляем запрос в контроллер
// -----------------------------------------------------------

using (var scope = app.Services.CreateScope())
{
    try
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Ошибка при применении миграций БД: {ex.Message}");
    }
}

app.Run();
