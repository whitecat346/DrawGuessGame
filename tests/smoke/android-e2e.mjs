import * as signalR from "@microsoft/signalr";
import { execSync } from "node:child_process";

const ADB = process.env.ADB ?? "C:\\Users\\WhiteCAT\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const HUB_URL = process.env.HUB_URL ?? "http://localhost:5197/gamehub";
const PKG = "com.drawguess.game";

const WORDS = [
  "苹果", "香蕉", "月亮", "太阳", "星星", "房子", "汽车", "飞机", "轮船", "火车",
  "自行车", "手机", "电脑", "书本", "铅笔", "雨伞", "帽子", "眼镜", "鞋子", "蛋糕",
  "冰淇淋", "西瓜", "柠檬", "葡萄", "小猫", "小狗", "兔子", "大象", "老虎", "熊猫",
  "恐龙", "蝴蝶", "蜜蜂", "圣诞树", "彩虹", "火山", "沙漠", "森林", "城堡", "机器人"
];

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✔ ${name}`);
  } else {
    failures++;
    console.error(`  ✘ ${name} ${detail}`);
  }
}

function once(conn, event, predicate = () => true, timeoutMs = 30000) {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const customRoomCode = () =>
  Array.from({ length: 6 }, () => ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]).join("");

const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

function adb(...args) {
  return execSync([q(ADB), ...args.map(q)].join(" "), { encoding: "utf8" });
}

function uiDump() {
  adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  return adb("shell", "cat", "/sdcard/ui.xml");
}

function boundsOf(xml, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<node[^>]*text="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`)
  );
  if (!match) return null;
  return {
    x: (Number(match[1]) + Number(match[3])) / 2,
    y: (Number(match[2]) + Number(match[4])) / 2
  };
}

function canvasBounds(xml) {
  let best = null;
  const re = /<node[^>]*class="android\.view\.View"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const x1 = Number(m[1]);
    const y1 = Number(m[2]);
    const x2 = Number(m[3]);
    const y2 = Number(m[4]);
    const w = x2 - x1;
    const h = y2 - y1;
    const area = w * h;
    // 排除全屏容器，寻找画布大区块
    if (w > 700 && h > 500 && area < 1080 * 2000 && (!best || area > best.area)) {
      best = { x1, y1, x2, y2, area };
    }
  }
  return best;
}

async function main() {
  console.log("Android 自驱动端到端：建房 → 加词库 → 开游戏 → 作画 → 猜词 → 结算");
  let roomCode = "";

  adb("shell", "am", "force-stop", PKG);
  adb("shell", "am", "start", "-n", `${PKG}/.MainActivity`);
  await sleep(5000);

  let xml = uiDump();
  let nickname = boundsOf(xml, "昵称（1-20 字）");
  check("找到昵称输入框", !!nickname, JSON.stringify(nickname));
  if (!nickname) return;

  adb("shell", "input", "tap", String(Math.round(nickname.x)), String(Math.round(nickname.y)));
  await sleep(800);
  adb("shell", "input", "keycombination", "113", "29"); // CTRL+A 全选
  await sleep(200);
  adb("shell", "input", "keyevent", "67"); // DEL 清空
  await sleep(200);
  adb("shell", "input", "text", "TesterA");
  await sleep(500);
  adb("shell", "input", "keyevent", "4"); // BACK 收起键盘
  await sleep(500);

  xml = uiDump();
  const customCodeField = boundsOf(xml, "不填则随机生成");
  check("找到自定义房间码输入框", !!customCodeField);
  if (customCodeField) {
    const customCode = customRoomCode();
    adb("shell", "input", "tap", String(Math.round(customCodeField.x)), String(Math.round(customCodeField.y)));
    await sleep(800);
    adb("shell", "input", "text", customCode);
    await sleep(500);
    adb("shell", "input", "keyevent", "4"); // BACK 收起键盘
    await sleep(500);
    xml = uiDump();
    const createBtn = boundsOf(xml, "创建房间");
    check("找到创建房间按钮", !!createBtn);
    if (!createBtn) return;
    adb("shell", "input", "tap", String(Math.round(createBtn.x)), String(Math.round(createBtn.y)));
    await sleep(4000);

    xml = uiDump();
    const waitingShown = xml.includes("玩家（") && xml.includes(customCode);
    check("创建房间成功且自定义房间码生效", waitingShown, `期望 ${customCode}`);
    if (!waitingShown) return;
    roomCode = customCode;
    console.log(`  房间码：${roomCode}`);
  } else {
    return;
  }

  const conn = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  const draws = [];
  conn.on("DrawActionReceivedAsync", (action) => draws.push(action));

  await conn.start();
  const join = await conn.invoke("JoinRoomAsync", roomCode, "NodeG", "android-e2e-node");
  check("Node 加入房间", join.success === true, JSON.stringify(join));
  await sleep(2000);

  xml = uiDump();
  const sampleBtn = boundsOf(xml, "载入示例词库");
  check("找到载入示例词库按钮", !!sampleBtn);
  if (!sampleBtn) return;
  adb("shell", "input", "tap", String(Math.round(sampleBtn.x)), String(Math.round(sampleBtn.y)));
  await sleep(2500);

  xml = uiDump();
  const startBtn = boundsOf(xml, "开始游戏（至少 2 人）");
  check("找到开始游戏按钮", !!startBtn);
  if (!startBtn) return;
  adb("shell", "input", "tap", String(Math.round(startBtn.x)), String(Math.round(startBtn.y)));

  const activePromise = once(conn, "GameStateUpdatedAsync", (s) => s.state === "RoundActive");
  console.log("等待游戏开始…");
  await activePromise;
  check("游戏进入 RoundActive", true);
  await sleep(1500);

  xml = uiDump();
  const canvas = canvasBounds(xml);
  check("找到画布区域", !!canvas, JSON.stringify(canvas));
  check("Android 端为画师界面", xml.includes("你的词"), "未找到“你的词”");
  if (canvas) {
    console.log(`  画布区域：(${canvas.x1},${canvas.y1})-(${canvas.x2},${canvas.y2})`);
    const cx1 = canvas.x1 + Math.round((canvas.x2 - canvas.x1) * 0.25);
    const cy1 = canvas.y1 + Math.round((canvas.y2 - canvas.y1) * 0.3);
    const cx2 = canvas.x1 + Math.round((canvas.x2 - canvas.x1) * 0.7);
    const cy2 = canvas.y1 + Math.round((canvas.y2 - canvas.y1) * 0.7);
    adb("shell", "input", "motionevent", "DOWN", String(cx1), String(cy1));
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      const x = Math.round(cx1 + (cx2 - cx1) * t);
      const y = Math.round(cy1 + (cy2 - cy1) * t);
      adb("shell", "input", "motionevent", "MOVE", String(x), String(y));
      await sleep(80);
    }
    adb("shell", "input", "motionevent", "UP", String(cx2), String(cy2));
    await sleep(800);
    console.log(`  第一笔后 draws=${draws.length}`);
    adb("shell", "input", "motionevent", "DOWN", String(cx2), String(cy1));
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      const x = Math.round(cx2 + (cx1 - cx2) * t);
      const y = Math.round(cy1 + (cy2 - cy1) * t);
      adb("shell", "input", "motionevent", "MOVE", String(x), String(y));
      await sleep(80);
    }
    adb("shell", "input", "motionevent", "UP", String(cx1), String(cy2));
    await sleep(1500);
    console.log(`  第二笔后 draws=${draws.length}`);
  }
  check("收到 Android 画布笔画", draws.length > 0, `draws=${draws.length}`);

  // Android 发一条聊天消息，验证 send 链路（与画布区分）
  xml = uiDump();
  const chatInput = boundsOf(xml, "猜词 / 聊天…");
  check("找到聊天输入框", !!chatInput);
  if (chatInput) {
    adb("shell", "input", "tap", String(Math.round(chatInput.x)), String(Math.round(chatInput.y)));
    await sleep(800);
    adb("shell", "input", "text", "androidhello");
    await sleep(500);
    adb("shell", "input", "keyevent", "4"); // BACK 收起键盘
    await sleep(500);
    const sendBtn = boundsOf(uiDump(), "发送");
    if (sendBtn) {
      adb("shell", "input", "tap", String(Math.round(sendBtn.x)), String(Math.round(sendBtn.y)));
    }
    const chatPromise = once(conn, "ChatReceivedAsync", (m) => m.text === "androidhello", 8000);
    const gotChat = await Promise.race([
      chatPromise.then(() => true),
      sleep(9000).then(() => false)
    ]);
    check("Android 聊天消息到达 Node", gotChat);
  }

  const correctPromise = once(conn, "ChatReceivedAsync", (m) => m.kind === "correct");
  console.log("开始逐词猜答案…");
  for (const word of WORDS) {
    await conn.invoke("SendChatAsync", word);
    await sleep(120);
  }
  const correct = await correctPromise;
  check("猜中答案并得分", correct.scoreAwarded === 100, JSON.stringify(correct));

  const ending = await once(conn, "GameStateUpdatedAsync", (s) => s.state === "RoundEnding");
  check("回合进入 RoundEnding", !!ending.lastRound?.answer, JSON.stringify(ending.lastRound));
  console.log(`  答案：${ending.lastRound?.answer}`);

  let answerShown = false;
  for (let i = 0; i < 6 && !answerShown; i++) {
    await sleep(600);
    xml = uiDump();
    answerShown =
      xml.includes("答案是") || xml.includes("揭晓") || xml.includes("答对了");
  }
  check("Android 显示答案/答对消息", answerShown);

  await conn.stop();
}

try {
  await main();
} catch (error) {
  failures++;
  console.error("端到端异常：", error);
}

console.log(failures === 0 ? "Android 端到端全部通过 ✔" : `Android 端到端失败：${failures} 项`);
process.exitCode = failures === 0 ? 0 : 1;
