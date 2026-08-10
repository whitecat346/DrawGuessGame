# 部署文档

项目同时支持 **Docker** 与 **非 Docker** 两种部署方式。MVP 是单容器/单进程模型：ASP.NET Core 服务端同时托管 SignalR 与打包好的 Web 前端，无需额外的 Nginx 容器。

预计在线规模约 10 人，房间状态仅存于进程内存，无数据库依赖；进程重启后所有房间即失效。

## 方式一：Docker

要求：已安装 Docker + Docker Compose。

```powershell
cd deploy
.\run-docker.ps1            # 默认端口 8080
.\run-docker.ps1 -Port 9000 # 自定义端口
```

等价于：

```bash
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d
```

镜像构建过程：Node 阶段构建 React 前端 → .NET SDK 阶段发布服务端并把前端产物拷入 `wwwroot` → 最终运行 ASP.NET 运行时镜像。

访问 `http://localhost:8080` 即进入游戏。健康检查：`http://localhost:8080/health`。

停止/清理：

```bash
docker compose -f deploy/docker-compose.yml down
```

## 方式二：非 Docker

要求：.NET SDK 10（版本与 `global.json` 一致）、Node.js 24+ 与 pnpm。

```powershell
.\deploy\run-local.ps1
```

脚本会依次执行：安装并构建前端 → 发布服务端到 `artifacts/server` → 将前端产物拷入服务端 `wwwroot` → 启动服务。默认地址 `http://localhost:5197`（由脚本通过 `--urls` 指定）。

也可以手动分步：

```powershell
cd web
pnpm install --frozen-lockfile
pnpm build

cd ..
dotnet publish server/DrawGuess.Server/DrawGuess.Server.csproj -c Release -o artifacts/server
Copy-Item web/dist artifacts/server/wwwroot -Recurse
dotnet artifacts/server/DrawGuess.Server.dll --urls http://localhost:5197
```

## 开发模式

终端一：启动服务端

```powershell
dotnet run --project server/DrawGuess.Server
```

终端二：启动前端开发服务器（Vite，端口 5173，已配置 CORS）

```powershell
cd web
pnpm install
pnpm dev
```

开发模式下前端通过相对路径 `/gamehub` 连接 SignalR，Vite 代理会把请求转发到 `http://localhost:5197`。

## 反向代理与 HTTPS（建议）

Docker 部署适合放在 Caddy / Nginx / Traefik 等反向代理之后。要点：

- WebSocket 升级需要代理转发 `/gamehub`，并设置合适的 `Upgrade` / `Connection` 头（Caddy 与 Traefik 默认支持）。
- 服务端容器只需监听 `8080`，对外由代理统一提供 HTTPS。
- 同源部署下不需要额外 CORS 配置；若前端与 SignalR 分开部署，请在 `appsettings.json` 的 `Cors:AllowedOrigins` 中补充前端域名。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ASPNETCORE_URLS` | 镜像内 `http://+:8080` | 服务监听地址 |
| `PORT`（compose） | `8080` | 宿主机映射端口 |

## 数据与限制

- 服务端不落库，房间、积分、词库都只存在于内存。
- 被踢玩家在本局内禁止重进（进程重启后失效）。
- 历史战绩由各客户端本地保存，与服务器无关。
