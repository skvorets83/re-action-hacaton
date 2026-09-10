# Ипользуем чистую Ubuntu, её скрипты Relax.dev не сломают
FROM ubuntu:22.04 AS build-env
WORKDIR /app

# Устанавливаем системные утилиты и .NET 8 SDK вручную
RUN apt-get update && apt-get install -y wget curl dotnet-sdk-8.0

# Копируем и восстанавливаем проект
COPY GanttManager.API/*.csproj ./GanttManager.API/
RUN dotnet restore ./GanttManager.API/GanttManager.API.csproj

# Копируем исходники и собираем релиз
COPY GanttManager.API/ ./GanttManager.API/
WORKDIR /app/GanttManager.API
RUN dotnet publish -c Release -o /app/out

# Этап запуска на чистой Ubuntu runtime
FROM ubuntu:22.04 AS runtime-env
WORKDIR /app

# Устанавливаем .NET 8 ASP.NET Runtime вручную
RUN apt-get update && apt-get install -y aspnetcore-runtime-8.0 && rm -rf /var/lib/apt/lists/*

COPY --from=build-env /app/out .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "GanttManager.API.dll"]
