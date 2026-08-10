# SignalR 通信协议

Hub 地址：`/gamehub`（开发环境：`http://localhost:5197/gamehub`）。

所有方法名遵循 SignalR 规则：C# 方法 `CreateRoomAsync` 在客户端调用为 `createRoom`；服务端事件 `GameStateUpdatedAsync` 在客户端监听为 `gameStateUpdated`。DTO 序列化为 camelCase。

## 客户端调用（invoke）

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `createRoom` | `playerName: string`, `clientId: string` | `JoinResult` |
| `joinRoom` | `roomId: string`, `playerName: string`, `clientId: string` | `JoinResult` |
| `getState` | 无 | `GameStateSnapshot \| null` |
| `leaveRoom` | 无 | 无 |
| `updateSettings` | `RoomSettings` | 无 |
| `setWordBank` | `WordEntry[]` | 无 |
| `startGame` | 无 | 无 |
| `restartGame` | 无 | 无 |
| `sendChat` | `text: string` | 无 |
| `sendHint` | `text: string` | 无 |
| `sendDrawAction` | `DrawAction` | 无 |
| `clearCanvas` | 无 | 无 |
| `undoStroke` | `strokeId: string` | 无 |
| `voteKick` | `targetPlayerId: string` | 无 |

## 服务端事件（on）

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `gameStateUpdated` | `GameStateSnapshot` | 房间状态（秒级推送） |
| `wordAssigned` | `word: string`, `aliases: string[]` | 仅发送给当前画师 |
| `chatReceived` | `ChatMessage` | 聊天/提示/系统/答对消息 |
| `drawActionReceived` | `DrawAction` | 画布笔刷事件（发送给除画师外的玩家） |
| `canvasCleared` | 无 | 新回合/清空画布 |
| `strokeUndone` | `strokeId: string` | 撤销指定笔画 |
| `kicked` | `reason: string` | 被投票移出 |
| `error` | `message: string` | 操作被拒绝的原因 |

## 主要 DTO

```ts
interface JoinResult {
  success: boolean;
  roomId?: string;
  playerId?: string;
  state?: GameStateSnapshot;
  error?: string;
}

interface GameStateSnapshot {
  roomId: string;
  state: "Waiting" | "RoundActive" | "RoundEnding" | "GameOver";
  settings: RoomSettings;
  players: PlayerInfo[];
  scores: PlayerScore[];
  currentRound: number;
  totalRounds: number;
  currentDrawerId?: string;
  remainingSeconds: number;
  wordCount: number;
  kickVote?: KickVote;
  lastRound?: RoundSummary;
}

interface RoomSettings {
  scoreMode: "Preemptive" | "Decreasing";
  totalRounds: number;      // 1-20
  roundDurationSeconds: number; // 15-300
}

interface PlayerInfo { id: string; name: string; isHost: boolean; }
interface PlayerScore { playerId: string; name: string; score: number; }

interface WordEntry { word: string; aliases: string[]; }

interface KickVote {
  targetId: string;
  targetName: string;
  initiatorId: string;
  yesVotes: number;
  requiredVotes: number;
  remainingSeconds: number;
}

interface RoundSummary {
  round: number;
  answer?: string;
  correctGuesserIds: string[];
  scores: PlayerScore[];
}

interface ChatMessage {
  id: string;
  playerId?: string;
  playerName: string;
  text: string;
  kind: "chat" | "hint" | "system" | "correct";
  scoreAwarded?: number;
}

interface DrawAction {
  type: "begin" | "draw" | "end";
  strokeId: string;
  x: number;   // 归一化坐标 0..1
  y: number;
  color: string;
  size: number;
}
```

## 画布同步约定

- 坐标使用归一化值（0..1），客户端根据画布实际尺寸换算，保证不同分辨率下一致。
- 每个笔画由画师客户端生成唯一 `strokeId`，依次发送 `begin` → 若干 `draw` → `end`。
- `undoStroke` 按 `strokeId` 撤销；所有客户端维护相同的笔画栈。
- 新回合开始服务端广播 `canvasCleared`，所有客户端清空画布。
