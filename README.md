# DrawGuessGame · 你画我猜

一个支持 Web（Windows / macOS / iOS 浏览器）与 Android 原生端的实时你画我猜游戏。

## 技术栈

- 服务端：ASP.NET Core（.NET 10）+ SignalR + C#
- Web 端：React + TypeScript + Vite + Tailwind CSS（新野兽派 Neo-Brutalist）
- Android 端：Kotlin + Jetpack Compose（第二阶段）
- 部署：Docker 与非 Docker 两种模式均支持

## 当前状态

- [x] 需求确认与项目骨架
- [ ] 服务端核心（开发中）
- [ ] Web 端 MVP
- [ ] Android 端（第二阶段）

## 目录结构

```
server/   ASP.NET Core 服务端（SignalR）
web/      React Web 前端
docs/     需求、规则、协议与部署文档
deploy/   Docker Compose 与部署脚本
tests/    .NET 单元测试
```

详细文档见 [docs/](docs/)。
