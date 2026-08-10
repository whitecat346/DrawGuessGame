# Android 客户端（第二阶段）

## 技术栈

- Kotlin + Jetpack Compose（Material3，新野兽派风格）
- SignalR Java 客户端 `com.microsoft.signalr:signalr:10.0.10`（Gson 协议 + OkHttp + RxJava3）
- 音效：Android ToneGenerator 合成，无素材版权问题
- 本地持久化：SharedPreferences（昵称、服务器地址、音效开关、历史战绩）

## 目录结构

```
android/
  app/src/main/java/com/drawguess/game/
    MainActivity.kt        入口
    net/                   SignalR 客户端与 DTO（Gson POJO）
    state/                 ViewModel、UI 状态、画布笔画栈
    data/                  词库解析、设置与历史战绩
    audio/                 ToneGenerator 音效
    ui/                    四个界面与组件
  app/src/main/assets/sample_words.txt  内置示例词库
  app/src/test/            JVM 单元测试（词库解析、Gson DTO）
```

## 构建

要求：JDK 17+、Android SDK（API 36）、首次构建自动下载 Gradle 8.14.3 与依赖。

```powershell
cd android
.\gradlew.bat :app:assembleDebug        # 构建 APK
.\gradlew.bat :app:testDebugUnitTest    # 单元测试
.\gradlew.bat :app:lintDebug            # Lint
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`。

### Release APK

```powershell
.\gradlew.bat :app:assembleRelease
```

输出：`android/app/build/outputs/apk/release/app-release.apk`。

Release 使用专用签名（`android/keystore/release.jks` + `android/keystore.properties`，两者均不入库；换机器后需重新生成或恢复这两个文件）。若缺少签名文件，构建会自动回退到 debug 签名，便于开发环境继续构建。

## 连接服务器

- **模拟器**：应用默认服务器地址为 `http://10.0.2.2:5197/gamehub`，对应宿主机 `http://localhost:5197`，开箱即用。
- **真机**：把手机与电脑连到同一局域网，应用里把地址改为 `http://<电脑局域网IP>:5197/gamehub`，并让服务端监听所有网卡：

```powershell
dotnet artifacts/server/DrawGuess.Server.dll --urls http://0.0.0.0:5197
```

- MVP 阶段 Manifest 开启了 `usesCleartextTraffic`，仅用于开发环境；生产部署应改为 HTTPS。
- **局域网测试**：服务端以 `0.0.0.0:5197` 运行（`deploy/run-lan.ps1`）后，应用内填写 `http://<电脑局域网IP>:5197/gamehub`；Windows 防火墙需放行 5197 端口（管理员执行 `New-NetFirewallRule -DisplayName "DrawGuess 5197" -Direction Inbound -Protocol TCP -LocalPort 5197 -Action Allow`）。

## 自动化端到端测试

`tests/smoke/android-e2e.mjs` 通过 adb 自动驱动模拟器完成全流程：

建房 → 载入示例词库 → 开始游戏 → 在画布上作画 → 发聊天 → Node 客户端猜词命中 → 结算。

```powershell
# 1. 启动服务端（localhost:5197）
# 2. 创建并启动模拟器（AVD 名称 drawguess，API 36）
emulator -avd drawguess -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect
# 3. 运行测试
cd tests/smoke
pnpm install
node android-e2e.mjs
```

## 当前功能

- 创建/加入房间（6 位房间码）
- 等待界面：玩家列表、投票踢人、房主设置（模式/轮数/时长）、TXT 词库导入 + 一键示例词库
- 对局：归一化画布实时同步、颜色/笔刷、撤销、清空、提示词、猜词即聊天、倒计时音效、分数面板
- 画师模式画布保持正方形，并压缩消息栏以增大画布
- 结算：排名、再来一局（房主）、历史战绩

## 已知限制（MVP）

- 服务端断线后不会自动重连，会回到首页重新加入。
- 历史战绩仅存本机，无云端同步。
- 画布事件不做本地回退补偿，弱网下可能出现笔画丢失（与 Web 端一致）。
