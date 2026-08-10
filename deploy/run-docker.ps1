<#
Docker 构建并运行（单容器托管前端 + SignalR）：
  .\run-docker.ps1 [-Port 8080]
#>

param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$compose = Join-Path $PSScriptRoot "docker-compose.yml"
$env:PORT = "$Port"

Push-Location $root
try {
    docker compose -f $compose build
    docker compose -f $compose up -d
}
finally {
    Pop-Location
}

Write-Host "服务已启动: http://localhost:$Port"
Write-Host "查看日志: docker compose -f $compose logs -f"
Write-Host "停止服务: docker compose -f $compose down"
