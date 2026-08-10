import puppeteer from "puppeteer-core";
import * as signalR from "@microsoft/signalr";
import { unlinkSync, writeFileSync } from "node:fs";

const EDGE = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const HUB_URL = process.env.HUB_URL ?? "http://localhost:5197/gamehub";
const APP_URL = process.env.APP_URL ?? "http://localhost:5197/";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickButton(page, text) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(t));
    if (el) el.click();
  }, text);
  await sleep(500);
}

async function main() {
  writeFileSync("tmp-words.txt", "苹果/apple\n香蕉/banana\n", "utf8");

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(APP_URL, { waitUntil: "networkidle0" });

    await page.waitForSelector("#nickname");
    await page.type("#nickname", "PuppetA");
    await clickButton(page, "创建房间");
    await page.waitForFunction(() => document.body.textContent?.includes("房间码"), { timeout: 15000 });

    const roomCode = await page.evaluate(() => {
      const text = document.body.textContent ?? "";
      const m = text.match(/[A-Z2-9]{6}/);
      return m?.[0] ?? "";
    });
    console.log(`房间码：${roomCode}`);

    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile("tmp-words.txt");
    await sleep(1500);

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    await conn.start();
    const join = await conn.invoke("JoinRoomAsync", roomCode, "PuppetB", "web-canvas-repro-b");
    if (!join.success) {
      console.error("加入失败", join.error);
      return;
    }
    await sleep(1500);

    await clickButton(page, "开始游戏");
    await page.waitForSelector('canvas[aria-label="画布"]', { timeout: 15000 });
    await sleep(2000);

    console.log("采样画布尺寸（每 300ms）：");
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const info = await page.evaluate(() => {
        const canvas = document.querySelector('canvas[aria-label="画布"]');
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect();
        const p = canvas.parentElement?.getBoundingClientRect();
        return {
          cssW: Math.round(r.width),
          cssH: Math.round(r.height),
          bufW: canvas.width,
          bufH: canvas.height,
          parentW: p ? Math.round(p.width) : -1,
          parentH: p ? Math.round(p.height) : -1,
        };
      });
      samples.push(info);
      console.log(JSON.stringify(info));
      await sleep(300);
    }

    const widths = samples.filter(Boolean).map((s) => s.cssW);
    const growing = widths.length > 5 && widths[widths.length - 1] > widths[0] + 10;
    console.log(growing ? "结论：画布宽度持续增长（bug 复现）" : "结论：画布尺寸稳定");

    await conn.stop();
  } finally {
    await browser.close();
    try {
      unlinkSync("tmp-words.txt");
    } catch {
      // ignore
    }
  }
}

await main();
