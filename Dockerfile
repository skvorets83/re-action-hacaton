# 1. Этап сборки приложения
FROM ://microsoft.com AS build-env
WORKDIR /app

# Копируем файлы проектов и восстанавливаем зависимости
COPY GanttManager.API/*.csproj ./GanttManager.API/
RUN dotnet restore ./GanttManager.API/GanttManager.API.csproj

# Копируем весь исходный код бэкенда
COPY GanttManager.API/ ./GanttManager.API/

# Собираем релизную версию
WORKDIR /app/GanttManager.API
RUN dotnet publish -c Release -o /app/out

# 2. Этап запуска готового приложения
FROM ://microsoft.com AS runtime-env
WORKDIR /app
COPY --from=build-env /app/out .

# Открываем порты для облака
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "GanttManager.API.dll"]
