<#
局域网模式运行：
  1. 构建 Web 前端并发布 .NET 服务端
  2. 以 http://0.0.0.0:5197 启动（局域网内手机/电脑可访问）
  3. 打印本机局域网 IP 列表

首次运行可能需要放行 Windows 防火墙（需要管理员权限）：
  New-NetFirewallRule -DisplayName "DrawGuess 5197" -Direction Inbound -Protocol TCP -LocalPort 5197 -Action Allow
#>

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "==> 本机 IPv4 地址："
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    ForEach-Object { Write-Host "    $($_.IPAddress)  ($($_.InterfaceAlias))" }

Write-Host "==> 构建 Web 前端"
Push-Location (Join-Path $root "web")
try {
    pnpm install --frozen-lockfile
    pnpm build
}
finally {
    Pop-Location
}

Write-Host "==> 发布 .NET 服务端"
$out = Join-Path $root "artifacts\server"
dotnet publish (Join-Path $root "server\DrawGuess.Server\DrawGuess.Server.csproj") -c Release -o $out

Write-Host "==> 拷贝前端产物到 wwwroot"
$wwwroot = Join-Path $out "wwwroot"
if (Test-Path $wwwroot) {
    $resolved = (Resolve-Path $wwwroot).Path
    $expected = Join-Path (Join-Path $root "artifacts") "server\wwwroot"
    if (-not $resolved.StartsWith($expected, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "拒绝删除非预期路径: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $root "web\dist") -Destination $wwwroot -Recurse

Write-Host "==> 启动服务: http://0.0.0.0:5197 （Ctrl+C 停止）"
Push-Location $out
try {
    dotnet DrawGuess.Server.dll
}
finally {
    Pop-Location
}
