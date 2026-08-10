# DrawGuessGame · 你画我猜

一个支持 Web（Windows / macOS / iOS 浏览器）与 Android 原生端的实时你画我猜游戏。

## 技术栈

- 服务端：ASP.NET Core（.NET 10）+ SignalR + C#
- Web 端：React + TypeScript + Vite + Tailwind CSS（新野兽派 Neo-Brutalist）
- Android 端：Kotlin + Jetpack Compose（第二阶段）
- 部署：Docker 与非 Docker 两种模式均支持

## 当前状态

- [x] 需求确认与项目骨架
- [x] 服务端核心（SignalR 游戏引擎 + 31 个单元测试）
- [x] Web 端 MVP（建房/加入/画画/猜词/计分/房主设置/投票踢人/词库导入）
- [x] Android 端 MVP（Kotlin + Jetpack Compose，模拟器端到端验证通过；画布缩放/正方形画师画布）

## 目录结构

```
server/   ASP.NET Core 服务端（SignalR）
web/      React Web 前端
android/  Kotlin + Jetpack Compose 原生客户端
docs/     需求、规则、协议、部署与 Android 文档
deploy/   Docker Compose 与部署脚本
tests/    .NET 单元测试与端到端冒烟脚本
```

## 快速开始

### 开发模式

```powershell
# 终端 1：服务端（端口 5197）
dotnet run --project server/DrawGuess.Server

# 终端 2：前端（端口 5173）
cd web
pnpm install
pnpm dev
```

### 一键部署

```powershell
# Docker（端口 8080）
cd deploy
.\run-docker.ps1

# 非 Docker（端口 5197）
.\deploy\run-local.ps1
```

部署细节、反向代理与 HTTPS 建议见 [docs/deployment.md](docs/deployment.md)。

### Android 客户端

```powershell
cd android
.\gradlew.bat :app:assembleDebug
```

模拟器直接连接本机 `http://10.0.2.2:5197/gamehub`；真机与服务器同网段时在应用内填写电脑局域网 IP。详细说明见 [docs/android.md](docs/android.md)。

## 测试

```powershell
# 服务端单元测试（31 项）
dotnet test DrawGuess.slnx

# 端到端冒烟测试（需先启动服务端）
cd tests/smoke
pnpm install
node smoke.mjs

# Android 自驱动端到端（需 API 36 模拟器）
node android-e2e.mjs
```

需求、规则与协议文档见 [docs/](docs/)。
