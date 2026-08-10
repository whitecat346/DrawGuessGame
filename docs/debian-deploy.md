# Debian 部署（Docker Compose）

本文面向在 Debian 服务器上通过 Docker Compose 部署的流程。预计规模约 10 人，单容器同时托管 Web 前端与 SignalR 服务端。

## 1. 安装 Docker Engine 与 Compose 插件

以 Debian 12（bookworm）为例：

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

验证：

```bash
docker --version
docker compose version
```

## 2. 获取代码并构建启动

```bash
git clone https://github.com/whitecat346/DrawGuessGame.git
cd DrawGuessGame/deploy
sudo docker compose up -d --build
```

构建包含两个阶段：Node 构建前端 → .NET SDK 构建并发布服务端（会把前端产物打进镜像），首次构建需要几分钟。

查看状态与日志：

```bash
docker compose ps
docker compose logs -f drawguess
```

健康检查通过后即可访问：`http://<服务器IP>:8080`，健康检查地址 `http://<服务器IP>:8080/health`。

## 3. 端口与防火墙

- 默认对外端口 `8080`；想换端口：

```bash
PORT=9000 sudo docker compose up -d
```

- 若启用了 `ufw`，放行端口：

```bash
sudo ufw allow 8080/tcp
```

## 4. 更新部署

```bash
cd DrawGuessGame
git pull
cd deploy
sudo docker compose up -d --build
```

旧容器会优雅停止（最多等待 30 秒）再启动新容器。注意：房间数据仅存于内存，重启后所有房间失效。

## 5. HTTPS 反向代理（可选）

如果需要域名 + HTTPS，推荐在宿主机安装 Caddy 并把请求反代到 `localhost:8080`：

```caddyfile
example.com {
    reverse_proxy localhost:8080
}
```

Caddy 自动处理证书与 WebSocket 转发，无需修改 compose 配置。
