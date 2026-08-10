import * as signalR from "@microsoft/signalr";
import { execSync } from "node:child_process";
import { PNG } from "pngjs";
import { writeSync } from "node:fs";

const log = (msg) => {
  try {
    writeSync(1, msg + "\n");
  } catch {
    // ignore
  }
};

const ADB = process.env.ADB ?? "C:\\Users\\WhiteCAT\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
const PKG = "com.drawguess.game";
const HUB_URL = process.env.HUB_URL ?? "http://localhost:5197/gamehub";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
const adb = (...args) =>
  execSync([q(ADB), ...args.map(q)].join(" "), { encoding: "utf8", timeout: 20000 });

function uiDump() {
  adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  return adb("shell", "cat", "/sdcard/ui.xml");
}

function boundsOf(xml, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = xml.match(
    new RegExp(`<node[^>]*text="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`)
  );
  if (!m) return null;
  return {
    x: (Number(m[1]) + Number(m[3])) / 2,
    y: (Number(m[2]) + Number(m[4])) / 2,
    x1: Number(m[1]),
    y1: Number(m[2]),
    x2: Number(m[3]),
    y2: Number(m[4]),
  };
}

async function main() {
  log("[1] force-stop + start");
  adb("shell", "am", "force-stop", PKG);
  adb("shell", "am", "start", "-n", `${PKG}/.MainActivity`);
  await sleep(5000);

  log("[2] 输入昵称");
  let xml = uiDump();
  let nickname = boundsOf(xml, "昵称（1-20 字）");
  adb("shell", "input", "tap", String(Math.round(nickname.x)), String(Math.round(nickname.y)));
  await sleep(800);
  adb("shell", "input", "text", "DiagUser");
  await sleep(400);
  adb("shell", "input", "keyevent", "4");
  await sleep(500);

  xml = uiDump();
  const createBtn = boundsOf(xml, "创建房间");
  log("[3] 创建房间");
  adb("shell", "input", "tap", String(Math.round(createBtn.x)), String(Math.round(createBtn.y)));
  await sleep(4000);

  xml = uiDump();
  const roomMatch = xml.match(/text="([A-Z2-9]{6})"/);
  const roomCode = roomMatch?.[1];
  log(`[4] 房间码：${roomCode}`);

  const conn = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();
  await conn.start();
  await conn.invoke("JoinRoomAsync", roomCode, "DiagNode", "diag-node");

  log("[5] 载入词库并开始");
  await sleep(2000);
  xml = uiDump();
  const sampleBtn = boundsOf(xml, "载入示例词库");
  adb("shell", "input", "tap", String(Math.round(sampleBtn.x)), String(Math.round(sampleBtn.y)));
  await sleep(2500);

  xml = uiDump();
  const startBtn = boundsOf(xml, "开始游戏（至少 2 人）");
  adb("shell", "input", "tap", String(Math.round(startBtn.x)), String(Math.round(startBtn.y)));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("等待 RoundActive 超时")), 30000);
    conn.on("GameStateUpdatedAsync", (s) => {
      if (s.state === "RoundActive") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  await sleep(2000);
  log("[6] RoundActive，定位画布");

  xml = uiDump();
  // 画布容器（外层 Box）
  const canvasBox = [...xml.matchAll(/<node[^>]*class="android\.view\.View"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
    .map((m) => ({
      x1: Number(m[1]),
      y1: Number(m[2]),
      x2: Number(m[3]),
      y2: Number(m[4]),
    }))
    .filter((b) => b.x2 - b.x1 > 700 && b.y2 - b.y1 > 500 && (b.x2 - b.x1) * (b.y2 - b.y1) < 1080 * 2000)
    .sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1))[0];
  log(`[7] 画布容器：(${canvasBox.x1},${canvasBox.y1})-(${canvasBox.x2},${canvasBox.y2})`);

  // 在容器内画一条从左下到右上的线（保证落在正方形画布内部）
  const pad = 60;
  const x1 = canvasBox.x1 + pad;
  const y1 = canvasBox.y2 - pad;
  const x2 = canvasBox.x2 - pad;
  const y2 = canvasBox.y1 + pad;
  log(`[8] 触摸线段：(${x1},${y1}) -> (${x2},${y2})`);

  adb("shell", "input", "motionevent", "DOWN", String(x1), String(y1));
  for (let step = 1; step <= 120; step++) {
    const t = step / 120;
    adb("shell", "input", "motionevent", "MOVE", String(Math.round(x1 + (x2 - x1) * t)), String(Math.round(y1 + (y2 - y1) * t)));
    await sleep(16);
  }
  adb("shell", "input", "motionevent", "UP", String(x2), String(y2));
  await sleep(1000);
  log("[9] 画线完成，截图");

  const raw = execSync(`${q(ADB)} exec-out screencap -p`, { encoding: null });
  log("[10] 截图完成，开始分析");
  const png = PNG.sync.read(raw);
  log(`[11] 截图尺寸：${png.width}x${png.height}`);

  // 在容器 ROI 内找深色像素（画的线）
  const dark = [];
  const edge = 20; // 跳过容器边框
  for (let y = canvasBox.y1 + edge; y <= canvasBox.y2 - edge; y++) {
    for (let x = canvasBox.x1 + edge; x <= canvasBox.x2 - edge; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      if (r < 90 && g < 90 && b < 90) dark.push({ x, y });
    }
  }
  console.log(`深色像素数量：${dark.length}`);
  if (dark.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sx = 0, sy = 0;
    for (const p of dark) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      sx += p.x;
      sy += p.y;
    }
    const cx = sx / dark.length;
    const cy = sy / dark.length;
    console.log(`轨迹包围盒：(${minX},${minY})-(${maxX},${maxY}) 质心=(${Math.round(cx)},${Math.round(cy)})`);
    console.log(`预期线段中点：(${Math.round((x1 + x2) / 2)},${Math.round((y1 + y2) / 2)})`);
    console.log(`偏移：dx=${Math.round(cx - (x1 + x2) / 2)} dy=${Math.round(cy - (y1 + y2) / 2)}`);
  }

  // 白底画布边界（ROI 内近白像素包围盒）
  const white = [];
  for (let y = canvasBox.y1 + edge; y <= canvasBox.y2 - edge; y++) {
    for (let x = canvasBox.x1 + edge; x <= canvasBox.x2 - edge; x++) {
      const idx = (png.width * y + x) << 2;
      if (png.data[idx] > 245 && png.data[idx + 1] > 245 && png.data[idx + 2] > 245) white.push({ x, y });
    }
  }
  if (white.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of white) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    console.log(`画布白底边界：(${minX},${minY})-(${maxX},${maxY}) 尺寸=${maxX - minX}x${maxY - minY}`);
    console.log(`容器边界：(${canvasBox.x1},${canvasBox.y1})-(${canvasBox.x2},${canvasBox.y2})`);
    console.log(`边距：左=${minX - canvasBox.x1} 上=${minY - canvasBox.y1} 右=${canvasBox.x2 - maxX} 下=${canvasBox.y2 - maxY}`);
  }

  await conn.stop();
}

await main().catch((e) => {
  console.error("诊断异常：", e);
  process.exitCode = 1;
});
