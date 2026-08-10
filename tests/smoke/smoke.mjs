import * as signalR from "@microsoft/signalr";

const HUB_URL = process.env.HUB_URL ?? "http://localhost:5197/gamehub";

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✔ ${name}`);
  } else {
    failures++;
    console.error(`  ✘ ${name} ${detail}`);
  }
}

async function connect(name, clientId) {
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();
  await conn.start();
  return conn;
}

function once(conn, event, predicate = () => true, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const handler = (...args) => {
      if (!predicate(...args)) return;
      conn.off(event, handler);
      clearTimeout(timer);
      resolve(args.length <= 1 ? args[0] : args);
    };
    const timer = setTimeout(() => {
      conn.off(event, handler);
      reject(new Error(`等待事件超时: ${event}`));
    }, timeoutMs);
    conn.on(event, handler);
  });
}

async function stop(...connections) {
  for (const conn of connections) {
    try {
      await conn.stop();
    } catch {
      // ignore
    }
  }
}

async function gameFlow() {
  console.log("1) 游戏主流程：建房 → 猜词 → 回合结束 → 结算 → 画布同步 → 再来一局");

  const host = await connect("小明", "smoke-flow-a");
  const guest = await connect("小红", "smoke-flow-b");

  const create = await host.invoke("CreateRoomAsync", "小明", "smoke-flow-a");
  check("房主创建房间", create.success === true && !!create.roomId);
  if (!create.success) {
    await stop(host, guest);
    return;
  }
  const roomId = create.roomId;

  const join = await guest.invoke("JoinRoomAsync", roomId, "小红", "smoke-flow-b");
  check("玩家加入房间", join.success === true && !!join.playerId);

  const wordPromise = once(host, "WordAssignedAsync");
  await host.invoke("UpdateSettingsAsync", { scoreMode: "Preemptive", totalRounds: 1, roundDurationSeconds: 60 });
  await host.invoke("SetWordBankAsync", [{ word: "苹果", aliases: ["apple"] }]);
  await host.invoke("StartGameAsync");

  const assigned = await wordPromise;
  check("画师（房主）收到答案", assigned[0] === "苹果", JSON.stringify(assigned));

  const wrongPromise = once(guest, "ChatReceivedAsync", (m) => m.kind === "chat" && m.text === "香蕉");
  await guest.invoke("SendChatAsync", "香蕉");
  const wrong = await wrongPromise;
  check("错误猜测作为聊天广播", wrong.playerName === "小红", JSON.stringify(wrong));

  const correctPromise = once(guest, "ChatReceivedAsync", (m) => m.kind === "correct");
  await guest.invoke("SendChatAsync", "apple");
  const correct = await correctPromise;
  check("正确答案自动判定（别名/大小写）", correct.playerName === "小红" && correct.scoreAwarded === 100, JSON.stringify(correct));

  const endingPromise = once(guest, "GameStateUpdatedAsync", (s) => s.state === "RoundEnding");
  const ending = await endingPromise;
  check("抢占模式：答对即进入回合结算", ending.lastRound?.answer === "苹果", JSON.stringify(ending.lastRound));
  check("计分：猜中者 100 / 画师 20", ending.scores.find((s) => s.playerId === join.playerId)?.score === 100 &&
    ending.scores.find((s) => s.playerId === create.playerId)?.score === 20, JSON.stringify(ending.scores));

  const overPromise = once(guest, "GameStateUpdatedAsync", (s) => s.state === "GameOver");
  const over = await overPromise;
  check("全部轮次结束后进入结算", over.state === "GameOver", JSON.stringify(over));

  await host.invoke("RestartGameAsync");
  await once(guest, "GameStateUpdatedAsync", (s) => s.state === "RoundActive");
  const drawPromise = once(guest, "DrawActionReceivedAsync", (d) => d.type === "begin");
  await host.invoke("SendDrawActionAsync", { type: "begin", strokeId: "stroke-1", x: 0.1, y: 0.2, color: "#ff006e", size: 8, aspect: 1.6 });
  const draw = await drawPromise;
  check("画布笔画转发到观众", draw.strokeId === "stroke-1" && draw.color === "#ff006e", JSON.stringify(draw));

  const clearPromise = once(guest, "CanvasClearedAsync");
  await host.invoke("ClearCanvasAsync");
  await clearPromise;
  check("清空画布广播", true);

  const undoPromise = once(guest, "StrokeUndoneAsync", (id) => id === "stroke-1");
  await host.invoke("UndoStrokeAsync", "stroke-1");
  await undoPromise;
  check("撤销笔画广播", true);

  await stop(host, guest);
}

async function voteKickFlow() {
  console.log("2) 投票踢人：半数通过 → 被踢 → 禁止重进");

  const host = await connect("房主", "smoke-vote-a");
  const b = await connect("玩家B", "smoke-vote-b");
  const c = await connect("玩家C", "smoke-vote-c");

  const create = await host.invoke("CreateRoomAsync", "房主", "smoke-vote-a");
  const roomId = create.roomId;
  const joinB = await b.invoke("JoinRoomAsync", roomId, "玩家B", "smoke-vote-b");
  const joinC = await c.invoke("JoinRoomAsync", roomId, "玩家C", "smoke-vote-c");
  await host.invoke("SetWordBankAsync", [{ word: "测试", aliases: [] }]);

  const kickedPromise = once(c, "KickedAsync");
  await b.invoke("VoteKickAsync", joinC.playerId);
  await host.invoke("VoteKickAsync", joinC.playerId);
  const kicked = await kickedPromise;
  check("被踢玩家收到 kicked 事件", kicked.includes("投票"), kicked);

  const rejoin = await c.invoke("JoinRoomAsync", roomId, "玩家C", "smoke-vote-c");
  check("被踢者禁止重进本局", rejoin.success === false && rejoin.error.includes("移出"), JSON.stringify(rejoin));

  // 触发一次针对房主的投票（应该被服务端拒绝并返回 error 事件）
  const hostKickError = await new Promise((resolve) => {
    const handler = (message) => {
      b.off("ErrorAsync", handler);
      resolve(message);
    };
    b.on("ErrorAsync", handler);
    setTimeout(() => {
      b.off("ErrorAsync", handler);
      resolve(null);
    }, 2000);
    void b.invoke("VoteKickAsync", create.playerId).catch(() => undefined);
  });
  check("对房主投票被拒绝（error 事件）", hostKickError?.includes("房主不可被踢"), JSON.stringify(hostKickError));

  await stop(host, b, c);
}

try {
  await gameFlow();
  console.log("");
  await voteKickFlow();
  console.log("");
  if (failures > 0) {
    console.error(`冒烟测试结束：${failures} 项失败`);
    process.exitCode = 1;
  } else {
    console.log("冒烟测试全部通过 ✔");
  }
} catch (error) {
  failures++;
  console.error("冒烟测试异常：", error);
  process.exitCode = 1;
}
