<#
非 Docker 本地运行：
  1. 构建 Web 前端
  2. 发布 .NET 服务端
  3. 将前端产物拷入服务端 wwwroot
  4. 启动服务（默认 http://localhost:5197）
#>

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

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

Write-Host "==> 启动服务: http://localhost:5197 （Ctrl+C 停止）"
Push-Location $out
try {
    dotnet DrawGuess.Server.dll --urls http://localhost:5197
}
finally {
    Pop-Location
}
