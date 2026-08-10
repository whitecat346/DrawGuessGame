# ---- Web 构建阶段 ----
FROM node:24-alpine AS web
WORKDIR /src/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# ---- .NET 构建阶段 ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# 安装与 global.json 完全一致的 SDK（基础镜像内置的 10.0.3xx 不满足 rollForward: disable）
RUN curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh \
    && bash /tmp/dotnet-install.sh --channel 10.0 --version 10.0.204 --install-dir /usr/share/dotnet \
    && rm /tmp/dotnet-install.sh
COPY global.json DrawGuess.slnx ./
COPY server/DrawGuess.Server/ server/DrawGuess.Server/
COPY --from=web /src/web/dist server/DrawGuess.Server/wwwroot/
RUN dotnet publish server/DrawGuess.Server/DrawGuess.Server.csproj -c Release -o /out

# ---- 运行阶段 ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /out ./
EXPOSE 8080
ENTRYPOINT ["dotnet", "DrawGuess.Server.dll"]
